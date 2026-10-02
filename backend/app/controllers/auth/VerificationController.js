const NotFoundError = require("../../errors/NotFoundError");
const VerificationCode = require("../../models/VerificationCode");
const User = require("../../models/User");
const transporter = require("../../services/mailer");
const env = require("../../../start/env");
const nunjucks = require("nunjucks");
const RequestValidationError = require("../../errors/RequestValidationError");
const moment = require("moment");
const { generateRandomOtp } = require("../../utils/common");
const { twilioSendOtp, twilioMobileOtpVerify } = require("../../services/twilio");
const { verify2FAToken, generate2FASecret, generateQRFromSecret } = require("../../utils/twoFactor");
const BadRequestError = require("../../errors/BadRequestError");
const { saveUserSession } = require("../../services/userSession");
const { generateJwtToken } = require("../../helpers/generateJwt");

class VerificationController {
  async sendEmailVerificationCode(req, res) {
    const { email } = req.body;
    const user = await User.findOne({ email, deletedAt: { $exists: false } });
    if (!user) {
      throw new NotFoundError("Email does not exists!");
    }
    await VerificationCode.deleteOne({ email: user.email });
    const { otp, expiresAt } = generateRandomOtp();
    await VerificationCode.create({
      email,
      otp,
      expiresAt,
    });
    try {
      const { shouldSendEmail } = require("../../utils/notificationHelper");
      const canSendEmail = await shouldSendEmail(user, 'accountAndSecurity');
      if (canSendEmail) {
        let html = nunjucks.render("mails/email_verification_resend.html", { otp, name: user.name || user.email, logoUrl: env.APP_URL });
        const info = await transporter.sendMail({
          from: env.MAIL_FROM_ADDRESS,
          to: user.email,
          subject: "New verification code for hosta.sh",
          html: html,
        });
        console.log("Email verification resend OTP sent successfully:", info);
      }
    } catch (emailError) {
      console.error("Error sending email verification resend OTP:", emailError);
      // Continue even if email fails, OTP is still saved
    }
    return res.status(200).json({ message: "OTP sent successfully.", expiresAt });
  }

  async verifyEmailVerificationCode(req, res) {
    const { email, otp } = req.body;
    const result = await VerificationCode.findOne({
      email: email,
      otp: otp,
    });
    const user = await User.findOne({ email, deletedAt: { $exists: false } });
    if (!result || !user) {
      throw new RequestValidationError([{ type: "field", path: "otp", msg: "OTP is invalid or expired." }]);
    }
    const now = moment()
    const isOtpExpired = moment(result.expiresAt).isBefore(now)
    if (isOtpExpired) {
      throw new RequestValidationError([{ type: "field", path: "otp", msg: "OTP is invalid or expired." }]);
    }
    const wasVerified = !!user.isProfileVerified;
    user.isProfileVerified = true
    await user.save()
    await VerificationCode.deleteOne({ email: user.email });

    // First-time email confirmation → send the branded welcome email (best-effort;
    // a mail failure must never block verification / sign-in).
    if (!wasVerified) {
      try {
        const rewards = require("../../services/rewards");
        const pv = parseFloat(process.env.REWARD_POINT_VALUE) || 0.02;
        const points = rewards.welcomePoints();
        const html = nunjucks.render("mails/welcome.html", {
          name: user.name || user.email,
          points,
          rewardValue: (points * pv).toFixed(2),
          ctaLink: `${env.FRONTEND_URL}/dashboard`,
        });
        await transporter.sendMail({
          from: env.MAIL_FROM_ADDRESS,
          to: user.email,
          subject: `Welcome to hosta.sh — your $${(points * pv).toFixed(0)} is ready`,
          html,
        });
      } catch (e) {
        console.error("Welcome email failed (non-blocking):", e?.message || e);
      }
    }
    if (user.enabled2FA) {
      // Only generate new secret if user doesn't have one
      if (!user.twoFactorSecret) {
        const result = await generate2FASecret(user.email);
        user.twoFactorSecret = result.secret;
        await user.save();

        return res.status(200).json({ qrCode: result.qrCode, success: true, data: user, message: "2FA is enabled. Scan the QR code with your app." });
      } else {

        const result = await generateQRFromSecret(user.email, user.twoFactorSecret);
        return res.status(200).json({ 
          qrCode: result.qrCode,
          success: true, 
          message: "2FA is enabled. You can scan the QR code again if needed, or enter your existing 2FA code to continue.", 
          requires2FA: true,
          allowManualEntry: true,
          data: user 
        });
      }
    }

    const userSession = await saveUserSession({ req, userId: user._id, loginType: "Email" });

    const token = generateJwtToken(user, userSession._id);

    const loginDetails = await User.findById(user._id)
      .populate("membershipTier")
      .populate("badges.badge")
      .populate({
        path: 'apiKeys',
        match: {
          expiresAt: { $gt: new Date() },
          deletedAt: null
        },
        options: {
          sort: { createdAt: -1 },
          limit: 1
        }
      });
    const latestApiKey = loginDetails.apiKeys.length > 0 ? loginDetails.apiKeys[0].toJSON({ virtuals: true }) : null;
    let rewardPoints = await loginDetails.rewardPoints();

    let userData = await user.getProfileWithSignedURL();
    userData._doc.hasPassword = !!user.password;
    userData._doc.latestApiKey = latestApiKey;
    userData._doc.rewardPoints = rewardPoints;

    req.session.jwt = token;
    return res.status(200).json({ message: "Your email has been verified.", isVerified: true, data: userData, token: token });
  }

  async sendMobileOTP(req, res) {
    const { mobile } = req.body;
    const user = await User.findOne({ mobile, deletedAt: { $exists: false } });

    if (!user) {
      throw new NotFoundError("User does not exists!");
    }

    const result = await twilioSendOtp(mobile);

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      status: result.status,
    });
  }

  async verifyMobileOTP(req, res) {
    const { mobile, otp } = req.body;

    const user = await User.findOne({ mobile, deletedAt: { $exists: false } });

    if (!user) {
      throw new NotFoundError("User does not exists!");
    }

    const result = await twilioMobileOtpVerify(mobile, otp);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verify successfully",
      status: result.status,
    });
  }

  async verify2FACode(req, res) {
    const { email, token } = req.body;

    const user = await User.findOne({ email, deletedAt: { $exists: false } });

    if (!user) {
      throw new NotFoundError("User does not exists!");
    }

    if (!user || !user.twoFactorSecret) {
      throw new BadRequestError("2FA not set up for this user");
    }

    console.log("=== 2FA VERIFICATION DEBUG ===");
    console.log("User email:", email);
    console.log("User enabled2FA:", user.enabled2FA);
    console.log("User twoFactorSecret length:", user.twoFactorSecret ? user.twoFactorSecret.length : 0);
    console.log("User twoFactorSecret:", user.twoFactorSecret);
    console.log("Token received:", token);
    console.log("=== END 2FA VERIFICATION DEBUG ===");

    const verified = verify2FAToken(token, user.twoFactorSecret);

    if (!verified) {
      console.log("=== 2FA VERIFICATION FAILED ===");
      console.log("Token:", token);
      console.log("Secret:", user.twoFactorSecret);
      console.log("=== END 2FA VERIFICATION FAILED ===");
      throw new BadRequestError("Invalid 2FA Code.");
    }
   
    const userSession = await saveUserSession({ req, userId: user._id, loginType: "Authenticator" });

    const userJwt = generateJwtToken(user, userSession._id);

  const loginDetails = await User.findById(user._id)
        .populate("membershipTier")
        .populate("badges.badge")
        .populate({
          path: 'apiKeys',
          match: {
            expiresAt: { $gt: new Date() },
            deletedAt: null
          },
          options: {
            sort: { createdAt: -1 },
            limit: 1
          }
        });
      const latestApiKey = loginDetails.apiKeys.length > 0 ? loginDetails.apiKeys[0].toJSON({ virtuals: true }) : null;
      let rewardPoints = await loginDetails.rewardPoints();

      let userData = await user.getProfileWithSignedURL();
      userData._doc.hasPassword = !!user.password;
      userData._doc.latestApiKey = latestApiKey;
      userData._doc.rewardPoints = rewardPoints;

    req.session.jwt = userJwt;

    return res.status(200).json({ message: "2FA verified successfully.", data: userData, token: userJwt });
  }
}

module.exports = new VerificationController();

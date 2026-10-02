const User = require("../../models/User");
const jwt = require("jsonwebtoken");
const VerificationCode = require("../../models/VerificationCode");
const transporter = require("../../services/mailer");
const env = require("../../../start/env");
const nunjucks = require("nunjucks");
const { generateRandomOtp } = require("../../utils/common");
const { uploadFile, getSignedURL } = require("../../utils/gCloudStorage");
const {
        createClientOnBothProviders,
} = require("../../services/domainProviderClient");
const {
        RequestValidationError,
} = require("../../errors/RequestValidationError");
const fs = require("fs");
const BadRequestError = require("../../errors/BadRequestError");
const { saveUserSession } = require("../../services/userSession");
const { generateJwtToken } = require("../../helpers/generateJwt");
const rewards = require("../../services/rewards");

// Build a unique username from an email local-part when the user didn't supply one.
async function generateUniqueUsername(email) {
        const base =
                String(email || "").split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) ||
                "user";
        let candidate = base;
        for (let i = 0; i < 6; i++) {
                const exists = await User.findOne({ username: candidate });
                if (!exists) return candidate;
                candidate = base + Math.floor(1000 + Math.random() * 9000);
        }
        return base + Date.now().toString().slice(-6);
}

class RegisterController {
        async register(req, res, next) {
                try {
                        let profileImgPath = null;
                        const file = req.file;
                        if (file && !file.mimetype.startsWith("image")) {
                                throw new RequestValidationError([
                                        {
                                                type: "field",
                                                path: "profileImg",
                                                msg: "Please upload an image file",
                                        },
                                ]);
                        }
                        if (file) {
                                const uploadResult = await uploadFile(file);
                                if (uploadResult) {
                                        profileImgPath = uploadResult[1]?.name;
                                }
                                fs.unlinkSync(req.file.path);
                        }

                        // Frictionless onboarding: only email + password are required. Fill in
                        // sensible defaults for the fields the DB still needs (name) and a unique
                        // username so the account can be created; users edit these later in
                        // Account Settings.
                        const body = { ...req.body };
                        // Referral attribution: the client sends the REFERRER's code as
                        // `referralCode`. Never persist it as this user's own code.
                        const refCode = String(req.body.referralCode || "").trim();
                        delete body.referralCode;
                        if (!body.username || !String(body.username).trim()) {
                                body.username = await generateUniqueUsername(body.email);
                        }
                        if (!body.name || !String(body.name).trim()) {
                                body.name = String(body.email || "").split("@")[0] || "User";
                        }

                        // Create user with profile image
                        const userPayload = {
                                ...body,
                                ...(profileImgPath && { profileImg: profileImgPath }),
                        };
                        let user = await User.create(userPayload);

                        // Loyalty: referral code + one-time welcome credit + referral
                        // attribution (best-effort; must never break signup).
                        await rewards.onSignup(user, refCode);
                        user = await User.findById(user._id);

                        // Create client on domain providers
                        try {
                                const clientData = {
                                        FirstName: user.name.split(" ")[0] || user.name,
                                        LastName: user.name.split(" ").slice(1).join(" ") || "",
                                        UserName: user.email,
                                        Password:
                                                req.body.password ||
                                                Math.random().toString(36).slice(-8),
                                        CompanyName: req.body.companyName || "Individual",
                                        Address1: req.body.address || "Not provided",
                                        City: req.body.city || "Not provided",
                                        StateName: req.body.state || "Not provided",
                                        CountryName: req.body.country || "US",
                                        Zip: req.body.zip || "00000",
                                        PhoneNo_cc: req.body.phoneCountryCode || "+1",
                                        PhoneNo: req.body.mobile || req.body.phone || "0000000000",
                                        Faxno_cc: req.body.faxCountryCode || "",
                                        FaxNo: req.body.fax || "",
                                        Alternate_Phone_cc:
                                                req.body.alternatePhoneCountryCode || "",
                                        Alternate_Phone: req.body.alternatePhone || "",
                                        Id: user._id.toString(),
                                        email: user.email,
                                };

                                const clientResponse = await createClientOnBothProviders(
                                        clientData
                                );

                                if (clientResponse.length > 0) {
                                        clientResponse.forEach(async (client) => {
                                                if (client.provider && client.responseData) {
                                                        user.domainProviderClient[client.provider] = {
                                                                clientId:
                                                                        client.responseData.clientId ||
                                                                        client.responseData.id ||
                                                                        client.responseData.customerId,
                                                                username: clientData.UserName,
                                                        };
                                                }
                                        });
                                }

                                await user.save();
                        } catch (clientError) {
                                console.error(
                                        "Failed to create domain provider client:",
                                        clientError
                                );
                        }

                        const { otp, expiresAt } = generateRandomOtp();
                        await VerificationCode.create({
                                email: user.email,
                                otp,
                                expiresAt,
                        });
                        const profileUrl = await getSignedURL(profileImgPath);
                        user.profileImg = profileUrl;
                        // Send the verification email best-effort. A mail-provider failure
                        // (e.g. Brevo returning 401 for a placeholder key) must NOT roll back
                        // the freshly created account or turn the whole request into a 500.
                        // The OTP is already persisted (VerificationCode) so verification can
                        // still proceed via /auth/send-email-code once mail is configured.
                        let emailSent = false;
                        try {
                                const { shouldSendEmail } = require("../../utils/notificationHelper");
                                const canSendEmail = await shouldSendEmail(user, 'accountAndSecurity');
                                if (canSendEmail) {
                                        let html = nunjucks.render("mails/verification_code.html", { otp, name: user.name || user.email, logoUrl: env.FRONTEND_URL });
                                        await transporter.sendMail({
                                                from: env.MAIL_FROM_ADDRESS,
                                                to: user.email,
                                                subject: "Verify your hosta.sh account",
                                                html: html, // html body
                                        });
                                        emailSent = true;
                                }
                        } catch (mailErr) {
                                console.error(
                                        "Verification email could not be sent (registration still succeeded):",
                                        mailErr?.message || mailErr
                                );
                        }
                        // Email + password sign-up signs the user straight in (Hostinger-style
                        // checkout gate). The OTP stays persisted for optional verification later.
                        const userSession = await saveUserSession({ req, userId: user._id, loginType: "Email" });
                        const token = generateJwtToken(user, userSession._id);
                        req.session.jwt = token;

                        return res.status(201).json({
                                data: user,
                                token,
                                message: emailSent
                                        ? "Account created. We sent a verification code to your email."
                                        : "Account created.",
                                success: true,
                                emailSent,
                                expiresAt,
                        });
                } catch (err) {
                        next(err);
                }
        }

        async changeEmail(req,res,next){
                try {
                        const { id , email } = req.body;

                        const user = await User.findById(id);
                        if (!user) {
                         throw new BadRequestError("User not found!");
                        }
                
                // Check if email already exists (excluding soft-deleted users)
                const existingUser = await User.findOne({
                        email: email,
                        $or: [
                                { deletedAt: { $exists: false } },
                                { deletedAt: null }
                        ]
                });
                if (existingUser && existingUser._id.toString() !== id) {
                        throw new BadRequestError("This email is already in use");
                }

                        if (user.email === email) {
                                throw new BadRequestError("New email cannot be the same as current email");
                        }

                        await User.findByIdAndUpdate(id, { email: email});

                        const { otp, expiresAt } = generateRandomOtp();
                        await VerificationCode.deleteOne({ email: email });
                        
                        await VerificationCode.create({
                                email: email,
                                otp,
                                expiresAt,
                        });

                        const { shouldSendEmail } = require("../../utils/notificationHelper");
                        const canSendEmail = await shouldSendEmail(user, 'accountAndSecurity');
                        if (canSendEmail) {
                                let html = nunjucks.render("mails/email_change_verification.html", { 
                                        NAME: user.name || email, 
                                        OTP_CODE: otp, 
                                        logoUrl: env.FRONTEND_URL 
                                });
                                const info = await transporter.sendMail({
                                        from: env.MAIL_FROM_ADDRESS,
                                        to: email,
                                        subject: "Verify your new email address",
                                        html: html, // html body
                                });
                        }
                        return res.status(200).json({
                                success: true,
                                message: "Verification code sent to new email",
                                data: {
                                        email: email,
                                        expiresAt,
                                },
                        });
                } catch (err) {
                        next(err);
                }
        }

        async registerTelegramUser(req, res) {
                try {
                        const { telegramId, name, email } = req.body;
                        
                        let user = await User.findOne({
                                telegramId: telegramId,
                                $or: [
                                        { deletedAt: { $exists: false } },
                                        { deletedAt: null }
                                ]
                        });
                        if (!user) {
                                user = await User.create({
                                        name: name ?? email,
                                        telegramId,
                                        email,
                                        banned: false,
                                });

                                // Loyalty: welcome credit + referral code/attribution (best-effort).
                                await rewards.onSignup(user, String(req.body.referralCode || "").trim());
                                user = await User.findById(user._id);

                                // Create client on domain providers
                                try {
                                        const clientData = {
                                                FirstName: user.name.split(" ")[0] || user.name,
                                                LastName: user.name.split(" ").slice(1).join(" ") || "",
                                                UserName: user.email,
                                                Password:
                                                        req.body.password ||
                                                        Math.random().toString(36).slice(-8),
                                                CompanyName: req.body.companyName || "Individual",
                                                Address1: req.body.address || "Not provided",
                                                City: req.body.city || "Not provided",
                                                StateName: req.body.state || "Not provided",
                                                CountryName: req.body.country || "US",
                                                Zip: req.body.zip || "00000",
                                                PhoneNo_cc: req.body.phoneCountryCode || "+1",
                                                PhoneNo:
                                                        req.body.mobile || req.body.phone || "0000000000",
                                                Faxno_cc: req.body.faxCountryCode || "",
                                                FaxNo: req.body.fax || "",
                                                Alternate_Phone_cc:
                                                        req.body.alternatePhoneCountryCode || "",
                                                Alternate_Phone: req.body.alternatePhone || "",
                                                Id: user._id.toString(),
                                                email: user.email,
                                        };

                                        const clientResponse = await createClientOnBothProviders(
                                                clientData
                                        );

                                        if (clientResponse.length > 0) {
                                                clientResponse.forEach(async (client) => {
                                                        if (client.provider && client.responseData) {
                                                                user.domainProviderClient[client.provider] = {
                                                                        clientId:
                                                                                client.responseData.clientId ||
                                                                                client.responseData.id ||
                                                                                client.responseData.customerId,
                                                                        username: clientData.UserName,
                                                                };
                                                        }
                                                });
                                        }

                                        await user.save();
                                } catch (clientError) {
                                        console.error(
                                                "Failed to create domain provider client:",
                                                clientError
                                        );
                                }
                        } else {
                                return res.status(400).json({ error: "User already exists" });
                        }
                        const userJwt = jwt.sign(
                                {
                                        id: user.id,
                                        email: user.email,
                                },
                                process.env.JWT_KEY
                        );
                        req.session = { jwt: userJwt };
                        return res.status(201).json({ data: user });
                } catch (err) {
                        return res.status(500).json({
                                message: "Something went wrong!",
                                details: err.message,
                        });
                }
        }
}

module.exports = new RegisterController();

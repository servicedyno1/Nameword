const NotFoundError = require('../../errors/NotFoundError');
const PasswordResetToken = require('../../models/PasswordResetToken');
const User = require('../../models/User');
const { hmacHash, strRandom } = require('../../utils/common');
const transporter = require('../../services/mailer');
const env = require('../../../start/env');
const nunjucks = require('nunjucks');
const RequestValidationError = require('../../errors/RequestValidationError');
const moment = require('moment');
const VerificationCode = require('../../models/VerificationCode');

class PasswordResetController {
	async sendResetLink(req, res) {
		const { email } = req.body;
		const user = await User.findOne({ email });
		if (!user) {
			throw new NotFoundError("Email does not exists!");
		}
		await PasswordResetToken.deleteOne({ email: user.email });
		const randomString = strRandom();
		const token = hmacHash(randomString);
		await PasswordResetToken.create({
			email, token
		});
		let resetLink = env.FRONTEND_URL + "/password-reset/" + token;
		
		// Check if user has email notifications enabled for account and security
		const { shouldSendEmail } = require("../../utils/notificationHelper");
		const canSendEmail = await shouldSendEmail(user, 'accountAndSecurity');
		if (canSendEmail) {
			let html = nunjucks.render('mails/password_reset.html', { 
				NAME: user.name || user.email,  
				resetLink: resetLink,
				logoUrl: env.FRONTEND_URL 
			});
			const info = await transporter.sendMail({
				from: env.MAIL_FROM_ADDRESS,                                                                                                                                                                                                                                                                                         
				to: user.email,
				subject: "Reset your hosta.sh password",
				html: html, // html body
			});
			console.log(`Password reset email sent to ${user.email}`);
		} else {
			console.log(`Email notification disabled for user ${user.email} - skipping password reset email`);
		}
		return res.status(200).json({ message: "We have emailed you a reset link!" });
	}

	async resetPassword(req, res) {

		const { email, token, password } = req.body;
		let result = await PasswordResetToken.findOne({ token });

		if (result) {
			let newDate = moment(result.createdAt).add(60, 'minutes');
			const now = moment();
			const isInPast = newDate.isBefore(now);
			if (isInPast) {
				throw new RequestValidationError([{ type: "field", path: "email", msg: "This password reset token is invalid." }]);
			}

			let user = await User.findOne({ email: result.email });
			if (user) {
				user.password = password;
				await user.save();
				await result.deleteOne();
				return res.status(200).json({ message: "Your password has been reset. Please login to continue." });
			}
		}
		throw new RequestValidationError([{ type: "field", path: "email", msg: "This password reset token is invalid." }]);
	}

	// async resetPassword(req, res){

	// 	const {email, otp, password } = req.body;
	// 	let result = await VerificationCode.findOne({email, otp});

	// 	if(result){
	// 		const now = moment();
	//   		const isInPast = moment(result.expiresAt).isBefore(now);
	// 		if(isInPast){
	// 			throw new RequestValidationError([{ type:"field", path:"otp", msg:"The OTP has been expired. Please try again." }]);
	// 		}

	// 		let user = await User.findOne({email:result.email});
	// 		if(user){
	// 			user.password = password;
	// 			await user.save();
	// 			await result.deleteOne();
	// 			return res.status(200).json({message:"Your password has been reset. Please login to continue."});
	// 		}
	// 	}
	// 	throw new RequestValidationError([{ type:"field", path:"otp", msg:"The OTP is invalid or expired" }]);
	// }
}

module.exports = new PasswordResetController();
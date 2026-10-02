const NotFoundError = require("../../errors/NotFoundError");
const User = require("../../models/User");
const { hmacHash, strRandom } = require('../../utils/common');
const transporter = require("../../services/mailer");
const env = require("../../../start/env");
const nunjucks = require("nunjucks");
const RequestValidationError = require("../../errors/RequestValidationError");
const moment = require("moment");
const ReactivateAccountToken = require("../../models/ReactivateAccountToken");
const ForbiddenError = require("../../errors/ForbiddenError");
const { uploadFile, getSignedURL, deleteFile } = require("../../utils/gCloudStorage");
const fs = require("fs");
const VerificationCode = require("../../models/VerificationCode");

class UserController {
	async changePassword(req, res) {
		const { oldPassword, newPassword } = req.body;
		const user = await User.findById(req.user.id);
		const isPasswordMatch = await user.isValidPassword(oldPassword);
		if (!isPasswordMatch) {
			return res.status(400).json({ message: "Current password is incorrect" });
		}
		user.password = newPassword;
		await user.save();
		req.session = null;
		return res
			.status(200)
			.json({ message: "Your Password has been updated." });
	} 

	async deactivateAccount(req, res) {
		const user = await User.findById(req.user.id);
		user.deactivated = true;
		await user.save();
		delete req.session.jwt;
		return res
			.status(200)
			.json({
				message: "Your Account has been deactivated temporarily.",
			});
	}

    async sendReactivateAccountLink(req, res) {
        const { email } = req.body;
        const user = await User.findOne({email});
        if(!user){
            throw new NotFoundError("Email does not exists!");
        }
        if (!user.deactivated) {
			throw new RequestValidationError([{ type:"field", path:"email", msg:"This email is already activated." }]);
        }
        await ReactivateAccountToken.deleteOne({email: user.email});
        const randomString = strRandom();
        const token =hmacHash(randomString);
        await ReactivateAccountToken.create({
            email, token
        });
        let reactivateLink = env.FRONTEND_URL+"/reactivate-account/"+token+"?email="+user.email;
        const { shouldSendEmail } = require("../../utils/notificationHelper");
        const canSendEmail = await shouldSendEmail(user, 'accountAndSecurity');
        if (!canSendEmail) {
            return res.status(200).json({message:"We have emailed you a reactivate link!"});
        }
        let html = nunjucks.render('mails/account_reactivation.html', {
            NAME: user.name || user.email,
            reactivateLink: reactivateLink,
            logoUrl: env.FRONTEND_URL
        });
        const info = await transporter.sendMail({
            from: env.MAIL_FROM_ADDRESS,
            to: user.email, 
            subject: "Reactivate your hosta.sh account", 
            html: html, // html body
        });
        return res.status(200).json({message:"We have emailed you a reactivate link!"});
    }

    async unlockAccount(req, res) {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            throw new NotFoundError("Email does not exist!");
        }
        if (!user.locked) {
            throw new RequestValidationError([{ type: "field", path: "email", msg: "This account is not locked." }]);
        }
        
        user.locked = false;
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        await user.save();
        
        return res.status(200).json({
            message: "Your account has been unlocked. You can now login.",
            success: true
        });
    }

    async reactivateAccount(req, res) {
        const { email, token } = req.body;
		let result = await ReactivateAccountToken.findOne({email, token});

		if(result){
			let newDate = moment(result.createdAt).add(60, 'minutes');
			const now = moment();
    		const isInPast = newDate.isBefore(now);
			if(isInPast){
				throw new RequestValidationError([{ type:"field", path:"email", msg:"This reactivate account token is invalid." }]);
			}
	
			let user = await User.findOne({email:result.email});
			if(user){
				user.deactivated = false;
				await user.save();
				await result.deleteOne();
				return res.status(200).json({message:"Your account has been reactivated. Please login to continue."});
			}
		}
		throw new RequestValidationError([{ type:"field", path:"email", msg:"Couldn\'t find user with this email" }]);
    }
 
  async deleteUserAccount(req, res) {
			const user = await User.findById(req.user.id);
			const userEmail = user?.email;
			const userName = user?.name || userEmail;
			
			await VerificationCode.deleteOne({email: userEmail});
			
			// Send account deletion confirmation email before deletion
			try {
				const { shouldSendEmail } = require("../../utils/notificationHelper");
				const canSendEmail = await shouldSendEmail(user, 'accountAndSecurity');
				if (canSendEmail) {
					let html = nunjucks.render('mails/account_deletion_confirmation.html', {
						NAME: userName,
						logoUrl: env.FRONTEND_URL
					});
					await transporter.sendMail({
						from: env.MAIL_FROM_ADDRESS,
						to: userEmail,
						subject: "Your hosta.sh account has been deleted",
						html: html,
					});
				}
			} catch (emailError) {
				console.error("Error sending account deletion email:", emailError);
				// Continue even if email fails
			}
			
			// Permanently delete the user account
			// This will trigger the post hook to clean up related data (profileImg, APIKeys, Domains)
			await user.deleteOne();
			req.session = null;
			
			return res.status(200).json({
				message: "Your account has been permanently deleted."
			});          
	}												

	async updateUserDetails(req, res) {
		const {
			name,
			email,
			mobile,
			username,
			enabled2FA,
			notifySMS,
			notifyEmail,
			password
		} = req.body;
		const user = await User.findById(req.user.id);
		const errors = [];
		if (mobile && mobile.length) {
			// Check if mobile already exists (excluding soft-deleted users)
			const checkUserWithMobile = await User.findOne({
				mobile,
				$or: [
					{ deletedAt: { $exists: false } },
					{ deletedAt: null }
				]
			});
			if (
				checkUserWithMobile &&
				checkUserWithMobile.mobile != user.mobile
			) {
				errors.push({
					type: "field",
					path: "mobile",
					msg: "Mobile already in use",
				});
			} else {
				user.mobile = mobile;
			}
		}
		if (email && email.length) {
		
			const checkUserWithEmail = await User.findOne({
				email,
				$or: [
					{ deletedAt: { $exists: false } },
					{ deletedAt: null }
				]
			});
			if (checkUserWithEmail && checkUserWithEmail.email != user.email) {
				errors.push({
					type: "field",
					path: "email",
					msg: "Email already in use",
				});
			} else {
				user.email = email;
			}
		}
		if (username && username.length) {
			const checkUser = await User.findOne({
				username,
				$or: [
					{ deletedAt: { $exists: false } },
					{ deletedAt: null }
				]
			});
			if (checkUser && checkUser.username != user.username) {
				errors.push({
					type: "field",
					path: "otp",
					msg: "Username already in use",
				});
			} else {
				user.username = username;
			}
		}
		if (errors.length) {
			throw new RequestValidationError(errors);
		}
		user.name = name ? name : user.name;
		if (enabled2FA !== undefined) {
			user.enabled2FA = enabled2FA;
		}
		if (notifySMS !== undefined) {
			user.notifySMS = notifySMS;
		}
		if (notifyEmail !== undefined) {
			user.notifyEmail = notifyEmail;
		}
		if(password){
			user.password = password;
		}
		await user.save();
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
		
		return res.status(200).json({ data: userData, message: "Account details updated successfully." });
	}

	async updateProfilePicture(req,res) {
		const user = await User.findById(req.user.id);
		const file = req.file
		if (!file || !file.mimetype.startsWith("image")) {
			throw new RequestValidationError([{ type:"field", path:"profileImg", msg:"Please upload an image file" }]);
		}
		if (user.profileImg) {
			await deleteFile(user.profileImg)
			user.profileImg = null
            await user.save()
		}
		const result = await uploadFile(file)
		if (result) {
			user.profileImg = result[1]?.name
			await user.save()
		}
		fs.unlinkSync(req.file.path)
		user.profileImg = await getSignedURL(user.profileImg)
		return res.status(200).json({ data: user });
	}

	async deleteProfilePicture(req,res) {
		const user = await User.findById(req.user.id);
		if (user.profileImg) {
			await deleteFile(user.profileImg)
			user.profileImg = null
            await user.save()
		}
		return res.status(200).json({ data: user });
	}

	async getNotificationPreferences(req, res) {
		try {
			const user = await User.findById(req.user.id).select('notificationPreferences');
			if (!user) {
				return res.status(404).json({ message: "User not found", success: false });
			}
			
			// Return default preferences if not set
			const preferences = user.notificationPreferences || {
				subscriptionsAndPayments: {
					sms: false,
					whatsapp: false,
					email: true,
				},
				accountAndSecurity: {
					sms: false,
					whatsapp: true,
					email: true,
				},
				serviceStatusAndChanges: {
					sms: false,
					whatsapp: true,
					email: true,
				},
				productUpdatesAndOffers: {
					sms: true,
					whatsapp: true,
					email: true,
				},
			};

			return res.status(200).json({
				success: true,
				data: preferences,
				message: "Notification preferences retrieved successfully",
			});
		} catch (error) {
			console.error("Error getting notification preferences:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to retrieve notification preferences",
				error: error.message,
			});
		}
	}

	async updateNotificationPreferences(req, res) {
		try {
			const { notificationPreferences } = req.body;
			const user = await User.findById(req.user.id);
			
			if (!user) {
				return res.status(404).json({ message: "User not found", success: false });
			}

			if (notificationPreferences) {
				// Initialize notificationPreferences if it doesn't exist
				if (!user.notificationPreferences) {
					user.notificationPreferences = {
						subscriptionsAndPayments: {
							sms: false,
							whatsapp: false,
							email: true,
						},
						accountAndSecurity: {
							sms: false,
							whatsapp: true,
							email: true,
						},
						serviceStatusAndChanges: {
							sms: false,
							whatsapp: true,
							email: true,
						},
						productUpdatesAndOffers: {
							sms: true,
							whatsapp: true,
							email: true,
						},
					};
				}

				// Validate and update preferences
				if (notificationPreferences.subscriptionsAndPayments) {
					user.notificationPreferences.subscriptionsAndPayments = {
						...user.notificationPreferences.subscriptionsAndPayments,
						...notificationPreferences.subscriptionsAndPayments,
					};
				}
				if (notificationPreferences.accountAndSecurity) {
					user.notificationPreferences.accountAndSecurity = {
						...user.notificationPreferences.accountAndSecurity,
						...notificationPreferences.accountAndSecurity,
					};
				}
				if (notificationPreferences.serviceStatusAndChanges) {
					user.notificationPreferences.serviceStatusAndChanges = {
						...user.notificationPreferences.serviceStatusAndChanges,
						...notificationPreferences.serviceStatusAndChanges,
					};
				}
				if (notificationPreferences.productUpdatesAndOffers) {
					user.notificationPreferences.productUpdatesAndOffers = {
						...user.notificationPreferences.productUpdatesAndOffers,
						...notificationPreferences.productUpdatesAndOffers,
					};
				}
			}

			await user.save();

			return res.status(200).json({
				success: true,
				data: user.notificationPreferences,
				message: "Notification preferences updated successfully",
			});
		} catch (error) {
			console.error("Error updating notification preferences:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to update notification preferences",
				error: error.message,
			});
		}
	}
}

module.exports = new UserController();

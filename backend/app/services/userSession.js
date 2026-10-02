const DeviceDetector = require('device-detector-js');
const geoip = require('geoip-country');
const UserSession = require('../models/UserSession');
const User = require('../models/User');
const transporter = require('./mailer');
const env = require('../../start/env');
const nunjucks = require('nunjucks');
const moment = require('moment');

/**
 * Save a login session to the database.
 *
 * @param {Object} params - Session parameters
 * @param {ObjectId} params.userId - User's MongoDB ID
 * @param {ObjectId} params.req - request
 * @param {String} params.loginType - Login type (email, google, telegram, etc.)
 */

const deviceDetector = new DeviceDetector();

async function saveUserSession({ req, userId, loginType }) {
  try {
    const clientIp = req.clientIp || req.ip;

    const geoData = geoip.lookup(clientIp)


    // Get user agent string
    const userAgentString = req.headers['user-agent'] || '';

    // Parse with device-detector-js (more accurate)
    const deviceInfo = deviceDetector.parse(userAgentString);

    const device = ((str) => str.charAt(0).toUpperCase() + str.slice(1))(
      deviceInfo.device?.type?.replace("smartphone", "Mobile") ?? "unknown"
    );

    const info = {
      countryCode: geoData?.country || 'Unknown',
      countryName: geoData?.name || 'Unknown',
      device: device,
      browser: deviceInfo.client?.name || 'Unknown',
      os: deviceInfo.os?.name || 'Unknown',
      isMobile: deviceInfo.device?.type === 'smartphone',
      isTablet: deviceInfo.device?.type === 'tablet',
      isDesktop: deviceInfo.device?.type === 'desktop',
      ip: clientIp
    }

    console.log('info: ', info);
    
    // Check if this is a new device/location
    const previousSessions = await UserSession.find({ 
      userId,
      _id: { $ne: req?.user?.sessionId } // Exclude current session if exists
    }).sort({ currentLogin: -1 }).limit(1);
    
    const isNewDevice = previousSessions.length === 0 || 
      (previousSessions[0].device !== info.device || 
       previousSessions[0].ipAddress !== info.ip ||
       previousSessions[0].location !== info.countryCode);
    
    const session = new UserSession({
      userId,
      device: info.device || 'Unknown',
      ipAddress: info.ip,
      currentLogin: new Date(),
      location: info.countryCode,
      loginType
    });

    await session.save();
    
    // Send new device login alert email if it's a new device
    if (isNewDevice && previousSessions.length > 0) {
      try {
        const user = await User.findById(userId);
        if (user && user.email) {
          const { shouldSendEmail } = require("../utils/notificationHelper");
          const canSendEmail = await shouldSendEmail(user, 'accountAndSecurity');
          if (canSendEmail) {
            const deviceName = `${info.device} (${info.browser} on ${info.os})`;
            const location = `${info.countryName} (${info.countryCode})`;
            const date = moment().format('MMMM Do YYYY');
            const time = moment().format('h:mm A');
            
            let html = nunjucks.render('mails/new_device_login_alert.html', {
              NAME: user.name || user.email,
              DEVICE: deviceName,
              LOCATION: location,
              DATE: date,
              TIME: time,
              secureAccountLink: env.FRONTEND_URL + '/account/security',
              logoUrl: env.FRONTEND_URL
            });
            
            await transporter.sendMail({
              from: env.MAIL_FROM_ADDRESS,
              to: user.email,
              subject: "New login to your hosta.sh account",
              html: html,
            });
            
            console.log(`New device login alert sent to ${user.email}`);
          }
        }
      } catch (emailError) {
        console.error('Error sending new device login alert:', emailError);
        // Continue even if email fails
      }
    }
    
    return session;
  } catch (error) {
    console.error('Error saving user session:', error.message);
  }
}

async function deleteUserSession(sessionId) {
  return await UserSession.deleteOne({ _id: sessionId });
}

module.exports = {
  saveUserSession,
  deleteUserSession
};

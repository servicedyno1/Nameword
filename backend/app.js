const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
const cookieSession = require("cookie-session");
const createError = require("http-errors");
const nunjucks = require("nunjucks");
const errorHandler = require("./app/middlewares/error-handler");
const requestIp = require('request-ip');

if (process.env.NODE_ENV !== "production") {
	dotenvExpand.expand(dotenv.config());
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}
const env = require("./start/env");

const { initializeSentry, Sentry } = require("./start/sentry");
// initializeSentry();

const njkEnv = nunjucks.configure(path.join(__dirname, "views"), { autoescape: true });

// --- Global email/template branding (available in every nunjucks template) ---
// Assets are served from this Express app's /public folder, so they resolve
// against APP_URL in every environment (no more dead hardcoded hosts).
const EMAIL_BASE_URL = String(process.env.APP_URL || "").replace(/\/+$/, "");
njkEnv.addGlobal("appUrl", EMAIL_BASE_URL);
njkEnv.addGlobal("frontendUrl", String(process.env.FRONTEND_URL || EMAIL_BASE_URL).replace(/\/+$/, ""));
njkEnv.addGlobal("logoUrl", `${EMAIL_BASE_URL}/email-logo.png`);
njkEnv.addGlobal("markUrl", `${EMAIL_BASE_URL}/email-mark.png`);
njkEnv.addGlobal("brandName", process.env.MAIL_NAME || "Nameword");
njkEnv.addGlobal("brandTagline", "Own your name. Power your site.");
njkEnv.addGlobal("supportEmail", process.env.MAIL_FROM_ADDRESS || "hello@nameword.local");
njkEnv.addGlobal("year", new Date().getFullYear());
njkEnv.addGlobal("social", {
        x: "https://x.com/namewordcom",
        facebook: "https://www.facebook.com/namewordcom",
        instagram: "https://www.instagram.com/namewordcom",
        linkedin: "https://www.linkedin.com/company/namewordcom/",
});                                                                                                    
const app = express ();

// Serve static files for email templates (logo, etc.)
// app.use(express.static('public'));  
app.use(express.static(path.join(__dirname, "public")))                                                                                               

app.disable("x-powered-by");
app.set("trust proxy", process.env.NODE_ENV === "production"? 1 : "loopback");

const allowedOrigins = process.env.CORS_ORIGIN
	? process.env.CORS_ORIGIN.split(",")
	: [];                                                                      
// Configure CORS - Allow all origins
app.use(
	cors({
		origin: true,
		credentials: true,
	})
);
app.use(express.json({
	limit: "25mb",
	// Capture the exact raw bytes so Dynopay's V2 webhook signature
	// (HMAC over `${t}.${rawBody}`) can be verified against what was sent.
	verify: (req, _res, buf) => {
		req.rawBody = buf && buf.length ? buf.toString("utf8") : "";
	},
}));
app.use(requestIp.mw());
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(
	cookieSession({
		name: "bozzname-server",
		signed: false,
		secure: process.env.NODE_ENV === "production",
		sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
		httpOnly: true, // Prevent XSS attacks
		maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
)

// VPS Plan subscription Reminder Service
require("./app/jobs/subscriptionReminder");
// cPanel License Reminder Service
require("./app/jobs/cPanelLicenseReminder");
// Auto Renew VPS Plan subscription
require("./app/jobs/autoRenewVPSSubscription");
// Auto Rnew cPanel License
require("./app/jobs/autoRenewcPanelLicense");

// RDP Subscription autoRenew
require("./app/jobs/rdpLifecycleJob");
// RDP Subscription reminder
require("./app/jobs/rdpSubscriptionReminder");
require("./app/jobs/deleteExpiredAccounts");
// HostBay Order Status Sync
require("./app/jobs/syncHostbayOrderStatus");
// Domain Expiry Reminder
require("./app/jobs/domainExpiryReminder");
// Hosting Expiry Reminder
require("./app/jobs/hostingExpiryReminder");
// C3: async provisioning safety-net worker
require("./app/jobs/provisioningWorker");
require("./app/jobs/cryptoTopupLifecycle");
// C2: renewal reminders + auto-renew sweep
require("./app/jobs/nomadlyLifecycle");
require("./app/models/User");
require("./app/models/UserSession");
require("./app/models/Wallet");
require("./app/models/Transaction");
require("./app/models/Payment");
require("./app/models/APIKey");
require("./app/models/CartItem");
require("./app/models/RewardPointLog");
require("./app/models/MembershipTier");
require("./app/models/Badge");
require("./start/logging")();
require("./routes")(app); 

// if (process.env.NODE_ENV !== "development") {
// 	app.use(express.static(path.join(__dirname, "client/dist"))); 
//   	app.get("*", (req, res) => { 
// 		return res.sendFile(
// 			path.resolve(__dirname, "client", "dist", "index.html")
// 		); 
// 	});      
// }        

const frontendPath = path.join(__dirname, "../frontend/dist");

// Serve static files
app.use(express.static(frontendPath));

app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

Sentry.setupExpressErrorHandler(app);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
	next(createError(404, "Route not found"));
});                                                                                                             
                    

  app.use(errorHandler);

module.exports = app;

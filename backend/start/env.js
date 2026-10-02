const { cleanEnv, str, email, json, num, port, url, bool } = require("envalid");

const env = cleanEnv(process.env, {
	APP_NAME: str(),
	APP_KEY: str(),
	PORT: port({ default: 8000 }),
	NODE_ENV: str({
		choices: ["development", "test", "production", "staging"],
	}),
	APP_URL: url(),
	FRONTEND_URL: url(),
	DB_URI: str(),
	CORS_ORIGIN: str(),
	JWT_KEY: str(),
	GOOGLE_CLIENT_ID: str(),
	GOOGLE_CLIENT_SECRET: str(),
	GOOGLE_REDIRECT_URL: url(),
	GOOGLE_LINK_REDIRECT_URL: url(),
	MAIL_MAILER: str(),
	MAIL_HOST: str(),
	MAIL_PORT: port(),
	MAIL_USERNAME: str(),
	MAIL_PASSWORD: str(),
	MAIL_ENCRYPTION: str({ default: null }),
	MAIL_FROM_ADDRESS: email({ default: "hello@example.com" }),
	MAIL_FROM_NAME: str(),
	BREVO_API_KEY: str(),
	BREVO_EMAIL: str(),
	MAIL_NAME: str(),
	TELEGRAM_BOT_TOKEN: str(),
	ADMIN_REGISTER_TOKEN: str(),
	// Twilio configuration (commented out - replaced with Telnyx)
	// TWILIO_ACCOUNT_SID: str(),
	// TWILIO_AUTH_TOKEN: str(),
	// TWILIO_VERIFY_SID: str(),
	// Telnyx configuration
	TELNYX_ACCESS_TOKEN: str(),
	TELNYX_PROFILE_ID: str(),
	TELNYX_PHONE_NUMBER: str(),
	GCLOUD_STORAGE_BUCKET_NAME: str(),
	// Sentry configuration (optional, only used in production)
	SENTRY_DSN: str({ default: "" }),
	BRAND_ADMIN_EMAILS: str({ default: "" }),
	SENTRY_ENVIRONMENT: str({ default: "development" }),
	SENTRY_TRACES_SAMPLE_RATE: num({ default: 0.1 }),
	SENTRY_PROFILES_SAMPLE_RATE: num({ default: 0.1 }),
	// Zapier webhook URL (optional, for live chat integration)
	ZAPIER_WEBHOOK_URL: str({ default: "" }),
	// DynoPay create payment link (JWT + company)
	DYNO_PAY_BASE_URL: str({ default: "" }),
	DYNO_PAY_JWT_TOKEN: str({ default: "" }),
	DYNO_PAY_COMPANY_ID: str({ default: "" }),
	// DynoPay webhook signature verification (optional; if set, X-DynoPay-Signature is required for POST)
	DYNO_PAY_WEBHOOK_SECRET: str({ default: "" }),
	// Nomadly Reseller API (unified domains/dns/vps/rdp/hosting provider)
	NOMADLY_API_BASE_URL: str({ default: "https://2.speechcue.com/reseller/v1" }),
	NOMADLY_API_KEY: str({ default: "" }),
});

module.exports = env;

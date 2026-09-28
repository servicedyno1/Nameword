const axios = require("axios");
const { createPaymentLink } = require("../helpers/dynoPayHelper");

const { DYNO_PAY_API_KEY, DYNO_PAY_BASE_URL, DYNO_PAY_USER_API_URL, DYNO_PAY_CREATE_USER_PATH } = process.env;

/** Base URL for user-related Dynopay APIs (createUser, etc.); may differ from payment-link host. */
const getUserApiBase = () => {
  // Dynopay merchant base is `https://dynopay.com/api`; createUser lives at
  // `/user/createUser` under it. Do NOT strip `/api` (that produced a 404).
  return (DYNO_PAY_USER_API_URL || DYNO_PAY_BASE_URL || "https://dynopay.com/api")
    .trim()
    .replace(/\/+$/, "");
};
/** Path for Dynopay createUser; set to /api/user/createUser if your server uses /api prefix. */
const getCreateUserPath = () => {
  const p = (DYNO_PAY_CREATE_USER_PATH || "/user/createUser").trim();
  return p.startsWith("/") ? p : `/${p}`;
};

/**
 * Build standard Dynopay headers
 */
const buildHeaders = () => ({
  "Content-Type": "application/json",
  "x-api-key": DYNO_PAY_API_KEY,
});

function cleanError(error) {
  if (!error) return { message: "Unknown Dynopay error", statusCode: 500 };
  if (typeof error === "string") return { message: error, statusCode: 500 };
  if (error?.response?.data) return error.response.data;
  if (error?.data) return error.data;
  if (error?.message?.includes("<!DOCTYPE html")) {
    return { message: "Invalid Dynopay endpoint (check URL or route)", statusCode: 404 };
  }
  return { message: error.message || "Dynopay request failed", statusCode: error.status || 500 };
}


/**
 * Register a new user on Dynopay
 * (Bozzmail uses this on signup / first payment)
 */
const registerUserForPayment = async (email, fullName, phoneNumber) => {
  try {
    const base = getUserApiBase();
    if (!base || !base.startsWith("http")) {
      throw cleanError({ message: "DYNO_PAY_USER_API_URL or DYNO_PAY_BASE_URL must be set for customer registration." });
    }
    const createUserPath = getCreateUserPath();
    const url = `${base}${createUserPath}`;
    console.log("[Dynopay registerUserForPayment] URL:", url);
    const payload = {
      email,
      name: fullName || email,
      phone_number: phoneNumber || "",
    };

    const response = await axios.post(url, payload, { headers: buildHeaders() });
    return response;
  } catch (error) {
    console.error("❌ Dynopay registerUserForPayment error:", error?.response?.data || error);
    // throw error.response || error;
    throw cleanError(error);

  }
};


const generatePaymentLink = async (amount, redirect_url, meta_data, user, description, webhook_url) => {
  try {
    const res = await createPaymentLink({
      amount,
      customer_name: user?.name || user?.email || "Customer",
      customer_email: user?.email || "",
      description: description || "Payment",
      redirect_url,
      webhook_url,
      meta_data: meta_data && typeof meta_data === "object" ? meta_data : undefined,
    });
    return { data: res };
  } catch (error) {
    console.error("❌ Dynopay generatePaymentLink error:", error?.response?.data || error);
    throw cleanError(error);
  }                                                                                           
};

const ensureDynoWallet = async (user) => {
  try {
    const response = await registerUserForPayment(user.email, user.name, user.mobile);

    console.log("✅ Dynopay ensureDynoWallet response:", response?.data || response);

    // If registration succeeds and returns a token
    if (response?.data?.data?.token) {
      user.walletToken = response.data.data.token;
      user.walletId = response.data.data.customer_id;
      await user.save();
      return user;
    }

    return user;
  } catch (err) {
    // ✅ Handle "Account Already Exists!!!" gracefully
    const msg = err?.message || err?.data?.message || "";
    if (msg.includes("Account Already Exists")) {
      console.log("⚠️ Dynopay: Account already exists, skipping registration.");
      return user; // don't throw
    }

    console.error("❌ Dynopay ensureDynoWallet error:", msg);
    throw {
      message: msg || "Dynopay wallet setup failed",
      statusCode: err?.statusCode || 500,
    };
  }
};


module.exports = {
  registerUserForPayment,
  generatePaymentLink,
  ensureDynoWallet,
};

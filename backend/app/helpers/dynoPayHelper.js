const { default: axios } = require("axios");
const User = require("../models/User");

// Dynopay REST API (new): every merchant endpoint authenticates with a single
// `x-api-key` header — no JWT Bearer and no company_id. Docs:
// https://dynopay.com/documentation  (base: https://dynopay.com/api/user)
const { DYNO_PAY_BASE_URL, DYNO_PAY_API_KEY } = process.env;

// Normalise the merchant API base. DYNO_PAY_BASE_URL should be
// `https://dynopay.com/api`; we append `/user/<path>` to it.
const getApiBase = () => {
  let base = (DYNO_PAY_BASE_URL || "https://dynopay.com/api").trim().replace(/\/+$/, "");
  if (base.endsWith("/user")) base = base.slice(0, -5); // tolerate a base that already ends with /user
  return base;
};
const merchantUrl = (path) => {
  const p = String(path).startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}/user${p}`;
};

const authHeaders = () => {
  if (!DYNO_PAY_API_KEY) {
    const err = { status: 500, message: "DYNO_PAY_API_KEY is not configured." };
    throw err;
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": DYNO_PAY_API_KEY,
  };
};

// Build the request body shared by createPayment + embed/session.
const buildPaymentBody = (opts = {}) => {
  const { amount, customer_name, customer_email, description, redirect_url, redirect_uri, webhook_url, meta_data, currency } = opts;
  const body = {
    amount: Number(amount),
    redirect_uri: redirect_url || redirect_uri,
  };
  if (customer_name) body.customer_name = customer_name;
  if (customer_email) body.customer_email = customer_email;
  if (description) body.description = description;
  if (webhook_url) body.webhook_url = webhook_url;
  if (currency) body.currency = currency;
  if (meta_data && typeof meta_data === "object" && Object.keys(meta_data).length > 0) body.meta_data = meta_data;
  return body;
};

// Hosted Checkout — POST /user/createPayment -> { success, message, data: { redirect_url, ... } }
const createPaymentLink = async (opts) => {
  const url = merchantUrl("/createPayment");
  try {
    const response = await axios.post(url, buildPaymentBody(opts), { headers: authHeaders() });
    return response.data;
  } catch (err) {
    console.error("[Dynopay createPayment] failed:", err?.response?.status, JSON.stringify(err?.response?.data)?.slice(0, 300));
    throw err;
  }
};

// Embedded Checkout — POST /user/embed/session
// -> { success, message, data: { client_secret, checkout_url, expires_at, ui_mode, payment_methods } }
const createEmbeddedSession = async (opts) => {
  const url = merchantUrl("/embed/session");
  try {
    const response = await axios.post(url, buildPaymentBody(opts), { headers: authHeaders() });
    return response.data;
  } catch (err) {
    console.error("[Dynopay embed/session] failed:", err?.response?.status, JSON.stringify(err?.response?.data)?.slice(0, 300));
    throw err;
  }
};

// Create a Dynopay customer — POST /user/createUser -> { data: { token, customer_id } }
const registerUserForPayment = async (email, name, mobile) => {
  const payload = { email, name };
  if (mobile) payload.mobile = mobile;
  const url = merchantUrl("/createUser");
  const response = await axios.post(url, payload, { headers: authHeaders() });
  return response.data;
};

const generatePaymentLink = async (args = {}) => {
  const res = await createPaymentLink(args);
  return res;
};

/**
 * Wallet top-up now uses EMBEDDED checkout (mounted in an iframe by the SPA).
 * @param {number} amount
 * @param {string} redirect_url - where Dynopay sends the browser after payment
 * @param {string} webhook_url  - backend URL Dynopay POSTs on status changes
 * @returns {{ data: object }} the raw embed/session response ({ success, message, data:{...} })
 */
const generateAddFundsLink = async (amount, redirect_url, webhook_url, meta_data, customer_name, customer_email, description) => {
  const res = await createEmbeddedSession({
    amount,
    customer_name: customer_name || "Customer",
    customer_email: customer_email || "",
    description: description || `$${amount} Wallet Top-up`,
    redirect_url,
    webhook_url,
    meta_data: meta_data && typeof meta_data === "object" ? meta_data : undefined,
  });
  return { data: res };
};

// Merchant wallet balance — GET /user/getBalance
const fetchDynoWalletBalance = async () => {
  const url = merchantUrl("/getBalance");
  return axios.get(url, { headers: authHeaders() });
};

// Look up a single transaction — GET /user/getSingleTransaction/:id
// (walletToken kept for signature compatibility; new API uses x-api-key)
const fetchUserTransactionById = async (walletToken, transactionId) => {
  const url = merchantUrl(`/getSingleTransaction/${transactionId}`);
  try {
    return await axios.get(url, { headers: authHeaders() });
  } catch (error) {
    throw error.response || error;
  }
};

// Recommended verification — GET /user/getPaymentStatus/:payment_id
const getPaymentStatus = async (paymentId) => {
  const url = merchantUrl(`/getPaymentStatus/${paymentId}`);
  const response = await axios.get(url, { headers: authHeaders() });
  return response.data;
};

// Direct crypto charge — POST /user/cryptoPayment (x-api-key + per-user Bearer walletToken)
// -> { success, message, data: { transaction_id, address, amount, currency, base_amount, base_currency, qr_code, redirect_uri } }
const createCryptoPayment = async ({ amount, currency, redirect_uri, meta_data, walletToken, customer_email, customer_name }) => {
  const url = merchantUrl("/cryptoPayment");
  const headers = { ...authHeaders() };
  if (walletToken) headers.Authorization = `Bearer ${walletToken}`;
  const body = { amount: Number(amount), currency };
  if (redirect_uri) body.redirect_uri = redirect_uri;
  // Always forward the buyer's email so Dynopay can send receipts / tie the payment to them.
  if (customer_email) body.customer_email = customer_email;
  if (customer_name) body.customer_name = customer_name;
  if (meta_data && typeof meta_data === "object" && Object.keys(meta_data).length > 0) body.meta_data = meta_data;
  try {
    const response = await axios.post(url, body, { headers });
    return response.data;
  } catch (err) {
    console.error("[Dynopay cryptoPayment] failed:", err?.response?.status, JSON.stringify(err?.response?.data)?.slice(0, 300));
    throw err;
  }
};

// Supported crypto currencies — GET /user/getSupportedCurrency (x-api-key only)
const getSupportedCurrencies = async () => {
  const url = merchantUrl("/getSupportedCurrency");
  const response = await axios.get(url, { headers: authHeaders() });
  return response.data;
};

// Coins hosta.sh accepts come from Dynopay's live "configured currencies" list
// (getSupportedCurrency -> data.currencies). The env var CRYPTO_TOPUP_COINS is an
// OPTIONAL allow-list to narrow that further; when unset (default) we offer every
// coin the merchant has configured.
const getConfiguredCoins = () => {
  const raw = (process.env.CRYPTO_TOPUP_COINS || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
};

// Ensure the user has a Dynopay customer/wallet token (optional for userless checkout).
const ensureWallet = async (userID) => {
  const user = await User.findById({ _id: userID });
  if (!user) {
    const err = { status: 400, message: "user not found." };
    throw err;
  }
  if (!user.walletToken) {
    const result = await registerUserForPayment(user.email, user.name, user.mobile);
    if (result?.data?.token) {
      user.walletToken = result.data.token;
      user.walletId = result.data.customer_id;
      await user.save();
    } else {
      const err = { status: 400, message: "Failed register user for dyno pay." };
      throw err;
    }
  }
  return user.walletToken;
};

module.exports = {
  registerUserForPayment,
  createPaymentLink,
  createEmbeddedSession,
  createCryptoPayment,
  getSupportedCurrencies,
  getConfiguredCoins,
  generatePaymentLink,
  generateAddFundsLink,
  fetchDynoWalletBalance,
  fetchUserTransactionById,
  getPaymentStatus,
  ensureWallet,
};

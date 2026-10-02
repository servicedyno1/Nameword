const axios = require("axios");

// Nomadly Reseller API — unified provider for domains / dns / vps / rdp / hosting.
// Docs: https://2.speechcue.com/apidoc  (base: /reseller/v1)
// The service runs in dry_run or live mode server-side (see GET /health `mode`).
const BASE_URL =
  process.env.NOMADLY_API_BASE_URL || "https://2.speechcue.com/reseller/v1";
const API_KEY = process.env.NOMADLY_API_KEY || "";

const nomadly = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

// Attach the reseller key on every request (both accepted header forms).
nomadly.interceptors.request.use((config) => {
  if (API_KEY) {
    config.headers["Authorization"] = `Bearer ${API_KEY}`;
    config.headers["X-API-Key"] = API_KEY;
  }
  return config;
});

module.exports = { nomadly, BASE_URL };

// Idempotent seed for File Manager end-to-end testing.
// Creates a test user and an Order that makes them the owner of the REAL cPanel
// account "nbayftest" (testingbays.sbs) so ownership-gated file-manager endpoints
// resolve to the live provider.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../app/models/User");
const Order = require("../app/models/Order");

const EMAIL = "filemanager.tester@hosta.local";
const PASSWORD = "FileMgr!Test123";
const PROVIDER_USERNAME = "nbayftest";
const DOMAIN = "testingbays.sbs";
const CLIENT_ORDER_ID = "seed-filemanager-nbayftest";

(async () => {
  await mongoose.connect(process.env.DB_URI);
  try {
    // 1) Upsert the test user (pre-save hook hashes the password).
    let user = await User.findOne({ email: EMAIL });
    if (!user) {
      user = new User({
        name: "File Manager Tester",
        email: EMAIL,
        password: PASSWORD,
        notifyEmail: false,
        enabled2FA: false,
        banned: false,
        deactivated: false,
      });
      await user.save();
      console.log("Created user:", EMAIL, String(user._id));
    } else {
      user.password = PASSWORD; // re-hashes via pre-save
      user.notifyEmail = false;
      user.enabled2FA = false;
      user.banned = false;
      user.deactivated = false;
      if (user.deletedAt) user.deletedAt = undefined;
      await user.save();
      console.log("Updated existing user:", EMAIL, String(user._id));
    }

    // 2) Upsert the owning hosting order (idempotent by clientOrderId).
    await Order.deleteOne({ userId: user._id, clientOrderId: CLIENT_ORDER_ID });
    const now = new Date();
    const expires = new Date(now.getTime() + 25 * 86400000);
    const order = new Order({
      userId: user._id,
      clientOrderId: CLIENT_ORDER_ID,
      mode: "live",
      status: "paid",
      provisioning: "complete",
      payment_method: "wallet",
      payment_status: "paid",
      subtotal_usd: 100,
      charged_usd: 100,
      items: [
        {
          type: "hosting",
          domain: DOMAIN,
          plan_id: "golden-monthly",
          plan_name: "Golden Anti-Red HostPanel (1-Month)",
          duration_days: 30,
          price_usd: 100,
          status: "active",
          provider_username: PROVIDER_USERNAME,
          panel_url: "https://panel.1.hostbay.io",
          server_ip: "68.183.77.106",
          expires_at: expires,
          term_days: 30,
        },
        {
          type: "domain",
          domain: "namewords.sbs",
          ns_choice: "custom",
          nameservers: ["ns1.dnsimple.com", "ns2.dnsimple.com"],
          price_usd: 39,
          status: "active",
          expires_at: expires,
          term_days: 365,
        },
      ],
    });
    await order.save();
    console.log("Created owning order:", order.orderNumber, "-> hosting", PROVIDER_USERNAME);

    console.log("\nSEED OK");
    console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, provider_username: PROVIDER_USERNAME, domain: DOMAIN }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error("SEED FAILED:", e.message);
    process.exit(1);
  }
})();

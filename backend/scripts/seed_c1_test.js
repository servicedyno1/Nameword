// C1 ownership-scoping test seed (idempotent).
// Creates TWO buyers, each with a wallet and ONE order that owns a domain, a
// VPS and a hosting account (recorded in the current dry_run/test_mode state,
// i.e. no live provider_id — the app's real deployment mode today).
//
// Usage: cd /app/backend && node scripts/seed_c1_test.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../app/models/User");
const Wallet = require("../app/models/Wallet");
const Order = require("../app/models/Order");

const USERS = [
  { key: "a", name: "C1 Owner A", email: "c1-owner-a@hosta.local", password: "Owner@12345", domain: "c1-owner-a.com" },
  { key: "b", name: "C1 Owner B", email: "c1-owner-b@hosta.local", password: "Owner@12345", domain: "c1-owner-b.com" },
];

function orderItems(u) {
  return [
    {
      type: "domain",
      domain: u.domain,
      registrar: "OpenProvider",
      ns_choice: "cloudflare",
      price_usd: 39,
      status: "test_mode",
      message: "Test mode — validated & priced, nothing provisioned.",
    },
    {
      type: "vps",
      plan_id: "s-1vcpu-1gb",
      plan_name: "Cloud VPS 10",
      region: "EU",
      os: "ubuntu",
      hostname: `${u.key}-web-01`,
      vcpus: 1,
      ram_gb: 1,
      disk_gb: 25,
      price_usd: 18,
      status: "test_mode",
      message: "Test mode — validated & priced, nothing provisioned.",
    },
    {
      type: "hosting",
      domain: u.domain,
      plan_id: "premium-weekly",
      plan_name: "Premium Anti-Red (1-Week)",
      duration_days: 7,
      price_usd: 30,
      status: "test_mode",
      message: "Test mode — validated & priced, nothing provisioned.",
    },
  ];
}

(async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    for (const u of USERS) {
      let user = await User.findOne({ email: u.email });
      if (!user) user = new User({ name: u.name, email: u.email });
      user.password = u.password;
      user.isProfileVerified = true;
      user.notifyEmail = false;
      user.enabled2FA = false;
      user.banned = false;
      user.deactivated = false;
      user.locked = false;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();

      // Wallet at $50 (lets the account also run live-checkout tests later).
      let wallet = await Wallet.findOne({ userId: user._id });
      if (!wallet) wallet = new Wallet({ userId: user._id });
      wallet.balance.set("USD", 50);
      wallet.lastTransactionAt = new Date();
      await wallet.save();

      // Idempotent: clear this test user's previous orders, then create one.
      await Order.deleteMany({ userId: user._id });
      const items = orderItems(u);
      const subtotal = items.reduce((s, i) => s + i.price_usd, 0);
      const order = await Order.create({
        userId: user._id,
        clientOrderId: `seed-c1-${u.key}`,
        mode: "dry_run",
        status: "paid",
        items,
        subtotal_usd: subtotal,
        charged_usd: subtotal,
        wallet_balance_after_usd: 50,
      });
      console.log(`Seeded ${u.email}: order ${order.orderNumber} (domain ${u.domain}, 1 vps, 1 hosting)`);
    }
    console.log("C1 seed complete.");
    process.exit(0);
  } catch (e) {
    console.error("C1 SEED ERROR:", e.message);
    process.exit(1);
  }
})();

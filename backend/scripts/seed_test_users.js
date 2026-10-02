// Idempotent seed: demo + test-buyer accounts with a funded in-app wallet.
// Usage: cd /app/backend && node scripts/seed_test_users.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../app/models/User");
const Wallet = require("../app/models/Wallet");
const Transaction = require("../app/models/Transaction");

const ACCOUNTS = [
  { name: "Demo User", email: "demo@hosta.local", password: "Demo@12345", walletUsd: null },
  { name: "Test Buyer", email: "buyer@hosta.local", password: "Buyer@12345", walletUsd: 50 },
];

(async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    for (const a of ACCOUNTS) {
      let user = await User.findOne({ email: a.email });
      if (!user) user = new User({ name: a.name, email: a.email });
      user.password = a.password;
      user.isProfileVerified = true;
      user.notifyEmail = false;
      user.enabled2FA = false;
      user.banned = false;
      user.deactivated = false;
      user.locked = false;
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await user.save();

      if (a.walletUsd != null) {
        let wallet = await Wallet.findOne({ userId: user._id });
        if (!wallet) wallet = new Wallet({ userId: user._id });
        const before = Number(wallet.balance.get("USD") || 0);
        wallet.balance.set("USD", a.walletUsd);
        wallet.lastTransactionAt = new Date();
        await wallet.save();
        if (before !== a.walletUsd) {
          await Transaction.create({
            userId: user._id,
            walletId: wallet._id,
            amount: Math.abs(a.walletUsd - before),
            currency: "USD",
            type: a.walletUsd > before ? "credit" : "debit",
            method: "seed",
            reference: `seed:test-wallet:${Date.now()}`,
            status: "completed",
            from: "nameword",
          });
        }
        console.log(`Seeded ${a.email} (wallet $${a.walletUsd} USD)`);
      } else {
        console.log(`Seeded ${a.email}`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error("SEED ERROR:", e.message);
    process.exit(1);
  }
})();

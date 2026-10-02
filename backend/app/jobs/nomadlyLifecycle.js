// C2 — Renewal lifecycle for Nomadly-provisioned resources.
//
// Two schedules, both reading the buyer's own Order items (the per-buyer source
// of truth C1/C3 already maintain):
//   • Reminder sweep (daily 09:00): email the buyer at T-7 / T-3 / T-1 days.
//   • Auto-renew sweep (hourly): for items with auto_renew=true that are due
//     (<= 1 day left or already expired), charge the buyer's wallet and renew
//     where the provider supports it (CheckoutController.performRenewal).
//
// Email delivery uses the Brevo transactional API (real key). NOTE: outbound
// email only actually delivers once a verified Brevo sender is configured
// (MAIL_FROM/BREVO_EMAIL). Until then sends fail gracefully and are logged.

const schedule = require("node-schedule");
const Order = require("../models/Order");
const User = require("../models/User");
const transporter = require("../services/mailer");
const CheckoutController = require("../controllers/checkout/CheckoutController");

const DAY = 86400000;
const REMINDER_THRESHOLDS = [7, 3, 1];

const titleOf = (it) => {
  if (it.type === "domain") return it.domain;
  if (it.type === "hosting") return `${it.plan_name || "Hosting"} — ${it.domain || ""}`.trim();
  return `${it.plan_name || it.type.toUpperCase()} (${it.region || "EU"})`;
};

async function sendReminder(user, it, days) {
  if (!user?.email) return;
  const label = titleOf(it);
  const when = days <= 0 ? "has expired" : `expires in ${days} day${days === 1 ? "" : "s"}`;
  const subject = `Your ${it.type} ${label} ${when}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="color:#087C9C;margin:0 0 8px">Renewal reminder</h2>
      <p>Your <strong>${it.type}</strong> <strong>${label}</strong> ${when}.</p>
      <p>Expiry date: <strong>${it.expires_at ? new Date(it.expires_at).toDateString() : "n/a"}</strong></p>
      <p>${it.auto_renew ? "Auto-renew is ON — we'll renew it automatically from your wallet." : "Sign in and renew it before it lapses to avoid any interruption."}</p>
    </div>`;
  await transporter.sendMail({ to: user.email, subject, html });
}

async function reminderSweep() {
  try {
    const now = Date.now();
    const horizon = new Date(now + 7 * DAY + DAY); // a little slack past 7 days
    const orders = await Order.find({
      "items.expires_at": { $lte: horizon },
    })
      .select("userId items")
      .limit(500)
      .lean();

    for (const order of orders) {
      let user = null;
      for (const it of order.items || []) {
        if (!it.expires_at) continue;
        if (!["active", "test_mode"].includes(it.status)) continue;
        const days = Math.ceil((new Date(it.expires_at).getTime() - now) / DAY);
        if (!REMINDER_THRESHOLDS.includes(days)) continue;
        if (!user) user = await User.findById(order.userId).select("email").lean();
        try {
          await sendReminder(user, it, days);
          console.log(`[nomadlyLifecycle] reminder sent: ${it.type} ${titleOf(it)} (T-${days})`);
        } catch (e) {
          console.error(`[nomadlyLifecycle] reminder email failed (${it.type} ${titleOf(it)}):`, e?.message || e);
        }
      }
    }
  } catch (e) {
    console.error("[nomadlyLifecycle] reminderSweep failed:", e?.message || e);
  }
}

async function autoRenewSweep() {
  try {
    const dueBefore = new Date(Date.now() + DAY); // due within 24h or already expired
    const orders = await Order.find({
      "items.auto_renew": true,
      "items.expires_at": { $lte: dueBefore },
    }).limit(200);

    for (const order of orders) {
      for (let idx = 0; idx < order.items.length; idx++) {
        const it = order.items[idx];
        if (!it.auto_renew || !it.expires_at) continue;
        if (!["active", "test_mode"].includes(it.status)) continue;
        if (new Date(it.expires_at).getTime() > dueBefore.getTime()) continue;
        try {
          const r = await CheckoutController.performRenewal(order, idx);
          if (r.ok) {
            console.log(`[nomadlyLifecycle] auto-renewed ${it.type} ${titleOf(it)} -> ${r.expires_at}`);
          } else {
            console.warn(`[nomadlyLifecycle] auto-renew skipped ${it.type} ${titleOf(it)}: ${r.code}`);
          }
        } catch (e) {
          console.error(`[nomadlyLifecycle] auto-renew error ${it.type} ${titleOf(it)}:`, e?.message || e);
        }
      }
    }
  } catch (e) {
    console.error("[nomadlyLifecycle] autoRenewSweep failed:", e?.message || e);
  }
}

schedule.scheduleJob("0 9 * * *", reminderSweep); // daily 09:00
schedule.scheduleJob("0 * * * *", autoRenewSweep); // hourly
console.log("Nomadly lifecycle jobs (C2) scheduled: reminders daily 09:00, auto-renew hourly.");

module.exports = { reminderSweep, autoRenewSweep };

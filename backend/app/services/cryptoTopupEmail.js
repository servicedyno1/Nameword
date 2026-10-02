// Gentle "finish your crypto top-up" reminder. Best-effort, non-blocking.
const mailer = require("./mailer");

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function buildHtml({ name, record }) {
  const resumeUrl = `${(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/dashboard`;
  const amt = money(record.amountUsd);
  const crypto = record.cryptoAmount ? `${record.cryptoAmount} ${esc(record.currency)}` : esc(record.currency);
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#12101F;padding:22px 28px"><div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;font-family:'Geist Mono',SFMono-Regular,Menlo,Consolas,monospace">hosta<span style="color:#22E6FF">.sh</span></div></div>
      <div style="padding:28px">
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a">Your ${amt} top-up is waiting${name ? `, ${esc(name)}` : ""}</h1>
        <p style="margin:0 0 16px;color:#475569;font-size:14px">We generated a crypto payment address for you but haven’t seen the payment yet. Finish sending <strong>${esc(crypto)}</strong> to top up your wallet.</p>
        <div style="margin:0 0 16px;padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">Send exactly</p>
          <p style="margin:0 0 10px;color:#0f172a;font-size:15px;font-weight:600">${esc(crypto)}</p>
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">To this address</p>
          <p style="margin:0;color:#0f172a;font-size:13px;font-family:monospace;word-break:break-all">${esc(record.address)}</p>
        </div>
        <a href="${esc(resumeUrl)}" style="display:inline-block;background:#087C9C;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">Resume payment</a>
        <p style="margin:18px 0 0;color:#94a3b8;font-size:12px">This payment address expires soon — if it lapses, just start a new top-up. If you didn’t request this, you can safely ignore this email.</p>
      </div>
    </div>
  </body></html>`;
}

async function sendCryptoTopupReminder({ to, name, record }) {
  if (!to || !record) return;
  await mailer.sendMail({
    to,
    subject: `Finish your ${money(record.amountUsd)} crypto top-up`,
    html: buildHtml({ name, record }),
  });
}

module.exports = { sendCryptoTopupReminder, buildHtml };

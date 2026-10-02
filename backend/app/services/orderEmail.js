// Order confirmation email (C4). Best-effort, non-blocking — a mail failure must
// never affect the order/money-path. Sent by the C3 provisioning worker once an
// order finishes provisioning, so the receipt reflects final per-item statuses.
const mailer = require("./mailer");

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function itemLabel(item) {
  const plan = item.plan_name || item.plan_id || "";
  if (item.type === "domain") return `Domain registration — ${item.domain}`;
  if (item.type === "hosting")
    return `cPanel hosting — ${plan}${item.domain ? ` (${item.domain})` : ""}`;
  if (item.type === "vps") return `VPS — ${plan}${item.region ? ` · ${item.region}` : ""}`;
  if (item.type === "rdp") return `RDP — ${plan}${item.region ? ` · ${item.region}` : ""}`;
  return item.type;
}

function statusLabel(status) {
  switch (status) {
    case "active":
      return { text: "Active", color: "#16a34a" };
    case "test_mode":
      return { text: "Test mode", color: "#d97706" };
    case "pending":
      return { text: "Provisioning", color: "#087C9C" };
    case "failed":
      return { text: "Failed — refunded", color: "#dc2626" };
    default:
      return { text: status || "—", color: "#6b7280" };
  }
}

function buildHtml({ order, name }) {
  const rows = (order.items || [])
    .map((it) => {
      const s = statusLabel(it.status);
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px">${esc(itemLabel(it))}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eef2f7;text-align:center"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${s.color}1a;color:${s.color};font-size:12px;font-weight:600">${esc(s.text)}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #eef2f7;text-align:right;color:#0f172a;font-size:14px">${money(it.price_usd)}</td>
      </tr>`;
    })
    .join("");

  const testBanner =
    order.mode === "dry_run"
      ? `<div style="margin:0 0 18px;padding:12px 16px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:13px">
           <strong>Test mode.</strong> Your wallet was charged and this order was recorded, but nothing was provisioned upstream yet. Services will go live once the store is switched to live mode.
         </div>`
      : "";

  const pointsLine =
    Number(order.points_discount_usd) > 0
      ? `<tr><td style="padding:4px 0;color:#16a34a;font-size:14px">Reward points applied</td><td></td><td style="padding:4px 0;text-align:right;color:#16a34a;font-size:14px">- ${money(order.points_discount_usd)}</td></tr>`
      : "";
  const earnedLine =
    Number(order.points_earned) > 0
      ? `<p style="margin:6px 0 0;color:#16a34a;font-size:13px">You earned ${Math.round(order.points_earned)} reward points on this order.</p>`
      : "";

  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:#12101F;padding:22px 28px">
        <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;font-family:'Geist Mono',SFMono-Regular,Menlo,Consolas,monospace">hosta<span style="color:#22E6FF">.sh</span></div>
      </div>
      <div style="padding:28px">
        <h1 style="margin:0 0 6px;font-size:20px;color:#0f172a">Thanks${name ? `, ${esc(name)}` : ""} — we’ve got your order</h1>
        <p style="margin:0 0 18px;color:#475569;font-size:14px">Order <strong>${esc(order.orderNumber || String(order._id))}</strong> · ${new Date(order.createdAt || Date.now()).toUTCString()}</p>
        ${testBanner}
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;padding:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Item</th>
            <th style="text-align:center;padding:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Status</th>
            <th style="text-align:right;padding:0 0 8px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Price</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-top:14px">
          <tr><td style="padding:4px 0;color:#475569;font-size:14px">Subtotal</td><td></td><td style="padding:4px 0;text-align:right;color:#0f172a;font-size:14px">${money(order.subtotal_usd)}</td></tr>
          ${pointsLine}
          <tr><td style="padding:8px 0 0;color:#0f172a;font-size:15px;font-weight:700">Charged to wallet</td><td></td><td style="padding:8px 0 0;text-align:right;color:#0f172a;font-size:15px;font-weight:700">${money(order.charged_usd)}</td></tr>
        </table>
        ${earnedLine}
        <div style="margin-top:24px">
          <a href="${esc(process.env.FRONTEND_URL || "")}/orders" style="display:inline-block;background:#087C9C;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600">View your orders</a>
        </div>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">You’re receiving this because a purchase was made with your hosta.sh account. If this wasn’t you, please contact support.</p>
      </div>
    </div>
  </body></html>`;
}

async function sendOrderConfirmation({ to, order, name }) {
  if (!to || !order) return;
  let attachments;
  try {
    const { generateOrderReceiptPDF } = require("../utils/orderReceiptPdf");
    const pdf = await generateOrderReceiptPDF(order, { name, email: to });
    if (pdf) attachments = [{ filename: `hosta.sh-${order.orderNumber || order._id}.pdf`, content: pdf.toString("base64") }];
  } catch (e) {
    console.error("[orderEmail] PDF generation failed (sending without attachment):", e?.message || e);
  }
  try {
    await mailer.sendMail({
      to,
      subject: `Your hosta.sh order ${order.orderNumber || ""}`.trim(),
      html: buildHtml({ order, name }),
      attachments,
    });
  } catch (e) {
    // Outbound email only delivers once a verified Brevo sender is configured.
    console.error("[orderEmail] send failed (non-blocking):", e?.message || e);
  }
}

module.exports = { sendOrderConfirmation, buildHtml };

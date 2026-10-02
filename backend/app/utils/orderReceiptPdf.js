// Order receipt / invoice PDF (attached to the order-confirmation email).
// Built straight from the Order document so it works for wallet AND crypto-funded
// orders. Best-effort: a generation failure must never block the email/order path.
const jsPDF = require("jspdf");

const SELLER = {
  name: "Dynotech Innovations, LDA",
  address: ["Rua Luís de Camões 1017, 7° Dt°", "Montijo 2870-154", "Portugal"],
  nif: "PT518713130",
  email: process.env.SUPPORT_EMAIL || process.env.MAIL_FROM_ADDRESS,
};

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

function itemDesc(it) {
  const plan = it.plan_name || it.plan_id || "";
  if (it.type === "domain") return `Domain registration — ${it.domain}`;
  if (it.type === "hosting") return `cPanel hosting — ${plan}${it.domain ? ` (${it.domain})` : ""}`;
  if (it.type === "vps") return `VPS — ${plan}${it.region ? ` · ${it.region}` : ""}`;
  if (it.type === "rdp") return `RDP — ${plan}${it.region ? ` · ${it.region}` : ""}`;
  return it.type;
}

function itemStatus(s) {
  if (s === "active") return "Active";
  if (s === "test_mode") return "Test mode";
  if (s === "failed") return "Failed · refunded";
  return "Pending";
}

async function generateOrderReceiptPDF(order, buyer = {}) {
  const doc = new jsPDF.jsPDF();
  const ink = [15, 23, 42];
  const light = [128, 128, 128];
  const brand = [8, 124, 156];
  const green = [22, 163, 74];

  doc.setTextColor(...ink);

  // Seller (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(SELLER.name, 20, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let y = 28;
  SELLER.address.forEach((l) => { doc.text(l, 20, y); y += 5; });
  doc.text(`VAT ID: ${SELLER.nif}`, 20, y + 2); y += 7;
  doc.text(SELLER.email, 20, y);

  // Title (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...brand);
  doc.text("INVOICE", 190, 22, { align: "right" });
  doc.setTextColor(...ink);

  const created = new Date(order.createdAt || Date.now());
  const dateText = created.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let ry = 32; const rx = 190; const lx = 130;
  const kv = (label, val) => {
    doc.setFont("helvetica", "bold"); doc.text(label, lx, ry);
    doc.setFont("helvetica", "normal"); doc.text(String(val), rx, ry, { align: "right" });
    ry += 6;
  };
  kv("Order #", order.orderNumber || String(order._id));
  kv("Date", dateText);
  kv("Total", `${money(order.charged_usd)} (USD)`);

  const statusText = order.status === "failed" ? "REFUNDED" : order.status === "partial" ? "PARTIAL" : "PAID";
  doc.setTextColor(...(order.status === "failed" ? light : green));
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(statusText, rx, ry + 2, { align: "right" });
  doc.setTextColor(...ink);

  let cursor = Math.max(y + 12, 62);
  if (order.mode === "dry_run") {
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...light);
    doc.text("Test mode: your wallet was charged and this order recorded; provisioning happens once live.", 20, cursor);
    doc.setTextColor(...ink); doc.setFont("helvetica", "normal");
    cursor += 8;
  }

  // Billed to
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("BILLED TO", 20, cursor); cursor += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(buyer.name || buyer.email || "Customer", 20, cursor); cursor += 5;
  if (buyer.email) { doc.text(buyer.email, 20, cursor); cursor += 5; }

  // Divider
  cursor += 6;
  doc.setDrawColor(...light);
  doc.line(20, cursor, 190, cursor);
  cursor += 10;

  // Items table header
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("DESCRIPTION", 20, cursor);
  doc.text("STATUS", 138, cursor);
  doc.text("PRICE", 190, cursor, { align: "right" });
  doc.setDrawColor(210, 210, 210);
  doc.line(20, cursor + 2, 190, cursor + 2);
  cursor += 9;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  (order.items || []).forEach((it) => {
    const desc = doc.splitTextToSize(itemDesc(it), 112);
    doc.text(desc, 20, cursor);
    doc.text(itemStatus(it.status), 138, cursor);
    doc.text(money(it.price_usd), 190, cursor, { align: "right" });
    cursor += Math.max(desc.length * 5, 6) + 2;
  });

  // Summary
  cursor += 6;
  const sr = 190; const sl = 140;
  const line = (label, val, bold = false, color = ink) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(bold ? 10 : 9);
    doc.setTextColor(...color);
    doc.text(label, sl, cursor); doc.text(val, sr, cursor, { align: "right" });
    doc.setTextColor(...ink);
    cursor += 7;
  };
  line("Subtotal:", money(order.subtotal_usd));
  if (Number(order.points_discount_usd) > 0) line("Reward points:", `- ${money(order.points_discount_usd)}`, false, green);
  line("Charged to wallet:", money(order.charged_usd), true);
  if (Number(order.refunded_usd) > 0) line("Refunded:", money(order.refunded_usd));

  // Footer
  const footerY = 280;
  doc.setDrawColor(...light);
  doc.line(20, footerY, 190, footerY);
  doc.setFontSize(8); doc.setTextColor(...light);
  doc.text("Thank you for your business!", 105, footerY + 5, { align: "center" });
  doc.text(`For any inquiries, please contact ${SELLER.email}`, 105, footerY + 10, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

module.exports = { generateOrderReceiptPDF };

const jsPDF = require("jspdf");
const Payment = require("../models/Payment");
const User = require("../models/User");


const SELLER = {
	name: "Dynotech Innovations, LDA",
	address: ["Rua Luís de Camões 1017, 7° Dt°", "Montijo 2870-154", "Portugal"],
	nif: "PT518713130",
	email: process.env.SUPPORT_EMAIL || process.env.MAIL_FROM_ADDRESS,
};

const generateInvoicePDF = async (paymentOrId, userId, paymentInvoice = null) => {
	try {
		let payment;

		if (typeof paymentOrId === "object" && paymentOrId._id) {
			payment = paymentOrId;
		} else {
			const paymentId = paymentOrId;
			payment = await Payment.findOne({
				userId,
				$or: [
					{ paymentId: paymentId.startsWith("N_") ? paymentId : `N_${paymentId}` },
					{ invoiceId: paymentId },
				],
			}).lean();

			if (!payment) {
				throw new Error("Payment not found");
			}
		}

		const user = await User.findById(userId).lean();
		if (!user) {
			throw new Error("User not found");
		}

		const doc = new jsPDF.jsPDF();
		const textColor = [33, 33, 33];
		const lightGray = [128, 128, 128];
		const greenPaid = [34, 197, 94];

		doc.setTextColor(...textColor);

		// --- Left: Seller info (Dynotech Innovations, LDA) ---
		const seller = paymentInvoice?.seller || SELLER;
		const sellerName = seller?.name || SELLER.name;
		const sellerAddress = seller?.address
			? (Array.isArray(seller.address) ? seller.address : [seller.address.street, `${seller.address.city} ${seller.address.postalCode}`.trim(), seller.address.country].filter(Boolean))
			: SELLER.address;
		const sellerNif = seller?.nif || SELLER.nif;

		doc.setFont("helvetica", "bold");
		doc.setFontSize(14);
		doc.text(sellerName, 20, 20);

		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		let y = 28;
		sellerAddress.forEach((line) => {
			doc.text(line, 20, y);
			y += 5;
		});
		y += 2;
		doc.text(`VAT ID: ${sellerNif}`, 20, y);
		y += 5;
		if (seller?.email || SELLER.email) {
			doc.text((seller?.email || SELLER.email), 20, y);
			y += 5;
		}

		// --- Right: Invoice title and key details ---
		doc.setFont("helvetica", "bold");
		doc.setFontSize(22);
		doc.text("INVOICE", 190, 22, { align: "right" });

		const paidDate = new Date(payment.paidAt || payment.createdAt);
		const dateText = paidDate.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "2-digit",
		});
		const amount = Number(payment.amount) || 0;
		const currency = payment.currency || "USD";
		const amountStr = `$${amount.toFixed(2)} (${currency})`;

		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		let rightY = 32;
		const rightX = 190;
		const labelX = 130;

		doc.setFont("helvetica", "bold");
		doc.text("Invoice #", labelX, rightY);
		doc.setFont("helvetica", "normal");
		doc.text(payment.invoiceId, rightX, rightY, { align: "right" });
		rightY += 6;

		doc.setFont("helvetica", "bold");
		doc.text("Invoice Issued #", labelX, rightY);
		doc.setFont("helvetica", "normal");
		doc.text(dateText, rightX, rightY, { align: "right" });
		rightY += 6;

		doc.setFont("helvetica", "bold");
		doc.text("Invoice Amount #", labelX, rightY);
		doc.setFont("helvetica", "normal");
		doc.text(amountStr, rightX, rightY, { align: "right" });
		rightY += 6;

		doc.setFont("helvetica", "bold");
		doc.text("Order Nr. #", labelX, rightY);
		doc.setFont("helvetica", "normal");
		doc.text(payment.paymentId, rightX, rightY, { align: "right" });
		rightY += 8;

		// Status (PAID in green)
		const statusLabel = payment.status === "completed" ? "PAID" : payment.status.toUpperCase();
		doc.setTextColor(...(payment.status === "completed" ? greenPaid : textColor));
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.text(statusLabel, rightX, rightY, { align: "right" });
		doc.setTextColor(...textColor);

		// --- BILLED TO (use PaymentInvoice buyer if available) ---
		const billToY = Math.max(y + 15, 55);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(10);
		doc.text("BILLED TO", 20, billToY);

		let contactName, contactEmail, contactStreet, contactCity, contactState, contactPostalCode, contactCountry;
		if (paymentInvoice?.buyer) {
			contactName = paymentInvoice.buyer.name || user.name || user.email || "Customer";
			contactEmail = paymentInvoice.buyer.email || user.email || "";
			const addr = paymentInvoice.buyer.address;
			contactStreet = addr?.street || "";
			contactCity = addr?.city || "";
			contactState = addr?.state || "";
			contactPostalCode = addr?.postalCode || "";
			contactCountry = addr?.country || "";
		} else {
			const registrantContact = user.domainProviderClient?.hostbay?.contactData?.registrant;
			const isDefaultSanFrancisco =
				registrantContact &&
				registrantContact.city === "San Francisco" &&
				registrantContact.address === "123 Main Street" &&
				registrantContact.state === "CA" &&
				registrantContact.postal_code === "94102";
			const hasUserContact =
				registrantContact &&
				(registrantContact.address || registrantContact.city) &&
				!isDefaultSanFrancisco;

			if (hasUserContact) {
				const firstName = registrantContact.first_name || "";
				const lastName = registrantContact.last_name || "";
				contactName = `${firstName} ${lastName}`.trim() || user.name || user.email || "Customer";
				contactEmail = registrantContact.email || user.email || "";
				contactStreet = registrantContact.address || "";
				contactCity = registrantContact.city || "";
				contactState = registrantContact.state || "";
				contactPostalCode = registrantContact.postal_code || "";
				contactCountry = registrantContact.country || "";
			} else {
				contactName = user.name || user.email || "Customer";
				contactEmail = user.email || "";
				contactStreet = "";
				contactCity = "";
				contactState = "";
				contactPostalCode = "";
				contactCountry = "";
			}
		}

		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		let billY = billToY + 6;
		doc.text(contactName, 20, billY);
		billY += 5;
		if (contactEmail) {
			doc.text(contactEmail, 20, billY);
			billY += 5;
		}
		if (contactStreet) {
			const streetLines = doc.splitTextToSize(contactStreet, 75);
			doc.text(streetLines, 20, billY);
			billY += streetLines.length * 5;
		}
		let cityLine = [contactCity, contactState, contactPostalCode].filter(Boolean).join(", ");
		if (cityLine) {
			doc.text(cityLine, 20, billY);
			billY += 5;
		}
		if (contactCountry) {
			doc.text(contactCountry, 20, billY);
			billY += 5;
		}
		if (paymentInvoice?.buyer?.nif) {
			doc.text(`VAT/NIF: ${paymentInvoice.buyer.nif}`, 20, billY);
			billY += 5;
		}

		// --- Divider ---
		const lineY = billY + 10;
		doc.setDrawColor(...lightGray);
		doc.line(20, lineY, 190, lineY);

		// --- Line items table: DESCRIPTION | PRICE / DISCOUNT | VAT | TOTAL (USD) ---
		const tableStartY = lineY + 12;

		const headers = ["DESCRIPTION", "PRICE / DISCOUNT", "VAT", "TOTAL (USD)"];
		const meta = payment.metadata || {};
		const vatAmountFromInvoice = paymentInvoice?.vat?.amount ?? 0;
		const subtotalFromInvoice = paymentInvoice?.subtotal != null ? Number(paymentInvoice.subtotal) : amount;
		const totalFromInvoice = paymentInvoice?.total != null ? Number(paymentInvoice.total) : amount;

		let rowData;
		if (paymentInvoice?.items?.length > 0) {
			const item = paymentInvoice.items[0];
			const descParts = [item.description];
			if (item.domain) descParts.push(item.domain);
			const periodMonths = meta.period || 12;
			const endDate = new Date(paidDate);
			endDate.setMonth(endDate.getMonth() + periodMonths);
			const periodText = `${dateText} to ${endDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}`;
			descParts.push(periodText);
			const descText = descParts.filter(Boolean).join("\n");
			const vatAmt = item.vatAmount ?? vatAmountFromInvoice ?? 0;
			const lineTotal = Number(paymentInvoice.total ?? item.total ?? amount);
			const priceQty = `$${Number(item.unitPrice ?? item.total).toFixed(2)} x ${item.quantity || 1}`;
			const priceDiscount = `${priceQty}\nDiscount: -`;
			rowData = [
				descText,
				priceDiscount,
				`$${Number(vatAmt).toFixed(2)}`,
				`$${lineTotal.toFixed(2)}`,
			];
		} else {
			const descLines = [payment.service];
			if (payment.title && payment.title !== payment.service) descLines.push(payment.title);
			if (meta.domainName) descLines.push(meta.domainName);
			const periodMonths = meta.period || 12;
			const endDate = new Date(paidDate);
			endDate.setMonth(endDate.getMonth() + periodMonths);
			const periodText = `${dateText} to ${endDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })}`;
			const priceDiscount = `$${amount.toFixed(2)} x 1\nDiscount: -`;
			rowData = [
				descLines.join("\n") + (periodText ? `\n${periodText}` : ""),
				priceDiscount,
				`$${vatAmountFromInvoice.toFixed(2)}`,
				`$${totalFromInvoice.toFixed(2)}`,
			];
		}

		// Table header and row: all columns left-aligned
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		const colWidths = [85, 42, 28, 35];
		const colStart = 20;
		const padding = 2;
		const getColLeftX = (colIndex) => {
			let x = colStart;
			for (let j = 0; j < colIndex; j++) x += colWidths[j];
			return x + padding;
		};
		// Draw headers
		headers.forEach((h, i) => {
			doc.text(h, getColLeftX(i), tableStartY + 5, { align: "left" });
		});
		doc.setDrawColor(200, 200, 200);
		doc.line(colStart, tableStartY + 7, colStart + colWidths.reduce((a, b) => a + b, 0), tableStartY + 7);

		// Table row
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		const rowY = tableStartY + 14;
		const lineHeight = 4;
		let maxLines = 1;
		rowData.forEach((cell, i) => {
			const lines = doc.splitTextToSize(String(cell), colWidths[i] - 4);
			maxLines = Math.max(maxLines, lines.length);
		});
		rowData.forEach((cell, i) => {
			const lines = doc.splitTextToSize(String(cell), colWidths[i] - 4);
			doc.text(lines, getColLeftX(i), rowY, { align: "left" });
		});

		// --- Summary (right-aligned, below table row) ---
		const summaryStartY = rowY + maxLines * lineHeight + 18;
		const summaryRight = 190;
		const summaryLabel = 140;
		let summaryY = summaryStartY;

		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.text("Subtotal (excl. VAT):", summaryLabel, summaryY);
		doc.text(`$${subtotalFromInvoice.toFixed(2)}`, summaryRight, summaryY, { align: "right" });
		summaryY += 7;

		if (vatAmountFromInvoice > 0) {
			const vatPct = paymentInvoice?.vat?.percentage;
			const vatLabel = vatPct != null ? `VAT (${vatPct}%):` : "VAT:";
			doc.text(vatLabel, summaryLabel, summaryY);
			doc.text(`$${vatAmountFromInvoice.toFixed(2)}`, summaryRight, summaryY, { align: "right" });
			summaryY += 7;
		}

		doc.setFont("helvetica", "bold");
		doc.setFontSize(10);
		doc.text("Total:", summaryLabel, summaryY);
		doc.text(`$${totalFromInvoice.toFixed(2)}`, summaryRight, summaryY, { align: "right" });
		summaryY += 7;

		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.text("Payments:", summaryLabel, summaryY);
		doc.text(`($${totalFromInvoice.toFixed(2)})`, summaryRight, summaryY, { align: "right" });
		summaryY += 7;

		doc.setFont("helvetica", "bold");
		doc.text("Amount Due (USD):", summaryLabel, summaryY);
		const amountDue = payment.status === "completed" || payment.status === "refunded" ? "$0.00" : `$${totalFromInvoice.toFixed(2)}`;
		doc.text(amountDue, summaryRight, summaryY, { align: "right" });

		// --- Footer ---
		const footerY = 280;
		doc.setDrawColor(...lightGray);
		doc.line(20, footerY, 190, footerY);
		doc.setFontSize(8);
		doc.setTextColor(...lightGray);
		doc.text("Thank you for your business!", 105, footerY + 5, { align: "center" });
		doc.text(`Payment terms: ${paymentInvoice?.paymentTerms || "Due on receipt"}`, 105, footerY + 10, { align: "center" });
		doc.text(`For any inquiries, please contact ${SELLER.email}`, 105, footerY + 15, { align: "center" });

		return Buffer.from(doc.output("arraybuffer"));
	} catch (error) {
		console.error("Error generating invoice PDF:", error);
		throw error;
	}
};

const formatPaymentMethod = (method) => {
	const methodMap = {
		wallet_balance: "Wallet Balance",
		credit_card: "Credit Card",
		crypto: "Cryptocurrency",
		bank_transfer: "Bank Transfer",
		other: "Other",
	};
	return methodMap[method] || method;
};

module.exports = {
	generateInvoicePDF,
};

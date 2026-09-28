const APIRouter = require("express").Router();

// Nomadly Reseller API proxy (unified domains/dns/vps/rdp/hosting).
// This is the single provider surface for domains, DNS and cPanel hosting.
// The legacy ConnectReseller / WHM / Plesk / Cloudflare integrations have been
// retired (routes below removed) in favour of the reseller proxy.
APIRouter.use("/reseller", require("./reseller"));
APIRouter.use("/checkout", require("./checkout"));

APIRouter.use("/rdp", require("./rdp"));
APIRouter.use("/rdp-subscription", require("./rdpSubscription"));
APIRouter.use("/transactions", require("./transactions"));
APIRouter.use("/wallet", require("./wallet"));
APIRouter.use("/invoices", require("./invoices"));
APIRouter.use("/payment", require("./payment"));
APIRouter.use("/subscription", require("./subscription"));
APIRouter.use(
	"/vps-billing-cycle-discount",
	require("./vps-billing-cycle-discount")
);
APIRouter.use("/vps-plan", require("./vps-plans"));
APIRouter.use("/vps-disk", require("./vps-disks"));
APIRouter.use(require("./computeEngine"));
APIRouter.use("/ssh", require("./ssh-keys"));
APIRouter.use("/admin", require("./admin"));
APIRouter.use("/auth", require("./auth"));
APIRouter.use("/user-session", require("./userSessionRoutes"));
APIRouter.use("/chat", require("./chat"));

APIRouter.use(require("./api-keys"));
APIRouter.use("/tax", require("./tax"));
APIRouter.use("/promo", require("./promo"));
APIRouter.use("/waitlist", require("./waitlist"));

module.exports = APIRouter;

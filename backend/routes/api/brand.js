const router = require("express").Router();
const currentUser = require("../../app/middlewares/current-user");
const requireAuth = require("../../app/middlewares/require-auth");
const env = require("../../start/env");

// Comma-separated allowlist of emails that may open the private /brand guide.
const allowlist = () =>
  String(env.BRAND_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

// GET /api/v1/brand/access -> { allowed }
router.get("/access", currentUser, requireAuth, (req, res) => {
  const email = String(req.user?.email || "").toLowerCase();
  const allowed = !!email && allowlist().includes(email);
  return res.json({ success: true, data: { allowed } });
});

module.exports = router;

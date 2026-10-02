const router = require("express").Router();
const { body, validationResult } = require("express-validator");
const Waitlist = require("../../app/models/Waitlist");
const transporter = require("../../app/services/mailer");
const env = require("../../start/env");

// POST /api/v1/waitlist  { email, product, productName?, note? }
// Real interest capture: stored in Mongo (source of truth) + best-effort Brevo email.
router.post(
  "/",
  [
    body("email").isEmail().withMessage("A valid email is required").bail().normalizeEmail(),
    body("product").isString().trim().notEmpty().withMessage("product is required"),
    body("productName").optional().isString().trim(),
    body("note").optional().isString().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const { email, product, productName, note } = req.body;

    // Upsert keeps it idempotent — a repeat signup is not an error.
    const doc = await Waitlist.findOneAndUpdate(
      { email, product },
      {
        $set: {
          email,
          product,
          productName: productName || product,
          note: note || "",
          source: "web",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Fire-and-forget confirmation email. If the sender domain isn't verified in
    // Brevo yet, this quietly no-ops — the signup is already saved.
    (async () => {
      try {
        const label = productName || product;
        const brand = env.MAIL_NAME || "hosta.sh";
        await transporter.sendMail({
          to: email,
          subject: `You're on the waitlist \u2014 ${label}`,
          html: `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.55">
            <h2 style="margin:0 0 8px;font-size:20px">You're on the list \uD83C\uDF89</h2>
            <p>Thanks for your interest in <strong>${label}</strong> on ${brand}.</p>
            <p>We'll email you the moment it goes live \u2014 privacy-first, no spam, ever.</p>
            <p style="color:#64748b;font-size:13px;margin-top:18px">If you didn't request this, you can safely ignore this email.</p>
          </div>`,
        });
      } catch (e) {
        console.debug("[waitlist] confirmation email skipped:", e?.message || e);
      }
    })();

    return res.status(201).json({
      success: true,
      message: "You're on the waitlist. We'll be in touch!",
      data: { email: doc.email, product: doc.product },
    });
  }
);

// GET /api/v1/waitlist/count?product=slug -> { product, count }
router.get("/count", async (req, res) => {
  const { product } = req.query;
  const filter = product ? { product: String(product) } : {};
  const count = await Waitlist.countDocuments(filter);
  return res.json({ success: true, data: { product: product || "all", count } });
});

module.exports = router;

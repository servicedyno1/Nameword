const mongoose = require("mongoose");

// Interest capture for "coming soon" cloud products. One row per (email, product).
const waitlistSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    product: { type: String, required: true, trim: true, index: true },
    productName: { type: String, default: "" },
    note: { type: String, default: "" },
    source: { type: String, default: "web" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    notified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

// Idempotent signups: re-submitting the same email for the same product just updates it.
waitlistSchema.index({ email: 1, product: 1 }, { unique: true });

module.exports = mongoose.model("Waitlist", waitlistSchema);

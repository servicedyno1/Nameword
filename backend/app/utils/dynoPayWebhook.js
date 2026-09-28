const crypto = require("crypto");

const MAX_PROCESSED_IDS = 10000;
const processedWebhookIds = new Set();
const idQueue = [];                                                                                                                                


function verifyDynoPaySignature(payload, signature, secret) {
        if (!payload || !signature || !secret) return false;
        try {
                const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
                const sig = signature.startsWith("sha256=") ? signature.slice(7).trim() : signature.trim();
                const a = Buffer.from(expected, "hex");
                const b = Buffer.from(sig, "hex");
                return a.length === b.length && crypto.timingSafeEqual(a, b);
        } catch {
                return false;
        }
}

// --- V2 signature (recommended by Dynopay docs) ---
// Signed message = `${t}.${rawBody}`; HMAC-SHA256 with the FULL whsec_ secret
// (verbatim). The header can carry several `v1=` values during secret rotation —
// accept if ANY matches. Reject timestamps outside ±toleranceSec (replay guard).
function verifyDynoPaySignatureV2(rawBody, headerV2, secret, toleranceSec = 300) {
        if (rawBody == null || !headerV2 || !secret) return false;
        try {
                const tokens = String(headerV2).split(",").map((s) => s.trim());
                const tTok = tokens.find((p) => p.startsWith("t="));
                const t = Number(tTok ? tTok.slice(2) : NaN);
                if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
                const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
                const exp = Buffer.from(expected, "hex");
                return tokens
                        .filter((p) => p.startsWith("v1="))
                        .some((p) => {
                                try {
                                        const got = Buffer.from(p.slice(3), "hex");
                                        return got.length === exp.length && crypto.timingSafeEqual(got, exp);
                                } catch {
                                        return false;
                                }
                        });
        } catch {
                return false;
        }
}

// Best-effort payload string when the exact raw body wasn't captured.
function toPayloadString(parsedBody, query) {
        if (typeof parsedBody === "string") return parsedBody;
        if (parsedBody && typeof parsedBody === "object" && Object.keys(parsedBody).length) return JSON.stringify(parsedBody);
        return JSON.stringify(query || {});
}

// Unified verification: prefer V2 (over the raw body) then legacy V1. Returns
// { provided, valid, version }. `provided` is false when no signature header is
// present (e.g. a browser GET redirect) so callers can safely let those through.
function verifyDynoPayWebhook({ headers = {}, rawBody, parsedBody, query, secret } = {}) {
        if (!secret) return { provided: false, valid: true, version: null };
        const v2 = headers["x-dynopay-signature-v2"] || headers["X-Dynopay-Signature-V2"];
        const v1 = headers["x-dynopay-signature"] || headers["X-DynoPay-Signature"];
        if (v2) {
                const body = rawBody != null && rawBody !== "" ? rawBody : toPayloadString(parsedBody, query);
                return { provided: true, valid: verifyDynoPaySignatureV2(body, v2, secret), version: "v2" };
        }
        if (v1) {
                const body = toPayloadString(parsedBody, query);
                return { provided: true, valid: verifyDynoPaySignature(body, v1, secret), version: "v1" };
        }
        return { provided: false, valid: true, version: null };
}

// Dynopay normalized payment success. `settled` is the definitive paid state
// (is_paid=true); we also treat confirmed/processing/completed and the
// payment.confirmed|settled events as captured, matching Dynopay's webhook guide.
const DYNO_SUCCESS_STATUSES = new Set([
        "settled", "confirmed", "completed", "processing", "successful", "success", "paid",
]);
const DYNO_SUCCESS_EVENTS = new Set([
        "payment.confirmed", "payment.settled", "payment.completed",
]);
function isDynoPaymentSuccessful({ eventType, statuses = [], isPaid } = {}) {
        if (isPaid === true || isPaid === "true") return true;
        if (eventType && DYNO_SUCCESS_EVENTS.has(String(eventType).toLowerCase())) return true;
        return (statuses || [])
                .filter((s) => s != null && s !== "")
                .map((s) => String(s).toLowerCase())
                .some((s) => DYNO_SUCCESS_STATUSES.has(s));
}


function hasProcessed(webhookId) {
        if (!webhookId) return false;
        return processedWebhookIds.has(webhookId);
}


function markProcessed(webhookId) {
        if (!webhookId) return;
        if (processedWebhookIds.size >= MAX_PROCESSED_IDS && !processedWebhookIds.has(webhookId)) {
                const oldest = idQueue.shift();
                if (oldest) processedWebhookIds.delete(oldest);
        }
        if (!processedWebhookIds.has(webhookId)) {
                processedWebhookIds.add(webhookId);
                idQueue.push(webhookId);
        }
}

module.exports = {
        verifyDynoPaySignature,
        verifyDynoPaySignatureV2,
        verifyDynoPayWebhook,
        isDynoPaymentSuccessful,
        hasProcessed,
        markProcessed,
};

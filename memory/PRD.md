# hosta.sh (formerly Nameword) — PRD

History of every session: `CHANGELOG.md`. Prioritised backlog: `ROADMAP.md`. Test logins: `test_credentials.md`.

## Original problem statement
Set up the offshore-hosting app (domains, DNS, cPanel hosting, VPS, Windows RDP, developer API, crypto wallet) from the
user's repo/credentials on the Emergent pod and keep it running live. Then rebrand Nameword → **hosta.sh** in 3 phases:
1. Brand discovery (private `/brand` guide) — DONE
2. Apply brand app-wide (Neon Prompt colours, `>_` Prompt logo, Geist + Geist Mono, tagline
   "Private by default. Scriptable by design.", EN/ES/FR, emails, invoices) — DONE in code, finishing QA (see plan)
3. Launch on https://hosta.sh (domain cut-over, Google OAuth redirect URIs, Brevo sender `hi@hosta.sh`, launch kit)

## Architecture
- Backend: **Node.js + Express + Mongoose** (NOT FastAPI) — supervisor runs `/bin/bash /app/backend/start.sh` (→ `node bin/www`, port 8001).
  Nunjucks email templates in `backend/views/mails`, jsPDF invoices in `backend/app/utils`.
- Frontend: React 19 + Vite + Tailwind v4 — `frontend/.prod` present → PROD build; after edits run `sudo supervisorctl restart frontend` (~30–60s).
- DB: user's REAL production MongoDB (Railway `DB_URI`). Never create test data casually; no destructive tests; no real payments.
- Ingress: `/api/*` → 8001; `/auth/*` (Google OAuth web routes) must also reach the Node backend in prod.
- Integrations: Nomadly reseller API (`https://2.speechcue.com/reseller/v1`, server-side `dry_run`), DynoPay (live key), Brevo (live key),
  Google OAuth (only nameword.com URIs registered). Placeholders: SMTP, Telegram, WHM/cPanel, Plesk, Cloudflare, Telnyx, GCS.

## Brand rules (hosta.sh)
- Name always lowercase `hosta.sh`. Never "Nameword" in UI copy, except the intentional "formerly Nameword" notices (AnnouncementBar,
  RebrandNotice, meta "Formerly Nameword." for SEO).
- Palette Neon Prompt (#22E6FF cyan + #FF3DCB magenta), dark-first. Fonts Geist (UI) + Geist Mono (headings/code). Logo `>_` PromptMark.
- Tokens live in `frontend/src/index.css`; brand guide data in `frontend/src/pages/brand/brandData.js`.

## Current work plan (2026-06, this fork) — user approved
A. **Finish Phase 2**
   1. `/brand` guide shows Phase 2 = done, Phase 3 = next.
   2. Sweep leftover "Nameword" text in UI/emails/PDFs (keep infra IDs: `ns1.nameword.com` nameservers, GCP project id, payment `from` tags).
      Contact e-mail addresses become one config value so the cut-over is a one-line change.
   3. Check mobile (390px) layout + rendered email templates.
B. **Rename test accounts** `*@nameword.local` → `*@hosta.local` (only test accounts; real users untouched). Update `BRAND_ADMIN_EMAILS` + test_credentials.md.
C. **Landing restructure inspired by hostnet.nl** — every product shown in one consistent format:
   search-first hero + featured promo tiles → uniform product price cards ("from $X /mo", one-liner, "Go to X") → "pick your extension"
   TLD row → product plan sections → value trio (Private / Scriptable / Simple) → support block → reviews/personas → FAQ → final CTA.
D. **Phase 3 prep (hosta.sh cut-over)**
   - FINDING 2026-06: `hosta.sh` is **NOT registered** (DNS NXDOMAIN). Reseller search: available, $256/yr (OpenProvider).
     Brevo has no `hosta.sh` sender/domain. → The live cut-over is BLOCKED until the user registers hosta.sh.
   - Prepare runbook `/app/memory/PHASE3_CUTOVER.md` (env values, Google Console URIs, Brevo DNS, Emergent custom domain).
   - Keep the current verified sender `hi@nameword.com` (display name "hosta.sh") until `hi@hosta.sh` is verified, otherwise every OTP/reset
     e-mail would bounce.
E. Background-job hardening for missing Telegram/Telnyx tokens (backlog).
F. Testing: testing_agent (frontend) after A–C; curl for B.

## Status (session ended by user 2026-06 — "wrap up")
- **A. Phase 2 finish — mostly DONE (not testing_agent-verified):**
  - `/brand`: META phase "2 / 3" / "applied app-wide" / v1.0.0; NEXT_STEPS has `state` done/done/next (Phase 3 lists "Register hosta.sh");
    NextSteps shows [x]/[done]/[next] (testids `next-step-N`, `next-step-N-state`); Decisions defaults to `APPLIED_PICKS`
    {neon, geist, prompt} (`decisionsCtx.js`), status `applied_in_phase_2` / `proposed_change` / `pending`, reset → applied picks; Readme updated.
  - Leftover "Nameword" sweep: contact e-mail is now ONE config value — frontend `VITE_SUPPORT_EMAIL` (`src/config/brand.js`:
    `SUPPORT_EMAIL`, `withSupportEmail()` replaces `{email}` in locale `privacy/terms.contactText` EN/ES/FR) used by Footer (`footer-support-email`),
    NeedHelp (`help-support-email`), Privacy, Terms; backend `SUPPORT_EMAIL` (fallback MAIL_FROM_ADDRESS) used by both invoice PDFs.
    Both = `hi@nameword.com` until cut-over. Deleted unused old logos (`assets/logo/nameword-*.svg`, `backend/views/mails/images/logo.svg`) and
    the dead `logoblue` export in `common/icons.jsx`. AccountSettingTab masked-password placeholder no longer says "Nameword@123".
    KEPT on purpose: `ns1.nameword.com` nameservers, GCP project id `nameword-435507`, payment `from: "nameword"` tags, "formerly Nameword" notices.
  - NOT done: 390px mobile pass + rendered-email screenshot check.
- **B. Test accounts — DONE:** 58 `*@nameword.local` → `*@hosta.local` (users, verification_codes, password_reset_tokens). `BRAND_ADMIN_EMAILS`
  now has demo@hosta.local. Login demo@hosta.local → 200 verified.
- **C. Hostnet-style landing — NOT STARTED in code.** Ready inputs: `/app/design_guidelines.json` (blueprint), promo images
  `/public/img/landing/promo-{vps,hosting,domains}.webp` (Neon Prompt, generated). Planned components (landing/): FeaturedTiles (3 promo tiles in
  Hero), ProductLineup (uniform cards Domains/Hosting/VPS/RDP with LIVE "from" prices + "included free" strip DNS/API/Rewards), TldPicker
  (replaces PricingTeaser, keep testids tld-card-*/tld-register-*), MissionBlock (terminal window with real `curl … -H "x-api-key: <userId>|<apiKey>"`
  examples from ApiDocs), ServiceValues trio (replaces WhyNameword), SupportBlock (help centre, SUPPORT_EMAIL, API docs — no "24/7" claims),
  shared SectionHead + memoised plan fetch helper. Order: Announcement → Hero+tiles → TrustStrip → ProductLineup → TldPicker → Mission → CloudVps →
  WindowsRdp → CpanelHosting → ServiceValues → CloudCatalog → Support → Testimonials → RewardsBand → Faq → FinalCta (drop GuaranteesStrip).
  Copy goes into site.{en,es,fr}.js. Do NOT use the design agent's invented "99.98% uptime" metric.
- **D. Phase 3 — BLOCKED:** hosta.sh NXDOMAIN (unregistered; $256/yr available via reseller). Brevo has no hosta.sh domain/sender →
  kept MAIL_FROM/BREVO_EMAIL = hi@nameword.com. Env NOT switched to hosta.sh (would send real customers dead links — crons run on prod DB).
  Runbook `/app/memory/PHASE3_CUTOVER.md` still to write.
- **E. DONE:** `start/env.js` — TELEGRAM_BOT_TOKEN, TELNYX_ACCESS_TOKEN/PROFILE_ID/PHONE_NUMBER, GCLOUD_STORAGE_BUCKET_NAME now optional
  (default "") so a fresh pod without them no longer exits with code 1. New optional SUPPORT_EMAIL.
- Verified after restart: backend + frontend RUNNING, login 200, home 200. No testing_agent run this session.

## Next session — do in this order
1. Build C (landing), then one screenshot + testing_agent (frontend: landing sections, /brand next-steps, footer email, 390px).
2. Write PHASE3_CUTOVER.md; once user registers hosta.sh: add Brevo domain + DNS, Google Console URIs
   (`https://hosta.sh/auth/google/callback`, `/auth/google/link/callback`), switch APP_URL/FRONTEND_URL/GOOGLE_*/CORS/VITE_SUPPORT_EMAIL/
   SUPPORT_EMAIL/MAIL_FROM to hosta.sh, og:image URLs in index.html, Emergent custom domain.

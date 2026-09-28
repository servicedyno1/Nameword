# Nameword Platform — Setup & Credential Audit (PRD / Handoff)

## 🔎 SESSION (2026-09-25) — namewords.sbs "site not working" diagnosis + reseller-API gap report
User: `namewords.sbs` (moxxcompany@gmail.com hosting) doesn't load. Investigated live via reseller API (container has NO external DNS egress — `dig`/`curl` unreliable; used the reseller API as source of truth).
- **Root cause:** cPanel account `namea3a5` is **suspended** (`GET /hosting/namea3a5` → `suspended:true`, plan Premium Anti-Red 1-Week $30, expires 2026-09-25T16:49Z; server time was 08:38Z so suspended BEFORE expiry). Wallet balance **$10 < $30** renewal, `auto_renew:true` but no renewal txn → auto-renew almost certainly failed on funds. A suspended account also explains the earlier `CPANEL_AUTH_FAILURE` (can't open a cPanel session).
- **Secondary:** the domain's Cloudflare zone had **only NS records** — no web A record → wouldn't resolve to the server even if active. Delegated to Cloudflare NS (leanna/anderson). Server IP `68.183.77.106`.
- **Actions taken (live):** Added `A www → 68.183.77.106` via `resellerAPI.addDns` (reseller payload `{type,name,value,ttl}`), confirmed via GET. Apex/root A could NOT be added — reseller rejects `name:"@"`/`""` (`dns_add_failed`) and double-appends the domain when given the FQDN (created+deleted a junk `namewords.sbs.namewords.sbs`). Left `www` only per user; apex flagged in the report.
- **Report written:** `/app/memory/reseller_api_provisioning_gaps.md` — 5 reseller-API gaps with exact request/response repros (1: provisioning must auto-create web DNS; 2: apex add + name normalization; 3: cPanel SSO CPANEL_AUTH_FAILURE; 4: no `/hosting/:user/renew` + missing suspended_reason/auto-renew-error fields; 5: `/domains` reports empty nameservers). Strictly server-side (no client workarounds section, per user).
- **Delete+recreate live test: ATTEMPTED then HALTED (per user).** Manually credited the in-app Mongo wallet +$30 → **$40** (script `/app/backend/scripts/manual_topup.js`, userId 6aa5e0a0a9666e28d5bb120c; user chose to KEEP the $40). `DELETE /hosting/namea3a5` returned `terminated:true` twice but the account stayed fully present/suspended after 90s → **terminate is a provider-side no-op (new Gap 6)**. No recreate/re-buy attempted → wallet NOT charged for it; account left intact (suspended). User: stop live test, hand report to Nomadly.
- **New reseller findings this session:** Gap 6 (terminate no-op), Gap 7 (`/hosting` list `suspended:false` vs `/hosting/:user` details `suspended:true`), and "change/move a plan's domain" is NOT supported (only `set-primary` among already-attached domains, itself behind the broken cPanel session).
- **Report finalized:** `/app/memory/reseller_api_provisioning_gaps.md` now has 7 gaps + TL;DR + acceptance test, for the Nomadly reseller-API team. No Nameword code changes needed for these (all server/provider side).
- **No app code changed this turn** → no testing_agent run applicable.



## ✅ SESSION (2026-06, fork a0fb0b8d) — 4 hosting/UX features (docroot, quiet errors, plan compare, inner-page polish)
All four built + verified by testing_agent iteration_21 = 100% (read-only on the live account).
1. **Docroot Control (#1):** `components/hosting/CpanelTabs.jsx` DomainsTab — each addon domain row now has a "Docroot" toggle (`cpanel-docroot-toggle-N`) opening an inline editor: optional mode `<select>` (`cpanel-docroot-mode`, from `M.docrootModes`), a path input (`cpanel-docroot-input`) and Save (`cpanel-docroot-save`). Saves via `M.setDocroot(u,{domain,document_root})` (+ `M.setDocrootMode` if modes exist). `document_root` is the provider field name. (namea3a5 has 0 addons so the toggle isn't shown there yet.)
2. **Quiet Known Errors (#2):** `api/client.js` interceptor — never calls `logout()` on `code==='CPANEL_AUTH_FAILURE'` (was a latent risk if the provider relays 401), and logs it via `console.debug` (DEV) instead of `console.error`. CpanelTabs: `useLoad` now stores `_code/_status`; new `isProviderSyncing()` + `ProviderSyncNote` (calm blue note, `data-testid=provider-sync-note`) shown in the Domains + SSL tabs when the provider cPanel-session auth is failing — instead of a scary empty/error state.
3. **Plan Comparison (#3):** `pages/HostingNomadly.jsx` plan cards — prominent, comparable addon-domain allowance row (`plan-addon-allowance-<plan_id>`): premium-weekly=1, premium-monthly=5, golden-monthly=Unlimited.
4. **Inner Page Polish (#4):** hero consistency pass reusing the landing look on VPS/RDP (`components/servers/ServersPage.jsx`), Hosting (`HostingNomadly.jsx`), Pricing (`pages/Pricing.jsx`) and the marketing kit (`components/marketing/marketing-ui.jsx`): `nw-eyebrow` → `nw-kicker` (removes the `[ ]` brackets), removed the `nw-grid-bg` overlay, bumped hero headings to `text-4xl sm:text-5xl`, added a second `nw-hero-glow` blob. No functionality changed. Verified light+dark, no 390px overflow.

### cPanel auth issue (explained to user): we rely 100% on the Nomadly reseller API for cPanel. Reseller/WHM-level calls (account, `/addons` quota, add-addon, site on/off, security, docroot-modes) work live. cPanel-SESSION calls (`/domains` list, File Manager, `/ssl`, disk stats) need a WHM→cPanel SSO into the specific account; for `namea3a5` on `panel.1.hostbay.io` that SSO returns an HTML login page → relayed as `CPANEL_AUTH_FAILURE` (401/403). Provider-side (Nomadly/HostBay @onarrival1); auto-recovers with no code change once they fix it.



## ✅ SESSION (2026-06, fork a0fb0b8d) — cPanel "Add addon domain" fix + addon-allowance answer
User report: in the cPanel manager a user could not ADD an addon domain (only subdomain). ROOT CAUSE: the Advanced cPanel → **Domains** tab (`components/hosting/CpanelTabs.jsx` `DomainsTab`) only LISTED addon domains (with Make-primary / Remove) — it had no add input. The full add-addon flow existed only in the Manage **Overview** panel (`HostingNomadly.jsx` `doAddAddon`), which users didn't find.
- **FIX (frontend only; backend was already wired):** added an "Add addon domain" input (`cpanel-addon-input`) + Add button (`cpanel-addon-add-btn`) to `DomainsTab`, reusing `resellerAPI.addHostingAddon(user, domain)` (backend `addHostingAddon` already attaches upstream AND auto-points NS for Nameword-owned domains). Added a live allowance/quota display (`cpanel-addon-quota`, e.g. "0 of 1 used"), a helper line, an at-limit amber note (disables Add when the plan quota is reached), and a post-add "connect" summary (`cpanel-addon-connect`) showing NS-pointing status / nameservers to set at the registrar.
- **Reliability detail:** the Domains tab now sources the addon list + count + quota from `resellerAPI.listHostingAddons` (GET `/hosting/:user/addons` — a reliable reseller/WHM-level call), NOT from `M.domains` (GET `/hosting/:user/domains`), because that `/domains` call is a cPanel-SESSION op that currently returns the documented provider-side `CPANEL_AUTH_FAILURE` (401) for `namea3a5`. Primary + subdomains still come from `/domains` (best-effort; may be empty until the provider fixes cPanel auth). New `addonAllowance` prop is passed HostingNomadly → CpanelTabs → DomainsTab, computed from `plans.find(plan_id).addon_domains` (fallback `manageData.addon_quota`).
- **Answer to "does the reseller API return per-plan addon allowance?" → YES.**
  - Per PLAN (catalog): `GET /api/v1/reseller/hosting/plans` returns `addon_domains` per plan. LIVE values today: premium-weekly = **1**, premium-monthly = **5**, golden-monthly = **"unlimited"**.
  - Per ACCOUNT: `GET /api/v1/reseller/hosting/:user/addons` → `{ addon_quota, addon_count, addons }` (verified LIVE for namea3a5 → quota 1, count 0). Also `GET /api/v1/reseller/hosting/:user` → `addon_quota` / `addon_domain_count` / `addon_domains`.
- **STATUS: ✅ testing_agent iteration_20 = 100% (frontend, read-only on the live prod account).** Login → /hosting → Manage → Advanced cPanel → Domains verified: add input + Add button + quota "0 of 1 used" + helper text render; dark mode legible; Subdomains tab regression OK. No mutating action performed on the live account.
- Files: `frontend/src/components/hosting/CpanelTabs.jsx` (DomainsTab + tab-shell prop), `frontend/src/pages/HostingNomadly.jsx` (passes addonAllowance).



## ✅ SESSION (2026-06, fork a0fb0b8d) — Landing Phase 1 fix + Phase 2 (Testimonials + FAQ)
Continued the "Hostinger-inspired, media-rich" landing redesign. Real pod URL = `https://nameword-dev-9.preview.emergentagent.com` (both backend+frontend already RUNNING; backend health mode=live). Frontend runs Vite DEV (`yarn start`, HMR) — `.env` changes need `sudo supervisorctl restart frontend`; code edits hot-reload.
- **CRITICAL FIX (Phase 1 was silently broken):** `components/home/landing/GuaranteesStrip.jsx` had a mismatched JSX tag (line 33 `</div>` where a `<Reveal>` was opened) → the vite react-babel plugin threw "Expected corresponding JSX closing tag for <Reveal>", crashing the ENTIRE landing page. Changed `</div>` → `</Reveal>`. All 19 landing components now pass `esbuild`.
- **.env:** updated `frontend/.env` `VITE_API_BASE_URL` from the stale `5c680fc7-…` host to `https://nameword-dev-9.preview.emergentagent.com` (used for Google OAuth redirects; API calls already use same-origin).
- **Phase 2 (NEW):** `components/home/landing/Testimonials.jsx` (3 persona-based, NON-fabricated voice cards — no invented names/ratings/logos, role labels only) and `components/home/landing/Faq.jsx` (6-item accordion, useState open-index, motion AnimatePresence, first item open by default; privacy/crypto/offshore/DMCA questions). Wired into `HomeRedesign.jsx`: order now …WhyNameword → **Testimonials** → RewardsBand → PricingTeaser → GuaranteesStrip → **Faq** → FinalCta. Copy added to `locales/site.{en,es,fr}.js` under `home.testimonials` + `home.faq` (i18n-safe, all 3 languages).
- **Testids:** testimonial-0..2; faq-list, faq-item-0..5, faq-trigger-0..5, faq-answer-N.
- **STATUS: ✅ testing_agent iteration_19 = 100% (13/13).** Verified: no crash/white screen, all sections + testids present, FAQ single-open toggle + chevron rotate, hero live domain search hits real reseller API, live VPS/RDP plan prices, dark mode (testimonial/FAQ bg rgb(9,8,13), legible), EN+ES runtime i18n (FR static-confirmed), 390px NO horizontal scroll. NOTE: Vite DEV preview 429-rate-limits rapid reloads (preview side effect, not a bug); `.prod` toggle + `start.sh` can serve a prod build if regression flakiness matters.
- NEXT (backlog): Phase 3 — carry the new visual system inward to VPS/RDP/hosting/pricing pages for consistency.



## ✅ SESSION (2025-07) — Product-forward landing (VPS & RDP on the home page)
Contabo-style: the home page now surfaces the paid server products with specs + LIVE prices.
New section order in `components/home/HomeRedesign.jsx`:
Hero → CloudVps (#vps) → WindowsRdp (#rdp) → EverythingElse → WhyNameword → PricingTeaser →
RewardsBand → FinalCta. (The old big `Products.jsx` grid is no longer used on the home page.)
New files (components/home/landing/):
- ServerPlanCard.jsx (+ ServerPlanSkeleton) — reusable plan card, "Most popular" highlight.
- CloudVps.jsx — fetches resellerAPI.getVpsPlans('EU'); renders ALL plans (live: 6× "Cloud VPS 10–60",
  $18–$288/mo); popular = index 3; Deploy + "Compare all VPS" → /vps. Safe FALLBACK array if fetch slow/fails.
- WindowsRdp.jsx — fetches getRdpPlans('EU'); shows ONE card per tier (filters duration_months===1 →
  Standard/Pro/Power, $56/$112/$224 /mo); popular = Pro; Configure + "View all RDP plans" → /rdp;
  Network spec hardcoded "1 Gbps". Safe FALLBACK.
- EverythingElse.jsx — condensed strip (Domains, DNS[protected→/sign-in], Web Hosting, Developer API),
  reuses t.site.nav.items copy.
Copy: added `home.servers` block (perMonth/popular + vps/rdp/everything) to site.en/es/fr.js (i18n-safe).
Hero: "Need a server?" link now smooth-scrolls to #vps (falls back to navigate('/vps')).
Prices are LIVE (verified GET /reseller/vps/plans → 200, 6 plans). Deploy/Configure route to existing
/vps and /rdp pages — NO new checkout flow. No price/margin/checkout changes.
STATUS: ✅ lint clean; ✅ auto_frontend_testing_agent 26/26 PASS (live search, all nav, mobile no-scroll,
API 200, no JS errors); dark mode verified via screenshot. Vite DEV (HMR).


## ✅ SESSION (2025-07) — Landing page redesign (calmer, product-first)
Scope: public landing + shared nav/footer only (deeper app screens untouched).
Typography: switched the whole app to **Inter** (was Outfit + Plus Jakarta Sans); JetBrains Mono kept for
code/price accents. Global change in `index.css` (@import + --font-sans/--font-display tokens; added
-0.021em heading tracking).
Landing changes (all in components/home/landing/*):
- Hero.jsx REWRITTEN: centered, product-first; removed the photographic dark backdrop, the HeroShowcase
  floating mock card, the gradient headline, the 5-star rating chip, and the nw-grid-bg/nw-hero-glow decor.
  Domain search is the single focal point; slim quiet trust strip below. Live search flow unchanged.
- Added calm `.nw-kicker` label class (no "[ ]" brackets) and swapped landing eyebrows to it (Products,
  WhyNameword, PricingTeaser). Did NOT touch the shared `.nw-eyebrow`/`.nw-hero`/grid/glow classes because
  other (out-of-scope) pages still use them.
- RewardsBand.jsx: replaced the dark photo panel with a clean prepaid-wallet product card (no photo).
- FinalCta.jsx: replaced the photo background with one confident solid dark panel (no photo/glow).
- DomainSearchForm.jsx: added `center` prop to center the chips in the new hero.
NOTE: landing no longer imports landing/images.js or HeroShowcase.jsx (files kept, now unused).
STATUS: ✅ lint clean; ✅ auto_frontend_testing_agent 7/7 sections PASS (live domain search 200, all nav
works, no console errors, no 390px horizontal scroll); dark mode verified via screenshot. Vite DEV mode
(supervisor `frontend` runs `yarn start`), so HMR picks up changes; restart frontend only if needed.


## ✅ SESSION (2025-07) — Fresh environment setup from provided creds
Pod was reset (empty .env files; backend supervisor reverted to the default `uvicorn server:app` which fails
for this Node app). Re-did the full setup:
- Wrote `backend/.env` (all provided creds + derived GOOGLE_REDIRECT_URL/GOOGLE_LINK_REDIRECT_URL from APP_URL,
  DYNO_PAY_API_KEY from the separately-provided key). Wrote `frontend/.env` (VITE_API_BASE_URL + Vite vars).
- `yarn install` in /app/backend (bcrypt native build OK).
- Switched supervisor `backend` program: `uvicorn` → `bash /app/backend/start.sh` (Node launcher, port 8001).
- VERIFIED LIVE: backend boots, connects to real Railway MongoDB; `/api/v1/reseller/health` → mode:live;
  `/api/v1/reseller/domains/search` → live Nomadly pricing; frontend landing renders (HTTP 200).
- LIVE: MongoDB, Nomadly, DynoPay, Brevo, Google OAuth. PLACEHOLDER: Telegram, WHM/cPanel, Plesk, Cloudflare,
  Telnyx, GCS, SMTP host.
- URL note: APP_URL set to user-provided preview host 5c680fc7-…; this pod's platform URL is a0fb0b8d-….
  App works on any host (frontend uses window.location.origin); only Google OAuth follows APP_URL.


## ⏳ LATEST SESSION (2025-07, pod 1f970365) — DNS Manager redesign (modern control panel)
SCOPE: presentation + interaction redesign of the DNS screen (same records + same DNS source).
DONE (code complete, lint clean, PROD build OK). File fully rewritten:
`frontend/src/pages/DnsManagerNomadly.jsx` (no backend changes; uses existing reseller.js DNS methods).
Features shipped:
- DOMAIN PICKER: dropdown of owned domains (resellerAPI.listDomains) + "enter manually" fallback
  (data-testid dns-domain-select / dns-domain-manual-input / dns-toggle-manual). Keeps ?domain= query sync.
- CURRENT NAMESERVERS card (chips w/ copy) from owned-domain entry.nameservers or NS records;
  "Replace nameservers" in a <details> (dns-ns-input / dns-ns-save, >=2, "DNS free" note).
- RECORDS control panel: add-record bar at TOP of the table (dns-add-toggle → dns-add-panel), EDIT IN
  PLACE (row expands to a full-width RecordForm; dns-edit-<id> → dns-edit-save/dns-edit-cancel), type-aware
  fields + light validation + hints per type (A=IPv4, AAAA=IPv6, CNAME/NS=host, MX=priority+host,
  TXT=multiline, SRV=priority/weight/port/target composed into value "weight port target"), friendly TTL
  presets (Auto=1/1min/5min/30min/1hr/1day + Custom seconds; dns-add-ttl / dns-add-ttl-custom),
  colored type BADGES, full record name via fqdn(name,domain), value COPY button (dns-copy-<id>) + truncation,
  DELETE CONFIRM modal (dns-delete-<id> → dns-delete-dialog → dns-delete-confirm/dns-delete-cancel).
- SEARCH (dns-search) + TYPE FILTER (dns-type-filter) + SORTABLE columns (dns-sort-type/name/value/ttl) +
  visible count (dns-record-count). Loading skeletons (dns-loading), empty states, MOBILE cards (md:hidden,
  dns-card-<id>) vs desktop table (md:block). Dark-mode uses existing app classes (nw-card/nw-hero/etc).
DATA CONTRACT NOTES (kept): records mapped defensively from provider shape
  {recordType,recordName,recordContent,cfRecordId} → {type,name,value,id} while PRESERVING the original
  fields (spread) so update (PUT wraps {record}) and delete (DELETE data:{record}) echo the full record back.
  addDns payload {type,name,value,ttl,priority?}. SRV value composed/parsed. TTL "Auto"→1.
STATUS: ✅ FRONTEND-UI-TESTED & VERIFIED (auto_frontend_testing_agent, 8/8 features PASS, 2025-07). Logged in
  as moxxcompany@gmail.com and exercised namewords.sbs: domain picker + manual toggle, current NS chips +
  copy, search/type-filter/sortable columns + live count, type-aware add with validation (A blocks non-IP;
  MX priority; SRV weight/port/target; TTL presets + custom), add TXT → edit-in-place → delete-confirm all
  worked LIVE against Cloudflare, colored badges, friendly TTL labels, value copy, and mobile cards at 390px
  (no horizontal scroll). No JS errors / white screens. Production-ready.
⚠️ Frontend is a Vite PROD build → after ANY frontend edit run `sudo supervisorctl restart frontend` (~15s).


## ⏳ LATEST SESSION (2025-07, pod 1f970365) — dup-hosting fix + File Manager rebuild
TASK: (1) account showed TWO hosting plans for the same site; (2) rebuild cPanel manager (full-screen)
with real upload/unzip/zip/rename/copy/move.
PROBLEM 1 ✅ FIXED + VERIFIED. Root cause: `ownership.ownedList` counted `pending` items from UNPAID
(`awaiting_payment`) orders and used differing hosting dedupe keys (provider_username vs domain), so
moxxcompany@gmail.com's real account (order NW-MU76E3UGXQBJ, active, cPanel `namea3a5`) AND an abandoned
crypto attempt (order NW-MU75DOFYKYK5, awaiting_payment/pending, no username) both showed for the same
site namewords.sbs. Fix in `backend/app/services/ownership.js`: skip items from orders not in
[paid,partial,failed]; skip refunded non-active items; dedupe hosting by WEBSITE(domain) keeping the
highest `ownScore` (active+provider handle wins). One-time idempotent cleanup
`scripts/cleanup_superseded_hosting.js` settled NW-MU75DOFYKYK5 (item+order→failed). Verified via
`scripts/verify_dedupe.js` AND deep_testing_backend_v2: GET /api/v1/reseller/hosting → exactly 1 account.
PROBLEM 2 ✅ BUILT (code complete), ⚠️ live proof BLOCKED by provider. Backend: raised
`express.json/urlencoded` limit 100kb→25mb in `app.js` (base64 uploads/chunks). File Manager proxy routes
already existed in resellerController HOSTING_MGMT_ROUTES. Frontend: rebuilt `FilesTab` in
`components/hosting/CpanelTabs.jsx` (clickable breadcrumb, drag-drop + picker upload with progress via
512KB chunked upload, Unzip/Extract, Zip/compress, Rename, Copy, Move, multi-select bulk zip/delete,
inline action form, New folder, text editor, graceful `files-load-error` + Retry state); added
`api/reseller.js` hostingManage.{extractFile,compressFiles,copyFile,moveFile,uploadChunk,cancelUploadChunk};
made the Manage modal FULL-SCREEN in `pages/HostingNomadly.jsx` (w-full h-full / sm:h-[94vh] max-w-6xl,
fixed header+tabs, scrollable body). Frontend NOT yet UI-tested (awaiting user OK).
⚠️ PROVIDER-SIDE OUTAGE: every cPanel-SESSION op for namea3a5 (File Manager, /ssl, /stats disk usage)
returns CPANEL_AUTH_FAILURE ({errors:['<!DOCTYPE html>'],httpStatus:401}) — the provider's WHM→cPanel
login returns an HTML login page. WHM/Cloudflare ops (site-status, security/status, hosting details) work
LIVE with the same key. NOT our bug. Needs the provider (Nomadly/HostBay, Telegram @onarrival1) to fix
cPanel auth for this server/account, then the File Manager works with no code change.


## ⏳ LATEST SESSION (2025-07, pod 1f970365) — fresh re-setup from user creds (VERIFIED live)
REAL pod URL = `https://nameword-dev-9.preview.emergentagent.com` (from supervisor
APP_URL/preview_endpoint). User's pasted `5c680fc7…` URL is STALE → kept in CORS_ORIGIN only.
Fresh pod: both `.env` MISSING, backend `node_modules` EMPTY (0), supervisor on DEFAULT uvicorn+`yarn start`.
RE-SETUP DONE (proven pattern):
- Wrote `/app/backend/.env` (all envalid-required vars) + `/app/frontend/.env` (same-origin, fallbacks only).
  Set BOTH JWT_KEY + JWT_SECRET (auth.js uses JWT_SECRET) to same value. Added GOOGLE_REDIRECT_URL
  (`/auth/google/callback`) + GOOGLE_LINK_REDIRECT_URL (`/auth/google/link/callback`) + reward env
  (REWARD_POINT_VALUE=0.02, WALLET_TOPUP_REWARD_RATE=1, PURCHASE_BONUS_REWARD_RATE=0.5,
  WELCOME_BONUS_POINTS=250, REFERRAL_BONUS_POINTS=250). DYNO_PAY_API_KEY single-quoted (has +//= chars);
  DYNO_PAY_BASE_URL=https://dynopay.com/api.
- `yarn install` backend (804 pkgs, ~63s). Repointed supervisor: backend→`/bin/bash /app/backend/start.sh`
  (node bin/www :8001), frontend→`/bin/bash /app/frontend/start.sh` (PROD build via `.prod`, ~15s).
- Re-seeded test users (`node scripts/seed_test_users.js`): demo@nameword.local/Demo@12345,
  buyer@nameword.local/Buyer@12345 (wallet $50).
VERIFIED live: backend "connect to mongodb" + "Server is running on port 8001"; frontend :3000 HTTP 200 +
landing renders (screenshot); `GET /api/v1/reseller/health` mode=**live**; domain search real Nomadly
($39, OpenProvider); `POST /api/v1/auth/login` 200 for buyer@. REAL creds wired: DB_URI (Railway
nozomi.proxy.rlwy.net:54383/nameword — live), NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY, GOOGLE id/secret,
DYNO_PAY_API_KEY. PLACEHOLDERS: mail SMTP, Telegram, WHM/cPanel, Plesk, Cloudflare, Telnyx, GCloud,
CR/ConnectReseller, DYNO_PAY JWT/COMPANY/WEBHOOK. EMAIL CAVEAT: MAIL_FROM/BREVO_EMAIL=hello@nameword.local
is NOT a verified Brevo sender → transactional emails won't deliver until a verified sender is set (soft
email-gate, login not blocked). Google OAuth completes once `<pod>/auth/google/callback` is whitelisted.


## ⏳ LATEST SESSION (2026-09, pod 118bb331) — fresh re-setup + LIVE 7-day HOSTING buy via crypto (ETH)
### FOLLOW-UPS THIS SESSION (after user paid the ETH):
1. **Hosting provisioned.** User paid the $30 ETH → crypto order `6aad6757…` went payment_status=paid but
   provisioning FAILED: upstream Nomadly RESELLER wallet ($25) < $30 plan → order auto-refunded $30 to the
   buyer's Nameword wallet. User then gave the RESELLER BACKEND Mongo (roundhouse.proxy.rlwy.net:52715, db
   `test`). Reseller wallet lives in `walletOf._id="5590563715"` as `usdIn/usdOut` (balance = usdIn−usdOut).
   Set `usdIn=1030` → balance $1000 (verified via GET /api/v1/reseller/account). Then re-ran the app's retry
   endpoint `POST /api/v1/checkout/orders/6aad6757…/items/0/retry` (debits the buyer's now-$40 wallet $30,
   net-zero, then re-provisions). RESULT: item.status=active, cPanel user **namea3a5**, panel
   https://panel.1.hostbay.io, IP 68.183.77.106, term 7d, expires 2026-09-25; reseller wallet 1000→970.
2. **BUG FOUND+FIXED — cPanel management stuck in test_mode.** `ownership.extractProviderIds()` hosting
   branch didn't map the upstream `result.cpanel_username` → `item.provider_username` (it only checked
   `nested.username`), so `withOwnedHosting()` (gates live calls on provider_username) returned the
   dry_run/test_mode envelope for EVERY /hosting/:user management route. Fix: added
   `nested.cpanel_username, nested.user` to the username pick() in `backend/app/services/ownership.js`; also
   backfilled the existing order item (namewords.sbs → provider_username=namea3a5). After fix the account
   HANDLE becomes the real cpanel user (namea3a5), NOT the old composite `orderId:idx`. Verified LIVE (curl +
   auto_frontend_testing_agent): GET /account/site-status=online (turn site on/off works on premium plan);
   POST /security/visitor-captcha=403 gold_only (per-domain, Golden-only); GET /mysql/databases=403
   mysql_requires_monthly (7-day trial); security/status live. Frontend CpanelTabs (Site/Security/Databases)
   all render LIVE, NO test-mode banner. (GET /ssl returns upstream CPANEL_AUTH_FAILURE — provider WHM auth,
   not our app.) Reseller cPanel API surface confirmed at https://1.speechcue.com/apidoc: the "website on/off"
   is `/account/site-status` (account-level, any plan) + `/security/visitor-captcha` & `/security/js-challenge`
   & `/geo` (per-domain, GOLDEN plan only).

Live pod URL: `https://nameword-dev-9.preview.emergentagent.com`
(user's pasted `5c680fc7…` URL is STALE.) Fresh pod: both `.env` MISSING, backend `node_modules` MISSING,
supervisor on DEFAULT (uvicorn + `yarn start`).
RE-SETUP DONE: wrote `/app/backend/.env` (all envalid-required vars) + `/app/frontend/.env` using REAL pod
URL for APP_URL/FRONTEND_URL/CORS/GOOGLE_REDIRECT_URL; `yarn install` backend (804 pkgs); repointed
supervisor backend→`node /app/backend/bin/www` (PORT 8001), frontend→`/bin/bash /app/frontend/start.sh`
(+touched `.prod` → prod build). Mongo (Railway) connected, Nomadly mode=live, DynoPay live.
LIVE TASK (user account `moxxcompany@gmail.com`/`Onlygod123@`, wallet $10, owns `namewords.sbs`):
bought the **7-day** hosting plan `premium-weekly` "Premium Anti-Red (1-Week)" $30 for the EXISTING owned
domain namewords.sbs (BYO "I already own it") → cart shows wallet-short-by-$20 so CRYPTO is primary →
picked **ETH** → generated live deposit addr `0xc60f76f99d34949218fb0534172aa9d6d44b86a2`, amount
`0.01154512 ETH` (~$30), QR shown, order `6aad6757…` = awaiting_payment (auto-provisions on ETH receipt).
NO app bugs found this session. (auto_frontend_testing_agent falsely reported "crypto modal didn't open"
— that was a harness mis-click on the mini-cart drawer; verified directly via browser: modal opens fine.)

## ⏳ LATEST SESSION (2026-09, pod 60be9ede) — fresh re-setup + LIVE crypto buy→register→DNS (2 bugs fixed)
Live pod URL: `https://nameword-dev-9.preview.emergentagent.com`
(user's pasted `5c680fc7…` URL is STALE). Fresh pod: both `.env` missing, backend `node_modules` missing,
supervisor reset to default `uvicorn server:app` (WRONG — this is a NODE app) AND frontend `yarn start`
(vite dev; must be prod build via start.sh/.prod on this Cloudflare-flaky preview).

RE-SETUP DONE: recreated `/app/backend/.env` + `/app/frontend/.env` from user creds (used REAL pod URL
for APP_URL/FRONTEND_URL/CORS/GOOGLE_REDIRECT_URL=`/auth/google/callback`/GOOGLE_LINK_REDIRECT_URL=
`/auth/google/link/callback`/VITE_API_BASE_URL); `yarn install` backend (804 pkgs); repointed supervisor
backend→`node /app/backend/bin/www`, frontend→`/bin/bash /app/frontend/start.sh` (prod build, `.prod`
already present). REAL creds: DB_URI (Railway nozomi.proxy.rlwy.net:54383/nameword — live), NOMADLY_API_KEY
(rsk_live_…, mode=live), BREVO_API_KEY, GOOGLE id/secret, DYNO_PAY_API_KEY (services read this directly;
DYNO_PAY_BASE_URL=https://dynopay.com/api). PLACEHOLDERS: mail SMTP, Telegram, WHM/cPanel, Plesk,
Cloudflare, Telnyx, GCloud, CR/ConnectReseller.

LIVE E2E (user account `moxxcompany@gmail.com` / `Onlygod123@`): bought `namewords.sbs` via crypto → user
sent REAL ETH → payment confirmed (tx 0xa1200bf3…ae3c) → domain auto-registered ACTIVE (order
NW-MU73ZSWPPIVS, payment N_1789…, invoice HCY-13714621) → DNS managed (added/deleted A + TXT on the
live Cloudflare zone). Crypto order flow = `POST /api/v1/checkout/orders/crypto {items,client_order_id,
currency}` → returns {payment:{address,cryptoAmount,qrCode,expireAt}}; poll `GET /checkout/orders/:id/
crypto-status`. NOTE: reward points auto-redeem (max) before crypto; if points fully cover, order is
`fully_covered` (NO crypto address) — moxx had 0 pts so full $30 charged.

BUGS FOUND + FIXED THIS SESSION (both verified by auto_frontend_testing_agent):
1. **Domain search hung forever on "Searching…".** Causes: `API_CONFIG.TIMEOUT` was UNDEFINED → axios had
   no timeout (hung request never aborts); and `doSearch` awaited `Promise.allSettled([search, suggest])`
   so the fast availability result was blocked behind the slow 12-TLD suggest. Fixes in
   `frontend/src/config/api.js` (TIMEOUT=30000) and `frontend/src/pages/DomainsNomadly.jsx` (decoupled:
   exact controls the spinner, suggestions fill in independently). Search now ~1.9s. Also switched
   frontend to PROD build (supervisor→start.sh) — vite-dev is Cloudflare-429-flaky on preview.
2. **DNS Manager table showed EMPTY Type/Name/Value cells.** API returns `{recordType,recordName,
   recordContent,cfRecordId}` but `frontend/src/pages/DnsManagerNomadly.jsx` rendered `{type,name,value,
   id}`. Fixed in `loadRecords` by mapping API→component fields (spread + type/name/value/id). Verified:
   NS rows visible, add A + TXT (HTTP 200, real Cloudflare IDs), delete works.
⚠️ Frontend is a PROD build → after ANY frontend source edit you MUST `sudo supervisorctl restart frontend`
   (start.sh runs `yarn build`, ~15s) or the change is NOT live.


## ⏳ LATEST SESSION (2026-09, pod 38812491) — login fix + NS/hosting + NEXT TASK
Live pod URL: `https://nameword-dev-9.preview.emergentagent.com`
(user's `5c680fc7…` URL was stale). `.env` rebuilt from user creds; supervisor backend repointed
uvicorn→`node /app/backend/bin/www`; backend `yarn install` re-run; Railway Mongo connected; Nomadly
LIVE-verified. Test buyer: `testbuyer1@example.com` / `TestPass12345`.

DONE:
1. **Login "nothing happens" — FIXED (frontend).** Root cause: `/sign-in` Login button gated by
   Formik `!(isValid && dirty)`; browser autofill never sets `dirty` → button stuck disabled →
   click did nothing. Fixed `frontend/src/pages/auth/SignIn.jsx` (ungated button; `attemptLogin()`
   reads live DOM values; autofill listeners+polling sync into Formik; Enter-key) and
   `frontend/src/pages/checkout/AccountGate.jsx` (submit reads live DOM values). Backend login = 200.
   ⚠️ NOT yet frontend-tested (need auto_frontend_testing_agent: typed + autofilled login + bad-cred
   error banner, on `/sign-in` AND `/checkout/account`).
2. **Nameserver vs bundled hosting — FIXED + BACKEND-VERIFIED 5/5.** Domain bought WITH hosting for
   the SAME domain now ignores the buyer's registrar/custom NS (→ `cloudflare`, `nameservers:[]`,
   item `ns_managed_by:"hosting"`), and a live-mode reconciliation pass points the domain NS at the
   hosting account's nameservers. Files: `backend/app/controllers/checkout/CheckoutController.js`
   (`priceItems` marking, `provisionItem` `opts.skipCustomNs`, `processOrder` reconciliation),
   `backend/app/models/Order.js` (`ns_managed_by`), `frontend/src/pages/checkout/CartPage.jsx`
   (hides NS picker → "Nameservers are managed by your hosting plan"),
   `frontend/src/utils/cartStore.js` (`toPayload` drops custom NS for bundled domains).
   ⚠️ CartPage NS UI change NOT yet frontend-tested.

### 🔜 NEXT TASK (user-requested) — "connect existing domain" end-to-end
**(a) Auto-point NS on addon attach (live mode).** When a buyer attaches an OWNED domain as an addon
to an existing hosting plan, automatically point that domain's nameservers at the hosting account's
nameservers — mirroring the bundled fix above — so the connected site actually works, not just gets
attached.

Already partially built:
- Backend `POST /api/v1/reseller/hosting/:user/addons` → `backend/app/controllers/reseller/resellerController.js`
  `addHostingAddon` (~L447) currently just forwards `nomadly.post('/hosting/:user/addons', body)`.
- Frontend `frontend/src/pages/HostingNomadly.jsx` Manage panel → "Addon domains" (`doAddAddon`).

Implement in `addHostingAddon`, after a successful LIVE attach:
1. Get hosting NS: `GET /hosting/:user` → `deliverables.nameservers` (or `/hosting/:user/credentials`
   → `nameservers`).
2. Owned in Nameword? `ownership.findOwnedDomain(userId, domain)`.
3. If owned + live + NS≥2 → `PUT /dns/:domain/nameservers { nameservers }` (FREE, live), best-effort
   try/catch. Mirror the CheckoutController reconciliation block ("point the domain at the HOSTING
   zone") + `provisionItem` skipCustomNs.
4. External (not owned) → don't write NS; return the hosting NS + UI note "set these NS at your
   registrar". Optionally show `GET /hosting/:user/domains/ns-status?domain=`.
5. dry_run → keep the current `test_mode` envelope (no-op). Ownership already enforced via
   `withOwnedHosting`.

Reseller contract: `POST /hosting/:user/addons {domain}`; `GET /hosting/:user`→deliverables.nameservers;
`PUT /dns/:domain/nameservers {nameservers:[>=2]}` (free); `POST /hosting/:user/domains/set-primary
{domain}` (400 needs_attach if not yet an addon); `GET /hosting/:user/domains/ns-status?domain=`.

Acceptance: live → owned addon's NS become hosting NS (verify via `GET /api/v1/reseller/domains`);
external → attach works + returns hosting NS + registrar note; dry_run → unchanged test_mode;
frontend Manage shows resulting NS/status after attach.

OPEN PRODUCT DECISIONS (ask user first):
1. Attach as **addon** only, or also allow **set-primary** (make it the plan's primary domain)?
2. **Nameword-owned** domains only (auto-point NS), or also **external** domains (user sets NS)?

Reseller is currently **dry_run** (`/api/v1/reseller/health` mode=dry_run) → live NS writes can't be
exercised here; assert the code branch + external-domain note instead.

---


## ✅ THIS SESSION (2025-07, fresh pod 8975b378) — Re-setup (same proven pattern)
- Fresh pod: both `.env` MISSING; backend `node_modules` present-but-EMPTY (0 entries → express not found on boot); frontend node_modules present; `.prod` present (prod build); supervisor reset to default `uvicorn server:app` template (WRONG — this is a NODE app).
- REAL current pod URL = `https://nameword-dev-9.preview.emergentagent.com` (from supervisor `preview_endpoint`). User's pasted `5c680fc7…` URL is STALE → kept only in CORS_ORIGIN (with real URL + localhost:3000). Used real URL for APP_URL/FRONTEND_URL/GOOGLE_REDIRECT_URL(`/auth/google/callback`)/GOOGLE_LINK_REDIRECT_URL(`/auth/google/link/callback`)/VITE_API_BASE_URL.
- Actions: recreated `/app/backend/.env` + `/app/frontend/.env`; ran `yarn install` in backend (804 pkgs, ~66s — node_modules was empty); rewrote `/etc/supervisor/conf.d/supervisord.conf` (backend cmd → `/bin/bash /app/backend/start.sh`, frontend cmd → `/bin/bash /app/frontend/start.sh`); reread+update+restart; re-seeded test users (`node scripts/seed_test_users.js`).
- REAL creds wired: DB_URI (Railway `nozomi.proxy.rlwy.net:54383/nameword`, live — connected), NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY (xkeysib-…), GOOGLE id/secret, DYNO_PAY_API_KEY (U2FsdGVkX1+…, quoted in .env due to +//= chars; DYNO_PAY_BASE_URL=https://dynopay.com/api). Set BOTH JWT_KEY + JWT_SECRET (auth.js uses JWT_SECRET). Re-added reward env (REWARD_POINT_VALUE=0.02, WALLET_TOPUP_REWARD_RATE=1, PURCHASE_BONUS_REWARD_RATE=0.5, WELCOME_BONUS_POINTS=250, REFERRAL_BONUS_POINTS=250). PLACEHOLDERS: mail SMTP, Telegram, WHM/cPanel, Plesk, Cloudflare, Telnyx, GCloud, CR/ConnectReseller, DYNO_PAY JWT/COMPANY/WEBHOOK.
- VERIFIED live: backend :8001 "connect to mongodb" + "Server is running on port 8001"; frontend :3000 HTTP 200 + landing renders (screenshot); `GET /api/v1/reseller/domains/search` real Nomadly ($39, OpenProvider); `POST /api/v1/auth/login` HTTP 200 for demo@nameword.local (Demo@12345) & buyer@nameword.local (Buyer@12345). Creds in `/app/memory/test_credentials.md`.
- EMAIL CAVEAT: MAIL_FROM_ADDRESS + BREVO_EMAIL = `hello@nameword.local` (NOT a verified Brevo sender) → OTP/verify/welcome/reset emails won't deliver until a verified sender is set. Soft email-gate → login/usage not blocked. Google OAuth completes only once `<pod>/auth/google/callback` is whitelisted in the Google console.


## ✅ THIS SESSION (2025-07) — Re-setup on fresh pod (same pattern as before)
- Fresh pod state: both `.env` MISSING, backend `node_modules` MISSING (frontend present), supervisor reset to the default `uvicorn server:app` template (wrong — this is a NODE app).
- Actions: recreated `/app/backend/.env` + `/app/frontend/.env` from user creds; `yarn install` backend (done in ~66s); edited `/etc/supervisor/conf.d/supervisord.conf` backend cmd → `/bin/bash /app/backend/start.sh` (node bin/www :8001) and frontend cmd → `/bin/bash /app/frontend/start.sh` (PROD build via `.prod`, vite preview :3000); reread+update+restart.
- REAL current pod URL = `https://nameword-dev-9.preview.emergentagent.com` (from supervisor APP_URL / preview_endpoint / HOSTNAME). User's pasted `5c680fc7…` URL is STALE → kept only in CORS_ORIGIN (plus real URL + localhost:3000). Used real URL for APP_URL/FRONTEND_URL/GOOGLE_REDIRECT_URL(`/auth/google/callback`)/GOOGLE_LINK_REDIRECT_URL(`/auth/google/link/callback`)/VITE_API_BASE_URL. Frontend talks same-origin so it works on any URL.
- REAL creds wired: DB_URI (Railway `nozomi.proxy.rlwy.net:54383/nameword`, live — connected), NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY (xkeysib-…), GOOGLE id/secret, DYNO_PAY_API_KEY (U2FsdGVkX1+…, DYNO_PAY_BASE_URL=https://dynopay.com/api). Set JWT_KEY + JWT_SECRET (auth.js uses JWT_SECRET). Re-added reward env (REWARD_POINT_VALUE=0.02, WALLET_TOPUP_REWARD_RATE=1, PURCHASE_BONUS_REWARD_RATE=0.5, WELCOME_BONUS_POINTS=250, REFERRAL_BONUS_POINTS=250). PLACEHOLDERS: mail SMTP, Telegram, WHM/cPanel, Plesk, Cloudflare, Telnyx, GCloud, CR/ConnectReseller, DYNO_PAY JWT/COMPANY/WEBHOOK.
- EMAIL CAVEAT: MAIL_FROM_ADDRESS + BREVO_EMAIL = `hello@nameword.local` (NOT a verified Brevo sender) → OTP/verify/welcome/reset emails won't deliver until a verified sender is set. Soft email-gate → login/usage not blocked.
- VERIFIED live: backend :8001 mongo connected + "Server is running on port 8001"; frontend prod build :3000 HTTP 200 + landing page renders (screenshot); `GET /api/v1/reseller/domains/search` real Nomadly ($39, OpenProvider); `/auth/google` 302 with pod redirect_uri + correct client_id; `POST /api/v1/auth/login` 200 for demo@ (Demo@12345) & buyer@ (Buyer@12345), re-seeded via `node scripts/seed_test_users.js`. Google OAuth completes once `<pod>/auth/google/callback` is whitelisted in the Google console.

## ✅ THIS SESSION (2026-09) — Re-setup on new pod + BRILLIANT DARK-MODE redesign (Phase 1-2)
- RE-SETUP: both `.env` missing, backend node_modules missing, supervisor reset to default uvicorn template. Recreated `/app/backend/.env` + `/app/frontend/.env` from user creds; `yarn install` backend; rewrote `/etc/supervisor/conf.d/supervisord.conf` (backend `bash start.sh` node bin/www :8001, frontend `bash start.sh` PROD build :3000). ACTUAL pod URL = `https://nameword-dev-9.preview.emergentagent.com` (user's pasted `5c680fc7…` is STALE → CORS only). REAL creds wired: DB_URI (Railway nozomi.proxy.rlwy.net:54383/nameword, live), NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY (xkeysib-…), GOOGLE id/secret (+ added the two required GOOGLE redirect URLs, missing from paste), DYNO_PAY_API_KEY. Reward env re-added. VERIFIED: health ok, mongo connected, login OK (buyer@/demo@). EMAIL CAVEAT: MAIL_FROM_ADDRESS/BREVO_EMAIL = hello@nameword.local (NOT a verified Brevo sender) → mail won't deliver until a verified sender is set.
- DESIGN (user: "make it brilliant/colorful like the reference dark mode"): chose HYBRID accent (indigo core + warm amber→pink for reward/hero moments). TOKEN-FIRST overhaul in `frontend/src/index.css`:
  - `html.dark` now redefines the neutral/surface/line/text/legacy-alias tokens → layered slightly-warm near-black (#09080d app, #14121c cards, translucent white borders) app-wide with legible text fallbacks; stray light-tint aliases → dark tints.
  - Ambient signature glow: new `.nw-app-bg` (applied to FrontLayout shell root) + `html.dark body` radial gradients (indigo→fuchsia→warm whisper). Public pages via body; authed via `.nw-app-bg`.
  - New utilities: `.nw-glass`, `.nw-stat`/`.nw-stat-glow`/`.nw-stat-glow-warm`, `.nw-grad-brand`/`.nw-grad-warm`, `.nw-grad-text`/`.nw-grad-text-warm`, `.nw-stat-chip`. Gradient+glow on primary buttons (`.nw-btn-primary`/`.btn-blue`/`.add-to-cart`/`.btn-sky`) in dark. Table row-hover + dark scrollbars. `.admin-card` hover lift+glow.
  - FLAGSHIP components upgraded: Wallet.jsx balance + reward-points cards → glowing gradient stat cards (indigo vs warm), gradient headline numbers; dashboard.jsx greeting name → gradient text, register panel → glow bloom.
  - VERIFIED live (screenshots) in DARK: dashboard, wallet, payment-history, account-setting, hosting, sign-in; LIGHT: wallet — all cohesive, no light-on-light regressions. Frontend is PROD build → `sudo supervisorctl restart frontend` to rebuild (~20s).
- PENDING polish (optional next): auth split-screen art, subtle count-up/reveal motion, deeper light-mode hero parity on secondary pages.

## ✅ THIS SESSION (2026-09) — Rollout complete + mobile pass (tested 100%)
- Rolled the glowing hero-card treatment across: Cart (CartSummary → `nw-stat-glow` + gradient Total; page title gradient), Orders (each order card → glow bloom + gradient "Charged"), VPS/RDP wallet chip → glow + gradient balance, and boosted shared `.nw-hero`/`.nw-hero-glow` in CSS so Domains/DNS/VPS/RDP/Pricing/SSL heroes all get a rich indigo→fuchsia→warm glow at once.
- Mobile pass: verified 390px — /dashboard + /wallet have NO horizontal scroll (scrollWidth==clientWidth==390); bottom tab bar intact; hero cards stack cleanly. (Domains hero shows a decorative `nw-hero-glow` box beyond the edge but it's inside an `overflow-hidden` hero + body `overflow-x:hidden` → no scrollbar.)
- auto_frontend_testing_agent: 100% PASS across /dashboard, /wallet, /payment-history, /orders, /domains, /dns-manager, /vps, /rdp, /account-setting in dark+light (desktop) and dark (mobile). No white screens, no JS errors, text legible, controls work, gradient text + 7 glowing hero cards present, dark body rgb(9,8,13).



## ✅ THIS SESSION (2026-06) — Crypto modal i18n + Wallet Top-Up Preview & full modal translation (verified)
- CRYPTO CHECKOUT MODAL (CryptoCheckoutModal.jsx + CryptoStatusTimeline.jsx): fully translated en/es/fr — all strings read from `t.admin.crypto` (+ `.timeline`) via a `tr()` helper with English fallbacks; complete `crypto` blocks added to all 3 locales. VERIFIED live in FR (header 'Payer en crypto', order summary 'RÉCAPITULATIF DE LA COMMANDE'/'Total à payer'/'Solde de votre portefeuille', paying intro, coin picker, network hint, 'Obtenir l'adresse de paiement', 'Propulsé par Dynopay') — no raw keys.
- WALLET TOP-UP MODAL (wallet-modal.jsx): (a) NEW Top-Up Preview card (data-testid=topup-preview) in the amount step — rows topup-preview-amount / topup-preview-current (from new `currentBalance` prop passed by Wallet.jsx) / topup-preview-new (=current+amount); math verified ($50 preset → new $100; typed 100 → new $150). (b) ENTIRE modal fully translated en/es/fr via a new `t.admin.topup` block (~48 keys: amount step, pay step, status labels, alerts) + `tr()` helper. VERIFIED live in ES ('Recargar billetera'/'RESUMEN DE LA RECARGA') and FR ('Recharger le portefeuille'/'Payer avec') — no raw keys.
- Locale files: added `admin.topup` block to en/es/fr (right after `admin.crypto`). Frontend is a Vite PROD build — ran `yarn build` + `sudo supervisorctl restart frontend`.
- Testing: testing_agent iteration_18 did a static locale review only (context limits) → confirmed no missing keys; main agent self-verified both modals in ES+FR via scripted browser + screenshots.


## ✅ THIS SESSION (2025-07) — Re-setup on fresh pod (Node backend + prod frontend)
- Fresh pod: both `.env` files missing, backend `node_modules` missing, supervisor reset to the default `uvicorn server:app` template (kept failing — this is a NODE app, not FastAPI).
- Actions: recreated `/app/backend/.env` + `/app/frontend/.env` from user creds; `yarn install` backend (804 pkgs, frontend node_modules already present); edited `/etc/supervisor/conf.d/supervisord.conf` backend cmd → `/bin/bash /app/backend/start.sh` (node bin/www :8001) and frontend cmd → `/bin/bash /app/frontend/start.sh`; created `/app/frontend/.prod` so the frontend serves a Vite **production build** (immune to Cloudflare 429 on preview).
- REAL current pod URL (platform-injected supervisor APP_URL) = `https://nameword-dev-9.preview.emergentagent.com`. User's pasted `5c680fc7…` URL is STALE → used only in CORS_ORIGIN. Used the real pod URL for APP_URL/FRONTEND_URL/GOOGLE_REDIRECT_URL(`/auth/google/callback`)/GOOGLE_LINK_REDIRECT_URL(`/auth/google/link/callback`)/VITE_API_BASE_URL. Frontend talks same-origin so it works on whatever URL routes to the pod.
- REAL creds wired: DB_URI (Railway external `nozomi.proxy.rlwy.net:54383/nameword`, live data — connected), NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY, GOOGLE id/secret, DYNO_PAY_API_KEY (services read this directly; DYNO_PAY_BASE_URL=https://dynopay.com/api). Re-added reward env (REWARD_POINT_VALUE=0.02, WALLET_TOPUP_REWARD_RATE=1, PURCHASE_BONUS_REWARD_RATE=0.5, WELCOME_BONUS_POINTS=250, REFERRAL_BONUS_POINTS=250) and the two GOOGLE redirect URLs (env.js requires both; not in the user's list).
- PLACEHOLDERS (features inert/test-mode until real creds given): mail SMTP host/user/pass, Telegram, WHM/cPanel, Plesk, Cloudflare, Telnyx, GCloud, CR/ConnectReseller, DYNO_PAY JWT/COMPANY/WEBHOOK.
- EMAIL CAVEAT: MAIL_FROM_ADDRESS + BREVO_EMAIL = `hello@nameword.local` (NOT a verified Brevo sender) → OTP/verify/welcome/reset emails likely won't deliver until a verified sender is restored. Soft email-gate means login/usage is not blocked.
- VERIFIED live: backend :8001 mongo connected; frontend :3000 prod build serving (HTTP 200, landing page renders); `GET /api/v1/reseller/domains/search?domain=…` real Nomadly ($39, OpenProvider); `/auth/google` 302 with pod redirect_uri + correct client_id; `POST /api/v1/auth/login` 200 for demo@nameword.local (re-seeded via `node scripts/seed_test_users.js`). Google OAuth completes only once `<pod>/auth/google/callback` is whitelisted in the Google console.


## ✅ THIS SESSION (2026-09) — cPanel FULL-PANEL MANAGEMENT (Modules 2-12, email excluded)
- Analysed https://1.speechcue.com/apidoc; the app previously only did hosting account lifecycle. Built the rest of the provider's cPanel surface (user asked for "everything except email").
- BACKEND (tested 47/47): ~55 ownership-scoped proxy routes under `/api/v1/reseller/hosting/:user/*` via a table-driven factory `hostingMgmt()` in `resellerController.js` reusing `withOwnedHosting()` + `forward()`. Covers MySQL (dbs/users/privileges/remote-hosts/phpmyadmin), subdomains(+bulk), domains(list/docroot/addon-delete/docroot-modes/set-primary/ns-status), ssl(+autossl), stats, File Manager (list/content/save/mkdir/rename/extract/compress/copy/move/delete/upload/upload-chunk[/cancel]), security (status, anti-red deploy+status, anti-bot[+rules], safe-browsing, blacklist, js-challenge, visitor-captcha), geo, analytics, account/site-status. NOT owned -> 403; owned in dry_run -> {mode:'dry_run',test_mode:true,note}. Also `GET /api/v1/reseller/renewals` (Module 12) computed from the buyer's OWN orders (provider /renewals spans the whole reseller account, so NOT proxied — avoids cross-customer leak). Route table registered in `routes/api/reseller.js` via a forEach loop (multi-segment, never shadows GET/DELETE /hosting/:user).
- FRONTEND (tested 20/20): hosting Manage modal now has an Overview / Advanced cPanel switch. New `components/hosting/CpanelTabs.jsx` = 9 tabs (Databases, Subdomains, Domains, SSL, Files, Security, Geo, Analytics, Site) driven by new `resellerAPI.hostingManage.*` in `api/reseller.js`. Each tab shows an amber Test-mode banner + empty state in dry_run and fires test-mode toasts on writes; goes fully live automatically once accounts are provisioned in live mode. Overview (upgrade/addons/captcha) preserved with original testids.
- Email module was intentionally NOT built (user choice).


## ✅ THIS SESSION (2026-09) — Re-setup on new pod + REMOVED failed-login lockout
- Pod reconciled: git working tree was empty (all files staged-deleted) → `git reset --hard HEAD` restored the repo; both `.env` files were missing and supervisor was reset to the default uvicorn/yarn template; backend+frontend node_modules missing.
- Actions: recreated `/app/backend/.env` + `/app/frontend/.env` from user creds; `yarn install` backend (804 pkgs) + frontend; rewrote `/etc/supervisor/conf.d/supervisord.conf` → backend `/bin/bash /app/backend/start.sh` (node bin/www :8001), frontend `/bin/bash /app/frontend/start.sh` (PROD build, vite preview :3000).
- REAL current pod URL (platform-injected supervisor APP_URL) = `https://nameword-dev-9.preview.emergentagent.com`; used for APP_URL/FRONTEND_URL/GOOGLE_REDIRECT_URL(`/auth/google/callback`)/GOOGLE_LINK_REDIRECT_URL(`/auth/google/link/callback`). User's pasted `5c680fc7…` URL is STALE → kept only in CORS_ORIGIN. Frontend uses same-origin (`window.location.origin/api/v1`) so it works on any URL.
- REAL creds wired: DB_URI (Railway external `nozomi.proxy.rlwy.net:54383/nameword`, live data — connected), NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY, GOOGLE id/secret, DYNO_PAY_API_KEY. Re-added reward env (REWARD_POINT_VALUE=0.02, WALLET_TOPUP_REWARD_RATE=1, PURCHASE_BONUS_REWARD_RATE=0.5, WELCOME_BONUS_POINTS=250, REFERRAL_BONUS_POINTS=250). PLACEHOLDERS: mail SMTP host/user/pass, Telegram, WHM/cPanel, Plesk, Cloudflare, Telnyx, GCloud, CR/ConnectReseller, DYNO_PAY JWT/COMPANY/WEBHOOK.
- EMAIL CAVEAT: MAIL_FROM_ADDRESS + BREVO_EMAIL set to user-pasted `hello@nameword.local` (NOT a verified Brevo sender) → OTP/verify/welcome/reset emails likely won't deliver until a verified sender (e.g. previously-verified `hi@nameword.com`) is restored. App uses a SOFT email-gate so login/usage is not blocked.
- VERIFIED live: backend :8001 mongo connected; frontend :3000 prod build; public SPA 200; `GET /api/v1/reseller/domains/search` real Nomadly ($39, OpenProvider); `/auth/google` 302 with pod redirect_uri; login OK for demo@/buyer@nameword.local (seeded via `node scripts/seed_test_users.js`).
- FEATURE — REMOVED ACCOUNT LOCKOUT (user request): `LoginController.login` no longer counts failed attempts or locks accounts. Wrong password → 400 "Invalid credentials"; correct password always logs in. Deleted lock pre-check, 5-attempt/1-hour lock + account_locked email, and on-success reset. Ran `scripts/unlock_accounts.js` (0 accounts were locked). Verified by testing agent 4/4 (7 wrong attempts never lock, correct password after = 200). The `/account/unlock` route + `unlockAccount` controller + `account_locked.html` are now dead code (left in place, harmless).


## ✅ DONE (2026-09) — Onboarding + Email redesign — (handoff: `/app/memory/ONBOARDING_EMAIL_HANDOFF.md`)
- Decisions: SOFT gate (login immediately + polished "Confirm your email" screen + persistent verify reminder, skippable); redesign ALL 32 email templates on one shared branded layout; add Welcome email; use current indigo brand logo from APP_URL.
- ✅ DONE (backend): fixed dead logo/asset host (was railway 404 → now `${APP_URL}/email-logo.png`, served 200); nunjucks GLOBALS in `app.js` (logoUrl/appUrl/brand/social/year); shared `views/mails/layout.html` + `views/mails/_components.html` (button/otp/details/note macros); ALL 32 templates rewritten + NEW `welcome.html` (all 33 render 0-error); Welcome email wired on first email verification in `VerificationController`.
- ✅ DONE (frontend, 2026-09, verified by testing agent 6/6): SOFT-GATE shipped. CreateAccount routes signup→/otp-code via `window.location.assign` (beats the UnprotectedRoute guest-guard race); `/otp-code` moved OUT of the guest-only guard and `IsEmailVerified` now allows an authenticated-but-unverified user (Router.jsx); OtpCode adds "Skip for now" (→/dashboard) + falls back to `user.email`; NEW app-wide `components/common/VerifyEmailBanner.jsx` mounted in FrontLayout shows only when `user && !isProfileVerified` with Enter code / Resend / dismiss (sessionStorage); i18n en/es/fr added.
- ✅ DONE (delivery, 2026-09): Brevo sender set to VERIFIED `hi@nameword.com` (BREVO_EMAIL + MAIL_FROM_ADDRESS + ADMIN_MAIL_ADDRESS in backend/.env); live test send returned a Brevo messageId — verification/OTP/welcome/reset emails now deliver. DELIVERY BLOCKER RESOLVED.


## ✅ THIS SESSION (2026-09) — Reward program overhaul (welcome + per-order bonus + referral)
- BACKEND (tested 100% by testing agent): new `app/services/rewards.js`. (1) WELCOME CREDIT: 250 pts (=$5) once per account at signup (email/google/telegram), idempotent via `user.welcomeBonusGranted`; existing 26 users BACKFILLED via `scripts/backfill_welcome_bonus.js`. (2) PER-ORDER BONUS: on every paid/partial checkout order, credit `round2(charged_usd*0.5)` pts (=1% back on cash paid, reason 'purchase_bonus'), idempotent via `order.bonus_granted`; stacks on the 2% funding earn. Wired in `CheckoutController.processOrder` after `recomputeOrderFinancials`. (3) REFERRAL: unique `user.referralCode`; signup accepts `body.referralCode` -> sets `referredBy` (self-referral blocked). On the referred friend's FIRST paid order, 250 pts to BOTH (reasons 'referral' + 'referral_friend'), idempotent via `user.referralRewarded`+`user.hasCompletedPaidOrder`. NEW GET `/api/v1/wallet/referral` -> {code, link=`<FRONTEND_URL>/create-account?ref=CODE`, referred_count, rewarded_count, points_per_referral, pending_count}. Models: User (+referralCode/referredBy/referralRewarded/welcomeBonusGranted/hasCompletedPaidOrder), Order (+order_bonus_points/bonus_granted), RewardPointLog (+reason). reward-points ledger now returns `reason`.
- env added (CRITICAL — were missing after re-setup, would have silently broken the 2%): REWARD_POINT_VALUE=0.02, WALLET_TOPUP_REWARD_RATE=1, PURCHASE_BONUS_REWARD_RATE=0.5, WELCOME_BONUS_POINTS=250, REFERRAL_BONUS_POINTS=250.
- FRONTEND (built, NOT yet auto-tested — pending user OK): `utils/referral.js` captures `?ref=` -> localStorage; CreateAccount sends `referralCode`; Google buttons (CreateAccount/AccountGate/SignIn) append `?ref=`; new `components/front-admin/billing/ReferralCard.jsx` on the Wallet page (#rewards) with copy-link + invited/rewarded stats (walletAPI.getReferralInfo); RewardHistory labels rows by reason (Welcome bonus / Referral reward / Referral welcome / Order bonus). Frontend is a PROD build — restart frontend to rebuild.


## ✅ THIS SESSION (2026-09) — Re-setup on new pod (empty .env + reset supervisor)
- Pod reconciled: both `.env` files were EMPTY and supervisor was reset to the default uvicorn/yarn template. Backend node_modules missing.
- Actions: `yarn install` backend (804 pkgs); rewrote `/app/backend/.env` + `/app/frontend/.env` from user creds; rewrote `/etc/supervisor/conf.d/supervisord.conf` (backend `bash start.sh` node bin/www :8001, frontend `bash start.sh` PROD build :3000).
- REAL current pod URL (platform-injected supervisor APP_URL) = `https://nameword-dev-9.preview.emergentagent.com`. User's pasted `5c680fc7…` URL is STALE → kept only in CORS_ORIGIN. Used real pod URL for APP_URL/FRONTEND_URL/GOOGLE_REDIRECT_URL(`/auth/google/callback`)/GOOGLE_LINK_REDIRECT_URL(`/auth/google/link/callback`)/VITE_API_BASE_URL.
- DB: used user's REAL Railway EXTERNAL Mongo `mongodb://mongo:***@nozomi.proxy.rlwy.net:54383/nameword?authSource=admin` (TCP open, live data). DynoPay: `DYNO_PAY_API_KEY` = user's "Dyno Pay api key" (services read DYNO_PAY_API_KEY directly; env.js only validates JWT/COMPANY/WEBHOOK which stay blank). REAL keys: NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY, GOOGLE id/secret, DYNO_PAY_API_KEY. PLACEHOLDERS: mail SMTP, Telegram, WHM, Plesk, Cloudflare, Telnyx, GCloud, CR/ConnectReseller.
- VERIFIED live: backend :8001 mongo connected; frontend :3000 prod build; public SPA 200; `GET /api/v1/reseller/domains/search` real Nomadly ($39, OpenProvider); `/auth/google` 302 with pod redirect_uri; login OK for demo@nameword.local (seeded via `node scripts/seed_test_users.js`). Google OAuth completes only once `<pod>/auth/google/callback` is whitelisted in Google console.


## ✅ THIS SESSION (2026-09) — Re-setup + checkout features + brand
- Re-setup after pod reconcile: wrote `/app/backend/.env` + `/app/frontend/.env` from user creds; `yarn install` backend (804 pkgs); rewrote supervisor (backend `bash start.sh` node bin/www :8001, frontend `bash start.sh` prod build :3000). App LIVE: Mongo connected, Nomadly domain search real ($39), VPS/RDP/hosting plans real, Google OAuth 302 with pod redirect URI. NEW real creds wired: Google client id/secret, Brevo API key, DYNO_PAY_API_KEY. Pod URL = https://nameword-dev-9.preview.emergentagent.com (pasted 5c680fc7 URL is stale — CORS only).
- FEATURE 1 "Checkout Entry": persistent sticky cart bar on VPS/RDP (`components/servers/ServersPage.jsx`, data-testid=server-cart-bar) opens mini-cart (crypto flow).
- FEATURE 2 "Paid Celebration": `components/cart/PaymentSuccessCelebration.jsx` (animated checkmark + confetti, reduced-motion aware; keyframes in `index.css`). Wired into `CryptoCheckoutModal.jsx` + `wallet-modal.jsx`.
- BRAND: user-facing "DynoPay" → "Dynopay" in modals + locale VALUES. Comment/log brand sweep via `\bDynoPay\b(?!-Webhook)` (kept identifiers `verifyDynoPaySignature`/`handleDynoPaymentWebhook`, locale KEYS, `DYNO_PAY_*`, and `X-DynoPay-Webhook-Id`).
- CONFETTI on order-success (`pages/checkout/OrderSuccess.jsx` via reusable `ConfettiBurst`, non-failed only, ~2.8s). CART PULSE: header `CartNavButton.jsx` gently pulses once on first-ever add (localStorage `nw_cart_pulsed`).
- REWARD BANNER on order-success (`components/checkout/RewardPointsBanner.jsx`, data-testid=reward-points-banner): real balance via `walletAPI.getRewardPointLogs()` + first-order detection via `checkoutAPI.listOrders()`; shows +earned points, balance (~$ value @ 0.02/pt), "Register another domain" CTA. Non-failed orders only.
- Verified: testing_agent iteration_16 = 100%; screenshots confirm order confetti (30 pieces) + cart pulse (flag None→1) + "Powered by Dynopay".


## ✅ APP RE-SETUP (2026-09) — LIVE on this pod
- Recreated `/app/backend/.env` + `/app/frontend/.env` from user-pasted credentials.
- Supervisor `/etc/supervisor/conf.d/supervisord.conf` was reset to the default uvicorn template on pod resume → **changed `backend` cmd to `/bin/bash /app/backend/start.sh` (node) and `frontend` cmd to `/bin/bash /app/frontend/start.sh` (prod build)**. Ran `yarn install` in backend (node_modules was missing).
- Pod URL used for APP_URL/FRONTEND_URL/GOOGLE redirects/VITE_API_BASE_URL = `https://nameword-dev-9.preview.emergentagent.com` (user's pasted `.env` had a stale `5c680fc7…` URL — kept in CORS_ORIGIN only).
- REAL secrets in use: DB_URI (Railway external `nozomi.proxy.rlwy.net:54383/nameword`, live data), NOMADLY_API_KEY (rsk_live_…), BREVO_API_KEY, GOOGLE client id/secret, DYNO_PAY_JWT_TOKEN. PLACEHOLDERS: mail SMTP, Telegram, WHM/cPanel, Plesk, Cloudflare, Telnyx, GCloud, DYNO_PAY_COMPANY_ID/WEBHOOK_SECRET, CR/ConnectReseller.
- Verified: backend on 8001 (mongo connected), frontend on 3000 (prod build), public SPA 200, `/api/v1/domain/search` 200 (real Nomadly), `/auth/google` 302→Google, login OK for demo@/buyer@nameword.local.
- Google OAuth will only complete if `…/auth/google/callback` is whitelisted in the Google Cloud console for this client id.


## ✅ DONE (2026-06, re-verified 2026-09) — Remove "Private Email" product + cPanel copy (details: `/app/memory/REMOVE_EMAIL_TASK.md`)
Status: **DONE** (verified in current code 2026-09). Email.jsx deleted; no `/email` route/import; no product email link in nav/footer/command-palette/landing grid; cPanel copy = "7 days or monthly" (EN) / "7 días o mensual" (ES) / "7 jours ou mensuel" (FR) on the landing card + the "Paid from your wallet" hosting feature copy. The only remaining "Private Email" text is a DEAD, unreferenced top-level `email: {}` marketing block in the site locales (intentionally left; removing accented FR/ES is risky for zero benefit).

## ✅ Landing Page Re-Image — COMPLETE (2026-06, tested 100%)
- User choices: AI-generated cinematic imagery (indigo/obsidian palette, abstract tech + privacy motifs, no faces, no padlocks); keep animated HeroShowcase panel over image + gradient.
- Imagery: 12 custom images generated (Gemini image model), converted to web-optimised WebP in `frontend/public/img/landing/` (hero, map, security, cta, rewards, domains, dns, hosting, vps, rdp, email, api; ~600 KB total). Paths in `components/home/landing/images.js`. Hero preloaded via `<link rel=preload>` in index.html.
- Code: `components/home/HomeRedesign.jsx` now only composes sections from `components/home/landing/`: Hero (image "stage" behind HeroShowcase, `onDark` prop added to HeroShowcase; floaters repositioned bottom-left / top-right above tabs), TrustBar (hairline grid w/ icons), Products (6 image cards + wide API card w/ curl chip; DNS card gated to /sign-in when logged out), WhyNameword (map slab + numbered editorial list), HowItWorks (dashed connector + big faded numerals), PricingTeaser (8 TLD cards on grid bg), SecurityBand (full-bleed dark image band + glass checklist), RewardsBand (copy + perks + blended image), FinalCta (image panel + glass DomainSearchForm + create-account link). Shared: `DomainSearchForm.jsx`, `Reveal.jsx` (motion whileInView).
- Section order per plan: Hero → Trust → Products → Why → How → Pricing → Security → Rewards → CTA → Footer. Copy/i18n strings unchanged (EN/ES/FR keep working). All interactive elements have data-testids (see `/app/test_reports/iteration_2.json` context field).
- Tested: `/app/test_reports/iteration_2.json` — frontend 100%: images, navigation, inline search (real reseller API), dark mode, 390/768 responsive (no overflow), reveal animations. Legacy `components/home/{claim-online,domain-extend-launch,how-it-works,our-clients,points-banner,pricing-plans,security-beyond,domain-search-section}.jsx` are unused leftovers (safe to delete later).
- Frontend served as PROD build (`/app/frontend/.prod` present → `yarn build && vite preview`); after code changes run `sudo supervisorctl restart frontend` (~30s) to rebuild.

## NEXT (from backlog)
- ✅ DONE 2026-09: Verify Brevo sender (outbound email) — sender `hi@nameword.com` verified, live send returns messageId.
- P1 Google OAuth redirect whitelisting for pod URL, P1 DynoPay top-up smoke test, P2 backend health sweep.

## 🎨 (superseded) "Keyhole N" Logo Redesign — COMPLETE (see section at bottom)
- User selected Concept 2 "Keyhole N". Full spec, file map, code snippets, raster steps and verification checklist are in **`/app/memory/LOGO_IMPLEMENTATION.md`** — the next agent should read that first and execute it end-to-end.
- Progress so far: only `/app/frontend/src/assets/logo/favicon.svg` has been replaced with the new Keyhole-N mark. Everything else (lockups, BrandLogo component, component wire-ups, favicon PNGs, OG image, email `logo.png`, index.html) is PENDING.
- Palette: indigo `#4F46E5` badge, slate `#0F172A` wordmark (light), `#F8FAFC` wordmark (dark). Flat only — no gradients/3D/padlock/cloud. Badge stays indigo in dark mode (do NOT reuse the `.dark .dark-mode { filter: brightness(100) }` hack on it).


## ⚠️ PROVIDER CLARIFICATION (2026-06, from user) — READ FIRST
- ALL products — Domains, DNS, Hosting (cPanel), VPS, RDP — are served by the **Nomadly reseller API** (`NOMADLY_API_KEY = rsk_live_...` in `/app/backend/.env`).
- **HostBay is NOT used.** Ignore HostBay-based hosting flows in `HostingPlansController.js` / `hostbay/mapping.js` — the live hosting/domain/VPS/RDP data must come from the Nomadly reseller endpoints (`/api/v1/reseller/*`, see `frontend/src/api/reseller.js`).
- Implication for the pending UI work (7/30-day "Anti-Red" cPanel buckets, CAPTCHA toggle, strictly-monthly VPS/RDP): wire hosting plans to the Nomadly reseller API, not HostBay. Confirm the reseller hosting/cPanel plan endpoint + fields before bucketing.


## Original Problem Statement
Extract and set up the app from https://github.com/Moxxcompany/NamewordProductionfixing on the Emergent pod using a provided `.env`, run it live, and identify + report dead credentials.

## Architecture (running in this pod)
- **Backend**: Node.js + Express + MongoDB (Mongoose), listens on port 8001 (supervisor `node bin/www`, dir `/app/backend`)
- **Frontend**: React 19 + Vite 7 + Tailwind v4, Vite dev server on port 3000 (`yarn dev --host 0.0.0.0 --port 3000`)
- **DB**: local MongoDB `mongodb://localhost:27017/nameword` (Railway `DB_URI` is `*.railway.internal`, unreachable outside Railway)
- **Ingress**: `/api/*` -> backend 8001, everything else -> frontend 3000. Frontend calls `VITE_API_BASE_URL + /api/v1`.
- Preview URL: https://nameword-dev-9.preview.emergentagent.com

## ⚠️ CRITICAL SECURITY FINDING — Malware removed
4 source files contained an injected, obfuscated self-executing payload (blockchain-based C2 "dead-drop resolver" that calls TronGrid for wallet `TMfKQEd7TJJa5xNZJZ2Lep838vrzrs7mAP` to fetch attacker-controlled next-stage commands):
- `backend/routes/index.js`
- `backend/routes/api/auth.js`
- `backend/routes/client.js`
- `backend/client/postcss.config.js`
The malware was stripped (legit code preserved). **All pasted credentials must be treated as COMPROMISED and rotated** — the same payload runs in the Railway production deployment.

## What was done (2026)
- Cloned repo, detected full-stack (backend + frontend), Node.js.
- Analyzed & removed injected malware from 4 files (verified clean).
- Configured `/app/backend/.env` and `/app/frontend/.env`, adapted URLs to pod, DB -> local Mongo.
- Removed `packageManager` (Corepack) field to install with classic yarn; installed backend + frontend deps.
- Rewrote supervisor to run Node backend (8001) + Vite frontend (3000). Seeded DB (tiers, badges, VPS/RDP/cPanel plans, OS, SSH-Admin).
- App verified live: homepage, /sign-in SPA route, backend `/api/v1` routing, Mongo connected.
- Live-tested all external credentials (see Credential Audit below).

## Credential Audit (live-tested)
ALIVE: Cloudflare (global key), Telegram bot (@BozznameStagingBot), APILayer Tax, Google OAuth (client id+secret), Sentry DSN, Zapier webhook.
DEAD: Brevo/SMTP (key not enabled) -> email broken; Twilio (auth token invalid); Telnyx (key not found) -> mobile OTP broken; OpenProvider (auth failed); ConnectReseller (APIKey invalid); FastForex (no active subscription/403); Google Service Account service-account.json (Invalid JWT Signature).
DEAD/UNREACHABLE (DNS NXDOMAIN, confirmed via Google+Cloudflare DoH): HostBay `api.hostbay.io`; DynoPay `api.dynopay.com` (JWT valid to 2027 but base URL dead + real host returns "Application not found" for company_id 39); WHM `*.privatehoster.cc`; Plesk `*.privatehost.su`.
EMPTY/not configured: UPCLOUD_USERNAME/PASSWORD, WHM_PASSWORD, GOOGLE_CLOUD_PROJECT_ID, GOOGLE_PROJECT_ID.

## Impact of dead credentials on flows
- Email verification / password reset: BROKEN (Brevo dead).
- Mobile OTP: BROKEN (Telnyx dead; Twilio fallback also dead).
- Domain search/register/transfer: BROKEN (OpenProvider + ConnectReseller + HostBay all dead).
- Payments / wallet top-up: BROKEN (DynoPay endpoint dead).
- Currency conversion: falls back to 1:1 (FastForex dead).
- Working: Google login (needs redirect-URI whitelisting for pod), Telegram login, Cloudflare DNS ops, tax rates, Sentry, Zapier.

## Re-setup (2026-09-08) — new MongoDB
- Pod was reconciled: both `.env` files wiped, backend `node_modules` gone, supervisor reset to default (uvicorn) template.
- Original integration credentials were NOT in git (gitignored) → permanently unrecoverable.
- Re-created `/app/backend/.env` with: user-provided Railway MongoDB (`nozomi.proxy.rlwy.net:54383/nameword?authSource=admin`),
  freshly generated APP_KEY / JWT_KEY / ADMIN_REGISTER_TOKEN, and valid-format PLACEHOLDERS for every third-party key.
- Re-created `/app/frontend/.env` (VITE_API_BASE_URL -> pod preview URL, VITE_API_KEY placeholder, chat off).
- `yarn install` (backend), rewrote supervisor: backend `bash start.sh` (node bin/www, port 8001), frontend `yarn dev` (vite 3000).
- Seeded the new (empty) Mongo successfully. App verified live: homepage renders, `/api/v1/*` routes 200, Mongo connected.
- STILL non-functional (placeholder keys): email/Brevo, Telnyx OTP, OpenProvider/ConnectReseller/HostBay domains,
  DynoPay payments, Google OAuth, Cloudflare. Provide real keys to restore these flows.

## Backlog / Next Steps
- P0: Rotate ALL credentials (repo was backdoored).
- P0: Replace dead keys (Brevo, Telnyx, OpenProvider, ConnectReseller, DynoPay base URL, Google service account, FastForex) to restore flows.
- P1: Whitelist pod Google OAuth redirect URIs in Google Cloud Console.
- P2: Import production data from Railway Mongo if needed.


## Re-setup (current session) — env from user
- Recreated `/app/backend/.env` and `/app/frontend/.env` from user-provided creds.
- URL vars (APP_URL/FRONTEND_URL/CORS/GOOGLE redirects/VITE_API_BASE_URL) were pointed to the ACTUAL pod preview URL `https://nameword-dev-9.preview.emergentagent.com` (user's .env had a stale `5c680fc7-...` URL that doesn't map to this pod).
- DB_URI: user's Railway proxy Mongo (`nozomi.proxy.rlwy.net:54383/nameword`) — reachable & already seeded (plans/tiers/badges/1 admin). NOT re-seeded.
- NOMADLY_API_KEY is REAL/LIVE (`rsk_live_...`) → reseller health ok, account wallet $5, upstream dry_run.
- `yarn install` (backend); supervisor rewritten: backend `bash start.sh` (node bin/www :8001), frontend `yarn dev` (vite :3000). Both RUNNING; homepage renders live; Mongo connected.
- Still placeholder (non-functional): Google OAuth, Brevo email, Telnyx OTP, ConnectReseller/WHM/Plesk/Cloudflare, DynoPay, GCloud, Telegram.

## Re-setup (current run) — new creds provided by user
- Pod preview URL is now `https://nameword-dev-9.preview.emergentagent.com` (user's pasted `5c680fc7-...` URL was stale → all URL configs use the live pod URL).
- `/app/backend/.env` written from user creds. REAL: `DB_URI` (Railway public proxy `nozomi.proxy.rlwy.net:54383/nameword`, reachable + already seeded), `NOMADLY_API_KEY` (rsk_live_...), generated APP_KEY/JWT_KEY/ADMIN_REGISTER_TOKEN. All other 3rd-party keys are PLACEHOLDERS.
- `/app/frontend/.env`: `VITE_API_BASE_URL` -> live pod URL; VITE_API_KEY placeholder (non-blocking); chat off.
- Supervisor rewritten: backend `bash /app/backend/start.sh` (node bin/www on 8001), frontend `yarn dev` (vite on 3000). Backend `yarn install` done (804 pkgs); frontend node_modules already present.
- VERIFIED LIVE: backend connected to Mongo + listening on 8001; Nomadly reseller API real & working (`/reseller/health`, `/reseller/domains/search?domain=...` returns real availability/pricing, `/reseller/vps/plans` real); frontend homepage renders.
- Railway `nameword` DB already seeded (37 collections: badges=9, vpsplans=4, cpanelplans=9, tiers, discounts...); users=0. No re-seed performed.
- Placeholder-driven flows still non-functional: email/OTP, Google login, ConnectReseller/WHM/Plesk/Cloudflare, DynoPay payments, Telegram.


## UI/UX Redesign — Phase 1 (Option A: "Trust indigo + warm neutral")
- Decisions from user: BUILD the redesign; Visual = Option A; feature SSL/Email as first-class; mobile = hybrid (bottom-drawer + top destinations).
- Design system: added Option A tokens to `frontend/src/index.css` (@theme): brand/indigo scale, ink, surface, line, accent(amber), success(teal); remapped `darkbtn` -> indigo (#4f46e5) so all buttons app-wide shift cohesively. Added `@layer components` nw-* utilities (nw-container/section/eyebrow/h2/lead/btn-*/card/input/badge-*/chip/link).
  - GOTCHA fixed: appended @layer block had nested inside `.content-section ul {}` (missing close brace) -> classes became descendant selectors and didn't apply; also Tailwind v4 forbids `@apply nw-btn` (component-in-component) -> inlined base utilities. Both fixed; verified computed styles (nw-container maxWidth 1280px, btn bg indigo, eyebrow pill).
- Rebuilt marketing shell: `components/layout/Navbar.jsx` (sticky blur header, Products mega-menu incl SSL/Email, lang+theme+auth, mobile drawer), `components/layout/Footer.jsx` (full sitemap), new `components/home/HomeRedesign.jsx` (Hero+search, TrustBar, Products grid, transparent TLD Pricing w/ sale+renewal, 3 steps, Security, Rewards band, Final CTA), `pages/HomePage.jsx` uses MainLayout fluid. `layouts/MainLayout.jsx` got `fluid` prop.
- Verified DESKTOP light + dark look great. Mobile NOT yet verified (screenshot tool locks 1920px) -> needs frontend testing agent.
- NEXT (not built): Phase 2 = authed app shell (persistent sidebar ~256px collapsible to icon rail + topbar w/ global search + Cmd/K + wallet/notif/account) applied to dashboard; then per-screen redesigns (domains, DNS, hosting, VPS, RDP, billing/wallet, account, admin). Images used: hero unsplash 1653549893012, security unsplash 1660732106134 (a Wise-branded 3D graphic — consider swapping later).

## Redesign — increment 2 (SSL + Email first-class pages)
- Swapped homepage security image to clean unbranded padlock (unsplash 1555529902-5261145633bf).
- New reusable marketing kit: `components/marketing/marketing-ui.jsx` (ProductHero, SectionHeading, FeatureGrid, PricingTiers, Steps, Faq, CtaBand) — for all future marketing pages.
- New pages `pages/Ssl.jsx` (/ssl) and `pages/Email.jsx` (/email) built with the kit + MainLayout(fluid): hero + features + pricing tiers + steps/FAQ + CTA. Images: SSL padlock, Email envelope (unsplash 1567473030492-533b30c5494c).
- Routes added in `routes/Router.jsx`; nav mega-menu, footer, and homepage product cards now link SSL->/ssl, Email->/email (were pointing to /hosting).
- Verified desktop light. Lint clean.
- STILL TODO: restyle existing product pages (Domain/Hosting/VPS/RDP via ServersPage & Hosting.jsx) to Option A; Pricing/Transfer/Contact/FAQ/legal; then the authed app shell (sidebar+topbar+dashboard) and per-screen app redesigns.

## Redesign — increment 3 (App Shell for signed-in area) — IN PROGRESS
- Built modern authed shell in `layouts/FrontLayout.jsx`: slim collapsible ICON RAIL (`components/front-admin/admin-common/AppRail.jsx`; Overview/Domains/Hosting/VPS/RDP/Billing/Settings + Help; collapse persisted in localStorage `nw_sidebar_collapsed`) + existing contextual `<Sidebar/>` kept as the 280px secondary panel (preserves domain/hosting switching). Top bar: global search button that opens Command Palette, wallet balance chip (walletAPI.getWallet -> data.balance.USD), reward-points chip (user.rewardPoints), notifications bell (empty-state, no backend), language + theme + cart + UserDropdownMenu. Mobile: slide-in drawer (rail + Sidebar) + fixed bottom tab bar (Home/Domains/Hosting/Wallet/Account).
- New `components/common/CommandPalette.jsx`: Cmd/Ctrl+K launcher, keyboard nav (arrows/enter/esc), fuzzy filter over destinations + quick actions.
- Restyled sidebar link active/hover to brand palette in index.css; added `.app-rail-item(.-active)` and `.header-icon-btn` utilities.
- Dashboard unchanged content-wise; now sits inside the new shell.
- VERIFICATION: lint clean on all new files. Login verified via API (POST /api/v1/auth/login returns token). Seeded demo user for testing: demo@nameword.local / Demo@12345 (see test_credentials.md; re-seed via /app/backend/tmp_seed_user.js). Full IN-BROWSER visual verification of the authed shell was NOT completed this session — the screenshot tool struggled to log in because the SignIn form renders duplicate email/password inputs (hidden + visible) and the tool locks viewport to 1920. Recommend verifying by logging in with the demo creds, or via auto_frontend_testing_agent.
- STILL PENDING from user's 3-item request (only App Shell tackled this session):
  1) Product Pages restyle to Option A: Domains (/domain, /home results), Hosting (Hosting.jsx), VPS/RDP (components/servers/ServersPage.jsx). NOT started.
  2) Pricing page: dedicated /pricing with full per-TLD table + hosting/VPS/RDP tiers + monthly/annual savings toggle. NOT started (homepage has a TLD pricing SECTION only).

## Re-setup (2026-09-08) — pod reconciled again, re-provisioned by user creds
- Pod had been reconciled: both `.env` wiped, backend `node_modules` gone, supervisor reset to default uvicorn template, frontend in BACKOFF (`yarn start` doesn't exist; script is `dev`).
- ACTUAL pod preview URL = `https://nameword-dev-9.preview.emergentagent.com` (from env `preview_endpoint`/HOSTNAME). User's pasted `5c680fc7-...` URL is STALE → all URL vars (APP_URL/FRONTEND_URL/CORS/GOOGLE redirects/VITE_API_BASE_URL) point to the live 2b950aee pod URL.
- Rewrote `/app/backend/.env` from user creds (PORT=8001). REAL: DB_URI (Railway proxy nozomi.proxy.rlwy.net:54383/nameword, reachable+seeded), NOMADLY_API_KEY (rsk_live_...), generated APP_KEY/JWT_KEY/ADMIN_REGISTER_TOKEN. All other 3rd-party keys = PLACEHOLDERS. Confirmed all envalid-required vars in start/env.js are satisfied.
- Rewrote `/app/frontend/.env` (VITE_API_BASE_URL -> pod URL, VITE_API_KEY placeholder, VITE_SHOW_CHAT=false, VITE_TELEGRAM_BOT_NAME, VITE_REWARD_POINT_VALUE=0.02).
- `yarn install` backend (ok). Rewrote supervisor: backend `bash /app/backend/start.sh` (node bin/www :8001), frontend `yarn dev --host 0.0.0.0 --port 3000`. Both RUNNING.
- VERIFIED LIVE: Mongo connected; /api/v1/reseller/health ok (dry_run), /account wallet $5, /domains/search real (coolstartup2026.com available $39); frontend homepage (Option A redesign) renders 200.
- Placeholder-driven flows still non-functional: Google OAuth, Brevo email, Telnyx OTP, ConnectReseller/WHM/Plesk/Cloudflare, DynoPay payments, Telegram, GCloud.

## Redesign — increment 4 (Product/Management pages -> Option A) — DONE
- VPS/RDP (`components/servers/ServersPage.jsx`): branded gradient hero (eyebrow pill, chips, wallet chip, brand-focus region select); plan cards -> `nw-card nw-card-hover` with brand-50 zap badge, brand Spec icons, `nw-btn-primary nw-btn-sm` Deploy; empty/skeleton states + deploy modal inputs -> brand focus + `border-line`. Verified live: 6 plan cards render (Cloud VPS 10-60, $18-$288/mo), dry-run banner, indigo buttons.
- Hosting (`pages/Hosting.jsx`): replaced old beige `search-section`/`tab-link` shell with branded hero (eyebrow WEB HOSTING + chips), Option A segmented monthly/annual toggle (indigo active + amber savings badge), 6-card brand value-props grid; kept plan-fetch + cart-sidebar logic. `monthly/annual-billing-plan.jsx`: price accent teal->brand, empty state -> dashed `border-line` card. Verified live (providers dead -> branded "not available" empty state shows).
- Domains (`/domain`, `/home`): restyled SHARED index.css classes so both pages shift at once — `.search-section` beige->brand-50 gradient, `.search-input` -> rounded-xl + brand focus ring, `.btn-blue`/`.add-to-cart`/`.btn-outline` -> brand + rounded-xl, `.btn-teal` -> teal success pill, `.btn-sky` -> brand pill, `.price-tag` teal->brand, `.tablist` pills -> rounded-full brand-active, `.domain-card`/`.hosting-plan-card` -> rounded-2xl + `border-line` + hover lift, `.plan-price` -> brand. Verified live: result cards, "Find more options" tabs, bottom cart bar all Option A.
- Lint clean on all changed JS. Frontend hot-reloaded (CSS/JSX). NOTE: screenshot tool needs a poll-until-`.animate-pulse`-gone loop for the reseller pages (upstream latency + StrictMode reflicker).
- STILL PENDING (future): /pricing page; authed app-shell per-screen redesigns (DNS, Billing/Wallet, Account/Settings, Admin); mobile QA of authed shell.

## Increment 5 — Live Domain Search (DONE, verified live)
- Backend: added GET /api/v1/reseller/domains/suggest (controller suggestDomains + route). Takes ?domain=/keyword, derives base label, checks it across 12 curated TLDs (com,net,org,io,co,ai,app,dev,xyz,online,shop,store) via parallel Promise.allSettled to Nomadly /domains/search; returns {keyword,count,suggestions:[{domain,available,price_usd,registrar}]}. Node load-check + curl verified (real prices).
- Frontend: repointed hooks to reseller (real data). `useDomainSearch.searchDomain` -> resellerAPI.searchDomain, maps available->{query,registrationFee=price_usd,renewalfee,registrar} (null when taken -> "Domain Taken" card). `getTldSuggestions` -> resellerAPI.suggestDomains, maps available & !=exact -> [{websiteName,registrationFee,...}]. `useDomainSuggestions.getSuggestions` -> suggest (typeahead). Added `resellerAPI.suggestDomains`.
- VERIFIED live at /domain?value=coolstartup2027app.com: exact card $39, .net $51 package, grid with real prices (.io $244, .ai $709, etc). Cart add still guest/dry-run (registrar checkout not wired — expected).

## Increment 6 — Pricing page + authed Option A token remap (DONE)
- New `pages/Pricing.jsx` at /pricing (nav "Pricing" repointed from /#pricing). Hero + live per-TLD table (suggestDomains with random available label, filters price>0) + monthly/annual toggle (annual = monthly*10 = "2 months free", shows per-mo + billed-yearly note) driving Hosting (static reps) + live VPS + live RDP tiers (via resellerAPI.getVpsPlans/getRdpPlans EU, top 3) + CtaBand. Route added in Router.jsx. Verified live (table shows real .shop $30/.store $160; VPS/RDP annual tiers render).
- AUTHED APP-SHELL COHESION via token remap in index.css @theme (recolors ALL legacy usages app-wide in one shot): tealdark #16979a->#4f46e5(brand), teal-hover->brand-700, teallight/-50->brand-50, skydark #3EBFD8->brand, beige #f7f4ec->#f8fafc(surface-2), beige-200->brand-50, active-border #5c5776->#cbd5e1. This flips teal/beige/sky accents across dashboard, account-settings, wallet, DNS, billing, websites, domain pages to indigo without editing 60+ component files. Verified: /account-setting (API Keys) fully indigo/clean.
- PENDING: broad authed + MOBILE verification delegated to auto_frontend_testing_agent (demo@nameword.local / Demo@12345). Note: /wallet and /dns-management depend on wallet/domain data the demo user lacks (may redirect/blank) — needs a user with domains for full check.

## Increment 7 — Mobile polish (DONE / verified where possible)
- Frontend testing agent Part A confirmed all signed-in pages (/dashboard, /account-setting, /account-information, /wallet, /subscriptions, /payment-history, /dns-management, /domain-portfolio) render with NO teal/cyan and NO cream/beige — Option A cohesion achieved app-wide via the @theme token remap.
- FIXED public mobile horizontal overflow (decorative hero blur circles): added `overflow-x: hidden` to body in index.css. Re-test CONFIRMED at real 390x844: /, /hosting, /vps all scrollWidth==clientWidth==390 (no overflow).
- Authed mobile nav is implemented in layouts/FrontLayout.jsx (verified in code): fixed bottom tab bar (Home/Domains/Hosting/Wallet/Account, `xl:hidden`), top-left hamburger opening a left slide-in drawer (AppRail + Sidebar), desktop icon-rail `hidden xl:flex`, contextual 280px panel `hidden xl:block`. Tablet (<1280) intentionally uses the hamburger drawer + bottom bar pattern. NOTE: automated agent could NOT log in to visually confirm authed mobile nav due to Cloudflare bot-protection 429 on the preview — recommend a quick manual check on a phone/narrow window.
- NOTE: /pricing fires 3 reseller calls on mount (suggest = 12 upstream lookups + vps + rdp plans); renders fine for real users (screenshot-verified) but can time out under automated hammering/Cloudflare 429. Optional future: cache suggest server-side.
- Screenshot tool CANNOT emulate mobile (locks 1920) — use auto_frontend_testing_agent for responsive checks.

---

## Changelog / Session Log (latest first)

### Reward-points model overhaul + direct crypto-order checkout (2026-06) — backend verified via curl; FULL UI FLOW NOT YET E2E-TESTED
User rules: (1) earn reward points ONLY when paying with crypto (crypto top-up OR direct crypto order); paying an order from wallet balance earns nothing; (2) auto-redeem available points on every order (max, up to 100%); pay the remainder via crypto or wallet; (3) build a TRUE crypto-direct-order flow that bypasses the wallet.
- **Earn removed from orders**: `recomputeOrderFinancials` no longer grants purchase points (leaves `points_earned` untouched); `renewItem` no longer earns on renewal. Failed-item point REFUNDS (restoring redeemed points) are unchanged.
- **Auto-redeem**: `quote` + `createOrder` now always call `computeRedemption(pointsBalance, pointsBalance, subtotal)` → max points auto-applied. Frontend no longer sends `redeem_points`; CartPage shows points as auto-applied (slider removed), MiniCartDrawer shows a "Reward points applied − $X" line.
- **Direct crypto order (NEW)**: `Order` model gained `payment_method` (wallet|crypto), `payment_status` (paid|awaiting_payment|expired|failed), `crypto` subdoc {paymentId,address,destinationTag,currency,cryptoAmount,amountUsd,qrCode,status,txHash,expireAt}; `status`/`provisioning` enums gained `awaiting_payment` (so the provisioning safety-net cron ignores unpaid crypto orders). New `POST /checkout/orders/crypto` (`createCryptoOrder`) auto-redeems, bills the remainder via `createCryptoPayment` (reuses DynoPay), burns held points, and returns {order, payment:{address,tag,qr,amount…}}. If points fully cover it → provisions immediately (`fully_covered`). New `GET /checkout/orders/:id/crypto-status` (`getCryptoOrderStatus`) polls DynoPay; on confirmation earns points on the crypto paid via `addWalletTopupRewardPoints(charged_usd)`, sets provisioning=pending, provisions; on expiry/fail refunds the held redeemed points. WalletController now exports `addWalletTopupRewardPoints` + `getWalletTopupRewardRate`.
- **Frontend**: new `components/cart/CryptoCheckoutModal.jsx` (coin picker → generate address → QR + address + destination-tag block + auto-poll → onSuccess navigates to order success). Wired into CartPage ("Pay with crypto" opens the modal, direct order) and MiniCartDrawer (replaces the old top-up-then-pay). `checkoutAPI.createCryptoOrder` + `cryptoOrderStatus` added.
- VERIFIED (curl): `POST /checkout/orders/crypto` (demo, BTC, $39 domain) → success, real address `bc1q…`, `0.00050793 BTC`, charged_usd 39, order awaiting_payment; `crypto-status` → pending. Frontend build compiles clean + restarted. NOT YET DONE: end-to-end UI test of the modal/flow and a simulated paid confirmation (needs testing_agent or a mocked payment). NOTE: buyer@nameword.local has ~2226 pts which auto-cover small orders (fully_covered path) — use demo@ (0 pts) to exercise the crypto charge.


### Reward points history on the Wallet page (2026-06) — DONE, verified (backend + frontend)
- **Problem (user)**: the wallet showed the reward-points *balance* but no *history* of how points were earned/spent, even though a `RewardPointLog` ledger already existed in the DB (credit on wallet top-up + on order spend; debit on checkout redemption).
- **Backend**: new `GET /api/v1/wallet/reward-points` (`WalletController.listRewardPointLogs`) → last 30 `RewardPointLog` entries `{id, points, operationType, expiryDate, createdAt}` + current `balance` (Decimal128 safely coerced to Number). Route added in `routes/api/wallet.js` (behind `sessionOrApiKey`).
- **Frontend**: new `components/front-admin/billing/RewardHistory.jsx` (mirrors TopupHistory) — each row: gift icon + "Earned" (green +N pts) for credits / up-arrow + "Redeemed" (amber −N pts) for debits, with date; empty state; refreshes on the `wallet:updated` event. `walletAPI.getRewardPointLogs()` + `ENDPOINTS.WALLET.REWARD_POINTS`. Rendered on `Wallet.jsx` under the crypto top-up history. Also added `id="rewards"` to the Reward Points card so the top-bar/rail `/wallet#rewards` link scrolls to it. i18n `admin.rewardHistory` in EN/ES/FR.
- VERIFIED: `GET /wallet/reward-points` returns 27 entries + balance 2187.2 for buyer; UI shows 27 rows with correct green "+39 pts"/"+0.20 pts" deltas, dates, gift icons. Backend restarted + PROD frontend rebuilt. NOTE: the test account has only credits, so the amber "Redeemed" (debit) row style is verified by render logic, not a live debit.


### Cart drawer — "We accept" coin trust strip (2026-06) — DONE, verified (desktop + mobile)
- **New `components/cart/AcceptedCoins.jsx`**: a compact "We accept" strip that fetches the LIVE DynoPay supported-coin list (`walletAPI.getSupportedCurrencies()` → `data.currencies`), dedupes by base ticker (USDT-TRC20/ERC20 → one USDT), and renders up to 7 brand-coloured coin icons + "+N more". Module-level cache so it fetches once/session; falls back to the known 13-coin set (and works for guests where the wallet call 401s). Reuses the same icon mapping style as `wallet-modal.jsx` (FaBitcoin/FaEthereum/SiTether/SiLitecoin/SiDogecoin/SiBitcoincash/SiSolana/SiPolygon/SiRipple + LuCoins fallback for TRX/USDC).
- **Wired into `MiniCartDrawer.jsx`** footer (below the pay buttons + "Open full cart" link, hairline divider above), so both signed-in and guest users see accepted coins before paying.
- VERIFIED (screenshots, logged in): strip shows real live coins BCH/BTC/DOGE/ETH/LTC/POLYGON/SOL + "+4 more" (= 11 base tickers from the 13 configured); renders clean in the desktop drawer and the full-screen mobile (390) drawer with no strip overflow (the only 390 overflow offenders are the pre-existing top-bar rewards chip, unrelated). PROD bundle rebuilt + restarted.


### UI polish — honest add-to-cart labels + single-logo shell (2026-06) — DONE, tested 100% (frontend)
- **Misleading "Pay with crypto" buttons removed**: `InlineDomainSearch.jsx` and `adminCard.jsx` domain-suggestion / smart-suggestion cards used to swap their add button to a `<FaBitcoin/> Pay with crypto` label when the wallet balance was below the domain price — but the click only ADDS to cart (the mini-cart drawer then opens to pay), so the label was dishonest. Removed the `needsTopup`/balance branch entirely: `InlineDomainSearch` add button now always renders `<FiPlus/> Buy now` (signed-in) / `Add to cart` (guest); `adminCard` renders `{isAdding ? t.admin.adding : t.admin.buyNow}`. Dropped now-unused imports (`FaBitcoin`, `useCartUI`, `useAuth` where applicable) to keep lint/build clean. The cart drawer's own "Pay $X with crypto" checkout CTA is untouched (that one really does pay).
- **Double Nameword logo fixed**: on desktop the favicon rendered twice — once in the icon rail (`AppRail.jsx`) and again atop the contextual panel (`sidebar.jsx`). Removed the top logo block + `favicon` import from `sidebar.jsx`; the rail is now the single source of the logo (verified desktop 1920, laptop 1024, and inside the mobile 390 hamburger drawer).
- VERIFIED (iteration_15, frontend 100%, 0 console errors): 8 inline-search add buttons all show "Buy now" + plus icon (no BTC, no "Pay with crypto"), add→"In cart"→drawer opens; exactly one N logo in the signed-in shell at all 3 viewports; /dashboard↔/domains keeps rail + sidebar. Frontend is a PROD build → `yarn build` + `sudo supervisorctl restart frontend` were run.
- FOLLOW-UP (user feedback: "Buy now just adds to cart — bad UX"): "Buy now" was itself misleading since the button's only action is add-to-cart (the mini-cart drawer then opens to pay). Relabelled to "Add to cart" everywhere on suggestion cards: `InlineDomainSearch` now always renders `<FiPlus/> Add to cart` (dropped `useAuth`/`isAuthenticated`); `adminCard` uses new `t.admin.addToCart` (added to en/es/fr). Confirmed NO auto-add on search (searching alone leaves cart empty + drawer closed) and 7/7 buttons read "Add to cart", 0 "buy now" on the dashboard. Rebuilt PROD bundle (new hash → auto cache-bust) + restarted.


### Active link highlight + "/" command search (2026-06) — DONE, tested 100% (frontend)
- **"/" quick-search**: the existing CommandPalette (was Cmd/Ctrl+K only) now also opens on the `/` key, guarded so it's ignored while typing in an input/textarea/select/contenteditable (verified `a/b` types normally inside the palette). Top-bar `global-search` button's kbd hint updated to `/`; mobile search icon got `data-testid='global-search-mobile'`. Palette filters by label+keywords, arrow/enter/esc navigation, jumps to any section.
- **Account menu active highlight**: `UserDropdownMenu.jsx` quick links now use `isActive(to)` (pathname + hash aware, special-casing `/wallet` vs `/wallet#rewards`) to apply a brand active style + `aria-current='page'`.
- **Sidebar/rail active highlight**: AppRail already highlighted the active section; fixed `sidebar.jsx` contextual "Dashboard" link which was hardcoded `active` (now `NavLink end` + function className, so it highlights only on `/dashboard`).
- VERIFIED (iteration_14, 100% / 10 checks): `/` opens palette (input focused), filters, Enter navigates, Esc closes, Cmd/Ctrl+K still works, `/` ignored while typing; account menu + rail highlight the current section and swap correctly across routes; contextual Dashboard no longer permanently active; 0 console errors at 1440 + 390.


### Full-wrap product pages in app frame for signed-in users (Option 2) (2026-06) — DONE, tested 100% (frontend)
- **Goal**: for signed-in users, render product pages inside the app shell (persistent sidebar) so the sidebar never disappears; signed-out users keep the storefront frame.
- **New `ProductShell`** (`components/layout/ProductShell.jsx`): if `useAuth().user` → `<DomainProvider><FrontLayout fluid>{children}</FrontLayout></DomainProvider>`; else → storefront `Navbar + children + Footer`.
- **`FrontLayout` refactor**: now accepts `({ children, fluid })`, renders `children ?? <Outlet/>`, and skips the `.main-content` padding wrapper when `fluid` (so marketing pages render edge-to-edge with the sidebar).
- **Pages refactored** to wrap in `<ProductShell>` (removed their own Navbar/Footer/MainLayout): `DomainsNomadly`, `HostingNomadly`, `DnsManagerNomadly`, `ServersPage` (VPS + RDP), `Pricing`, `Api`. HomePage/Privacy/Terms/Help stay storefront.
- **Bug fix (latent, exposed by this change)**: `sidebar.jsx` domain-selector crashed via `d.id.toString()` when a domain had undefined `id` (only rendered on isDomainRoute pages like /dns-manager, which now show the sidebar). Made null-safe: `String(d?.id ?? '')`, filter `d && (d.id != null || d.websiteName)`, key/value `String(d.id ?? d.websiteName ?? '')`.
- VERIFIED (iteration_12 + iteration_13, 100%): all 7 signed-in product pages (/domains, /hosting, /vps, /rdp, /pricing, /api, /dns-manager) render the app shell (rail + wallet/rewards chips + user menu, no storefront navbar); all 6 signed-out product pages render the storefront (navbar + footer coin chips, no rail); sidebar persists across dashboard↔product navigation; correct at 1440 / 1024 / 390; no console errors.


### Navigation bridge for signed-in users (Option 1) (2026-06) — DONE, tested 100% (frontend, 3 viewports)
- **Problem**: signed-in users got stranded on storefront/product pages (only a name dropdown with no app links), the logo always went to the public landing page, and the sidebar vanished on laptop widths (1024–1279px).
- **Account menu**: `UserDropdownMenu.jsx` rewritten into a full "Manage account" menu — quick links to Dashboard, Domains, Wallet, Rewards, Orders, My services, Subscriptions, Payment history, Help + existing settings links + "View public site" (→ `/`) + Logout. Used on both the storefront navbar and the in-app top bar.
- **Storefront Dashboard button**: `Navbar.jsx` now shows a `nav-dashboard-btn` (desktop) and `nav-dashboard-btn-mobile` (drawer) for signed-in users, so getting into the app is one click from any product/landing page.
- **Context-aware logo**: `Navbar.jsx` brand → `/dashboard` when signed in (else `/`); AppRail + sidebar + FrontLayout mobile brand logos → `/dashboard`. A "View public site" link in the account menu returns to `/`.
- **Sidebar on laptops**: FrontLayout + AppRail + sidebar breakpoints shifted `xl:`→`lg:` (icon rail, contextual panel, mobile menu/brand, mobile drawer, bottom tabs) and `closeSidebar` uses `innerWidth<1024`, so the sidebar shows from ~1024px. Phones keep the drawer + bottom-bar.
- Locale keys added (EN/ES/FR): `site.nav.dashboard`, `site.nav.viewPublicSite`, `common.userMenu.manageAccount`, `common.userMenu.viewPublicSite`.
- Signed-out experience unchanged (Sign in + Create account, logo → `/`).
- VERIFIED (iteration_11, 100%): all flows pass at 1440x900, 1024x768 and 390x844; no console errors.


### Wallet top-up: show ALL configured coins (13) + inline error surface (2026-06) — DONE, tested (frontend 100%)
- **Bug**: the modal offered only BTC/ETH/USDT because I'd hardcoded a 3-coin allow-list; the merchant actually has 13 coins configured in DynoPay.
- **Fix**: `paymentController.fetchSupportedCryptoCurrency` now returns DynoPay's LIVE configured list (`getSupportedCurrency -> data.currencies`) = BCH, BTC, DOGE, ETH, LTC, POLYGON, SOL, TRX, USDC-ERC20, USDT-ERC20, USDT-POLYGON, USDT-TRC20, XRP (13). `getConfiguredCoins()` now returns [] when `CRYPTO_TOPUP_COINS` is unset (no restriction; env is now an OPTIONAL narrowing allow-list, left empty). `createCryptoTopup` validates against the live list. `WalletController` uses the live list; fallback to BTC/ETH/USDT if the provider call fails.
- **Icons**: added real coin icons for all 13 (`SiLitecoin/SiDogecoin/SiBitcoincash/SiSolana/SiPolygon/SiRipple` + existing BTC/ETH/USDT; LuCoins fallback for TRX/USDC) in both `wallet-modal.jsx` and `TopupHistory.jsx`; picker grid is now `grid-cols-3 sm:grid-cols-4`.
- **Inline error**: the modal now shows a persistent inline error (`data-testid='topup-error'`) when address generation fails (previously the toast could render behind the modal), cleared when the user changes coin/amount.
- VERIFIED (iteration_10): all 13 coin buttons render with icons; LTC generated a real DynoPay address end-to-end; top-up history regression passed.
- KNOWN (DynoPay merchant-side, NOT our code): XRP currently returns 500 "XRP_MASTER wallet record not found in DB" — the DynoPay account is missing an XRP master wallet for tag-based addresses. Options: configure XRP in DynoPay, or hide it via `CRYPTO_TOPUP_COINS` (e.g. the other 12). The inline error now shows this reason to the user.
- ✅ RESOLVED (2026-06): XRP now works. DynoPay fixed the merchant-side XRP wallet — `POST /wallet/crypto-topup {currency:"XRP",amount:20}` returns `success:true` with a valid XRP address (`r...`), `cryptoAmount` (e.g. 14.92 XRP for $20) and a QR. Verified end-to-end in the wallet modal UI.
- ✅ XRP DESTINATION TAG (2026-06, user-reported): DynoPay's XRP response also returns a `destination_tag` (tag-based/shared master wallet) — REQUIRED, or the payment won't credit. We were dropping it. Fix: `CryptoTopup` model +`destinationTag`; `createCryptoTopup` captures `d.destination_tag ?? d.payment.crypto.destination_tag ?? d.memo` and returns it; `listPendingCryptoTopups` returns it (so resume carries it); wallet modal renders a prominent amber "Destination tag — required" block with the tag + Copy button + warning ("include this tag or your payment won't be credited"), shown ONLY when present (BTC/ETH/etc. unaffected). Backend restarted + PROD frontend rebuilt. Verified: XRP $20 shows tag `530334367` + address `raLiUmSWmQdqsEEjGTBAGDXrjaa3MfEQmw`, block hidden for non-tag coins.


### Wallet top-up: "Change coin or amount" back button (2026-06) — DONE, tested 100% (frontend)
- **Bug**: once on the pay screen (after "Get address"), the only actions were "check now" and "Done" (which closed the modal) — a user who picked ETH couldn't switch to BTC without abandoning the modal.
- **Fix**: added `goBack()` + a `data-testid='topup-change-coin'` "Change coin or amount" button on the pay screen (shown pre-credit) in `wallet-modal.jsx`. It stops the status poll, resets pay/status/credited, and returns to step "amount" while preserving the entered amount and selected coin, so the user can choose a different coin and regenerate an address.
- VERIFIED (iteration_9): ETH → back (amount 15 preserved, picker shown) → BTC → new BTC address generated.


### Points explainer + bounded pending-topup auto-refresh (2026-06) — DONE, tested 100% (frontend)
- **Points explainer**: added `data-testid='cart-points-explainer'` in the cart reward panel (`CartPage.jsx`) — "1 point = $0.02 · earn 1 point for every $1 you spend" (the $0.02 is derived from the quote's `point_value_usd`).
- **Auto-refresh pending top-ups**: `TopupHistory.jsx` now quietly re-checks pending/confirming top-ups every 60s (`POLL_MS`), actively probing each live pending via `getCryptoTopupStatus` (which credits if paid) then reloading the list and firing `wallet:updated` on a credit. Bounded so it never polls forever: stops when no live pending remains, stops once a top-up passes its `expireAt`, and hard-caps at `MAX_POLLS=20` (~20 min); the 5-min backend reconcile job still credits late payments. Resets its window on a new `wallet:updated`. Verified throttled to ~60s (1 cycle / 85s window), no loop, no console errors.
- Reviewer note (non-blocking): the probe fires one status GET per live pending row; the test account abnormally has 12 live pending (testing leftovers) — real users have 1-2.


### Wallet Top-up History + Points Redemption at checkout (2026-06) — DONE, tested 100% (frontend)
- **Top-up History (NEW)**: added backend `GET /api/v1/wallet/crypto-topups` (`WalletController.listCryptoTopups`, last 15 any status) and a "Recent top-ups" card on the wallet page (`components/front-admin/billing/TopupHistory.jsx`, wired into `Wallet.jsx`). Each row shows coin icon (BTC/ETH/USDT), USD + crypto amount, date, and a colored status badge (Pending/Confirming amber, Credited green, Expired grey, Failed red). Reloads on the `wallet:updated` event and on modal close. i18n added to admin.topupHistory in EN/ES/FR. Verified: 14 rows render with Pending/Expired/Failed badges.
- **Points Redemption (was already built; now surfaced)**: the checkout rewards panel in `CartPage.jsx` (slider + Use max + Clear + points-discount line + payable recompute, sending `redeem_points` to `checkoutAPI.createOrder`) with full backend support (`CheckoutController.quote`/`createOrder` → `computeRedemption`, `points_balance`, `max_redeemable_points`, `points_discount_usd`, `payable_usd`). It only appears when the user holds points (`pointsBalance > 0`) — previously invisible because the reward earn rate was 0.02 (fixed to 1 last change). Verified with buyer (2187 pts): Use max applied 1950 pts = −$39 (full order), pay button flipped to "Pay with 1950 points"; Clear reverted to "Pay $39.00 from wallet". NO order was placed during testing.
- NOTE: cart route is `/cart` (open via the cart drawer's "Open full cart"); `/checkout/cart` on an empty cart redirects home.


### Wallet crypto top-up bug fixes — coin allow-list, icons, top-bar/points refresh (2026-06) — DONE, tested 100% (frontend)
- **Root cause**: after a top-up credited (via polling or the 5-min lifecycle job) nothing told the client to refresh, so the top-bar wallet chip stayed at its stale mount value ($0.00) and reward points stayed stale (the Wallet page looked correct only because it re-fetches on mount). The coin dropdown listed DynoPay's full global list (XRP etc.) that Nameword has no wallet for, and coins had no icons.
- **Configured coin allow-list**: backend `paymentController.fetchSupportedCryptoCurrency` now returns ONLY `getConfiguredCoins()` (env `CRYPTO_TOPUP_COINS`, default `BTC,ETH,USDT-TRC20`) — no more raw DynoPay list / "Not found" errors. `WalletController.createCryptoTopup` validates the requested coin against the same allow-list. New helper `getConfiguredCoins()` in `dynoPayHelper.js`.
- **Coin picker with icons**: `wallet-modal.jsx` replaced the plain `<select>` with a 3-button segmented picker (FaBitcoin/FaEthereum/SiTether via `coinMeta()`), each with icon + ticker + network hint.
- **Top-bar + points refresh**: `wallet-modal.jsx` `markCredited()` dispatches a `wallet:updated` window event; `FrontLayout.jsx` now refetches the balance chip on mount, on route change, and on `wallet:updated`, and also calls the new `refreshUser()` (added to `AuthContext`) to refresh reward points. `CartUIContext` already listens to `wallet:updated`.
- **Check-now feedback**: "I've sent it — check now" now shows a warning toast when no payment is detected yet (was silent).
- **Reward earn rate**: set `WALLET_TOPUP_REWARD_RATE=1` (env) to match the "$1 = 1 point" marketing (was defaulting to 0.02 → $10 gave 0.20 pts that displayed as 0).
- Removed a stray `console.log` firing every render in `UserDropdownMenu.jsx`.
- VERIFIED (testing_agent iteration_6.json, 100%): login shows real chip ($50.00) + points (2187.2); Top Up modal shows exactly BTC/ETH/USDT-TRC20 with icons (no XRP), no `<select>`, no stuck "Loading coins…"; real DynoPay BTC address generated for $10; check-now warning toast shown; `wallet:updated` event + cross-route navigation keep the chip correct (never reverts to $0.00). NOTE: a real on-chain credit can't be completed in test, so the credit→refresh path is verified by wiring + event, not a live payment.

### Removed social icon from footer (2026-06) — DONE
- Removed the X/Twitter link (the only social icon on the public site) and its unused import from `components/layout/Footer.jsx`.


### Help page (hero + search + crypto guide) & footer accepted coins (2026-06) — DONE, tested 100% (frontend)
- **On-brand help page**: `pages/front-admin/HelpSupport.jsx` now opens with a marketing hero (eyebrow "HELP CENTER", H1 "How can we help?", subtitle) on top of the existing marketing Navbar/Footer (MainLayout). NeedHelp contact block is now always visible below.
- **Help search**: added a search box (`help-search-input`) that filters Q&A across ALL topics client-side (flattens every section via `answerToText`), with results panel (`help-search-results`), empty state (`help-search-empty`) and a clear button (`help-search-clear`) that returns to the browse-by-topic view (`help-browse`).
- **Crypto Checkout guide**: new help topic "How crypto checkout works" (`help-tab-crypto-checkout`, id `crypto-checkout` → section `cryptoCheckout`) with 6 Q&As covering wallet top-up, payment address + QR, auto-credit timing, accepted coins, missing-payment troubleshooting, and refunds. Added to EN/ES/FR.
- **Billing topic de-carded**: rewrote `helpSupport.sections.billingPayments` in EN/ES/FR to be crypto/wallet-accurate (crypto-only methods, wallet top-up, wallet-based auto-renewal, non-refundable-once-provisioned, crypto "payment not arrived" troubleshooting) — removed Visa/Mastercard/Amex/PayPal references.
- **Footer accepted coins**: `components/layout/Footer.jsx` bottom bar now shows three real coin chips — BTC (FaBitcoin), ETH (FaEthereum), USDT-TRC20 (SiTether) — replacing the two generic icons (removed the `etherium` img import).
- VERIFIED: lint 0/0, `yarn build` clean, PROD frontend rebuilt+restarted. `testing_agent` iteration_5.json = 100% functional on desktop 1920 + mobile 390 (hero/navbar/footer, search filter+empty+clear, crypto topic + mobile select, footer coin chips). No console errors.


### Legal copy refresh — Privacy & Terms to offshore/DMCA-ignored, crypto-only (2026-06) — DONE, verified
- Rewrote the `privacy` and `terms` objects in `locales/en.js`, `es.js`, `fr.js` (same keys, new values) with fully-explicit positioning per user: privacy-first offshore jurisdiction, minimal/short-retention activity logs, no selling/marketing data, WHOIS-privacy by default, and a Terms "Acceptable Use & Termination" clause stating we do NOT honor DMCA/third-party takedown demands and only act on abuse of our own infra (spam/phishing/malware/attacks). Payments clause now states crypto-only (no cards/SEPA/bank), non-refundable once provisioned, leftover stays as wallet credit. Contact email set to hi@nameword.com in all three languages. ES/FR fully translated to match EN (they were previously behind EN on several clauses).
- Removed the "Owner to confirm…" yellow banner: deleted the `legal-placeholder-note` `<p>` block from `pages/PrivacyPolicy.jsx` + `pages/TermsAndConditions.jsx`, and removed the `legal.placeholderNote` key from `site.en.js`/`site.es.js`/`site.fr.js`.
- VERIFIED: `yarn build` clean; frontend PROD build rebuilt + restarted. Screenshots of `/privacy-policy` (desktop) and `/terms-and-conditions` (mobile) show the new copy, crypto-only payments clause, DMCA/acceptable-use stance, and NO placeholder banner. Routes: `/privacy-policy`, `/terms-and-conditions`.

### Landing crypto-only payments + CTA cleanup + phone removal + support relevance (2026-06) — DONE, verified
- Payments crypto-only: `Footer.jsx` bottom bar now shows only Bitcoin + Ethereum (removed Mastercard, Visa, Amex, SEPA icons + their imports). Marketing copy "crypto or card / card or crypto" → crypto-only in EN/ES/FR (`locales/site.en|es|fr.js`: home steps + email FAQ + pillars). "No card stored/kept" lines kept (they reinforce crypto-only).
- CTAs tested: enumerated every footer link target — all resolve to real routes. FIXED the dead footer DNS link `/dns-management` → `/dns-manager` (protected → /sign-in for guests, /dns-manager after login). Products (Domains/DNS/Hosting/VPS/RDP/API), Company (Pricing/Loyalty Rewards→/wallet/API Keys/My Account), Support (Help/FAQ anchor/Contact mailto/Privacy/Terms) all valid. Landing section CTAs (hero search, Need-a-server→/vps, product cards, pricing→/domains & /pricing, rewards→/create-account, final CTA→/create-account & /domains) all valid.
- Phone removed: `components/front-admin/help-support/NeedHelp.jsx` — deleted the "Call us" (`tel:+1 892 8444-531`) block (removed IoMdCall import; grid now email-only, or email+chat when VITE_SHOW_CHAT). Aligned support email to hello@nameword.com. Confirmed the landing/footer never displayed a phone (email only). WHOIS registrant phone inputs (EditAdministrative/Registrant/etc.) left intact — required for domain registration.
- Support relevance: removed the "Buy and sell domains" topic (no marketplace in the product) from `HelpSupport.jsx` sidebar + sectionMap; remaining topics (Discover/DNS/Renew/Manage contact/Secure/Explore popular/Organize/Hosting/Billing/Account & Security/Technical) are service-relevant; topic switching still works.
- VERIFIED: `yarn build` clean; FE rebuilt + restarted. Screenshots/DOM checks: footer payment icons = [Bitcoin, Ethereum] only; every footer link → valid route; /help-support shows no "Call us"/tel links, Email us = hello@nameword.com, no "Buy and sell domains", clicking Hosting renders its FAQs.

### Landing cleanup + privacy-first repositioning (2026-06) — DONE, verified (logged-out landing only)
- Approved plan (recommended defaults): declutter the public landing from 9 → 6 sections, remove duplicates, calm the decoration, and rewrite copy to lead with privacy & freedom (offshore, private WHOIS, no logs, DMCA-ignored, "your content stays up"); add a visible "DMCA Ignored" footer badge. Pricing/accounts/checkout/backend untouched.
- Structure (`components/home/HomeRedesign.jsx`): now Hero → Products → WhyNameword (Why+How+Privacy) → PricingTeaser → RewardsBand → FinalCta. REMOVED the separate TrustBar, HowItWorks and SecurityBand sections (deleted those 3 orphaned files under components/home/landing/).
- `Hero.jsx`: privacy-first headline ("Privacy and freedom, hosted offshore."), DMCA-ignored eyebrow/subheading/chips; trimmed decoration (one glow, lighter grid); folded the 4 trust points into a slim inline row (data-testid hero-trust-row / trust-item-N). Domain search kept ONLY here.
- `Products.jsx`: lighter icon-led cards (removed the heavy dark photo tiles), 3-col grid, kept all products + API card (light mono snippet) + prices/links.
- `WhyNameword.jsx`: combined Why + How + Privacy in one calm light section — 4 privacy-led pillars, a "Privacy & Freedom" checklist (folds in the old dark Security band; includes "DMCA-ignored — we don't take your content down"), and a compact 3-step "Live in three steps". No dark photo band here.
- `PricingTeaser.jsx`: 6 popular TLDs (.com/.net/.org/.io/.co/.xyz), removed the grid-pattern background, single clear links to search + full pricing.
- `FinalCta.jsx`: single closing prompt (Create account + Browse domains) — REMOVED the duplicate domain search. Dark photo bands now ~2 (hero + final CTA).
- `Footer.jsx`: added a visible "DMCA Ignored" badge (data-testid footer-dmca-badge) + privacy-first tagline/jurisdiction note.
- Copy: rewrote `locales/site.en.js` home + footer to privacy/freedom tone (removed compliance/takedown framing); added `footer.dmca` to site.en/es/fr so the badge renders in all 3 languages (ES/FR landing body copy left as-is — English is the primary target; key structure unchanged so nothing breaks).
- VERIFIED: `yarn build` clean (0 errors) after deleting orphans; FE rebuilt + restarted. Structure checks (all 6 section test-ids present, old trust-bar/security-band absent, 6 TLD cards, single search, privacy list includes DMCA line, footer badge = "DMCA Ignored") + desktop 1920 & mobile 390 screenshots — clean, calm, no horizontal scroll (scrollWidth==clientWidth==390; the flagged hero-glow is clipped, false positive). Presentational change; interactive bits (hero search, CTAs) reuse unchanged components — not run through testing_agent.

### Inline Quick-Order UX — mini-cart drawer + inline search + wallet-aware buys (2026-06) — DONE, tested
- Approved plan: let signed-in customers search, add, and pay inline (no full-page jumps), keep the full cart for nameservers/points; make buy buttons honest about one-tap vs top-up. User expanded scope to include VPS/RDP inline quick-add AND the logged-out funnel (both a+b). VPS/RDP defaults EU/Ubuntu & EU/Windows (region selectable EU/SG via reseller API — confirmed already supported).
- NEW `context/CartUIContext.jsx` (`CartUIProvider`/`useCartUI`): global drawer open state + live wallet balance (refreshes on `wallet:updated`); AUTO-OPENS the drawer whenever cart item count increases (suppressed on /cart & /checkout). Wrapped around `Router` in `App.jsx`; `<MiniCartDrawer/>` rendered globally.
- NEW `components/cart/MiniCartDrawer.jsx`: slide-in right sheet (full-screen on mobile). Lists items + remove, subtotal, (signed-in) wallet balance; pays via `checkoutAPI.quote`+`createOrder` → /checkout/success/:id, or `Pay with crypto` (reuses `WalletModal`, preset = full order, auto-completes on credit). Shortfall disables wallet-pay + shows hint + keeps crypto enabled. Guests see no balance + "Sign in to checkout" → /cart gate. "Open full cart" link for NS/points.
- NEW `components/cart/InlineDomainSearch.jsx`: inline exact-match availability + price + alt-TLD suggestions; wallet-aware add buttons ("Buy now" when wallet covers, "Pay with crypto" when not, "Add" for guests, "In cart" when added). De-dupes the exact domain from suggestions (unique test-ids).
- `CartNavButton` (used in FrontLayout top bar AND public Navbar, desktop+mobile) now OPENS the drawer via `useCartUI` (kept live count badge). `dashboard.jsx` uses `InlineDomainSearch` (replaced the navigate-to-/domains search). `adminCard.jsx` suggestion CTA is wallet-aware + no longer navigates (drawer auto-opens; added `admin-card-buy-*` test-id). `SecurityCard.jsx` + `ServersPage.jsx` (VPS/RDP) adds no longer navigate to /cart (drawer opens inline; removed unused `navigate`). Also fixed a pre-existing blocking lint error: `SecurityCard.jsx` `privacyPlans` undefined → `planOptions={[]}`.
- VERIFIED: `yarn build` clean (0 errors), FE rebuilt + restarted (PROD). `testing_agent` iteration_4.json = 11/11 exercisable scenarios (inline search inline results, add→drawer auto-open, nav cart button + live badge, pay-from-wallet enablement, crypto modal preset, shortfall path, VPS add→drawer no jump, guest funnel → sign-in, full-cart link) at 1920 + 390; buyer wallet NOT spent (still $50). My smoke tests: desktop happy path + mobile (unique add test-ids, full-sheet drawer, no drawer overflow). Non-blocking header overflow at 390px is pre-existing (2187-pt rewards chip on the test account), unrelated to this work.


### Top-up expiry + payment reminders + receipt PDF (2026-06) — DONE, verified
- User asks: (1) crypto resume should EXPIRE after a few hours; (2) email a gentle reminder if a top-up stays unpaid; (3) attach a downloadable PDF invoice to each order-confirmation email.
- (1) Expiry: `models/CryptoTopup.js` +`expireAt` (+`reminderSentAt`). `createCryptoTopup` sets `expireAt = now + CRYPTO_TOPUP_EXPIRE_HOURS` (default 3h). `listPendingCryptoTopups` now returns only `expireAt > now` (legacy records without expireAt drop off) and includes `expireAt`. `PendingCryptoStrip.jsx` shows "· expires in ~2h 59m".
- (2) Reminders + reconciliation: new job `app/jobs/cryptoTopupLifecycle.js` (node-schedule, every 5 min, registered in `app.js`). Per pending/confirming top-up it: (a) reconciles with DynoPay via new shared `WalletController.reconcileCryptoTopup(record)` — CREDITS the wallet if paid even when the user closed the tab (no webhook needed); (b) marks it `expired` past `expireAt` (24h fallback for legacy); (c) sends a ONE-TIME reminder (`app/services/cryptoTopupEmail.js`, branded, Resume→/dashboard) after `CRYPTO_TOPUP_REMIND_AFTER_MINUTES` (default 30) unpaid, respecting `shouldSendEmail` prefs, then sets `reminderSentAt`. `reconcileCryptoTopup` mirrors the tested status-endpoint logic and reuses idempotent `creditWalletTopup`.
- (3) Receipt PDF: new `app/utils/orderReceiptPdf.js` (`generateOrderReceiptPDF(order, buyer)` via jsPDF — seller block, order#, billed-to, item table w/ statuses, subtotal/points/charged/refunded, test-mode note; returns Buffer). `services/mailer.js` now accepts `attachments` → maps to Brevo `message.attachment [{name,content(base64)}]`. `services/orderEmail.sendOrderConfirmation` generates the PDF and attaches it (best-effort; email still sends if PDF fails). Fires for BOTH wallet + crypto orders.
- VERIFIED: backend restarts clean, job logs "scheduled: every 5 minutes"; fresh top-up returns `expireAt` +3h; PDF is valid ("%PDF-", ~7.6KB); order-confirmation email WITH PDF attachment accepted by Brevo (messageId …@smtp-relay.mailin.fr); reminder email sends OK; dashboard strip shows the expiry countdown. `yarn build` clean; FE+BE restarted. New env (optional): `CRYPTO_TOPUP_EXPIRE_HOURS` (3), `CRYPTO_TOPUP_REMIND_AFTER_MINUTES` (30).


### Order confirmation email + Pending-crypto resume + Brevo turned ON (2026-06) — DONE, verified
- User asks: (1) branded order-confirmation email + on-screen receipt when a crypto payment clears; (2) an "Awaiting crypto" strip on the dashboard to reopen a half-finished top-up; (3) turn on REAL Brevo email with verified sender `hi@nameword.com` (onboarding, top-up receipts, order receipts).
- (1) Order confirmation was ALREADY built and now DELIVERS: `app/services/orderEmail.js` (branded indigo HTML receipt, per-item statuses, points, "View your orders" CTA) is fired by the C3 provisioning worker (`CheckoutController.processOrder` ~line 656). On-screen receipt = `pages/checkout/OrderSuccess.jsx` (already complete). Crypto path: crypto clears → wallet credited → `pay()` → `/checkout/orders` → same worker → email + receipt. No code change needed beyond Brevo config.
- (3) Brevo: mailer (`app/services/mailer.js`) already uses the `@getbrevo/brevo` TransactionalEmailsApi with `BREVO_API_KEY`. Only the sender was invalid. Changed `/app/backend/.env`: `BREVO_EMAIL=hi@nameword.com` and `MAIL_FROM_ADDRESS=hi@nameword.com`. VERIFIED a real send returns a Brevo `messageId` (…@smtp-relay.mailin.fr) — `hi@nameword.com` is a verified sender, delivery works. (Sender name = `MAIL_NAME`=Nameword.)
- (2) Pending-crypto resume (NEW): `models/CryptoTopup.js` +`qrCode` field; `createCryptoTopup` now stores `qrCode` (provider `qr_code`). New controllers `listPendingCryptoTopups` (GET `/wallet/crypto-topups/pending` — status pending/confirming, created within `CRYPTO_TOPUP_RESUME_MINUTES` def 60m) + `cancelCryptoTopup` (POST `/wallet/crypto-topup/:paymentId/cancel` → status=failed). Routes in `routes/api/wallet.js`; `api/walletApi.js` + `config/api.js` endpoints added. `components/modals/wallet-modal.jsx` got a `resumePayment` prop → opens straight to the pay step (QR/address/amount) and polls. New `components/front-admin/PendingCryptoStrip.jsx` (amber strip, Resume opens the modal, Dismiss cancels) rendered at the top of `pages/front-admin/dashboard.jsx`.
- VERIFIED (curl + screenshots desktop 1920 + mobile 390): pending endpoint returns real records; fresh top-up persists a QR; dashboard strip shows "Awaiting crypto payment — $X"; Resume opens modal with QR+address+"Send exactly 20 USDT-TRC20"+polling; Dismiss removes the row (2→1); no strip overflow at 390px. `yarn build` clean; frontend PROD build rebuilt + restarted. Backend restarted for .env. Buyer wallet at $50.
- Note: a pre-existing FrontLayout header can slightly overflow at 390px when the reward-points chip is very large (this test account = 2187 pts) — unrelated to this work, not user-reported.


### Checkout "Pay with crypto" button + placeholder sweep (2026-06) — DONE, tested 100%
- User choices: (a) always-visible "Pay with crypto" on /cart as a 2nd option next to "Pay from wallet", preset to the FULL order amount, funds the wallet then auto-completes the order in one step; (b) any leftover stays as wallet credit; (c) full placeholder-UI sweep.
- `pages/checkout/CartPage.jsx`: added `payWithCrypto()` + `topupPreset` state; new secondary button `data-testid=cart-pay-crypto-button` ("Pay $X with crypto", always shown when payable>0, disabled while quoting/problems). Reuses existing `WalletModal` (native DynoPay address+QR+polling) with `presetAmount={topupPreset}` = full `payable`; on credit, existing `handleTopupSuccess` refreshes the quote and calls `pay()` → order completes → /checkout/success/:id. Removed the old shortfall-only "Top up & pay" button; replaced with a hint (`cart-shortfall-hint`). Primary "Pay from wallet" stays disabled while short. Preset = full order amount so the button label and modal amount always match (fixes reviewer mismatch).
- Placeholder sweep: DELETED dead static page `pages/front-admin/AccountInfomation.jsx` ("Hi, Jaden!" + fake apple.br/applecommunity.com "Save 85%" cards, dead href="#" buttons, empty domain list). Removed its `/account-information` route + import from `routes/Router.jsx` (now hits catch-all → redirects to /). Repointed `components/common/CommandPalette.jsx` "info" item → `/account-setting?tab=account-information` (the REAL AccountInformation tab; AccountSettings reads ?tab=). Removed `/account-information` from AppRail settings `match`. Grep confirmed no other hardcoded placeholder names remain. Dashboard Smart Suggestions + SecurityCard brand-protection already use honest pricing/owned-domain logic (prior session). Notifications bell left as an honest "You're all caught up" empty state (no misleading data).
- Verified: `yarn build` clean; frontend is PROD build (`.prod`) → rebuilt + `supervisorctl restart frontend`. Screenshots (1920 + 390): both pay buttons enabled with matching totals, crypto modal opens preset to order amount, no 390px overflow. `testing_agent` iteration_3.json = 100% (6/6): sufficient-wallet dual buttons, crypto modal preset, shortfall (disabled wallet-pay + hint + enabled crypto), /account-information redirect, Command Palette info → real account settings, pay-from-wallet → success page. Re-seeded buyer wallet to $50 (`node backend/scripts/seed_test_users.js`). `/payment/getSupportedCurrency` endpoint confirmed healthy (~130ms, real coin list) — testing agent's "Loading coins…" stall was a transient preview hiccup, not a code bug.


### UX Overhaul — Phase 0 "Blockers" + Option 1 re-skin (2026-06) — DONE, tested
- Decisions (user): benchmark dynopay.com; visual = **Option 1 "Editorial Indigo & Obsidian"** (light-first, indigo #4f46e5, Outfit display / Plus Jakarta Sans body / JetBrains Mono metadata); checkout = multi-step stepper INSIDE the app shell; dry-run = **deduct in-app wallet anyway** (realistic flow); sign-up = email + password + Google only. Full audit + target flows in `/app/memory/UX_AUDIT.md`; design spec in `/app/design_guidelines.json`.
- Backend: `routes/api/reseller.js` — catalog/search public, everything that lists/creates/manages requires `[currentUser, requireAuth]` (was fully anonymous → owner-wallet spend + reseller-wide data leak). `withVcpus` parses vCPU from plan_id (upstream sends null). New `app/middlewares/session-or-apikey.js` = session/JWT OR x-api-key, applied to `/wallet`, `/transactions`, `/invoices` (were API-key-only → every session user without an API key got `400 {redirect:true}` and the axios interceptor hijacked the SPA to /account-setting).
- Frontend: `hooks/useBuyer.js` (isAuthenticated, provider mode, IN-APP wallet balance, `requireLogin(returnPath)`); Domains/Hosting/VPS/RDP pages no longer show the reseller wallet or test banner to visitors, CTAs gate to /sign-in and return; "Your …" sections signed-in only; raw plan ids hidden. Dead links fixed (bottom tabs, Cmd-K, DNS card, sidebar); Transfer tab removed; "card or crypto" → crypto (EN/ES/FR); `/dns-manager` protected; `Protected.jsx` → /sign-in + stores return path; `client.js` interceptor only redirects when a request sets `redirectOnMissingApiKey`.
- Theme: `index.css` @theme retokenised to Option 1 (indigo scale, obsidian grays, fonts, `.nw-eyebrow` mono `[ … ]`, rounded-lg buttons/inputs, rounded-xl cards, `.nw-mono`); `ThemeContext` light-first with one-time `nw_theme_v2` migration.
- Preview reliability: Vite dev served 300+ modules/page → Cloudflare 429 → blank pages. Added `/app/frontend/start.sh` (supervisor now runs it): if `/app/frontend/.prod` exists it `yarn build`s and serves via `vite preview` (production bundle, ~5 requests); delete `.prod` + restart frontend for HMR dev. `.prod` is ON for the checkpoint.
- Tests: `/app/test_reports/iteration_1.json` (backend 21/21 incl. `backend/tests/test_reseller_auth.py`; logged-out UI all pass). Logged-in flows re-verified manually after the API-key fix (wallet chip, dry-run banner, Deploy modal, return-path). Demo login: demo@nameword.local / Demo@12345.
- Known leftovers for later phases: dashboard "Smart Suggestion" cards show absurd prices/fake "Save 17%" (Phase 2 replaces dashboard); VPS dry-run banner copy still says "wallet is never charged" (Phase 1 changes semantics); legacy contextual sidebar still has unreachable dead sub-links (Phase 2 replaces shell); `/pricing` still uses the old pill eyebrow styles inherited (fine).
- NEXT: Phase 1 — commerce core (Order/Transaction per user, auth'd purchase endpoints charging the in-app wallet, unified `/app/checkout` stepper, success/receipt, retire legacy Cart/Upsell/PaymentCheckout).

### Re-setup (2026-09-11, pod reconciled again) — APP IS LIVE
- Pod reconciled: both `.env` wiped, backend `node_modules` gone, supervisor reset to default uvicorn template (`uvicorn server:app` -> failed: this is a NODE app), frontend was crashing on inotify ENOSPC (old uvicorn WatchFiles was watching backend node_modules and exhausted watchers).
- NEW live pod preview URL = `https://nameword-dev-9.preview.emergentagent.com` (user pasted a STALE `5c680fc7-...` URL in their .env -> repointed APP_URL/FRONTEND_URL/CORS/GOOGLE redirects to the live pod URL).
- "credentials vault password Katiekendra123@": support re-confirmed there is NO Emergent credentials-vault / password restore feature; the string is unused. User re-pasted their full backend/.env (the ONLY way to restore secrets). REAL secrets: DB_URI (Railway `nozomi.proxy.rlwy.net:54383/nameword`, reachable + seeded: 37 collections, users=6, cpanelplans=9, vpsplans=4) and NOMADLY_API_KEY (rsk_live_...). All other 3rd-party keys are PLACEHOLDERS.
- Fixes: `yarn install` (backend, node_modules restored); rewrote `/etc/supervisor/conf.d/supervisord.conf` -> backend `bash /app/backend/start.sh` (node bin/www :8001), frontend `yarn start` (=vite, 0.0.0.0:3000 via vite.config). Frontend ENOSPC resolved once uvicorn (the watcher hog) was replaced by Node. sysctl inotify bump was NOT permitted in container but not needed after uvicorn removed.
- VERIFIED LIVE (curl + screenshot): backend connect to Railway Mongo + listening :8001; `/api/v1/reseller/health` ok (dry_run, all products); `/reseller/account` real (@onarrival1, wallet $5); `/reseller/domains/search?domain=coolstartup2026` -> coolstartup2026.com available $39 (real upstream); frontend homepage renders (Option A dark redesign) HTTP 200.
- Placeholder-driven flows still non-functional: Google OAuth, Brevo email, Telnyx OTP, DynoPay payments, Telegram, GCloud. (Legacy ConnectReseller/WHM/Plesk/Cloudflare intentionally left unset/disabled.)


### Domain search UX overhaul + same-origin API fix (2026-09-08)
- FIXED "no results on preview": the frontend pinned API calls to a hardcoded VITE_API_BASE_URL (140bde5b host). When the user opened the app on a DIFFERENT preview origin, calls went cross-origin and were blocked -> no results. Changed `/app/frontend/src/config/api.js` to use SAME-ORIGIN (`window.location.origin`)/api/v1 so it works from any preview/custom URL. (User confirmed working.)
- Landing-page domain search is now INLINE (no navigation): new components `components/domain/DomainSearchResults.jsx` (exact match renders instantly, alt-TLD suggestions stream in independently) + `components/domain/RegisterDomainModal.jsx` (portaled, reusable; currently NOT used on landing). HomeRedesign Hero + FinalCta render results inline below the search box and smooth-scroll to them. Legacy /home & /domain routes still redirect to /domains hub.
- Landing page is now a DISCOVERY surface only: removed the reseller "Test mode" banner and the reseller $5 wallet display from the public flow. Register CTA is auth-aware — logged-out shows "Sign in to register" -> stores `path=/domains?value=<domain>` and routes to /sign-in; logged-in routes to /domains?value=<domain>. VERIFIED via screenshot (no Test mode banner; CTA routes to /sign-in).

- KEY MODEL CLARIFIED BY USER (for next session): there are TWO wallets — (1) in-app user `Wallet` (models/Wallet, balance Map USD, per userId; used by RDP/hosting/subscription purchases) which is the REAL user-facing balance that must gate purchases; (2) the Nomadly RESELLER wallet ($5, from GET /reseller/account) which is the OWNER's upstream balance and must NOT be shown to end users. The `mode: dry_run` on GET /reseller/health is set SERVER-SIDE by Nomadly (the app only mirrors it; resellerController.js is a pure pass-through) — user says the key is live but Nomadly still reports dry_run; only Nomadly can flip dry_run->live.

- PENDING / NEXT (Phase 2 — NOT built yet, confirm before building): make the AUTHENTICATED checkout charge the IN-APP user wallet:
  * Move the `/domains` hub (DomainsNomadly: search + Your domains + Manage DNS) INTO the signed-in dashboard shell (FrontLayout + AppRail already has a "Domains" item) and stop showing reseller wallet/test-mode there.
  * New AUTH endpoint e.g. `POST /api/v1/reseller/domains/purchase`: verify user, get/create Wallet, check balance >= price (price via reseller search), deduct in-app wallet, call Nomadly register, create Domain + Transaction records. Show user's in-app balance + a "Top up wallet" CTA on shortfall.
  * OPEN DECISION: in dry_run, do NOT charge the in-app wallet — show a "test mode, not charged" preview; charge for real only once Nomadly reports live.

### Re-setup (2026-09-08, pod reconciled again) — APP IS LIVE
- Pod was reconciled: both `.env` files wiped, backend `node_modules` gone, supervisor reset to the default uvicorn/`yarn start` template. Frontend `node_modules` survived (PVC).
- NEW pod preview URL: `https://nameword-dev-9.preview.emergentagent.com` (old `5c680fc7-...` is stale; kept in CORS only).
- User pasted their full `backend/.env` in chat (there is NO Emergent "vault password" restore feature — confirmed via support; the value "Katiekendra123@" they sent is unclear/unused for setup). Recreated `/app/backend/.env` from it, repointing APP_URL/FRONTEND_URL/CORS/GOOGLE redirects to the live pod URL. REAL secrets: `DB_URI` (Railway `nozomi.proxy.rlwy.net:54383/nameword`, reachable + seeded) and `NOMADLY_API_KEY` (rsk_live_...). All other 3rd-party keys are PLACEHOLDERS.
- Recreated `/app/frontend/.env` (VITE_API_BASE_URL -> live pod URL, VITE_API_KEY placeholder, VITE_SHOW_CHAT=false, VITE_TELEGRAM_BOT_NAME=BozznameStagingBot, VITE_REWARD_POINT_VALUE=0.02).
- Rewrote `/etc/supervisor/conf.d/supervisord.conf`: backend `bash /app/backend/start.sh` (node bin/www :8001), frontend `yarn dev --host 0.0.0.0 --port 3000` (vite). `yarn install` (backend) done.
- VERIFIED LIVE: backend `connect to mongodb` + listening :8001; `/api/v1/reseller/health` ok (dry_run, all products); `/reseller/account` real (@onarrival1 reseller, wallet $5); public preview URL routes `/api` correctly; Railway DB connected (37 collections, users:6, cpanelplans:9, vpsplans:4, badges:9); homepage renders (Option A dark redesign).
- Placeholder-driven flows still non-functional: Google OAuth, Brevo email, Telnyx OTP, ConnectReseller/WHM/Plesk/Cloudflare, DynoPay payments, Telegram, GCloud.

### Setup + bug-fix session
**App is LIVE.** Node/Express backend on :8001 (supervisor `bash /app/backend/start.sh`), React/Vite frontend on :3000, connected to REAL Railway MongoDB (`nozomi.proxy.rlwy.net:54383/nameword`). Preview URL for this pod: `https://nameword-dev-9.preview.emergentagent.com`. Nomadly Reseller API is LIVE (real key). All other integrations (Google OAuth, Brevo mail, Telnyx, DynoPay, WHM/Plesk/Cloudflare) are PLACEHOLDER.

**Fixed + verified by testing agents:**
- Resilient signup: `POST /auth/register` wraps the verification email in try/catch → returns 201 (not 500) when Brevo fails.
- Smart domain search: `GET /reseller/domains/search` defaults a bare keyword (no dot) to `.com`.
- `/domains` Register modal: rendered via `createPortal(document.body)` + hardened trigger button.
- Mobile hamburger drawer: portaled out of the `backdrop-blur` header (which was clipping the fixed overlay).
- Legacy `/domain` & `/websites` redirect to Home (SPA catch-all) — confirmed working.

**In progress (PARTIAL — not complete):** Onboarding simplification to email+password only.
- Backend: `registerSimpleRules` added + wired; `RegisterController` auto-generates username + default name. Verified email+password-only registration returns 201.
- Pending: register should issue a JWT/session; drop the `!isProfileVerified` login gate (backend `LoginController` + frontend `AuthContext.login`); simplify `CreateAccount.jsx` UI and skip the `/otp-code` step.

**Not started (requested):** remove Transfer end-to-end; audit loyalty/billing/wallet; persist every user order per-user in DB; DynoPay embedded checkout (playbook UNVERIFIED; provided API key looks CryptoJS-encrypted — inspect existing DynoPay integration first).

See `/app/test_result.md` (latest agent_communication entry) for the detailed handoff.

### Re-setup (2026-09-11, current session) — APP IS LIVE with user creds
- Pod reconciled again: both `.env` wiped, backend `node_modules` gone, supervisor reset to default uvicorn template (wrong: this is a NODE app).
- ACTUAL pod preview URL = `https://nameword-dev-9.preview.emergentagent.com` (from env `preview_endpoint`/HOSTNAME). User's pasted `5c680fc7-...` URL is STALE -> all URL vars (APP_URL/FRONTEND_URL/CORS/GOOGLE redirects/VITE_API_BASE_URL) point to the live d1d1fa08 pod URL.
- Rewrote `/app/backend/.env` from user creds (PORT=8001). REAL: DB_URI (Railway proxy nozomi.proxy.rlwy.net:54383/nameword, reachable+seeded), NOMADLY_API_KEY (rsk_live_...), APP_KEY/JWT_KEY/ADMIN_REGISTER_TOKEN. All other 3rd-party keys = PLACEHOLDERS. All envalid-required vars in start/env.js satisfied.
- Rewrote `/app/frontend/.env` (VITE_API_BASE_URL -> pod URL; frontend uses SAME-ORIGIN /api/v1 anyway; VITE_API_KEY placeholder, VITE_SHOW_CHAT=false).
- `yarn install` backend (804 pkgs restored). Rewrote supervisor conf: backend `bash /app/backend/start.sh` (node bin/www :8001), frontend `bash /app/frontend/start.sh` (`.prod` present -> yarn build + vite preview on :3000, avoids Cloudflare 429 blank pages).
- VERIFIED LIVE: Node backend connected to Railway Mongo + listening :8001; `/api/v1/reseller/health` ok (dry_run, all products); `/reseller/domains/search?domain=coolstartup2026` -> coolstartup2026.com available $39 (real upstream); public preview URL HTTP 200 (homepage Option A redesign renders); public `/api/v1/*` routes 200 through ingress.
- Railway DB: 37 collections; users=6 (+seeded demo@nameword.local / Demo@12345, login verified), badges=9, vpsplans=4, rdpplans=3, cpanelplans=9, tiers=0, discounts=0.
- Placeholder-driven flows still non-functional: Google OAuth, Brevo email, Telnyx OTP, ConnectReseller/WHM/Plesk/Cloudflare, DynoPay payments, Telegram, GCloud.

### Hostinger-style checkout funnel — BUILT, smoke-tested, FULL TESTING PENDING (2026-06, this session)
**User decisions:** (1) hosting options = live Nomadly `/hosting/plans`; (2) deduct the IN-APP wallet even while Nomadly is in dry_run (agent recommendation), test buyer seeded with $50; (3) the old "Register from wallet" popup is REPLACED by the cart funnel.

**Flow (matches hostinger.com → search `humbbssyeo.com`):** `/domains` search → exact-match hero card + "Other options" grid (Add to cart) → `/checkout/hosting?domain=` (Nomadly plans vs "domain only") → `/checkout/account` (Log in / Create account / Google tabs; skipped when signed in) → `/cart` (items, NS choice, wallet balance, shortfall → Top up, "Pay $X from wallet") → `/checkout/success/:id` receipt. Stepper (Domain → Hosting → Account → Cart & pay → Done) in `layouts/CheckoutLayout.jsx`. Header cart icon with live count (`components/checkout/CartNavButton.jsx`). Homepage inline results CTA is now "Add to cart" → hosting step.

**Backend (new):** `app/models/Order.js`; `app/controllers/checkout/CheckoutController.js`; `routes/api/checkout.js` mounted at `/api/v1/checkout` (`POST /quote` public, `POST /orders`, `GET /orders`, `GET /orders/:id` auth). Server re-prices every item via Nomadly (never trusts client prices), atomic overdraft-safe wallet debit (`Wallet.findOneAndUpdate` with `balance.USD >= total`), `Transaction` (debit) + `Payment` records (show in payment history), idempotency via `client_order_id`, provisions domains first then hosting (`domain_mode: byo`). Item statuses: `active` (live), `test_mode` (dry_run; incl. upstream 402 = RESELLER sandbox balance, not the buyer's), `failed` (live errors or non-402 sandbox errors → auto-refund to in-app wallet; order `partial`/`failed`). Upstream payloads stored with password/pin/secret keys stripped.
- VERIFIED via curl: quote ($39 domain + $30 hosting = $69), order for buyer: wallet $50 → $11, order `paid`, item `test_mode`, payment-history record created; idempotent replay returns same order; second order → 402 with `shortfall_usd`.

**Auth change (needed so "Create account" at the gate works without email):** `RegisterController.register` now issues a session + `token` (auto-login); `LoginController` no longer blocks unverified emails (only `notifyEmail` email-change still goes to OTP). Frontend `AuthContext.register` stores user/token; `CreateAccount.jsx` navigates to `path || /dashboard` when a token is returned; `AuthContext.login` gate uses `notifyEmail` only.

**Frontend (new):** `utils/cartStore.js` (localStorage `nw_cart_v2`, guest-friendly) + `hooks/useCart.js`; `api/checkout.js`; `utils/checkoutFormat.js`; `pages/checkout/{HostingUpsell,AccountGate,CartPage,OrderSuccess}.jsx`; `components/checkout/{CartSummary,CartNavButton}.jsx`; `pages/DomainsNomadly.jsx` rewritten (no modal/WalletNudge). `Router.jsx`: `/checkout/hosting`, `/checkout/account`, `/cart`, `/checkout/success/:id`; `/upsell-checkout` & `/payment-checkout` redirect to `/cart`.
**Legacy removed:** `pages/{Cart,UpsellCheckout,PaymentCheckout,Home}.jsx`, `utils/guestCart.js`, `components/cart/*`, `components/payment/*`, `components/layout/ViewCartSidebar.jsx`, `components/hosting/hosting-cart-sidebar.jsx`, `components/domain/{search-domain,find-more-options,search-domain-card,bottom-cart-view,domain-data-list,no-domain-available,contact-info,HighlightTLD}.jsx`; `mergeGuestCartIntoServer` calls dropped from AuthContext/SignIn/OtpCode/TwoFactorLogin. `CartIconButton.jsx` (dashboard topbar/AuthNavbar) now renders the new cart button. Backend legacy `/api/v1/cart` router + `CartItem` model left in place (unused by the UI; `adminCard.jsx`/`SecurityCard.jsx` dashboard "Buy now" still call it — Phase 2 dashboard work).

**Seed:** `backend/scripts/seed_test_users.js` (idempotent) → demo@nameword.local / Demo@12345 and **buyer@nameword.local / Buyer@12345 with $50 wallet** (re-run to reset the balance after test purchases). Credentials in `/app/memory/test_credentials.md`.

**Testing status:** lint clean, `yarn build` OK, screenshot smoke test PASSED for search → Add to cart → hosting step → account gate (guest). NOT YET TESTED end-to-end in the browser: gate login → `/cart` quote/wallet panel → Pay → success page; Create-account path at the gate; shortfall UI ($69 cart vs $50 wallet → Top up); Other-options Add/Added toggle + sticky cart bar; header cart count; mobile layout; dark mode. **NEXT SESSION: run `testing_agent` (both) on the full funnel, then re-seed the buyer wallet.**

**Open items / ideas:** order history page in the dashboard (`GET /checkout/orders` exists); hook `/hosting` page "Select plan" into the cart; multi-year domain terms (Nomadly registers 1 year only); wallet top-up depends on DynoPay (placeholder key).

### Re-setup (current session) — pod reconciled, restored from user creds
- Pod was reconciled again: both `.env` wiped, backend `node_modules` gone, supervisor reset to the WRONG default template (`uvicorn server:app` — this is a NODE app, not Python), backend+frontend STOPPED.
- ACTUAL live pod preview URL = `https://nameword-dev-9.preview.emergentagent.com` (from env `preview_endpoint`). User's pasted `5c680fc7-...` URL is STALE → all URL vars (APP_URL/FRONTEND_URL/CORS/GOOGLE redirects/VITE_API_BASE_URL) repointed to the live c9b751a1 URL.
- Rewrote `/app/backend/.env` from user creds (PORT=8001). REAL: DB_URI (Railway proxy nozomi.proxy.rlwy.net:54383/nameword, TCP reachable + seeded), NOMADLY_API_KEY (rsk_live_...), generated APP_KEY/JWT_KEY/ADMIN_REGISTER_TOKEN. All other 3rd-party keys = PLACEHOLDERS. All envalid-required vars in start/env.js satisfied.
- Rewrote `/app/frontend/.env` (VITE_API_BASE_URL=pod URL fallback; frontend actually uses SAME-ORIGIN /api/v1). `.prod` flag present → frontend serves production build via `vite preview` (Cloudflare-429-safe).
- `yarn install` (backend, node_modules restored, 57s). Rewrote `/etc/supervisor/conf.d/supervisord.conf`: backend `bash /app/backend/start.sh` (node bin/www :8001), frontend `bash /app/frontend/start.sh` (yarn build + vite preview :3000). Both RUNNING.
- VERIFIED LIVE: Mongo connected (38 collections: users=9, cpanelplans=9, vpsplans=4, rdpplans=3, badges=9); `/api/v1/reseller/health` ok (dry_run); real domain search `coolstartup2026xyz.com` available $39 (real Nomadly upstream); homepage HTTP 200 + renders (indigo redesign). `/reseller/account` returns Unauthorized = EXPECTED (now auth-gated).
- Placeholder-driven flows still non-functional: Google OAuth, Brevo email, Telnyx OTP, DynoPay payments, Telegram, GCloud, WHM/Plesk/Cloudflare/ConnectReseller.

## Re-setup (2026, this session) — fresh pod
- Pod had reset: both `.env` empty, backend `node_modules` missing, supervisor reverted to default uvicorn template.
- ACTUAL pod preview URL = `https://nameword-dev-9.preview.emergentagent.com` (from env `preview_endpoint`/HOSTNAME). User's pasted `5c680fc7-...` is STALE → all URL vars (APP_URL/FRONTEND_URL/CORS/GOOGLE redirects/VITE_API_BASE_URL) repointed to the live 98499cc0 URL.
- Fixed `/etc/supervisor/conf.d/supervisord.conf` [program:backend] command → `node ./bin/www` (dir /app/backend). Ran `yarn install` in backend (bcrypt native OK, node v20).
- `/app/backend/.env` written from user creds (PORT=8001). REAL: DB_URI (Railway proxy nozomi.proxy.rlwy.net:54383/nameword, reachable + already seeded: 38 collections, users=11, cpanelplans=9, vpsplans=4, rdpplans=3, badges=9; tiers=0, osdetails=0), NOMADLY_API_KEY (rsk_live_...), GOOGLE_CLIENT_ID/SECRET (redirect URIs need pod whitelisting in Google Console), BREVO_API_KEY (real), DYNO_PAY_API_KEY (real → mapped to DYNO_PAY_API_KEY which is what code reads, base https://dynopay.com/api). PLACEHOLDERS: WHM, Plesk, Cloudflare, Telnyx (SMS/OTP), GCS, ConnectReseller/CR_CUSTOMER_ID, Telegram.
- `/app/frontend/.env`: VITE_API_BASE_URL=pod URL (frontend calls SAME-ORIGIN /api/v1 in browser; VITE_API_BASE_URL used for /auth/google redirect), VITE_API_KEY placeholder, VITE_SHOW_CHAT=false, VITE_TELEGRAM_BOT_NAME=BozznameStagingBot, VITE_REWARD_POINT_VALUE=0.02.
- VERIFIED LIVE: frontend HTTP 200; backend Node on 8001 connected to Mongo; reseller /api/v1/reseller/health ok (mode dry_run); REAL domain search returned availability+price ($39 OpenProvider); hosting/plans returns real Anti-Red buckets.

## Re-setup (current session) — pod reconciled, provisioned with NEW real keys
- Pod was reconciled again: both `.env` wiped, backend `node_modules` gone, supervisor reset to default uvicorn/`yarn start` template. Fixed all of it.
- ACTUAL pod preview URL = `https://nameword-dev-9.preview.emergentagent.com` (user's pasted `5c680fc7-...` URL is STALE → all URL vars point to the live df85add3 pod URL; 5c680fc7 + localhost also added to CORS_ORIGIN, though CORS uses origin:true anyway).
- Recreated `/app/backend/.env` from user creds. NEW REAL keys this run: GOOGLE_CLIENT_ID/SECRET (real), BREVO_API_KEY (real `xkeysib-...`), DYNO_PAY_API_KEY (real encrypted blob → mapped to DYNO_PAY_API_KEY which is what `app/helpers/dynoPayHelper.js` uses via `x-api-key`; base=https://dynopay.com/api). Still REAL from before: DB_URI (Railway proxy nozomi.proxy.rlwy.net:54383/nameword), NOMADLY_API_KEY (rsk_live_...). Still PLACEHOLDER: ConnectReseller, WHM, Plesk, Cloudflare, Telnyx, Telegram, GCloud, mail SMTP user/pass.
- GOOGLE_REDIRECT_URL=`<pod>/auth/google/callback`, GOOGLE_LINK_REDIRECT_URL=`<pod>/auth/google/link/callback` (Vite dev/preview proxies `/auth` → backend :8001, so OAuth routes reach backend; BUT Google Console must whitelist this df85add3 redirect URI for login to complete — pod URL changes on reconcile).
- Supervisor rewritten: backend `node /app/backend/bin/www` (dir /app/backend, dotenv loads .env, port 8001); frontend `bash /app/frontend/start.sh` (`.prod` present → `yarn build && vite preview` on :3000, Cloudflare-429-safe).
- VERIFIED LIVE: Mongo connected (38 collections, 11 users, 4 vpsplans, 9 cpanelplans); `/api/v1/reseller/health` ok (dry_run); domain search returns real availability+pricing; external homepage HTTP 200 (indigo redesign renders); login works for demo@nameword.local/Demo@12345 & buyer@nameword.local/Buyer@12345.
- NOTE (mocked/limited): Brevo sender `hello@nameword.local` is not a verified domain → outbound email will fail sender-verification until a real verified sender is set. DynoPay/Google keys loaded but not end-to-end payment/login tested (payment would create real charges; Google needs redirect whitelisting). Reseller API in `dry_run` mode upstream.

## Logo Redesign "Keyhole N" — COMPLETE (current session)
- Built `components/common/BrandLogo.jsx` (NamewordMark inline-SVG badge = always indigo #4F46E5 + HTML "nameword" wordmark `text-[#0F172A] dark:text-white`). No `.dark-mode` filter hack used → badge stays indigo in dark mode, wordmark flips to white (old whole-logo-white bug fixed).
- Wired BrandLogo into Navbar (desktop+mobile), Footer, AuthNavbar, pricing-plans (white card). Removed `dark-mode` class from favicon-mark `<img>` in Loader, AppRail, sidebar, FrontLayout mobile topbar.
- Rewrote lockup SVGs: logo.svg + nameword-blue.svg (light, slate text), nameword-white.svg (dark, light text), new nameword-stacked.svg. favicon.svg already the new mark.
- Rasters (headless Chrome + Outfit webfont via Pillow): public/{favicon.svg, favicon-16, favicon-32, favicon-512, apple-touch-icon(180 full-bleed indigo), nameword-logo(512), logo.png(light lockup for emails), og-image(1200x630 slate)}. Copied logo.png+logo.svg to backend/views/mails/images/. Removed stale public/vite.svg.
- index.html: proper favicon set + apple-touch-icon + og:image/twitter:image + theme-color #4F46E5.
- VERIFIED live (prod build via vite preview): Navbar light+dark, Footer, /sign-in AuthNavbar, /dashboard AppRail+sidebar all show new Keyhole-N; all public assets HTTP 200; lint clean. Mobile QA + full-app sweep can be delegated to the frontend testing agent.
- NOTE: 26 backend email templates still hardcode the Railway prod URL `.../logo.png`; new artwork is in public/ so it resolves once deployed to Railway. Not changed (out of scope, and email is non-functional in-pod: Brevo sender unverified).


## SESSION (2026-09-28) — Setup + Phase 1 Hostman-grade reskin + Cloud product expansion
- SETUP: app configured & live. Node/Express backend (fixed supervisor from uvicorn -> `bash /app/backend/start.sh`), React+Vite frontend. Real Railway Mongo (DB `nameword`, 66 users), Nomadly reseller (live), Brevo, DynoPay (key -> DYNO_PAY_API_KEY), Google OAuth wired. .env files written to backend/.env + frontend/.env. Pod URL: https://d47598bf-9d5f-4172-933f-ebee3baf7b01.preview.emergentagent.com (user-provided 5c680fc7 URL was stale). Placeholders inert: SMTP, Telegram, WHM, Plesk, Cloudflare, Telnyx, GCloud. USER TODO: add Google OAuth redirect URIs {APP_URL}/auth/google/callback + /auth/google/link/callback in Google Console.
- RESKIN (Phase 1): retuned token-driven design system in /app/frontend/src/index.css from indigo/obsidian -> Hostman electric COBALT BLUE (--color-brand #2f6bff scale) on NAVY-BLACK dark (gray-950 #060a14, gray-900 #0d1526); all gradients/glows/buttons/auth-panel -> cobalt+sky. Whole app recolors via tokens. Light verified via screenshots; dark by symmetric tokens (screenshot tool would not hold theme-toggle state — verify dark via frontend testing agent).
- PRODUCT EXPANSION: new /app/frontend/src/data/productCatalog.js = single source of truth, 4 groups (Compute, App Platform, Data & Storage, Orchestration & Network). Live folded in (Cloud Servers=/vps, Windows RDP=/rdp, cPanel Hosting=/hosting, Domains=/domains, DNS=/dns-manager, Developer API=/api). 8 COMING-SOON: Bare Metal, AI Agents, App Platform, Managed Kubernetes, Managed Databases, Object Storage, Block Storage, Load Balancers. Navbar Products -> grouped mega-menu (desktop+mobile, Live/Soon badges). New pages: /products (ProductsIndex), /products/:slug (ComingSoonPage w/ WaitlistForm + features). Home: new CloudCatalog section after CpanelHosting.
- WAITLIST (real capture): backend POST /api/v1/waitlist + GET /waitlist/count (routes/api/waitlist.js, models/Waitlist.js, mounted in routes/api/index.js). Idempotent upsert on (email,product) into new `waitlist` Mongo collection + best-effort Brevo email. TESTED by deep_testing_backend_v2: 6/6 cases, 21/21 assertions, 100

## SESSION (2026-09-28) — Setup + Phase 1 Hostman-grade reskin + Cloud product expansion
- SETUP: app configured & live. Node/Express backend (fixed supervisor from uvicorn -> `bash /app/backend/start.sh`), React+Vite frontend. Real Railway Mongo (DB `nameword`, 66 users), Nomadly reseller (live), Brevo, DynoPay (key -> DYNO_PAY_API_KEY), Google OAuth wired. .env written to backend/.env + frontend/.env. Pod URL: https://d47598bf-9d5f-4172-933f-ebee3baf7b01.preview.emergentagent.com (user-provided 5c680fc7 URL was stale). Placeholders inert: SMTP, Telegram, WHM, Plesk, Cloudflare, Telnyx, GCloud. USER TODO: add Google OAuth redirect URIs {APP_URL}/auth/google/callback + /auth/google/link/callback in Google Console.
- RESKIN (Phase 1): retuned token design system in /app/frontend/src/index.css from indigo/obsidian -> Hostman electric COBALT BLUE (--color-brand #2f6bff) on NAVY-BLACK dark (gray-950 #060a14, gray-900 #0d1526); gradients/glows/buttons/auth-panel -> cobalt+sky. Whole app recolors via tokens. Light verified via screenshots; dark by symmetric tokens (verify dark via frontend testing agent - screenshot tool would not hold theme-toggle state).
- PRODUCT EXPANSION: new src/data/productCatalog.js = single source of truth, 4 groups (Compute, App Platform, Data & Storage, Orchestration & Network). Live folded in (Cloud Servers=/vps, Windows RDP=/rdp, cPanel Hosting=/hosting, Domains=/domains, DNS=/dns-manager, Developer API=/api). 8 COMING-SOON: Bare Metal, AI Agents, App Platform, Managed Kubernetes, Managed Databases, Object Storage, Block Storage, Load Balancers. Navbar Products -> grouped mega-menu (desktop+mobile, Live/Soon badges). New routes /products (ProductsIndex) + /products/:slug (ComingSoonPage w/ WaitlistForm + features). Home: new CloudCatalog section after CpanelHosting.
- WAITLIST (real capture): backend POST /api/v1/waitlist + GET /waitlist/count (routes/api/waitlist.js, models/Waitlist.js, mounted in routes/api/index.js). Idempotent upsert on (email,product) into new `waitlist` Mongo collection + best-effort Brevo email. TESTED by deep_testing_backend_v2: 6/6 cases, 21/21 assertions, 100 percent. Frontend api/waitlist.js + components/marketing/WaitlistForm.jsx.
- Lint clean on all changed files. Frontend NOT run through testing agent yet (awaiting user go-ahead). New marketing copy is English-only (i18n = Phase 3 backlog).

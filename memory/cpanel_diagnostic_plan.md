# APPROVED PLAN (handoff) — cPanel Advanced-Function Diagnostic / Reseller Provider Gap Report

Status: APPROVED by user, **NOT yet executed**. User paused execution and asked to document the
plan for the next agent. Execute Phase 1 when resumed.

--------------------------------------------------------------------------------
## What to produce
An exhaustive, LIVE functional test of every advanced cPanel capability the Nomadly reseller API
exposes, run against the real account, delivered as ONE written Markdown report that marks each
function **PASS / FAIL / NEEDS-PROVIDER-FIX** with the exact request + response, ready to hand to
the reseller API provider.

Suggested output file: `/app/CPANEL_DIAGNOSTIC_REPORT.md` (report only — NO app feature/endpoint/UI
is built in Phase 1).

## Audience
- Nameword team: know which panel features actually work vs. only appear to.
- Reseller API provider: reproducible, function-by-function list of what to fix (starting with the
  Security "application not found" errors).

--------------------------------------------------------------------------------
## Target account (fixed)
- Domain: **namewords.sbs**, cPanel user: **namea3a5**
- Owner login (for ownership-scoped calls): **moxxcompany@gmail.com / Onlygod123@**
- Plan: **premium-weekly** (weekly plan may gate some functions — e.g. MySQL has previously needed
  Gold/monthly). Gated funcs → verdict "plan-gated — cannot verify on this account" (NOT FAIL),
  note that a Gold account is needed to fully verify.
- If namea3a5 is SUSPENDED, most cPanel-session calls return session/auth failure. Attempt
  **unsuspend first** (itself a tested function). If it can't be made active, state clearly that a
  live/active account is required for meaningful coverage.

## How the app talks to the provider (use this exact path — test the integration as shipped)
- Backend base (internal): `http://localhost:8001`, API prefix `/api/v1`.
- Reseller proxy mount: `/api/v1/reseller/...` (routes: `/app/backend/routes/api/reseller.js`,
  controller: `/app/backend/app/controllers/reseller/resellerController.js`).
- Provider client: `/app/backend/app/services/nomadlyReseller.js` (BASE_URL = NOMADLY_API_BASE_URL,
  key = NOMADLY_API_KEY, both in `/app/backend/.env`; provider is **LIVE**, mode=live).
- Hosting-management routes are ownership-scoped via `withOwnedHosting`/`withOwnedDomain`: you must
  be authenticated as the OWNER (moxxcompany) — log in via `POST /api/v1/auth/login`, use the
  returned Bearer token (app also sets cookies). Non-owner → 403.
- Two ways to run the sweep (pick one, be consistent, capture verbatim):
  (a) Through our proxy as the app does (preferred — tests the real integration), OR
  (b) Direct to the provider using NOMADLY_API_BASE_URL + NOMADLY_API_KEY (bypasses ownership) —
      use only if proxy ownership blocks a needed call; note in the report which path was used.
- Full provider API docs: **https://1.speechcue.com/apidoc** (crawl for exact request/response
  shapes per endpoint).

--------------------------------------------------------------------------------
## Coverage (every function gets a verdict)
- Account / lifecycle: account details, site-status, suspend, unsuspend, upgrade, credentials/login.
- Domains: list, add addon, delete addon, set-primary (promote addon→primary), docroot + docroot
  modes, nameserver status.
- Subdomains: list, create, delete, bulk-create — VERIFY a created subdomain actually appears/
  resolves, not just that the call returned success.
- MySQL: create/list/delete db, create/delete user, set password, grant/revoke privileges, remote
  hosts, phpMyAdmin link, rename/repair/check.
- Email mailboxes: list, create, change password, delete, and a REAL test-send.
- SSL: certificate status + AutoSSL issuance.
- Files: list, read, write/save, mkdir, rename, copy, move, compress, extract/unzip, delete, upload.
- Security: status, Anti-Red deploy+status, Anti-Bot + rules, Safe-Browsing, Blacklist,
  Visitor-CAPTCHA, JS-Challenge (this is where "application not found" currently appears).
- Geo & Analytics & Stats: geo controls, analytics, usage stats.

Available proxy endpoints already implemented (confirm in reseller.js):
- Meta: GET /reseller/health, GET /reseller/account, GET /reseller/pricing (wallet stripped)
- Domains: GET /reseller/domains, POST /reseller/domains/register,
  POST /reseller/domains/:domain/renew (provider live-renew may be 501)
- DNS: list/add/delete records under /reseller/dns/:domain/records
- Hosting lifecycle: /reseller/hosting (create), suspend, unsuspend, upgrade, login, credentials,
  addons, terminate, GET /reseller/hosting/:user (details)
- Hosting management (HOSTING_MGMT_ROUTES, ownership-scoped): email (list/create/delete/password/
  test), mysql (databases/users/privileges/remote-hosts/phpmyadmin/rename/repair/check), subdomains
  (+bulk-create), domains (docroot, docroot-modes, docroot-mode, set-primary, ns-status, addon),
  ssl (+autossl), stats, files (content/save/mkdir/rename/extract/compress/copy/move/delete/upload/
  unzip/upload-chunk), security (status, anti-red/deploy+status, anti-bot+rules, safe-browsing,
  blacklist, js-challenge, visitor-captcha), geo, analytics, account/site-status.

--------------------------------------------------------------------------------
## Per-function record (report format)
For each function capture:
- Exact request (method, path, params/body)
- Exact response (status, JSON body) + timing
- Verdict badge: **PASS** (works end to end) / **FAIL** (errors / "application not found") /
  **NEEDS-PROVIDER-FIX** (returns success but change does NOT actually take effect)
- Plain-language note
- Suggested action for the provider

Where a function creates something → run **create → verify → clean-up** so the outcome is confirmed,
not assumed.

Report structure:
1. One-glance **summary matrix** (function × verdict badges) at the top.
2. **Executive summary** grouping SYSTEMIC gaps (e.g. if ALL Security apps return "application not
   found", flag as ONE likely root cause = security-app suite not provisioned for this plan/account,
   not many unrelated failures).
3. One section per function family: request, response, verdict, recommended provider fix.
Tone: neutral, reproducible — anyone can re-run the same calls and get the same evidence.

--------------------------------------------------------------------------------
## Execution order (safety)
1. Read-only checks first (status, list, details, ns-status, ssl status, stats, analytics, geo read).
2. Then create → verify → clean-up cycles (subdomains, mysql db/user, mailboxes, files).
3. Irreversible / side-effecting LAST (per agreed decision, INCLUDED even if not fully reversible):
   **set-primary domain**, **AutoSSL issuance**, **real test-send email**.

## Side-effects & assumptions (user-approved)
- "Include everything" = real, possibly PERMANENT changes. Attempt clean-up for created resources
  (subdomains, databases, mailboxes, files); set-primary-domain and AutoSSL may not be reversible —
  ACCEPTED.
- Test-send recipient: no external recipient given → send to a mailbox on the account's own domain
  (created during the email test) or to owner on file **moxxcompany@gmail.com**; do NOT email an
  uninvolved third party.
- Provider is LIVE; provisioning/side-effecting calls may debit the reseller wallet — this is
  accepted for this diagnostic. Still avoid gratuitous repeats.

--------------------------------------------------------------------------------
## Phases
- **Phase 1 (build now on resume):** full live sweep against namea3a5 incl. side-effecting actions;
  deliver the written gap report (matrix + per-function request/response/verdict + provider recs).
- **Phase 2 (later):** re-run identical sweep after provider fixes → delta report (fixed / still
  broken / newly broken).
- **Phase 3 (later, deferred):** optional in-app Admin "cPanel Diagnostics" runner (on-demand sweep
  vs any account/plan + history). NOT in current deliverable.

--------------------------------------------------------------------------------
## Session context for next agent
- App is set up & running: Node/Express backend (supervisor runs `node /app/backend/bin/www`; the
  supervisord.conf backend program was changed from uvicorn→node — if it resets on resume, re-apply),
  Vite/React frontend (dev via `yarn start`, HMR). MongoDB = user's real Railway instance (DB_URI).
- Live preview URL: https://hosting-control-13.preview.emergentagent.com
- Creds & integration status: `/app/memory/test_credentials.md`.
- Prior gap notes: `/app/memory/reseller_api_provisioning_gaps.md` (older server-side gaps; several
  now fixed). This session already completed & tested: cPanel Email mailbox proxy + Email UI tab,
  GET /pricing (wallet stripped), POST /domains/:domain/renew.

# Nameword — Hostman-Grade Redesign + Cloud Product Expansion

A full-platform visual and experience redesign of Nameword that adopts Hostman's cloud-grade color palette, layout and polish — while keeping Nameword's offshore, privacy-first, DMCA-ignored, crypto / no-KYC identity in the words.
Alongside the reskin, the product catalog expands to mirror a modern cloud host: live where a real provider exists today, and "Coming soon" (with a notify/waitlist) where it doesn't yet.

## Who it's for
- Privacy-conscious founders, developers and agencies who want offshore / DMCA-ignored hosting but expect a modern, premium, "real cloud" experience.
- Crypto-native buyers who value no-KYC signup and a prepaid crypto wallet.
- Existing Nameword customers managing domains, DNS, cPanel hosting, VPS and RDP who get a cleaner, faster interface.

## Core features and experience
- **Reskinned marketing site** — home, product pages, pricing, API/developer pages and legal pages rebuilt in the Hostman look (dark hero, product-card grids, verifiable trust strip, mega-menu navigation), with copy that stays in Nameword's privacy/offshore voice.
- **Expanded product catalog** presented as a Hostman-style grouped grid (e.g. Compute, App Platform, Data & Storage, Orchestration & Network):
  - Live today: Domains, DNS, cPanel Hosting, VPS, Windows RDP, crypto Wallet, API.
  - New "Coming soon" categories added to match a full cloud host: Cloud Servers, Bare Metal, App Platform (one-click app deploy), Managed Databases, Managed Kubernetes, Object/Block Storage, Load Balancers, AI Agents. Each gets a real product page with a "Notify me / join waitlist" capture — no fake provisioning or fabricated data.
- **Reskinned logged-in dashboard** — the entire account area (domains, DNS manager, hosting/cPanel, VPS/RDP, wallet & billing, orders, renewals, API keys, account settings & 2FA, help/support) rebuilt on the new design system with a refreshed sidebar and command palette. All current functionality preserved.
- **Reskinned auth + checkout** — sign in / sign up (incl. Google & Telegram), password/OTP/2FA screens, cart, crypto checkout and order success, all in the new style.
- **Trust & proof strip** styled like Hostman's (uptime, support, guarantees) but stating Nameword's genuine offshore/privacy/crypto promises — not copied certifications.
- **Dark + light themes** tuned to the new palette.

## User flow
- A visitor lands on the redesigned home → browses the grouped product grid → runs a domain search or opens a product page → sees pricing → creates an account (email, Google or Telegram) → adds to cart → pays by crypto or wallet → lands in the redesigned dashboard to manage the service.
- On a "Coming soon" product → the visitor can join a waitlist / ask to be notified.
- A returning customer → signs in → arrives at the redesigned dashboard.

## UI/UX feel
- **Palette & mood:** Hostman's actual look — deep near-black/navy canvas, crisp white surfaces, an electric/cobalt-blue primary accent, cool neutral grays, soft gradient/mesh glow behind the hero, thin subtle borders, rounded product cards with imagery.
- **Type & spacing:** clean geometric sans, large confident hero headline, strong hierarchy, generous whitespace.
- **Structure:** sticky top nav with a product mega-menu, grouped/tabbed product cards, a "verify our standards" trust band, consistent section rhythm across every page.
- **Motion:** restrained reveal-on-scroll and hover lifts; nothing noisy.
- **Voice:** visually Hostman, verbally Nameword — privacy, offshore jurisdictions, DMCA-ignored, no-KYC, pay-with-crypto stay front and center.

## Implementation phases

### Phase 1 — built now (the full platform, one pass)
Re-skin the entire platform to the new Hostman-grade design system in a single pass:
- New global design system (palette, theme, typography, shared components, nav, footer) in both dark and light.
- All marketing pages redesigned.
- All product pages redesigned; existing products stay fully functional; new cloud categories added as polished "Coming soon" pages with a working notify/waitlist.
- Auth, cart and crypto checkout redesigned.
- The complete logged-in dashboard redesigned, with all current features intact.
No new real infrastructure is added in Phase 1 — the new product categories are presentational + waitlist only.

### Phase 2 — later
Turn the single highest-priority "Coming soon" product into a real, working product (provisioning, pricing, wallet/crypto billing, and dashboard management), using a real provider integration.

### Phase 3 — later
Bring the remaining new products online, plus Hostman-style enterprise extras (public status page, referrals/credits program, deeper developer/API surface).

## Assumptions
- **Visual match, not a clone:** we adopt Hostman's palette, layout and polish, but keep Nameword's own name, logo and privacy/offshore copy. We do not copy Hostman's text, screenshots or trademarks. Exact color/type tokens are matched closely to the live site, not pixel-perfect.
- **No fabricated credentials:** the trust strip states Nameword's real guarantees (privacy, crypto, offshore, uptime). We do not display copied ISO/GDPR certifications Nameword doesn't hold.
- **Existing products stay live and unchanged in function** — this is a redesign, not a rebuild; domains, DNS, hosting, VPS, RDP, wallet and checkout keep working as they do today.
- **New product taxonomy** mirrors Hostman's catalog (Cloud Servers, Bare Metal, App Platform, Managed Databases, Managed Kubernetes, Object/Block Storage, Load Balancers, AI Agents). Where a new category overlaps something Nameword already sells (e.g. VPS ≈ Cloud Servers), the existing live product is folded into the new taxonomy rather than duplicated.
- **"Coming soon" = real interest capture**, not fake dashboards: a notify/waitlist form (email via the already-connected Brevo) with no simulated resources.
- **Both dark and light themes** are kept.
- **Placeholder integrations remain inert** (Telegram login, WHM, Plesk, Cloudflare, Telnyx, cloud storage, SMTP) until real keys are supplied; they are not faked.
- The redesign spans the whole app in one pass per the stated preference; this is a large Phase 1, accepted as the chosen scope.

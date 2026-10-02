# hosta.sh — Brand Discovery & Identity

A research-led rebrand of Nameword into **hosta.sh**: first understand who the customers really are, then define the brand personality, colours, type and logo.
Everything is delivered as a private, reviewable brand guide page; the new identity is applied to the live app only after approval.

## Who it's for
- **Decision-makers (the owner/team):** review the research, pick a colour direction and a logo, and approve the final brand kit.
- **The customers the brand must speak to** (to be confirmed by the research): privacy-first and offshore site operators, developers and sysadmins buying VPS/RDP, and crypto-native buyers who pay without KYC, across English, Spanish and French.

## Core features and experience
The deliverable is one brand guide page with these sections:

1. **Customer snapshot (anonymised).** Aggregate facts from the real customer base:
   - product mix (domains, hosting, VPS, RDP) and popular TLDs;
   - wallet vs crypto payments, and which coins;
   - language, sign-up method (email, Google, Telegram) and typical order size.

   No names, emails or individual records are shown.
2. **Market scan.** About 8 offshore/privacy hosting competitors plus 2–3 well-loved developer-tool brands. It shows how they look and sound, where the market is crowded, and the visual gap hosta.sh can own.
3. **Personas.** 3–4 customer personas. Each has goals, fears, what makes them trust a provider and what makes them leave, plus the words they use.
4. **Brand personality.** This section covers:
   - the brand archetype and 3–5 traits;
   - a voice guide with do/don't examples;
   - the brand story (".sh" = shell command line + Saint Helena, a remote offshore island);
   - 3 tagline options.
5. **Three colour directions, all within the chosen hacker/terminal feel.** Each comes with:
   - a full palette;
   - live previews in dark and light mode (button, card, terminal prompt, sample landing hero, dashboard header);
   - readability (contrast) checks.

   Working names for the directions:
   - "Phosphor": classic green-on-black;
   - "Amber Shell": warm amber terminal;
   - "Neon Prompt": modern acid/cyan developer tool.
6. **Typography.** A monospace + readable sans pairing (free fonts only), with a heading/body scale.
7. **Three logo concepts in the chosen palette**, each with:
   - a full lowercase "hosta.sh" wordmark (".sh" may be accented);
   - an icon mark;
   - a favicon-size test;
   - dark/light versions.
8. **Final brand kit (after both picks):**
   - logo files in every variant;
   - clear-space and minimum-size rules, plus misuse examples;
   - final palette (light + dark + status colours) and type;
   - "brand in use" mockups (landing hero, dashboard, email header, social avatar).

## User flow
1. Open the private brand guide link.
2. Read the customer snapshot, market scan, personas and brand personality.
3. Compare the 3 colour directions side by side, toggling dark/light → **pick one**.
4. Review the 3 logo concepts shown in the chosen palette → **pick one**.
5. The guide updates into the final brand kit with downloads.
6. Approve the kit; Phase 2 (applying it to the app) can then start.

## UI/UX feel
- The guide itself is dressed in the hacker/terminal feel, so it previews the brand in practice: dark-first, with command-line style section headers (e.g. `$ cat personas.md`) and monospace accents.
- Long-form text stays in a readable sans for comfort.
- Calm grid layout with generous spacing.
- Works on desktop and phone, with a dark/light preview toggle.
- Trustworthy rather than shady: no hooded hackers, skulls, padlocks, "Matrix rain" or piracy imagery, because the business takes payments and must feel safe.

## Implementation phases
**Phase 1 — MVP (built now): Brand discovery + identity**
- Customer snapshot, market scan, personas, brand personality and taglines.
- 3 colour directions → user pick; typography; 3 logo concepts → user pick.
- Final brand kit with downloadable logo files, all on the private brand guide page.
- The live app (name, logo, colours) is not changed in this phase.

**Phase 2 — Apply the brand to the app**
- Replace the name and logo everywhere, including the favicon and browser/social previews.
- Recolour light and dark mode to the new palette and switch to the new fonts.
- New landing hero copy/tagline, all 33 emails re-skinned, and EN/ES/FR text updated.
- A "Nameword is now hosta.sh" notice for existing customers.

**Phase 3 — Go live on hosta.sh + launch kit**
- Run the site on the hosta.sh domain, with redirects from the old Nameword addresses.
- Update Google sign-in to the new domain and switch the email sender to a verified hosta.sh address.
- Launch kit: social avatars/banners, link-preview images and a launch announcement email.
- Optional terminal-style motion, such as a typing hero line.

## Assumptions
- The brand guide is a private, unlinked page inside the existing app, reachable by URL only and hidden from customers.
- Customer research uses aggregate statistics only. With about 66 accounts the sample is small, so findings are treated as directional, not definitive.
- The user's choice of hacker/terminal is respected: all 3 directions are variations within that feel, not different feels.
- Fresh start: no Nameword indigo, "Keyhole N" mark or old gradients carry over.
- The name is always written lowercase as "hosta.sh", with ".sh" part of the name.
- Logos are clean vector artwork that stays crisp at favicon size and works on dark and light backgrounds.
- Only free/open-source fonts are used, so there are no licence costs.
- Text colours meet standard readability contrast (WCAG AA) in both modes.
- Brand voice and taglines are written in English first; Spanish/French versions follow in Phase 2.
- The hosta.sh domain is owned (or will be) by the user; connecting it happens in Phase 3.
- Products, prices and checkout stay exactly the same; this is a rebrand only.
- Two decision points sit inside Phase 1 (colour pick, then logo pick); the final kit is produced after both.

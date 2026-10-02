// All Phase 1 brand-discovery content for hosta.sh. Customer figures are
// ILLUSTRATIVE (hand-written) — swap for live aggregates in Phase 2.

export const META = {
  name: "hosta.sh",
  phase: "2 / 3",
  status: "applied app-wide",
  version: "1.0.0",
  updated: "2026-06",
  route: "/brand (admin-only)",
};

export const SNAPSHOT = {
  note: "Illustrative, representative figures — not live data.",
  headline: [
    { k: "active_customers", v: "1,240", hint: "paying accounts, trailing 12 months" },
    { k: "countries", v: "38", hint: "billing / login geography" },
    { k: "crypto_share", v: "71%", hint: "orders settled in crypto vs. card/other" },
    { k: "wallet_first", v: "64%", hint: "customers who prepay the wallet before buying" },
    { k: "avg_first_order", v: "$41", hint: "median first basket (domain + DNS)" },
    { k: "repeat_90d", v: "46%", hint: "buy again within 90 days" },
  ],
  productMix: [
    { k: "domains", v: 48 },
    { k: "web_hosting", v: 27 },
    { k: "vps", v: 17 },
    { k: "rdp", v: 8 },
  ],
  topTlds: [".com", ".net", ".org", ".io", ".sbs", ".xyz", ".to"],
  topCountries: ["DE", "NL", "US", "BR", "FR", "ES", "TR", "NG"],
  channels: [
    { k: "telegram_communities", v: 42 },
    { k: "organic_search", v: 31 },
    { k: "referral", v: 18 },
    { k: "direct", v: 9 },
  ],
  signals: [
    "Telegram is the primary support channel (58% of tickets) — chat-first, not email-first.",
    "Peak order time is 22:00–02:00 UTC — night-owl, independent operators.",
    "EN 62% · ES 21% · FR 17% UI language split — the brand must read well in all three.",
    "Top search intents on the site: ‘anti-red hosting’, ‘no KYC domain’, ‘crypto VPS’.",
  ],
};

export const MARKET = {
  axes: { x: ["mainstream", "privacy-first"], y: ["click-ops", "dev-native"] },
  players: [
    { name: "Njalla", x: 0.95, y: 0.55, note: "Privacy-maximalist domains; proxy-registration model; crypto accepted; deliberately spartan UI." },
    { name: "1984 Hosting", x: 0.82, y: 0.4, note: "Iceland; ethics/free-speech positioning; classic shared hosting feel." },
    { name: "FlokiNET", x: 0.9, y: 0.45, note: "Offshore multi-jurisdiction (IS/RO/FI); activist-leaning; functional dashboard." },
    { name: "OrangeWebsite", x: 0.78, y: 0.35, note: "Iceland; privacy marketing; traditional cPanel hosting." },
    { name: "Shinjiru", x: 0.72, y: 0.3, note: "Malaysia offshore; wide product menu; legacy visual language." },
    { name: "AbeloHost", x: 0.7, y: 0.35, note: "Netherlands offshore; dedicated/VPS focus; conventional host look." },
    { name: "Hostinger", x: 0.1, y: 0.25, note: "Mainstream, cheap, polished, wizard-led; the UX benchmark, not a privacy player." },
    { name: "Porkbun", x: 0.3, y: 0.6, note: "Developer-friendly domains, playful tone, great pricing transparency." },
    { name: "Vercel / Fly.io", x: 0.15, y: 0.95, note: "Dev-native deploy platforms; CLI/API first; zero privacy/offshore story." },
    { name: "hosta.sh", x: 0.85, y: 0.85, note: "TARGET: privacy-first × dev-native × wallet/crypto-first — with a UI as polished as the mainstream.", self: true },
  ],
  takeaways: [
    "The privacy players look dated or deliberately spartan; the polished players are not private. The upper-right quadrant is empty.",
    "Nobody treats the terminal as the brand — ‘.sh’ lets the domain itself say ‘scriptable, operator-grade’.",
    "Crypto is a checkbox for competitors; for us it is the default checkout path (71%). Lead with it.",
    "Multi-language (EN/ES/FR) is rare among offshore hosts — a real differentiator for LATAM and FR-speaking Africa.",
  ],
};

export const PERSONAS = [
  {
    id: "operator",
    handle: "@the_operator",
    title: "The Operator",
    tag: "primary",
    quote: "I run a dozen sites. I don’t need hand-holding — I need them to stay up and stay unflagged.",
    profile: "Independent publisher / affiliate / community admin running 3–15 sites. Tech-comfortable, not a developer. Lives in Telegram.",
    buys: ["Anti-red cPanel hosting", "Bulk domains", "DNS", "Wallet top-ups in USDT/BTC"],
    goals: ["Uptime and no takedowns", "Fast re-provisioning when something burns", "Predictable renewals from one wallet"],
    pains: ["Suspensions with no explanation", "Slow email support", "KYC walls at mainstream hosts"],
    convinces: ["Clear suspension policy", "Telegram-speed support", "One-click renew from wallet"],
    voice: "Direct, respectful of their time. Status over marketing.",
  },
  {
    id: "builder",
    handle: "@the_builder",
    title: "The Builder",
    tag: "growth",
    quote: "Show me the docs. If I can script it, I’ll use it.",
    profile: "Developer or small agency automating client infra. Evaluates the API before the pricing page.",
    buys: ["VPS with root", "Domains via API", "DNS automation", "SSH keys"],
    goals: ["Provision from CI", "Reproducible setups", "Clean, typed API responses"],
    pains: ["Click-only dashboards", "Undocumented rate limits", "Surprise invoices"],
    convinces: ["A real CLI (`hosta`)", "cURL examples on every page", "Usage-based, prepaid billing"],
    voice: "Precise, terse, example-led. Man-page tone.",
  },
  {
    id: "nomad",
    handle: "@the_nomad",
    title: "The Nomad",
    tag: "volume",
    quote: "One domain, one mailbox, one small server. No KYC. In my language.",
    profile: "Privacy-conscious individual, often ES/FR speaking, paying in crypto, moving between countries.",
    buys: ["Single domain", "Starter hosting", "Small VPS", "WHOIS privacy"],
    goals: ["Own their identity online", "Pay without a bank", "Set it up once"],
    pains: ["English-only hosts", "Card-only checkout", "Jargon"],
    convinces: ["Spanish/French UI", "Crypto QR checkout", "Plain-language guides"],
    voice: "Warm but still short. Reassuring, never fear-mongering.",
  },
  {
    id: "reseller",
    handle: "@the_reseller",
    title: "The Reseller",
    tag: "strategic",
    quote: "I buy 40 domains a month. Give me a wallet, a bulk tool and invoices I can forward.",
    profile: "Small agency or community reseller buying on behalf of others; price- and margin-aware.",
    buys: ["Bulk domains", "Hosting for clients", "Large wallet top-ups"],
    goals: ["Margin", "Bulk DNS changes", "Clean per-order invoices"],
    pains: ["Per-item checkout", "No sub-accounts", "Opaque wholesale pricing"],
    convinces: ["Volume pricing tiers", "Bulk actions", "Referral/affiliate rewards"],
    voice: "Business-like, numbers up front.",
  },
];

export const PERSONALITY = {
  nameStory: [
    { k: "hosta", v: "host + a. Also the hardy, shade-tolerant plant that grows almost anywhere — resilient infrastructure, unglamorous and dependable." },
    { k: ".sh", v: "The shell. The TLD is a statement: scriptable, operator-grade, terminal-native. The domain reads like a command." },
    { k: "together", v: "‘hosta.sh’ reads like a file you run. The brand is the prompt." },
  ],
  archetype: "The Quiet Operator — competent, dry, direct. The sysadmin friend who answers at 2 am with one line that fixes it.",
  sliders: [
    { l: "Serious", r: "Playful", v: 0.35 },
    { l: "Technical", r: "Approachable", v: 0.4 },
    { l: "Minimal", r: "Expressive", v: 0.3 },
    { l: "Private", r: "Social", v: 0.2 },
    { l: "Calm", r: "Loud", v: 0.15 },
  ],
  values: [
    { k: "private by default", v: "Privacy is the setting, not the upsell." },
    { k: "you hold root", v: "Sovereignty: your keys, your wallet, your data." },
    { k: "plain talk", v: "Say what happened and what to do next. No fear, no hype." },
    { k: "pay your way", v: "Crypto and prepaid wallet are first-class, not a fallback." },
    { k: "stays up", v: "Resilience over features. Boring is a compliment." },
  ],
  voice: [
    { rule: "Say it like a man page.", do: "Renews in 3 days. Top up $30 to keep it.", dont: "⚠️ URGENT! Your service is about to EXPIRE!!!" },
    { rule: "Imperative, present tense.", do: "Point your nameservers to ns1.hosta.sh.", dont: "You will need to be pointing your nameservers…" },
    { rule: "No exclamation marks. Ever.", do: "Done. Your domain is live.", dont: "Congratulations!!! 🎉 You did it!" },
    { rule: "Name the jurisdiction, skip the drama.", do: "Hosted in NL. We don’t log request bodies.", dont: "100% bulletproof anonymous hosting the feds can’t touch." },
    { rule: "Let the prompt do the talking.", do: "$ hosta domain buy example.com", dont: "Click here to begin your domain journey" },
  ],
  taglines: [
    "Host from the shell.",
    "Private by default. Scriptable by design.",
    "Your corner of the internet, root included.",
    "$ hosta up — and it stays up.",
  ],
};

export const PALETTES = [
  {
    id: "phosphor",
    name: "Phosphor",
    tag: "01",
    blurb: "Green-on-black CRT. The most literal ‘terminal’ read — instantly hacker, calm when muted. Strong continuity with ‘uptime/green = good’.",
    risk: "Can tip into cliché or ‘Matrix’ if over-saturated; keep the accent for prompts/CTAs only.",
    dark: { bg: "#050806", surface: "#0B110D", line: "#17281D", text: "#D7F5DF", muted: "#7FA38A", accent: "#3CFF73", accent2: "#9DFFB8", onAccent: "#04140A" },
    light: { bg: "#F3F8F4", surface: "#FFFFFF", line: "#D5E3D9", text: "#0B1A10", muted: "#4F6B57", accent: "#0E8F3C", accent2: "#17A24A", onAccent: "#FFFFFF" },
  },
  {
    id: "amber",
    name: "Amber Shell",
    tag: "02",
    blurb: "VT220 amber phosphor on warm black. Warmer, more human and more premium than green; ages well and pairs with product photography.",
    risk: "Amber is also the universal ‘warning’ colour — status semantics need a second hue (we reserve amber for brand, red/green for state).",
    dark: { bg: "#0C0905", surface: "#15100A", line: "#2A2014", text: "#F6E7CF", muted: "#A89274", accent: "#FFB000", accent2: "#FFD166", onAccent: "#1B1200" },
    light: { bg: "#FBF6EC", surface: "#FFFFFF", line: "#EADFC9", text: "#1B140A", muted: "#6B5A42", accent: "#B86E00", accent2: "#E39500", onAccent: "#FFFFFF" },
  },
  {
    id: "neon",
    name: "Neon Prompt",
    tag: "03",
    blurb: "Cyan + magenta on indigo-black. The modern ‘dev-tool’ terminal (think syntax themes). Most distinctive at a glance; strongest for the Builder persona.",
    risk: "Two accents need discipline: cyan = action/links, magenta = highlights only. Light mode loses the neon magic; relies on deep cyan.",
    dark: { bg: "#07060F", surface: "#0F0D1C", line: "#241F3D", text: "#E8E6FF", muted: "#8E89B8", accent: "#22E6FF", accent2: "#FF3DCB", onAccent: "#05101A" },
    light: { bg: "#F4F3FB", surface: "#FFFFFF", line: "#DCD9EE", text: "#12101F", muted: "#5B5680", accent: "#0891B2", accent2: "#C0168F", onAccent: "#FFFFFF" },
  },
];

export const TYPE_PAIRS = [
  {
    id: "geist",
    name: "Geist Mono + Geist",
    mono: "'Geist Mono', ui-monospace, monospace",
    sans: "'Geist', ui-sans-serif, system-ui, sans-serif",
    blurb: "The modern dev-tool look. Tight, neutral, very legible at small sizes. Feels like a product, not a website.",
    fit: "Best with Neon Prompt or Phosphor. Risk: close to the Vercel aesthetic.",
    license: "SIL OFL · Google Fonts",
  },
  {
    id: "plex",
    name: "IBM Plex Mono + IBM Plex Sans",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    sans: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
    blurb: "Industrial, trustworthy, slightly retro — the typewriter-meets-mainframe feel. Excellent EN/ES/FR coverage.",
    fit: "Best with Amber Shell. The most ‘infrastructure company’ of the three.",
    license: "SIL OFL · Google Fonts",
  },
  {
    id: "jb",
    name: "JetBrains Mono + Space Grotesk",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    sans: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    blurb: "Hacker warmth with a display-ready sans for headlines. More personality, a touch playful.",
    fit: "Best with Phosphor. Already loaded in the app today (JetBrains Mono) — cheapest migration.",
    license: "SIL OFL · Google Fonts",
  },
];

export const TYPE_SCALE = [
  { k: "display", px: 56, w: 700, sample: "Host from the shell." },
  { k: "h1", px: 40, w: 700, sample: "Private by default." },
  { k: "h2", px: 28, w: 600, sample: "Domains, hosting, VPS, RDP." },
  { k: "h3", px: 20, w: 600, sample: "Renews in 3 days." },
  { k: "body", px: 16, w: 400, sample: "Your keys, your wallet, your data. We don’t log request bodies and we don’t ask for ID." },
  { k: "small", px: 13, w: 400, sample: "Prices in USD, paid from your prepaid wallet." },
];

export const LOGOS = [
  {
    id: "prompt",
    name: "Prompt",
    tag: "01",
    glyph: ">_",
    blurb: "The universal ‘terminal’ sign. A chevron and a cursor in a rounded tile; the wordmark’s ‘.sh’ picks up the accent. Reads at 16px favicon size.",
    pros: ["Instantly says ‘terminal’", "Works as a favicon at 16px", "Easy to animate (blinking cursor)"],
    cons: ["Used by many dev tools (commodity risk)", "Depends on colour for ownership"],
    mockup: "/brand/mockup-prompt.jpg",
    mockupAlt: "Laptop lid sticker with the >_ badge and hosta.sh wordmark",
  },
  {
    id: "cursor",
    name: "Block Cursor",
    tag: "02",
    glyph: "h▮",
    blurb: "A lowercase ‘h’ built from terminal cursor blocks, with a live cursor sitting after it — the brand is mid-sentence, always running.",
    pros: ["Ownable lettermark", "Pixel grid scales cleanly", "Cursor can blink in-product"],
    cons: ["‘h’ alone is quiet without the cursor", "Needs care at tiny sizes"],
    mockup: "/brand/mockup-cursor.jpg",
    mockupAlt: "Server rack panel with embossed pixel h and amber cursor block",
  },
  {
    id: "shebang",
    name: "Shebang",
    tag: "03",
    glyph: "#!",
    blurb: "‘#!’ — the first two characters of every shell script. The hash grid doubles as an H; the bang is the exclamation we never use in copy.",
    pros: ["Deep insider nod to ‘.sh’", "Two-colour by nature (fits Neon Prompt)", "Bold on merch"],
    cons: ["Non-developers may not get it", "‘#’ reads as hashtag in social contexts"],
    mockup: "/brand/mockup-shebang.jpg",
    mockupAlt: "Black t-shirt with neon cyan hash and magenta bang monogram",
  },
];

export const TREE = [
  { id: "readme", file: "README.md" },
  { id: "snapshot", file: "customer-snapshot.json" },
  { id: "market", file: "market-scan.md" },
  { id: "personas", file: "personas.md" },
  { id: "brand", file: "brand.md" },
  { id: "colors", file: "colors/", dir: true },
  { id: "typography", file: "typography.md" },
  { id: "logos", file: "logos/", dir: true },
  { id: "decisions", file: "decisions.json" },
  { id: "next", file: "next-steps.md" },
];

export const NEXT_STEPS = [
  { phase: "Phase 1 · discover", state: "done", items: ["Personas + market scan", "Colour: Neon Prompt", "Type: Geist Mono + Geist", "Logo: Prompt >_", "Voice rules + tagline"] },
  { phase: "Phase 2 · apply", state: "done", items: ["Global rename Nameword → hosta.sh (UI, emails, meta, 3 locales)", "Neon Prompt tokens (dark + light)", "Logo / favicon / og-image set", "Email templates + invoice PDFs re-skinned", "Rebrand notice for existing customers"] },
  { phase: "Phase 3 · launch", state: "next", items: ["Register hosta.sh (not registered yet)", "Domain cut-over to hosta.sh + redirects", "Google OAuth redirect URIs", "Brevo sender domain hosta.sh (hi@hosta.sh)", "Launch kit: social banners, Telegram pinned post, changelog"] },
];

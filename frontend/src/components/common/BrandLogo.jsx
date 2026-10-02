// hosta.sh "Prompt" brand logo — Neon Prompt palette (brand guide Phase 2).
// Mark: rounded tile + ">" chevron + "_" block cursor. Theme-aware exactly like the
// brand guide lockups (tile = text colour of the mode, glyph = background colour):
//   light mode → ink tile #12101F, white chevron, neon-cyan cursor #22E6FF
//   dark mode  → lavender tile #E8E6FF, ink chevron, deep-cyan cursor #0891B2
// The wordmark is real HTML text in Geist Mono — "hosta" in ink + ".sh" in the accent.

const TONES = {
  // follows the html.dark class
  auto: {
    tile: "fill-[#12101F] dark:fill-[#E8E6FF]",
    glyph: "stroke-white dark:stroke-[#07060F]",
    cursor: "fill-[#22E6FF] dark:fill-[#0891B2]",
    word: "text-[#12101F] dark:text-[#E8E6FF]",
    sh: "text-[#087C9C] dark:text-[#22E6FF]",
  },
  // always-dark surfaces (auth showcase panel, dark banners)
  onDark: {
    tile: "fill-[#E8E6FF]",
    glyph: "stroke-[#07060F]",
    cursor: "fill-[#0891B2]",
    word: "text-[#E8E6FF]",
    sh: "text-[#22E6FF]",
  },
};

export const HostaMark = ({ className = "h-8 w-8", tone = "auto", blink = false }) => {
  const c = TONES[tone] || TONES.auto;
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="64" height="64" rx="14" className={c.tile} />
      <path
        d="M17 20 L31 32 L17 44"
        className={c.glyph}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="35" y="39.5" width="15" height="6.5" rx="2" className={`${c.cursor} ${blink ? "hs-mark-cursor" : ""}`} />
    </svg>
  );
};

// Back-compat alias (older imports referenced the previous mark by name)
export const NamewordMark = HostaMark;

export const Wordmark = ({ className = "text-[1.45rem]", tone = "auto" }) => {
  const c = TONES[tone] || TONES.auto;
  return (
    <span className={`font-mono font-semibold leading-none tracking-[-0.03em] ${c.word} ${className}`} translate="no">
      hosta<span className={c.sh}>.sh</span>
    </span>
  );
};

const BrandLogo = ({
  markClassName = "h-8 w-8",
  textClassName = "text-[1.45rem]",
  showText = true,
  className = "",
  tone = "auto",
}) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`} data-testid="brand-logo" aria-label="hosta.sh">
    <HostaMark className={markClassName} tone={tone} />
    {showText && <Wordmark className={textClassName} tone={tone} />}
  </span>
);

export default BrandLogo;

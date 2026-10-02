// Three hosta.sh logo concepts as recolourable inline SVG marks (64×64 grid).

export function PromptMark({ size = 48, bg = "#F3F6FA", fg = "#07080A", accent = "#7EE0A6", tile = true, title = "Prompt mark" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      {tile && <rect width="64" height="64" rx="14" fill={bg} />}
      <path d="M17 20 L31 32 L17 44" stroke={tile ? fg : bg} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="35" y="39.5" width="15" height="6.5" rx="2" fill={accent} />
    </svg>
  );
}

export function CursorMark({ size = 48, bg = "#F3F6FA", fg = "#07080A", accent = "#7EE0A6", tile = true, title = "Block cursor mark" }) {
  const ink = tile ? fg : bg;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      {tile && <rect width="64" height="64" rx="14" fill={bg} />}
      <rect x="11" y="9" width="10" height="46" rx="1.5" fill={ink} />
      <rect x="21" y="23" width="9" height="10" rx="1.5" fill={ink} />
      <rect x="30" y="23" width="10" height="32" rx="1.5" fill={ink} />
      <rect x="45" y="41" width="9" height="14" rx="1.5" fill={accent} />
    </svg>
  );
}

export function ShebangMark({ size = 48, bg = "#F3F6FA", fg = "#07080A", accent = "#7EE0A6", accent2, tile = true, title = "Shebang mark" }) {
  const ink = tile ? fg : bg;
  const bang = accent2 || accent;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title}>
      {tile && <rect width="64" height="64" rx="14" fill={bg} />}
      <rect x="15" y="11" width="6" height="42" rx="1.5" fill={ink} />
      <rect x="27" y="11" width="6" height="42" rx="1.5" fill={ink} />
      <rect x="9" y="22" width="30" height="6" rx="1.5" fill={accent} />
      <rect x="9" y="36" width="30" height="6" rx="1.5" fill={accent} />
      <rect x="45" y="11" width="7" height="27" rx="3" fill={bang} />
      <circle cx="48.5" cy="48.5" r="4.2" fill={bang} />
    </svg>
  );
}

export function Wordmark({ color = "#F3F6FA", accent = "#7EE0A6", size = 22, weight = 600 }) {
  return (
    <span className="hb-mono" style={{ color, fontSize: size, fontWeight: weight, letterSpacing: "-0.02em", lineHeight: 1 }}>
      hosta<span style={{ color: accent }}>.sh</span>
    </span>
  );
}

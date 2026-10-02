// WCAG 2.x relative-luminance contrast helpers for the palette previews.
const chan = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};

export const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
};

export const contrast = (a, b) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10;
};

export const wcagLabel = (ratio) => (ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA-large" : "fail");

export const paletteVars = (p) => ({
  "--pv-bg": p.bg,
  "--pv-surface": p.surface,
  "--pv-line": p.line,
  "--pv-text": p.text,
  "--pv-muted": p.muted,
  "--pv-accent": p.accent,
  "--pv-accent-2": p.accent2,
  "--pv-on-accent": p.onAccent,
});

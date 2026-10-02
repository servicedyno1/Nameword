import { paletteVars, contrast, wcagLabel } from "../brandUtils";
import { PromptMark } from "./logos/Marks";

// Mini product UI rendered entirely from one palette (dark or light).
export default function PalettePreview({ palette, mode }) {
  const p = palette[mode];
  const wordmarkFont = { fontFamily: "var(--hb-mono)" };
  return (
    <div className="pv p-4 sm:p-5" style={paletteVars(p)} data-testid={`palette-preview-${palette.id}-${mode}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={wordmarkFont}>
          <PromptMark size={26} accent={p.accent} bg={p.text} fg={p.bg} />
          <span className="text-sm font-semibold">
            hosta<span className="pv-accent">.sh</span>
          </span>
        </div>
        <div className="flex gap-3 text-xs" style={wordmarkFont}>
          <span className="pv-muted">domains</span>
          <span className="pv-muted">hosting</span>
          <span className="pv-accent">wallet $142</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        <div className="pv-surface p-4 sm:col-span-3">
          <div className="text-[11px]" style={{ ...wordmarkFont, color: "var(--pv-muted)" }}>~ $ hosta domain buy</div>
          <div className="mt-1 text-xl font-semibold leading-tight">Private hosting, from the shell.</div>
          <p className="mt-1 text-xs leading-5 pv-muted">Crypto or wallet. No ID. DNS included.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="pv-btn pv-glow">$ buy example.sh</span>
            <span className="pv-btn ghost">docs</span>
          </div>
        </div>
        <div className="pv-surface p-4 sm:col-span-2">
          <div className="text-[11px] pv-muted" style={wordmarkFont}>example.sh</div>
          <div className="mt-1 flex items-baseline gap-1" style={wordmarkFont}>
            <span className="text-2xl font-bold pv-accent">$39</span>
            <span className="text-xs pv-muted">/yr</span>
          </div>
          <div className="mt-2 space-y-1 text-[11px]" style={wordmarkFont}>
            <div className="flex justify-between"><span className="pv-muted">status</span><span className="pv-accent">● active</span></div>
            <div className="flex justify-between"><span className="pv-muted">renews</span><span>in 3 days</span></div>
            <div className="flex justify-between"><span className="pv-muted">highlight</span><span className="pv-accent-2">new</span></div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]" style={wordmarkFont}>
        {[
          ["bg", p.bg],
          ["surface", p.surface],
          ["text", p.text],
          ["muted", p.muted],
          ["accent", p.accent],
          ["accent-2", p.accent2],
        ].map(([k, v]) => (
          <span key={k} className="pv-surface inline-flex items-center gap-1.5 px-1.5 py-0.5">
            <i className="h-3 w-3 rounded-sm" style={{ background: v, border: "1px solid var(--pv-line)" }} />
            <span className="pv-muted">{k}</span>
            <span>{v}</span>
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px]" style={{ ...wordmarkFont, color: "var(--pv-muted)" }} data-testid={`palette-contrast-${palette.id}-${mode}`}>
        <span>text/bg {contrast(p.text, p.bg)}:1 · {wcagLabel(contrast(p.text, p.bg))}</span>
        <span>accent/bg {contrast(p.accent, p.bg)}:1 · {wcagLabel(contrast(p.accent, p.bg))}</span>
        <span>on-accent {contrast(p.onAccent, p.accent)}:1 · {wcagLabel(contrast(p.onAccent, p.accent))}</span>
      </div>
    </div>
  );
}

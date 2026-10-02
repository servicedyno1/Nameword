import { useState } from "react";
import { LOGOS, PALETTES } from "../brandData";
import { Cmd, Section, Tag, Window, PickButton } from "./Term";
import { PromptMark, CursorMark, ShebangMark, Wordmark } from "./logos/Marks";
import { useDecisions } from "../useDecisions";

const MARKS = { prompt: PromptMark, cursor: CursorMark, shebang: ShebangMark };

function Lockup({ id, p, mode }) {
  const Mark = MARKS[id];
  const c = p[mode];
  // Tile = text colour of the mode, glyph = background colour → always maximum contrast.
  return (
    <div className="flex flex-col items-start gap-4 rounded-lg p-5 transition-colors duration-300" style={{ background: c.bg, border: `1px solid ${c.line}` }}>
      <div className="flex items-center gap-3">
        <Mark size={44} bg={c.text} fg={c.bg} accent={c.accent} accent2={c.accent2} />
        <Wordmark color={c.text} accent={c.accent} size={24} />
      </div>
      <div className="flex items-end gap-3" style={{ color: c.muted }}>
        {[16, 24, 32].map((s) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <Mark size={s} bg={c.text} fg={c.bg} accent={c.accent} accent2={c.accent2} />
            <span className="hb-mono text-[9px]">{s}</span>
          </div>
        ))}
        <div className="flex flex-col items-center gap-1">
          <Mark size={32} bg={c.accent} fg={c.onAccent} accent={c.text} accent2={c.accent2} />
          <span className="hb-mono text-[9px]">accent</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Mark size={32} tile={false} bg={c.text} accent={c.accent} accent2={c.accent2} />
          <span className="hb-mono text-[9px]">no tile</span>
        </div>
      </div>
    </div>
  );
}

function Concept({ logo, palette }) {
  return (
    <div className="hb-card overflow-hidden" data-testid={`logo-${logo.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            <Tag>{logo.tag}</Tag>
            <h3 className="hb-mono text-xl font-semibold" style={{ color: "var(--hb-text-strong)" }}>
              {logo.name} <span style={{ color: "var(--hb-dim)" }}>{logo.glyph}</span>
            </h3>
          </div>
          <p className="mt-2 text-sm leading-6">{logo.blurb}</p>
        </div>
        <PickButton kind="logo" id={logo.id} />
      </div>
      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Lockup id={logo.id} p={palette} mode="dark" />
          <Lockup id={logo.id} p={palette} mode="light" />
          <div className="grid gap-3 sm:grid-cols-2 text-xs leading-5">
            <div>
              <div className="hb-mono mb-1 text-[11px]" style={{ color: "var(--hb-ok)" }}>+ pros</div>
              <ul className="space-y-0.5">{logo.pros.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <div className="hb-mono mb-1 text-[11px]" style={{ color: "#ff7b7b" }}>- cons</div>
              <ul className="space-y-0.5" style={{ color: "var(--hb-muted)" }}>{logo.cons.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </div>
        <Window title={`logos/${logo.id}/in-the-wild.jpg`} className="self-start">
          <img src={logo.mockup} alt={logo.mockupAlt} loading="lazy" className="aspect-[3/2] w-full object-cover" data-testid={`logo-mockup-${logo.id}`} />
          <p className="hb-comment px-3 py-2 text-[11px]"># AI-rendered mood mockup — illustrative, not final artwork</p>
        </Window>
      </div>
    </div>
  );
}

export default function LogoConcepts() {
  const { picks } = useDecisions();
  const [paletteId, setPaletteId] = useState(null);
  const activeId = paletteId || picks.palette || PALETTES[0].id;
  const palette = PALETTES.find((p) => p.id === activeId) || PALETTES[0];

  return (
    <Section id="logos">
      <Cmd cmd="ls logos/ && open logos/*" comment="3 concepts as live SVG · recoloured by the colour direction below · favicon sizes 16/24/32" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="hb-mono text-xs" style={{ color: "var(--hb-muted)" }}>render with:</span>
        <div className="hb-seg" role="group" aria-label="Logo palette">
          {PALETTES.map((p) => (
            <button key={p.id} type="button" className={activeId === p.id ? "on" : ""} onClick={() => setPaletteId(p.id)} data-testid={`logo-palette-${p.id}`}>
              {p.name}
            </button>
          ))}
        </div>
        {picks.palette && !paletteId && <Tag tone="ok">following your preferred palette</Tag>}
      </div>
      <div className="space-y-5">
        {LOGOS.map((l) => (
          <Concept key={l.id} logo={l} palette={palette} />
        ))}
      </div>
    </Section>
  );
}

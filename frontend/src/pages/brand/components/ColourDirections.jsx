import { useState } from "react";
import { PALETTES } from "../brandData";
import { Cmd, Section, Tag, PickButton } from "./Term";
import PalettePreview from "./PalettePreview";

function Direction({ palette, index }) {
  const [mode, setMode] = useState("dark");
  return (
    <div className="hb-card overflow-hidden hb-rise" style={{ animationDelay: `${index * 80}ms` }} data-testid={`palette-${palette.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="max-w-xl">
          <div className="flex items-center gap-2">
            <Tag>{palette.tag}</Tag>
            <h3 className="hb-mono text-xl font-semibold" style={{ color: "var(--hb-text-strong)" }}>{palette.name}</h3>
          </div>
          <p className="mt-2 text-sm leading-6">{palette.blurb}</p>
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--hb-muted)" }}>
            <span style={{ color: "var(--hb-warn)" }}>risk:</span> {palette.risk}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hb-seg" role="group" aria-label="Preview mode">
            <button type="button" className={mode === "dark" ? "on" : ""} onClick={() => setMode("dark")} data-testid={`palette-${palette.id}-dark`}>dark</button>
            <button type="button" className={mode === "light" ? "on" : ""} onClick={() => setMode("light")} data-testid={`palette-${palette.id}-light`}>light</button>
          </div>
          <PickButton kind="palette" id={palette.id} />
        </div>
      </div>
      <div className="px-5 pb-5">
        <PalettePreview palette={palette} mode={mode} />
      </div>
    </div>
  );
}

export default function ColourDirections() {
  return (
    <Section id="colors">
      <Cmd cmd="ls colors/ && cat colors/*.css" comment="3 directions · dark-first · each preview is a real mini UI, toggle light to stress-test" />
      <div className="space-y-5">
        {PALETTES.map((p, i) => (
          <Direction key={p.id} palette={p} index={i} />
        ))}
      </div>
    </Section>
  );
}

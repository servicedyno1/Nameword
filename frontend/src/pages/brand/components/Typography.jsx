import { useState } from "react";
import { TYPE_PAIRS, TYPE_SCALE } from "../brandData";
import { Cmd, Section, Tag, Window, PickButton } from "./Term";

function Specimen({ pair }) {
  return (
    <div className="space-y-5 p-5" data-testid={`type-specimen-${pair.id}`}>
      {TYPE_SCALE.map((s) => (
        <div key={s.k} className="grid gap-1 sm:grid-cols-12 sm:items-baseline">
          <div className="hb-mono text-[11px] sm:col-span-2" style={{ color: "var(--hb-dim)" }}>
            {s.k} · {s.px}px
          </div>
          <div
            className="sm:col-span-10 leading-tight"
            style={{
              fontFamily: s.k === "body" || s.k === "small" ? pair.sans : s.k === "display" ? pair.mono : pair.sans,
              fontSize: `clamp(${Math.max(14, s.px * 0.6)}px, ${s.px / 16}rem, ${s.px}px)`,
              fontWeight: s.w,
              color: "var(--hb-text-strong)",
              letterSpacing: s.px >= 28 ? "-0.02em" : "0",
            }}
          >
            {s.sample}
          </div>
        </div>
      ))}
      <div className="hb-rule" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="hb-mono mb-2 text-[11px]" style={{ color: "var(--hb-dim)" }}>mono · code / prices / labels</div>
          <pre className="rounded-md p-3 text-xs leading-6" style={{ fontFamily: pair.mono, background: "var(--hb-bg-3)", border: "1px solid var(--hb-line)", color: "var(--hb-text)" }}>
{`$ hosta domain buy example.sh
  example.sh ........ $39.00/yr  available
  dns ............... included
  whois privacy ..... on
$ hosta wallet
  balance ........... $142.00`}
          </pre>
        </div>
        <div>
          <div className="hb-mono mb-2 text-[11px]" style={{ color: "var(--hb-dim)" }}>sans · long-form (EN/ES/FR)</div>
          <p className="text-sm leading-6" style={{ fontFamily: pair.sans }}>
            Your keys, your wallet, your data. · Tus claves, tu billetera, tus datos. · Vos clés, votre portefeuille, vos données.
          </p>
          <p className="mt-2 text-sm leading-6" style={{ fontFamily: pair.sans, color: "var(--hb-muted)" }}>
            0123456789 ÀÉÎÕÜ àéîõü ñç ß — “quotes” &amp; ampersands; weights 400 / 500 / 600 / 700.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Typography() {
  const [active, setActive] = useState(TYPE_PAIRS[0].id);
  const pair = TYPE_PAIRS.find((p) => p.id === active);
  return (
    <Section id="typography">
      <Cmd cmd="cat typography.md" comment="monospace for the brand voice, a sans for reading · all open-licence · tabs switch the pairing" />
      <div className="grid gap-3 lg:grid-cols-3" role="tablist" data-testid="type-tabs">
        {TYPE_PAIRS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={active === p.id}
            data-testid={`type-tab-${p.id}`}
            onClick={() => setActive(p.id)}
            className="hb-card p-4 text-left"
            style={active === p.id ? { borderColor: "var(--hb-ok)" } : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold" style={{ fontFamily: p.mono, color: "var(--hb-text-strong)" }}>{p.name}</span>
              <Tag tone={active === p.id ? "ok" : ""}>{active === p.id ? "viewing" : "view"}</Tag>
            </div>
            <p className="mt-2 text-xs leading-5" style={{ fontFamily: p.sans, color: "var(--hb-muted)" }}>{p.blurb}</p>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Window title={`typography/${pair.id}.md`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "var(--hb-line)" }}>
            <div className="text-xs" style={{ color: "var(--hb-muted)" }}>
              <span style={{ color: "var(--hb-ok)" }}>fit:</span> {pair.fit} <span className="hb-mono ml-2" style={{ color: "var(--hb-dim)" }}>({pair.license})</span>
            </div>
            <PickButton kind="type" id={pair.id} />
          </div>
          <Specimen pair={pair} />
        </Window>
      </div>
    </Section>
  );
}

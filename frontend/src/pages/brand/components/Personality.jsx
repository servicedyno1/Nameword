import { PERSONALITY } from "../brandData";
import { Cmd, Section, Window, Kv } from "./Term";

function Slider({ l, r, v }) {
  return (
    <div className="hb-mono text-xs">
      <div className="mb-1 flex justify-between" style={{ color: "var(--hb-muted)" }}>
        <span>{l}</span>
        <span>{r}</span>
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background: "rgba(255,255,255,.07)" }}>
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm" style={{ left: `${v * 100}%`, background: "var(--hb-ok)", boxShadow: "0 0 12px rgba(126,224,166,.6)" }} />
      </div>
    </div>
  );
}

export default function Personality() {
  const P = PERSONALITY;
  return (
    <Section id="brand">
      <Cmd cmd="cat brand.md" comment="name · archetype · values · voice rules · taglines" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Window title="name.md">
          <div className="p-5">
            <Kv rows={P.nameStory} />
          </div>
        </Window>
        <Window title="archetype.md">
          <div className="p-5">
            <p className="text-sm leading-7">{P.archetype}</p>
            <div className="mt-5 space-y-4" data-testid="brand-sliders">
              {P.sliders.map((s) => (
                <Slider key={s.l} {...s} />
              ))}
            </div>
          </div>
        </Window>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Window title="values.md" className="lg:col-span-2">
          <ul className="divide-y p-2" style={{ borderColor: "var(--hb-line)" }}>
            {P.values.map((v) => (
              <li key={v.k} className="px-3 py-3">
                <div className="hb-mono text-sm font-semibold" style={{ color: "var(--hb-ok)" }}>{v.k}</div>
                <div className="mt-0.5 text-sm" style={{ color: "var(--hb-muted)" }}>{v.v}</div>
              </li>
            ))}
          </ul>
        </Window>
        <Window title="voice.md — do / don't" className="lg:col-span-3">
          <div className="divide-y" style={{ borderColor: "var(--hb-line)" }} data-testid="voice-rules">
            {P.voice.map((v) => (
              <div key={v.rule} className="grid gap-2 px-4 py-3 sm:grid-cols-5">
                <div className="hb-mono text-xs font-semibold sm:col-span-2" style={{ color: "var(--hb-text-strong)" }}>{v.rule}</div>
                <div className="hb-mono text-xs leading-5 sm:col-span-3">
                  <div className="flex gap-2"><span style={{ color: "var(--hb-ok)" }}>+</span><span>{v.do}</span></div>
                  <div className="flex gap-2" style={{ color: "var(--hb-dim)" }}><span style={{ color: "#ff7b7b" }}>-</span><span className="line-through decoration-[#ff7b7b]/60">{v.dont}</span></div>
                </div>
              </div>
            ))}
          </div>
        </Window>
      </div>

      <div className="mt-4">
        <div className="hb-mono mb-3 text-xs" style={{ color: "var(--hb-muted)" }}>## tagline candidates</div>
        <div className="grid gap-3 sm:grid-cols-2" data-testid="taglines">
          {P.taglines.map((t, i) => (
            <div key={t} className="hb-card p-5 hb-mono">
              <div className="text-[11px]" style={{ color: "var(--hb-dim)" }}>option {i + 1}</div>
              <div className="mt-1 text-lg md:text-xl" style={{ color: "var(--hb-text-strong)" }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

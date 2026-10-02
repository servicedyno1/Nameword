import { useState } from "react";
import { PERSONAS } from "../brandData";
import { Cmd, Section, Tag, Window } from "./Term";

const TONE = { primary: "ok", growth: "info", volume: "warn", strategic: "" };

function List({ label, items }) {
  return (
    <div>
      <div className="hb-mono mb-1.5 text-[11px] uppercase tracking-wider" style={{ color: "var(--hb-dim)" }}>{label}</div>
      <ul className="space-y-1 text-sm leading-6">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span style={{ color: "var(--hb-prompt)" }}>-</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Personas() {
  const [active, setActive] = useState(PERSONAS[0].id);
  const p = PERSONAS.find((x) => x.id === active);

  return (
    <Section id="personas">
      <Cmd cmd="cat personas.md" comment="4 personas · ordered by revenue weight · tabs switch the file" />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" data-testid="persona-tabs">
        {PERSONAS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={active === x.id}
            data-testid={`persona-tab-${x.id}`}
            onClick={() => setActive(x.id)}
            className={`hb-btn ${active === x.id ? "on" : ""}`}
          >
            {x.handle}
          </button>
        ))}
      </div>
      <Window title={`personas/${p.id}.md`}>
        <div className="grid gap-6 p-5 lg:grid-cols-3" data-testid={`persona-panel-${p.id}`}>
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <h3 className="hb-mono text-xl font-semibold" style={{ color: "var(--hb-text-strong)" }}>{p.title}</h3>
              <Tag tone={TONE[p.tag]}>{p.tag}</Tag>
            </div>
            <blockquote className="mt-3 border-l-2 pl-3 text-base italic leading-7 md:text-lg" style={{ borderColor: "var(--hb-ok)", color: "var(--hb-text)" }}>
              “{p.quote}”
            </blockquote>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--hb-muted)" }}>{p.profile}</p>
            <div className="mt-4">
              <div className="hb-mono mb-1.5 text-[11px] uppercase tracking-wider" style={{ color: "var(--hb-dim)" }}>voice for them</div>
              <p className="text-sm leading-6">{p.voice}</p>
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-2">
            <List label="buys" items={p.buys} />
            <List label="goals" items={p.goals} />
            <List label="pains" items={p.pains} />
            <List label="what convinces" items={p.convinces} />
          </div>
        </div>
      </Window>
    </Section>
  );
}

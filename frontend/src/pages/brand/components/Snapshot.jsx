import { SNAPSHOT } from "../brandData";
import { Cmd, Section, Tag, Bar, Window } from "./Term";

const COLORS = ["#8fb3ff", "#7ee0a6", "#f5c76b", "#ff8fab"];

export default function Snapshot() {
  return (
    <Section id="snapshot">
      <Cmd cmd="cat customer-snapshot.json | jq" comment={SNAPSHOT.note} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="snapshot-stats">
        {SNAPSHOT.headline.map((s, i) => (
          <div key={s.k} className="hb-card p-4 hb-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="hb-mono text-xs" style={{ color: "var(--hb-muted)" }}>
              "{s.k}":
            </div>
            <div className="hb-mono mt-1 text-3xl font-semibold" style={{ color: "var(--hb-text-strong)" }}>
              {s.v}
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--hb-dim)" }}>{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Window title="product_mix (% of revenue)">
          <div className="space-y-3 p-4">
            {SNAPSHOT.productMix.map((p, i) => (
              <div key={p.k}>
                <div className="hb-mono mb-1 flex justify-between text-xs">
                  <span>{p.k}</span>
                  <span style={{ color: "var(--hb-muted)" }}>{p.v}%</span>
                </div>
                <Bar value={p.v} color={COLORS[i % COLORS.length]} />
              </div>
            ))}
          </div>
        </Window>
        <Window title="acquisition_channels (%)">
          <div className="space-y-3 p-4">
            {SNAPSHOT.channels.map((p, i) => (
              <div key={p.k}>
                <div className="hb-mono mb-1 flex justify-between text-xs">
                  <span>{p.k}</span>
                  <span style={{ color: "var(--hb-muted)" }}>{p.v}%</span>
                </div>
                <Bar value={p.v} color={COLORS[(i + 1) % COLORS.length]} />
              </div>
            ))}
          </div>
        </Window>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="hb-card p-4">
          <div className="hb-mono mb-2 text-xs" style={{ color: "var(--hb-muted)" }}>top_tlds</div>
          <div className="flex flex-wrap gap-1.5">
            {SNAPSHOT.topTlds.map((t) => (
              <Tag key={t} tone="info">{t}</Tag>
            ))}
          </div>
        </div>
        <div className="hb-card p-4">
          <div className="hb-mono mb-2 text-xs" style={{ color: "var(--hb-muted)" }}>top_countries</div>
          <div className="flex flex-wrap gap-1.5">
            {SNAPSHOT.topCountries.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        </div>
        <div className="hb-card p-4">
          <div className="hb-mono mb-2 text-xs" style={{ color: "var(--hb-muted)" }}>signals</div>
          <ul className="space-y-2 text-sm leading-6">
            {SNAPSHOT.signals.map((s) => (
              <li key={s} className="flex gap-2">
                <span style={{ color: "var(--hb-ok)" }}>›</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

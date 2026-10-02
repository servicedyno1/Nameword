import { MARKET } from "../brandData";
import { Cmd, Section, Window } from "./Term";

function PositioningMap() {
  const { axes, players } = MARKET;
  return (
    <Window title="positioning.map — x: mainstream → privacy-first · y: click-ops → dev-native">
      <div className="relative m-4 aspect-[16/11] sm:aspect-[16/9]" data-testid="market-map">
        <div className="absolute inset-0 rounded-md border" style={{ borderColor: "var(--hb-line-strong)", backgroundImage: "linear-gradient(var(--hb-line) 1px, transparent 1px), linear-gradient(90deg, var(--hb-line) 1px, transparent 1px)", backgroundSize: "10% 10%" }} />
        <div className="absolute left-1/2 top-0 h-full border-l border-dashed" style={{ borderColor: "var(--hb-line-strong)" }} />
        <div className="absolute top-1/2 left-0 w-full border-t border-dashed" style={{ borderColor: "var(--hb-line-strong)" }} />
        <span className="hb-mono absolute bottom-1 left-2 text-[10px]" style={{ color: "var(--hb-dim)" }}>{axes.x[0]}</span>
        <span className="hb-mono absolute bottom-1 right-2 text-[10px]" style={{ color: "var(--hb-dim)" }}>{axes.x[1]} →</span>
        <span className="hb-mono absolute left-2 top-1 text-[10px]" style={{ color: "var(--hb-dim)" }}>↑ {axes.y[1]}</span>
        <span className="hb-mono absolute left-2 top-1/2 mt-1 text-[10px]" style={{ color: "var(--hb-dim)" }}>{axes.y[0]}</span>
        <div className="absolute right-[2%] top-[4%] hb-mono rounded px-1.5 py-0.5 text-[10px]" style={{ color: "var(--hb-ok)", border: "1px dashed rgba(126,224,166,.4)" }}>
          whitespace
        </div>
        {players.map((p) => (
          <div
            key={p.name}
            data-testid={`market-player-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            title={p.note}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `clamp(9%, ${p.x * 100}%, 91%)`, top: `clamp(7%, ${(1 - p.y) * 100}%, 93%)` }}
          >
            <div
              className="hb-mono flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] transition-transform duration-200 group-hover:scale-105"
              style={
                p.self
                  ? { background: "rgba(126,224,166,.15)", color: "var(--hb-ok)", border: "1px solid rgba(126,224,166,.6)", boxShadow: "0 0 24px -6px rgba(126,224,166,.6)" }
                  : { background: "var(--hb-bg-3)", color: "var(--hb-text)", border: "1px solid var(--hb-line-strong)" }
              }
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.self ? "var(--hb-ok)" : "var(--hb-prompt)" }} />
              {p.name}
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}

export default function MarketScan() {
  return (
    <Section id="market">
      <Cmd cmd="cat market-scan.md" comment="desk research · positioning, not pricing · hover a dot for notes" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PositioningMap />
        </div>
        <div className="space-y-3 lg:col-span-2">
          {MARKET.players.map((p) => (
            <div key={p.name} className="hb-card p-3" style={p.self ? { borderColor: "rgba(126,224,166,.5)" } : undefined}>
              <div className="hb-mono text-xs font-semibold" style={{ color: p.self ? "var(--hb-ok)" : "var(--hb-text-strong)" }}>
                {p.name}
              </div>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--hb-muted)" }}>{p.note}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8">
        <div className="hb-mono mb-3 text-xs" style={{ color: "var(--hb-muted)" }}>## takeaways</div>
        <ol className="grid gap-3 sm:grid-cols-2" data-testid="market-takeaways">
          {MARKET.takeaways.map((t, i) => (
            <li key={t} className="hb-card flex gap-3 p-4 text-sm leading-6">
              <span className="hb-mono shrink-0" style={{ color: "var(--hb-prompt)" }}>0{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}

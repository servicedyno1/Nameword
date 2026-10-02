import { META } from "../brandData";
import { Section, Tag, Kv } from "./Term";

export default function Readme() {
  return (
    <Section id="readme">
      <div className="hb-rise">
        <div className="hb-cmd mb-8">
          <span className="path">~/brand</span>
          <span className="dollar">$</span>
          <span className="text">cat README.md</span>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="brand-status-tags">
          <Tag tone="info">phase {META.phase}</Tag>
          <Tag tone="ok">{META.status}</Tag>
          <Tag>v{META.version}</Tag>
          <Tag>{META.route}</Tag>
        </div>
        <h1 className="hb-mono mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" style={{ color: "var(--hb-text-strong)" }} data-testid="brand-title">
          <span style={{ color: "var(--hb-prompt)" }}>#</span> hosta<span style={{ color: "var(--hb-ok)" }}>.sh</span>
          <span className="hb-cursor" />
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 md:text-lg" style={{ color: "var(--hb-muted)" }}>
          Brand discovery &amp; identity. Who we serve, where we sit in the market, how we sound, and three
          directions each for colour and logo. Phase 2 applied the picks app-wide; Phase 3 is the hosta.sh domain launch.
        </p>
        <div className="mt-8 max-w-xl">
          <Kv
            rows={[
              { k: "from", v: "Nameword — offshore hosting, private by default" },
              { k: "to", v: "hosta.sh — host from the shell" },
              { k: "updated", v: META.updated },
              { k: "owner", v: "founder + design" },
              { k: "applied", v: "Neon Prompt · Geist Mono + Geist · Prompt >_" },
              { k: "next", v: "phase 3 — launch on hosta.sh" },
            ]}
          />
        </div>
      </div>
    </Section>
  );
}

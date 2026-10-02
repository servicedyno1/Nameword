import { NEXT_STEPS } from "../brandData";
import { Cmd, Section } from "./Term";

export default function NextSteps() {
  return (
    <Section id="next">
      <Cmd cmd="cat next-steps.md" comment="phase 2 and 3 start only after decisions.json is complete" />
      <div className="grid gap-4 lg:grid-cols-3" data-testid="next-steps">
        {NEXT_STEPS.map((s, i) => (
          <div key={s.phase} className="hb-card p-5" style={i === 0 ? { borderColor: "rgba(126,224,166,.45)" } : undefined}>
            <div className="hb-mono text-xs font-semibold" style={{ color: i === 0 ? "var(--hb-ok)" : "var(--hb-prompt)" }}>{s.phase}</div>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {s.items.map((it) => (
                <li key={it} className="hb-mono flex gap-2 text-xs leading-5">
                  <span style={{ color: "var(--hb-dim)" }}>[ ]</span>
                  <span className="hb-sans text-sm">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="hb-comment mt-10 text-xs"># end of file · hosta.sh brand guide · phase 1</p>
    </Section>
  );
}

import { NEXT_STEPS } from "../brandData";
import { Cmd, Section } from "./Term";

export default function NextSteps() {
  return (
    <Section id="next">
      <Cmd cmd="cat next-steps.md" comment="phase 1 + 2 done · phase 3 is next" />
      <div className="grid gap-4 lg:grid-cols-3" data-testid="next-steps">
        {NEXT_STEPS.map((s, i) => (
          <div key={s.phase} className="hb-card p-5" style={s.state === "next" ? { borderColor: "rgba(126,224,166,.45)" } : undefined} data-testid={`next-step-${i}`}>
            <div className="hb-mono flex items-center justify-between text-xs font-semibold" style={{ color: s.state === "next" ? "var(--hb-ok)" : "var(--hb-prompt)" }}>
              <span>{s.phase}</span>
              <span data-testid={`next-step-${i}-state`}>{s.state === "done" ? "[done]" : "[next]"}</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {s.items.map((it) => (
                <li key={it} className="hb-mono flex gap-2 text-xs leading-5">
                  <span style={{ color: s.state === "done" ? "var(--hb-ok)" : "var(--hb-dim)" }}>{s.state === "done" ? "[x]" : "[ ]"}</span>
                  <span className="hb-sans text-sm">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="hb-comment mt-10 text-xs"># end of file · hosta.sh brand guide · phase 2 applied</p>
    </Section>
  );
}

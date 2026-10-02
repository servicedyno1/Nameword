import { useState } from "react";
import { PALETTES, TYPE_PAIRS, LOGOS, META } from "../brandData";
import { Cmd, Section, Window } from "./Term";
import { useDecisions } from "../useDecisions";

const nameOf = (list, id) => list.find((x) => x.id === id)?.name || null;

export default function Decisions() {
  const { picks, reset } = useDecisions();
  const [copied, setCopied] = useState(false);

  const json = {
    brand: META.name,
    phase: 1,
    palette: picks.palette ? { id: picks.palette, name: nameOf(PALETTES, picks.palette) } : null,
    typography: picks.type ? { id: picks.type, name: nameOf(TYPE_PAIRS, picks.type) } : null,
    logo: picks.logo ? { id: picks.logo, name: nameOf(LOGOS, picks.logo) } : null,
    status: picks.palette && picks.type && picks.logo ? "ready_for_phase_2" : "pending",
  };
  const text = JSON.stringify(json, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Section id="decisions">
      <Cmd cmd="cat decisions.json" comment="your picks from the sections above · saved in this browser · paste the JSON back to me to start Phase 2" />
      <Window title="decisions.json">
        <pre className="hb-mono overflow-x-auto p-5 text-xs leading-6" data-testid="decisions-json" style={{ color: "var(--hb-text)" }}>
          {text}
        </pre>
        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--hb-line)" }}>
          <button type="button" className={`hb-btn ${copied ? "on" : ""}`} onClick={copy} data-testid="decisions-copy">
            {copied ? "copied" : "copy json"}
          </button>
          <button type="button" className="hb-btn" onClick={reset} data-testid="decisions-reset">
            reset
          </button>
          <span className="hb-mono text-[11px]" style={{ color: json.status === "pending" ? "var(--hb-warn)" : "var(--hb-ok)" }} data-testid="decisions-status">
            status: {json.status}
          </span>
        </div>
      </Window>
    </Section>
  );
}

import { useDecisions } from "../useDecisions";

// `$ cat file.md` style section header.
export function Cmd({ cmd, path = "~/brand", comment }) {
  return (
    <div className="mb-6">
      <div className="hb-cmd">
        <span className="path">{path}</span>
        <span className="dollar">$</span>
        <span className="text">{cmd}</span>
      </div>
      {comment && <p className="hb-comment mt-1 text-xs"># {comment}</p>}
    </div>
  );
}

export function Section({ id, children, testId }) {
  return (
    <section id={id} data-testid={testId || `brand-section-${id}`} className="scroll-mt-24 py-14 border-t first:border-t-0" style={{ borderColor: "var(--hb-line)" }}>
      {children}
    </section>
  );
}

export function Window({ title, children, className = "", style }) {
  return (
    <div className={`hb-win ${className}`} style={style}>
      <div className="hb-win-bar">
        <span className="hb-dot" />
        <span className="hb-dot" />
        <span className="hb-dot" />
        <span className="ml-2 min-w-0 truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function Tag({ children, tone = "", className = "" }) {
  return <span className={`hb-tag ${tone} ${className}`}>{children}</span>;
}

export function Kv({ rows }) {
  return (
    <dl className="hb-kv">
      {rows.map((r) => (
        <div key={r.k} className="contents">
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Bar({ value, max = 100, color }) {
  return (
    <div className="hb-bar">
      <i style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
    </div>
  );
}

// "Mark as preferred" toggle, persisted via DecisionsContext.
export function PickButton({ kind, id, label = "mark as preferred" }) {
  const { picks, pick } = useDecisions();
  const on = picks[kind] === id;
  return (
    <button
      type="button"
      data-testid={`pick-${kind}-${id}`}
      aria-pressed={on}
      onClick={() => pick(kind, id)}
      className={`hb-btn ${on ? "on" : ""}`}
    >
      <span>{on ? "[x]" : "[ ]"}</span> {on ? "preferred" : label}
    </button>
  );
}

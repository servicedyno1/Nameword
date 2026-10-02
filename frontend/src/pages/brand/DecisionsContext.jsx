import { useEffect, useState } from "react";
import { DecisionsContext, EMPTY_PICKS, APPLIED_PICKS } from "./decisionsCtx";

const KEY = "hosta_brand_decisions";

export function DecisionsProvider({ children }) {
  const [picks, setPicks] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      return saved ? { ...EMPTY_PICKS, ...JSON.parse(saved) } : APPLIED_PICKS;
    } catch {
      return APPLIED_PICKS;
    }
  });

  useEffect(() => {
    const empty = Object.values(picks).every((v) => v === null);
    if (empty) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(picks));
  }, [picks]);

  const pick = (kind, id) => setPicks((p) => ({ ...p, [kind]: p[kind] === id ? null : id }));
  const reset = () => setPicks(APPLIED_PICKS);

  return <DecisionsContext.Provider value={{ picks, pick, reset }}>{children}</DecisionsContext.Provider>;
}

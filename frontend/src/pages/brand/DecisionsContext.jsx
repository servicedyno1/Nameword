import { useEffect, useState } from "react";
import { DecisionsContext, EMPTY_PICKS } from "./decisionsCtx";

const KEY = "hosta_brand_decisions";

export function DecisionsProvider({ children }) {
  const [picks, setPicks] = useState(() => {
    try {
      return { ...EMPTY_PICKS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return EMPTY_PICKS;
    }
  });

  useEffect(() => {
    const empty = Object.values(picks).every((v) => v === null);
    if (empty) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(picks));
  }, [picks]);

  const pick = (kind, id) => setPicks((p) => ({ ...p, [kind]: p[kind] === id ? null : id }));
  const reset = () => setPicks(EMPTY_PICKS);

  return <DecisionsContext.Provider value={{ picks, pick, reset }}>{children}</DecisionsContext.Provider>;
}

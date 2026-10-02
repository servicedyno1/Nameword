import { createContext } from "react";

export const EMPTY_PICKS = { palette: null, type: null, logo: null };
export const DecisionsContext = createContext({ picks: EMPTY_PICKS, pick: () => {}, reset: () => {} });
export const APPLIED_PICKS = { palette: "neon", type: "geist", logo: "prompt" };

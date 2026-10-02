import { useContext } from "react";
import { DecisionsContext } from "./decisionsCtx";

export const useDecisions = () => useContext(DecisionsContext);

import { Sparkles } from "lucide-react";
import { stewardById } from "../../data/stewards";
import type { GameState } from "../../engine/types";
import { getPreparedStewardPower } from "./preparedActions";

export function PreparedStewardNotice({ state, onReview }: { state: GameState; onReview?: () => void }) {
  const prepared = getPreparedStewardPower(state);
  if (!prepared) return null;
  return <section className="prepared-steward-notice" aria-label="Prepared Steward power">
    <header><Sparkles size={18} aria-hidden="true" /><h3>{stewardById[prepared.stewardId].name} · Prepared</h3></header>
    <p><strong>{prepared.nextAction}</strong> Pay resources and follow the usual tile rules.</p>
    <details><summary>Supported & timing</summary><p>{prepared.support} This preparation is yours to use during this Season, including a later turn. Preparing it has used your Season power.</p></details>
    {onReview && <button type="button" onClick={onReview}>{prepared.reviewLabel}</button>}
  </section>;
}

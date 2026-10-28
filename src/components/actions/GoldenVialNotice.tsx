import { Crown } from "lucide-react";
import { coreTileById } from "../../data/tiles";
import { getUsableFaceUpBoonIds } from "../../engine/gameActions";
import type { GameState } from "../../engine/types";

export const goldenVialId = "golden_boon_the_golden_vial";
export function hasPreparedVial(state: GameState) {
  return state.boonModifiers.some((modifier) => modifier.sourceCardId === goldenVialId && modifier.remainingUses > 0);
}

export function getVialOpportunity(state: GameState) {
  const boon = state.encounters.faceUpBoons.find((candidate) => candidate.cardId === goldenVialId);
  if (!boon) return null;
  const prepared = hasPreparedVial(state);
  const inSupply = Object.entries(state.tileSupply.core).some(([id, copies]) => copies > 0 && coreTileById[id]?.category === "travel");
  const ready = getUsableFaceUpBoonIds(state).includes(goldenVialId);
  const used = boon.lastUsedRound === state.round;
  return {
    prepared, ready, inSupply, used,
    status: prepared ? "Travel placement prepared" : used ? "Used this round" : !inSupply ? "No Travel tiles in supply" : ready ? "Ready this round" : state.phase === "turns" ? "Finish the pending choice" : "Available during player turns",
    detail: prepared
      ? "Next Core Travel tile: 0 actions. Pay its resources and obey placement rules. Expires at round end."
      : used ? !inSupply ? "The group has used this round’s preparation. No Core Travel tiles remain in supply." : state.round === 12 ? "The group has used the Vial this round. This is the final round of the game." : "The group has used this round’s preparation. The Vial becomes available again next round."
      : !inSupply ? "The Vial needs a Core Travel tile in supply. There are none remaining."
      : "Prepare 1 Core Travel tile for 0 actions. Pay its resources and obey placement rules. Shared once per round."
  };
}

export function GoldenVialNotice({ state, onPrepare, onChooseTravel }: { state: GameState; onPrepare: () => void; onChooseTravel?: () => void }) {
  const opportunity = getVialOpportunity(state);
  if (!opportunity) return null;
  return <section className={`golden-opportunity ${opportunity.prepared ? "is-prepared" : ""}`} aria-label="Golden Vial opportunity">
    <header><Crown size={18} aria-hidden="true" /><div><h3>The Golden Vial</h3><strong role="status">{opportunity.status}</strong></div></header>
    {opportunity.used && !opportunity.prepared ? <details><summary>{state.round === 12 || !opportunity.inSupply ? "About this use" : "When it returns"}</summary><p>{opportunity.detail}</p></details> : <p>{opportunity.detail}</p>}
    {opportunity.ready && <button type="button" onClick={onPrepare}>Prepare 0-action Travel</button>}
    {opportunity.prepared && onChooseTravel && <button type="button" disabled={!opportunity.inSupply} onClick={onChooseTravel}>Choose a Travel tile</button>}
    {opportunity.prepared && !opportunity.inSupply && <p>No Core Travel tiles remain in supply.</p>}
  </section>;
}

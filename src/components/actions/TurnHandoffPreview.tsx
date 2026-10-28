import { getPreparedStewardPower } from "./preparedActions";
import { stewardById } from "../../data/stewards";
import type { GameState } from "../../engine/types";
import { hasPreparedVial } from "./GoldenVialNotice";

export function TurnHandoffPreview({ state }: { state: GameState }) {
  const next = state.players.find((player) => player.id !== state.currentPlayerId && !state.playersActedThisRound.includes(player.id));
  const startBonus = !next && state.bonusTurnsPending && !state.bonusTurnsActive;
  const nextSteward = next ?? (startBonus ? state.players[0] : null);
  return <section className="turn-handoff-preview" aria-label="After this turn">
    <strong>{startBonus ? "Next · Golden bonus turns" : nextSteward ? `Next · ${stewardById[nextSteward.stewardId].name}${state.bonusTurnsActive ? "’s bonus turn" : "’s turn"}` : "Next · End of round"}</strong>
    {startBonus ? <p>Every Steward takes one more turn with 4 actions, starting with {stewardById[state.players[0].stewardId].name}. Round {state.round} continues. Encounters, Arrival timers and round-limited powers do not reset.</p>
      : next ? <p>{state.bonusTurnsActive ? "The bonus turn sequence continues." : "The next Steward receives 4 actions."} Arrival timers stay as they are.</p>
      : <p>{state.bonusTurnsActive ? "All Golden bonus turns will be complete. " : ""}Review and resolve round-end consequences next.</p>}
    {getPreparedStewardPower(state) && <p>Your prepared Steward power stays yours for a later turn this Season. {state.round % 4 === 0 ? "This is the last round of the Season. Use it before your final turn ends." : "Other Stewards cannot use it."}</p>}
    {hasPreparedVial(state) && <p>{next || startBonus ? "The prepared Vial remains available to the group this round." : "The prepared Vial is still unused. Returning to Place lets you use it before the round ends."}</p>}
    {state.players.find((player) => player.id === state.currentPlayerId)?.temporaryReachHexId && <p>Ranger’s temporary reach ends with this turn. The Season power stays used.</p>}
    <p>{state.actionsRemaining > 0 ? `${state.actionsRemaining} unused ${state.actionsRemaining === 1 ? "action will" : "actions will"} be lost.` : "No unused actions remain."}</p>
  </section>;
}

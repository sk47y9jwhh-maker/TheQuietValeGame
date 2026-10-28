import { getPreparedStewardPower, stewardPreparations } from "../actions/preparedActions";
import { canUseStewardPower } from "../../engine/gameActions";
import { CircleHelp } from "lucide-react";
import { stewardById } from "../../data/stewards";
import type { GameState } from "../../engine/types";
import { selectCurrentPlayer } from "../../engine/selectors";

export function getPlayerGuidance(state: GameState) {
  if (state.pendingGoldenEffect || state.pendingCostChoice || state.pendingDeckReorder || state.pendingEffects.length) {
    return { title: "A choice to resolve", detail: "Finish the highlighted effect before returning to the table.", step: -1 };
  }
  switch (state.phase) {
    case "setup": return { title: "Choose your starting place", detail: "Choose on the map or from the list, then confirm your Steward’s starting location.", step: 0 };
    case "goldenSetup": return { title: "Place your Golden Tile", detail: "Choose a legal starting position, or continue without this optional tile.", step: 0 };
    case "seeding": return { title: "Shape the season ahead", detail: "Choose three different cards: one for the top, middle and bottom of the Encounter Deck.", step: 0 };
    case "reveal": return { title: "See what the Vale brings", detail: "Reveal this round’s encounters, then resolve any choices before taking your turn.", step: 1 };
    case "turns": {
      const prepared = getPreparedStewardPower(state);
      if (prepared) return { title: prepared.mode === "upgrade" ? "Your 0-action upgrade is prepared" : `Your 0-action ${prepared.category === "travel" ? "Travel" : "Housing"} placement is prepared`, detail: "Choose a matching tile and review its resources. Reach, Strain and the usual tile rules still apply.", step: 2 };
      const player = selectCurrentPlayer(state);
      if (state.actionsRemaining === 0 && stewardPreparations[player.stewardId] && canUseStewardPower(state, player.id).ok) return { title: "Your Steward power is still available", detail: "Your ordinary actions are used. Open Power to prepare a 0-action tile opportunity, or end your turn when ready.", step: 2 };
      return { title: state.bonusTurnsActive ? "Your Golden bonus turn" : state.actionsRemaining ? "Your settlement, your next move" : "Ready to pass the turn", detail: state.actionsRemaining ? `${state.actionsRemaining} action${state.actionsRemaining === 1 ? "" : "s"} remaining. Choose an action, then use the board to carry it out.` : "You have used your actions. Review any available free effects, then end your turn.", step: 2 };
    }
    case "endRound": return { title: "Bring the round to a close", detail: "Resolve consequences and Arrival timers before the next round begins.", step: 3 };
    case "gameEnd": return { title: "Your settlement is complete", detail: state.ledgerRun?.recorded ? "Your result is recorded. Review the board or begin another settlement when you are ready." : "Review your final score and Ledger progress below.", step: 4 };
  }
}

export function PlayerGuide({ state }: { state: GameState }) {
  const current = selectCurrentPlayer(state);
  const guide = getPlayerGuidance(state);
  const stages = ["Prepare", "Reveal", state.bonusTurnsActive ? "Bonus turns" : "Take turns", "Round end"];
  return (
    <section className="player-guide" aria-label="Current step">
      <div className="player-guide-current">
        <p className="player-guide-context">{state.phase === "gameEnd" ? "Completed · " : ""}Season {["I", "II", "III"][state.season - 1]} <span>·</span> Round {state.round} of 12 {state.phase !== "gameEnd" && <><span>·</span> {stewardById[current.stewardId].name}</>}</p>
        <strong aria-live="polite">{guide.title}</strong>
        <p>{guide.detail}</p>
        {(state.bonusTurnsPending || state.bonusTurnsActive) && <details className="golden-turn-order">
          <summary>{state.bonusTurnsActive ? "Golden bonus turn order" : "Golden bonus turns follow this round"}</summary>
          <p>The Golden-Eyed Traveller grants every Steward one extra turn with 4 actions. {state.bonusTurnsActive ? "Normal turns are complete." : "Finish normal turns first."} This is still round {state.round}, with no new encounters or timer changes. Once-per-round and once-per-season uses stay spent.</p>
          <ol aria-label="Golden bonus turn order">{state.players.map((player) => <li key={player.id} aria-current={state.bonusTurnsActive && player.id === state.currentPlayerId ? "step" : undefined}><span>{stewardById[player.stewardId].name}</span><strong>{!state.bonusTurnsActive ? "After normal turns" : player.id === state.currentPlayerId ? "Playing now" : state.playersActedThisRound.includes(player.id) ? "Bonus turn taken" : "Next in order"}</strong></li>)}</ol>
        </details>}
      </div>
      {state.phase !== "gameEnd" && <ol className="player-guide-stages" aria-label="Round progression">
        {stages.map((stage, index) => <li key={stage} aria-current={guide.step === index ? "step" : undefined} className={guide.step > index ? "is-past" : ""}><span>{index + 1}</span>{stage}</li>)}
      </ol>}
      <details className="player-guide-help">
        <summary aria-label="Help with the round"><CircleHelp size={20} aria-hidden="true" /></summary>
        <div><strong>A round in the Vale</strong><p>Reveal encounters, take each Steward’s turn, then resolve the end of the round. You seed the deck at the start of each season.</p><p>Use the Rules tab below whenever you need the full explanation. Undo can take you back through recent game steps.</p></div>
      </details>
    </section>
  );
}

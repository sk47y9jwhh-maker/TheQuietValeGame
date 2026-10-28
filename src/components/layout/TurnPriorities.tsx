import { ArrowRight, Clock3, Flag, ShieldAlert } from "lucide-react";
import { encounterById } from "../../data/encounters";
import { canCompleteArrival } from "../../engine/gameActions";
import { evaluateStewardObjectives } from "../../engine/scoring";
import type { GameState } from "../../engine/types";

export function TurnPriorities({ state, onReviewArrival, onReviewBoard }: {
  state: GameState; onReviewArrival: (id: string) => void; onReviewBoard: () => void;
}) {
  if (state.phase !== "turns" || state.pendingEffects.length > 0 || state.pendingCostChoice) return null;
  const arrivals = [...state.encounters.activeArrivals].sort((a, b) => a.timerTokens - b.timerTokens);
  const urgent = arrivals.filter((arrival) => arrival.timerTokens <= 1);
  const objective = evaluateStewardObjectives(state).find((candidate) => candidate.playerId === state.currentPlayerId);
  const overstrained = state.map.placedTiles.filter((tile) => tile.strain >= 3).length;
  return <details className="turn-priorities">
    <summary><Clock3 size={17} aria-hidden="true" /><span><strong>Plan this round</strong><small className={urgent.length ? "priority-urgent" : ""}>{urgent.length
      ? `${urgent.length} Arrival${urgent.length === 1 ? " expires" : "s expire"} at round end`
      : arrivals.length ? `${arrivals.length} Arrival${arrivals.length === 1 ? "" : "s"} waiting · Your objective` : "Your objective & settlement"}</small></span></summary>
    <div className="turn-priorities-content">
      {arrivals.length > 0 ? <section aria-label="Arrival priorities">
        <p>Each Arrival loses one timer at round end. Review its cost before completing it.</p>
        <ul>{arrivals.map((arrival) => {
          const card = encounterById[arrival.cardId];
          if (!card || card.type !== "arrival") return null;
          const validation = canCompleteArrival(state, arrival.cardId);
          return <li key={arrival.cardId}>
            <div><strong>{card.name}</strong><span className={arrival.timerTokens <= 1 ? "priority-urgent" : ""}>{arrival.timerTokens <= 1 ? "Expires this round if unresolved" : `${arrival.timerTokens} timers remaining`}</span></div>
            <p>{card.requirementText}</p>
            <small className={validation.ok ? "priority-ready" : ""}>{validation.ok ? "Can complete now" : validation.reasons.map((reason) => reason.replace(/^Cannot complete Arrival:\s*/i, "")).join(" ")}</small>
            <button type="button" onClick={() => onReviewArrival(arrival.cardId)} aria-label={`Review ${card.name}`}>Review Arrival <ArrowRight size={16} aria-hidden="true" /></button>
          </li>;
        })}</ul>
      </section> : <p>No Arrivals are waiting. New encounters can change the plan.</p>}
      {objective && <section className="priority-objective" aria-label={`${objective.stewardName} objective`}>
        <h3><Flag size={16} aria-hidden="true" />{objective.stewardName} objective</h3>
        <strong>{objective.progressLabel}</strong>
        <p>{objective.detail}</p>
        <small>{objective.met ? "Met now. " : ""}Worth +{objective.reward} Renown if met at final scoring. This can still change.</small>
      </section>}
      {overstrained > 0 && <div className="priority-strain"><p><ShieldAlert size={16} aria-hidden="true" />{overstrained} Overstrained {overstrained === 1 ? "tile" : "tiles"} on the board.</p><button type="button" onClick={onReviewBoard}>Review board <ArrowRight size={16} aria-hidden="true" /></button></div>}
    </div>
  </details>;
}

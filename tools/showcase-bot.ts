/**
 * A simple one-step-lookahead player for building showcase fixtures. It only
 * calls ordinary engine actions, so every position it reaches is legal. It is
 * not a strategy guide and makes no claim of strong play.
 */
import { activateTile, completeArrival, confirmCostChoice, endCurrentTurn, getActivatableTileIds, getCompletableArrivalIds, getResolvableBurdenIds, getUpgradeableTileIds, placeTile, resolveBurden, upgradeTile } from "../src/engine/gameActions";
import { getLegalPlacementHexes, getTileFootprintKind } from "../src/engine/placementRules";
import { getPlaceTileChoices } from "../src/components/actions/placeTileChoices";
import { calculateFinalScore } from "../src/engine/scoring";
import { resources } from "../src/data/resources";
import type { GameState, HexDirection } from "../src/engine/types";

export type Settle = (state: GameState) => GameState;

export function valueOf(state: GameState): number {
  const stock = resources.reduce((total, resource) => total + Math.min(state.warehouse[resource], 12), 0);
  const scarce = resources.filter((resource) => state.warehouse[resource] < 2).length;
  const arrivalPressure = state.encounters.activeArrivals.reduce((total, arrival) => total + (arrival.timerTokens === 1 ? 4 : 0), 0);
  return calculateFinalScore(state).finalScore + stock * 0.6 - scarce * 2 - arrivalPressure;
}

/** A steadier valuation for the finale: it keeps Arrivals and Strain in mind. */
export function carefulValueOf(state: GameState): number {
  const strain = state.map.placedTiles.reduce((total, tile) => total + tile.strain * tile.strain, 0);
  const waiting = state.encounters.activeArrivals.reduce((total, arrival) => total + (arrival.timerTokens === 1 ? 6 : arrival.timerTokens === 2 ? 2 : 0), 0);
  return valueOf(state) - waiting - strain * 2;
}

function candidates(state: GameState): ((state: GameState) => GameState)[] {
  const player = state.currentPlayerId;
  const list: ((state: GameState) => GameState)[] = [];
  for (const id of getCompletableArrivalIds(state)) list.push((current) => completeArrival(current, id));
  for (const id of getResolvableBurdenIds(state)) list.push((current) => resolveBurden(current, id));
  for (const choice of getPlaceTileChoices(state, player, [], 3)) {
    if (!choice.affordable || choice.copiesAvailable <= 0) continue;
    const kind = getTileFootprintKind(choice.id);
    if (kind === "detached") continue;
    for (const hexId of getLegalPlacementHexes(state, player, choice.id).slice(0, 14)) {
      if (kind === "line") for (const orientation of [0, 1, 2, 3, 4, 5] as HexDirection[]) list.push((current) => placeTile(current, player, choice.id, { anchorHexId: hexId, orientation }));
      else list.push((current) => placeTile(current, player, choice.id, { anchorHexId: hexId }));
    }
  }
  for (const id of getUpgradeableTileIds(state, player)) list.push((current) => upgradeTile(current, player, id));
  for (const id of getActivatableTileIds(state, player)) list.push((current) => activateTile(current, player, id));
  return list;
}

function apply(state: GameState, action: (state: GameState) => GameState, settle: Settle): GameState | null {
  let next = action(state);
  if (next === state) return null;
  if (next.pendingCostChoice) {
    const confirmed = confirmCostChoice(next, { selectedOptionIds: [] });
    if (confirmed === next) return null;
    next = confirmed;
  }
  try { return settle(next); } catch { return null; }
}

/**
 * Plays the current player's turn: best single action until none helps, then
 * ends it. The chosen action is replayed through `commit`, which may watch the
 * effect queue (for example to keep a snapshot just before an Overstrain link).
 */
export function playTurn(input: GameState, settle: Settle, track: (before: GameState, after: GameState) => GameState, commit: Settle = settle, value: (state: GameState) => number = valueOf): GameState {
  let state = input;
  for (let guard = 0; guard < 8 && state.phase === "turns" && state.actionsRemaining > 0; guard++) {
    const base = value(state);
    let best: { action: (state: GameState) => GameState; value: number } | null = null;
    for (const action of candidates(state)) {
      const next = apply(state, action, settle);
      if (!next || next.phase === "gameEnd" && state.round < 12) continue;
      const score = value(next);
      if (!best || score > best.value) best = { action, value: score };
    }
    if (!best || best.value < base - 1) break;
    const committed = apply(state, best.action, commit);
    if (!committed) break;
    state = track(state, committed);
  }
  return state.phase === "turns" ? track(state, endCurrentTurn(state)) : state;
}

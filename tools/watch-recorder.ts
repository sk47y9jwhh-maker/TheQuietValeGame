/**
 * Plays the "Watch a demo" game and records every move as data. It is a
 * lookahead player in the spirit of the showcase bot, which also considers
 * Steward powers and face-up Boons and values what the settlement can make. Every move is an ordinary engine action,
 * so the recording replays exactly in the browser.
 */
import { canUseStewardPower, getActivatableTileIds, getCompletableArrivalIds, getResolvableBurdenIds, getUpgradeableTileIds, getUsableFaceUpBoonIds } from "../src/engine/gameActions";
import { getAlternativeEffectRule, preparePendingEffectQueueHead, resolvePendingEffect } from "../src/engine/manualEffects";
import { getLegalPlacementHexes, getTileFootprintKind } from "../src/engine/placementRules";
import { getPlaceTileChoices } from "../src/components/actions/placeTileChoices";
import { encounterById } from "../src/data/encounters";
import { calculateFinalScore } from "../src/engine/scoring";
import { resources } from "../src/data/resources";
import { coreTileById } from "../src/data/tiles";
import { applyWatchMove, type WatchMove } from "../src/app/watch/watchMoves";
import type { EffectAdjustment, GameState, HexDirection, ResourceType } from "../src/engine/types";

/** Moves applied together, and the state they lead to. */
export interface Played { moves: WatchMove[]; state: GameState }

function tryApply(state: GameState, move: WatchMove): GameState | null {
  try { return applyWatchMove(state, move); } catch { return null; }
}

/**
 * Every effect the engine queues, resolved as a careful table would: payments
 * before Strain, then the first legal choice. Returns the moves it made.
 */
export function settle(input: GameState, options: { preferPayments?: boolean; stopBefore?: (state: GameState) => boolean } = {}): Played {
  let state = input;
  const moves: WatchMove[] = [];
  const push = (move: WatchMove) => { const next = tryApply(state, move); if (!next) throw new Error(`Settle could not apply ${move.k}`); moves.push(move); state = next; };
  for (let guard = 0; guard < 100; guard++) {
    if (state.pendingCostChoice) { push({ k: "cost" }); continue; }
    if (state.pendingDeckReorder) { push({ k: "reorder" }); continue; }
    if (!state.pendingEffects.length) return { moves, state };
    if (options.stopBefore?.(state)) return { moves, state };
    const prepared = preparePendingEffectQueueHead(state);
    const pending = prepared.pendingEffects[0];
    const choices = effectChoices(prepared, options.preferPayments ?? true);
    let chosen: EffectAdjustment | undefined;
    for (const choice of choices) {
      const candidate = resolvePendingEffect(prepared, choice);
      if (!candidate.pendingEffects.some((effect) => effect.id === pending.id)) { chosen = choice; break; }
    }
    if (chosen) push({ k: "effect", adj: chosen });
    else if (pending.canSkip) push({ k: "skip" });
    else throw new Error(`No legal resolution for ${pending.ruleId}`);
  }
  throw new Error("Effect queue exceeded its guard.");
}

/**
 * The choices to try for the effect at the head of the queue, in order:
 * payments before Strain, then every other legal adjustment. This is the
 * same order the generated fixtures use (tools/scenario-steps.ts).
 */
export function effectChoices(state: GameState, preferPayments: boolean): EffectAdjustment[] {
  const pending = state.pendingEffects[0];
  const alternative = preferPayments ? getAlternativeEffectRule(state, pending.ruleId) : undefined;
  const choices: EffectAdjustment[] = alternative?.kind === "pay_or_strain" || alternative?.kind === "pay_or_timer"
    ? alternative.resources.map((resource) => ({ resourceDeltas: { [resource]: -alternative.resourceStep * alternative.requiredChoices }, tileStrainDeltas: {}, arrivalTimerDeltas: {} })) : [];
  // Pay what the Warehouse can, split across the resources it holds most of,
  // and take Strain for the rest on the least strained tiles.
  if (alternative?.kind === "pay_or_strain") {
    const order = [...alternative.resources].sort((a, b) => state.warehouse[b] - state.warehouse[a]);
    const pool = [...(pending.targetCardTargetTileIds?.length ? pending.targetCardTargetTileIds : state.map.placedTiles.map((tile) => tile.instanceId))]
      .sort((a, b) => strainOf(state, a) - strainOf(state, b));
    for (let paid = alternative.requiredChoices; paid >= 0; paid--) {
      const spend: Partial<Record<ResourceType, number>> = {};
      let left = paid * alternative.resourceStep;
      for (const resource of order) { const take = Math.min(left, state.warehouse[resource]); if (take) spend[resource] = -take; left -= take; }
      if (left > 0) continue;
      const strained = pool.slice(0, alternative.requiredChoices - paid);
      if (strained.length < alternative.requiredChoices - paid) continue;
      choices.push({ resourceDeltas: spend, tileStrainDeltas: Object.fromEntries(strained.map((id) => [id, alternative.strainPerChoice])), arrivalTimerDeltas: {} });
    }
  }
  choices.push({});
  if (pending.suggestedAdjustment) choices.push(pending.suggestedAdjustment);
  for (const tile of state.map.placedTiles) for (const delta of [-1, 1, -2, 2, -3, 3]) choices.push({ tileStrainDeltas: { [tile.instanceId]: delta } });
  for (const resource of resources) for (let amount = 1; amount <= 5; amount++) choices.push({ resourceDeltas: { [resource]: -amount } });
  for (const first of state.map.placedTiles) for (const second of state.map.placedTiles) if (first !== second) choices.push({ tileStrainDeltas: { [first.instanceId]: 1, [second.instanceId]: 1 } });
  for (const resource of resources) for (let amount = 1; amount <= 5; amount++) choices.push({ resourceDeltas: { [resource]: amount } });
  // Arrival timers: one, two or three Arrivals lose a timer, or pay for some and not others.
  const arrivals = state.encounters.activeArrivals.map((arrival) => arrival.cardId);
  for (let size = 1; size <= arrivals.length; size++) choices.push({ arrivalTimerDeltas: Object.fromEntries(arrivals.slice(0, size).map((id) => [id, -1])) });
  if (alternative && alternative.kind === "pay_or_timer") for (let paid = 1; paid < alternative.requiredChoices; paid++) for (let size = 0; size <= arrivals.length; size++) choices.push({ resourceDeltas: { [alternative.resources[0]]: -alternative.resourceStep * paid }, arrivalTimerDeltas: Object.fromEntries(arrivals.slice(0, size).map((id) => [id, -1])) });
  const ids = state.map.placedTiles.map((tile) => tile.instanceId);
  for (let size = 1; size <= 3; size++) {
    const pick = (from: number, chosen: string[]) => {
      if (chosen.length === size) { choices.push({ supportTileIds: chosen }); return; }
      for (let index = from; index < ids.length && choices.length < 4000; index++) pick(index + 1, [...chosen, ids[index]]);
    };
    pick(0, []);
  }
  return choices;
}

const strainOf = (state: GameState, id: string) => state.map.placedTiles.find((tile) => tile.instanceId === id)?.strain ?? 0;

/** Apply moves, then settle what they set off. Null if any move is refused. */
export function play(state: GameState, moves: WatchMove[], preferPayments = true): Played | null {
  let current = state;
  const done: WatchMove[] = [];
  for (const move of moves) {
    const next = tryApply(current, move);
    if (!next) return null;
    done.push(move);
    current = next;
    try {
      const settled = settle(current, { preferPayments });
      done.push(...settled.moves);
      current = settled.state;
    } catch { return null; }
  }
  return { moves: done, state: current };
}

/** Candidate actions for the current player, each a short list of moves. */
export function candidates(state: GameState): WatchMove[][] {
  const player = state.currentPlayerId;
  const list: WatchMove[][] = [];
  for (const id of getCompletableArrivalIds(state)) list.push([{ k: "arrival", id }]);
  for (const id of getResolvableBurdenIds(state)) list.push([{ k: "burden", id }]);
  const places: WatchMove[] = [];
  for (const choice of getPlaceTileChoices(state, player, [], 3)) {
    if (!choice.affordable || choice.copiesAvailable <= 0) continue;
    const kind = getTileFootprintKind(choice.id);
    if (kind === "detached") continue;
    for (const hex of getLegalPlacementHexes(state, player, choice.id).slice(0, 14)) {
      if (kind === "line") for (const o of [0, 1, 2, 3, 4, 5] as HexDirection[]) places.push({ k: "place", tile: choice.id, hex, o });
      else places.push({ k: "place", tile: choice.id, hex });
    }
  }
  list.push(...places.map((move) => [move]));
  {
  // A Steward power that makes the next matching placement free of an action.
  if (canUseStewardPower(state, player).ok) {
    const steward = state.players.find((candidate) => candidate.id === player)?.stewardId;
    const category = steward === "vanguard" ? "travel" : steward === "knight" ? "housing" : undefined;
    if (category) for (const move of places) if (move.k === "place" && coreTileById[move.tile]?.category === category) list.push([{ k: "power" }, move]);
  }
  for (const id of getUpgradeableTileIds(state, player)) list.push([{ k: "upgrade", id }]);
  const activatable = getActivatableTileIds(state, player);
  for (const id of activatable) list.push([{ k: "activate", id }]);
  // A face-up Boon costs no action: alone, or just before a production.
  for (const id of getUsableFaceUpBoonIds(state)) {
    if (encounterById[id]?.type !== "boon") continue;
    list.push([{ k: "boon", id }]);
    for (const tile of activatable) list.push([{ k: "boon", id }, { k: "activate", id: tile }]);
  }
  }
  return list;
}

/**
 * How good a position looks to the demo's players: the score if the game
 * ended now, a healthy Warehouse, Arrivals welcomed before they leave and
 * Strain kept off the tiles.
 */
export function watchValueOf(state: GameState): number {
  if (state.round >= 12) return lastRoundValueOf(state);
  const late = Math.max(0, 12 - state.round) / 12;
  const stock = resources.reduce((total, resource) => total + Math.min(state.warehouse[resource], 12), 0);
  const scarce = resources.filter((resource) => state.warehouse[resource] < 2).length;
  // Being able to make a resource matters as much as holding it.
  const makes = new Set<string>();
  for (const tile of state.map.placedTiles) {
    if (tile.strain >= 3) continue;
    const core = coreTileById[tile.tileId];
    const production = core ? (tile.side === "upgraded" ? core.upgraded.production : core.basic.production) : undefined;
    for (const resource of resources) if ((production?.[resource] ?? 0) > 0) makes.add(resource);
  }
  const waiting = state.encounters.activeArrivals.reduce((total, arrival) => total + (arrival.timerTokens <= 1 ? 14 : arrival.timerTokens === 2 ? 8 : 4), 0) ;
  const strain = state.map.placedTiles.reduce((total, tile) => total + tile.strain * tile.strain, 0);
  const burdens = state.encounters.activeBurdens.length * 3;
  return calculateFinalScore(state).finalScore
    + late * (stock - scarce * 4 + makes.size * 6)
    - waiting - strain * 2 - burdens;
}

/**
 * The last round. Only points count at the end, so a tile that adds nothing
 * is not worth an action. But the table's turn is not over until the last
 * Steward has played: resources made now, and Special tiles unlocked now, are
 * what the next Steward builds with. An Arrival on its last timer still
 * leaves when the round ends, for −10 and a Strain.
 */
export function lastRoundValueOf(state: GameState): number {
  const order = state.players.map((player) => player.id);
  const laterTurn = state.phase === "turns" && order.indexOf(state.currentPlayerId) < order.length - 1;
  const stock = resources.reduce((total, resource) => total + Math.min(state.warehouse[resource], 12), 0);
  const placed = new Set(state.map.placedTiles.map((tile) => tile.tileId));
  const unbuilt = state.encounters.completedArrivals.flatMap((arrival) => arrival.specialTileIds).filter((id) => !placed.has(id)).length;
  const leaving = state.phase === "gameEnd" ? 0 : state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens <= 1).length * 20;
  return calculateFinalScore(state).finalScore - leaving + (laterTurn ? stock * 0.25 + unbuilt * 4 : 0);
}

export interface TurnPlan { actions: WatchMove[][]; value: number }

/**
 * The whole turn planned ahead: a narrow beam search over sequences of up to
 * four actions, scored at the end of the turn. A greedy player cannot see
 * "produce first, then pay for the Arrival"; this one can.
 */
export function planTurn(input: GameState, value: (state: GameState) => number, beamWidth = 4, expand = 14): TurnPlan {
  type Node = { state: GameState; actions: WatchMove[][]; value: number };
  let beam: Node[] = [{ state: input, actions: [], value: value(input) }];
  let best: Node = beam[0];
  for (let depth = 0; depth < 6; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      if (node.state.phase !== "turns" || node.state.currentPlayerId !== input.currentPlayerId || node.state.actionsRemaining <= 0) continue;
      const scored: Node[] = [];
      for (const option of candidates(node.state)) {
        const result = play(node.state, option);
        if (!result || result.state.phase === "gameEnd" && input.round < 12) continue;
        scored.push({ state: result.state, actions: [...node.actions, option], value: value(result.state) });
      }
      scored.sort((a, b) => b.value - a.value);
      next.push(...scored.slice(0, expand));
    }
    if (!next.length) break;
    next.sort((a, b) => b.value - a.value);
    // Different first moves keep the beam from collapsing onto one idea.
    const kept: Node[] = [];
    const seen = new Set<string>();
    for (const node of next) {
      const key = JSON.stringify(node.actions);
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(node);
      if (kept.length >= beamWidth) break;
    }
    beam = kept;
    if (beam[0].value > best.value) best = beam[0];
  }
  return { actions: best.actions, value: best.value };
}

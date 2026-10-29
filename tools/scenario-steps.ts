/** Shared steps for the generated demo fixtures. Every move goes through the rules engine. */
import { canCancelPendingBurdenWithWarden, commitSeasonSeeding, commitStewardPlacement } from "../src/engine/gameActions";
import { getAlternativeEffectRule, preparePendingEffectQueueHead, resolvePendingEffect, skipPendingEffect } from "../src/engine/manualEffects";
import { skipDeckReorder } from "../src/engine/deckReorder";
import { trackLedgerTransition } from "../src/engine/ledger";
import { createEmptyLedgerCampaign } from "../src/engine/ledgerCampaign";
import { encounterById } from "../src/data/encounters";
import { resources } from "../src/data/resources";
import type { EffectAdjustment, GameState } from "../src/engine/types";
import type { PreviewSnapshot } from "../src/app/scenarioTypes";

export const seed = "QV-COMPARISON-1";
export function advance(state: GameState, action: (state: GameState) => GameState): GameState {
  const next = action(state);
  if (next === state) throw new Error(`Comparison action made no change in ${state.phase}, round ${state.round}.`);
  return trackLedgerTransition(state, next);
}

export function settle(input: GameState, stopForWarden = false, options: { preferPayments?: boolean; stopBeforeRuleId?: string } = {}): GameState {
  let state = input;
  for (let guard = 0; guard < 100; guard++) {
    if (state.pendingDeckReorder) { state = advance(state, skipDeckReorder); continue; }
    if (!state.pendingEffects.length) return state;
    const prepared = preparePendingEffectQueueHead(state);
    if (prepared !== state) state = trackLedgerTransition(state, prepared);
    if (stopForWarden && canCancelPendingBurdenWithWarden(state).ok) return state;
    const pending = state.pendingEffects[0];
    if (pending.ruleId === options.stopBeforeRuleId) return state;
    const alternative = options.preferPayments ? getAlternativeEffectRule(state, pending.ruleId) : undefined;
    const choices: EffectAdjustment[] = alternative?.kind === "pay_or_strain" || alternative?.kind === "pay_or_timer"
      ? alternative.resources.map((resource) => ({ resourceDeltas: { [resource]: -alternative.resourceStep * alternative.requiredChoices }, tileStrainDeltas: {}, arrivalTimerDeltas: {} })) : [];
    choices.push({});
    // Open Target Cards can require an explicit target. Try legal outcomes only;
    // the engine rejects candidates that do not satisfy this particular effect.
    for (const tile of state.map.placedTiles) for (const delta of [-1, 1, -2, 2, -3, 3]) choices.push({ tileStrainDeltas: { [tile.instanceId]: delta } });
    for (const resource of resources) for (let amount = 1; amount <= 5; amount++) choices.push({ resourceDeltas: { [resource]: -amount } });
    for (const first of state.map.placedTiles) for (const second of state.map.placedTiles) if (first !== second) choices.push({ tileStrainDeltas: { [first.instanceId]: 1, [second.instanceId]: 1 } });
    for (const resource of resources) for (let amount = 1; amount <= 5; amount++) choices.push({ resourceDeltas: { [resource]: amount } });
    // Supported placements (for example Neighbourly Support) come last, so
    // earlier fixtures resolve exactly as before.
    const ids = state.map.placedTiles.map((tile) => tile.instanceId);
    for (let size = 1; size <= 3; size++) {
      const pick = (start: number, chosen: string[]) => {
        if (chosen.length === size) { choices.push({ supportTileIds: chosen }); return; }
        for (let index = start; index < ids.length && choices.length < 4000; index++) pick(index + 1, [...chosen, ids[index]]);
      };
      pick(0, []);
    }
    let resolved: GameState | undefined;
    for (const choice of choices) {
      const candidate = resolvePendingEffect(state, choice);
      if (!candidate.pendingEffects.some((effect) => effect.id === pending.id)) { resolved = candidate; break; }
    }
    if (!resolved && pending.canSkip) resolved = skipPendingEffect(state);
    if (!resolved || resolved.pendingEffects.some((effect) => effect.id === pending.id)) throw new Error(`No legal scripted resolution for ${pending.ruleId}: ${JSON.stringify(pending)}`);
    state = trackLedgerTransition(state, resolved);
  }
  throw new Error("Comparison effect queue exceeded its guard.");
}

export function startStewards(input: GameState): GameState {
  let state = input;
  for (const player of state.players) state = advance(state, (current) => commitStewardPlacement(current, player.id, player.stewardHexId));
  return state;
}

export function seedSeason(input: GameState): GameState {
  let state = input;
  for (const player of state.players) {
    const hand = state.encounters.handsByPlayerId[player.id];
    const top = hand.find((id) => encounterById[id].type === "arrival") ?? hand[0];
    const rest = hand.filter((id) => id !== top);
    state = advance(state, (current) => commitSeasonSeeding(current, player.id, { top, middle: rest[0], bottom: rest[1] }));
  }
  return state;
}

export function snapshot(state: GameState | null, stewards = ["vanguard", "knight"]): PreviewSnapshot {
  return { setup: { playerCount: state?.playerCount ?? 2, stewardIds: state?.players.map((player) => player.stewardId) ?? stewards, encounterSeed: seed }, state, campaign: createEmptyLedgerCampaign() };
}


/** Rebuild the isolated comparison fixtures through the established game engine. */
import { writeFileSync } from "node:fs";
import { createNewGame } from "../src/engine/setup";
import { canCancelPendingBurdenWithWarden, activateTile, commitSeasonSeeding, commitStewardPlacement, endCurrentTurn, placeTile, resolveEndRound, revealEncounters, useStewardPower, upgradeTile } from "../src/engine/gameActions";
import { getAlternativeEffectRule, hasEffectAdjustment, preparePendingEffectQueueHead, resolvePendingEffect, skipPendingEffect } from "../src/engine/manualEffects";
import { skipDeckReorder } from "../src/engine/deckReorder";
import { getLegalPlacementHexes } from "../src/engine/placementRules";
import { trackLedgerTransition } from "../src/engine/ledger";
import { createEmptyLedgerCampaign } from "../src/engine/ledgerCampaign";
import { encounterById } from "../src/data/encounters";
import { resources } from "../src/data/resources";
import { ledgerEntries } from "../src/data/ledger";
import type { EffectAdjustment, GameState } from "../src/engine/types";
import type { PreviewSnapshot } from "../src/app/scenarioTypes";
import type { ScenarioId } from "../src/app/scenarioCatalog";

const seed = "QV-COMPARISON-1";
function advance(state: GameState, action: (state: GameState) => GameState): GameState {
  const next = action(state);
  if (next === state) throw new Error(`Comparison action made no change in ${state.phase}, round ${state.round}.`);
  return trackLedgerTransition(state, next);
}

function settle(input: GameState, stopForWarden = false, options: { preferPayments?: boolean; stopBeforeRuleId?: string } = {}): GameState {
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

function startStewards(input: GameState): GameState {
  let state = input;
  for (const player of state.players) state = advance(state, (current) => commitStewardPlacement(current, player.id, player.stewardHexId));
  return state;
}

function seedSeason(input: GameState): GameState {
  let state = input;
  for (const player of state.players) {
    const hand = state.encounters.handsByPlayerId[player.id];
    const top = hand.find((id) => encounterById[id].type === "arrival") ?? hand[0];
    const rest = hand.filter((id) => id !== top);
    state = advance(state, (current) => commitSeasonSeeding(current, player.id, { top, middle: rest[0], bottom: rest[1] }));
  }
  return state;
}

function snapshot(state: GameState | null, stewards = ["vanguard", "knight"]): PreviewSnapshot {
  return { setup: { playerCount: state?.playerCount ?? 2, stewardIds: state?.players.map((player) => player.stewardId) ?? stewards, encounterSeed: seed }, state, campaign: createEmptyLedgerCampaign() };
}

// Fixed clocks apply only while generating checked-in fixtures, never in the game.
const realNow = Date.now;
Date.now = () => Date.parse("2026-09-27T00:00:00.000Z");
try {
  const result = {} as Record<ScenarioId, PreviewSnapshot>;
  result.welcome = snapshot(null);
  let state = startStewards(createNewGame(2, ["vanguard", "knight"], { encounterSeed: seed }));
  result.handoff = snapshot(state);
  state = settle(advance(seedSeason(state), revealEncounters));
  for (const [tile, hex] of [["c01_lumber_yard", "G1"], ["c05_cabin", "H1"], ["c15_path", "F1"]]) state = advance(state, (current) => placeTile(current, current.currentPlayerId, tile, { anchorHexId: hex }));
  state = settle(advance(state, (current) => activateTile(current, current.currentPlayerId, current.map.placedTiles[0].instanceId)));
  result["last-action"] = snapshot(state);
  state = advance(state, endCurrentTurn);
  for (const [tile, hex] of [["c04_farmstead", "A6"], ["c05_cabin", "A7"], ["c15_path", "B6"]]) state = advance(state, (current) => placeTile(current, current.currentPlayerId, tile, { anchorHexId: hex }));
  state = settle(advance(state, (current) => activateTile(current, current.currentPlayerId, current.map.placedTiles.find((tile) => tile.tileId === "c04_farmstead")!.instanceId)));
  state = advance(state, endCurrentTurn);
  state = settle(advance(state, resolveEndRound));
  state = settle(advance(state, revealEncounters));
  result.settlement = snapshot(state);
  // Finish this actual scripted game. Passing unused actions is intentional;
  // this is a coverage fixture, not a claim of strong or optimal play.
  for (let guard = 0; state.phase !== "gameEnd" && guard < 100; guard++) {
    if (state.phase === "turns") state = advance(state, endCurrentTurn);
    else if (state.phase === "endRound") state = advance(state, resolveEndRound);
    else if (state.phase === "seeding") state = seedSeason(state);
    else if (state.phase === "reveal") state = advance(state, revealEncounters);
    else throw new Error(`Unexpected comparison phase ${state.phase}`);
    state = settle(state);
  }
  if (state.phase !== "gameEnd") throw new Error("Comparison game did not finish.");
  result.finale = snapshot(state);

  let quartermaster = startStewards(createNewGame(1, ["quartermaster"], { encounterSeed: seed }));
  quartermaster = settle(advance(seedSeason(quartermaster), revealEncounters));
  // Make room in the Warehouse so the exchange can produce a visible benefit.
  for (const [tile, hex] of [["c01_lumber_yard", "B8"], ["c05_cabin", "C8"]]) quartermaster = advance(quartermaster, (current) => placeTile(current, current.currentPlayerId, tile, { anchorHexId: hex }));
  quartermaster = advance(quartermaster, (current) => useStewardPower(current, current.currentPlayerId));
  result.choice = snapshot(quartermaster);

  // Advance the selected Golden Boon through actual setup, seeding and reveals.
  // These fixtures stop at its real pending choice, before resolving it.
  for (const [id, boonId, expected] of [
    ["golden-bell", "golden_boon_the_golden_bell", "bell"],
    ["golden-scroll", "golden_boon_the_golden_scroll", "scroll"],
    ["golden-signet", "golden_boon_the_golden_signet_ring", "signet"]
  ] as const) {
    let golden = startStewards(createNewGame(2, ["vanguard", "knight"], { encounterSeed: seed, selectedGoldenBoonId: boonId }));
    for (let guard = 0; !golden.pendingGoldenEffect && guard < 100; guard++) {
      if (golden.phase === "seeding") golden = seedSeason(golden);
      else if (golden.phase === "reveal") golden = advance(golden, revealEncounters);
      else if (golden.phase === "turns") {
        if (expected === "signet" && golden.round === 1) {
          const tiles = golden.currentPlayerId === "player_1"
            ? [["c01_lumber_yard", "G1"], ["c05_cabin", "H1"], ["c15_path", "F1"]]
            : [["c04_farmstead", "A6"], ["c05_cabin", "A7"], ["c15_path", "B6"]];
          for (const [tile, hex] of tiles) golden = advance(golden, (current) => placeTile(current, current.currentPlayerId, tile, { anchorHexId: hex }));
        }
        golden = advance(golden, endCurrentTurn);
      }
      else if (golden.phase === "endRound") golden = advance(golden, resolveEndRound);
      else throw new Error(`Unexpected Golden fixture phase ${golden.phase}`);
      if (!golden.pendingGoldenEffect) golden = settle(golden);
    }
    if (golden.pendingGoldenEffect?.kind !== expected) throw new Error(`Golden fixture ${id} did not reach its choice.`);
    result[id] = snapshot(golden);
    for (const entry of ledgerEntries.slice(0, expected === "bell" ? 5 : expected === "scroll" ? 12 : 32)) result[id].campaign.completions[entry.id] = { entryId: entry.id, completedOnce: true, completedPlayerCounts: [], notes: "Example progress for the isolated comparison scenario." };
  }

  // Ongoing/automatic Golden effects have no dedicated pending-choice state.
  for (const [id, boonId, threshold] of [
    ["golden-vial", "golden_boon_the_golden_vial", 18],
    ["golden-traveller", "golden_boon_the_golden_eyed_traveler", 25]
  ] as const) {
    let golden = startStewards(createNewGame(2, ["vanguard", "knight"], { encounterSeed: seed, selectedGoldenBoonId: boonId }));
    const ready = () => id === "golden-vial" ? golden.encounters.faceUpBoons.some((boon) => boon.cardId === boonId) : golden.bonusTurnsPending;
    for (let guard = 0; !ready() && guard < 100; guard++) {
      if (golden.phase === "seeding") golden = seedSeason(golden);
      else if (golden.phase === "reveal") golden = advance(golden, revealEncounters);
      else if (golden.phase === "turns") {
        if (golden.round === 1) {
          const tiles = golden.currentPlayerId === "player_1"
            ? [["c01_lumber_yard", "G1"], ["c05_cabin", "H1"], ["c15_path", "F1"]]
            : [["c04_farmstead", "A6"], ["c05_cabin", "A7"], ["c15_path", "B6"]];
          for (const [tile, hex] of tiles) golden = advance(golden, (current) => placeTile(current, current.currentPlayerId, tile, { anchorHexId: hex }));
        }
        golden = advance(golden, endCurrentTurn);
      } else if (golden.phase === "endRound") golden = advance(golden, resolveEndRound);
      else throw new Error(`Unexpected Golden opportunity phase ${golden.phase}`);
      golden = settle(golden);
    }
    if (!ready() || golden.phase !== "turns") throw new Error(`Golden fixture ${id} did not become ready.`);
    result[id] = snapshot(golden);
    for (const entry of ledgerEntries.slice(0, threshold)) result[id].campaign.completions[entry.id] = { entryId: entry.id, completedOnce: true, completedPlayerCounts: [], notes: "Example progress for the isolated comparison scenario." };
  }

  // Two Stewards with disconnected starting settlements expose temporary reach
  // and an actual Burden response. Every action uses the ordinary rules engine.
  let stewardGame = startStewards(createNewGame(2, ["ranger", "warden"], { encounterSeed: seed }));
  for (let guard = 0; (!result["ranger-reach"] || !result["warden-response"]) && guard < 100; guard++) {
    if (stewardGame.phase === "seeding") stewardGame = seedSeason(stewardGame);
    else if (stewardGame.phase === "reveal") stewardGame = advance(stewardGame, revealEncounters);
    else if (stewardGame.phase === "turns") {
      if (stewardGame.round === 1) {
        for (const tileId of ["c15_path", "c05_cabin"]) {
          const hexId = getLegalPlacementHexes(stewardGame, stewardGame.currentPlayerId, tileId)[0];
          if (!hexId) throw new Error(`No legal Steward fixture placement for ${tileId}.`);
          stewardGame = advance(stewardGame, (current) => placeTile(current, current.currentPlayerId, tileId, { anchorHexId: hexId }));
        }
      }
      stewardGame = advance(stewardGame, endCurrentTurn);
    } else if (stewardGame.phase === "endRound") stewardGame = advance(stewardGame, resolveEndRound);
    else throw new Error(`Unexpected Steward fixture phase ${stewardGame.phase}`);
    stewardGame = settle(stewardGame, stewardGame.map.placedTiles.length > 0);
    const response = stewardGame.pendingEffects[0];
    if (!result["warden-response"] && canCancelPendingBurdenWithWarden(stewardGame).ok && stewardGame.map.placedTiles.length > 0 && (response.requiresManualChoice || hasEffectAdjustment(response.suggestedAdjustment ?? {}))) result["warden-response"] = snapshot(stewardGame);
    stewardGame = settle(stewardGame);
    if (!result["ranger-reach"] && stewardGame.phase === "turns" && stewardGame.round >= 2 && stewardGame.currentPlayerId === "player_1") result["ranger-reach"] = snapshot(stewardGame);
  }
  if (!result["ranger-reach"] || !result["warden-response"]) throw new Error("Steward fixtures did not reach both decisions.");

  // Sentinel has spent four ordinary actions and can still improve the Path.
  // Its upgraded Mine neighbour makes the conditional Supported bonus visible.
  let sentinel = settle(advance(seedSeason(startStewards(createNewGame(2, ["sentinel", "knight"], { encounterSeed: seed }))), revealEncounters));
  for (const tileId of ["c02_mine_tunnel", "c15_path"]) {
    const hexId = getLegalPlacementHexes(sentinel, sentinel.currentPlayerId, tileId)[0];
    if (!hexId) throw new Error(`No legal Sentinel fixture placement for ${tileId}.`);
    sentinel = advance(sentinel, (current) => placeTile(current, current.currentPlayerId, tileId, { anchorHexId: hexId }));
  }
  const mineId = sentinel.map.placedTiles.find((tile) => tile.tileId === "c02_mine_tunnel")!.instanceId;
  sentinel = settle(advance(sentinel, (current) => upgradeTile(current, current.currentPlayerId, mineId)));
  sentinel = settle(advance(sentinel, (current) => activateTile(current, current.currentPlayerId, mineId)));
  result["sentinel-upgrade"] = snapshot(sentinel);

  // Branch an existing real game and preserve enough Housing for the third
  // Season's printed choice. Payment preferences are only this demo's strategy.
  let late = structuredClone(result.settlement.state!);
  const lateRule = "burden_too_many_houses_too_little_homes:s3";
  for (let guard = 0; late.pendingEffects[0]?.ruleId !== lateRule && guard < 100; guard++) {
    if (late.phase === "turns") {
      if (late.round === 2 && late.currentPlayerId === "player_2") {
        const farm = late.map.placedTiles.find((tile) => tile.tileId === "c04_farmstead")!.instanceId;
        for (let i = 0; i < 2; i++) late = settle(advance(late, (current) => activateTile(current, current.currentPlayerId, farm)));
        const hex = getLegalPlacementHexes(late, late.currentPlayerId, "c05_cabin")[0];
        if (!hex) throw new Error("Late fixture cannot place its third Cabin.");
        late = advance(late, (current) => placeTile(current, current.currentPlayerId, "c05_cabin", { anchorHexId: hex }));
        late = settle(advance(late, (current) => activateTile(current, current.currentPlayerId, farm)));
      }
      late = advance(late, endCurrentTurn);
    } else if (late.phase === "endRound") late = advance(late, resolveEndRound);
    else if (late.phase === "seeding") late = seedSeason(late);
    else if (late.phase === "reveal") late = advance(late, revealEncounters);
    else throw new Error(`Unexpected late fixture phase ${late.phase}`);
    late = settle(late, false, { preferPayments: true, stopBeforeRuleId: lateRule });
  }
  if (late.season !== 3 || late.pendingEffects[0]?.ruleId !== lateRule) throw new Error("Late fixture did not reach its Season III choice.");
  result["season-three"] = snapshot(late);

  result.returning = snapshot(null);
  for (const entry of ledgerEntries.slice(0, 5)) result.returning.campaign.completions[entry.id] = { entryId: entry.id, completedOnce: true, completedPlayerCounts: [], notes: "Example progress for the isolated comparison scenario." };
  writeFileSync(new URL("../src/app/scenarios.generated.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  console.log(Object.entries(result).map(([id, value]) => ({ id, phase: value.state?.phase ?? "welcome", round: value.state?.round, tiles: value.state?.map.placedTiles.length, effects: value.state?.pendingEffects.length })));
} finally {
  Date.now = realNow;
}

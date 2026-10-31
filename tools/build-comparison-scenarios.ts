/** Rebuild the isolated comparison fixtures through the established game engine. */
import { writeFileSync } from "node:fs";
import { createNewGame } from "../src/engine/setup";
import { canCancelPendingBurdenWithWarden, activateTile, endCurrentTurn, placeTile, resolveEndRound, revealEncounters, useStewardPower, upgradeTile } from "../src/engine/gameActions";
import { hasEffectAdjustment } from "../src/engine/manualEffects";
import { getLegalPlacementHexes } from "../src/engine/placementRules";
import { createEmptyLedgerCampaign, type LedgerCampaign } from "../src/engine/ledgerCampaign";

/** Example progress for an isolated scenario: the first cards of the deck, completed. */
function withQuestCards(campaign: LedgerCampaign, count: number): LedgerCampaign {
  return { ...campaign, deck: campaign.deck.slice(count), box: campaign.deck.slice(0, count) };
}
import type { PreviewSnapshot } from "../src/app/scenarioTypes";
import type { ScenarioId } from "../src/app/scenarioCatalog";
import { advance, seed, seedSeason, settle, snapshot, startStewards } from "./scenario-steps";
import { carefulValueOf, playTurn } from "./showcase-bot";
import { arrivalScene, boonScene, guildScene, protectScene, specialScene, timeScene } from "./decision-scenes";
import { trackLedgerTransition } from "../src/engine/ledger";
import type { GameState } from "../src/engine/types";

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
  // Decision scenes, staged from this position for the walkthroughs.
  result["decide-arrival"] = snapshot(arrivalScene(state));
  result["decide-protect"] = snapshot(protectScene(state));
  result["decide-boon"] = snapshot(boonScene(state));
  result["decide-special"] = snapshot(specialScene(state));
  result["decide-time"] = snapshot(timeScene(state));
  result["decide-guild"] = snapshot(guildScene(state));

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
    result[id].campaign = withQuestCards(result[id].campaign, expected === "bell" ? 3 : expected === "scroll" ? 6 : 15);
  }

  // Ongoing/automatic Golden effects have no dedicated pending-choice state.
  for (const [id, boonId, threshold] of [
    ["golden-vial", "golden_boon_the_golden_vial", 9],
    ["golden-traveller", "golden_boon_the_golden_eyed_traveler", 12]
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
    result[id].campaign = withQuestCards(result[id].campaign, threshold);
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
  // The Warden's decision scene is this real position, walked through.
  result["decide-warden"] = result["warden-response"];

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

  // Showcase moments for first-time viewers. Each comes from a full game
  // played by a simple lookahead bot through ordinary engine actions.
  const chainRule = "system:overstrain-spread";
  const playShowcase = (acceptStrain: boolean, stop: (state: GameState) => boolean, value?: (state: GameState) => number) => {
    const resolveWith = (state: GameState) => settle(state, false, acceptStrain ? {} : { preferPayments: true });
    let game = startStewards(createNewGame(2, ["vanguard", "knight"], { encounterSeed: seed }));
    let caught: GameState | null = null;
    const watch = (state: GameState) => {
      const paused = settle(state, false, { ...(acceptStrain ? {} : { preferPayments: true }), stopBeforeRuleId: chainRule });
      if (!caught && stop(paused)) caught = paused;
      return resolveWith(paused);
    };
    for (let guard = 0; !caught && game.phase !== "gameEnd" && guard < 400; guard++) {
      if (game.phase === "seeding") game = seedSeason(game);
      else if (game.phase === "reveal") game = advance(game, revealEncounters);
      else if (game.phase === "endRound") game = advance(game, resolveEndRound);
      else if (game.phase === "turns") game = playTurn(game, (state) => settle(state, false, { preferPayments: true }), trackLedgerTransition, watch, value);
      if (!caught) game = watch(game);
    }
    if (!caught) throw new Error("Showcase game did not reach its moment.");
    return caught as GameState;
  };
  // The finale is the same played game carried through to its final scoring,
  // so the end screen shows a settlement that was actually built.
  const finished = playShowcase(false, (state) => state.phase === "gameEnd", carefulValueOf);
  if (finished.phase !== "gameEnd") throw new Error("Finale game did not finish.");
  result.finale = snapshot(finished);
  result["showcase-late"] = snapshot(playShowcase(false, (state) => state.phase === "turns" && state.round === 11 && state.actionsRemaining === 4 && !state.pendingEffects.length));
  result["showcase-chain"] = snapshot(playShowcase(true, (state) => state.pendingEffects[0]?.ruleId === chainRule));
  result["showcase-season"] = snapshot(playShowcase(true, (state) => state.phase === "endRound" && state.round === 8 && !state.pendingEffects.length));

  // The guided first game: solo Vanguard on the shared seed, ready to seed Season I.
  result.guided = snapshot(startStewards(createNewGame(1, ["vanguard"], { encounterSeed: seed })));

  result.returning = snapshot(null);
  result.returning.campaign = withQuestCards(result.returning.campaign, 3);
  writeFileSync(new URL("../src/app/scenarios.generated.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
  console.log(Object.entries(result).map(([id, value]) => ({ id, phase: value.state?.phase ?? "welcome", round: value.state?.round, tiles: value.state?.map.placedTiles.length, effects: value.state?.pendingEffects.length })));
} finally {
  Date.now = realNow;
}

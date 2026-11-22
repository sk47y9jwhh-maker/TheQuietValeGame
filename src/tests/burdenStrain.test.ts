import { describe, expect, it } from "vitest";
import { cardEffectRuleId } from "../data/effectRules";
import { getBurdenResolutionCost } from "../data/contentRules";
import { resolvePendingEffect } from "../engine/manualEffects";
import { resolveBurden, resolveEndRound } from "../engine/gameActions";
import { getHexNeighbors } from "../engine/hex";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile, Season } from "../engine/types";

// Burdens: making them bite (Robert, 22 Nov): overflow to the card's group,
// 3/5/7 resolution, 2 resources per Strain avoided, "while active" modifiers,
// +2 on the first Tile and 1 adjacent Social/Wellbeing hit on cluster cards.

const placed = (instanceId: string, tileId: string, hexId: string, strain = 0): PlacedTile => ({
  instanceId,
  tileId,
  kind: "core",
  side: "basic",
  hexIds: [hexId],
  strain,
  support: { passive: false, singleUse: false, preventedThisRound: false }
});

function stateWith(tiles: PlacedTile[], season: Season = 1): GameState {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.season = season;
  state.map.placedTiles = tiles;
  return state;
}

function pending(state: GameState, cardId: string, season: Season): GameState {
  return {
    ...state,
    pendingEffects: [{
      id: `effect_${cardId}`,
      ruleId: cardEffectRuleId(cardId, season),
      sourceType: "card",
      sourceId: cardId,
      sourceName: cardId,
      title: cardId,
      effectText: "Display text only",
      requiresManualChoice: true
    }]
  };
}

const strainOf = (state: GameState, id: string) =>
  state.map.placedTiles.find((tile) => tile.instanceId === id)?.strain;

const neighbor = (hexId: string, skip: string[] = []) =>
  getHexNeighbors(hexId).find((hex) => !skip.includes(hex))!;

describe("Burden overflow (A2)", () => {
  it("sends a single named Tile's Strain to a Resource Tile when the Tile is missing", () => {
    const state = pending(stateWith([placed("farm", "c04_farmstead", "G1")]), "burden_forest_s_grudge", 1);
    const afterMain = resolvePendingEffect(state, {});
    expect(afterMain.pendingEffects.map((effect) => effect.ruleId))
      .toEqual(["burden_forest_s_grudge:s1:overflow1"]);
    const done = resolvePendingEffect(afterMain, { tileStrainDeltas: { farm: 1 } });
    expect(strainOf(done, "farm")).toBe(1);
    expect(done.pendingEffects).toHaveLength(0);
  });

  it("only overflows the part a row could not place", () => {
    const h1 = neighbor("G1");
    const state = pending(stateWith([
      placed("craft", "c13_workshops", "G1"),
      placed("home", "c05_cabin", h1)
    ], 2), "burden_smoke_over_hearths", 2);
    const afterMain = resolvePendingEffect(state, { tileStrainDeltas: { home: 1 } });
    expect(strainOf(afterMain, "home")).toBe(1);
    expect(afterMain.pendingEffects.map((effect) => effect.ruleId))
      .toEqual(["burden_smoke_over_hearths:s2:overflow1"]);
    const done = resolvePendingEffect(afterMain, { tileStrainDeltas: { craft: 1 } });
    expect(strainOf(done, "craft")).toBe(1);
  });

  it("charges Bare Walls 2 Goods for each Strain it cannot place", () => {
    const state = pending(stateWith([], 2), "burden_bare_walls", 2);
    state.warehouse.goods = 6;
    const afterMain = resolvePendingEffect(state, {});
    expect(afterMain.pendingEffects[0].ruleId).toBe("burden_bare_walls:s2:overflow2");
    const done = resolvePendingEffect(afterMain, { resourceDeltas: { goods: -4 } });
    expect(done.warehouse.goods).toBe(2);
  });

  it("does not overflow when the player pays instead of taking Strain", () => {
    const state = pending(stateWith([placed("tavern", "c09_tavern", "G1")], 2), "burden_empty_shelves", 2);
    state.warehouse.goods = 4;
    const done = resolvePendingEffect(state, { resourceDeltas: { goods: -2 }, tileStrainDeltas: {} });
    // One Social Tile paid for; the second choice has no Social Tile and no Merchant to overflow to.
    expect(done.pendingEffects).toHaveLength(0);
    expect(done.warehouse.goods).toBe(2);
  });
});

describe("Burden follow-up on the protecting Social/Wellbeing Tile", () => {
  it("hits 1 Social/Wellbeing beside a Tile Coin Before Craft hit", () => {
    const merchantHex = "G1";
    const craftHex = neighbor(merchantHex);
    const tavernHex = neighbor(merchantHex, [craftHex]);
    const state = pending(stateWith([
      placed("merchant", "c14_market_stalls", merchantHex),
      placed("craft", "c13_workshops", craftHex),
      placed("tavern", "c09_tavern", tavernHex)
    ], 2), "burden_coin_before_craft", 2);
    const afterMain = resolvePendingEffect(state, { tileStrainDeltas: { merchant: 1, craft: 1 } });
    expect(afterMain.pendingEffects.map((effect) => effect.ruleId))
      .toEqual(["burden_coin_before_craft:s2:protector"]);
    const done = resolvePendingEffect(afterMain, { tileStrainDeltas: { tavern: 1 } });
    expect(strainOf(done, "tavern")).toBe(1);
  });

  it("puts +2 on the first Tile of a Season III cluster row", () => {
    const state = pending(stateWith([
      placed("tavern", "c09_tavern", "A1"),
      placed("eatery", "c10_eatery", "E1"),
      placed("apothecary", "c12_apothecary", "J1")
    ], 3), "burden_the_long_cough", 3);
    // The Target Deck picks which Tile takes the +2.
    const done = resolvePendingEffect(state);
    expect(done.map.placedTiles.map((tile) => tile.strain).sort()).toEqual([1, 1, 2]);
    expect(done.pendingEffects).toHaveLength(0);
  });
});

describe("Burden resolution and modifiers", () => {
  it("costs 3/5/7 by Season", () => {
    expect([1, 2, 3].map((season) => getBurdenResolutionCost("burden_smoke_over_hearths", season as Season)?.goods))
      .toEqual([3, 5, 7]);
  });

  it("keeps Plans Left Waiting active every round until it is resolved", () => {
    const state = stateWith([]);
    state.phase = "endRound";
    state.round = 2;
    state.encounters.activeBurdens = ["burden_plans_left_waiting"];
    state.boonModifiers = [];
    const nextRound = resolveEndRound(state);
    expect(nextRound.boonModifiers.map((modifier) => modifier.sourceCardId))
      .toEqual(["burden_plans_left_waiting"]);

    const turns = { ...nextRound, phase: "turns" as const, pendingEffects: [] };
    turns.warehouse = { ...turns.warehouse, food: 3 };
    const prompted = resolveBurden(turns, "burden_plans_left_waiting");
    const resolved = resolveBurden(prompted, "burden_plans_left_waiting", { selectedOptionIds: [] });
    expect(resolved.encounters.activeBurdens).toHaveLength(0);
    expect(resolved.boonModifiers.some((modifier) => modifier.sourceCardId === "burden_plans_left_waiting"))
      .toBe(false);
  });
});

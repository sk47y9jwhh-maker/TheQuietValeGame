import { describe, expect, it } from "vitest";
import {
  cardEffectRuleId,
  stewardEffectRuleId,
  systemEffectRuleId,
  tileEffectRuleId
} from "../data/effectRules";
import {
  effectHasNoValidChoiceTargets,
  getAlternativeEffectRule,
  getEffectSupportTargets,
  getEffectTileTargets,
  getHelpStandsRule,
  getResourceGainChoiceRule,
  getStrainCascadeAnchorTargets,
  getStrainCascadeRule,
  getStrainCascadeSpreadTargets,
  getTileAdjustmentRule,
  getTimerAdjustmentRule,
  isAlternativeEffectAdjustmentValid,
  isResourceGainChoiceAdjustmentValid,
  isTileAdjustmentValid,
  isTimerAdjustmentValid,
  resolvePendingEffect,
  skipPendingEffect,
  suggestEffectAdjustment
} from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile, Season } from "../engine/types";

const placed = (
  instanceId: string,
  tileId: string,
  hexId: string,
  strain = 0,
  side: PlacedTile["side"] = "basic"
): PlacedTile => ({
  instanceId,
  tileId,
  kind: side === "special" ? "special" : "core",
  side,
  hexIds: [hexId],
  strain,
  support: { passive: false, singleUse: false, preventedThisRound: false }
});

function stateWith(tiles: PlacedTile[] = []): GameState {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.map.placedTiles = tiles;
  return state;
}

describe("structured effect rules", () => {
  it("suggests fixed resource gains without reading display text", () => {
    const state = stateWith();
    expect(
      suggestEffectAdjustment(state, cardEffectRuleId("boon_a_wonderful_find", 2))
        .adjustment?.resourceDeltas
    ).toMatchObject({ metal: 1, goods: 1 });
  });

  it.each([
    [1, 2],
    [2, 4],
    [3, 6]
  ] as const)("calculates Help Stands in Season %i", (season, amount) => {
    const state = createNewGame(4, ["vanguard", "warden", "knight", "quartermaster"]);
    state.season = season;
    state.players = state.players.map((player, index) => ({
      ...player,
      stewardHexId: ["G1", "H1", "I1", "J1"][index]
    }));
    state.map.placedTiles = [
      placed("a", "c15_path", "G1"),
      placed("b", "c15_path", "H1"),
      placed("c", "c15_path", "I1"),
      placed("d", "c15_path", "J1", 1)
    ];
    const ruleId = cardEffectRuleId("boon_where_help_stands", season as Season);
    expect(getHelpStandsRule(state, ruleId)).toEqual({
      resourceAmount: amount,
      tileStrainDeltas: { d: -1 }
    });
    expect(getResourceGainChoiceRule(state, ruleId)).toMatchObject({ amount });
    expect(suggestEffectAdjustment(state, ruleId)).toMatchObject({
      adjustment: { tileStrainDeltas: { d: -1 } },
      requiresManualChoice: true
    });
  });

  it("validates an exact typed resource choice", () => {
    const state = stateWith();
    const ruleId = cardEffectRuleId("boon_a_wonderful_find", 1);
    expect(getResourceGainChoiceRule(state, ruleId)).toMatchObject({
      resources: ["metal", "goods"],
      amount: 1
    });
    expect(isResourceGainChoiceAdjustmentValid(state, ruleId, {
      resourceDeltas: { metal: 1 }
    })).toBe(true);
    expect(isResourceGainChoiceAdjustmentValid(state, ruleId, {
      resourceDeltas: { metal: 1, goods: 1 }
    })).toBe(false);
  });

  it("validates Settlement of Plenty's mutually exclusive outcome", () => {
    const state = stateWith([placed("path", "c15_path", "G1", 2)]);
    const ruleId = cardEffectRuleId("boon_the_settlement_of_plenty", 3);
    expect(isResourceGainChoiceAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { path: -1 }
    })).toBe(true);
    expect(isResourceGainChoiceAdjustmentValid(state, ruleId, {
      resourceDeltas: { food: 4, goods: 1 }
    })).toBe(true);
    expect(isResourceGainChoiceAdjustmentValid(state, ruleId, {
      resourceDeltas: { food: 5 },
      tileStrainDeltas: { path: -1 }
    })).toBe(false);
  });

  it("uses a no-arrival fallback only in Season III", () => {
    const state = stateWith([placed("path", "c15_path", "G1")]);
    const early = cardEffectRuleId("burden_promises_overstretched", 1);
    const late = cardEffectRuleId("burden_promises_overstretched", 3);
    expect(effectHasNoValidChoiceTargets(state, early)).toBe(true);
    expect(getEffectTileTargets(state, late).map((tile) => tile.instanceId)).toEqual(["path"]);
    expect(getTileAdjustmentRule(state, late).strain).toMatchObject({
      direction: "place",
      maxTotal: 2
    });
  });

  it("targets named tiles through stable tile ids", () => {
    const state = stateWith([
      placed("lumber", "c01_lumber_yard", "G1"),
      placed("farm", "c04_farmstead", "H1")
    ]);
    const targets = getEffectTileTargets(
      state,
      cardEffectRuleId("burden_forest_s_grudge", 1)
    );
    expect(targets.map((tile) => tile.instanceId)).toEqual(["lumber"]);
  });

  it.each([
    ["burden_forest_s_grudge", "c01_lumber_yard"],
    ["burden_blighted_lands", "c04_farmstead"],
    ["burden_awoken_in_the_deep", "c02_mine_tunnel"],
    ["burden_stampede", "c03_gathering_outpost"]
  ] as const)("applies %s's Season III primary and adjacent Strain", (cardId, anchorTileId) => {
    const state = stateWith([
      placed("anchor", anchorTileId, "G1"),
      placed("adjacent", "c15_path", "H1"),
      placed("remote", "c15_path", "J1")
    ]);
    const ruleId = cardEffectRuleId(cardId, 3);
    const suggestion = suggestEffectAdjustment(state, ruleId);

    expect(getStrainCascadeAnchorTargets(state, ruleId).map((tile) => tile.instanceId))
      .toEqual(["anchor"]);
    expect(getStrainCascadeSpreadTargets(state, ruleId, "anchor").map((tile) => tile.instanceId))
      .toEqual(["adjacent"]);
    expect(suggestion).toMatchObject({
      adjustment: {
        strainCascadeAnchorTileId: "anchor",
        tileStrainDeltas: { adjacent: 1 }
      },
      requiresManualChoice: false
    });
    expect(isTileAdjustmentValid(state, ruleId, suggestion.adjustment ?? {})).toBe(true);

    state.pendingEffects = [{
      id: "effect_cascade",
      ruleId,
      sourceType: "card",
      sourceId: cardId,
      sourceName: cardId,
      title: "Season III cascade",
      effectText: "Display text only"
    }];
    const resolved = resolvePendingEffect(state, suggestion.adjustment);
    expect(resolved.map.placedTiles.map((tile) => tile.strain)).toEqual([2, 1, 0]);
  });

  it("allows a cascade Burden with no valid anchor to be acknowledged as no effect", () => {
    const state = stateWith([placed("path", "c15_path", "G1")]);
    const ruleId = cardEffectRuleId("burden_awoken_in_the_deep", 3);
    expect(effectHasNoValidChoiceTargets(state, ruleId)).toBe(true);
    expect(isTileAdjustmentValid(state, ruleId, {})).toBe(true);
    state.pendingEffects = [{
      id: "effect_no_anchor",
      ruleId,
      sourceType: "card",
      sourceName: "Awoken Below",
      title: "Awoken Below",
      effectText: "Display text only"
    }];
    expect(resolvePendingEffect(state).pendingEffects).toHaveLength(0);
  });

  it.each([
    ["burden_awoken_in_the_deep", "c02_mine_tunnel", "c05_cabin"],
    ["burden_stampede", "c03_gathering_outpost", "c01_lumber_yard"]
  ] as const)("restricts %s's adjacent cascade categories", (cardId, anchorTileId, disallowedTileId) => {
    const state = stateWith([
      placed("anchor", anchorTileId, "G1"),
      placed("disallowed", disallowedTileId, "H1")
    ]);
    const ruleId = cardEffectRuleId(cardId, 3);
    expect(getStrainCascadeSpreadTargets(state, ruleId, "anchor")).toEqual([]);
  });

  it("applies a cascade's full printed primary amount before Supported prevention", () => {
    const anchor = placed("anchor", "c01_lumber_yard", "G1", 2);
    anchor.support.singleUse = true;
    const state = stateWith([anchor, placed("adjacent", "c15_path", "H1")]);
    const ruleId = cardEffectRuleId("burden_forest_s_grudge", 3);
    const suggestion = suggestEffectAdjustment(state, ruleId);
    state.pendingEffects = [{
      id: "effect_supported_cascade",
      ruleId,
      sourceType: "card",
      sourceName: "Forest's Grudge",
      title: "Forest's Grudge",
      effectText: "Display text only"
    }];

    const resolved = resolvePendingEffect(state, suggestion.adjustment);
    expect(resolved.map.placedTiles[0].strain).toBe(3);
    expect(resolved.map.placedTiles[0].support.preventedThisRound).toBe(true);
    expect(resolved.map.placedTiles[1].strain).toBe(1);
  });

  it("enforces The Quiet Fractures' Season II anchor, adjacency, and zero-Strain target", () => {
    const state = stateWith([
      placed("anchor", "c15_path", "G1", 1),
      placed("adjacent", "c05_cabin", "H1"),
      placed("remote", "c13_workshops", "J1")
    ]);
    const ruleId = cardEffectRuleId("burden_the_quiet_fractures", 2);
    const suggestion = suggestEffectAdjustment(state, ruleId);

    expect(getStrainCascadeAnchorTargets(state, ruleId).map((tile) => tile.instanceId))
      .toEqual(["anchor"]);
    expect(getStrainCascadeSpreadTargets(state, ruleId, "anchor").map((tile) => tile.instanceId))
      .toEqual(["adjacent"]);
    expect(isTileAdjustmentValid(state, ruleId, {
      strainCascadeAnchorTileId: "anchor",
      tileStrainDeltas: { remote: 1 }
    })).toBe(false);
    expect(suggestion.adjustment).toMatchObject({
      strainCascadeAnchorTileId: "anchor",
      tileStrainDeltas: { adjacent: 1 }
    });

    state.pendingEffects = [{
      id: "effect_quiet_s2",
      ruleId,
      sourceType: "card",
      sourceName: "The Quiet Fractures",
      title: "The Quiet Fractures",
      effectText: "Display text only"
    }];
    const resolved = resolvePendingEffect(state, suggestion.adjustment);
    expect(resolved.map.placedTiles.map((tile) => tile.strain)).toEqual([2, 1, 0]);
  });

  it("uses an Overstrained Quiet Fractures anchor without treating it as a Strain target", () => {
    const state = stateWith([
      placed("anchor", "c15_path", "G1", 3),
      placed("left", "c05_cabin", "F1"),
      placed("right", "c13_workshops", "H1"),
      placed("remote", "c09_tavern", "J1")
    ]);
    const ruleId = cardEffectRuleId("burden_the_quiet_fractures", 3);
    const suggestion = suggestEffectAdjustment(state, ruleId);

    expect(getStrainCascadeRule(state, ruleId)).toMatchObject({
      anchorStrain: 0,
      maxSpreadTargets: 2
    });
    expect(getStrainCascadeAnchorTargets(state, ruleId).map((tile) => tile.instanceId))
      .toEqual(["anchor"]);
    expect(getStrainCascadeSpreadTargets(state, ruleId, "anchor").map((tile) => tile.instanceId))
      .toEqual(["left", "right"]);
    expect(suggestion.adjustment).toMatchObject({
      strainCascadeAnchorTileId: "anchor",
      tileStrainDeltas: { left: 1, right: 1 }
    });
    expect(isTileAdjustmentValid(state, ruleId, {
      strainCascadeAnchorTileId: "anchor",
      tileStrainDeltas: { left: 1, remote: 1 }
    })).toBe(false);

    state.pendingEffects = [{
      id: "effect_quiet_s3",
      ruleId,
      sourceType: "card",
      sourceName: "The Quiet Fractures",
      title: "The Quiet Fractures",
      effectText: "Display text only"
    }];
    const resolved = resolvePendingEffect(state, suggestion.adjustment);
    expect(resolved.map.placedTiles.map((tile) => tile.strain)).toEqual([3, 1, 1, 0]);
  });

  it("uses The Quiet Fractures' adjacent Season II pattern as its Season III fallback", () => {
    const state = stateWith([
      placed("anchor", "c15_path", "G1", 2),
      placed("adjacent", "c05_cabin", "H1")
    ]);
    const ruleId = cardEffectRuleId("burden_the_quiet_fractures", 3);
    expect(getStrainCascadeRule(state, ruleId)).toMatchObject({
      anchorStrain: 1,
      maxSpreadTargets: 1
    });
    expect(suggestEffectAdjustment(state, ruleId).adjustment).toMatchObject({
      strainCascadeAnchorTileId: "anchor",
      tileStrainDeltas: { adjacent: 1 }
    });
  });

  it("enforces category adjacency through typed target filters", () => {
    const state = stateWith([
      placed("housing", "c05_cabin", "G1"),
      placed("craft", "c13_workshops", "H1"),
      placed("other", "c05_cabin", "J1")
    ]);
    expect(
      getEffectTileTargets(state, cardEffectRuleId("burden_smoke_over_hearths", 1))
        .map((tile) => tile.instanceId)
    ).toEqual(["housing"]);
  });

  it("uses the typed fallback when a primary category has no targets", () => {
    const state = stateWith([placed("merchant", "c14_market_stalls", "G1")]);
    expect(
      getEffectTileTargets(state, cardEffectRuleId("burden_wares_of_war", 3))
        .map((tile) => tile.instanceId)
    ).toEqual(["merchant"]);
  });

  it("validates timer limits", () => {
    const state = stateWith();
    state.encounters.activeArrivals = [{ cardId: "arrival_a", timerTokens: 1 }];
    const ruleId = cardEffectRuleId("boon_a_little_more_time", 2);
    expect(getTimerAdjustmentRule(state, ruleId)).toEqual({ direction: "add", limit: 2 });
    expect(isTimerAdjustmentValid(state, ruleId, { arrival_a: 2 })).toBe(true);
    expect(isTimerAdjustmentValid(state, ruleId, { arrival_a: 3 })).toBe(false);
  });

  it("validates pay-or-Strain alternatives", () => {
    const state = stateWith([
      placed("social_a", "c09_tavern", "G1"),
      placed("social_b", "c10_eatery", "H1")
    ]);
    state.warehouse.goods = 2;
    const ruleId = cardEffectRuleId("burden_empty_shelves", 2);
    expect(getAlternativeEffectRule(state, ruleId)).toMatchObject({
      kind: "pay_or_strain",
      requiredChoices: 2
    });
    expect(isAlternativeEffectAdjustmentValid(state, ruleId, {
      resourceDeltas: { goods: -1 },
      tileStrainDeltas: { social_a: 1 }
    })).toBe(true);
  });

  it("validates the warehouse-loss fallback", () => {
    const state = stateWith([placed("resource", "c01_lumber_yard", "G1")]);
    state.warehouse.wood = 1;
    const ruleId = cardEffectRuleId("burden_the_storehouses_disagree", 1);
    expect(getAlternativeEffectRule(state, ruleId)).toMatchObject({
      kind: "warehouse_loss_or_strain",
      requiredStrainTotal: 1
    });
    expect(isAlternativeEffectAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { resource: 1 }
    })).toBe(true);
  });

  it("automatically suggests a sole adjacent Strain target", () => {
    const source = placed("tavern", "c09_tavern", "G1");
    const state = stateWith([source, placed("path", "c15_path", "H1", 2)]);
    const ruleId = tileEffectRuleId("c09_tavern", "basic");
    expect(suggestEffectAdjustment(state, ruleId, source)).toMatchObject({
      adjustment: { tileStrainDeltas: { path: -1 } },
      requiresManualChoice: false
    });
  });

  it("automatically supports a sole adjacent target", () => {
    const source = placed("alms", "special_alms_house", "G1", 0, "special");
    const state = stateWith([source, placed("path", "c15_path", "H1")]);
    const ruleId = tileEffectRuleId(source.tileId, source.side);
    expect(getEffectSupportTargets(state, ruleId, source).map((tile) => tile.instanceId)).toEqual(["path"]);
    expect(suggestEffectAdjustment(state, ruleId, source)).toMatchObject({
      adjustment: { supportTileIds: ["path"] },
      requiresManualChoice: false
    });
  });

  it("describes Warden Relief without parsing its printed power", () => {
    const state = stateWith([placed("path", "c15_path", "G1", 1)]);
    expect(getTileAdjustmentRule(state, stewardEffectRuleId("warden"))).toEqual({
      strain: { direction: "remove", maxTotal: 1, maxPerTile: 1, maxTargets: 1 },
      support: { maxTargets: 1 }
    });
  });

  it("applies and logs a structured pending effect", () => {
    const state = stateWith([placed("path", "c15_path", "G1", 1)]);
    state.pendingEffects = [{
      id: "effect_test",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Test",
      title: "Test effect",
      effectText: "Display text only",
      requiresManualChoice: true
    }];
    const next = resolvePendingEffect(state, { tileStrainDeltas: { path: 1 } });
    expect(next.map.placedTiles[0].strain).toBe(2);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("rejects adjustments outside the structured target rule", () => {
    const source = placed("tavern", "c09_tavern", "G1");
    const state = stateWith([
      source,
      placed("adjacent", "c15_path", "H1", 1),
      placed("remote", "c15_path", "J1", 1)
    ]);
    const ruleId = tileEffectRuleId(source.tileId, source.side);
    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { adjacent: -1 }
    }, source)).toBe(true);
    expect(isTileAdjustmentValid(state, ruleId, {
      tileStrainDeltas: { remote: -1 }
    }, source)).toBe(false);
  });

  it("skips only explicitly skippable pending effects", () => {
    const state = stateWith();
    state.pendingEffects = [{
      id: "effect_skip",
      ruleId: systemEffectRuleId("acknowledge"),
      sourceType: "system",
      sourceName: "Test",
      title: "Optional effect",
      effectText: "Display text only",
      canSkip: true
    }];
    expect(skipPendingEffect(state).pendingEffects).toHaveLength(0);
  });
});

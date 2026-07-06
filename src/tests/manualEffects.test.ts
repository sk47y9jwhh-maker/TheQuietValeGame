import { describe, expect, it } from "vitest";
import {
  effectHasNoValidChoiceTargets,
  getActiveEffectText,
  getAlternativeEffectRule,
  getCurrentSeasonCardEffectText,
  getEffectSupportTargets,
  getEffectTileTargets,
  getHelpStandsRule,
  getResourceGainChoiceRule,
  getTileAdjustmentRule,
  getTimerAdjustmentRule,
  isResourceGainChoiceAdjustmentValid,
  isTileAdjustmentValid,
  isAlternativeEffectAdjustmentValid,
  isTimerAdjustmentValid,
  resolvePendingEffect,
  skipPendingEffect,
  suggestEffectAdjustment
} from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import type { PlacedTile } from "../engine/types";

const pathTile = (instanceId: string, hexId: string, strain = 0): PlacedTile => ({
  instanceId,
  tileId: "c15_path",
  kind: "core",
  side: "basic",
  hexIds: [hexId],
  strain,
  support: { passive: false, singleUse: false, preventedThisRound: false }
});

const coreTile = (
  tileId: string,
  instanceId: string,
  hexId: string,
  strain = 0
): PlacedTile => ({
  instanceId,
  tileId,
  kind: "core",
  side: "basic",
  hexIds: [hexId],
  strain,
  support: { passive: false, singleUse: false, preventedThisRound: false }
});

describe("manual effect suggestions", () => {
  it("suggests exact typed resource gains", () => {
    const state = createNewGame(1, ["vanguard"]);
    const suggestion = suggestEffectAdjustment(state, "Gain 2 Metal and 2 Goods.");

    expect(suggestion.adjustment?.resourceDeltas).toMatchObject({
      metal: 2,
      goods: 2
    });
  });

  it("recognises Warden Relief's place-Supported choice", () => {
    expect(
      getTileAdjustmentRule(
        "Choose exactly one: remove 1 Strain from any tile, or place Supported on one tile."
      ).support
    ).toEqual({ maxTargets: 1 });
  });

  it.each([
    [1, 2],
    [2, 4],
    [3, 6]
  ] as const)(
    "requires Help Stands' full earned resource total in Season %i",
    (season, expectedAmount) => {
      const state = createNewGame(4, ["vanguard", "warden", "knight", "quartermaster"]);
      state.season = season;
      state.players = state.players.map((player, index) => ({
        ...player,
        stewardHexId: ["G1", "H1", "I1", "J1"][index]
      }));
      state.map.placedTiles = [
        pathTile("tile_1", "G1"),
        pathTile("tile_2", "H1"),
        pathTile("tile_3", "I1"),
        pathTile("tile_4", "J1", 1)
      ];
      const effectText = getCurrentSeasonCardEffectText(
        state,
        "boon_where_help_stands"
      );

      expect(getHelpStandsRule(state, effectText)).toEqual({
        resourceAmount: expectedAmount,
        tileStrainDeltas: { tile_4: -1 }
      });
      expect(getResourceGainChoiceRule(state, effectText)).toEqual({
        resources: ["wood", "stone", "metal", "food", "herbs", "goods"],
        amount: expectedAmount,
        alternativeToStrainRemoval: false
      });
      expect(
        isResourceGainChoiceAdjustmentValid(state, effectText, {
          resourceDeltas: { wood: 1 }
        })
      ).toBe(false);
      expect(
        isResourceGainChoiceAdjustmentValid(state, effectText, {
          resourceDeltas: { wood: expectedAmount - 1, herbs: 1 }
        })
      ).toBe(true);
      expect(suggestEffectAdjustment(state, effectText)).toEqual({
        adjustment: { tileStrainDeltas: { tile_4: -1 } },
        requiresManualChoice: true
      });
    }
  );

  it("enforces fixed any-resource gains from tile effects", () => {
    const state = createNewGame(1, ["vanguard"]);
    const effectText =
      "Passive: Gain +2 additional resources of types that tile can produce.";

    expect(getResourceGainChoiceRule(state, effectText)?.amount).toBe(2);
    expect(
      isResourceGainChoiceAdjustmentValid(state, effectText, {
        resourceDeltas: { wood: 1 }
      })
    ).toBe(false);
    expect(
      isResourceGainChoiceAdjustmentValid(state, effectText, {
        resourceDeltas: { wood: 1, food: 1 }
      })
    ).toBe(true);
  });

  it("keeps Wonderful Find's resource choice playable without a Dig Site", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 1;
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "boon_a_wonderful_find"
    );

    expect(getResourceGainChoiceRule(state, effectText)).toEqual({
      resources: ["metal", "goods"],
      amount: 1,
      alternativeToStrainRemoval: false
    });
    expect(effectHasNoValidChoiceTargets(state, effectText)).toBe(false);
    expect(suggestEffectAdjustment(state, effectText).requiresManualChoice).toBe(true);
    expect(
      isResourceGainChoiceAdjustmentValid(state, effectText, {
        resourceDeltas: { metal: 1 }
      })
    ).toBe(true);
    expect(
      isResourceGainChoiceAdjustmentValid(state, effectText, {
        resourceDeltas: { metal: 1, goods: 1 }
      })
    ).toBe(false);
  });

  it.each([
    [1, 2],
    [2, 3],
    [3, 5]
  ] as const)(
    "requires the full Settlement of Plenty resource total in Season %i",
    (season, amount) => {
      const state = createNewGame(1, ["vanguard"]);
      state.season = season;
      const effectText = getCurrentSeasonCardEffectText(
        state,
        "boon_the_settlement_of_plenty"
      );

      expect(getResourceGainChoiceRule(state, effectText)).toEqual({
        resources: ["food", "goods"],
        amount,
        alternativeToStrainRemoval: true
      });
      expect(
        isResourceGainChoiceAdjustmentValid(state, effectText, {
          resourceDeltas: { food: 1 }
        })
      ).toBe(false);
      expect(
        isResourceGainChoiceAdjustmentValid(state, effectText, {
          resourceDeltas: { food: amount - 1, goods: 1 }
        })
      ).toBe(true);
    }
  );

  it("accepts Settlement of Plenty's Strain-removal branch without resource gains", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "boon_the_settlement_of_plenty"
    );

    expect(
      isResourceGainChoiceAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_path: -1 }
      })
    ).toBe(true);
    expect(
      isResourceGainChoiceAdjustmentValid(state, effectText, {
        resourceDeltas: { food: 5 },
        tileStrainDeltas: { tile_path: -1 }
      })
    ).toBe(false);
  });

  it("does not resolve Settlement of Plenty after only one of five resources", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "boon_the_settlement_of_plenty"
    );
    state.pendingEffects = [
      {
        id: "effect_settlement",
        sourceType: "card",
        sourceId: "boon_the_settlement_of_plenty",
        sourceName: "Settlement of Plenty",
        title: "Use Boon: Settlement of Plenty",
        effectText,
        requiresManualChoice: true
      }
    ];
    state.warehouse.food = 0;

    const incomplete = resolvePendingEffect(state, {
      resourceDeltas: { food: 1 }
    });
    expect(incomplete.pendingEffects).toHaveLength(1);
    expect(incomplete.warehouse.food).toBe(0);

    const complete = resolvePendingEffect(state, {
      resourceDeltas: { food: 5 }
    });
    expect(complete.pendingEffects).toHaveLength(0);
    expect(complete.warehouse.food).toBe(5);
  });

  it.each([1, 2] as const)(
    "treats Welcome Wears Thin as no effect with no Arrivals in Season %i",
    (season) => {
      const state = createNewGame(1, ["vanguard"]);
      state.season = season;
      state.encounters.activeArrivals = [];
      const effectText = getCurrentSeasonCardEffectText(
        state,
        "burden_welcome_wears_thin"
      );

      expect(getActiveEffectText(state, effectText)).toMatch(/no effect/i);
      expect(effectHasNoValidChoiceTargets(state, effectText)).toBe(true);
      expect(suggestEffectAdjustment(state, effectText)).toEqual({
        adjustment: undefined,
        requiresManualChoice: false
      });
    }
  );

  it("uses Welcome Wears Thin's printed Strain fallback in Season 3", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    state.encounters.activeArrivals = [];
    state.map.placedTiles = [
      pathTile("tile_1", "G1"),
      pathTile("tile_2", "H1")
    ];
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "burden_welcome_wears_thin"
    );

    expect(getActiveEffectText(state, effectText)).toMatch(
      /place 1 Strain on each of 2 placed tiles/i
    );
    expect(effectHasNoValidChoiceTargets(state, effectText)).toBe(false);
    expect(suggestEffectAdjustment(state, effectText).requiresManualChoice).toBe(true);
  });

  it("suggests timer changes when there is one active Arrival", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 1 }
    ];

    const suggestion = suggestEffectAdjustment(
      state,
      "Add up to 2 timer tokens among active Arrivals, to a maximum of 3 on each."
    );

    expect(suggestion.adjustment?.arrivalTimerDeltas).toEqual({
      arrival_the_quiet_quest: 2
    });
  });

  it("requires a choice when a timer effect has multiple targets", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 1 },
      { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 1 }
    ];

    const suggestion = suggestEffectAdjustment(
      state,
      "Add 1 timer token to 1 active Arrival, to a maximum of 3."
    );

    expect(suggestion.adjustment).toBeUndefined();
    expect(suggestion.requiresManualChoice).toBe(true);
  });

  it("caps suggested timer changes at the Arrival maximum", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 2 }
    ];

    const suggestion = suggestEffectAdjustment(
      state,
      "Add up to 3 timer tokens among active Arrivals, to a maximum of 3 on each."
    );

    expect(suggestion.adjustment?.arrivalTimerDeltas).toEqual({
      arrival_the_quiet_quest: 1
    });
  });

  it("treats add-timer effects as no effect when no Arrival can receive timers", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 3 }
    ];
    const effectText =
      "Add up to 2 timer tokens among active Arrivals, to a maximum of 3 on each.";

    const suggestion = suggestEffectAdjustment(state, effectText);

    expect(suggestion.adjustment).toBeUndefined();
    expect(suggestion.requiresManualChoice).toBe(false);
    expect(effectHasNoValidChoiceTargets(state, effectText)).toBe(true);
  });

  it("rejects add-timer adjustments that reduce timers or exceed the Boon limit", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 1 },
      { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 1 }
    ];
    const effectText =
      "Add 1 timer token to 1 active Arrival, to a maximum of 3.";

    expect(
      isTimerAdjustmentValid(state, effectText, {
        arrival_the_quiet_quest: -1
      })
    ).toBe(false);
    expect(
      isTimerAdjustmentValid(state, effectText, {
        arrival_the_quiet_quest: 1,
        arrival_remnants_of_the_cavalry: 1
      })
    ).toBe(false);
    expect(
      isTimerAdjustmentValid(state, effectText, {
        arrival_the_quiet_quest: 1
      })
    ).toBe(true);
  });

  it("does not resolve an add-timer effect with an illegal timer adjustment", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 1 },
      { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 1 }
    ];
    state.pendingEffects = [
      {
        id: "effect_1",
        sourceType: "card",
        sourceName: "A Little Time",
        title: "Use Boon: A Little Time",
        effectText: "Add 1 timer token to 1 active Arrival, to a maximum of 3.",
        requiresManualChoice: true
      }
    ];

    const next = resolvePendingEffect(state, {
      arrivalTimerDeltas: {
        arrival_the_quiet_quest: 1,
        arrival_remnants_of_the_cavalry: 1
      }
    });

    expect(next.pendingEffects).toHaveLength(1);
    expect(next.encounters.activeArrivals).toEqual(state.encounters.activeArrivals);
  });

  it("allows no-effect active Arrival choices when no Arrival is active", () => {
    const state = createNewGame(1, ["vanguard"]);

    const suggestion = suggestEffectAdjustment(
      state,
      "Choose 1 active Arrival, if any. Pay 1 Goods or remove 1 timer token. If there is no active Arrival, no effect."
    );

    expect(suggestion.adjustment).toBeUndefined();
    expect(suggestion.requiresManualChoice).toBe(false);
  });

  it("allows no-effect tile-target Burden choices when no target exists", () => {
    const state = createNewGame(1, ["vanguard"]);

    const suggestion = suggestEffectAdjustment(
      state,
      "Choose 1 Lumber Yard / Sustainable Lumber Yard with fewer than 3 Strain and place 1 Strain on it."
    );

    expect(suggestion.adjustment).toBeUndefined();
    expect(suggestion.requiresManualChoice).toBe(false);
  });

  it("does not target non-Housing tiles for a Housing Burden", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [pathTile("tile_path", "G1")];
    const effectText = getCurrentSeasonCardEffectText(
      { season: 1 },
      "burden_smoke_over_hearths"
    );

    const suggestion = suggestEffectAdjustment(state, effectText);

    expect(getEffectTileTargets(state, effectText)).toEqual([]);
    expect(effectHasNoValidChoiceTargets(state, effectText)).toBe(true);
    expect(suggestion.adjustment).toBeUndefined();
    expect(suggestion.requiresManualChoice).toBe(false);
  });

  it("only suggests a Housing Burden target when the adjacency rule is met", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c05_cabin", "tile_cabin", "G1"),
      coreTile("c13_workshops", "tile_workshops", "H1"),
      pathTile("tile_path", "I1")
    ];
    const effectText = getCurrentSeasonCardEffectText(
      { season: 1 },
      "burden_smoke_over_hearths"
    );

    const suggestion = suggestEffectAdjustment(state, effectText);

    expect(getEffectTileTargets(state, effectText).map((tile) => tile.instanceId)).toEqual([
      "tile_cabin"
    ]);
    expect(suggestion.adjustment?.tileStrainDeltas).toEqual({ tile_cabin: 1 });
  });

  it.each([
    ["burden_smoke_over_hearths", "c13_workshops", "tile_fallback"],
    ["burden_wares_of_war", "c14_market_stalls", "tile_fallback"]
  ])(
    "uses and resolves the Season III fallback for %s when no Housing target qualifies",
    (cardId, fallbackTileId, fallbackInstanceId) => {
      const state = createNewGame(1, ["vanguard"]);
      state.season = 3;
      state.map.placedTiles = [
        coreTile("c05_cabin", "tile_unqualified_housing", "G1"),
        coreTile(fallbackTileId, fallbackInstanceId, "J1")
      ];
      const effectText = getCurrentSeasonCardEffectText({ season: 3 }, cardId);
      const suggestion = suggestEffectAdjustment(state, effectText);

      expect(getEffectTileTargets(state, effectText).map((tile) => tile.instanceId)).toEqual([
        fallbackInstanceId
      ]);
      expect(suggestion.adjustment?.tileStrainDeltas).toEqual({
        [fallbackInstanceId]: 1
      });

      state.pendingEffects = [
        {
          id: "effect_fallback",
          sourceType: "card",
          sourceId: cardId,
          sourceName: cardId,
          title: "Fallback Burden",
          effectText,
          suggestedAdjustment: suggestion.adjustment,
          requiresManualChoice: suggestion.requiresManualChoice
        }
      ];
      const resolved = resolvePendingEffect(state);

      expect(resolved.pendingEffects).toHaveLength(0);
      expect(
        resolved.map.placedTiles.find((tile) => tile.instanceId === fallbackInstanceId)?.strain
      ).toBe(1);
      expect(
        resolved.map.placedTiles.find(
          (tile) => tile.instanceId === "tile_unqualified_housing"
        )?.strain
      ).toBe(0);
    }
  );

  it("limits a Season III Housing fallback to one Merchant tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    state.map.placedTiles = [
      coreTile("c14_market_stalls", "tile_market_1", "G1"),
      coreTile("c14_market_stalls", "tile_market_2", "I1")
    ];
    const effectText = getCurrentSeasonCardEffectText(
      { season: 3 },
      "burden_wares_of_war"
    );
    const suggestion = suggestEffectAdjustment(state, effectText);

    expect(suggestion.requiresManualChoice).toBe(true);
    expect(
      isTileAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_market_1: 1 }
      })
    ).toBe(true);
    expect(
      isTileAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_market_1: 1, tile_market_2: 1 }
      })
    ).toBe(false);
  });

  it("prepares exact resource losses alongside a Burden's tile choice", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    state.map.placedTiles = [
      coreTile("c13_workshops", "tile_workshops", "G1"),
      coreTile("c14_market_stalls", "tile_market", "I1")
    ];
    const effectText = getCurrentSeasonCardEffectText(
      { season: 3 },
      "burden_tools_left_to_rust"
    );
    const suggestion = suggestEffectAdjustment(state, effectText);

    expect(suggestion.adjustment?.resourceDeltas).toMatchObject({ metal: -2 });
    expect(suggestion.requiresManualChoice).toBe(true);
  });

  it("does not turn a not-adjacent Burden condition into a positive adjacency requirement", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [coreTile("c05_cabin", "tile_cabin", "G1")];
    const effectText = getCurrentSeasonCardEffectText(
      { season: 1 },
      "burden_bare_walls"
    );

    const suggestion = suggestEffectAdjustment(state, effectText);

    expect(getEffectTileTargets(state, effectText).map((tile) => tile.instanceId)).toEqual([
      "tile_cabin"
    ]);
    expect(suggestion.adjustment?.tileStrainDeltas).toEqual({ tile_cabin: 1 });
  });

  it("requires a player choice for pay-or-strain Burdens", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [coreTile("c09_tavern", "tile_social", "G1")];
    const effectText = getCurrentSeasonCardEffectText(
      { season: 1 },
      "burden_empty_shelves"
    );

    const suggestion = suggestEffectAdjustment(state, effectText);

    expect(getEffectTileTargets(state, effectText).map((tile) => tile.instanceId)).toEqual([
      "tile_social"
    ]);
    expect(suggestion.adjustment).toBeUndefined();
    expect(suggestion.requiresManualChoice).toBe(true);
  });

  it("requires every pay-or-strain outcome to be fully assigned", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 2;
    state.map.placedTiles = [
      coreTile("c09_tavern", "tile_social_1", "G1"),
      coreTile("c09_tavern", "tile_social_2", "I1")
    ];
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "burden_empty_shelves"
    );

    expect(getAlternativeEffectRule(state, effectText)).toMatchObject({
      kind: "pay_or_strain",
      requiredChoices: 2,
      resourceStep: 1
    });
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        resourceDeltas: { goods: -1 }
      })
    ).toBe(false);
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        resourceDeltas: { goods: -1 },
        tileStrainDeltas: { tile_social_1: 1 }
      })
    ).toBe(true);
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        resourceDeltas: { goods: -2 }
      })
    ).toBe(true);
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        resourceDeltas: { goods: -2 },
        tileStrainDeltas: { tile_social_1: 1 }
      })
    ).toBe(false);
  });

  it("supports complete mixed payment-or-timer choices for multiple Arrivals", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 2;
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 2 },
      { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 2 }
    ];
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "burden_promises_overstretched"
    );

    expect(getAlternativeEffectRule(state, effectText)).toMatchObject({
      kind: "pay_or_timer",
      requiredChoices: 2,
      resourceStep: 1,
      timerPerChoice: 1
    });
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        resourceDeltas: { goods: -1 },
        arrivalTimerDeltas: { arrival_the_quiet_quest: -1 }
      })
    ).toBe(true);
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        arrivalTimerDeltas: { arrival_the_quiet_quest: -1 }
      })
    ).toBe(false);
    expect(
      isTimerAdjustmentValid(state, effectText, {
        arrival_the_quiet_quest: -1,
        arrival_remnants_of_the_cavalry: -1
      })
    ).toBe(true);
  });

  it("resolves Storehouses Disagree through exactly one legal branch", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [coreTile("c01_lumber_yard", "tile_resource", "G1")];
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "burden_the_storehouses_disagree"
    );

    expect(effectHasNoValidChoiceTargets(state, effectText)).toBe(false);
    expect(getAlternativeEffectRule(state, effectText)).toMatchObject({
      kind: "warehouse_loss_or_strain",
      resources: ["wood", "stone", "food"],
      resourceStep: 2
    });
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        resourceDeltas: { wood: -2 }
      })
    ).toBe(true);
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_resource: 1 }
      })
    ).toBe(false);

    state.warehouse.food = 1;
    expect(
      isAlternativeEffectAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_resource: 1 }
      })
    ).toBe(true);
  });

  it("rejects an incomplete alternative when resolving the queued effect", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [coreTile("c01_lumber_yard", "tile_resource", "G1")];
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "burden_the_storehouses_disagree"
    );
    state.pendingEffects = [{
      id: "effect_storehouse",
      sourceType: "card",
      sourceId: "burden_the_storehouses_disagree",
      sourceName: "Storehouses Disagree",
      title: "Revealed Storehouses Disagree",
      effectText,
      requiresManualChoice: true
    }];

    expect(
      resolvePendingEffect(state, { resourceDeltas: { wood: -1 } }).pendingEffects
    ).toHaveLength(1);
    const resolved = resolvePendingEffect(state, { resourceDeltas: { wood: -2 } });
    expect(resolved.pendingEffects).toHaveLength(0);
    expect(resolved.warehouse.wood).toBe(13);
  });

  it("expands the Quiet Fractures Season III fallback into a playable branch", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    state.map.placedTiles = [
      pathTile("tile_strained", "G1", 1),
      pathTile("tile_adjacent", "H1", 0)
    ];
    const effectText = getCurrentSeasonCardEffectText(
      state,
      "burden_the_quiet_fractures"
    );

    expect(getActiveEffectText(state, effectText)).toContain("tile with 1-2 Strain");
    expect(getActiveEffectText(state, effectText)).not.toContain("use the Season II effect");
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3]
  ])(
    "recognises Empty Shelves Season %i as %i complete alternative outcomes",
    (season, expectedChoices) => {
      const state = createNewGame(1, ["vanguard"]);
      state.season = season as 1 | 2 | 3;
      state.map.placedTiles = [
        coreTile("c09_tavern", "tile_social_1", "G1"),
        coreTile("c09_tavern", "tile_social_2", "I1"),
        coreTile("c09_tavern", "tile_social_3", "K1")
      ];
      const rule = getAlternativeEffectRule(
        state,
        getCurrentSeasonCardEffectText(state, "burden_empty_shelves")
      );
      expect(rule).toMatchObject({
        kind: "pay_or_strain",
        requiredChoices: expectedChoices
      });
    }
  );

  it.each([
    ["burden_promises_overstretched", "goods"],
    ["burden_welcome_wears_thin", "herbs"]
  ])("recognises every payment-or-timer Burden branch for %s", (cardId, resource) => {
    const state = createNewGame(1, ["vanguard"]);
    state.season = 3;
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 2 },
      { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 2 },
      { cardId: "arrival_from_battle_to_cattle", timerTokens: 2 }
    ];
    const effectText = getCurrentSeasonCardEffectText(state, cardId);
    expect(getAlternativeEffectRule(state, effectText)).toMatchObject({
      kind: "pay_or_timer",
      resources: [resource],
      requiredChoices: 3
    });
    expect(getTimerAdjustmentRule(effectText)).toEqual({
      direction: "remove",
      limit: 3
    });
  });

  it.each([
    [1, 2, ["wood", "stone", "food"]],
    [2, 3, ["wood", "stone", "metal", "food", "herbs"]],
    [3, 5, ["wood", "stone", "metal", "food", "herbs"]]
  ])(
    "recognises every Storehouses Disagree Season %i branch",
    (season, resourceStep, expectedResources) => {
      const state = createNewGame(1, ["vanguard"]);
      state.season = season as 1 | 2 | 3;
      state.map.placedTiles = [
        coreTile("c01_lumber_yard", "tile_resource_1", "G1"),
        coreTile("c01_lumber_yard", "tile_resource_2", "I1")
      ];
      expect(
        getAlternativeEffectRule(
          state,
          getCurrentSeasonCardEffectText(state, "burden_the_storehouses_disagree")
        )
      ).toMatchObject({
        kind: "warehouse_loss_or_strain",
        resources: expectedResources,
        resourceStep
      });
    }
  );

  it("reads Burden effects from the active Season", () => {
    expect(
      getCurrentSeasonCardEffectText({ season: 2 }, "burden_smoke_over_hearths")
    ).toBe(
      "Choose 2 Housing Tiles with fewer than 3 Strain each adjacent to a Crafting Tile. Place 1 Strain on each."
    );
  });

  it("treats non-Overstrained Boon targets as tiles below 3 Strain", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      pathTile("tile_safe", "G1", 1),
      pathTile("tile_overstrained", "H1", 3)
    ];

    const targets = getEffectTileTargets(
      state,
      "Choose 1 connected group of 3 or more non-Overstrained tiles. Remove 1 Strain from 1 tile in that group."
    );

    expect(targets.map((tile) => tile.instanceId)).toEqual(["tile_safe"]);
  });

  it("targets only Steward-occupied tiles for Steward-occupied Boon effects", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.players[0].stewardHexId = "G1";
    state.map.placedTiles = [
      pathTile("tile_occupied", "G1", 1),
      pathTile("tile_empty", "H1", 1)
    ];

    const targets = getEffectTileTargets(
      state,
      "For each Steward-occupied tile, remove 1 Strain. For each that had none, gain 1 resource, up to 2 total."
    );

    expect(targets.map((tile) => tile.instanceId)).toEqual(["tile_occupied"]);
  });

  it("reads comma-separated categories for special tile effects", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c05_cabin", "tile_housing", "G1", 1),
      coreTile("c09_tavern", "tile_social", "H1", 1),
      coreTile("c12_apothecary", "tile_wellbeing", "I1", 1),
      pathTile("tile_travel", "J1", 1)
    ];

    const targets = getEffectTileTargets(
      state,
      "Activated Effect, once per Season: Remove up to 2 Strain from Housing, Social, and/or Wellbeing Tiles."
    );

    expect(targets.map((tile) => tile.instanceId)).toEqual([
      "tile_housing",
      "tile_social",
      "tile_wellbeing"
    ]);
  });

  it("does not force a tile-effect choice when no adjacent tile target exists", () => {
    const state = createNewGame(1, ["vanguard"]);
    const source = {
      ...coreTile("c11_washhouse", "tile_source", "G1"),
      tileId: "special_alms_house",
      kind: "special" as const,
      side: "special" as const
    };
    state.map.placedTiles = [source];
    const effectText = "When placed or activated: Choose up to two adjacent tiles. They gain Supported.";

    const suggestion = suggestEffectAdjustment(state, effectText, source);

    expect(getEffectTileTargets(state, effectText, source)).toEqual([]);
    expect(effectHasNoValidChoiceTargets(state, effectText, source)).toBe(true);
    expect(suggestion.requiresManualChoice).toBe(false);
  });

  it("keeps conditional Boon support on the adjacent Housing tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      coreTile("c14_market_stalls", "tile_merchant", "G1"),
      coreTile("c05_cabin", "tile_housing", "H1"),
      pathTile("tile_path", "I1")
    ];
    const effectText =
      "Choose 1 Merchant Tile. Gain 1 Goods for each different tile category adjacent to it, max 4 Goods. If one adjacent tile is Housing, that Housing Tile gains Supported.";

    expect(getEffectTileTargets(state, effectText).map((tile) => tile.instanceId)).toEqual([
      "tile_merchant"
    ]);
    expect(getEffectSupportTargets(state, effectText).map((tile) => tile.instanceId)).toEqual([
      "tile_housing"
    ]);
  });

  it("suggests Strain removal when there is one strained target", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [pathTile("tile_1", "G1", 3)];

    const suggestion = suggestEffectAdjustment(
      state,
      "Remove up to 2 Strain from 1 Overstrained tile."
    );

    expect(suggestion.adjustment?.tileStrainDeltas).toEqual({ tile_1: -2 });
  });

  it("suggests Supported for the only adjacent candidate", () => {
    const state = createNewGame(1, ["vanguard"]);
    const source = pathTile("tile_1", "G1");
    const neighbor = pathTile("tile_2", "H1");
    state.map.placedTiles = [source, neighbor];

    const suggestion = suggestEffectAdjustment(
      state,
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
      source
    );

    expect(suggestion.adjustment?.supportTileIds).toEqual(["tile_2"]);
  });

  it("treats an already-Supported adjacent tile as no valid target", () => {
    const state = createNewGame(1, ["vanguard"]);
    const source = pathTile("tile_1", "G1");
    const neighbor = {
      ...pathTile("tile_2", "H1"),
      support: { passive: false, singleUse: true, preventedThisRound: false }
    };
    state.map.placedTiles = [source, neighbor];
    const effectText =
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.";

    expect(getEffectSupportTargets(state, effectText, source)).toEqual([]);
    expect(effectHasNoValidChoiceTargets(state, effectText, source)).toBe(true);
    expect(suggestEffectAdjustment(state, effectText, source).requiresManualChoice).toBe(
      false
    );
  });

  it("caps Supported choices at the printed up-to count", () => {
    const state = createNewGame(1, ["vanguard"]);
    const source = pathTile("tile_source", "G1");
    const first = pathTile("tile_1", "H1");
    const second = pathTile("tile_2", "G2");
    const third = pathTile("tile_3", "F1");
    state.map.placedTiles = [source, first, second, third];
    const effectText =
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.";

    expect(getTileAdjustmentRule(effectText).support?.maxTargets).toBe(2);
    expect(
      isTileAdjustmentValid(
        state,
        effectText,
        { supportTileIds: ["tile_1", "tile_2"] },
        source
      )
    ).toBe(true);
    expect(
      isTileAdjustmentValid(
        state,
        effectText,
        { supportTileIds: ["tile_1", "tile_2", "tile_3"] },
        source
      )
    ).toBe(false);
  });

  it("caps Strain removal by both total and target count", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      pathTile("tile_1", "G1", 2),
      pathTile("tile_2", "H1", 1),
      pathTile("tile_3", "I1", 1)
    ];
    const effectText = "Remove 1 Strain from up to 2 placed tiles.";

    expect(getTileAdjustmentRule(effectText).strain).toEqual({
      direction: "remove",
      maxTotal: 2,
      maxPerTile: 1,
      maxTargets: 2
    });
    expect(
      isTileAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_1: -1, tile_2: -1 }
      })
    ).toBe(true);
    expect(
      isTileAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_1: -1, tile_2: -1, tile_3: -1 }
      })
    ).toBe(false);
    expect(
      isTileAdjustmentValid(state, effectText, {
        tileStrainDeltas: { tile_1: -2 }
      })
    ).toBe(false);
  });

  it("does not require a removal choice when every legal tile has 0 Strain", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [pathTile("tile_1", "G1", 0)];
    const effectText = "Remove up to 2 Strain from 1 placed tile.";

    expect(effectHasNoValidChoiceTargets(state, effectText)).toBe(true);
    expect(suggestEffectAdjustment(state, effectText).requiresManualChoice).toBe(false);
  });

  it("applies suggested changes when resolving a pending effect", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.pendingEffects = [
      {
        id: "effect_1",
        sourceType: "card",
        sourceName: "Test",
        title: "Test effect",
        effectText: "Gain 2 Wood.",
        suggestedAdjustment: { resourceDeltas: { wood: 2 } }
      }
    ];
    state.warehouse.wood = 1;

    const next = resolvePendingEffect(state);

    expect(next.warehouse.wood).toBe(3);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("skips an optional pending effect without applying changes", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.pendingEffects = [
      {
        id: "effect_1",
        sourceType: "card",
        sourceName: "Test Boon",
        title: "Test Boon",
        effectText: "Gain 2 Wood.",
        suggestedAdjustment: { resourceDeltas: { wood: 2 } },
        canSkip: true
      }
    ];
    state.warehouse.wood = 1;

    const next = skipPendingEffect(state);

    expect(next.warehouse.wood).toBe(1);
    expect(next.pendingEffects).toHaveLength(0);
    expect(next.log[0].message).toContain("Skipped effect");
  });
});

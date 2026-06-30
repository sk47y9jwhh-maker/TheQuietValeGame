import { describe, expect, it } from "vitest";
import {
  effectHasNoValidChoiceTargets,
  getCurrentSeasonCardEffectText,
  getEffectSupportTargets,
  getEffectTileTargets,
  getTileAdjustmentRule,
  isTileAdjustmentValid,
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

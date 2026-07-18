import { describe, expect, it } from "vitest";
import { coreTileById, coreTiles, specialTiles } from "../data/tiles";
import {
  activateTile,
  getActivatableTileIds
} from "../engine/gameActions";
import { getPassiveCostOptions } from "../engine/passiveCosts";
import { resolvePendingEffect } from "../engine/manualEffects";
import { getHexNeighbors } from "../engine/hex";
import { applyStrainToState } from "../engine/strainRules";
import { calculateFinalScore } from "../engine/scoring";
import { createNewGame } from "../engine/setup";
import type {
  GameState,
  PlacedTile,
  ResourceCost
} from "../engine/types";

function placed(
  instanceId: string,
  tileId: string,
  hexId: string,
  side: PlacedTile["side"] = "basic",
  strain = 0
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: side === "special" ? "special" : "core",
    side,
    hexIds: [hexId],
    strain,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

function readyState(tiles: PlacedTile[]): GameState {
  const state = createNewGame(1, ["vanguard"]);
  state.phase = "turns";
  state.players[0].hasPlacedFirstTile = true;
  state.players[0].stewardHexId = tiles[0]?.hexIds[0] ?? "G1";
  state.map.placedTiles = tiles;
  state.warehouse = {
    wood: 0,
    stone: 0,
    metal: 0,
    food: 0,
    herbs: 0,
    goods: 0
  };
  return state;
}

function expectedResources(values: Partial<ResourceCost>): ResourceCost {
  return { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0, ...values };
}

describe("complete tile effect audit", () => {
  const productionCases = coreTiles.flatMap((tile) =>
    (["basic", "upgraded"] as const).flatMap((side) => {
      const data = tile[side];
      return data.production
        ? [{ tileId: tile.id, side, expected: data.production, name: data.name }]
        : [];
    })
  );

  it.each(productionCases)(
    "applies $name production immediately",
    ({ tileId, side, expected }) => {
      const state = readyState([placed("source", tileId, "G1", side)]);
      const next = activateTile(state, "player_1", "source");

      expect(next.warehouse).toEqual(expected);
      expect(next.pendingEffects).toHaveLength(0);
      expect(next.actionsRemaining).toBe(3);
    }
  );

  it.each([
    ["special_shrine_of_renewal", "c01_lumber_yard", "basic", { wood: 4 }, { wood: 6 }],
    ["special_shrine_of_renewal", "c01_lumber_yard", "upgraded", { wood: 5, food: 2 }, { wood: 8, food: 4 }],
    ["special_shrine_of_depths", "c02_mine_tunnel", "basic", { stone: 4 }, { stone: 6 }],
    ["special_shrine_of_depths", "c02_mine_tunnel", "upgraded", { stone: 5, metal: 2 }, { stone: 8, metal: 4 }],
    ["special_shrine_of_ancients", "c03_gathering_outpost", "basic", { herbs: 4 }, { herbs: 6 }],
    ["special_shrine_of_ancients", "c03_gathering_outpost", "upgraded", { herbs: 5, food: 2 }, { herbs: 8, food: 4 }],
    ["special_shrine_of_bounty", "c04_farmstead", "basic", { food: 4 }, { food: 6 }],
    ["special_shrine_of_bounty", "c04_farmstead", "upgraded", { food: 5, goods: 2 }, { food: 8, goods: 4 }],
    ["special_shrine_of_ancestors", "c20_dig_site", "basic", { metal: 4 }, { metal: 6 }],
    ["special_shrine_of_ancestors", "c20_dig_site", "upgraded", { metal: 5, goods: 2 }, { metal: 8, goods: 4 }]
  ] as const)(
    "%s triggers passively from its matching %s production tile",
    (shrineId, productionTileId, side, firstExpected, secondExpected) => {
      const state = readyState([
        placed("producer", productionTileId, "G1", side),
        placed("shrine", shrineId, "H1", "special")
      ]);

      expect(getActivatableTileIds(state, "player_1")).not.toContain("shrine");
      const first = activateTile(state, "player_1", "producer");
      expect(first.warehouse).toEqual(expectedResources(firstExpected));
      expect(first.pendingEffects).toHaveLength(0);
      expect(first.tileActivationRecords.shrine.round).toBe(1);

      const second = activateTile(first, "player_1", "producer");
      expect(second.warehouse).toEqual(expectedResources(secondExpected));
    }
  );

  it.each([
    ["c09_tavern", "basic", 1],
    ["c09_tavern", "upgraded", 1],
    ["c10_eatery", "basic", 1],
    ["c10_eatery", "upgraded", 1],
    ["c11_washhouse", "basic", 1],
    ["c11_washhouse", "upgraded", 1],
    ["c12_apothecary", "basic", 1],
    ["c12_apothecary", "upgraded", 2],
    ["c21_the_vaults", "basic", 1],
    ["c21_the_vaults", "upgraded", 2]
  ] as const)(
    "%s %s applies its deterministic Strain removal immediately",
    (tileId, side, removed) => {
      const state = readyState([
        placed("source", tileId, "G1", side),
        placed("target", "c15_path", "H1", "basic", 2)
      ]);
      const next = activateTile(state, "player_1", "source");

      expect(next.map.placedTiles[1].strain).toBe(2 - removed);
      expect(next.pendingEffects).toHaveLength(0);
    }
  );

  it.each([
    ["c09_tavern", "basic", 1],
    ["c09_tavern", "upgraded", 1],
    ["c10_eatery", "basic", 1],
    ["c10_eatery", "upgraded", 1],
    ["c11_washhouse", "basic", 1],
    ["c11_washhouse", "upgraded", 1],
    ["c12_apothecary", "basic", 1],
    ["c12_apothecary", "upgraded", 2],
    ["c21_the_vaults", "basic", 1],
    ["c21_the_vaults", "upgraded", 2]
  ] as const)(
    "%s %s opens a choice and removes Strain from the selected tile",
    (tileId, side, removed) => {
      const [firstHex, secondHex] = getHexNeighbors("G2");
      const state = readyState([
        placed("source", tileId, "G2", side),
        placed("first", "c15_path", firstHex, "basic", 2),
        placed("second", "c15_path", secondHex, "basic", 2)
      ]);

      const prompted = activateTile(state, "player_1", "source");
      expect(prompted.pendingEffects[0]).toMatchObject({
        requiresManualChoice: true
      });

      const resolved = resolvePendingEffect(prompted, {
        tileStrainDeltas: { first: -removed }
      });
      expect(resolved.pendingEffects).toHaveLength(0);
      expect(resolved.map.placedTiles.map((tile) => tile.strain)).toEqual([
        0,
        2 - removed,
        2
      ]);
    }
  );

  it.each([
    ["basic", 1],
    ["upgraded", 2]
  ] as const)("Inn %s adds its Arrival timer automatically", (side, added) => {
    const state = readyState([placed("inn", "c08_inn", "G1", side)]);
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 1 }
    ];
    const next = activateTile(state, "player_1", "inn");

    expect(next.encounters.activeArrivals[0].timerTokens).toBe(1 + added);
    expect(next.pendingEffects).toHaveLength(0);
  });

  const supportEffectTileIds = [
    "special_alms_house",
    "special_atelier_workshop",
    "special_house_of_learning",
    "special_the_iron_roots_respite",
    "special_the_lorekeepers_respite",
    "special_the_reavers_respite",
    "special_the_root_weavers_respite",
    "special_the_tamers_respite",
    "special_theater"
  ];

  it.each(supportEffectTileIds)(
    "%s automatically supports its sole eligible target",
    (tileId) => {
      const state = readyState([
        placed("source", tileId, "G1", "special"),
        placed("target", "c05_cabin", "H1")
      ]);
      const next = activateTile(state, "player_1", "source");

      expect(next.map.placedTiles[1].support.singleUse).toBe(true);
      expect(next.pendingEffects).toHaveLength(0);
    }
  );

  it.each(supportEffectTileIds)(
    "%s opens a choice and protects only the selected eligible tiles",
    (tileId) => {
      const [firstHex, secondHex] = getHexNeighbors("G2");
      const state = readyState([
        placed("source", tileId, "G2", "special"),
        placed("first", "c05_cabin", firstHex),
        placed("second", "c15_path", secondHex)
      ]);

      const prompted = activateTile(state, "player_1", "source");
      expect(prompted.pendingEffects[0]).toMatchObject({
        requiresManualChoice: true
      });

      const resolved = resolvePendingEffect(prompted, {
        supportTileIds: ["second"]
      });
      expect(resolved.pendingEffects).toHaveLength(0);
      expect(resolved.map.placedTiles[1].support.singleUse).toBe(false);
      expect(resolved.map.placedTiles[2].support.singleUse).toBe(true);

      const protectedState = applyStrainToState(resolved, "second", 1);
      expect(protectedState.map.placedTiles[2].strain).toBe(0);
      expect(protectedState.map.placedTiles[2].support).toMatchObject({
        singleUse: false,
        preventedThisRound: true
      });
    }
  );

  it("Hearth Garden automatically removes Strain from its sole eligible target", () => {
    const state = readyState([
      placed("garden", "special_hearth_garden", "G1", "special"),
      placed("housing", "c05_cabin", "H1", "basic", 2)
    ]);
    const next = activateTile(state, "player_1", "garden");

    expect(next.map.placedTiles[1].strain).toBe(0);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("validates both Alchemist's Workshop exchange modes", () => {
    const state = readyState([
      placed("alchemist", "special_alchemist_s_workshop", "G1", "special")
    ]);
    state.warehouse.wood = 5;

    const equalPrompt = activateTile(state, "player_1", "alchemist");
    expect(equalPrompt.pendingEffects[0].resourceExchangeLimit).toBe(5);
    const equal = resolvePendingEffect(equalPrompt, {
      resourceDeltas: { wood: -2, stone: 2 }
    });
    expect(equal.warehouse.wood).toBe(3);
    expect(equal.warehouse.stone).toBe(2);

    const goodsPrompt = activateTile(state, "player_1", "alchemist");
    const goods = resolvePendingEffect(goodsPrompt, {
      resourceDeltas: { wood: -5, goods: 3 }
    });
    expect(goods.warehouse.wood).toBe(0);
    expect(goods.warehouse.goods).toBe(3);

    const invalid = resolvePendingEffect(goodsPrompt, {
      resourceDeltas: { wood: -4, goods: 3 }
    });
    expect(invalid.pendingEffects).toHaveLength(1);
  });

  it.each([
    ["c05_cabin", "basic", 2, 0],
    ["c05_cabin", "upgraded", 3, 2],
    ["c06_cottage", "basic", 3, 0],
    ["c06_cottage", "upgraded", 5, 3],
    ["c07_stedding", "basic", 5, 0],
    ["c07_stedding", "upgraded", 7, 5]
  ] as const)(
    "%s %s scores its Housing passives",
    (tileId, side, population, renown) => {
      const state = readyState([
        placed("housing", tileId, "G1", side),
        placed("cluster", "c08_inn", "H1"),
        placed("travel", "c15_path", "F1")
      ]);
      const score = calculateFinalScore(state);
      expect(score.passivePopulation).toBe(population);
      expect(score.passiveRenown).toBe(renown);
    }
  );

  it.each(["c15_path", "c16_street", "c17_track"])(
    "%s scores both printed Travel passives",
    (tileId) => {
      const basic = readyState([
        placed("travel", tileId, "G1"),
        placed("a", "c05_cabin", "F1"),
        placed("b", "c09_tavern", "G2"),
        placed("c", "c10_eatery", "H1")
      ]);
      expect(calculateFinalScore(basic).passiveRenown).toBe(1);

      const upgraded = readyState([
        placed("travel", tileId, "G1", "upgraded"),
        placed("other", "c15_path", "H1", "upgraded")
      ]);
      expect(calculateFinalScore(upgraded).passiveRenown).toBe(2);
    }
  );

  it("exposes every cost passive with the correct mandatory or optional timing", () => {
    const state = readyState([
      placed("brewery", "special_brewery_of_legends", "G1", "special"),
      placed("labourers", "special_labourers_yard", "G2", "special"),
      placed("workshops", "c13_workshops", "H2"),
      placed("market", "c14_market_stalls", "H3")
    ]);
    state.warehouse.goods = 1;

    const housingOptions = getPassiveCostOptions(state, {
      action: "place",
      playerId: "player_1",
      category: "housing",
      kind: "core",
      placementHexIds: ["H1"],
      cost: expectedResources({ wood: 2, food: 5 })
    });
    expect(housingOptions.find((option) => option.sourceTileId === "brewery")?.required).toBe(true);
    expect(housingOptions.find((option) => option.sourceTileId === "labourers")?.required).toBe(true);
    expect(housingOptions.find((option) => option.sourceTileId === "market")?.required).not.toBe(true);

    const upgradeOptions = getPassiveCostOptions(state, {
      action: "upgrade",
      playerId: "player_1",
      targetTile: placed("target", "c05_cabin", "H1"),
      cost: expectedResources({ stone: 2 })
    });
    expect(upgradeOptions.find((option) => option.sourceTileId === "workshops")?.required).toBe(true);
  });

  it("accounts for every Special Tile in a tested effect family", () => {
    const costPassives = [
      "special_brewery_of_legends",
      "special_labourers_yard"
    ];
    const networkPassives = [
      "special_docks",
      "special_lantern_roadhouse",
      "special_stables",
      "special_the_resting_hall"
    ];
    const shrinePassives = [
      "special_shrine_of_ancestors",
      "special_shrine_of_ancients",
      "special_shrine_of_bounty",
      "special_shrine_of_depths",
      "special_shrine_of_renewal"
    ];
    const activated = [
      "special_adventurers_guild",
      "special_alchemist_s_workshop",
      "special_hearth_garden",
      "special_reliquary",
      "special_the_waystation"
    ];
    const audited = new Set([
      ...costPassives,
      ...networkPassives,
      ...shrinePassives,
      ...activated,
      ...supportEffectTileIds
    ]);

    expect([...audited].sort()).toEqual(specialTiles.map((tile) => tile.id).sort());
    expect(coreTiles.every((tile) => coreTileById[tile.id] === tile)).toBe(true);
  });
});

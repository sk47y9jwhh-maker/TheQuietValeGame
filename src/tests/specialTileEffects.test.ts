import { describe, expect, it } from "vitest";
import { systemEffectRuleId } from "../data/effectRules";
import {
  activateTile,
  canCompleteArrival,
  canStartPlaceTile,
  completeArrival,
  confirmCostChoice,
  placeTile
} from "../engine/gameActions";
import {
  queuePendingEffect,
  resolvePendingEffect
} from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile } from "../engine/types";

function placed(
  instanceId: string,
  tileId: string,
  hexId: string,
  strain = 0,
  side: PlacedTile["side"] = tileId.startsWith("special_") ? "special" : "basic"
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
  state.warehouse = { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 };
  return state;
}

describe("approved Special Tile effects", () => {
  it("Iron Roots gains Metal and removes Strain from its producer once per round", () => {
    const state = readyState([
      placed("mine", "c02_mine_tunnel", "G1", 2),
      placed("roots", "special_the_iron_roots_respite", "H1")
    ]);

    const first = activateTile(state, "player_1", "mine");
    expect(first.warehouse).toMatchObject({ stone: 2, metal: 1 });
    expect(first.map.placedTiles[0].strain).toBe(1);
    expect(first.tileActivationRecords.roots.round).toBe(1);

    const second = activateTile(first, "player_1", "mine");
    expect(second.warehouse).toMatchObject({ stone: 4, metal: 1 });
    expect(second.map.placedTiles[0].strain).toBe(1);
  });

  it("Lorekeepers gains 1 Goods after adjacent salvage production", () => {
    const state = readyState([
      placed("salvage", "c20_dig_site", "G1"),
      placed("lorekeepers", "special_the_lorekeepers_respite", "H1")
    ]);

    const next = activateTile(state, "player_1", "salvage");
    expect(next.warehouse.goods).toBe(1);
    expect(next.tileActivationRecords.lorekeepers.round).toBe(1);
  });

  it("House of Learning can make an otherwise unaffordable Arrival payable", () => {
    const state = readyState([
      placed("learning", "special_house_of_learning", "G1")
    ]);
    state.warehouse.goods = 4;
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 2 }
    ];

    expect(canCompleteArrival(state, "arrival_the_quiet_quest").ok).toBe(true);
    const prompted = completeArrival(state, "arrival_the_quiet_quest");
    const option = prompted.pendingCostChoice?.options.find(
      (candidate) => candidate.sourceTileId === "learning"
    );
    const next = confirmCostChoice(prompted, {
      selectedOptionIds: [option?.id ?? ""]
    });

    expect(next.encounters.activeArrivals).toHaveLength(0);
    expect(next.warehouse.goods).toBe(0);
    expect(next.tileActivationRecords.learning.round).toBe(1);
  });

  it("Tamers reduces Food payments by up to 2 once per round", () => {
    const state = readyState([
      placed("tamers", "special_the_tamers_respite", "G1")
    ]);
    state.warehouse.wood = 2;
    state.warehouse.food = 3;

    expect(canStartPlaceTile(state, "player_1", "c05_cabin", "H1").ok).toBe(true);
    const prompted = placeTile(state, "player_1", "c05_cabin", "H1");
    const option = prompted.pendingCostChoice?.options.find(
      (candidate) => candidate.sourceTileId === "tamers"
    );
    const next = confirmCostChoice(prompted, {
      selectedOptionIds: [option?.id ?? ""],
      discountResourceByOptionId: { [option?.id ?? ""]: "food" }
    });

    expect(next.map.placedTiles.some((tile) => tile.tileId === "c05_cabin")).toBe(true);
    expect(next.warehouse).toMatchObject({ wood: 0, food: 0 });
    expect(next.tileActivationRecords.tamers.round).toBe(1);
  });

  it("Waystation completes an Arrival at zero Actions while preserving its resource cost", () => {
    const state = readyState([
      placed("waystation", "special_the_waystation", "G1")
    ]);
    state.actionsRemaining = 0;
    state.warehouse.goods = 4;
    state.warehouse.herbs = 2;
    state.encounters.activeArrivals = [
      { cardId: "arrival_the_quiet_quest", timerTokens: 2 }
    ];

    expect(canCompleteArrival(state, "arrival_the_quiet_quest").ok).toBe(true);
    const prompted = completeArrival(state, "arrival_the_quiet_quest");
    const option = prompted.pendingCostChoice?.options.find(
      (candidate) => candidate.sourceTileId === "waystation"
    );
    expect(option?.waivesAction).toBe(true);
    const next = confirmCostChoice(prompted, {
      selectedOptionIds: [option?.id ?? ""]
    });

    expect(next.actionsRemaining).toBe(0);
    expect(next.warehouse).toMatchObject({ goods: 0, herbs: 0 });
    expect(next.encounters.activeArrivals).toHaveLength(0);
    expect(next.tileActivationRecords.waystation.round).toBe(1);
  });

  it("Reavers gains 2 Wood after the first tile placement each round", () => {
    const state = readyState([
      placed("path", "c15_path", "G1"),
      placed("reavers", "special_the_reavers_respite", "H1")
    ]);

    const first = placeTile(state, "player_1", "c15_path", "F1");
    expect(first.warehouse.wood).toBe(2);
    expect(first.tileActivationRecords.reavers.round).toBe(1);

    const second = placeTile(first, "player_1", "c15_path", "G2");
    expect(second.warehouse.wood).toBe(2);
  });

  it("Theatre deepens one Social Tile Strain removal and grants Supported", () => {
    const state = readyState([
      placed("tavern", "c09_tavern", "G1"),
      placed("target", "c15_path", "H1", 2),
      placed("theatre", "special_theater", "F1")
    ]);

    const first = activateTile(state, "player_1", "tavern");
    expect(first.map.placedTiles[1].strain).toBe(0);
    expect(first.map.placedTiles[1].support.singleUse).toBe(true);
    expect(first.tileActivationRecords.theatre.round).toBe(1);

    const strainedAgain = {
      ...first,
      actionsRemaining: 3,
      map: {
        placedTiles: first.map.placedTiles.map((tile) =>
          tile.instanceId === "target" ? { ...tile, strain: 2 } : tile
        )
      }
    };
    const second = activateTile(strainedAgain, "player_1", "tavern");
    expect(second.map.placedTiles[1].strain).toBe(1);
  });

  it("Root Weavers can spend 2 Herbs to prevent 1 targeted Strain once per round", () => {
    const state = readyState([
      placed("path", "c15_path", "G1"),
      placed("root_weavers", "special_the_root_weavers_respite", "H1")
    ]);
    state.warehouse.herbs = 2;

    const queued = queuePendingEffect(state, {
      sourceType: "system",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain on a tile.",
      requiresManualChoice: true
    });
    const pending = queued.pendingEffects[0];
    const targetTileId = Object.keys(
      pending.targetCardPlannedStrainByTileId ?? {}
    )[0];
    expect(pending.allowRootWeaversPreventionTileId).toBe("root_weavers");

    const resolved = resolvePendingEffect(queued, {
      rootWeaversPreventionTargetTileId: targetTileId
    });
    expect(
      resolved.map.placedTiles.find((tile) => tile.instanceId === targetTileId)?.strain
    ).toBe(0);
    expect(resolved.warehouse.herbs).toBe(0);
    expect(resolved.tileActivationRecords.root_weavers.round).toBe(1);

    const queuedAgain = queuePendingEffect(resolved, {
      sourceType: "system",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain on a tile.",
      requiresManualChoice: true
    });
    expect(queuedAgain.pendingEffects[0].allowRootWeaversPreventionTileId).toBeUndefined();
  });

  it("Reliquary offers either 2 Metal or up to 2 Strain removal", () => {
    const state = readyState([
      placed("reliquary", "special_reliquary", "G1"),
      placed("workshop", "c13_workshops", "H1", 2)
    ]);

    const resourcePrompt = activateTile(state, "player_1", "reliquary");
    const resourceResult = resolvePendingEffect(resourcePrompt, {
      resourceDeltas: { metal: 2 },
      tileStrainDeltas: {}
    });
    expect(resourceResult.warehouse.metal).toBe(2);
    expect(resourceResult.map.placedTiles[1].strain).toBe(2);

    const strainPrompt = activateTile(state, "player_1", "reliquary");
    const strainResult = resolvePendingEffect(strainPrompt, {
      tileStrainDeltas: { workshop: -2 }
    });
    expect(strainResult.warehouse.metal).toBe(0);
    expect(strainResult.map.placedTiles[1].strain).toBe(0);
  });
});

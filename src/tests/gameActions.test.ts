import { describe, expect, it } from "vitest";
import {
  activateTile,
  canCancelPendingBurdenWithWarden,
  canStartPlaceTile,
  canUseStewardPower,
  cancelCostChoice,
  cancelPendingBurdenWithWarden,
  completeArrival,
  confirmCostChoice,
  endCurrentTurn,
  getActivatableTileIds,
  getLinkedProductionTileId,
  getStableMoveDestinationTileIds,
  moveStewardViaStables,
  placeTile,
  revealEncounters,
  resolveEndRound,
  resolveBurden,
  upgradeTile,
  useFaceUpBoon,
  useStewardPower
} from "../engine/gameActions";
import { resolvePendingEffect } from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import type { GameState, ResourceType } from "../engine/types";

function confirmRequiredDiscounts(
  state: GameState,
  resource: ResourceType
): GameState {
  const requiredDiscountIds =
    state.pendingCostChoice?.options
      .filter((option) => option.required && option.kind === "discount")
      .map((option) => option.id) ?? [];

  expect(requiredDiscountIds.length).toBeGreaterThan(0);
  return confirmCostChoice(state, {
    selectedOptionIds: requiredDiscountIds,
    discountResourceByOptionId: Object.fromEntries(
      requiredDiscountIds.map((optionId) => [optionId, resource])
    )
  });
}

describe("game actions", () => {
  it("places a tile, spends an action, and reduces supply", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = { ...state, phase: "turns" as const };
    const next = placeTile(ready, "player_1", "c01_lumber_yard", "G1");

    expect(next.map.placedTiles).toHaveLength(1);
    expect(next.actionsRemaining).toBe(3);
    expect(next.tileSupply.core.c01_lumber_yard).toBe(1);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("moves the acting Steward to a newly placed tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_path",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = placeTile(ready, "player_1", "c05_cabin", "H1");

    expect(next.players[0].stewardHexId).toBe("H1");
  });

  it("moves the acting Steward to an upgraded tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_path",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_cabin",
            tileId: "c05_cabin",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = upgradeTile(ready, "player_1", "tile_cabin");

    expect(next.players[0].stewardHexId).toBe("H1");
  });

  it("moves the acting Steward to an activated tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_path",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_lumber",
            tileId: "c01_lumber_yard",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = activateTile(ready, "player_1", "tile_lumber");

    expect(next.players[0].stewardHexId).toBe("H1");
  });

  it("does not re-fire an active Burden when a later tile creates a target", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_forest_s_grudge"]
      }
    };

    const next = placeTile(ready, "player_1", "c01_lumber_yard", "G1");

    expect(next.pendingEffects).toHaveLength(0);
  });

  it("applies production immediately and caps the Warehouse", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = { ...state, phase: "turns" as const };
    const placed = resolvePendingEffect(
      placeTile(ready, "player_1", "c01_lumber_yard", "G1")
    );
    placed.warehouse.wood = 14;
    const activated = activateTile(placed, "player_1", placed.map.placedTiles[0].instanceId);

    expect(activated.pendingEffects).toHaveLength(0);
    expect(activated.warehouse.wood).toBe(15);
    expect(activated.actionsRemaining).toBe(2);
  });

  it("activates two adjacent matching Resource producers for one action", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: { ...state.warehouse, food: 0 },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "farm_1",
            tileId: "c04_farmstead",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "farm_2",
            tileId: "c04_farmstead",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(getLinkedProductionTileId(ready, "farm_1")).toBe("farm_2");

    const activated = activateTile(ready, "player_1", "farm_1");

    expect(activated.warehouse.food).toBe(4);
    expect(activated.actionsRemaining).toBe(3);
    expect(activated.players[0].stewardHexId).toBe("G1");
    expect(activated.log.some((entry) =>
      entry.message === "Linked production activated Farmstead."
    )).toBe(true);
  });

  it("uses each linked producer's current side and skips an Overstrained partner", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: { ...state.warehouse, food: 0, goods: 0 },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "farm_1",
            tileId: "c04_farmstead",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "farm_2",
            tileId: "c04_farmstead",
            kind: "core" as const,
            side: "upgraded" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const activated = activateTile(ready, "player_1", "farm_1");

    expect(activated.warehouse.food).toBe(5);
    expect(activated.warehouse.goods).toBe(2);

    const overstrained = {
      ...ready,
      map: {
        placedTiles: ready.map.placedTiles.map((tile) =>
          tile.instanceId === "farm_2" ? { ...tile, strain: 3 } : tile
        )
      }
    };
    const activatedWithoutLink = activateTile(overstrained, "player_1", "farm_1");

    expect(getLinkedProductionTileId(overstrained, "farm_1")).toBeUndefined();
    expect(activatedWithoutLink.warehouse.food).toBe(2);
    expect(activatedWithoutLink.warehouse.goods).toBe(0);
  });

  it("allows a linked producer to trigger an adjacent Shrine only once per round", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: { ...state.warehouse, food: 0 },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "farm_1",
            tileId: "c04_farmstead",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "farm_2",
            tileId: "c04_farmstead",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "shrine",
            tileId: "special_shrine_of_bounty",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["I1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const firstActivation = activateTile(ready, "player_1", "farm_1");
    const secondActivation = activateTile(firstActivation, "player_1", "farm_1");

    expect(firstActivation.warehouse.food).toBe(6);
    expect(firstActivation.tileActivationRecords.shrine.round).toBe(1);
    expect(secondActivation.warehouse.food).toBe(10);
  });

  it("applies adjacent Shrine production passives automatically once per round", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: { ...state.warehouse, food: 0 },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c04_farmstead",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_2",
            tileId: "special_shrine_of_bounty",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const activated = activateTile(ready, "player_1", "tile_1");

    expect(activated.pendingEffects).toHaveLength(0);
    expect(activated.warehouse.food).toBe(4);
    expect(getActivatableTileIds(ready, "player_1")).not.toContain("tile_2");

    const activatedAgain = activateTile(activated, "player_1", "tile_1");
    expect(activatedAgain.warehouse.food).toBe(6);
  });

  it("does not offer an activated effect when it has no legal target", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_alms",
            tileId: "special_alms_house",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(getActivatableTileIds(ready, "player_1")).not.toContain("tile_alms");
    expect(activateTile(ready, "player_1", "tile_alms")).toEqual(ready);
  });

  it("enforces once-per-season activated Special Tile limits", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "special_adventurers_guild",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      },
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      }
    };

    expect(getActivatableTileIds(ready, "player_1")).toContain("tile_1");

    const activated = activateTile(ready, "player_1", "tile_1");
    const acknowledged = resolvePendingEffect(activated);

    expect(activated.tileActivationRecords.tile_1.season).toBe(1);
    expect(getActivatableTileIds(acknowledged, "player_1")).not.toContain("tile_1");
    expect(
      getActivatableTileIds({ ...acknowledged, season: 2 as const }, "player_1")
    ).toContain("tile_1");
  });

  it("activates Adventurers' Guild to resolve an active Burden", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_guild",
            tileId: "special_adventurers_guild",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const activated = activateTile(ready, "player_1", "tile_guild");

    expect(activated.pendingEffects[0].allowBurdenResolve).toBe(true);
    expect(activated.pendingEffects[0].requiresManualChoice).toBe(true);
    expect(activated.pendingEffects[0].canSkip).toBe(true);

    const resolved = resolvePendingEffect(activated, {
      resolvedBurdenIds: ["burden_smoke_over_hearths"]
    });

    expect(resolved.encounters.activeBurdens).toHaveLength(0);
    expect(resolved.encounters.discardPile).toContain("burden_smoke_over_hearths");
    expect(resolved.actionsRemaining).toBe(3);
  });

  it("prompts for a Burden choice when a resolve effect has multiple targets", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths", "burden_forest_s_grudge"]
      },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_guild",
            tileId: "special_adventurers_guild",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const activated = activateTile(ready, "player_1", "tile_guild");
    const unresolved = resolvePendingEffect(activated);
    const resolved = resolvePendingEffect(activated, {
      resolvedBurdenIds: ["burden_forest_s_grudge"]
    });

    expect(activated.pendingEffects[0].requiresManualChoice).toBe(true);
    expect(unresolved.encounters.activeBurdens).toHaveLength(2);
    expect(resolved.encounters.activeBurdens).toEqual(["burden_smoke_over_hearths"]);
    expect(resolved.encounters.discardPile).toContain("burden_forest_s_grudge");
  });

  it("queues The Resting Hall after a tile effect resolves a Burden", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_guild",
            tileId: "special_adventurers_guild",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_resting_hall",
            tileId: "special_the_resting_hall",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_strained",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G2"],
            strain: 1,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const activated = activateTile(ready, "player_1", "tile_guild");
    const resolved = resolvePendingEffect(activated, {
      resolvedBurdenIds: ["burden_smoke_over_hearths"]
    });

    expect(resolved.pendingEffects).toHaveLength(0);
    expect(resolved.map.placedTiles.find((tile) => tile.instanceId === "tile_strained")?.strain).toBe(0);
  });

  it("moves to End of Round after every player has acted", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = { ...state, phase: "turns" as const };

    expect(endCurrentTurn(ready).phase).toBe("endRound");
  });

  it("reveals player-count standard Encounters", () => {
    const state = createNewGame(2, ["vanguard", "knight"]);
    const ready = { ...state, phase: "reveal" as const };
    const next = revealEncounters(ready);
    const boardCards =
      next.encounters.activeArrivals.length +
      next.encounters.activeBurdens.length +
      next.encounters.faceUpBoons.length +
      next.encounters.discardPile.length;

    expect(boardCards).toBeGreaterThanOrEqual(2);
    expect(next.phase).toBe("turns");
    expect(next.pendingEffects.length + (next.pendingDeckReorder ? 1 : 0)).toBe(2);
  });

  it("reveals Arrivals as acknowledgement prompts", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      encounters: {
        ...state.encounters,
        deck: ["arrival_the_quiet_quest"]
      }
    };

    const revealed = revealEncounters(ready);

    expect(revealed.encounters.activeArrivals).toEqual([
      { cardId: "arrival_the_quiet_quest", timerTokens: 3 }
    ]);
    expect(revealed.pendingEffects[0].confirmLabel).toBe("Acknowledge");
    expect(revealed.pendingEffects[0].effectText).toContain("3 timer tokens");
    expect(revealed.pendingEffects[0].detailText).toContain("Requirement:");
  });

  it("tracks remaining uses for keep-face-up Boons", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      season: 2 as const,
      encounters: {
        ...state.encounters,
        deck: ["boon_many_hands_make_light_work"]
      }
    };

    const revealed = revealEncounters(ready);

    expect(revealed.encounters.faceUpBoons).toEqual([
      { cardId: "boon_many_hands_make_light_work", remainingUses: 2 }
    ]);
    expect(revealed.pendingEffects[0].confirmLabel).toBe("Acknowledge");

    const acknowledged = resolvePendingEffect(revealed);
    const usedOnce = useFaceUpBoon(acknowledged, "boon_many_hands_make_light_work");

    expect(usedOnce.encounters.faceUpBoons).toEqual([
      { cardId: "boon_many_hands_make_light_work", remainingUses: 1 }
    ]);
    expect(usedOnce.encounters.discardPile).not.toContain("boon_many_hands_make_light_work");

    const usedTwice = useFaceUpBoon(
      resolvePendingEffect(usedOnce),
      "boon_many_hands_make_light_work"
    );

    expect(usedTwice.encounters.faceUpBoons).toHaveLength(0);
    expect(usedTwice.encounters.discardPile).toContain("boon_many_hands_make_light_work");
    expect(usedTwice.pendingEffects[0].title).toContain("Use Boon");
  });

  it("acknowledges a revealed Boon when no legal tile target exists", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      encounters: {
        ...state.encounters,
        deck: ["boon_hearths_soften_feuds"]
      }
    };

    const revealed = revealEncounters(ready);

    expect(revealed.pendingEffects[0].requiresManualChoice).toBe(false);
    expect(revealed.pendingEffects[0].confirmLabel).toBe("Acknowledge");
    expect(revealed.pendingEffects[0].detailText).toContain("No valid target");
    expect(revealed.pendingEffects[0].canSkip).toBe(true);
  });

  it("counts A Little Time as one Boon use even in later seasons", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      season: 3 as const,
      encounters: {
        ...state.encounters,
        deck: ["boon_a_little_more_time"],
        activeArrivals: [{ cardId: "arrival_the_quiet_quest", timerTokens: 1 }]
      }
    };

    const revealed = revealEncounters(ready);

    expect(revealed.encounters.faceUpBoons).toEqual([
      { cardId: "boon_a_little_more_time", remainingUses: 1 }
    ]);
  });

  it("uses A Little Time to add legal timer tokens to active Arrivals", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      season: 2 as const,
      encounters: {
        ...state.encounters,
        activeArrivals: [
          { cardId: "arrival_the_quiet_quest", timerTokens: 1 },
          { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 2 }
        ],
        faceUpBoons: [{ cardId: "boon_a_little_more_time", remainingUses: 1 }]
      }
    };

    const prompted = useFaceUpBoon(ready, "boon_a_little_more_time");

    expect(prompted.pendingEffects[0].requiresManualChoice).toBe(true);
    const next = resolvePendingEffect(prompted, {
      arrivalTimerDeltas: {
        arrival_the_quiet_quest: 1,
        arrival_remnants_of_the_cavalry: 1
      }
    });

    expect(next.encounters.activeArrivals).toEqual([
      { cardId: "arrival_the_quiet_quest", timerTokens: 2 },
      { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 3 }
    ]);
    expect(next.encounters.faceUpBoons).toHaveLength(0);
    expect(next.encounters.discardPile).toContain("boon_a_little_more_time");
  });

  it("reveals Clear Nights as a deck reorder effect", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      encounters: {
        ...state.encounters,
        deck: [
          "boon_clear_nights_make_for_clear_plans",
          "arrival_the_quiet_quest",
          "burden_smoke_over_hearths",
          "boon_a_little_more_time"
        ]
      }
    };

    const next = revealEncounters(ready);

    expect(next.pendingDeckReorder?.cardIds).toEqual([
      "arrival_the_quiet_quest",
      "burden_smoke_over_hearths"
    ]);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("uses the current season count for Clear Nights deck rearrange", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      season: 3 as const,
      encounters: {
        ...state.encounters,
        deck: [
          "boon_clear_nights_make_for_clear_plans",
          "arrival_the_quiet_quest",
          "burden_smoke_over_hearths",
          "boon_a_little_more_time",
          "arrival_remnants_of_the_cavalry",
          "burden_forest_s_grudge"
        ]
      }
    };

    const next = revealEncounters(ready);

    expect(next.pendingDeckReorder?.effectText).toContain("top 4 cards");
    expect(next.pendingDeckReorder?.cardIds).toEqual([
      "arrival_the_quiet_quest",
      "burden_smoke_over_hearths",
      "boon_a_little_more_time",
      "arrival_remnants_of_the_cavalry"
    ]);
  });

  it("queues a revealed Burden's current season effect immediately", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      encounters: {
        ...state.encounters,
        deck: ["burden_bare_walls"]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_cabin",
            tileId: "c05_cabin",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const revealed = revealEncounters(ready);

    expect(revealed.encounters.activeBurdens).toEqual(["burden_bare_walls"]);
    expect(revealed.pendingEffects[0].sourceId).toBe("burden_bare_walls");
    expect(revealed.pendingEffects[0].suggestedAdjustment?.tileStrainDeltas).toEqual({
      tile_cabin: 1
    });
  });

  it("reveals Welcome Wears Thin as acknowledgement-only in Season 2 with no Arrivals", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      season: 2 as const,
      phase: "reveal" as const,
      encounters: {
        ...state.encounters,
        deck: ["burden_welcome_wears_thin"],
        activeArrivals: []
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_path_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_path_2",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const revealed = revealEncounters(ready);

    expect(revealed.pendingEffects[0]).toMatchObject({
      sourceId: "burden_welcome_wears_thin",
      requiresManualChoice: false,
      confirmLabel: "Acknowledge"
    });
    expect(revealed.pendingEffects[0].effectText).toMatch(/there are none, no effect/i);
    expect(revealed.pendingEffects[0].suggestedAdjustment).toBeUndefined();

    const acknowledged = resolvePendingEffect(revealed);
    expect(acknowledged.pendingEffects).toHaveLength(0);
    expect(acknowledged.map.placedTiles.map((tile) => tile.strain)).toEqual([0, 0]);
  });

  it("applies a prepared Boon resource discount to tile placement", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [{ ...state.players[0], hasPlacedFirstTile: true }],
      warehouse: {
        ...state.warehouse,
        wood: 1,
        food: 5,
        stone: 0,
        metal: 0,
        herbs: 0,
        goods: 0
      },
      encounters: {
        ...state.encounters,
        faceUpBoons: [
          { cardId: "boon_many_hands_make_light_work", remainingUses: 1 }
        ]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prepared = resolvePendingEffect(
      useFaceUpBoon(ready, "boon_many_hands_make_light_work")
    );
    const prompted = placeTile(prepared, "player_1", "c05_cabin", "H1");
    const boonDiscount = prompted.pendingCostChoice?.options.find(
      (option) => option.sourceKind === "boon"
    );
    expect(boonDiscount).toMatchObject({
      sourceName: "Many Hands, Light Work",
      kind: "discount",
      amount: 1,
      required: true
    });
    expect(boonDiscount?.resourceChoices).toContain("wood");
    const next = confirmCostChoice(prompted, {
      selectedOptionIds: [boonDiscount?.id ?? ""],
      discountResourceByOptionId: { [boonDiscount?.id ?? ""]: "wood" }
    });

    expect(next.map.placedTiles).toHaveLength(2);
    expect(next.warehouse.wood).toBe(0);
    expect(next.warehouse.food).toBe(0);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("applies Brewery of Legends automatically to adjacent Housing", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: {
        ...state.warehouse,
        wood: 0,
        food: 0
      },
      players: [{ ...state.players[0], hasPlacedFirstTile: true }],
      map: {
        placedTiles: [
          {
            instanceId: "tile_brewery",
            tileId: "special_brewery_of_legends",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(canStartPlaceTile(ready, "player_1", "c05_cabin", "H1").ok).toBe(true);

    const placed = placeTile(ready, "player_1", "c05_cabin", "H1");

    expect(placed.map.placedTiles).toHaveLength(2);
    expect(placed.warehouse.wood).toBe(0);
    expect(placed.warehouse.food).toBe(0);
    expect(placed.tileActivationRecords.tile_brewery.season).toBe(1);
  });

  it("does not advertise a placement when an available discount is still insufficient", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: {
        ...state.warehouse,
        wood: 0,
        food: 1
      },
      players: [{ ...state.players[0], hasPlacedFirstTile: true }],
      map: {
        placedTiles: [
          {
            instanceId: "golden_charter",
            tileId: "golden_tile_the_golden_charter",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(canStartPlaceTile(ready, "player_1", "c05_cabin", "H1").ok).toBe(false);

    ready.warehouse.wood = 1;
    ready.warehouse.food = 5;
    expect(canStartPlaceTile(ready, "player_1", "c05_cabin", "H1").ok).toBe(true);
  });

  it("applies Labourers' Yard automatically to adjacent placement", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: {
        ...state.warehouse,
        wood: 0,
        food: 5
      },
      players: [{ ...state.players[0], hasPlacedFirstTile: true }],
      map: {
        placedTiles: [
          {
            instanceId: "tile_labourers",
            tileId: "special_labourers_yard",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const placed = placeTile(ready, "player_1", "c05_cabin", "H1");

    expect(placed.map.placedTiles).toHaveLength(2);
    expect(placed.warehouse.wood).toBe(0);
    expect(placed.warehouse.food).toBe(0);
    expect(placed.tileActivationRecords.tile_labourers.round).toBe(1);
  });

  it("applies a prepared 0 Action Resource placement Boon", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      actionsRemaining: 0,
      encounters: {
        ...state.encounters,
        faceUpBoons: [
          { cardId: "boon_the_apprentice_steward", remainingUses: 1 }
        ]
      }
    };

    const prepared = resolvePendingEffect(
      useFaceUpBoon(ready, "boon_the_apprentice_steward")
    );
    const next = placeTile(prepared, "player_1", "c01_lumber_yard", "G1");

    expect(next.map.placedTiles).toHaveLength(1);
    expect(next.actionsRemaining).toBe(0);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("applies Workshops automatically to an adjacent Core upgrade", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: {
        ...state.warehouse,
        stone: 1,
        food: 5
      },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "H1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_workshops",
            tileId: "c13_workshops",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_cabin",
            tileId: "c05_cabin",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const upgraded = upgradeTile(ready, "player_1", "tile_cabin");

    expect(upgraded.map.placedTiles[1].side).toBe("upgraded");
    expect(upgraded.warehouse.stone).toBe(0);
    expect(upgraded.warehouse.food).toBe(0);
    expect(upgraded.tileActivationRecords.tile_workshops.round).toBe(1);
  });

  it("clears prepared Boon effects at Season end", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "endRound" as const,
      round: 4,
      boonModifiers: [
        {
          id: "modifier_1",
          sourceCardId: "boon_many_hands_make_light_work",
          name: "Many Hands, Light Work",
          effectText: "The next tile placed this Season costs 1 fewer resource.",
          actions: ["place" as const],
          remainingUses: 1,
          amount: 1
        }
      ]
    };

    const next = resolveEndRound(ready);

    expect(next.boonModifiers).toHaveLength(0);
    expect(next.phase).toBe("seeding");
  });

  it("uses Vanguard's Steward Power for a 0 Action Travel placement with conditional support", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      actionsRemaining: 0,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      warehouse: { ...state.warehouse, stone: 3 },
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prepared = resolvePendingEffect(useStewardPower(ready, "player_1"));
    const next = placeTile(prepared, "player_1", "c17_track", {
      anchorHexId: "H1",
      orientation: 3
    });
    const placedTrack = next.map.placedTiles.find((tile) => tile.tileId === "c17_track");

    expect(prepared.players[0].stewardPowerUsesBySeason[1]).toBe(1);
    expect(prepared.pendingEffects).toHaveLength(0);
    expect(prepared.boonModifiers[0]?.sourceType).toBe("steward");
    expect(next.map.placedTiles).toHaveLength(2);
    expect(next.actionsRemaining).toBe(0);
    expect(next.warehouse.stone).toBe(0);
    expect(placedTrack?.support.singleUse).toBe(true);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("uses Knight's Steward Power for a 0 Action Housing placement", () => {
    const state = createNewGame(1, ["knight"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      actionsRemaining: 0,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c05_cabin",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prepared = resolvePendingEffect(useStewardPower(ready, "player_1"));
    const next = placeTile(prepared, "player_1", "c05_cabin", "H1");
    const placedCabin = next.map.placedTiles.find((tile) => tile.hexIds.includes("H1"));

    expect(next.map.placedTiles).toHaveLength(2);
    expect(next.actionsRemaining).toBe(0);
    expect(placedCabin?.support.singleUse).toBe(true);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("applies printed self-Supported when upgrading to Stone Bridge", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: { ...state.warehouse, stone: 2 },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "D1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c19_bridge",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["D1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = upgradeTile(ready, "player_1", "tile_1");

    expect(next.map.placedTiles[0].side).toBe("upgraded");
    expect(next.map.placedTiles[0].support.passive).toBe(true);
  });

  it("uses Sentinel's Steward Power for a 0 Action upgrade with conditional support", () => {
    const state = createNewGame(1, ["sentinel"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      actionsRemaining: 0,
      warehouse: { ...state.warehouse, stone: 4 },
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_target",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_upgraded_neighbor",
            tileId: "c16_street",
            kind: "core" as const,
            side: "upgraded" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prepared = resolvePendingEffect(useStewardPower(ready, "player_1"));
    const next = upgradeTile(prepared, "player_1", "tile_target");
    const upgraded = next.map.placedTiles.find((tile) => tile.instanceId === "tile_target");

    expect(upgraded?.side).toBe("upgraded");
    expect(upgraded?.support.singleUse).toBe(true);
    expect(next.actionsRemaining).toBe(0);
  });

  it("sets Ranger's temporary reach target through the effect prompt", () => {
    const state = createNewGame(1, ["ranger"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prompted = useStewardPower(ready, "player_1");
    const next = resolvePendingEffect(prompted, {
      temporaryReachHexUpdates: { player_1: "G1" }
    });

    expect(next.players[0].stewardHexId).toBe("A3");
    expect(next.players[0].temporaryReachHexId).toBe("G1");
    expect(next.players[0].stewardPowerUsesBySeason[1]).toBe(1);
    expect(canUseStewardPower(next, "player_1").ok).toBe(false);
  });

  it("lets Ranger place from a disconnected reached tile with normal action cost", () => {
    const state = createNewGame(1, ["ranger"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "A3"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_home",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["A3"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_remote",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H5"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(canStartPlaceTile(ready, "player_1", "c15_path", "H6").ok).toBe(false);

    const prompted = useStewardPower(ready, "player_1");
    const reached = resolvePendingEffect(prompted, {
      temporaryReachHexUpdates: { player_1: "H5" }
    });

    expect(canStartPlaceTile(reached, "player_1", "c15_path", "H6").ok).toBe(true);

    const placed = placeTile(reached, "player_1", "c15_path", "H6");

    expect(placed.actionsRemaining).toBe(reached.actionsRemaining - 1);
    expect(placed.map.placedTiles.some((tile) => tile.hexIds.includes("H6"))).toBe(true);
    expect(placed.boonModifiers.some((modifier) => modifier.sourceCardId === "ranger")).toBe(
      false
    );
  });

  it("lets Ranger place on a disconnected empty reach hex", () => {
    const state = createNewGame(1, ["ranger"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "A3"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_home",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["A3"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(canStartPlaceTile(ready, "player_1", "c05_cabin", "H5").ok).toBe(false);

    const reached = resolvePendingEffect(useStewardPower(ready, "player_1"), {
      temporaryReachHexUpdates: { player_1: "H5" }
    });

    expect(canStartPlaceTile(reached, "player_1", "c05_cabin", "H5").ok).toBe(true);

    const placed = placeTile(reached, "player_1", "c05_cabin", "H5");

    expect(placed.map.placedTiles.some((tile) => tile.hexIds.includes("H5"))).toBe(true);
    expect(placed.warehouse.wood).toBe(ready.warehouse.wood - 2);
    expect(placed.warehouse.food).toBe(ready.warehouse.food - 5);
  });

  it("does not allow Warden's Steward Power as a normal turn action", () => {
    const state = createNewGame(1, ["warden"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      }
    };

    expect(canUseStewardPower(ready, "player_1").ok).toBe(false);
  });

  it("prevents a revealed Burden effect with Warden's Steward Power and queues relief", () => {
    const state = createNewGame(2, ["vanguard", "warden"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      encounters: {
        ...state.encounters,
        deck: ["burden_smoke_over_hearths"]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 1,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const revealed = revealEncounters(ready);

    expect(revealed.pendingEffects[0].canCancelWithWardenPower).toBe(true);
    expect(canUseStewardPower(revealed, "player_2").ok).toBe(false);
    expect(canCancelPendingBurdenWithWarden(revealed).ok).toBe(true);

    const cancelled = cancelPendingBurdenWithWarden(revealed);

    expect(cancelled.pendingEffects).toHaveLength(1);
    expect(cancelled.pendingEffects[0].title).toBe("Warden Relief");
    expect(cancelled.encounters.activeBurdens).toEqual(["burden_smoke_over_hearths"]);
    expect(cancelled.ignoredBurdenIdsThisRound).toEqual([]);
    expect(cancelled.players[1].stewardPowerUsesBySeason[1]).toBe(1);

    const relieved = resolvePendingEffect(cancelled, {
      tileStrainDeltas: { tile_1: -1 }
    });

    expect(relieved.map.placedTiles[0].strain).toBe(0);
  });

  it("does not queue Warden Relief when every tile is already Supported and unstrained", () => {
    const state = createNewGame(2, ["vanguard", "warden"]);
    const ready = {
      ...state,
      phase: "reveal" as const,
      encounters: {
        ...state.encounters,
        deck: ["burden_smoke_over_hearths"]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: true, preventedThisRound: false }
          }
        ]
      }
    };

    const revealed = revealEncounters(ready);
    const cancelled = cancelPendingBurdenWithWarden(revealed);

    expect(cancelled.pendingEffects).toHaveLength(0);
    expect(cancelled.log[0].message).toContain("no eligible tile");
  });

  it("uses Quartermaster's Steward Power as a capped resource exchange prompt", () => {
    const state = createNewGame(1, ["quartermaster"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: {
        ...state.warehouse,
        wood: 2,
        stone: 0
      }
    };

    const prompted = useStewardPower(ready, "player_1");

    expect(prompted.pendingEffects[0].resourceExchangeLimit).toBe(5);

    const next = resolvePendingEffect(prompted, {
      resourceDeltas: { wood: -2, stone: 2 }
    });

    expect(next.warehouse.wood).toBe(0);
    expect(next.warehouse.stone).toBe(2);
  });

  it("lets Quartermaster add 1 timer to an active Arrival below 3", () => {
    const state = createNewGame(1, ["quartermaster"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      warehouse: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 },
      encounters: {
        ...state.encounters,
        activeArrivals: [{ cardId: "arrival_the_quiet_quest", timerTokens: 2 }]
      }
    };

    const prompted = useStewardPower(ready, "player_1");
    const next = resolvePendingEffect(prompted);

    expect(next.encounters.activeArrivals[0].timerTokens).toBe(3);
    expect(next.players[0].stewardPowerUsesBySeason[1]).toBe(1);
  });

  it("rejects an invalid Quartermaster resource exchange", () => {
    const state = createNewGame(1, ["quartermaster"]);
    const prompted = useStewardPower({ ...state, phase: "turns" as const }, "player_1");

    const next = resolvePendingEffect(prompted, {
      resourceDeltas: { wood: -6, stone: 6 }
    });

    expect(next.pendingEffects).toHaveLength(1);
    expect(next.warehouse.wood).toBe(15);
    expect(next.warehouse.stone).toBe(15);
  });

  it("applies a prepared Arrival requirement reduction", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      season: 3 as const,
      warehouse: { ...state.warehouse, goods: 1, herbs: 2 },
      encounters: {
        ...state.encounters,
        activeArrivals: [{ cardId: "arrival_the_quiet_quest", timerTokens: 3 }],
        faceUpBoons: [{ cardId: "boon_a_welcome_well_met", remainingUses: 1 }]
      }
    };

    const prepared = resolvePendingEffect(
      useFaceUpBoon(ready, "boon_a_welcome_well_met")
    );
    const prompted = completeArrival(prepared, "arrival_the_quiet_quest");
    const next = confirmRequiredDiscounts(prompted, "goods");

    expect(next.encounters.completedArrivals).toHaveLength(1);
    expect(next.warehouse.goods).toBe(0);
    expect(next.warehouse.herbs).toBe(0);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("applies a prepared Burden resolution reduction", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      season: 2 as const,
      warehouse: { ...state.warehouse, goods: 0 },
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths"],
        faceUpBoons: [{ cardId: "boon_shared_hands_lighter_loads", remainingUses: 1 }]
      }
    };

    const prepared = resolvePendingEffect(
      useFaceUpBoon(ready, "boon_shared_hands_lighter_loads")
    );
    const prompted = resolveBurden(prepared, "burden_smoke_over_hearths");
    const next = confirmRequiredDiscounts(prompted, "goods");

    expect(next.encounters.activeBurdens).toHaveLength(0);
    expect(next.encounters.discardPile).toContain("burden_smoke_over_hearths");
    expect(next.warehouse.goods).toBe(0);
    expect(next.boonModifiers).toHaveLength(0);
  });

  it("completes an Arrival and unlocks its Special Tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      encounters: {
        ...state.encounters,
        activeArrivals: [
          { cardId: "arrival_remnants_of_the_cavalry", timerTokens: 3 }
        ]
      }
    };

    const next = completeArrival(ready, "arrival_remnants_of_the_cavalry");

    expect(next.encounters.activeArrivals).toHaveLength(0);
    expect(next.encounters.completedArrivals).toHaveLength(1);
    expect(next.tileSupply.special.special_stables).toBe(2);
    expect(next.actionsRemaining).toBe(3);
    expect(next.pendingEffects[0].title).toContain("Arrival completed");
    expect(next.pendingEffects[0].confirmLabel).toBe("Acknowledge");
  });

  it("places an unlocked Special Tile from communal supply", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      tileSupply: {
        ...state.tileSupply,
        special: { ...state.tileSupply.special, special_alms_house: 1 }
      }
    };

    const next = placeTile(ready, "player_1", "special_alms_house", "G1");

    expect(next.map.placedTiles[0].kind).toBe("special");
    expect(next.tileSupply.special.special_alms_house).toBe(0);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("places a multi-hex Street as one tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = { ...state, phase: "turns" as const };

    const next = placeTile(ready, "player_1", "c16_street", {
      anchorHexId: "G1",
      orientation: 3
    });

    expect(next.map.placedTiles).toHaveLength(1);
    expect(next.map.placedTiles[0].hexIds).toEqual(["G1", "G2"]);
    expect(next.tileSupply.core.c16_street).toBe(5);
    expect(next.actionsRemaining).toBe(3);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("places Stables as two separate single-hex tiles in one action", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [{ ...state.players[0], hasPlacedFirstTile: true }],
      tileSupply: {
        ...state.tileSupply,
        special: { ...state.tileSupply.special, special_stables: 2 }
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = placeTile(ready, "player_1", "special_stables", {
      anchorHexId: "H1",
      secondaryHexIds: ["G2"]
    });

    expect(next.map.placedTiles).toHaveLength(3);
    expect(next.map.placedTiles.slice(1).map((tile) => tile.hexIds)).toEqual([
      ["H1"],
      ["G2"]
    ]);
    expect(next.tileSupply.special.special_stables).toBe(0);
    expect(next.actionsRemaining).toBe(3);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("places the two Stables on non-adjacent legal hexes", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [{ ...state.players[0], hasPlacedFirstTile: true }],
      tileSupply: {
        ...state.tileSupply,
        special: { ...state.tileSupply.special, special_stables: 2 }
      },
      map: {
        placedTiles: [
          {
            instanceId: "path_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "path_2",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "path_3",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["I1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = placeTile(ready, "player_1", "special_stables", {
      anchorHexId: "G2",
      secondaryHexIds: ["I2"]
    });

    expect(next.map.placedTiles.slice(-2).map((tile) => tile.hexIds)).toEqual([
      ["G2"],
      ["I2"]
    ]);
  });

  it("moves a Steward through Stables without spending an action", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      actionsRemaining: 2,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_source",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "stable_one",
            tileId: "special_stables",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "stable_two",
            tileId: "special_stables",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["K1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_destination",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["K2"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(getStableMoveDestinationTileIds(ready, "player_1")).toEqual([
      "stable_one",
      "stable_two",
      "tile_destination"
    ]);

    const next = moveStewardViaStables(ready, "player_1", "tile_destination");

    expect(next.players[0].stewardHexId).toBe("K2");
    expect(next.actionsRemaining).toBe(2);
  });

  it("excludes Overstrained Stables movement destinations", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_source",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "stable_one",
            tileId: "special_stables",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "stable_two",
            tileId: "special_stables",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["K1"],
            strain: 3,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_destination",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["K2"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(getStableMoveDestinationTileIds(ready, "player_1")).toEqual([
      "stable_one"
    ]);
  });

  it("requires the Steward to start on or adjacent to a Stables network tile", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "G1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_source",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "stable_one",
            tileId: "special_stables",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["K1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_destination",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["K2"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = moveStewardViaStables(ready, "player_1", "tile_destination");

    expect(getStableMoveDestinationTileIds(ready, "player_1")).toEqual([]);
    expect(next.players[0].stewardHexId).toBe("G1");
  });

  it("resolves an active Burden with the current Season cost", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      season: 2 as const,
      warehouse: { ...state.warehouse, goods: 4 },
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      }
    };

    const prompted = resolveBurden(ready, "burden_smoke_over_hearths");

    expect(prompted.pendingCostChoice?.title).toBe("Resolve Smoke over Hearths");
    expect(prompted.encounters.activeBurdens).toHaveLength(1);
    expect(prompted.warehouse.goods).toBe(4);
    expect(prompted.actionsRemaining).toBe(4);

    const canceled = cancelCostChoice(prompted);

    expect(canceled.pendingCostChoice).toBeNull();
    expect(canceled.encounters.activeBurdens).toHaveLength(1);
    expect(canceled.warehouse.goods).toBe(4);
    expect(canceled.actionsRemaining).toBe(4);

    const next = confirmCostChoice(prompted, { selectedOptionIds: [] });

    expect(next.encounters.activeBurdens).toHaveLength(0);
    expect(next.encounters.discardPile).toContain("burden_smoke_over_hearths");
    expect(next.warehouse.goods).toBe(0);
    expect(next.actionsRemaining).toBe(3);
    expect(next.pendingEffects).toHaveLength(0);
  });

  it("prompts for Market Stalls before paying a Burden cost", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      season: 1 as const,
      warehouse: {
        ...state.warehouse,
        wood: 1,
        goods: 1
      },
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_forest_s_grudge"]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_market",
            tileId: "c14_market_stalls",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prompted = resolveBurden(ready, "burden_forest_s_grudge");

    expect(prompted.pendingCostChoice?.options[0].sourceName).toBe("Market Stalls");

    const resolved = confirmCostChoice(prompted, {
      selectedOptionIds: [prompted.pendingCostChoice?.options[0].id ?? ""],
      marketResourceByOptionId: {
        [prompted.pendingCostChoice?.options[0].id ?? ""]: "wood"
      }
    });

    expect(resolved.encounters.activeBurdens).toHaveLength(0);
    expect(resolved.warehouse.wood).toBe(0);
    expect(resolved.warehouse.goods).toBe(0);
    expect(resolved.tileActivationRecords.tile_market.round).toBe(1);
  });

  it("uses The Seldes to spend 1 Goods as 2 resources of one type", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      season: 1 as const,
      warehouse: {
        ...state.warehouse,
        wood: 0,
        goods: 1
      },
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_forest_s_grudge"]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_seldes",
            tileId: "c14_market_stalls",
            kind: "core" as const,
            side: "upgraded" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prompted = resolveBurden(ready, "burden_forest_s_grudge");
    const resolved = confirmCostChoice(prompted, {
      selectedOptionIds: [prompted.pendingCostChoice?.options[0].id ?? ""],
      marketResourceByOptionId: {
        [prompted.pendingCostChoice?.options[0].id ?? ""]: "wood"
      }
    });

    expect(prompted.pendingCostChoice?.options[0].sourceName).toBe("The Seldes");
    expect(resolved.encounters.activeBurdens).toHaveLength(0);
    expect(resolved.warehouse.wood).toBe(0);
    expect(resolved.warehouse.goods).toBe(0);
  });

  it("queues The Resting Hall passive after resolving a Burden", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      season: 1 as const,
      warehouse: { ...state.warehouse, goods: 2 },
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_smoke_over_hearths"]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "special_the_resting_hall",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_2",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 1,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const prompted = resolveBurden(ready, "burden_smoke_over_hearths");
    const resolved = confirmCostChoice(prompted, { selectedOptionIds: [] });

    expect(resolved.pendingEffects).toHaveLength(0);
    expect(resolved.map.placedTiles[1].strain).toBe(0);
  });

  it("expired Arrivals prompt for a Strain target", () => {
    const state = createNewGame(1, ["vanguard"]);
    const placed = resolvePendingEffect(
      placeTile({ ...state, phase: "turns" as const }, "player_1", "c01_lumber_yard", "G1")
    );
    const ready = {
      ...placed,
      phase: "endRound" as const,
      encounters: {
        ...placed.encounters,
        activeArrivals: [{ cardId: "arrival_the_quiet_quest", timerTokens: 1 }]
      }
    };

    const next = resolveEndRound(ready);

    expect(next.encounters.activeArrivals).toHaveLength(0);
    expect(next.encounters.discardPile).toContain("arrival_the_quiet_quest");
    expect(next.map.placedTiles[0].strain).toBe(0);
    expect(next.pendingEffects[0].requiresManualChoice).toBe(true);
    const resolved = resolvePendingEffect(next, {
      tileStrainDeltas: { [next.map.placedTiles[0].instanceId]: 1 }
    });

    expect(resolved.map.placedTiles[0].strain).toBe(1);
  });

  it("Overstrained tiles spread Strain at the end of Seasons I and II", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "endRound" as const,
      round: 4,
      map: {
        placedTiles: [
          {
            instanceId: "tile_1",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 3,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_2",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = resolveEndRound(ready);

    expect(next.map.placedTiles[1].strain).toBe(1);
    expect(next.phase).toBe("seeding");
  });

  it("fires active Burdens at the start of a new Season", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "endRound" as const,
      round: 4,
      encounters: {
        ...state.encounters,
        activeBurdens: ["burden_forest_s_grudge"]
      },
      map: {
        placedTiles: [
          {
            instanceId: "tile_lumber",
            tileId: "c01_lumber_yard",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = resolveEndRound(ready);

    expect(next.season).toBe(2);
    expect(next.phase).toBe("seeding");
    expect(next.pendingEffects[0].title).toBe("Season 2 Burden: Forest's Grudge");
    expect(next.pendingEffects[0].sourceId).toBe("burden_forest_s_grudge");
    expect(next.pendingEffects[0].suggestedAdjustment?.tileStrainDeltas).toEqual({
      tile_lumber: 2
    });
  });
});

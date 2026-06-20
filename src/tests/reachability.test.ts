import { describe, expect, it } from "vitest";
import {
  isTileReachable,
  selectReachablePlacedTileIds
} from "../engine/reachability";
import { createNewGame } from "../engine/setup";

describe("settlement reachability", () => {
  it("uses active Docks to connect reachable networks to water-adjacent tiles", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "C1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_source",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["C1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_docks",
            tileId: "special_docks",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["D1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_water_adjacent",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["L7"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_inland",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["A9"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const reachable = selectReachablePlacedTileIds(ready, "player_1");

    expect(reachable.has("tile_docks")).toBe(true);
    expect(reachable.has("tile_water_adjacent")).toBe(true);
    expect(reachable.has("tile_inland")).toBe(false);
  });

  it("does not use Overstrained Docks for network reachability", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      players: [
        {
          ...state.players[0],
          hasPlacedFirstTile: true,
          stewardHexId: "C1"
        }
      ],
      map: {
        placedTiles: [
          {
            instanceId: "tile_source",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["C1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_docks",
            tileId: "special_docks",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["D1"],
            strain: 3,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_water_adjacent",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["L7"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    expect(isTileReachable(ready, "player_1", "tile_water_adjacent")).toBe(false);
  });
});

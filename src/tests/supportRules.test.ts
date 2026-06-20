import { describe, expect, it } from "vitest";
import { recalculatePassiveSupported } from "../engine/supportRules";
import { createNewGame } from "../engine/setup";

describe("passive Supported rules", () => {
  it("supports Travel tiles in Lantern Roadhouse's connected network", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
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
            instanceId: "tile_lantern",
            tileId: "special_lantern_roadhouse",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["H1"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_remote_path",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["K8"],
            strain: 0,
            support: { passive: false, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = recalculatePassiveSupported(ready);

    expect(next.map.placedTiles[0].support.passive).toBe(true);
    expect(next.map.placedTiles[1].support.passive).toBe(true);
    expect(next.map.placedTiles[2].support.passive).toBe(false);
  });

  it("removes Lantern Roadhouse support while it is Overstrained", () => {
    const state = createNewGame(1, ["vanguard"]);
    const ready = {
      ...state,
      phase: "turns" as const,
      map: {
        placedTiles: [
          {
            instanceId: "tile_path",
            tileId: "c15_path",
            kind: "core" as const,
            side: "basic" as const,
            hexIds: ["G1"],
            strain: 0,
            support: { passive: true, singleUse: false, preventedThisRound: false }
          },
          {
            instanceId: "tile_lantern",
            tileId: "special_lantern_roadhouse",
            kind: "special" as const,
            side: "special" as const,
            hexIds: ["H1"],
            strain: 3,
            support: { passive: true, singleUse: false, preventedThisRound: false }
          }
        ]
      }
    };

    const next = recalculatePassiveSupported(ready);

    expect(next.map.placedTiles[0].support.passive).toBe(false);
    expect(next.map.placedTiles[1].support.passive).toBe(false);
  });
});

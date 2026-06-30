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

  it.each([
    ["basic", 1],
    ["upgraded", 3]
  ] as const)(
    "%s Common Land automatically supports %i adjacent Housing",
    (side, expectedSupported) => {
      const state = createNewGame(1, ["vanguard"]);
      state.map.placedTiles = [
        {
          instanceId: "common",
          tileId: "c18_common_land",
          kind: "core",
          side,
          hexIds: ["G5"],
          strain: 0,
          support: { passive: false, singleUse: false, preventedThisRound: false }
        },
        ...["F4", "F5", "G4"].map((hexId, index) => ({
          instanceId: `housing_${index}`,
          tileId: "c05_cabin",
          kind: "core" as const,
          side: "basic" as const,
          hexIds: [hexId],
          strain: 0,
          support: { passive: false, singleUse: false, preventedThisRound: false }
        }))
      ];

      const next = recalculatePassiveSupported(state);
      expect(
        next.map.placedTiles.slice(1).filter((tile) => tile.support.passive)
      ).toHaveLength(expectedSupported);
    }
  );

  it("removes Common Land support when its source becomes Overstrained", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      {
        instanceId: "common",
        tileId: "c18_common_land",
        kind: "core",
        side: "basic",
        hexIds: ["G1"],
        strain: 3,
        support: { passive: false, singleUse: false, preventedThisRound: false }
      },
      {
        instanceId: "housing",
        tileId: "c05_cabin",
        kind: "core",
        side: "basic",
        hexIds: ["H1"],
        strain: 0,
        support: { passive: true, singleUse: false, preventedThisRound: false }
      }
    ];

    expect(recalculatePassiveSupported(state).map.placedTiles[1].support.passive).toBe(false);
  });
});

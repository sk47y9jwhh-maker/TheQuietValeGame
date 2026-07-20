import { describe, expect, it } from "vitest";
import { areHexesAdjacent, getHexNeighbors } from "../engine/hex";
import {
  getNeighbourlySupportClusters,
  isNeighbourlySupportSelectionValid,
  recalculatePassiveSupported
} from "../engine/supportRules";
import { createNewGame } from "../engine/setup";
import type { PlacedTile } from "../engine/types";

function housingTile(
  instanceId: string,
  hexId: string,
  strain = 0
): PlacedTile {
  return {
    instanceId,
    tileId: "c05_cabin",
    kind: "core",
    side: "basic",
    hexIds: [hexId],
    strain,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

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

describe("Neighbourly Support", () => {
  it("awards one single-use Supported per complete trio in a Housing cluster", () => {
    const state = createNewGame(1, ["vanguard"]);
    const clusterHexes = ["G5", ...getHexNeighbors("G5").slice(0, 5)];
    state.map.placedTiles = clusterHexes.map((hexId, index) =>
      housingTile(`housing_${index + 1}`, hexId)
    );

    expect(getNeighbourlySupportClusters(state)).toEqual([
      {
        tileIds: state.map.placedTiles.map((tile) => tile.instanceId),
        eligibleTileIds: state.map.placedTiles.map((tile) => tile.instanceId),
        awardCount: 2,
        requiredSelectionCount: 2
      }
    ]);
  });

  it("treats Overstrained Housing as a gap when finding clusters", () => {
    const state = createNewGame(1, ["vanguard"]);
    const centerHex = "G5";
    const neighbors = getHexNeighbors(centerHex);
    const firstHex = neighbors[0];
    const separatedHex = neighbors.find(
      (hexId) => hexId !== firstHex && !areHexesAdjacent(firstHex, hexId)
    );
    expect(separatedHex).toBeDefined();
    state.map.placedTiles = [
      housingTile("left", firstHex),
      housingTile("overstrained_bridge", centerHex, 3),
      housingTile("right", separatedHex!)
    ];

    expect(getNeighbourlySupportClusters(state)).toEqual([]);
  });

  it("requires the correct number of different targets in every cluster", () => {
    const state = createNewGame(1, ["vanguard"]);
    const firstCluster = ["G1", "H1", "I1"].map((hexId, index) =>
      housingTile(`small_${index + 1}`, hexId)
    );
    const secondCluster = ["G7", ...getHexNeighbors("G7").slice(0, 5)].map(
      (hexId, index) => housingTile(`large_${index + 1}`, hexId)
    );
    state.map.placedTiles = [...firstCluster, ...secondCluster];

    expect(
      isNeighbourlySupportSelectionValid(state, [
        "large_1",
        "large_2",
        "large_3"
      ])
    ).toBe(false);
    expect(
      isNeighbourlySupportSelectionValid(state, [
        "small_1",
        "large_1",
        "large_2"
      ])
    ).toBe(true);
    expect(
      isNeighbourlySupportSelectionValid(state, [
        "small_1",
        "small_1",
        "large_1"
      ])
    ).toBe(false);
  });

  it("does not stack awards on Tiles that are already Supported", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = ["G1", "H1", "I1"].map((hexId, index) =>
      housingTile(`housing_${index + 1}`, hexId)
    );
    state.map.placedTiles[0].support.passive = true;
    state.map.placedTiles[1].support.singleUse = true;

    expect(getNeighbourlySupportClusters(state)[0]).toMatchObject({
      awardCount: 1,
      eligibleTileIds: ["housing_3"],
      requiredSelectionCount: 1
    });
  });
});

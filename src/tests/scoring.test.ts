import { describe, expect, it } from "vitest";
import { getHexNeighbors } from "../engine/hex";
import { calculateFinalScore } from "../engine/scoring";
import { createNewGame } from "../engine/setup";
import type { PlacedTile } from "../engine/types";

function placedTile(
  instanceId: string,
  tileId: string,
  hexIds: string[],
  side: "basic" | "upgraded" | "special" = "basic",
  kind: "core" | "special" = "core"
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind,
    side,
    hexIds,
    strain: 0,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

describe("final scoring", () => {
  it("applies -3 Renown per Strain token", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles.push({
      instanceId: "tile_1",
      tileId: "c15_path",
      kind: "core",
      side: "basic",
      hexIds: ["G1"],
      strain: 2,
      support: { passive: false, singleUse: false, preventedThisRound: false }
    });

    expect(calculateFinalScore(state).strainPenalty).toBe(6);
  });

  it("does not count Overstrained tile population or renown", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles.push({
      instanceId: "tile_1",
      tileId: "c08_inn",
      kind: "core",
      side: "basic",
      hexIds: ["G1"],
      strain: 3,
      support: { passive: false, singleUse: false, preventedThisRound: false }
    });

    const score = calculateFinalScore(state);
    expect(score.population).toBe(0);
    expect(score.printedRenown).toBe(0);
  });

  it("scores the Warden objective when active Burdens are fewer than player count", () => {
    const state = createNewGame(2, ["warden", "vanguard"]);
    state.encounters.activeBurdens = ["burden_smoke_over_hearths"];

    expect(calculateFinalScore(state).stewardObjectiveRenown).toBe(15);
  });

  it("scores the Quartermaster objective from Warehouse spread", () => {
    const state = createNewGame(1, ["quartermaster"]);
    state.warehouse = {
      wood: 5,
      stone: 5,
      metal: 5,
      food: 5,
      herbs: 0,
      goods: 0
    };

    expect(calculateFinalScore(state).stewardObjectiveRenown).toBe(15);
  });

  it("adds Housing cluster passive Population bonuses", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      placedTile("tile_1", "c05_cabin", ["G1"]),
      placedTile("tile_2", "c06_cottage", ["H1"])
    ];

    const score = calculateFinalScore(state);

    expect(score.printedPopulation).toBe(15);
    expect(score.passivePopulation).toBe(5);
    expect(score.population).toBe(20);
  });

  it("adds upgraded Housing adjacent Travel passive Renown", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      placedTile("tile_1", "c05_cabin", ["G1"], "upgraded"),
      placedTile("tile_2", "c15_path", ["H1"])
    ];

    const score = calculateFinalScore(state);

    expect(score.passiveRenown).toBe(2);
    expect(score.finalScore).toBe(12);
  });

  it("adds basic Travel passive Renown when adjacent to 3 non-Travel tiles", () => {
    const state = createNewGame(1, ["vanguard"]);
    const neighbors = getHexNeighbors("G1").slice(0, 3);
    state.map.placedTiles = [
      placedTile("tile_1", "c15_path", ["G1"]),
      placedTile("tile_2", "c05_cabin", [neighbors[0]]),
      placedTile("tile_3", "c09_tavern", [neighbors[1]]),
      placedTile("tile_4", "c10_eatery", [neighbors[2]])
    ];

    expect(calculateFinalScore(state).passiveRenown).toBe(1);
  });

  it("adds upgraded Travel group passive Renown", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      placedTile("tile_1", "c15_path", ["G1"], "upgraded"),
      placedTile("tile_2", "c16_street", ["H1", "H2"], "upgraded")
    ];

    expect(calculateFinalScore(state).passiveRenown).toBe(2);
  });
});

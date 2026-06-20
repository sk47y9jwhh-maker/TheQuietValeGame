import { describe, expect, it } from "vitest";
import { createNewGame } from "../engine/setup";
import { canPlaceTile, hasPotentialPlacementOption } from "../engine/placementRules";

describe("placement validation", () => {
  it("rejects River/Water placement unless the tile permits it", () => {
    const state = createNewGame(1, ["vanguard"]);
    const result = canPlaceTile(state, "player_1", "c15_path", "D1");

    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("River/Water");
  });

  it("allows Bridge placement on River/Water", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.warehouse.wood = 10;
    state.players[0].hasPlacedFirstTile = true;
    state.map.placedTiles.push({
      instanceId: "tile_1",
      tileId: "c15_path",
      kind: "core",
      side: "basic",
      hexIds: ["C1"],
      strain: 0,
      support: { passive: false, singleUse: false, preventedThisRound: false }
    });
    const result = canPlaceTile(state, "player_1", "c19_bridge", "D1");

    expect(result.ok).toBe(true);
  });

  it("rejects unaffordable placement", () => {
    const state = createNewGame(4, ["vanguard", "knight", "sentinel", "ranger"]);
    const result = canPlaceTile(state, "player_2", "c05_cabin", "A6");

    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("insufficient");
  });

  it("allows the Steward first placement on the Steward starting hex", () => {
    const state = createNewGame(1, ["vanguard"]);
    const result = canPlaceTile(state, "player_1", "c01_lumber_yard", "G1");

    expect(result.ok).toBe(true);
  });

  it("rejects first placement away from the Steward starting hex", () => {
    const state = createNewGame(1, ["vanguard"]);
    const result = canPlaceTile(state, "player_1", "c15_path", "C1");

    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("first action");
  });

  it("enforces named Special Tile adjacency requirements", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.players[0].hasPlacedFirstTile = true;
    state.tileSupply.special.special_shrine_of_renewal = 1;
    state.map.placedTiles.push({
      instanceId: "tile_1",
      tileId: "c01_lumber_yard",
      kind: "core",
      side: "basic",
      hexIds: ["G1"],
      strain: 0,
      support: { passive: false, singleUse: false, preventedThisRound: false }
    });

    expect(canPlaceTile(state, "player_1", "special_shrine_of_renewal", "H1").ok).toBe(true);
    expect(canPlaceTile(state, "player_1", "special_shrine_of_renewal", "A1").ok).toBe(false);
  });

  it("validates a straight multi-hex Street footprint", () => {
    const state = createNewGame(1, ["vanguard"]);
    const result = canPlaceTile(state, "player_1", "c16_street", {
      anchorHexId: "G1",
      orientation: 3
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a line footprint that leaves the map", () => {
    const state = createNewGame(1, ["vanguard"]);
    const result = canPlaceTile(state, "player_1", "c17_track", {
      anchorHexId: "G1",
      orientation: 2
    });

    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("leave the map");
  });

  it("rejects a line footprint that overlaps an occupied hex", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.players[0].hasPlacedFirstTile = true;
    state.map.placedTiles.push({
      instanceId: "tile_1",
      tileId: "c15_path",
      kind: "core",
      side: "basic",
      hexIds: ["H1"],
      strain: 0,
      support: { passive: false, singleUse: false, preventedThisRound: false }
    });

    const result = canPlaceTile(state, "player_1", "c16_street", {
      anchorHexId: "G1",
      orientation: 5
    });

    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("H1 is occupied");
  });

  it("requires two legal locations for Stables", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.players[0].hasPlacedFirstTile = true;
    state.tileSupply.special.special_stables = 2;
    state.map.placedTiles.push({
      instanceId: "tile_1",
      tileId: "c15_path",
      kind: "core",
      side: "basic",
      hexIds: ["G1"],
      strain: 0,
      support: { passive: false, singleUse: false, preventedThisRound: false }
    });

    expect(
      canPlaceTile(state, "player_1", "special_stables", { anchorHexId: "H1" }).ok
    ).toBe(false);
    expect(
      canPlaceTile(state, "player_1", "special_stables", {
        anchorHexId: "H1",
        secondaryHexIds: ["G2"]
      }).ok
    ).toBe(true);
    expect(
      canPlaceTile(state, "player_1", "special_stables", {
        anchorHexId: "H1",
        secondaryHexIds: ["K9"]
      }).ok
    ).toBe(false);
  });

  it("reports whether a tile has any legal placement independent of cost", () => {
    const state = createNewGame(1, ["vanguard"]);

    expect(hasPotentialPlacementOption(state, "player_1", "c15_path")).toBe(true);
    expect(hasPotentialPlacementOption(state, "player_1", "c08_inn")).toBe(false);
    expect(hasPotentialPlacementOption(state, "player_1", "c20_dig_site")).toBe(false);

    state.warehouse.food = 0;
    expect(canPlaceTile(state, "player_1", "c05_cabin", "G1").ok).toBe(false);
    expect(hasPotentialPlacementOption(state, "player_1", "c05_cabin")).toBe(true);
  });
});

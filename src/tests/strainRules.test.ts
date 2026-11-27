import { describe, expect, it } from "vitest";
import {
  applyStrainToState,
  applyStrainToTile,
  refreshPassiveSupported,
  removeStrainFromTile
} from "../engine/strainRules";
import { createNewGame } from "../engine/setup";
import type { PlacedTile } from "../engine/types";

const baseTile: PlacedTile = {
  instanceId: "tile_1",
  tileId: "c15_path",
  kind: "core",
  side: "basic",
  hexIds: ["A1"],
  strain: 0,
  support: {
    passive: false,
    singleUse: false,
    preventedThisRound: false
  }
};

describe("strain, Supported, and Overstrained", () => {
  it("caps Strain at 3", () => {
    expect(applyStrainToTile({ ...baseTile, strain: 2 }, 5).strain).toBe(3);
  });

  it("spends single-use Supported to prevent one Strain", () => {
    const supported = {
      ...baseTile,
      support: { passive: false, singleUse: true, preventedThisRound: false }
    };
    const next = applyStrainToTile(supported, 1);

    expect(next.strain).toBe(0);
    expect(next.support.singleUse).toBe(false);
    expect(next.support.preventedThisRound).toBe(true);
  });

  it("lets passive Supported prevent Strain once again after each round refresh", () => {
    const supported = {
      ...baseTile,
      support: { passive: true, singleUse: false, preventedThisRound: false }
    };

    const first = applyStrainToTile(supported, 1);
    expect(first.strain).toBe(0);
    expect(first.support).toEqual({
      passive: true,
      singleUse: false,
      preventedThisRound: true
    });

    const second = applyStrainToTile(first, 1);
    expect(second.strain).toBe(1);

    const nextRound = refreshPassiveSupported(second);
    const third = applyStrainToTile(nextRound, 1);
    expect(third.strain).toBe(1);
    expect(third.support.passive).toBe(true);
    expect(third.support.preventedThisRound).toBe(true);
  });

  it("recovers from Overstrained when Strain drops below 3", () => {
    const recovered = removeStrainFromTile({ ...baseTile, strain: 3 }, 1);

    expect(recovered.strain).toBe(2);
  });

  it("lets Lantern Roadhouse prevent 1 Strain on a connected Travel Tile once per round", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      { ...baseTile, instanceId: "path", hexIds: ["G1"] },
      {
        ...baseTile,
        instanceId: "lantern",
        tileId: "special_lantern_roadhouse",
        kind: "special",
        side: "special",
        hexIds: ["H1"]
      }
    ];

    const first = applyStrainToState(state, "path", 1);
    expect(first.map.placedTiles[0].strain).toBe(0);
    expect(first.tileActivationRecords.lantern.round).toBe(1);

    const second = applyStrainToState(first, "path", 1);
    expect(second.map.placedTiles[0].strain).toBe(1);
  });

  it("lets Common Land prevent 1 Strain on 1 adjacent Housing Tile once per round", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      { ...baseTile, instanceId: "common", tileId: "c18_common_land", hexIds: ["G5"] },
      { ...baseTile, instanceId: "home_1", tileId: "c05_cabin", hexIds: ["F4"] },
      { ...baseTile, instanceId: "home_2", tileId: "c05_cabin", hexIds: ["F5"] }
    ];

    const first = applyStrainToState(state, "home_1", 1);
    expect(first.map.placedTiles[1].strain).toBe(0);
    expect(first.tileActivationRecords.common.round).toBe(1);

    const second = applyStrainToState(first, "home_2", 1);
    expect(second.map.placedTiles[2].strain).toBe(1);
  });

  it("lets The Pleasance prevent 1 Strain on up to 3 distinct adjacent Housing Tiles once per round", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      { ...baseTile, instanceId: "pleasance", tileId: "c18_common_land", side: "upgraded", hexIds: ["G5"] },
      { ...baseTile, instanceId: "home_1", tileId: "c05_cabin", hexIds: ["F4"] },
      { ...baseTile, instanceId: "home_2", tileId: "c05_cabin", hexIds: ["F5"] },
      { ...baseTile, instanceId: "home_3", tileId: "c05_cabin", hexIds: ["G4"] },
      { ...baseTile, instanceId: "home_4", tileId: "c05_cabin", hexIds: ["G6"] }
    ];

    let next = applyStrainToState(state, "home_1", 1);
    expect(next.map.placedTiles[1].strain).toBe(0);
    // A second hit on the same Housing Tile in the same round is not prevented again by The Pleasance.
    next = applyStrainToState(next, "home_1", 1);
    expect(next.map.placedTiles[1].strain).toBe(1);

    next = applyStrainToState(next, "home_2", 1);
    next = applyStrainToState(next, "home_3", 1);
    expect(next.map.placedTiles[2].strain).toBe(0);
    expect(next.map.placedTiles[3].strain).toBe(0);

    // Fourth distinct adjacent Housing exceeds the 3-tile limit.
    next = applyStrainToState(next, "home_4", 1);
    expect(next.map.placedTiles[4].strain).toBe(1);
  });

  it("lets Stone Bridge prevent 1 Strain on itself once per round and fires before spending single-use Supported", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      {
        ...baseTile,
        instanceId: "bridge",
        tileId: "c19_bridge",
        side: "upgraded",
        hexIds: ["D1"],
        support: { passive: false, singleUse: true, preventedThisRound: false }
      }
    ];

    const first = applyStrainToState(state, "bridge", 1);
    expect(first.map.placedTiles[0].strain).toBe(0);
    expect(first.map.placedTiles[0].support.singleUse).toBe(true);
    expect(first.tileActivationRecords.bridge.round).toBe(1);

    const second = applyStrainToState(first, "bridge", 1);
    expect(second.map.placedTiles[0].strain).toBe(0);
    expect(second.map.placedTiles[0].support.singleUse).toBe(false);

    const third = applyStrainToState(second, "bridge", 1);
    expect(third.map.placedTiles[0].strain).toBe(1);
  });

  it("lets The Golden Hearth prevent 1 Strain on each adjacent Housing Tile once per round", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      {
        ...baseTile,
        instanceId: "hearth",
        tileId: "golden_tile_the_golden_hearth",
        kind: "special",
        side: "special",
        hexIds: ["G5"]
      },
      { ...baseTile, instanceId: "home_1", tileId: "c05_cabin", hexIds: ["F4"] },
      { ...baseTile, instanceId: "home_2", tileId: "c05_cabin", hexIds: ["F5"] }
    ];

    let next = applyStrainToState(state, "home_1", 1);
    next = applyStrainToState(next, "home_2", 1);
    expect(next.map.placedTiles[1].strain).toBe(0);
    expect(next.map.placedTiles[2].strain).toBe(0);

    next = applyStrainToState(next, "home_1", 1);
    expect(next.map.placedTiles[1].strain).toBe(1);
  });
});

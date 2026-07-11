import { describe, expect, it } from "vitest";
import { arrivals } from "../data/encounters";
import { specialTileById, specialTiles } from "../data/tiles";
import { validateAllGameData } from "../engine/dataValidation";

describe("component data integrity", () => {
  it("has no authored data validation issues", () => {
    expect(validateAllGameData()).toEqual([]);
  });

  it("has all v3.6 Special Tiles represented", () => {
    expect(specialTiles).toHaveLength(25);
  });

  it("maps every Arrival reward to a known Special Tile", () => {
    const missing = arrivals.flatMap((arrival) =>
      arrival.rewardSpecialTileIds.filter((specialTileId) => !specialTileById[specialTileId])
    );

    expect(missing).toEqual([]);
  });
});

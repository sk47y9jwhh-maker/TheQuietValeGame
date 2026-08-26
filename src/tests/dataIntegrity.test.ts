import { describe, expect, it } from "vitest";
import { arrivals } from "../data/encounters";
import { coreTiles, specialTileById, specialTiles } from "../data/tiles";
import { validateAllGameData } from "../engine/dataValidation";

describe("component data integrity", () => {
  it("has no authored data validation issues", () => {
    expect(validateAllGameData()).toEqual([]);
  });

  it("has all v3.6 Special Tiles represented", () => {
    expect(specialTiles).toHaveLength(25);
  });

  it("provides four copies of every Resource Tile", () => {
    const resourceTiles = coreTiles.filter((tile) => tile.category === "resource");

    expect(resourceTiles).toHaveLength(5);
    expect(resourceTiles.every((tile) => tile.count === 4)).toBe(true);
    expect(
      resourceTiles.every((tile) =>
        [tile.basic, tile.upgraded].every((side) =>
          side.effectText.includes("Passive: Linked Production")
        )
      )
    ).toBe(true);
  });

  it("uses the locked stock for Cottage, Bridge and The Vaults", () => {
    const stockById = Object.fromEntries(coreTiles.map((tile) => [tile.id, tile.count]));

    expect(stockById.c06_cottage).toBe(4);
    expect(stockById.c19_bridge).toBe(4);
    expect(stockById.c21_the_vaults).toBe(2);
  });

  it("maps every Arrival reward to a known Special Tile", () => {
    const missing = arrivals.flatMap((arrival) =>
      arrival.rewardSpecialTileIds.filter((specialTileId) => !specialTileById[specialTileId])
    );

    expect(missing).toEqual([]);
  });
});

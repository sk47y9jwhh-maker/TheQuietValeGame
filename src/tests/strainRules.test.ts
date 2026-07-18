import { describe, expect, it } from "vitest";
import {
  applyStrainToTile,
  refreshPassiveSupported,
  removeStrainFromTile
} from "../engine/strainRules";
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
});

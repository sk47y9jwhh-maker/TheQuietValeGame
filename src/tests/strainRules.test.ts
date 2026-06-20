import { describe, expect, it } from "vitest";
import { applyStrainToTile, removeStrainFromTile } from "../engine/strainRules";
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

  it("recovers from Overstrained when Strain drops below 3", () => {
    const recovered = removeStrainFromTile({ ...baseTile, strain: 3 }, 1);

    expect(recovered.strain).toBe(2);
  });
});


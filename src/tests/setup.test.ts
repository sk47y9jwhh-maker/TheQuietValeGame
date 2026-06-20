import { describe, expect, it } from "vitest";
import {
  buildEncounterPool,
  createNewGame,
  dealEncounterSetup,
  getStartingWarehouseAmount
} from "../engine/setup";
import {
  commitStewardPlacement,
  validateStewardPlacement
} from "../engine/gameActions";
import { getSeasonForRound, revealCountForPlayers } from "../engine/season";

describe("setup and round authority", () => {
  it("calculates seasons from rounds", () => {
    expect(getSeasonForRound(1)).toBe(1);
    expect(getSeasonForRound(4)).toBe(1);
    expect(getSeasonForRound(5)).toBe(2);
    expect(getSeasonForRound(8)).toBe(2);
    expect(getSeasonForRound(9)).toBe(3);
    expect(getSeasonForRound(12)).toBe(3);
  });

  it("sets starting warehouse by player count", () => {
    expect(getStartingWarehouseAmount(1)).toBe(15);
    expect(getStartingWarehouseAmount(2)).toBe(10);
    expect(getStartingWarehouseAmount(3)).toBe(5);
    expect(getStartingWarehouseAmount(4)).toBe(0);
  });

  it("reveals standard Encounter Cards equal to player count", () => {
    expect(revealCountForPlayers(1)).toBe(1);
    expect(revealCountForPlayers(4)).toBe(4);
  });

  it("uses the full 4/4/4 per player Encounter pool", () => {
    const setup = dealEncounterSetup(4, ["p1", "p2", "p3", "p4"]);
    const handCount = Object.values(setup.handsByPlayerId).reduce(
      (total, hand) => total + hand.length,
      0
    );

    expect(handCount).toBe(36);
    expect(setup.deck).toHaveLength(12);
    expect(setup.unused).toHaveLength(0);
  });

  it("builds repeatable shuffled Encounter pools from a setup seed", () => {
    const first = buildEncounterPool(2, "QV-TEST");
    const second = buildEncounterPool(2, "QV-TEST");
    const different = buildEncounterPool(2, "QV-OTHER");

    expect(first).toEqual(second);
    expect(first).toHaveLength(24);
    expect(first).not.toEqual(different);
  });

  it("uses every dealt seeded Encounter Card", () => {
    const setup = dealEncounterSetup(2, ["p1", "p2"], {
      encounterSeed: "QV-TEST"
    });
    const handCount = Object.values(setup.handsByPlayerId).reduce(
      (total, hand) => total + hand.length,
      0
    );

    expect(handCount).toBe(18);
    expect(setup.deck).toHaveLength(6);
    expect(setup.unused).toHaveLength(0);
  });

  it("starts with explicit Steward placement before Season I seeding", () => {
    const state = createNewGame(2, ["vanguard", "knight"]);

    expect(state.phase).toBe("setup");
    expect(validateStewardPlacement(state, "player_1", "G1").ok).toBe(true);
    expect(validateStewardPlacement(state, "player_1", "A1").ok).toBe(false);

    const afterFirst = commitStewardPlacement(state, "player_1", "G1");

    expect(afterFirst.phase).toBe("setup");
    expect(afterFirst.currentPlayerId).toBe("player_2");

    const afterSecond = commitStewardPlacement(afterFirst, "player_2", "A6");

    expect(afterSecond.phase).toBe("seeding");
    expect(afterSecond.currentPlayerId).toBe("player_1");
  });
});

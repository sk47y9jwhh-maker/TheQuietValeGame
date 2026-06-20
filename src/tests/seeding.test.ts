import { describe, expect, it } from "vitest";
import {
  commitSeasonSeeding,
  validateSeedingSelection
} from "../engine/gameActions";
import { createNewGame } from "../engine/setup";

describe("seasonal seeding", () => {
  it("requires top, middle, and bottom to be distinct cards from hand", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "seeding" as const };
    const hand = state.encounters.handsByPlayerId.player_1;
    const invalid = validateSeedingSelection(state, "player_1", {
      top: hand[0],
      middle: hand[0],
      bottom: hand[1]
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.reasons.join(" ")).toContain("different card");
  });

  it("moves seeded cards out of hand and into the deck", () => {
    const state = { ...createNewGame(1, ["vanguard"]), phase: "seeding" as const };
    const hand = state.encounters.handsByPlayerId.player_1;
    const next = commitSeasonSeeding(state, "player_1", {
      top: hand[0],
      middle: hand[1],
      bottom: hand[2]
    });

    expect(next.encounters.handsByPlayerId.player_1).toHaveLength(6);
    expect(next.encounters.deck).toContain(hand[0]);
    expect(next.encounters.deck).toContain(hand[1]);
    expect(next.encounters.deck).toContain(hand[2]);
    expect(next.phase).toBe("reveal");
  });
});

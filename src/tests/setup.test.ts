import { describe, expect, it } from "vitest";
import { encounterById } from "../data/encounters";
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
import {
  supportedPlayerCounts,
  type EncounterData
} from "../engine/types";

function countEncounterTypes(cardIds: string[]): Record<EncounterData["type"], number> {
  const counts: Record<EncounterData["type"], number> = {
    boon: 0,
    burden: 0,
    arrival: 0,
    goldenBoon: 0
  };

  for (const cardId of cardIds) {
    const card = encounterById[cardId];
    if (!card) throw new Error(`Unknown Encounter Card: ${cardId}`);
    counts[card.type] += 1;
  }

  return counts;
}

function dealtCardIds(
  setup: Pick<ReturnType<typeof dealEncounterSetup>, "handsByPlayerId" | "deck" | "unused">
): string[] {
  return [
    ...Object.values(setup.handsByPlayerId).flat(),
    ...setup.deck,
    ...setup.unused
  ];
}

describe("setup and round authority", () => {
  it("creates the standard 30-card Target Deck for every game", () => {
    const state = createNewGame(1, ["vanguard"], {
      encounterSeed: "QV-TARGET-DECK"
    });

    expect(state.targetCards.drawPile).toHaveLength(30);
    expect(state.targetCards.drawCount).toBe(0);
    expect(state.targetCards).not.toHaveProperty("enabled");
  });

  it("includes four Salvage Camps", () => {
    const state = createNewGame(1, ["vanguard"]);

    expect(state.tileSupply.core.c20_dig_site).toBe(4);
  });

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
    expect(getStartingWarehouseAmount(5)).toBe(0);
  });

  it("reveals standard Encounter Cards equal to player count", () => {
    expect(revealCountForPlayers(1)).toBe(1);
    expect(revealCountForPlayers(4)).toBe(4);
    expect(revealCountForPlayers(5)).toBe(5);
  });

  it.each(supportedPlayerCounts)(
    "builds a balanced 4/4/4 standard Encounter pool for %s player(s)",
    (playerCount) => {
      const pool = buildEncounterPool(playerCount, `QV-AUTHORITY-${playerCount}`);

      expect(pool).toHaveLength(playerCount * 12);
      expect(countEncounterTypes(pool)).toEqual({
        boon: playerCount * 4,
        burden: playerCount * 4,
        arrival: playerCount * 4,
        goldenBoon: 0
      });
    }
  );

  it.each(supportedPlayerCounts)(
    "deals every selected standard Encounter Card for %s player(s)",
    (playerCount) => {
      const playerIds = Array.from(
        { length: playerCount },
        (_, index) => `player_${index + 1}`
      );
      const setup = dealEncounterSetup(playerCount, playerIds, {
        encounterSeed: `QV-DEAL-${playerCount}`
      });
      const hands = Object.values(setup.handsByPlayerId);
      const dealt = dealtCardIds(setup);

      expect(hands.map((hand) => hand.length)).toEqual(Array(playerCount).fill(9));
      expect(setup.deck).toHaveLength(playerCount * 3);
      expect(setup.unused).toHaveLength(0);
      expect(dealt).toHaveLength(playerCount * 12);
      expect(new Set(dealt).size).toBe(dealt.length);
      expect(countEncounterTypes(dealt)).toEqual({
        boon: playerCount * 4,
        burden: playerCount * 4,
        arrival: playerCount * 4,
        goldenBoon: 0
      });
    }
  );

  it("keeps Golden Boons out of normal online setup", () => {
    const state = createNewGame(4, ["vanguard", "knight", "sentinel", "ranger"], {
      encounterSeed: "QV-NO-GOLDEN"
    });

    expect(state.encounters.goldenEnabled).toBe(false);
    expect(
      dealtCardIds({
        handsByPlayerId: state.encounters.handsByPlayerId,
        deck: state.encounters.deck,
        unused: []
      }).some((cardId) => encounterById[cardId]?.type === "goldenBoon")
    ).toBe(false);
  });

  it("creates a complete five-player game with distinct Steward seats", () => {
    const stewardIds = ["vanguard", "knight", "sentinel", "ranger", "warden"];
    const state = createNewGame(5, stewardIds, { encounterSeed: "QV-FIVE-PLAYER" });

    expect(state.playerCount).toBe(5);
    expect(state.players).toHaveLength(5);
    expect(new Set(state.players.map((player) => player.stewardId)).size).toBe(5);
    expect(new Set(state.players.map((player) => player.stewardHexId)).size).toBe(5);
    expect(Object.values(state.encounters.handsByPlayerId)).toHaveLength(5);
    expect(Object.values(state.encounters.handsByPlayerId).every((hand) => hand.length === 9)).toBe(true);
    expect(state.encounters.deck).toHaveLength(15);
    expect(Object.values(state.warehouse).every((amount) => amount === 0)).toBe(true);
  });

  it("builds repeatable shuffled Encounter pools from a setup seed", () => {
    const first = buildEncounterPool(2, "QV-TEST");
    const second = buildEncounterPool(2, "QV-TEST");
    const different = buildEncounterPool(2, "QV-OTHER");

    expect(first).toEqual(second);
    expect(first).toHaveLength(24);
    expect(first).not.toEqual(different);
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

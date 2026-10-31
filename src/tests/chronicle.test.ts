import { describe, expect, it } from "vitest";
import { chronicleCards, chronicleGoldenThresholds } from "../data/chronicleCards";
import { chronicleQuestIds, createChronicleRun, evaluateChronicle, trackChronicle } from "../engine/chronicle";
import {
  cardsToNextGoldenPair,
  createChronicleCampaign,
  nextChronicleCard,
  recordChronicleGame,
  unlockedGoldenPairCount
} from "../engine/chronicleCampaign";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile, PlayerCount } from "../engine/types";

function placed(instanceId: string, tileId: string, hexIds: string | string[], strain = 0): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: "core",
    side: "basic",
    hexIds: Array.isArray(hexIds) ? hexIds : [hexIds],
    strain,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

function chronicleState(cardNumber: number, tiles: PlacedTile[], playerCount: PlayerCount = 1): GameState {
  const stewardIds = ["vanguard", "knight", "sentinel", "ranger", "warden"].slice(0, playerCount);
  const state = createNewGame(playerCount, stewardIds, { encounterSeed: "CHRONICLE-TEST" });
  state.map.placedTiles = tiles;
  state.chronicleRun = createChronicleRun(cardNumber);
  return state;
}

describe("Chronicle Cards", () => {
  it("has 21 cards with a check for every quest and a value for every player count", () => {
    expect(chronicleCards.map((card) => card.n)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    const ids = chronicleQuestIds();
    for (const card of chronicleCards) {
      for (const [half, key] of [["top", "T"], ["bottom", "B"]] as const) {
        expect(ids).toContain(`${card.n}${key}`);
        for (const [, values] of card[half].strips) expect(values).toHaveLength(5);
        if (card[half].keep) expect(card[half].keep![1]).toHaveLength(5);
        if (card[half].kind === "Vow") expect(card[half].check).toBe("All game");
      }
    }
    expect(ids).toHaveLength(42);
  });

  it("keeps a Moment met once the board has shown it", () => {
    const corners = [placed("a", "c05_cabin", "A1"), placed("b", "c05_cabin", "A9")];
    let state = trackChronicle(chronicleState(3, corners));
    expect(state.chronicleRun?.moments).toContain("3T");
    state = trackChronicle({ ...state, map: { ...state.map, placedTiles: [] } });
    expect(evaluateChronicle(state)?.top.status).toBe("met");
    expect(evaluateChronicle(state)?.complete).toBe(true);
  });

  it("asks for more at higher player counts", () => {
    const corners = [placed("a", "c05_cabin", "A1"), placed("b", "c05_cabin", "A9"), placed("c", "c05_cabin", "N1")];
    expect(trackChronicle(chronicleState(3, corners, 3)).chronicleRun?.moments).toContain("3T");
    expect(trackChronicle(chronicleState(3, corners, 5)).chronicleRun?.moments).not.toContain("3T");
  });

  it("breaks a Vow for good, even after the Strain is cleared", () => {
    let state = trackChronicle(chronicleState(13, [placed("a", "c05_cabin", "D4", 3)]));
    expect(state.chronicleRun?.broken).toContain("13B");
    state = trackChronicle({ ...state, map: { ...state.map, placedTiles: [placed("a", "c05_cabin", "D4", 0)] }, phase: "gameEnd" });
    expect(evaluateChronicle(state)?.bottom.status).toBe("broken");
  });

  it("allows Overstrained tiles up to a Vow's limit at higher player counts", () => {
    const tiles = [placed("a", "c05_cabin", "D4", 3), placed("b", "c05_cabin", "H4")];
    expect(trackChronicle(chronicleState(13, tiles, 1)).chronicleRun?.broken).toContain("13B");
    expect(trackChronicle(chronicleState(13, tiles, 3)).chronicleRun?.broken).not.toContain("13B");
  });

  it("checks a kept Vow's Keep it line at the end of the game", () => {
    const tiles = [
      placed("home", "c05_cabin", "D4"),
      placed("inn", "c09_tavern", "F4"),
      placed("wash", "c11_washhouse", "H4"),
      placed("mill", "c01_lumber_yard", "K4")
    ];
    const playing = trackChronicle(chronicleState(16, tiles));
    expect(evaluateChronicle(playing)?.bottom.status).toBe("open");
    const ended = trackChronicle({ ...playing, phase: "gameEnd" });
    expect(evaluateChronicle(ended)?.bottom.status).toBe("met");
    expect(evaluateChronicle(ended)?.complete).toBe(true);
  });

  it("reads Final quests only at the end of the game", () => {
    const state = trackChronicle(chronicleState(21, [placed("a", "c05_cabin", "D4")]));
    expect(evaluateChronicle(state)?.bottom.status).toBe("open");
    expect(evaluateChronicle({ ...state, phase: "gameEnd" })?.bottom.status).toBe("met");
  });
});

describe("Chronicle campaign", () => {
  it("deals all 21 cards in a seeded order", () => {
    const campaign = createChronicleCampaign("SEED");
    expect([...campaign.deck].sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(createChronicleCampaign("SEED").deck).toEqual(campaign.deck);
  });

  it("boxes completed cards and sends failed ones to the bottom", () => {
    let campaign = createChronicleCampaign("SEED");
    const first = nextChronicleCard(campaign)!;
    campaign = recordChronicleGame(campaign, { gameId: "g1", cardNumber: first, playerCount: 2, completed: false });
    expect(campaign.deck.at(-1)).toBe(first);
    expect(nextChronicleCard(campaign)).not.toBe(first);
    const second = nextChronicleCard(campaign)!;
    campaign = recordChronicleGame(campaign, { gameId: "g2", cardNumber: second, playerCount: 2, completed: true });
    expect(campaign.box).toEqual([second]);
    expect(campaign.deck).toHaveLength(20);
    expect(recordChronicleGame(campaign, { gameId: "g2", cardNumber: second, playerCount: 2, completed: true })).toBe(campaign);
  });

  it("unlocks Golden pairs at 3, 6, 9, 12 and 15 cards", () => {
    expect(chronicleGoldenThresholds).toEqual([3, 6, 9, 12, 15]);
    let campaign = createChronicleCampaign("SEED");
    const counts: number[] = [];
    for (let game = 1; game <= 15; game += 1) {
      campaign = recordChronicleGame(campaign, { gameId: `g${game}`, cardNumber: nextChronicleCard(campaign)!, playerCount: 1, completed: true });
      counts.push(unlockedGoldenPairCount(campaign));
    }
    expect(counts).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
    expect(cardsToNextGoldenPair(campaign)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { questCards, questGoldenThresholds } from "../data/questCards";
import { ledgerMilestones } from "../data/ledger";
import { questIds, createQuestRun, evaluateQuest, trackQuest } from "../engine/quests";
import {
  countCompletedLedgerEntries,
  createEmptyLedgerCampaign,
  isGoldenMilestoneUnlocked,
  nextQuestCard,
  recordQuestGame
} from "../engine/ledgerCampaign";
import { recordLedgerGame } from "../engine/ledger";
import { calculateFinalScore } from "../engine/scoring";
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

function questState(cardNumber: number, tiles: PlacedTile[], playerCount: PlayerCount = 1): GameState {
  const stewardIds = ["vanguard", "knight", "sentinel", "ranger", "warden"].slice(0, playerCount);
  const state = createNewGame(playerCount, stewardIds, { encounterSeed: "QUEST-TEST" });
  state.map.placedTiles = tiles;
  state.questRun = createQuestRun(cardNumber);
  return state;
}

describe("Quest Cards", () => {
  it("has 21 cards with a check for every quest and a value for every player count", () => {
    expect(questCards.map((card) => card.n)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    const ids = questIds();
    for (const card of questCards) {
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
    let state = trackQuest(questState(3, corners));
    expect(state.questRun?.moments).toContain("3T");
    state = trackQuest({ ...state, map: { ...state.map, placedTiles: [] } });
    expect(evaluateQuest(state)?.top.status).toBe("met");
    expect(evaluateQuest(state)?.complete).toBe(true);
  });

  it("logs a completed half and a broken Vow once", () => {
    const corners = [placed("a", "c05_cabin", "A1"), placed("b", "c05_cabin", "A9")];
    const state = trackQuest(questState(3, corners));
    expect(state.log[0].message).toBe("Quest Card: Corners of the Vale is complete. The card scores +20 Renown.");
    expect(trackQuest(state).log).toBe(state.log);
    const broken = trackQuest(questState(13, [placed("a", "c05_cabin", "D4", 3)]));
    expect(broken.log[0].message).toMatch(/^Quest Card: the Vow Not One Lost is broken\. The other half can still complete the card\.$/);
  });

  it("reads Final goals and kept Vows as on track during play", () => {
    const playing = trackQuest(questState(21, [placed("a", "c05_cabin", "D4")]));
    const result = evaluateQuest(playing)!;
    expect(result.bottom).toMatchObject({ status: "open", onTrack: true });
    expect(result.complete).toBe(false);
  });

  it("asks for more at higher player counts", () => {
    const corners = [placed("a", "c05_cabin", "A1"), placed("b", "c05_cabin", "A9"), placed("c", "c05_cabin", "N1")];
    expect(trackQuest(questState(3, corners, 3)).questRun?.moments).toContain("3T");
    expect(trackQuest(questState(3, corners, 5)).questRun?.moments).not.toContain("3T");
  });

  it("breaks a Vow for good, even after the Strain is cleared", () => {
    let state = trackQuest(questState(13, [placed("a", "c05_cabin", "D4", 3)]));
    expect(state.questRun?.broken).toContain("13B");
    state = trackQuest({ ...state, map: { ...state.map, placedTiles: [placed("a", "c05_cabin", "D4", 0)] }, phase: "gameEnd" });
    expect(evaluateQuest(state)?.bottom.status).toBe("broken");
  });

  it("allows Overstrained tiles up to a Vow's limit at higher player counts", () => {
    const tiles = [placed("a", "c05_cabin", "D4", 3), placed("b", "c05_cabin", "H4")];
    expect(trackQuest(questState(13, tiles, 1)).questRun?.broken).toContain("13B");
    expect(trackQuest(questState(13, tiles, 3)).questRun?.broken).not.toContain("13B");
  });

  it("checks a kept Vow's Keep it line at the end of the game", () => {
    const tiles = [
      placed("home", "c05_cabin", "D4"),
      placed("inn", "c09_tavern", "F4"),
      placed("wash", "c11_washhouse", "H4"),
      placed("mill", "c01_lumber_yard", "K4")
    ];
    const playing = trackQuest(questState(16, tiles));
    expect(evaluateQuest(playing)?.bottom.status).toBe("open");
    const ended = trackQuest({ ...playing, phase: "gameEnd" });
    expect(evaluateQuest(ended)?.bottom.status).toBe("met");
    expect(evaluateQuest(ended)?.complete).toBe(true);
  });

  it("reads Final quests only at the end of the game", () => {
    const state = trackQuest(questState(21, [placed("a", "c05_cabin", "D4")]));
    expect(evaluateQuest(state)?.bottom.status).toBe("open");
    expect(evaluateQuest({ ...state, phase: "gameEnd" })?.bottom.status).toBe("met");
  });
});

describe("Steward's Ledger", () => {
  const game = (id: string, questCardNumber: number, questCompleted: boolean) =>
    ({ id, questCardNumber, questCompleted, playerCount: 2, stewardIds: ["vanguard", "knight"], finalScore: 100 });

  it("deals all 21 cards in a seeded order", () => {
    const campaign = createEmptyLedgerCampaign("SEED");
    expect([...campaign.deck].sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i + 1));
    expect(createEmptyLedgerCampaign("SEED").deck).toEqual(campaign.deck);
  });

  it("puts completed cards in the Ledger and sends failed ones to the bottom", () => {
    let campaign = createEmptyLedgerCampaign("SEED");
    const first = nextQuestCard(campaign);
    campaign = recordQuestGame(campaign, game("g1", first, false));
    expect(campaign.deck.at(-1)).toBe(first);
    expect(nextQuestCard(campaign)).not.toBe(first);
    const second = nextQuestCard(campaign);
    campaign = recordQuestGame(campaign, game("g2", second, true));
    expect(campaign.box).toEqual([second]);
    expect(campaign.deck).toHaveLength(20);
    expect(campaign.games.map((record) => record.id)).toEqual(["g2", "g1"]);
    expect(recordQuestGame(campaign, game("g2", second, true))).toBe(campaign);
  });

  it("unlocks Golden pairs at 3, 6, 9, 12 and 15 cards", () => {
    expect(questGoldenThresholds).toEqual([3, 6, 9, 12, 15]);
    expect(ledgerMilestones.map((milestone) => milestone.threshold)).toEqual([3, 6, 9, 12, 15]);
    let campaign = createEmptyLedgerCampaign("SEED");
    const counts: number[] = [];
    for (let index = 1; index <= 15; index += 1) {
      campaign = recordQuestGame(campaign, game(`g${index}`, nextQuestCard(campaign), true));
      counts.push(ledgerMilestones.filter((milestone, milestoneIndex) =>
        isGoldenMilestoneUnlocked(campaign, milestoneIndex, milestone.threshold)).length);
    }
    expect(counts).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
    expect(countCompletedLedgerEntries(campaign)).toBe(15);
  });

  it("replays completed cards once the deck is empty", () => {
    let campaign = createEmptyLedgerCampaign("SEED");
    for (let index = 1; index <= 21; index += 1) campaign = recordQuestGame(campaign, game(`g${index}`, nextQuestCard(campaign), true));
    expect(campaign.deck).toEqual([]);
    expect(campaign.box).toHaveLength(21);
    expect(campaign.box).toContain(nextQuestCard(campaign));
  });

  it("scores +20 for a completed card and records it at game end", () => {
    const corners = [placed("a", "c05_cabin", "A1"), placed("b", "c05_cabin", "A9")];
    const state = { ...trackQuest(questState(3, corners)), phase: "gameEnd" as const };
    const without = { ...state, questRun: undefined };
    expect(calculateFinalScore(state).questRenown).toBe(20);
    expect(calculateFinalScore(state).finalScore - calculateFinalScore(without).finalScore).toBe(20);

    const campaign = { ...createEmptyLedgerCampaign("SEED"), deck: [3, ...createEmptyLedgerCampaign("SEED").deck.filter((n) => n !== 3)] };
    const result = recordLedgerGame(state, campaign);
    expect(result.questCompleted).toBe(true);
    expect(result.questCardNumber).toBe(3);
    expect(result.campaign.box).toEqual([3]);
    expect(result.state.ledgerRun?.recorded).toBe(true);
    expect(recordLedgerGame(result.state, result.campaign).campaign).toBe(result.campaign);
  });
});

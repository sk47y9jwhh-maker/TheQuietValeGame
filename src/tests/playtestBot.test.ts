import { describe, expect, it } from "vitest";
import {
  createEmptyLedgerCampaign,
  countCompletedLedgerEntries,
} from "../app/ledgerPersistence";
import { ledgerEntries } from "../data/ledger";
import {
  chooseLedgerTargets,
  runPlaytestCampaign,
} from "../../tools/playtest-bot/bot";

describe("current-prototype playtest bot", () => {
  it("plays deterministic full games through the real engine and Ledger evaluator", () => {
    const options = {
      playerCount: 1 as const,
      profile: "guided" as const,
      games: 2,
      seed: "bot-regression",
    };
    const first = runPlaytestCampaign(options);
    const second = runPlaytestCampaign(options);

    expect(first.games).toEqual(second.games);
    expect(first.games).toHaveLength(2);
    expect(first.games.flatMap((game) => game.errors)).toEqual([]);
    expect(first.games.every((game) => game.placedTiles > 0)).toBe(true);
    expect(first.games.at(-1)?.cumulativeCompletedEntries).toBeGreaterThan(0);
    expect(first.campaign.games).toHaveLength(2);
  }, 20_000);

  it("uses current eligibility gates and never declares multiple targeted Vows", () => {
    const campaign = createEmptyLedgerCampaign();
    const targets = chooseLedgerTargets(campaign, "chaser", 1, "target-regression");
    const targetEntries = targets.map((entryId) =>
      ledgerEntries.find((entry) => entry.id === entryId),
    );

    expect(targetEntries.every((entry) => entry && entry.unlockAt === 0)).toBe(true);
    expect(targetEntries.filter((entry) => entry?.declaredVow).length).toBeLessThanOrEqual(1);
    expect(
      new Set(targetEntries.map((entry) => entry?.requiredSteward).filter(Boolean)).size,
    ).toBeLessThanOrEqual(1);
  });

  it("can run a human-like planned game with strategy and component telemetry", () => {
    const result = runPlaytestCampaign({
      playerCount: 1,
      profile: "human",
      games: 1,
      seed: "human-planner-regression",
    });
    const game = result.games[0];

    expect(game.targetEntryIds.length).toBeGreaterThan(0);
    expect(game.boardTiles.length).toBe(game.placedTiles);
    expect(game.boardTiles.every((tile) => Number.isFinite(tile.scoreContribution))).toBe(true);
    expect(game.encounterCardIdsSeen.length).toBeGreaterThan(0);
    expect(game.strategyPlans).toHaveLength(3);
    expect(game.strategyPlans.every((plan) => plan.strategicThesis)).toBe(true);
    expect(game.strategyPlans.map((plan) => plan.forecasts.length)).toEqual([3, 3, 3]);
    expect(game.strategyPlans.map((plan) => plan.handCardsByPlayer.player_1.length)).toEqual([9, 6, 3]);
    expect(game.actionReasons.length).toBeGreaterThan(0);
    expect(game.actionReasons.some((action) => action.reasonCode === "EARLY_RESOURCE_DEFICIT")).toBe(true);
    expect(game.engineMetrics).toHaveProperty("seeded_cards_exploited");
    expect(game.errors).toEqual([]);
  }, 20_000);

  it("uses unlocked Golden content without stalling", () => {
    const campaign = createEmptyLedgerCampaign();
    for (const entry of ledgerEntries.slice(0, 12)) {
      campaign.completions[entry.id] = {
        entryId: entry.id,
        completedOnce: true,
        completedPlayerCounts: [],
      };
    }
    const result = runPlaytestCampaign({
      playerCount: 2,
      profile: "chaser",
      games: 1,
      seed: "golden-bot-regression",
      campaign,
    });
    const game = result.games[0];

    expect(countCompletedLedgerEntries(result.campaign)).toBeGreaterThanOrEqual(12);
    expect(game.selectedGoldenTileId).toBeTruthy();
    expect(game.selectedGoldenBoonId).toBeTruthy();
    expect(game.errors).toEqual([]);
  }, 20_000);
});

import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  countCompletedLedgerEntries,
  clearLedgerCampaign,
  createEmptyLedgerCampaign,
  isGoldenMilestoneUnlocked,
  readLedgerCampaign,
  writeLedgerCampaign
} from "../app/ledgerPersistence";
import { BottomDrawer } from "../components/panels/BottomDrawer";
import { evaluateStewardObjectives } from "../engine/scoring";
import { createNewGame } from "../engine/setup";
import { recordQuestGame } from "../engine/ledgerCampaign";
import type { PlacedTile } from "../engine/types";

function upgradedTile(index: number): PlacedTile {
  return {
    instanceId: `upgrade_${index}`,
    tileId: "c01_lumber_yard",
    kind: "core",
    side: "upgraded",
    hexIds: [`G${index + 1}`],
    strain: 0,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

describe("Steward's Ledger", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("derives live Steward objective progress from the game state", () => {
    const state = createNewGame(1, ["sentinel"]);
    state.map.placedTiles = Array.from({ length: 4 }, (_, index) => upgradedTile(index));

    const before = evaluateStewardObjectives(state)[0];
    expect(before.met).toBe(false);
    expect(before.progressLabel).toBe("4/5 upgraded Core Tiles");

    state.map.placedTiles.push(upgradedTile(5));
    const after = evaluateStewardObjectives(state)[0];
    expect(after.met).toBe(true);
    expect(after.current).toBe(5);
  });

  it("persists the Quest Ledger separately from the active game", () => {
    const empty = createEmptyLedgerCampaign("SEED");
    const campaign = recordQuestGame(empty, {
      id: "g1", playerCount: 1, stewardIds: ["vanguard"], finalScore: 120,
      questCardNumber: empty.deck[0], questCompleted: true
    });
    writeLedgerCampaign(campaign);

    const saved = readLedgerCampaign();
    expect(countCompletedLedgerEntries(saved)).toBe(1);
    expect(saved.box).toEqual([empty.deck[0]]);
    expect(saved.deck).toEqual(empty.deck.slice(1));

    clearLedgerCampaign();
    expect(countCompletedLedgerEntries(readLedgerCampaign())).toBe(0);
  });

  it("keeps Golden unlocks earned in the old 50-entry Ledger", () => {
    const completions = Object.fromEntries(Array.from({ length: 20 }, (_, index) => {
      const entryId = `LE-${String(index + 1).padStart(3, "0")}`;
      return [entryId, { entryId, completedOnce: true, completedPlayerCounts: [] }];
    }));
    window.localStorage.setItem("quietVale.stewardsLedger.v1", JSON.stringify({ version: 1, completions, games: [] }));
    const legacy = readLedgerCampaign();
    expect(legacy.grandfatheredGoldenMilestoneCount).toBe(4);
    expect(legacy.box).toEqual([]);
    expect(legacy.deck).toHaveLength(21);
    expect(isGoldenMilestoneUnlocked(legacy, 3, 12)).toBe(true);
    expect(isGoldenMilestoneUnlocked(legacy, 4, 15)).toBe(false);

    window.localStorage.setItem("quietVale.stewardsLedger.v1", JSON.stringify({ version: 2, pacingVersion: 2, completions: {}, games: [] }));
    expect(readLedgerCampaign().grandfatheredGoldenMilestoneCount).toBeUndefined();
  });

  it("opens the Ledger with this game's Quest Card, the cards, unlocks and log", () => {
    const state = {
      ...createNewGame(1, ["vanguard"], { questCardNumber: 3 }),
      phase: "turns" as const
    };

    const onResetLedgerCampaign = vi.fn();
    render(
      <BottomDrawer
        state={state}
        onResetLedgerCampaign={onResetLedgerCampaign}
        onTileInspect={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: /Ledger/i }));

    expect(screen.getByRole("heading", { name: "Ledger" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Quest Card 3/ })).toBeInTheDocument();
    expect(screen.getByText("Steward objectives")).toBeInTheDocument();
    expect(screen.getByText("Vanguard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Quest Cards" }));
    expect(screen.getByText("0 in the Ledger · 21 in the deck")).toBeInTheDocument();
    expect(screen.getByText("This game", { selector: ".ledger-status-chip" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Unlocks" }));
    expect(screen.getByText("The Golden Charter")).toBeInTheDocument();
    expect(screen.getByText("The Golden Signet Ring")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset Ledger Progress" }));
    expect(onResetLedgerCampaign).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("tab", { name: "Game log" }));
    expect(screen.getByText(/Game created/)).toBeInTheDocument();
  });
});

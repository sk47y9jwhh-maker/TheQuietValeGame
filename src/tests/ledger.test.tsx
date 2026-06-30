import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  countCompletedLedgerEntries,
  clearLedgerCampaign,
  createEmptyLedgerCampaign,
  readLedgerCampaign,
  writeLedgerCampaign
} from "../app/ledgerPersistence";
import { BottomDrawer } from "../components/panels/BottomDrawer";
import { ledgerChronicles, ledgerEntries, ledgerMilestones } from "../data/ledger";
import { evaluateStewardObjectives } from "../engine/scoring";
import { createNewGame } from "../engine/setup";
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

  it("contains the complete normalized campaign catalogue", () => {
    expect(ledgerEntries).toHaveLength(50);
    expect(ledgerChronicles).toHaveLength(9);
    expect(ledgerEntries.filter((entry) => entry.declaredVow)).toHaveLength(12);
    expect(ledgerMilestones.map((milestone) => milestone.threshold)).toEqual([
      5, 10, 15, 20, 30
    ]);
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

  it("persists campaign completions separately from the active game", () => {
    const campaign = createEmptyLedgerCampaign();
    campaign.completions["LE-010"] = {
      entryId: "LE-010",
      completedOnce: true,
      completedPlayerCounts: [],
      firstCompletedAt: "2026-06-29T12:00:00.000Z"
    };
    writeLedgerCampaign(campaign);

    const saved = readLedgerCampaign();
    expect(countCompletedLedgerEntries(saved)).toBe(1);
    expect(saved.completions["LE-010"].completedOnce).toBe(true);

    clearLedgerCampaign();
    expect(countCompletedLedgerEntries(readLedgerCampaign())).toBe(0);
  });

  it("opens the Ledger with game, Chronicle, unlock and log views", () => {
    const state = {
      ...createNewGame(1, ["vanguard"]),
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
    expect(screen.getByText("Steward objectives")).toBeInTheDocument();
    expect(screen.getByText("Vanguard")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Chronicles" }));
    fireEvent.click(screen.getByRole("button", { name: /Settlement Records/i }));
    expect(screen.getByText("The Vale Endures")).toBeInTheDocument();
    expect(screen.getByText("No Ash in the Record")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Unlocks" }));
    expect(screen.getByText("The Golden Charter")).toBeInTheDocument();
    expect(screen.getByText("The Golden Signet Ring")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset Ledger Progress" }));
    expect(onResetLedgerCampaign).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("tab", { name: "Game Log" }));
    expect(screen.getByText(/Game created/)).toBeInTheDocument();
  });
});

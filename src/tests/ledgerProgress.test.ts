import { describe, expect, it } from "vitest";
import { arrivals, burdens } from "../data/encounters";
import {
  createEmptyLedgerCampaign,
  countCompletedLedgerEntries
} from "../app/ledgerPersistence";
import {
  evaluateLedgerEntries,
  getLedgerRun,
  recordLedgerGame,
  trackLedgerTransition
} from "../engine/ledger";
import { revealEncounters } from "../engine/gameActions";
import { createNewGame } from "../engine/setup";

describe("Ledger game tracking", () => {
  it("carries a declared Vow into a new game and detects an initial violation", () => {
    const state = createNewGame(1, ["vanguard"], { declaredVowId: "LE-030" });

    expect(state.ledgerRun?.declaredVowId).toBe("LE-030");
    expect(state.ledgerRun?.violatedVowReasons).toContain(
      "The starting Warehouse already exceeds 8 of a resource."
    );
  });

  it("records revealed Encounter types through the central transition tracker", () => {
    const state = createNewGame(2, ["vanguard", "knight"]);
    state.phase = "reveal";
    state.encounters.deck = [arrivals[0].id, burdens[0].id];

    const next = trackLedgerTransition(state, revealEncounters(state));

    expect(next.ledgerRun?.arrivalsRevealed).toBe(1);
    expect(next.ledgerRun?.burdensRevealed).toBe(1);
  });

  it("evaluates every named entry and respects Vow eligibility", () => {
    const campaign = createEmptyLedgerCampaign();
    const state = createNewGame(1, ["vanguard"], { declaredVowId: "LE-029" });
    state.phase = "gameEnd";

    const evaluations = evaluateLedgerEntries(state, campaign);
    expect(evaluations).toHaveLength(50);
    expect(evaluations.find((evaluation) => evaluation.entry.id === "LE-029")?.eligible).toBe(true);
    expect(evaluations.find((evaluation) => evaluation.entry.id === "LE-026")?.eligible).toBe(false);
  });

  it("records a completed game once and protects campaign totals from duplicates", () => {
    const campaign = createEmptyLedgerCampaign();
    const state = createNewGame(1, ["warden"]);
    state.phase = "gameEnd";

    const first = recordLedgerGame(state, campaign);
    expect(first.campaign.games).toHaveLength(1);
    expect(getLedgerRun(first.state).recorded).toBe(true);
    expect(first.completedEntryIds.length).toBeGreaterThan(0);
    expect(countCompletedLedgerEntries(first.campaign)).toBeGreaterThan(0);

    const second = recordLedgerGame(first.state, first.campaign);
    expect(second.campaign.games).toHaveLength(1);
    expect(second.completedEntryIds).toEqual([]);
  });
});

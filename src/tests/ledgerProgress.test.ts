import { describe, expect, it } from "vitest";
import { arrivals, burdens } from "../data/encounters";
import { mapById, mapCells, mapColumns } from "../data/map";
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
import { getHexNeighbors } from "../engine/hex";
import { createNewGame } from "../engine/setup";
import type { PlacedTile } from "../engine/types";

function placedTile(
  instanceId: string,
  tileId: string,
  hexId: string,
  strain = 0
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: "core",
    side: "basic",
    hexIds: [hexId],
    strain,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

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

  it("does not complete the no-expired-Arrivals Vow when no Arrival was revealed", () => {
    const campaign = createEmptyLedgerCampaign();
    const state = createNewGame(1, ["vanguard"], { declaredVowId: "LE-029" });
    state.phase = "gameEnd";

    const entry = evaluateLedgerEntries(state, campaign).find(
      (evaluation) => evaluation.entry.id === "LE-029"
    );

    expect(entry?.eligible).toBe(true);
    expect(entry?.met).toBe(false);
  });

  it("requires non-Overstrained Travel Tiles for Good Roads, Good Trade", () => {
    const campaign = createEmptyLedgerCampaign();
    const state = createNewGame(1, ["vanguard"]);
    state.phase = "gameEnd";
    state.map.placedTiles = mapCells.slice(0, 8).map((cell, index) =>
      placedTile(`travel_${index}`, "c15_path", cell.id, index === 0 ? 3 : 0)
    );

    const before = evaluateLedgerEntries(state, campaign).find(
      (evaluation) => evaluation.entry.id === "LE-025"
    );
    state.map.placedTiles[0].strain = 2;
    const after = evaluateLedgerEntries(state, campaign).find(
      (evaluation) => evaluation.entry.id === "LE-025"
    );

    expect(before?.met).toBe(false);
    expect(after?.met).toBe(true);
  });

  it("only counts a Bridge when tiles actually meet it from both banks", () => {
    const campaign = createEmptyLedgerCampaign();
    const crossing = mapCells.find((cell) => {
      if (cell.terrain !== "water") return false;
      const bridgeCol = mapColumns.indexOf(cell.col);
      const adjacentLand = getHexNeighbors(cell.id).filter(
        (hexId) => mapById[hexId]?.terrain !== "water"
      );
      return (
        adjacentLand.some(
          (hexId) => mapColumns.indexOf(mapById[hexId].col) < bridgeCol
        ) &&
        adjacentLand.some(
          (hexId) => mapColumns.indexOf(mapById[hexId].col) > bridgeCol
        )
      );
    });
    expect(crossing).toBeDefined();
    if (!crossing) return;

    const bridgeCol = mapColumns.indexOf(crossing.col);
    const adjacentLand = getHexNeighbors(crossing.id).filter(
      (hexId) => mapById[hexId]?.terrain !== "water"
    );
    const west = adjacentLand.find(
      (hexId) => mapColumns.indexOf(mapById[hexId].col) < bridgeCol
    );
    const east = adjacentLand.find(
      (hexId) => mapColumns.indexOf(mapById[hexId].col) > bridgeCol
    );
    expect(west).toBeDefined();
    expect(east).toBeDefined();
    if (!west || !east) return;

    const state = createNewGame(1, ["vanguard"]);
    state.phase = "gameEnd";
    state.map.placedTiles = [
      placedTile("bridge", "c19_bridge", crossing.id),
      placedTile("distant_west", "c15_path", "A1"),
      placedTile("distant_east", "c15_path", "N9")
    ];
    const disconnected = evaluateLedgerEntries(state, campaign).find(
      (evaluation) => evaluation.entry.id === "LE-010"
    );

    state.map.placedTiles[1].hexIds = [west];
    state.map.placedTiles[2].hexIds = [east];
    const connected = evaluateLedgerEntries(state, campaign).find(
      (evaluation) => evaluation.entry.id === "LE-010"
    );

    expect(disconnected?.met).toBe(false);
    expect(connected?.met).toBe(true);
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

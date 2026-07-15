import { describe, expect, it } from "vitest";
import { arrivals, burdens } from "../data/encounters";
import { mapById, mapCells, mapColumns } from "../data/map";
import { specialTiles } from "../data/tiles";
import { createEmptyLedgerCampaign, countCompletedLedgerEntries } from "../app/ledgerPersistence";
import { evaluateLedgerEntries, getLedgerRun, recordLedgerGame, trackLedgerTransition } from "../engine/ledger";
import { revealEncounters } from "../engine/gameActions";
import { getHexNeighbors } from "../engine/hex";
import { createNewGame } from "../engine/setup";
import type { GameState, PlacedTile } from "../engine/types";

function placedTile(instanceId: string, tileId: string, hexId: string, strain = 0, side: "basic" | "upgraded" | "special" = "basic"): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: side === "special" ? "special" : "core",
    side,
    hexIds: [hexId],
    strain,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

function campaignWithEntries(count: number) {
  const campaign = createEmptyLedgerCampaign();
  for (let index = 1; index <= count; index += 1) {
    const entryId = `test-${index}`;
    campaign.completions[entryId] = {
      entryId,
      completedOnce: true,
      completedPlayerCounts: []
    };
  }
  return campaign;
}

function endGame(state: GameState): GameState {
  return { ...state, phase: "gameEnd" };
}

describe("v4.6 Ledger game tracking", () => {
  it.each([1, 2] as const)("rejects the Small Storehouse Vow at %ip", (playerCount) => {
    const stewardIds = ["vanguard", "knight"].slice(0, playerCount);
    const state = createNewGame(playerCount, stewardIds, { declaredVowId: "LE-043" });
    expect(state.ledgerRun?.declaredVowId).toBeUndefined();
    expect(state.ledgerRun?.violatedVowReasons).toEqual([]);
  });

  it.each([3, 4] as const)("allows the Small Storehouse Vow at %ip", (playerCount) => {
    const stewardIds = ["vanguard", "knight", "sentinel", "ranger"].slice(0, playerCount);
    const state = createNewGame(playerCount, stewardIds, { declaredVowId: "LE-043" });
    expect(state.ledgerRun?.declaredVowId).toBe("LE-043");
    expect(state.ledgerRun?.violatedVowReasons).toEqual([]);
  });

  it("records revealed Encounter types and their Season", () => {
    const state = createNewGame(2, ["vanguard", "knight"]);
    state.phase = "reveal";
    state.encounters.deck = [arrivals[0].id, burdens[0].id];
    const next = trackLedgerTransition(state, revealEncounters(state));
    expect(next.ledgerRun?.arrivalsRevealed).toBe(1);
    expect(next.ledgerRun?.burdensRevealed).toBe(1);
    expect(next.ledgerRun?.burdensRevealedBySeason[1]).toBe(1);
  });

  it("evaluates all 50 entries and only enables the declared Vow", () => {
    const campaign = campaignWithEntries(40);
    const state = endGame(createNewGame(1, ["vanguard"], { declaredVowId: "LE-041" }));
    const evaluations = evaluateLedgerEntries(state, campaign);
    expect(evaluations).toHaveLength(50);
    expect(evaluations.find((entry) => entry.entry.id === "LE-041")?.eligible).toBe(true);
    expect(evaluations.find((entry) => entry.entry.id === "LE-042")?.eligible).toBe(false);
  });

  it("applies the v4.6 No Gift Left Waiting allowance to pre-Round-12 rewards", () => {
    const state = endGame(createNewGame(1, ["vanguard"]));
    const rewardIds = specialTiles.slice(0, 5).map((tile) => tile.id);
    state.map.placedTiles = rewardIds.slice(0, 2).map((tileId, index) =>
      placedTile(`special-${index}`, tileId, mapCells[index].id, 0, "special")
    );
    state.ledgerRun!.arrivalCompletionEvents = [{
      cardId: arrivals[0].id,
      round: 6,
      season: 2,
      specialTileIds: rewardIds.slice(0, 4)
    }];
    const allowed = evaluateLedgerEntries(state, createEmptyLedgerCampaign()).find((entry) => entry.entry.id === "LE-022");
    state.ledgerRun!.arrivalCompletionEvents[0].specialTileIds = rewardIds;
    const tooMany = evaluateLedgerEntries(state, createEmptyLedgerCampaign()).find((entry) => entry.entry.id === "LE-022");
    expect(allowed?.met).toBe(true);
    expect(tooMany?.met).toBe(false);
  });

  it("requires a same-round Burden answer in every Season", () => {
    const state = endGame(createNewGame(1, ["warden"]));
    state.ledgerRun!.burdenRevealEvents = [1, 2, 3].map((season) => ({ cardId: `burden-${season}`, round: (season - 1) * 4 + 1, season: season as 1 | 2 | 3 }));
    state.ledgerRun!.burdenResolutionEvents = [1, 2, 3].map((season) => ({ cardId: `burden-${season}`, round: (season - 1) * 4 + 1, season: season as 1 | 2 | 3 }));
    const complete = evaluateLedgerEntries(state, createEmptyLedgerCampaign()).find((entry) => entry.entry.id === "LE-025");
    state.ledgerRun!.burdenResolutionEvents[2].round += 1;
    const late = evaluateLedgerEntries(state, createEmptyLedgerCampaign()).find((entry) => entry.entry.id === "LE-025");
    expect(complete?.met).toBe(true);
    expect(late?.met).toBe(false);
  });

  it("checks The Market Track against one physical Track instance", () => {
    const state = endGame(createNewGame(1, ["vanguard"]));
    const neighbors = getHexNeighbors("G5");
    state.map.placedTiles = [
      placedTile("track", "c17_track", "G5"),
      placedTile("craft-1", "c13_workshops", neighbors[0]),
      placedTile("craft-2", "c13_workshops", neighbors[1]),
      placedTile("merchant-1", "c14_market_stalls", neighbors[2]),
      placedTile("merchant-2", "c14_market_stalls", neighbors[3])
    ];
    const complete = evaluateLedgerEntries(state, campaignWithEntries(10)).find((entry) => entry.entry.id === "LE-032");
    state.map.placedTiles[4].hexIds = ["A1"];
    const split = evaluateLedgerEntries(state, campaignWithEntries(10)).find((entry) => entry.entry.id === "LE-032");
    expect(complete?.met).toBe(true);
    expect(split?.met).toBe(false);
  });

  it("breaks No Fine Work when any source upgrades a Core Tile", () => {
    const previous = createNewGame(1, ["knight"], { declaredVowId: "LE-042" });
    previous.map.placedTiles = [placedTile("yard", "c01_lumber_yard", "G5")];
    const next = structuredClone(previous);
    next.map.placedTiles[0].side = "upgraded";
    const tracked = trackLedgerTransition(previous, next);
    expect(tracked.ledgerRun?.violatedVowReasons).toContain("A Core Tile was upgraded.");
  });

  it("records three Strain removed across two categories in one round", () => {
    const previous = createNewGame(1, ["warden"]);
    previous.map.placedTiles = [
      placedTile("yard", "c01_lumber_yard", "G5", 2),
      placedTile("cabin", "c05_cabin", "G6", 2)
    ];
    const next = structuredClone(previous);
    next.map.placedTiles[0].strain = 0;
    next.map.placedTiles[1].strain = 1;
    const tracked = endGame(trackLedgerTransition(previous, next));
    const entry = evaluateLedgerEntries(tracked, campaignWithEntries(10)).find((evaluation) => evaluation.entry.id === "LE-030");
    expect(entry?.met).toBe(true);
  });

  it("only counts a Bridge when tiles actually meet it from both banks", () => {
    const campaign = createEmptyLedgerCampaign();
    const crossing = mapCells.find((cell) => {
      if (cell.terrain !== "water") return false;
      const bridgeCol = mapColumns.indexOf(cell.col);
      const adjacentLand = getHexNeighbors(cell.id).filter((hexId) => mapById[hexId]?.terrain !== "water");
      return adjacentLand.some((hexId) => mapColumns.indexOf(mapById[hexId].col) < bridgeCol) && adjacentLand.some((hexId) => mapColumns.indexOf(mapById[hexId].col) > bridgeCol);
    });
    expect(crossing).toBeDefined();
    if (!crossing) return;
    const bridgeCol = mapColumns.indexOf(crossing.col);
    const adjacentLand = getHexNeighbors(crossing.id).filter((hexId) => mapById[hexId]?.terrain !== "water");
    const west = adjacentLand.find((hexId) => mapColumns.indexOf(mapById[hexId].col) < bridgeCol)!;
    const east = adjacentLand.find((hexId) => mapColumns.indexOf(mapById[hexId].col) > bridgeCol)!;
    const state = endGame(createNewGame(1, ["vanguard"]));
    state.map.placedTiles = [
      placedTile("bridge", "c19_bridge", crossing.id),
      placedTile("west", "c15_path", "A1"),
      placedTile("east", "c15_path", "N9")
    ];
    expect(evaluateLedgerEntries(state, campaign).find((entry) => entry.entry.id === "LE-015")?.met).toBe(false);
    state.map.placedTiles[1].hexIds = [west];
    state.map.placedTiles[2].hexIds = [east];
    expect(evaluateLedgerEntries(state, campaign).find((entry) => entry.entry.id === "LE-015")?.met).toBe(true);
  });

  it("records a completed game once and protects campaign totals from duplicates", () => {
    const campaign = createEmptyLedgerCampaign();
    const state = endGame(createNewGame(1, ["warden"]));
    state.ledgerRun!.burdensResolved = 2;
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

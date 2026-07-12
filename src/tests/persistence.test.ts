import { beforeEach, describe, expect, it } from "vitest";
import {
  createEmptyLedgerCampaign,
  readLedgerCampaign
} from "../app/ledgerPersistence";
import { readSavedGame, writeSavedGame } from "../app/persistence";
import { createNewGame } from "../engine/setup";

describe("browser persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores a well-formed active game save", () => {
    const state = createNewGame(1, ["vanguard"]);
    writeSavedGame({
      playerCount: 1,
      stewardIds: ["vanguard"],
      encounterSeed: "QV-STABLE",
      state
    });

    expect(readSavedGame()?.state.currentPlayerId).toBe("player_1");
  });

  it("normalizes version 1 saves before the current rule state existed", () => {
    const state = createNewGame(1, ["vanguard"]);
    const legacyState = structuredClone(state) as unknown as Record<string, unknown>;
    delete legacyState.boonModifiers;
    delete legacyState.ignoredBurdenIdsThisRound;
    delete legacyState.tileActivationRecords;
    delete legacyState.pendingEffects;
    delete legacyState.pendingDeckReorder;
    delete legacyState.pendingCostChoice;
    const legacyPlayer = (legacyState.players as Array<Record<string, unknown>>)[0];
    delete legacyPlayer.hasPlacedFirstTile;
    delete legacyPlayer.stewardPowerUsesBySeason;

    window.localStorage.setItem(
      "quietVale.activeGame.v1",
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        playerCount: 1,
        stewardIds: ["vanguard"],
        encounterSeed: "QV-LEGACY",
        state: legacyState
      })
    );

    const restored = readSavedGame()?.state;
    expect(restored?.players[0].hasPlacedFirstTile).toBe(false);
    expect(restored?.players[0].stewardPowerUsesBySeason).toEqual({
      1: 0,
      2: 0,
      3: 0
    });
    expect(restored?.boonModifiers).toEqual([]);
    expect(restored?.ignoredBurdenIdsThisRound).toEqual([]);
    expect(restored?.tileActivationRecords).toEqual({});
    expect(restored?.pendingEffects).toEqual([]);
    expect(restored?.pendingDeckReorder).toBeNull();
    expect(restored?.pendingCostChoice).toBeNull();
  });

  it("ignores a corrupt active game save instead of restoring a broken state", () => {
    window.localStorage.setItem(
      "quietVale.activeGame.v1",
      JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        playerCount: 1,
        stewardIds: ["vanguard"],
        encounterSeed: "QV-BAD",
        state: {}
      })
    );

    expect(readSavedGame()).toBeNull();
  });

  it("falls back to an empty Ledger campaign when the saved campaign shape is invalid", () => {
    window.localStorage.setItem(
      "quietVale.stewardsLedger.v1",
      JSON.stringify({
        version: 2,
        catalogueVersion: "v4.6",
        completions: "not-a-completion-record",
        games: []
      })
    );

    expect(readLedgerCampaign()).toEqual(createEmptyLedgerCampaign());
  });

  it("rejects malformed nested Ledger records even when the campaign shell is valid", () => {
    window.localStorage.setItem(
      "quietVale.stewardsLedger.v1",
      JSON.stringify({
        version: 2,
        catalogueVersion: "v4.6",
        pacingVersion: 2,
        completions: { "LE-001": null },
        games: []
      })
    );

    expect(readLedgerCampaign()).toEqual(createEmptyLedgerCampaign());
  });
});

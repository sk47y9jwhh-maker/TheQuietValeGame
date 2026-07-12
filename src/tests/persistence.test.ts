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

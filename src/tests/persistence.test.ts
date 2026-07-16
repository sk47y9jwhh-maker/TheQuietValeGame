import { beforeEach, describe, expect, it } from "vitest";
import {
  createEmptyLedgerCampaign,
  readLedgerCampaign
} from "../app/ledgerPersistence";
import { readSavedGame, writeSavedGame } from "../app/persistence";
import { createNewGame } from "../engine/setup";
import { drawTargetCard } from "../engine/targetCards";

describe("browser persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores a well-formed active game save", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.tileActivationRecords.farm_1 = { linkedProductionRound: 4 };
    writeSavedGame({
      playerCount: 1,
      stewardIds: ["vanguard"],
      encounterSeed: "QV-STABLE",
      state
    });

    expect(readSavedGame()?.state.currentPlayerId).toBe("player_1");
    expect(
      readSavedGame()?.state.tileActivationRecords.farm_1.linkedProductionRound
    ).toBe(4);
  });

  it("defaults missing activation records when restoring a legacy save", () => {
    const state = createNewGame(1, ["vanguard"]);
    const legacyState = { ...state } as Partial<typeof state>;
    delete legacyState.tileActivationRecords;

    window.localStorage.setItem(
      "quietVale.activeGame.v1",
      JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        playerCount: 1,
        stewardIds: ["vanguard"],
        encounterSeed: "QV-LEGACY-ACTIVATIONS",
        state: legacyState
      })
    );

    expect(readSavedGame()?.state.tileActivationRecords).toEqual({});
  });

  it("adds the third Resource Tile copy when restoring an older active game", () => {
    const state = createNewGame(1, ["vanguard"]);
    const resourceTileIds = [
      "c01_lumber_yard",
      "c02_mine_tunnel",
      "c03_gathering_outpost",
      "c04_farmstead",
      "c20_dig_site"
    ];
    for (const tileId of resourceTileIds) {
      state.tileSupply.core[tileId] = 2;
    }

    window.localStorage.setItem(
      "quietVale.activeGame.v1",
      JSON.stringify({
        version: 2,
        savedAt: new Date().toISOString(),
        playerCount: 1,
        stewardIds: ["vanguard"],
        encounterSeed: "QV-RESOURCE-STOCK",
        state
      })
    );

    const restored = readSavedGame();

    expect(restored?.version).toBe(4);
    expect(
      resourceTileIds.map((tileId) => restored?.state.tileSupply.core[tileId])
    ).toEqual([3, 3, 3, 3, 3]);
  });

  it("adds the standard Target Deck when restoring a legacy save", () => {
    const state = createNewGame(1, ["vanguard"]);
    delete (state as Partial<typeof state>).targetCards;

    window.localStorage.setItem(
      "quietVale.activeGame.v1",
      JSON.stringify({
        version: 3,
        savedAt: new Date().toISOString(),
        playerCount: 1,
        stewardIds: ["vanguard"],
        encounterSeed: "QV-LEGACY-TARGETS",
        state
      })
    );

    const restored = readSavedGame();
    expect(restored?.state.targetCards.drawPile).toHaveLength(24);
    expect(restored?.state.targetCards).not.toHaveProperty("enabled");
  });

  it("persists the standard Target Deck and its deterministic draw state", () => {
    const state = createNewGame(1, ["vanguard"], {
      encounterSeed: "QV-SAVED-TARGETS"
    });
    const first = drawTargetCard(state.targetCards);
    const second = drawTargetCard(first.deckState);
    state.targetCards = second.deckState;

    writeSavedGame({
      playerCount: 1,
      stewardIds: ["vanguard"],
      encounterSeed: "QV-SAVED-TARGETS",
      state
    });

    const restored = readSavedGame();
    expect(restored?.state.targetCards.drawCount).toBe(2);
    expect(restored?.state.targetCards.drawPile).toEqual(state.targetCards.drawPile);
    expect(restored?.state.targetCards).not.toHaveProperty("enabled");
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

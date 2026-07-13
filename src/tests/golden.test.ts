import { describe, expect, it } from "vitest";
import { goldenBoons } from "../data/encounters";
import { systemEffectRuleId } from "../data/effectRules";
import { ledgerMilestones } from "../data/ledger";
import { goldenTiles } from "../data/tiles";
import {
  endCurrentTurn,
  placeTile,
  revealEncounters,
  useFaceUpBoon
} from "../engine/gameActions";
import {
  placeGoldenTileForSetup,
  resolveGoldenBell,
  resolveGoldenScroll,
  resolveGoldenSignet,
  validateGoldenSignetPlacements
} from "../engine/golden";
import { getPassiveCostOptions } from "../engine/passiveCosts";
import { resolvePendingEffect } from "../engine/manualEffects";
import { calculateFinalScore } from "../engine/scoring";
import { createNewGame } from "../engine/setup";
import { applyStrainToState } from "../engine/strainRules";
import { recalculatePassiveSupported } from "../engine/supportRules";
import type { GameState, PlacedTile } from "../engine/types";

function placed(
  instanceId: string,
  tileId: string,
  hexId: string,
  kind: PlacedTile["kind"] = "core"
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind,
    side: kind === "core" ? "basic" : "special",
    hexIds: [hexId],
    strain: 0,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

describe("Golden Legacy", () => {
  it("defines all five redesigned Golden pairs with stable IDs", () => {
    expect(goldenTiles).toHaveLength(5);
    expect(goldenBoons).toHaveLength(5);
    expect(ledgerMilestones.map((milestone) => milestone.goldenTileId)).toEqual(
      goldenTiles.map((tile) => tile.id)
    );
    expect(ledgerMilestones.map((milestone) => milestone.goldenBoonId)).toEqual(
      goldenBoons.map((boon) => boon.id)
    );
  });

  it("keeps a selected Golden Boon out of hands and shuffles it into the deck", () => {
    const state = createNewGame(1, ["vanguard"], {
      encounterSeed: "QV-GOLDEN-SETUP",
      selectedGoldenBoonId: goldenBoons[0].id
    });

    expect(Object.values(state.encounters.handsByPlayerId).flat()).not.toContain(goldenBoons[0].id);
    expect(state.encounters.deck).toContain(goldenBoons[0].id);
    expect(state.encounters.reserveArrivalIds.length).toBeGreaterThan(3);
    expect(state.encounters.reserveBoonIds.length).toBeGreaterThan(0);
  });

  it("places a selected Golden Tile during setup without spending actions or moving the Steward", () => {
    const state = createNewGame(1, ["vanguard"], {
      selectedGoldenTileId: goldenTiles[0].id
    });
    state.phase = "goldenSetup";
    const legalHexId = "A1";
    const next = placeGoldenTileForSetup(state, legalHexId);

    expect(next.phase).toBe("seeding");
    expect(next.actionsRemaining).toBe(4);
    expect(next.players[0].stewardHexId).toBe(state.players[0].stewardHexId);
    expect(next.players[0].hasPlacedFirstTile).toBe(false);
    expect(next.map.placedTiles[0].tileId).toBe(goldenTiles[0].id);
  });

  it("makes Golden Boons bonus reveals and resolves The Golden Bell", () => {
    const state = createNewGame(1, ["vanguard"]);
    const bell = goldenBoons[0].id;
    const standardCardId = state.encounters.deck[0];
    state.phase = "reveal";
    state.encounters.deck = [bell, standardCardId, ...state.encounters.deck.slice(1)];

    const revealed = revealEncounters(state);
    expect(revealed.pendingGoldenEffect?.kind).toBe("bell");
    expect(revealed.encounters.deck.length).toBe(state.encounters.deck.length - 2);

    const arrivalId = revealed.pendingGoldenEffect?.kind === "bell"
      ? revealed.pendingGoldenEffect.arrivalCardIds[0]
      : "";
    const completed = resolveGoldenBell(revealed, arrivalId);
    expect(completed.pendingGoldenEffect).toBeNull();
    expect(completed.encounters.completedArrivals.some((arrival) => arrival.cardId === arrivalId)).toBe(true);
    expect(completed.log[0].message).toMatch(/The Golden Bell completed/);
  });

  it("lets each player optionally exchange a hidden card through The Golden Scroll", () => {
    const state = createNewGame(2, ["vanguard", "knight"]);
    const returnedCardId = state.encounters.handsByPlayerId.player_1[0];
    const replacementId = state.encounters.reserveBoonIds[0];
    state.pendingGoldenEffect = {
      kind: "scroll",
      cardId: "golden_boon_the_golden_scroll"
    };

    const next = resolveGoldenScroll(state, { player_1: returnedCardId });
    expect(next.encounters.handsByPlayerId.player_1).toContain(replacementId);
    expect(next.encounters.handsByPlayerId.player_1).not.toContain(returnedCardId);
    expect(next.pendingGoldenEffect).toBeNull();
  });

  it("runs a complete bonus-turn cycle for The Golden-Eyed Traveller", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.phase = "reveal";
    state.encounters.deck = [
      "golden_boon_the_golden_eyed_traveler",
      state.encounters.deck[0],
      ...state.encounters.deck.slice(1)
    ];
    const revealed = revealEncounters(state);
    expect(revealed.bonusTurnsPending).toBe(true);
    revealed.pendingEffects = [];

    const bonusTurn = endCurrentTurn(revealed);
    expect(bonusTurn.phase).toBe("turns");
    expect(bonusTurn.bonusTurnsActive).toBe(true);
    expect(bonusTurn.actionsRemaining).toBe(4);

    const roundEnd = endCurrentTurn(bonusTurn);
    expect(roundEnd.phase).toBe("endRound");
    expect(roundEnd.bonusTurnsActive).toBe(false);
  });

  it("prepares exactly one zero-action Path placement per round with The Golden Vial", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.phase = "turns";
    state.encounters.faceUpBoons = [{
      cardId: "golden_boon_the_golden_vial",
      remainingUses: 1
    }];

    const prepared = useFaceUpBoon(state, "golden_boon_the_golden_vial");
    const placedPath = placeTile(prepared, "player_1", "c15_path", state.players[0].stewardHexId);
    expect(placedPath.actionsRemaining).toBe(4);
    expect(placedPath.boonModifiers).toHaveLength(0);
    expect(
      placedPath.encounters.faceUpBoons[0].lastUsedRound
    ).toBe(state.round);
  });

  it("applies Golden Tile passives for cost, support, and Strain prevention", () => {
    const base = createNewGame(1, ["vanguard"]);
    base.phase = "turns";
    base.map.placedTiles = [
      placed("charter", "golden_tile_the_golden_charter", "G1", "special"),
      placed("hearth", "golden_tile_the_golden_hearth", "J1", "special"),
      placed("garden", "golden_tile_the_golden_garden", "M1", "special"),
      placed("home", "c05_cabin", "K1"),
      placed("target", "c15_path", "N1")
    ];

    const options = getPassiveCostOptions(base, {
      action: "place",
      playerId: "player_1",
      category: "housing",
      kind: "core",
      placementHexIds: ["H1"],
      cost: { wood: 1, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 }
    });
    expect(options.some((option) => option.sourceTileId === "charter" && option.required)).toBe(true);

    const supported = recalculatePassiveSupported(base);
    expect(supported.map.placedTiles.find((tile) => tile.instanceId === "home")?.support.passive).toBe(true);

    const first = applyStrainToState(base, "target", 1);
    expect(first.map.placedTiles.find((tile) => tile.instanceId === "target")?.strain).toBe(0);
    const second = applyStrainToState(first, "target", 1);
    expect(second.map.placedTiles.find((tile) => tile.instanceId === "target")?.strain).toBe(1);
  });

  it("checks Golden Garden prevention before continuing an Overstrain chain", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.phase = "turns";
    state.round = 4;
    const source = placed("source", "c15_path", "G1");
    source.strain = 2;
    const target = placed("target", "c15_path", "H1");
    target.strain = 2;
    state.map.placedTiles = [
      source,
      target,
      placed("garden", "golden_tile_the_golden_garden", "I1", "special")
    ];
    state.pendingEffects = [{
      id: "effect_garden_chain",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Test",
      title: "Place Strain",
      effectText: "Display text only",
      requiresManualChoice: true
    }];

    const chainReady = resolvePendingEffect(state, {
      tileStrainDeltas: { source: 1 }
    });
    expect(chainReady.map.placedTiles.find((tile) => tile.instanceId === "source")?.strain)
      .toBe(3);
    expect(chainReady.pendingEffects[0].ruleId).toBe(
      systemEffectRuleId("overstrain-spread")
    );

    const prevented = resolvePendingEffect(chainReady, {
      tileStrainDeltas: { target: 1 }
    });
    expect(prevented.map.placedTiles.find((tile) => tile.instanceId === "target")?.strain)
      .toBe(2);
    expect(prevented.tileActivationRecords.garden?.round).toBe(4);
    expect(prevented.pendingEffects).toHaveLength(0);
  });

  it("repositions tiles and their Steward tokens with The Golden Signet Ring", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [placed("path", "c15_path", "G1")];
    state.players[0].stewardHexId = "G1";
    state.pendingGoldenEffect = {
      kind: "signet",
      cardId: "golden_boon_the_golden_signet_ring"
    };
    const placements = [{ placedTileId: "path", placement: { anchorHexId: "H1" } }];

    expect(validateGoldenSignetPlacements(state, placements).ok).toBe(true);
    const next = resolveGoldenSignet(state, placements);
    expect(next.map.placedTiles[0].hexIds).toEqual(["H1"]);
    expect(next.players[0].stewardHexId).toBe("H1");
  });

  it("scores The Golden Charter for four adjacent tile categories", () => {
    const state = createNewGame(1, ["vanguard"]);
    state.map.placedTiles = [
      placed("charter", "golden_tile_the_golden_charter", "G5", "special"),
      placed("resource", "c01_lumber_yard", "F4"),
      placed("housing", "c05_cabin", "F5"),
      placed("crafting", "c13_workshops", "G4"),
      placed("merchant", "c14_market_stalls", "G6")
    ];

    expect(calculateFinalScore(state).goldenRenown).toBe(5);
  });

  it("scores The Golden Hearth, Cairn, and Garden from their end-game layouts", () => {
    const hearth = createNewGame(1, ["vanguard"]);
    hearth.map.placedTiles = [
      placed("hearth", "golden_tile_the_golden_hearth", "G5", "special"),
      ...["F4", "F5", "G4", "G6", "H4", "H5"].map((hexId, index) =>
        placed(`ring-${index}`, "c15_path", hexId)
      )
    ];
    expect(calculateFinalScore(hearth).goldenRenown).toBe(5);

    const cairn = createNewGame(1, ["vanguard"]);
    cairn.map.placedTiles = [
      placed("cairn", "golden_tile_the_golden_cairn", "A1", "special"),
      placed("woodland", "c01_lumber_yard", "G1"),
      placed("heaths", "c03_gathering_outpost", "A3"),
      placed("arable", "c04_farmstead", "L1")
    ];
    expect(calculateFinalScore(cairn).goldenRenown).toBe(5);

    const garden = createNewGame(1, ["vanguard"]);
    garden.map.placedTiles = [
      placed("garden", "golden_tile_the_golden_garden", "G1", "special"),
      placed("settlement", "c05_cabin", "H1")
    ];
    expect(calculateFinalScore(garden).goldenRenown).toBe(5);
    garden.map.placedTiles[1].strain = 3;
    expect(calculateFinalScore(garden).goldenRenown).toBe(0);
  });
});

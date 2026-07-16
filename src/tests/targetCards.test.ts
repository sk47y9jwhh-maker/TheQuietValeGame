import { describe, expect, it } from "vitest";
import { targetCardById, targetCards } from "../data/targetCards";
import { cardEffectRuleId, systemEffectRuleId } from "../data/effectRules";
import {
  preparePendingEffectQueueHead,
  resolvePendingEffect
} from "../engine/manualEffects";
import { createNewGame } from "../engine/setup";
import {
  countAdjacentPlacedTiles,
  createTargetCardDeckState,
  drawTargetCard,
  normalizeTargetCardDeckState,
  selectTargetWithCard
} from "../engine/targetCards";
import type {
  GameState,
  PlacedTile,
  TargetCardDefinition
} from "../engine/types";

function placed(
  instanceId: string,
  tileId: string,
  hexIds: string | string[],
  options: {
    strain?: number;
    side?: PlacedTile["side"];
    kind?: PlacedTile["kind"];
    supported?: boolean;
  } = {}
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: options.kind ?? "core",
    side: options.side ?? "basic",
    hexIds: Array.isArray(hexIds) ? hexIds : [hexIds],
    strain: options.strain ?? 0,
    support: {
      passive: false,
      singleUse: options.supported ?? false,
      preventedThisRound: false
    }
  };
}

function experimentalState(tiles: PlacedTile[], cardOrder?: number[]): GameState {
  const state = createNewGame(1, ["vanguard"], {
    encounterSeed: "TARGET-CARD-TEST",
    experimentalTargetCards: true
  });
  state.map.placedTiles = tiles;
  if (cardOrder) {
    state.targetCards = {
      ...createTargetCardDeckState(true, "TARGET-CARD-TEST"),
      drawPile: [
        ...cardOrder,
        ...targetCards
          .map((card) => card.id)
          .filter((id) => !cardOrder.includes(id))
      ]
    };
  }
  return state;
}

function pendingBurden(
  state: GameState,
  cardId: string,
  season: 1 | 2 | 3
): GameState {
  state.season = season;
  state.pendingEffects = [{
    id: `effect_${cardId}_${season}`,
    ruleId: cardEffectRuleId(cardId, season),
    sourceType: "card",
    sourceId: cardId,
    sourceName: cardId,
    title: cardId,
    effectText: "Test effect",
    requiresManualChoice: true
  }];
  return preparePendingEffectQueueHead(state);
}

describe("experimental Target Cards", () => {
  it("contains the locked 24-card opposite-arrow distribution", () => {
    expect(targetCards).toEqual([
      { id: 1, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "strained", direction: "NE" },
      { id: 2, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "unstrained", direction: "SW" },
      { id: 3, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "strained", direction: "E" },
      { id: 4, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "unstrained", direction: "W" },
      { id: 5, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "strained", direction: "SE" },
      { id: 6, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "unstrained", direction: "NW" },
      { id: 7, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "strained", direction: "SW" },
      { id: 8, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "unstrained", direction: "NE" },
      { id: 9, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "strained", direction: "W" },
      { id: 10, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "unstrained", direction: "E" },
      { id: 11, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "strained", direction: "NW" },
      { id: 12, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "unstrained", direction: "SE" },
      { id: 13, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "strained", direction: "SW" },
      { id: 14, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "unstrained", direction: "NE" },
      { id: 15, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "strained", direction: "W" },
      { id: 16, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "unstrained", direction: "E" },
      { id: 17, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "strained", direction: "NW" },
      { id: 18, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "unstrained", direction: "SE" },
      { id: 19, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "strained", direction: "NE" },
      { id: 20, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "unstrained", direction: "SW" },
      { id: 21, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "strained", direction: "E" },
      { id: 22, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "unstrained", direction: "W" },
      { id: 23, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "strained", direction: "SE" },
      { id: 24, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "unstrained", direction: "NW" }
    ]);
    expect(new Set(targetCards.map((card) => card.id)).size).toBe(24);
    expect(targetCards.filter((card) => card.tileClass === "core")).toHaveLength(16);
    expect(targetCards.filter((card) => card.tileClass === "specialOrGolden")).toHaveLength(8);
    expect(targetCards.filter((card) => card.side === "basic")).toHaveLength(8);
    expect(targetCards.filter((card) => card.side === "upgraded")).toHaveLength(8);
    expect(targetCards.filter((card) => card.side === "either")).toHaveLength(8);
    expect(targetCards.filter((card) => card.adjacency === "threePlus")).toHaveLength(12);
    expect(targetCards.filter((card) => card.adjacency === "zeroToTwo")).toHaveLength(12);
    expect(targetCards.filter((card) => card.strain === "strained")).toHaveLength(12);
    expect(targetCards.filter((card) => card.strain === "unstrained")).toHaveLength(12);
    for (const direction of ["NE", "E", "SE", "SW", "W", "NW"] as const) {
      const directionalCards = targetCards.filter(
        (card) => card.direction === direction
      );
      expect(directionalCards).toHaveLength(4);
      expect(new Set(directionalCards.map((card) => card.strain))).toEqual(
        new Set(["strained", "unstrained"])
      );
    }
    const opposite = {
      NE: "SW",
      E: "W",
      SE: "NW",
      SW: "NE",
      W: "E",
      NW: "SE"
    } as const;
    for (let index = 0; index < 12; index += 1) {
      const original = targetCards[index];
      const partner = targetCards[index + 12];
      expect({ ...partner, id: original.id, direction: original.direction }).toEqual(
        original
      );
      expect(partner.direction).toBe(opposite[original.direction]);
    }
  });

  it("returns every draw to the bottom without reshuffling", () => {
    let deck = createTargetCardDeckState(true, "CONTINUOUS-DECK");
    const startingOrder = [...deck.drawPile];
    const firstCycle: number[] = [];
    for (let index = 0; index < 24; index += 1) {
      const drawn = drawTargetCard(deck);
      deck = drawn.deckState;
      firstCycle.push(drawn.card.id);
    }
    expect(new Set(firstCycle)).toEqual(new Set(targetCards.map((card) => card.id)));
    expect(deck.drawPile).toEqual(startingOrder);
    const twentyFifth = drawTargetCard(deck);
    expect(twentyFifth.card.id).toBe(firstCycle[0]);
    expect(twentyFifth.deckState.drawPile).toHaveLength(24);
    expect(twentyFifth.deckState.drawPile.at(-1)).toBe(firstCycle[0]);
    expect(twentyFifth.deckState.drawCount).toBe(25);
  });

  it("migrates the old draw and discard piles into one 24-card queue", () => {
    const legacy = {
      ...createTargetCardDeckState(true, "LEGACY-DECK"),
      drawPile: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      discardPile: [1, 2],
      drawCount: 2,
      reshuffleCount: 1
    };
    const migrated = normalizeTargetCardDeckState(legacy);

    expect(migrated.drawPile).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2,
      13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
    ]);
    expect(migrated).not.toHaveProperty("discardPile");
    expect(migrated.drawCount).toBe(2);
    expect(migrated).not.toHaveProperty("reshuffleCount");
  });

  it("narrows sequentially and never restores an eliminated candidate", () => {
    const tiles = [
      placed("basic", "c15_path", "A1"),
      placed("upgraded", "c15_path", "B1", { side: "upgraded", strain: 1 }),
      placed("special", "special_alms_house", "C1", {
        kind: "special",
        side: "special",
        strain: 1
      })
    ];
    const state = experimentalState(tiles);
    const selected = selectTargetWithCard(state, tiles, targetCardById[1], {
      effectId: "sequential"
    });

    expect(selected?.tile.instanceId).toBe("basic");
    expect(selected?.diagnostic.filters.map((filter) => ({
      filter: filter.filter,
      applied: filter.applied,
      after: filter.afterCount
    }))).toEqual([
      { filter: "class", applied: true, after: 2 },
      { filter: "side", applied: true, after: 1 },
      { filter: "adjacency", applied: false, after: 1 },
      { filter: "strain", applied: false, after: 1 }
    ]);
  });

  it("counts distinct adjacent tiles across an entire multi-hex footprint", () => {
    const centre = placed("centre", "c15_path", ["G1", "G2"]);
    const neighbor = placed("neighbor", "c05_cabin", ["H1", "H2"]);
    const other = placed("other", "c13_workshops", "F2");
    const state = experimentalState([centre, neighbor, other]);

    expect(countAdjacentPlacedTiles(state, centre)).toBe(2);
  });

  it("uses the furthest footprint extent and logs exact coordinate fallback", () => {
    const eastFootprint = placed("east", "c15_path", ["B1", "F1"]);
    const westFootprint = placed("west", "c05_cabin", "E1");
    const eastCard: TargetCardDefinition = {
      ...targetCardById[10],
      tileClass: "core"
    };
    const extentSelection = selectTargetWithCard(
      experimentalState([eastFootprint, westFootprint]),
      [eastFootprint, westFootprint],
      eastCard,
      { effectId: "extent" }
    );
    expect(extentSelection?.tile.instanceId).toBe("east");
    expect(extentSelection?.diagnostic.directionRequired).toBe(true);

    const upper = placed("upper", "c15_path", "A1");
    const lower = placed("lower", "c05_cabin", "A2");
    const tied = selectTargetWithCard(
      experimentalState([upper, lower]),
      [upper, lower],
      targetCardById[4],
      { effectId: "fallback" }
    );
    expect(tied?.diagnostic.coordinateFallbackUsed).toBe(true);
    expect(tied?.diagnostic.directionRequired).toBe(true);
    expect(tied?.tile.instanceId).toBe("upper");
  });

  it("projects diagonal arrows onto six evenly spaced map directions", () => {
    const north = placed("north", "c15_path", "C1");
    const eastButLower = placed("east_lower", "c05_cabin", "E3");
    const selected = selectTargetWithCard(
      experimentalState([north, eastButLower]),
      [north, eastButLower],
      targetCardById[1],
      { effectId: "diagonal_projection" }
    );

    expect(selected?.diagnostic.direction).toBe("NE");
    expect(selected?.tile.instanceId).toBe("north");
  });

  it("does not use Supported as a targeting preference", () => {
    const west = placed("west", "c15_path", "A1");
    const eastSupported = placed("east", "c05_cabin", "C1", {
      supported: true
    });
    const selected = selectTargetWithCard(
      experimentalState([west, eastSupported]),
      [west, eastSupported],
      targetCardById[3],
      { effectId: "supported" }
    );
    expect(selected?.tile.instanceId).toBe("east");
    expect(selected?.diagnostic.supportedWillPrevent).toBe(true);
  });

  it("draws once for multiple Strain on one tile and resolves cleanly at the cap", () => {
    const lumber = placed("lumber", "c01_lumber_yard", "G1", { strain: 2 });
    const prepared = pendingBurden(
      experimentalState([lumber], [1]),
      "burden_forest_s_grudge",
      2
    );

    expect(prepared.targetCards?.drawCount).toBe(1);
    expect(prepared.pendingEffects[0].suggestedAdjustment?.tileStrainDeltas).toEqual({
      lumber: 2
    });
    expect(prepared.pendingEffects[0].requiresManualChoice).toBe(false);

    const resolved = resolvePendingEffect(prepared);
    expect(resolved.map.placedTiles[0].strain).toBe(3);
    expect(resolved.pendingEffects).toHaveLength(0);
    expect(resolved.targetCards?.history[0]).toMatchObject({
      plannedStrain: 2,
      actualStrainPlaced: 1,
      strainApplied: true
    });
  });

  it("replaces a generic Strain suggestion with the card-selected target", () => {
    const west = placed("west", "c15_path", "A1");
    const east = placed("east", "c05_cabin", "C1");
    const state = experimentalState([west, east], [3]);
    state.pendingEffects = [{
      id: "replace_generic_target",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Expired Arrival",
      title: "Replace generic target",
      effectText: "Place 1 Strain.",
      suggestedAdjustment: { tileStrainDeltas: { west: 1 } },
      requiresManualChoice: true
    }];

    const prepared = preparePendingEffectQueueHead(state);

    expect(prepared.pendingEffects[0].targetCardTargetTileIds).toEqual(["east"]);
    expect(
      prepared.pendingEffects[0].suggestedAdjustment?.tileStrainDeltas
    ).toEqual({ east: 1 });
    expect(resolvePendingEffect(prepared).pendingEffects).toHaveLength(0);
  });

  it("draws one card per distinct target and satisfies category quotas", () => {
    const tiles = [
      placed("social1", "c09_tavern", "A1"),
      placed("social2", "c09_tavern", "C1"),
      placed("wellbeing1", "c11_washhouse", "E1"),
      placed("wellbeing2", "c11_washhouse", "G1")
    ];
    const prepared = pendingBurden(
      experimentalState(tiles, [1, 2]),
      "burden_the_long_cough",
      2
    );
    const selectedIds = Object.keys(
      prepared.pendingEffects[0].suggestedAdjustment?.tileStrainDeltas ?? {}
    );
    const selected = tiles.filter((tile) => selectedIds.includes(tile.instanceId));

    expect(prepared.targetCards?.drawCount).toBe(2);
    expect(selected.filter((tile) => tile.tileId === "c09_tavern")).toHaveLength(1);
    expect(selected.filter((tile) => tile.tileId === "c11_washhouse")).toHaveLength(1);
    expect(resolvePendingEffect(prepared).pendingEffects).toHaveLength(0);
  });

  it("locks payment-or-Strain targets while preserving the payment choice", () => {
    const tiles = [
      placed("social1", "c09_tavern", "A1"),
      placed("social2", "c09_tavern", "C1")
    ];
    const prepared = pendingBurden(
      experimentalState(tiles, [1, 2]),
      "burden_empty_shelves",
      2
    );

    expect(prepared.pendingEffects[0].targetCardTargetTileIds).toHaveLength(2);
    expect(prepared.pendingEffects[0].requiresManualChoice).toBe(true);
    const paid = resolvePendingEffect(prepared, {
      resourceDeltas: { goods: -2 },
      tileStrainDeltas: {}
    });
    expect(paid.pendingEffects).toHaveLength(0);
    expect(paid.warehouse.goods).toBe(prepared.warehouse.goods - 2);
    expect(paid.map.placedTiles.every((tile) => tile.strain === 0)).toBe(true);
    expect(paid.targetCards?.history.every((entry) => entry.strainApplied === false)).toBe(true);
  });

  it("attempts the full printed Strain alternative before applying the cap", () => {
    const resourcesAtCap = [
      placed("resource1", "c01_lumber_yard", "A1", { strain: 2 }),
      placed("resource2", "c04_farmstead", "C1", { strain: 2 })
    ];
    const state = experimentalState(resourcesAtCap, [1, 2]);
    for (const resource of Object.keys(state.warehouse) as Array<keyof typeof state.warehouse>) {
      state.warehouse[resource] = 0;
    }
    const prepared = pendingBurden(
      state,
      "burden_the_storehouses_disagree",
      3
    );

    expect(prepared.pendingEffects[0].suggestedAdjustment?.tileStrainDeltas).toEqual({
      resource1: 2,
      resource2: 2
    });
    const resolved = resolvePendingEffect(prepared);
    expect(resolved.pendingEffects).toHaveLength(0);
    expect(resolved.map.placedTiles.map((tile) => tile.strain)).toEqual([3, 3]);
    expect(resolved.targetCards?.history.map((entry) => entry.actualStrainPlaced)).toEqual([
      1,
      1
    ]);
  });

  it("keeps a card-selected linked primary and records the completion counterfactual", () => {
    const badAnchor = placed("bad", "c01_lumber_yard", "A1");
    const goodAnchor = placed("good", "c01_lumber_yard", "G1");
    const neighbor = placed("neighbor", "c15_path", "H1");
    const prepared = pendingBurden(
      experimentalState([badAnchor, goodAnchor, neighbor], [4, 1]),
      "burden_forest_s_grudge",
      3
    );
    const primary = prepared.pendingEffects[0].targetCardDiagnostics?.[0];

    expect(prepared.pendingEffects[0].suggestedAdjustment?.strainCascadeAnchorTileId).toBe("bad");
    expect(prepared.targetCards?.drawCount).toBe(1);
    expect(primary).toMatchObject({
      selectedTileId: "bad",
      linkedSecondaryAvailable: false,
      linkedSecondaryCompleted: false,
      alternatePrimaryWouldComplete: true
    });
    expect(resolvePendingEffect(prepared).pendingEffects).toHaveLength(0);
  });

  it("determines printed fallback eligibility before drawing", () => {
    const crafting = placed("crafting", "c13_workshops", "G1");
    const prepared = pendingBurden(
      experimentalState([crafting], [1]),
      "burden_smoke_over_hearths",
      3
    );

    expect(prepared.targetCards?.drawCount).toBe(1);
    expect(prepared.pendingEffects[0].targetCardDiagnostics?.[0]).toMatchObject({
      selectedTileId: "crafting",
      printedFallbackUsed: true
    });
  });

  it("selects before Supported prevents Strain and never redirects it", () => {
    const protectedTile = placed("protected", "c15_path", "C1", {
      supported: true
    });
    const other = placed("other", "c05_cabin", "A1");
    const state = experimentalState([protectedTile, other], [3]);
    state.pendingEffects = [{
      id: "arrival_expired",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain",
      requiresManualChoice: true
    }];
    const prepared = preparePendingEffectQueueHead(state);
    expect(prepared.pendingEffects[0].targetCardTargetTileIds).toEqual(["protected"]);

    const resolved = resolvePendingEffect(prepared);
    expect(resolved.map.placedTiles.find((tile) => tile.instanceId === "protected")?.strain).toBe(0);
    expect(resolved.map.placedTiles.find((tile) => tile.instanceId === "other")?.strain).toBe(0);
    expect(resolved.targetCards?.history[0]).toMatchObject({
      supportedPrevented: true,
      actualStrainPlaced: 0
    });
  });

  it("resolves Golden Garden prevention after selection without redirecting", () => {
    const selectedTile = placed("selected", "c15_path", "C1");
    const other = placed("other", "c05_cabin", "A1");
    const garden = placed(
      "garden",
      "golden_tile_the_golden_garden",
      "D1",
      { kind: "special", side: "special" }
    );
    const state = experimentalState([other, selectedTile, garden], [3]);
    state.pendingEffects = [{
      id: "garden_prevention",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain",
      requiresManualChoice: true
    }];

    const prepared = preparePendingEffectQueueHead(state);
    expect(prepared.pendingEffects[0].targetCardTargetTileIds).toEqual([
      "selected"
    ]);
    expect(prepared.pendingEffects[0].targetCardDiagnostics?.[0]).toMatchObject({
      goldenGardenWillPrevent: true
    });

    const resolved = resolvePendingEffect(prepared);
    expect(resolved.map.placedTiles.find((tile) => tile.instanceId === "selected")?.strain).toBe(0);
    expect(resolved.map.placedTiles.find((tile) => tile.instanceId === "other")?.strain).toBe(0);
    expect(resolved.tileActivationRecords.garden?.round).toBe(resolved.round);
    expect(resolved.targetCards?.history[0]).toMatchObject({
      goldenGardenPrevented: true,
      actualStrainPlaced: 0
    });
  });

  it("draws no card and acknowledges cleanly when no eligible target exists", () => {
    const state = experimentalState([], [1]);
    state.pendingEffects = [{
      id: "no_target",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain",
      requiresManualChoice: true
    }];

    const prepared = preparePendingEffectQueueHead(state);
    expect(prepared.targetCards?.drawCount).toBe(0);
    expect(prepared.pendingEffects[0]).toMatchObject({
      targetCardPrepared: true,
      targetCardDiagnostics: [],
      requiresManualChoice: false
    });
    expect(resolvePendingEffect(prepared).pendingEffects).toHaveLength(0);
  });

  it("queues simultaneous Overstrain sources in map-coordinate order", () => {
    const social = placed("social", "c09_tavern", "C1", { strain: 2 });
    const socialNeighbor = placed("social_neighbor", "c15_path", "D1");
    const wellbeing = placed("wellbeing", "c11_washhouse", "I1", { strain: 2 });
    const wellbeingNeighbor = placed("wellbeing_neighbor", "c15_path", "H1");
    const prepared = pendingBurden(
      experimentalState(
        [wellbeing, wellbeingNeighbor, social, socialNeighbor],
        [1, 2, 3, 4]
      ),
      "burden_the_long_cough",
      2
    );

    const queued = resolvePendingEffect(prepared);
    const spreadQueue = queued.pendingEffects;
    expect(spreadQueue.map((effect) => effect.sourceId)).toEqual([
      "social",
      "wellbeing"
    ]);
    expect(spreadQueue[0].targetCardPrepared).toBe(true);
    expect(spreadQueue[1].targetCardPrepared).toBeUndefined();
    expect(resolvePendingEffect(queued).pendingEffects[0]).toMatchObject({
      sourceId: "wellbeing",
      targetCardPrepared: true
    });
  });

  it("automatically appends and resolves an Overstrain chain in map order", () => {
    const tail = placed("tail", "c15_path", "G1");
    const middle = placed("middle", "c15_path", "H1", { strain: 2 });
    const source = placed("source", "c15_path", "I1", { strain: 2 });
    const state = experimentalState([tail, middle, source], [3, 3, 3]);
    state.pendingEffects = [{
      id: "chain_start",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain",
      requiresManualChoice: true
    }];

    const first = resolvePendingEffect(preparePendingEffectQueueHead(state));
    expect(first.pendingEffects[0]).toMatchObject({
      ruleId: systemEffectRuleId("overstrain-spread"),
      sourceId: "source",
      requiresManualChoice: false,
      targetCardPrepared: true
    });
    const second = resolvePendingEffect(first);
    expect(second.pendingEffects[0]).toMatchObject({ sourceId: "middle" });
    const finished = resolvePendingEffect(second);

    expect(finished.pendingEffects).toHaveLength(0);
    expect(finished.map.placedTiles.map((tile) => tile.strain)).toEqual([1, 3, 3]);
    expect(finished.targetCards?.drawCount).toBe(3);
  });

  it("leaves production behavior untouched when the experiment is disabled", () => {
    const state = createNewGame(1, ["vanguard"], {
      experimentalTargetCards: false
    });
    state.map.placedTiles = [
      placed("left", "c15_path", "A1"),
      placed("right", "c05_cabin", "C1")
    ];
    state.pendingEffects = [{
      id: "disabled",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceType: "system",
      sourceName: "Expired Arrival",
      title: "Expired Arrival",
      effectText: "Place 1 Strain",
      requiresManualChoice: true
    }];

    const unchanged = preparePendingEffectQueueHead(state);
    expect(unchanged).toBe(state);
    expect(unchanged.pendingEffects[0].targetCardPrepared).toBeUndefined();
    expect(unchanged.targetCards?.drawCount).toBe(0);
  });
});

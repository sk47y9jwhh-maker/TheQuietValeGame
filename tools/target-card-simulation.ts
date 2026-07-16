import { targetCards } from "../src/data/targetCards";
import { coreTiles, goldenTiles, specialTiles } from "../src/data/tiles";
import { mapById, mapCells, mapColumns } from "../src/data/map";
import { getHexNeighbors } from "../src/engine/hex";
import { createNewGame } from "../src/engine/setup";
import {
  comparePlacedTilesByMapCoordinate,
  countAdjacentPlacedTiles,
  createTargetCardDeckState,
  drawTargetCard,
  selectTargetWithCard
} from "../src/engine/targetCards";
import type {
  GameState,
  PlacedTile,
  TargetCardDeckState,
  TargetCardSelectionDiagnostic
} from "../src/engine/types";

const targetResolutionGoal = 12_000;

function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6d2b79f5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seededRandom("QV-TARGET-CARD-SIMULATION-V1");
const choose = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
const shuffle = <T>(items: T[]): T[] => {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
};

function randomStrain(): number {
  const roll = random();
  if (roll < 0.42) return 0;
  if (roll < 0.7) return 1;
  if (roll < 0.93) return 2;
  return 3;
}

function clusteredHexes(count: number): string[] {
  const selected = new Set<string>([choose(mapCells).id]);
  while (selected.size < count) {
    const frontier = [...selected]
      .flatMap(getHexNeighbors)
      .filter((hexId) => !selected.has(hexId));
    const next = frontier.length > 0 && random() < 0.86
      ? choose(frontier)
      : choose(mapCells.filter((cell) => !selected.has(cell.id))).id;
    selected.add(next);
  }
  return [...selected];
}

function makeBoard(effectIndex: number): GameState {
  const tileCount = 16 + Math.floor(random() * 24);
  const anchors = clusteredHexes(tileCount);
  const used = new Set(anchors);
  const tiles: PlacedTile[] = anchors.map((hexId, index) => {
    const kindRoll = random();
    const isGolden = kindRoll > 0.92;
    const isSpecial = !isGolden && kindRoll > 0.75;
    const tileId = isGolden
      ? choose(goldenTiles).id
      : isSpecial
        ? choose(specialTiles).id
        : choose(coreTiles).id;
    const kind = isGolden || isSpecial ? "special" as const : "core" as const;
    const side = kind === "special"
      ? "special" as const
      : random() < 0.48
        ? "basic" as const
        : "upgraded" as const;
    const hexIds = [hexId];
    if (random() < 0.12) {
      const extra = getHexNeighbors(hexId).find((neighbor) => !used.has(neighbor));
      if (extra) {
        used.add(extra);
        hexIds.push(extra);
      }
    }
    return {
      instanceId: `sim_${effectIndex}_${index}`,
      tileId,
      kind,
      side,
      hexIds,
      strain: randomStrain(),
      support: {
        passive: random() < 0.08,
        singleUse: random() < 0.14,
        preventedThisRound: false
      }
    };
  });
  return {
    ...baseState,
    round: (effectIndex % 12) + 1,
    map: { placedTiles: tiles },
    tileActivationRecords: {}
  };
}

const baseState = createNewGame(4, ["vanguard", "warden", "knight", "quartermaster"]);
let deck: TargetCardDeckState = createTargetCardDeckState(
  true,
  "QV-TARGET-CARD-SIMULATION-DECK"
);

const metrics = {
  targetResolutions: 0,
  effects: 0,
  noTargetEffects: 0,
  cardsById: Object.fromEntries(targetCards.map((card) => [card.id, 0])) as Record<number, number>,
  selectedClass: { core: 0, special: 0, golden: 0 },
  selectedSide: { basic: 0, upgraded: 0, special: 0 },
  selectedAdjacency: { zeroToTwo: 0, threePlus: 0 },
  selectedStrain: { unstrained: 0, strained: 0 },
  filterApplied: { class: 0, side: 0, adjacency: 0, strain: 0 },
  filterIgnored: { class: 0, side: 0, adjacency: 0, strain: 0 },
  direction: { NE: 0, E: 0, SE: 0, SW: 0, W: 0, NW: 0 },
  directionRequired: 0,
  coordinateFallbacks: 0,
  supportedSelections: 0,
  goldenGardenSelections: 0,
  printedFallbackSelections: 0,
  cardInfluencedSelections: 0,
  map: {
    edgeSelections: 0,
    north: 0,
    south: 0,
    east: 0,
    west: 0,
    columnSum: 0,
    rowSum: 0
  },
  cardsPerBurden: [] as number[],
  targetsPerBurden: [] as number[],
  requestedTargetsPerBurden: [] as number[],
  linked: {
    effects: 0,
    missingSecondary: 0,
    counterfactualAlternatePrimary: 0
  },
  overstrainChainLengths: [] as number[],
  influenceByCard: Object.fromEntries(
    targetCards.map((card) => [card.id, { selections: 0, influenced: 0 }])
  ) as Record<number, { selections: number; influenced: number }>
};

function recordSelection(
  state: GameState,
  candidates: PlacedTile[],
  tile: PlacedTile,
  diagnostic: TargetCardSelectionDiagnostic
): void {
  metrics.targetResolutions += 1;
  metrics.cardsById[diagnostic.cardId] += 1;
  metrics.direction[diagnostic.direction] += 1;
  metrics.influenceByCard[diagnostic.cardId].selections += 1;
  if (tile.kind === "core") metrics.selectedClass.core += 1;
  else if (tile.tileId.startsWith("golden_tile_")) metrics.selectedClass.golden += 1;
  else metrics.selectedClass.special += 1;
  metrics.selectedSide[tile.side] += 1;
  const adjacency = countAdjacentPlacedTiles(state, tile);
  metrics.selectedAdjacency[adjacency >= 3 ? "threePlus" : "zeroToTwo"] += 1;
  metrics.selectedStrain[tile.strain > 0 ? "strained" : "unstrained"] += 1;
  for (const filter of diagnostic.filters) {
    metrics[filter.applied ? "filterApplied" : "filterIgnored"][filter.filter] += 1;
  }
  if (diagnostic.directionRequired) metrics.directionRequired += 1;
  if (diagnostic.coordinateFallbackUsed) metrics.coordinateFallbacks += 1;
  if (diagnostic.supportedWillPrevent) metrics.supportedSelections += 1;
  if (diagnostic.goldenGardenWillPrevent) metrics.goldenGardenSelections += 1;
  if (diagnostic.printedFallbackUsed) metrics.printedFallbackSelections += 1;

  const baseline = [...candidates].sort(comparePlacedTilesByMapCoordinate)[0];
  if (baseline && baseline.instanceId !== tile.instanceId) {
    metrics.cardInfluencedSelections += 1;
    metrics.influenceByCard[diagnostic.cardId].influenced += 1;
  }

  const firstHex = mapById[[...tile.hexIds].sort((left, right) => {
    const leftCell = mapById[left];
    const rightCell = mapById[right];
    return (leftCell?.row ?? 99) - (rightCell?.row ?? 99) ||
      mapColumns.indexOf(leftCell?.col ?? "") - mapColumns.indexOf(rightCell?.col ?? "");
  })[0]];
  if (!firstHex) return;
  const column = mapColumns.indexOf(firstHex.col);
  metrics.map.columnSum += column;
  metrics.map.rowSum += firstHex.row - 1;
  if (column <= 1 || column >= 12 || firstHex.row <= 2 || firstHex.row >= 8) {
    metrics.map.edgeSelections += 1;
  }
  metrics.map[column < mapColumns.length / 2 ? "west" : "east"] += 1;
  metrics.map[firstHex.row <= 5 ? "north" : "south"] += 1;
}

function drawSelection(
  state: GameState,
  candidates: PlacedTile[],
  effectId: string,
  role: TargetCardSelectionDiagnostic["role"],
  printedFallbackUsed = false
): { tile: PlacedTile; diagnostic: TargetCardSelectionDiagnostic } | null {
  if (candidates.length === 0) return null;
  const drawn = drawTargetCard(deck);
  deck = drawn.deckState;
  const selected = selectTargetWithCard(state, candidates, drawn.card, {
    effectId,
    role,
    printedFallbackUsed,
    diagnosticId: `${effectId}:${deck.drawCount}`
  });
  if (!selected) return null;
  recordSelection(state, candidates, selected.tile, selected.diagnostic);
  return selected;
}

function directCandidates(state: GameState, scenario: string): PlacedTile[] {
  const belowThree = state.map.placedTiles.filter((tile) => tile.strain < 3);
  if (scenario === "core") return belowThree.filter((tile) => tile.kind === "core");
  if (scenario === "special") return belowThree.filter((tile) => tile.kind === "special");
  if (scenario === "strained") return belowThree.filter((tile) => tile.strain > 0);
  if (scenario === "unstrained") return belowThree.filter((tile) => tile.strain === 0);
  if (scenario === "dense") {
    return belowThree.filter((tile) => countAdjacentPlacedTiles(state, tile) >= 3);
  }
  if (scenario === "sparse") {
    return belowThree.filter((tile) => countAdjacentPlacedTiles(state, tile) <= 2);
  }
  if (scenario === "limited") return shuffle(belowThree).slice(0, 1 + Math.floor(random() * 2));
  if (scenario === "none") return [];
  return belowThree;
}

function simulateDirectEffect(state: GameState, effectIndex: number): void {
  const scenario = choose([
    "generic", "generic", "core", "special", "strained", "unstrained",
    "dense", "sparse", "limited", "fallback", "none"
  ]);
  let candidates = directCandidates(state, scenario);
  if (candidates.length === 0 && scenario !== "none") {
    candidates = directCandidates(state, "generic");
  }
  const requestedTargets = 1 + Math.floor(random() * 3);
  const effectId = `direct_${effectIndex}`;
  let selectedTargets = 0;
  const drawCountBefore = deck.drawCount;
  while (selectedTargets < requestedTargets && candidates.length > 0) {
    const selected = drawSelection(
      state,
      candidates,
      effectId,
      "target",
      scenario === "fallback"
    );
    if (!selected) break;
    selectedTargets += 1;
    candidates = candidates.filter(
      (candidate) => candidate.instanceId !== selected.tile.instanceId
    );
  }
  metrics.effects += 1;
  if (selectedTargets === 0) metrics.noTargetEffects += 1;
  metrics.cardsPerBurden.push(deck.drawCount - drawCountBefore);
  metrics.targetsPerBurden.push(selectedTargets);
  metrics.requestedTargetsPerBurden.push(requestedTargets);
}

function simulateLinkedEffect(state: GameState, effectIndex: number): void {
  const available = shuffle(
    state.map.placedTiles.filter((tile) => tile.strain < 3)
  );
  const primaryCandidates = available.slice(0, Math.min(5, available.length));
  const effectId = `linked_${effectIndex}`;
  const drawCountBefore = deck.drawCount;
  const primary = drawSelection(state, primaryCandidates, effectId, "primary");
  let selectedTargets = 0;
  metrics.effects += 1;
  metrics.linked.effects += 1;
  if (!primary) {
    metrics.noTargetEffects += 1;
  } else {
    selectedTargets += 1;
    const secondaryPool = state.map.placedTiles.filter(
      (tile) =>
        tile.instanceId !== primary.tile.instanceId &&
        tile.strain < 3 &&
        state.map.placedTiles.some(
          (candidate) =>
            candidate.instanceId === primary.tile.instanceId &&
            countAdjacentPlacedTiles(
              { ...state, map: { placedTiles: [candidate, tile] } },
              candidate
            ) > 0
        )
    );
    if (secondaryPool.length === 0) {
      metrics.linked.missingSecondary += 1;
      const alternateCompletes = primaryCandidates.some(
        (candidate) =>
          candidate.instanceId !== primary.tile.instanceId &&
          state.map.placedTiles.some(
            (tile) =>
              tile.instanceId !== candidate.instanceId &&
              tile.strain < 3 &&
              getHexNeighbors(candidate.hexIds[0]).some((hexId) => tile.hexIds.includes(hexId))
          )
      );
      if (alternateCompletes) metrics.linked.counterfactualAlternatePrimary += 1;
    } else {
      const secondary = drawSelection(state, secondaryPool, effectId, "spread");
      if (secondary) selectedTargets += 1;
    }
  }
  metrics.cardsPerBurden.push(deck.drawCount - drawCountBefore);
  metrics.targetsPerBurden.push(selectedTargets);
  metrics.requestedTargetsPerBurden.push(2);
}

function simulateOverstrainChain(state: GameState, effectIndex: number): void {
  const tiles = state.map.placedTiles.map((tile) => ({
    ...tile,
    hexIds: [...tile.hexIds],
    support: { ...tile.support }
  }));
  const chainState = { ...state, map: { placedTiles: tiles } };
  const start = choose(tiles);
  start.strain = 3;
  const queue = [start.instanceId];
  const spreadSources = new Set<string>();
  let chainLength = 0;
  const drawCountBefore = deck.drawCount;
  while (queue.length > 0 && chainLength < 20) {
    const sourceId = queue.shift()!;
    if (spreadSources.has(sourceId)) continue;
    spreadSources.add(sourceId);
    const source = tiles.find((tile) => tile.instanceId === sourceId);
    if (!source) continue;
    const candidates = tiles.filter(
      (tile) =>
        tile.instanceId !== source.instanceId &&
        tile.strain < 3 &&
        source.hexIds.some((hexId) =>
          getHexNeighbors(hexId).some((neighbor) => tile.hexIds.includes(neighbor))
        )
    );
    const selected = drawSelection(
      chainState,
      candidates,
      `chain_${effectIndex}_${chainLength}`,
      "spread"
    );
    if (!selected) continue;
    chainLength += 1;
    selected.tile.strain = Math.min(3, selected.tile.strain + 1);
    if (selected.tile.strain === 3 && !spreadSources.has(selected.tile.instanceId)) {
      queue.push(selected.tile.instanceId);
    }
  }
  metrics.effects += 1;
  metrics.overstrainChainLengths.push(chainLength);
  metrics.cardsPerBurden.push(deck.drawCount - drawCountBefore);
  metrics.targetsPerBurden.push(chainLength);
  metrics.requestedTargetsPerBurden.push(Math.max(1, chainLength));
}

let effectIndex = 0;
while (metrics.targetResolutions < targetResolutionGoal) {
  const state = makeBoard(effectIndex);
  const roll = random();
  if (roll < 0.12) simulateLinkedEffect(state, effectIndex);
  else if (roll < 0.2) simulateOverstrainChain(state, effectIndex);
  else simulateDirectEffect(state, effectIndex);
  effectIndex += 1;
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: number[], proportion: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * proportion))];
}

const output = {
  seed: "QV-TARGET-CARD-SIMULATION-V1",
  targetResolutions: metrics.targetResolutions,
  effects: metrics.effects,
  noTargetEffects: metrics.noTargetEffects,
  cardsById: metrics.cardsById,
  selectedClass: metrics.selectedClass,
  selectedSide: metrics.selectedSide,
  selectedAdjacency: metrics.selectedAdjacency,
  selectedStrain: metrics.selectedStrain,
  filterApplied: metrics.filterApplied,
  filterIgnored: metrics.filterIgnored,
  direction: metrics.direction,
  directionRequired: metrics.directionRequired,
  coordinateFallbacks: metrics.coordinateFallbacks,
  supportedSelections: metrics.supportedSelections,
  goldenGardenSelections: metrics.goldenGardenSelections,
  printedFallbackSelections: metrics.printedFallbackSelections,
  cardInfluencedSelections: metrics.cardInfluencedSelections,
  map: metrics.map,
  linked: metrics.linked,
  influenceByCard: metrics.influenceByCard,
  burdenDrawCounts: {
    zero: metrics.cardsPerBurden.filter((count) => count === 0).length,
    one: metrics.cardsPerBurden.filter((count) => count === 1).length,
    multiple: metrics.cardsPerBurden.filter((count) => count > 1).length
  },
  overstrain: {
    samples: metrics.overstrainChainLengths.length,
    zero: metrics.overstrainChainLengths.filter((length) => length === 0).length,
    one: metrics.overstrainChainLengths.filter((length) => length === 1).length,
    multiple: metrics.overstrainChainLengths.filter((length) => length > 1).length
  },
  summary: {
    cardsPerBurdenAverage: average(metrics.cardsPerBurden),
    targetFulfilmentRate:
      metrics.targetsPerBurden.reduce((total, value) => total + value, 0) /
      metrics.requestedTargetsPerBurden.reduce((total, value) => total + value, 0),
    directionRequiredRate: metrics.directionRequired / metrics.targetResolutions,
    coordinateFallbackRate: metrics.coordinateFallbacks / metrics.targetResolutions,
    supportedSelectionRate: metrics.supportedSelections / metrics.targetResolutions,
    printedFallbackRate: metrics.printedFallbackSelections / metrics.targetResolutions,
    cardInfluenceRate: metrics.cardInfluencedSelections / metrics.targetResolutions,
    mapEdgeRate: metrics.map.edgeSelections / metrics.targetResolutions,
    meanColumn: metrics.map.columnSum / metrics.targetResolutions,
    meanRow: metrics.map.rowSum / metrics.targetResolutions,
    linkedMissingSecondaryRate:
      metrics.linked.missingSecondary / Math.max(1, metrics.linked.effects),
    linkedCounterfactualRate:
      metrics.linked.counterfactualAlternatePrimary /
      Math.max(1, metrics.linked.missingSecondary),
    overstrainChainAverage: average(metrics.overstrainChainLengths),
    overstrainChainP95: percentile(metrics.overstrainChainLengths, 0.95),
    overstrainChainMax: Math.max(0, ...metrics.overstrainChainLengths),
    zeroCardBurdenRate:
      metrics.cardsPerBurden.filter((count) => count === 0).length /
      metrics.cardsPerBurden.length,
    oneCardBurdenRate:
      metrics.cardsPerBurden.filter((count) => count === 1).length /
      metrics.cardsPerBurden.length,
    multiCardBurdenRate:
      metrics.cardsPerBurden.filter((count) => count > 1).length /
      metrics.cardsPerBurden.length
  }
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

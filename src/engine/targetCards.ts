import { mapById, mapCells, mapColumns, mapLayout } from "../data/map";
import { targetCardById, targetCards } from "../data/targetCards";
import { arePlacedTilesAdjacent } from "./placedTiles";
import { getStrainPreventionPreview } from "./strainRules";
import type {
  GameState,
  PlacedTile,
  TargetCardDeckState,
  TargetCardDefinition,
  TargetCardDirection,
  TargetCardFilterDiagnostic,
  TargetCardFilterName,
  TargetCardSelectionDiagnostic
} from "./types";

const historyLimit = 500;
const mapCellOrder = new Map(mapCells.map((cell, index) => [cell.id, index]));

type LegacyTargetCardDeckState = TargetCardDeckState & {
  discardPile?: number[];
};

function createSeededRandom(seed: string): () => number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const random = createSeededRandom(seed);
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function createTargetCardDeckState(
  seed: string
): TargetCardDeckState {
  const normalizedSeed = seed.trim() || "QV-TARGET-CARDS";
  return {
    seed: normalizedSeed,
    drawPile: shuffleWithSeed(
      targetCards.map((card) => card.id),
      `${normalizedSeed}:initial`
    ),
    drawCount: 0,
    history: []
  };
}

export function normalizeTargetCardDeckState(
  state: LegacyTargetCardDeckState | undefined,
  fallbackSeed = "QV-TARGET-CARDS"
): TargetCardDeckState {
  if (!state) return createTargetCardDeckState(fallbackSeed);
  const validIds = new Set(targetCards.map((card) => card.id));
  const representedIds = new Set<number>();
  const drawPile = [
    ...(state.drawPile ?? []),
    ...(state.discardPile ?? [])
  ].filter((id) => {
    if (!validIds.has(id) || representedIds.has(id)) return false;
    representedIds.add(id);
    return true;
  });
  const missingIds = targetCards
    .map((card) => card.id)
    .filter((id) => !representedIds.has(id));
  return {
    seed: state.seed?.trim() || fallbackSeed,
    drawPile: [...drawPile, ...missingIds],
    drawCount: Number.isFinite(state.drawCount) ? state.drawCount : 0,
    history: Array.isArray(state.history)
      ? state.history.slice(-historyLimit)
      : []
  };
}

export function drawTargetCard(
  deckState: TargetCardDeckState
): { deckState: TargetCardDeckState; card: TargetCardDefinition } {
  const normalized = normalizeTargetCardDeckState(deckState, deckState.seed);
  const [cardId, ...remainingCards] = normalized.drawPile;
  const card = cardId === undefined ? undefined : targetCardById[cardId];
  if (!card) {
    return drawTargetCard(createTargetCardDeckState(deckState.seed));
  }

  return {
    card,
    deckState: {
      ...normalized,
      drawPile: [...remainingCards, card.id],
      drawCount: normalized.drawCount + 1
    }
  };
}

function distinctCandidates(candidates: PlacedTile[]): PlacedTile[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.instanceId)) return false;
    seen.add(candidate.instanceId);
    return true;
  });
}

export function countAdjacentPlacedTiles(
  state: Pick<GameState, "map">,
  tile: PlacedTile
): number {
  return state.map.placedTiles.filter(
    (candidate) =>
      candidate.instanceId !== tile.instanceId &&
      arePlacedTilesAdjacent(tile, candidate)
  ).length;
}

function preferenceLabel(
  filter: TargetCardFilterName,
  card: TargetCardDefinition
): string {
  if (filter === "class") {
    return card.tileClass === "core" ? "Core" : "Special / Golden";
  }
  if (filter === "side") {
    return card.side === "either"
      ? "Either"
      : card.side === "basic"
        ? "Basic"
        : "Upgraded";
  }
  if (filter === "adjacency") {
    return card.adjacency === "threePlus" ? "3+" : "0–2";
  }
  return card.strain === "strained" ? "Already Strained" : "Unstrained";
}

function matchesPreference(
  state: Pick<GameState, "map">,
  tile: PlacedTile,
  filter: TargetCardFilterName,
  card: TargetCardDefinition
): boolean {
  if (filter === "class") {
    return card.tileClass === "core"
      ? tile.kind === "core"
      : tile.kind === "special";
  }
  if (filter === "side") {
    return card.side === "either" || tile.side === card.side;
  }
  if (filter === "adjacency") {
    const count = countAdjacentPlacedTiles(state, tile);
    return card.adjacency === "threePlus" ? count >= 3 : count <= 2;
  }
  return card.strain === "strained" ? tile.strain > 0 : tile.strain === 0;
}

function hexCentre(hexId: string): { x: number; y: number } {
  const cell = mapById[hexId];
  if (!cell) return { x: 0, y: 0 };
  const column = mapColumns.indexOf(cell.col);
  return {
    x: mapLayout.originX + mapLayout.hexRadius + column * mapLayout.hexRadius * 1.5,
    y:
      mapLayout.originY +
      mapLayout.hexHeight / 2 +
      (cell.row - 1) * mapLayout.hexHeight +
      (column % 2) * (mapLayout.hexHeight / 2)
  };
}

// The deck uses six evenly spaced compass axes centred on E/W. These are
// projection vectors, independent of the flat-top orientation of the map SVG.
const directionVectors: Record<TargetCardDirection, { x: number; y: number }> = {
  NE: { x: 0.5, y: -Math.sqrt(3) / 2 },
  E: { x: 1, y: 0 },
  SE: { x: 0.5, y: Math.sqrt(3) / 2 },
  SW: { x: -0.5, y: Math.sqrt(3) / 2 },
  W: { x: -1, y: 0 },
  NW: { x: -0.5, y: -Math.sqrt(3) / 2 }
};

function directionExtent(tile: PlacedTile, direction: TargetCardDirection): number {
  const vector = directionVectors[direction];
  return Math.max(
    ...tile.hexIds.map((hexId) => {
      const centre = hexCentre(hexId);
      return centre.x * vector.x + centre.y * vector.y;
    })
  );
}

function tileCoordinateKey(tile: PlacedTile): number[] {
  return tile.hexIds
    .map((hexId) => mapCellOrder.get(hexId) ?? Number.MAX_SAFE_INTEGER)
    .sort((a, b) => a - b);
}

export function comparePlacedTilesByMapCoordinate(
  left: PlacedTile,
  right: PlacedTile
): number {
  const leftKey = tileCoordinateKey(left);
  const rightKey = tileCoordinateKey(right);
  const length = Math.max(leftKey.length, rightKey.length);
  for (let index = 0; index < length; index += 1) {
    const difference =
      (leftKey[index] ?? Number.MAX_SAFE_INTEGER) -
      (rightKey[index] ?? Number.MAX_SAFE_INTEGER);
    if (difference !== 0) return difference;
  }
  return left.instanceId.localeCompare(right.instanceId);
}

export interface TargetSelectionContext {
  effectId: string;
  sourceId?: string;
  role?: TargetCardSelectionDiagnostic["role"];
  diagnosticId?: string;
  printedFallbackUsed?: boolean;
}

export function selectTargetWithCard(
  state: GameState,
  candidates: PlacedTile[],
  card: TargetCardDefinition,
  context: TargetSelectionContext
): { tile: PlacedTile; diagnostic: TargetCardSelectionDiagnostic } | null {
  let considered = distinctCandidates(candidates);
  if (considered.length === 0) return null;
  const originalEligibleCount = considered.length;
  const filters: TargetCardFilterDiagnostic[] = [];

  for (const filter of ["class", "side", "adjacency", "strain"] as const) {
    const beforeCount = considered.length;
    const matches = considered.filter((tile) =>
      matchesPreference(state, tile, filter, card)
    );
    const applied = matches.length > 0;
    if (applied) considered = matches;
    filters.push({
      filter,
      preference: preferenceLabel(filter, card),
      applied,
      beforeCount,
      afterCount: considered.length
    });
  }

  const extents = considered.map((tile) => ({
    tile,
    extent: directionExtent(tile, card.direction)
  }));
  const directionRequired = considered.length > 1;
  const furthestExtent = Math.max(...extents.map((entry) => entry.extent));
  const directionCandidates = extents
    .filter((entry) => Math.abs(entry.extent - furthestExtent) < 0.000001)
    .map((entry) => entry.tile)
    .sort(comparePlacedTilesByMapCoordinate);
  const tile = directionCandidates[0];
  const prevention = getStrainPreventionPreview(state, tile);

  return {
    tile,
    diagnostic: {
      id: context.diagnosticId ?? `${context.effectId}:target:${card.id}`,
      effectId: context.effectId,
      sourceId: context.sourceId,
      role: context.role ?? "target",
      cardId: card.id,
      originalEligibleCount,
      filters,
      direction: card.direction,
      directionRequired,
      directionCandidateCount: directionCandidates.length,
      coordinateFallbackUsed: directionCandidates.length > 1,
      selectedTileId: tile.instanceId,
      selectedHexIds: [...tile.hexIds],
      supportedWillPrevent: prevention.supported,
      goldenGardenWillPrevent: Boolean(prevention.goldenGardenTileId),
      printedFallbackUsed: context.printedFallbackUsed
    }
  };
}

export function drawAndSelectTarget(
  state: GameState,
  candidates: PlacedTile[],
  context: TargetSelectionContext
): {
  state: GameState;
  tile: PlacedTile;
  diagnostic: TargetCardSelectionDiagnostic;
} | null {
  const deck = normalizeTargetCardDeckState(state.targetCards);
  if (candidates.length === 0) return null;
  const drawn = drawTargetCard(deck);
  const diagnosticId = `${context.effectId}:draw:${drawn.deckState.drawCount}`;
  const selected = selectTargetWithCard(state, candidates, drawn.card, {
    ...context,
    diagnosticId
  });
  if (!selected) return null;
  const history = [...drawn.deckState.history, selected.diagnostic].slice(-historyLimit);

  return {
    tile: selected.tile,
    diagnostic: selected.diagnostic,
    state: {
      ...state,
      targetCards: {
        ...drawn.deckState,
        history
      }
    }
  };
}

export function updateTargetCardDiagnostic(
  state: GameState,
  diagnosticId: string,
  patch: Partial<TargetCardSelectionDiagnostic>
): GameState {
  return {
    ...state,
    targetCards: {
      ...state.targetCards,
      history: state.targetCards.history.map((diagnostic) =>
        diagnostic.id === diagnosticId
          ? { ...diagnostic, ...patch }
          : diagnostic
      )
    }
  };
}

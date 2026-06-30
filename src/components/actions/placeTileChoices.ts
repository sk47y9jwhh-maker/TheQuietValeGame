import { mapById } from "../../data/map";
import { coreTiles, specialTiles } from "../../data/tiles";
import { formatCategory, formatCost } from "../common/gameText";
import { getHexNeighbors, hexDirections } from "../../engine/hex";
import { canStartPlaceTile } from "../../engine/gameActions";
import { getBoonActionPreview } from "../../engine/boonModifiers";
import {
  getLegalPlacementHexes,
  getTileCategory,
  getTileFootprintKind,
  getTileFootprintSize,
  getTilePlacementHexIds,
  getTileSupplyCopiesRequired,
  hasPotentialPlacementOption
} from "../../engine/placementRules";
import { canAfford, getMissingResources } from "../../engine/resources";
import type {
  GameState,
  HexDirection,
  ResourceCost,
  Terrain,
  TileCategory,
  TilePlacementDraft
} from "../../engine/types";

interface TileChoicePlacementRequirement {
  terrain?: Terrain[];
  adjacentToCategory?: TileCategory[];
  adjacentToTileIds?: string[];
  adjacentToTerrain?: Terrain[];
}

export interface PlaceTileChoice {
  id: string;
  name: string;
  effectText: string;
  label: string;
  cost: ResourceCost;
  placement: string;
  placementRequirement?: TileChoicePlacementRequirement;
  meta: string;
  category: TileCategory;
  kind: "core" | "special";
  actionCost: number;
  costLabel: string;
  affordable: boolean;
  blockedReasons: string[];
  copiesAvailable: number;
  copiesRequired: number;
  hasEnoughSupply: boolean;
  hasPlacementOption: boolean;
  missingResources: string[];
  selectedPlaceableNow: boolean;
  selectionScore: number;
  placeableNow: boolean;
}

function getSelectedDrafts(
  tileId: string,
  selectedHexIds: string[],
  placementOrientation: HexDirection
): TilePlacementDraft[] {
  const anchorHexId = selectedHexIds[0];
  if (!anchorHexId) return [];

  const footprintKind = getTileFootprintKind(tileId);
  if (footprintKind === "line") {
    return hexDirections.map((orientation) => ({ anchorHexId, orientation }));
  }
  if (footprintKind === "detached") {
    return [{ anchorHexId, secondaryHexIds: selectedHexIds.slice(1) }];
  }
  return [{ anchorHexId, orientation: placementOrientation }];
}

function hasAdjacentCategoryMatch(
  state: GameState,
  footprintHexIds: string[],
  categories: TileCategory[]
): boolean {
  const neighbors = new Set(footprintHexIds.flatMap((hexId) => getHexNeighbors(hexId)));
  return state.map.placedTiles.some(
    (tile) =>
      tile.strain < 3 &&
      tile.hexIds.some((hexId) => neighbors.has(hexId)) &&
      categories.includes(getTileCategory(tile))
  );
}

function hasAdjacentTileMatch(
  state: GameState,
  footprintHexIds: string[],
  tileIds: string[]
): boolean {
  const neighbors = new Set(footprintHexIds.flatMap((hexId) => getHexNeighbors(hexId)));
  return state.map.placedTiles.some(
    (tile) =>
      tile.strain < 3 &&
      tile.hexIds.some((hexId) => neighbors.has(hexId)) &&
      tileIds.includes(tile.tileId)
  );
}

function hasAdjacentTerrainMatch(footprintHexIds: string[], terrains: string[]): boolean {
  return footprintHexIds
    .flatMap((hexId) => getHexNeighbors(hexId))
    .some((hexId) => {
      const cell = mapById[hexId];
      return cell ? terrains.includes(cell.terrain) : false;
    });
}

function getSelectionScore(
  state: GameState,
  tileId: string,
  placementRequirement: TileChoicePlacementRequirement | undefined,
  selectedHexIds: string[],
  placementOrientation: HexDirection,
  selectedPlaceableNow: boolean
): number {
  const drafts = getSelectedDrafts(tileId, selectedHexIds, placementOrientation);
  if (drafts.length === 0) return 0;

  return drafts.reduce((best, draft) => {
    const footprintHexIds = getTilePlacementHexIds(tileId, draft);
    if (footprintHexIds.length === 0) return best;

    let score = selectedPlaceableNow ? 600 : 0;
    const cells = footprintHexIds.map((hexId) => mapById[hexId]).filter(Boolean);
    if (cells.length !== footprintHexIds.length) return best;

    if (!placementRequirement) {
      score += 70;
    }
    if (
      placementRequirement?.terrain &&
      cells.every((cell) => placementRequirement.terrain?.includes(cell.terrain))
    ) {
      score += 320;
    }
    if (
      placementRequirement?.adjacentToCategory &&
      hasAdjacentCategoryMatch(
        state,
        footprintHexIds,
        placementRequirement.adjacentToCategory
      )
    ) {
      score += 260;
    }
    if (
      placementRequirement?.adjacentToTileIds &&
      hasAdjacentTileMatch(state, footprintHexIds, placementRequirement.adjacentToTileIds)
    ) {
      score += 260;
    }
    if (
      placementRequirement?.adjacentToTerrain &&
      hasAdjacentTerrainMatch(footprintHexIds, placementRequirement.adjacentToTerrain)
    ) {
      score += 220;
    }

    return Math.max(best, score);
  }, 0);
}

function canPlaceAtSelectedHex(
  state: GameState,
  playerId: string,
  tileId: string,
  selectedHexIds: string[],
  placementOrientation: HexDirection
): boolean {
  if (!selectedHexIds[0]) {
    return Boolean(
      getConfirmPlacementDraft(
        state,
        playerId,
        tileId,
        selectedHexIds,
        placementOrientation
      )
    );
  }

  if (getTileFootprintKind(tileId) === "detached") {
    const draft = {
      anchorHexId: selectedHexIds[0],
      secondaryHexIds: selectedHexIds.slice(1)
    };
    if (selectedHexIds.length >= getTileFootprintSize(tileId)) {
      return canStartPlaceTile(state, playerId, tileId, draft).ok;
    }
    return getLegalPlacementHexes(state, playerId, tileId, draft).length > 0;
  }

  return getSelectedDrafts(tileId, selectedHexIds, placementOrientation).some((draft) =>
    canStartPlaceTile(state, playerId, tileId, draft).ok
  );
}

export function getConfirmPlacementDraft(
  state: GameState,
  playerId: string,
  tileId: string,
  selectedHexIds: string[],
  placementOrientation: HexDirection
): TilePlacementDraft | null {
  const anchorHexId = selectedHexIds[0];
  const footprintKind = getTileFootprintKind(tileId);

  if (!anchorHexId) {
    if (footprintKind === "detached") return null;

    if (footprintKind === "line") {
      const validDrafts = hexDirections.flatMap((orientation) =>
        getLegalPlacementHexes(state, playerId, tileId, { orientation }).map(
          (legalHexId) => ({ anchorHexId: legalHexId, orientation })
        )
      );
      return validDrafts.length === 1 ? validDrafts[0] : null;
    }

    const legalHexes = getLegalPlacementHexes(state, playerId, tileId, {});
    return legalHexes.length === 1 ? { anchorHexId: legalHexes[0] } : null;
  }

  if (footprintKind === "line") {
    const preferredDraft = { anchorHexId, orientation: placementOrientation };
    if (canStartPlaceTile(state, playerId, tileId, preferredDraft).ok) {
      return preferredDraft;
    }

    const fallbackOrientation = hexDirections.find((orientation) =>
      canStartPlaceTile(state, playerId, tileId, { anchorHexId, orientation }).ok
    );
    return fallbackOrientation === undefined
      ? null
      : { anchorHexId, orientation: fallbackOrientation };
  }

  const draft =
    footprintKind === "detached"
      ? { anchorHexId, secondaryHexIds: selectedHexIds.slice(1) }
      : { anchorHexId };

  return canStartPlaceTile(state, playerId, tileId, draft).ok ? draft : null;
}

export function getPlacementDraftForHex(
  state: GameState,
  playerId: string,
  tileId: string,
  hexId: string,
  placementOrientation: HexDirection
): TilePlacementDraft | null {
  const footprintKind = getTileFootprintKind(tileId);
  if (footprintKind === "detached") return null;

  if (footprintKind === "line") {
    const preferredDraft = { anchorHexId: hexId, orientation: placementOrientation };
    if (canStartPlaceTile(state, playerId, tileId, preferredDraft).ok) {
      return preferredDraft;
    }

    const fallbackOrientation = hexDirections.find((orientation) =>
      canStartPlaceTile(state, playerId, tileId, {
        anchorHexId: hexId,
        orientation
      }).ok
    );

    return fallbackOrientation === undefined
      ? null
      : { anchorHexId: hexId, orientation: fallbackOrientation };
  }

  const draft = { anchorHexId: hexId };
  return canStartPlaceTile(state, playerId, tileId, draft).ok ? draft : null;
}

export function getPlaceTileChoices(
  state: GameState,
  playerId: string,
  selectedHexIds: string[],
  placementOrientation: HexDirection,
  selectedTileId?: string
): PlaceTileChoice[] {
  const pinSelectedLineTile =
    selectedTileId !== undefined && getTileFootprintKind(selectedTileId) === "line";

  return [
    ...coreTiles.map((tile) => ({
      id: tile.id,
      name: tile.basic.name,
      effectText: tile.basic.effectText,
      label: tile.category,
      cost: tile.basic.cost,
      placement: tile.placement?.text ?? "No placement restriction.",
      placementRequirement: tile.placement,
      meta: `${formatCategory(tile.category)} Core`,
      category: tile.category,
      kind: "core" as const
    })),
    ...specialTiles
      .filter((tile) => (state.tileSupply.special[tile.id] ?? 0) > 0)
      .map((tile) => ({
        id: tile.id,
        name: tile.name,
        effectText: tile.effectText,
        label: "special",
        cost: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 },
        placement: tile.placement?.text ?? "No placement restriction.",
        placementRequirement: tile.placement,
        meta: `${formatCategory(tile.category)} Special`,
        category: tile.category,
        kind: "special" as const
      }))
  ]
    .map((tile) => {
      const actionPreview = getBoonActionPreview(state, {
        action: "place",
        tileId: tile.id,
        category: tile.category,
        kind: tile.kind,
        baseCost: tile.cost
      });
      const missingResources = getMissingResources(state.warehouse, actionPreview.cost);
      const copiesRequired = getTileSupplyCopiesRequired(tile.id);
      const copiesAvailable =
        tile.kind === "core"
          ? state.tileSupply.core[tile.id] ?? 0
          : state.tileSupply.special[tile.id] ?? 0;
      const hasPlacementOption = hasPotentialPlacementOption(state, playerId, tile.id);
      const affordable = canAfford(state.warehouse, actionPreview.cost);
      const hasEnoughActions = state.actionsRemaining >= actionPreview.actionCost;
      const hasEnoughSupply = copiesAvailable >= copiesRequired;
      const selectedPlaceableNow = canPlaceAtSelectedHex(
        state,
        playerId,
        tile.id,
        selectedHexIds,
        placementOrientation
      );
      const selectionScore = getSelectionScore(
        state,
        tile.id,
        tile.placementRequirement,
        selectedHexIds,
        placementOrientation,
        selectedPlaceableNow
      );
      const blockedReasons = [
        !hasPlacementOption ? "No legal placement" : undefined,
        !hasEnoughSupply ? "No copies available" : undefined,
        !hasEnoughActions ? "No actions available" : undefined,
        !affordable && missingResources.length > 0
          ? `Need ${missingResources.join(", ")}`
          : undefined
      ].filter((reason): reason is string => Boolean(reason));

      return {
        ...tile,
        actionCost: actionPreview.actionCost,
        costLabel: formatCost(actionPreview.cost),
        affordable,
        blockedReasons,
        copiesAvailable,
        copiesRequired,
        hasEnoughSupply,
        hasPlacementOption,
        missingResources,
        selectedPlaceableNow,
        selectionScore,
        placeableNow:
          hasPlacementOption && hasEnoughSupply && hasEnoughActions && affordable
      };
    })
    .sort((a, b) => {
      if (pinSelectedLineTile && a.id !== b.id) {
        if (a.id === selectedTileId) return -1;
        if (b.id === selectedTileId) return 1;
      }
      if (a.selectedPlaceableNow !== b.selectedPlaceableNow) {
        return a.selectedPlaceableNow ? -1 : 1;
      }
      if (a.placeableNow !== b.placeableNow) return a.placeableNow ? -1 : 1;
      if (a.selectionScore !== b.selectionScore) return b.selectionScore - a.selectionScore;
      if (a.hasPlacementOption !== b.hasPlacementOption) {
        return a.hasPlacementOption ? -1 : 1;
      }
      if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function getDefaultPlaceTileId(
  state: GameState,
  playerId: string,
  selectedHexIds: string[],
  placementOrientation: HexDirection,
  avoidTileId?: string
): string {
  const choices = getPlaceTileChoices(state, playerId, selectedHexIds, placementOrientation);
  const nextChoice =
    choices.find((choice) => choice.id !== avoidTileId && choice.placeableNow) ??
    choices.find((choice) => choice.id !== avoidTileId) ??
    choices[0];

  return nextChoice?.id ?? coreTiles[0].id;
}

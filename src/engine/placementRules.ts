import { mapById, mapCells, terrainLabels } from "../data/map";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexLine, getHexNeighbors } from "./hex";
import { getBoonModifiedCost } from "./boonModifiers";
import { canAfford, getMissingResources } from "./resources";
import { getPlacedTileAtHex, isOverstrained, selectReachablePlacedTileIds } from "./reachability";
import type {
  CoreTileData,
  GameState,
  HexDirection,
  PlacedTile,
  ResourceCost,
  SpecialTileData,
  TileCategory,
  TileFootprintKind,
  TilePlacementDraft,
  TilePlacementRequirement,
  ValidationResult
} from "./types";

type PlacementInput = string | TilePlacementDraft;

interface PlacementFailureOptions {
  allowIncompleteDetached?: boolean;
  ignoreCost?: boolean;
  ignoreSupply?: boolean;
}

function emptyCost(): ResourceCost {
  return { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 };
}

export function getTileData(
  tileId: string
): CoreTileData | SpecialTileData | undefined {
  return coreTileById[tileId] ?? specialTileById[tileId];
}

export function getTileCategory(tile: PlacedTile): TileCategory {
  if (tile.kind === "special") return specialTileById[tile.tileId].category;
  return coreTileById[tile.tileId].category;
}

function getPlacement(tileId: string): TilePlacementRequirement | undefined {
  const data = getTileData(tileId);
  return data?.placement;
}

function getPlacementCost(state: GameState, tileId: string): ResourceCost {
  const data = getTileData(tileId);
  if (!data) return emptyCost();
  const baseCost = "basic" in data ? data.basic.cost : emptyCost();
  return getBoonModifiedCost(state, {
    action: "place",
    category: data.category,
    kind: "basic" in data ? "core" : "special",
    baseCost
  });
}

function availableCopies(state: GameState, tileId: string): number {
  if (tileId in state.tileSupply.core) return state.tileSupply.core[tileId];
  if (tileId in state.tileSupply.special) return state.tileSupply.special[tileId];
  return 0;
}

function toPlacementDraft(input: PlacementInput): TilePlacementDraft {
  if (typeof input === "string") return { anchorHexId: input };
  return input;
}

export function getTileFootprintSize(tileId: string): number {
  const data = getTileData(tileId);
  if (!data) return 1;
  if ("basic" in data) return data.size;
  return data.size ?? 1;
}

export function getTileFootprintKind(tileId: string): TileFootprintKind {
  const data = getTileData(tileId);
  if (!data) return "single";
  if (data.footprint) return data.footprint;
  if ("basic" in data && data.size > 1) return "line";
  return "single";
}

export function getTileSupplyCopiesRequired(tileId: string): number {
  return getTileFootprintKind(tileId) === "detached" ? getTileFootprintSize(tileId) : 1;
}

export function getTilePlacementHexIds(
  tileId: string,
  placementInput: PlacementInput
): string[] {
  const draft = toPlacementDraft(placementInput);
  if (!draft.anchorHexId) return [];

  const footprintKind = getTileFootprintKind(tileId);
  const size = getTileFootprintSize(tileId);

  if (footprintKind === "line") {
    return getHexLine(draft.anchorHexId, draft.orientation ?? 0, size);
  }

  if (footprintKind === "detached") {
    return [draft.anchorHexId, ...(draft.secondaryHexIds ?? [])].slice(0, size);
  }

  return [draft.anchorHexId];
}

function uniqueHexIds(hexIds: string[]): string[] {
  return [...new Set(hexIds)];
}

function pushUnique(reasons: string[], reason: string): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function hasAdjacentCategory(
  state: GameState,
  hexIds: string[],
  categories: TileCategory[]
): boolean {
  const neighborIds = new Set(hexIds.flatMap((hexId) => getHexNeighbors(hexId)));
  return state.map.placedTiles.some((tile) => {
    if (tile.strain >= 3) return false;
    if (!tile.hexIds.some((id) => neighborIds.has(id))) return false;
    return categories.includes(getTileCategory(tile));
  });
}

function hasAdjacentTileId(
  state: GameState,
  hexIds: string[],
  tileIds: string[]
): boolean {
  const neighborIds = new Set(hexIds.flatMap((hexId) => getHexNeighbors(hexId)));
  return state.map.placedTiles.some((tile) => {
    if (tile.strain >= 3) return false;
    if (!tile.hexIds.some((id) => neighborIds.has(id))) return false;
    return tileIds.includes(tile.tileId);
  });
}

function hasAdjacentTerrain(hexIds: string[], terrains: string[]): boolean {
  return hexIds.flatMap((hexId) => getHexNeighbors(hexId)).some((neighborId) => {
    const neighbor = mapById[neighborId];
    return neighbor ? terrains.includes(neighbor.terrain) : false;
  });
}

function isHexAdjacentToWater(hexId: string): boolean {
  const cell = mapById[hexId];
  if (!cell || cell.terrain === "water") return false;
  return getHexNeighbors(hexId).some((neighborId) => mapById[neighborId]?.terrain === "water");
}

function isActiveDocks(tile: PlacedTile): boolean {
  return tile.kind === "special" && tile.tileId === "special_docks" && !isOverstrained(tile);
}

function getPlacementNetworkContext(state: GameState, playerId: string) {
  const reachableTileIds = selectReachablePlacedTileIds(state, playerId);
  const hasReachableDocks = state.map.placedTiles.some(
    (tile) => reachableTileIds.has(tile.instanceId) && isActiveDocks(tile)
  );
  return { hasReachableDocks, reachableTileIds };
}

function connectsToReachablePlacementNetwork(
  state: GameState,
  hexIds: string[],
  reachableTileIds: Set<string>,
  hasReachableDocks: boolean
): boolean {
  const neighborIds = new Set(hexIds.flatMap((hexId) => getHexNeighbors(hexId)));
  const physicallyConnected = state.map.placedTiles.some(
    (tile) =>
      reachableTileIds.has(tile.instanceId) &&
      !isOverstrained(tile) &&
      tile.hexIds.some((id) => neighborIds.has(id))
  );

  return physicallyConnected || (hasReachableDocks && hexIds.some(isHexAdjacentToWater));
}

function getPlacementFailuresInternal(
  state: GameState,
  playerId: string,
  tileId: string,
  placementInput: PlacementInput,
  options: PlacementFailureOptions = {}
): string[] {
  const reasons: string[] = [];
  const draft = toPlacementDraft(placementInput);
  const tile = getTileData(tileId);
  const player = state.players.find((candidate) => candidate.id === playerId);
  const footprintKind = getTileFootprintKind(tileId);
  const expectedSize = getTileFootprintSize(tileId);
  const footprintHexIds = getTilePlacementHexIds(tileId, draft);
  const selectedHexIds = uniqueHexIds(footprintHexIds);
  const cells = selectedHexIds.map((hexId) => mapById[hexId]).filter(Boolean);
  const placementNetwork = player
    ? getPlacementNetworkContext(state, playerId)
    : { hasReachableDocks: false, reachableTileIds: new Set<string>() };

  if (!draft.anchorHexId) reasons.push("Cannot place here: choose a map hex.");
  if (!tile) reasons.push("Cannot place here: this tile is not in the current data.");
  if (!player) reasons.push("Cannot place here: no acting Steward was found.");

  if (!draft.anchorHexId || !tile || !player) return reasons;

  if (footprintKind === "line" && footprintHexIds.length < expectedSize) {
    reasons.push("Cannot place here: this footprint would leave the map.");
  }

  if (
    footprintKind === "detached" &&
    footprintHexIds.length < expectedSize &&
    !options.allowIncompleteDetached
  ) {
    reasons.push(`Cannot place here: choose ${expectedSize} spaces for this tile.`);
  }

  if (selectedHexIds.length !== footprintHexIds.length) {
    reasons.push("Cannot place here: each part of this tile needs a different hex.");
  }

  for (const hexId of selectedHexIds) {
    const cell = mapById[hexId];
    if (!cell) {
      pushUnique(reasons, "Cannot place here: this footprint includes a hex that is not on the map.");
      continue;
    }
    if (getPlacedTileAtHex(state, hexId)) {
      reasons.push(`Cannot place here: ${hexId} is occupied.`);
    }
  }

  if (selectedHexIds.length === 0 || cells.length === 0) return reasons;

  if (!player.hasPlacedFirstTile && !selectedHexIds.includes(player.stewardHexId)) {
    reasons.push(
      "Cannot place here: your first action must include your Steward Token's starting hex."
    );
  }

  const requiredCopies = getTileSupplyCopiesRequired(tileId);
  if (!options.ignoreSupply && availableCopies(state, tileId) < requiredCopies) {
    reasons.push("Cannot place here: no copies available.");
  }

  const placement = getPlacement(tileId);
  const allowsWater = placement?.terrain?.includes("water") ?? false;
  for (const cell of cells) {
    if (cell.terrain === "water" && !allowsWater) {
      pushUnique(reasons, "Cannot place here: this footprint includes River/Water.");
    }

    if (placement?.terrain && !placement.terrain.includes(cell.terrain)) {
      const allowed = placement.terrain
        .map((terrain) => terrainLabels[terrain])
        .join(", ");
      pushUnique(reasons, `Cannot place here: this tile requires ${allowed}.`);
    }
  }

  if (
    placement?.adjacentToCategory &&
    !hasAdjacentCategory(state, selectedHexIds, placement.adjacentToCategory)
  ) {
    reasons.push(
      `Cannot place here: this tile must be adjacent to ${placement.adjacentToCategory.join(
        " or "
      )}.`
    );
  }

  if (
    placement?.adjacentToTileIds &&
    !hasAdjacentTileId(state, selectedHexIds, placement.adjacentToTileIds)
  ) {
    reasons.push(
      `Cannot place here: this tile must be adjacent to ${placement.text ?? "a specific tile"}.`
    );
  }

  if (
    placement?.adjacentToTerrain &&
    !hasAdjacentTerrain(selectedHexIds, placement.adjacentToTerrain)
  ) {
    reasons.push(
      `Cannot place here: this tile must be adjacent to ${placement.adjacentToTerrain.join(
        " or "
      )} terrain.`
    );
  }

  const isFirstPlacement =
    !player.hasPlacedFirstTile && selectedHexIds.includes(player.stewardHexId);

  if (footprintKind === "detached") {
    const disconnectedHexIds = selectedHexIds.filter((hexId) => {
      if (isFirstPlacement && hexId === player.stewardHexId) return false;
      return !connectsToReachablePlacementNetwork(
        state,
        [hexId],
        placementNetwork.reachableTileIds,
        placementNetwork.hasReachableDocks
      );
    });

    if (disconnectedHexIds.length > 0) {
      reasons.push(
        `Cannot place here: ${disconnectedHexIds.join(
          ", "
        )} must connect to the acting Steward's reachable settlement network.`
      );
    }
  } else if (
    !isFirstPlacement &&
    state.map.placedTiles.length > 0 &&
    !connectsToReachablePlacementNetwork(
      state,
      selectedHexIds,
      placementNetwork.reachableTileIds,
      placementNetwork.hasReachableDocks
    )
  ) {
    reasons.push(
      "Cannot place here: not connected to the acting Steward's reachable settlement network."
    );
  }

  const cost = getPlacementCost(state, tileId);
  if (!options.ignoreCost && !canAfford(state.warehouse, cost)) {
    for (const missing of getMissingResources(state.warehouse, cost)) {
      reasons.push(`Cannot place here: insufficient ${missing}.`);
    }
  }

  return reasons;
}

export function getPlacementFailures(
  state: GameState,
  playerId: string,
  tileId: string,
  placementInput: PlacementInput
): string[] {
  return getPlacementFailuresInternal(state, playerId, tileId, placementInput);
}

export function canPlaceTile(
  state: GameState,
  playerId: string,
  tileId: string,
  placementInput: PlacementInput
): ValidationResult {
  const reasons = getPlacementFailures(state, playerId, tileId, placementInput);
  return { ok: reasons.length === 0, reasons };
}

export function getLegalPlacementHexes(
  state: GameState,
  playerId: string,
  tileId: string,
  draft: TilePlacementDraft = {}
): string[] {
  const footprintKind = getTileFootprintKind(tileId);
  const selectedHexIds = getTilePlacementHexIds(tileId, draft);

  if (footprintKind === "detached") {
    const expectedSize = getTileFootprintSize(tileId);
    if (selectedHexIds.length >= expectedSize) {
      return selectedHexIds.filter((hexId) => mapById[hexId]);
    }

    if (selectedHexIds.length === 0) {
      return mapCells
        .filter(
          (cell) =>
            getPlacementFailuresInternal(
              state,
              playerId,
              tileId,
              { ...draft, anchorHexId: cell.id },
              { allowIncompleteDetached: true }
            ).length === 0
        )
        .map((cell) => cell.id);
    }

    return mapCells
      .filter((cell) => {
        if (selectedHexIds.includes(cell.id)) return false;
        return canPlaceTile(state, playerId, tileId, {
          ...draft,
          anchorHexId: selectedHexIds[0],
          secondaryHexIds: [...selectedHexIds.slice(1), cell.id]
        }).ok;
      })
      .map((cell) => cell.id);
  }

  return mapCells
    .filter((cell) =>
      canPlaceTile(state, playerId, tileId, {
        ...draft,
        anchorHexId: cell.id,
        orientation: (draft.orientation ?? 0) as HexDirection
      }).ok
    )
    .map((cell) => cell.id);
}

function hasPotentialPlacementWithSelection(
  state: GameState,
  playerId: string,
  tileId: string,
  draft: TilePlacementDraft
): boolean {
  return (
    getPlacementFailuresInternal(state, playerId, tileId, draft, {
      allowIncompleteDetached: true,
      ignoreCost: true,
      ignoreSupply: true
    }).length === 0
  );
}

function hasCompleteDetachedPlacement(
  state: GameState,
  playerId: string,
  tileId: string,
  selectedHexIds: string[]
): boolean {
  const expectedSize = getTileFootprintSize(tileId);
  if (selectedHexIds.length >= expectedSize) {
    return (
      getPlacementFailuresInternal(
        state,
        playerId,
        tileId,
        {
          anchorHexId: selectedHexIds[0],
          secondaryHexIds: selectedHexIds.slice(1)
        },
        { ignoreCost: true, ignoreSupply: true }
      ).length === 0
    );
  }

  return mapCells.some((cell) => {
    if (selectedHexIds.includes(cell.id)) return false;
    return hasPotentialPlacementWithSelection(state, playerId, tileId, {
      anchorHexId: selectedHexIds[0] ?? cell.id,
      secondaryHexIds:
        selectedHexIds.length === 0
          ? []
          : [...selectedHexIds.slice(1), cell.id]
    })
      ? hasCompleteDetachedPlacement(
          state,
          playerId,
          tileId,
          selectedHexIds.length === 0 ? [cell.id] : [...selectedHexIds, cell.id]
        )
      : false;
  });
}

export function hasPotentialPlacementOption(
  state: GameState,
  playerId: string,
  tileId: string
): boolean {
  const footprintKind = getTileFootprintKind(tileId);

  if (footprintKind === "detached") {
    return hasCompleteDetachedPlacement(state, playerId, tileId, []);
  }

  const directions: HexDirection[] =
    footprintKind === "line" ? [0, 1, 2, 3, 4, 5] : [0];

  return directions.some((orientation) =>
    mapCells.some(
      (cell) =>
        getPlacementFailuresInternal(
          state,
          playerId,
          tileId,
          { anchorHexId: cell.id, orientation },
          { ignoreCost: true, ignoreSupply: true }
        ).length === 0
    )
  );
}

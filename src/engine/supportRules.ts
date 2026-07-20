import { getHexNeighbors } from "./hex";
import { intrinsicallySupportedTileSides } from "../data/contentRules";
import { arePlacedTilesAdjacent, getPlacedTileCategory } from "./placedTiles";
import { selectConnectedPlacedTileIds } from "./reachability";
import type { GameState, PlacedTile } from "./types";

export interface NeighbourlySupportCluster {
  tileIds: string[];
  eligibleTileIds: string[];
  awardCount: number;
  requiredSelectionCount: number;
}

/**
 * Finds Housing clusters for the Season I/II Neighbourly Support step.
 * Overstrained Housing is removed before connectivity is calculated, so it
 * neither increases cluster size nor bridges two otherwise separate groups.
 */
export function getNeighbourlySupportClusters(
  state: Pick<GameState, "map">
): NeighbourlySupportCluster[] {
  const housingTiles = state.map.placedTiles.filter(
    (tile) => tile.strain < 3 && getPlacedTileCategory(tile) === "housing"
  );
  const remainingIds = new Set(housingTiles.map((tile) => tile.instanceId));
  const clusters: NeighbourlySupportCluster[] = [];

  for (const firstTile of housingTiles) {
    if (!remainingIds.has(firstTile.instanceId)) continue;

    const clusterTiles: PlacedTile[] = [];
    const queue = [firstTile];
    remainingIds.delete(firstTile.instanceId);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      clusterTiles.push(current);

      for (const candidate of housingTiles) {
        if (!remainingIds.has(candidate.instanceId)) continue;
        if (!arePlacedTilesAdjacent(current, candidate)) continue;
        remainingIds.delete(candidate.instanceId);
        queue.push(candidate);
      }
    }

    const awardCount = Math.floor(clusterTiles.length / 3);
    if (awardCount === 0) continue;

    const eligibleTileIds = clusterTiles
      .filter((tile) => !tile.support.passive && !tile.support.singleUse)
      .map((tile) => tile.instanceId);
    clusters.push({
      tileIds: clusterTiles.map((tile) => tile.instanceId),
      eligibleTileIds,
      awardCount,
      requiredSelectionCount: Math.min(awardCount, eligibleTileIds.length)
    });
  }

  return clusters;
}

export function getNeighbourlySupportAwardCount(
  state: Pick<GameState, "map">
): number {
  return getNeighbourlySupportClusters(state).reduce(
    (total, cluster) => total + cluster.awardCount,
    0
  );
}

export function getNeighbourlySupportRequiredSelectionCount(
  state: Pick<GameState, "map">
): number {
  return getNeighbourlySupportClusters(state).reduce(
    (total, cluster) => total + cluster.requiredSelectionCount,
    0
  );
}

export function getNeighbourlySupportEligibleTiles(
  state: Pick<GameState, "map">
): PlacedTile[] {
  const eligibleIds = new Set(
    getNeighbourlySupportClusters(state).flatMap(
      (cluster) => cluster.eligibleTileIds
    )
  );
  return state.map.placedTiles.filter((tile) => eligibleIds.has(tile.instanceId));
}

export function isNeighbourlySupportSelectionValid(
  state: Pick<GameState, "map">,
  selectedTileIds: readonly string[]
): boolean {
  const selectedIds = new Set(selectedTileIds);
  if (selectedIds.size !== selectedTileIds.length) return false;

  const clusters = getNeighbourlySupportClusters(state);
  const eligibleIds = new Set(
    clusters.flatMap((cluster) => cluster.eligibleTileIds)
  );
  if ([...selectedIds].some((tileId) => !eligibleIds.has(tileId))) return false;

  return clusters.every(
    (cluster) =>
      cluster.eligibleTileIds.filter((tileId) => selectedIds.has(tileId)).length ===
      cluster.requiredSelectionCount
  );
}

function hasPrintedPassiveSupport(tile: PlacedTile): boolean {
  return intrinsicallySupportedTileSides.has(`${tile.tileId}:${tile.side}`);
}

function getLanternRoadhouseSupportedTileIds(state: GameState): Set<string> {
  const supportedIds = new Set<string>();

  const lanterns = state.map.placedTiles.filter(
    (tile) => tile.tileId === "special_lantern_roadhouse" && tile.strain < 3
  );

  for (const lantern of lanterns) {
    const connectedIds = selectConnectedPlacedTileIds(state.map.placedTiles, [lantern]);
    for (const tile of state.map.placedTiles) {
      if (!connectedIds.has(tile.instanceId)) continue;
      if (tile.strain >= 3 || getPlacedTileCategory(tile) !== "travel") continue;
      supportedIds.add(tile.instanceId);
    }
  }

  return supportedIds;
}

function getGoldenHearthSupportedTileIds(state: GameState): Set<string> {
  const supportedIds = new Set<string>();
  const hearths = state.map.placedTiles.filter(
    (tile) => tile.tileId === "golden_tile_the_golden_hearth" && tile.strain < 3
  );

  for (const tile of state.map.placedTiles) {
    if (tile.strain >= 3 || getPlacedTileCategory(tile) !== "housing") continue;
    if (
      hearths.some((hearth) =>
        hearth.hexIds.some((hexId) =>
          getHexNeighbors(hexId).some((neighborId) => tile.hexIds.includes(neighborId))
        )
      )
    ) {
      supportedIds.add(tile.instanceId);
    }
  }
  return supportedIds;
}

function getCommonLandSupportedTileIds(
  state: GameState,
  alreadySupportedIds: Set<string>
): Set<string> {
  const supportedIds = new Set<string>();
  const commonLands = state.map.placedTiles.filter(
    (tile) =>
      tile.kind === "core" &&
      tile.tileId === "c18_common_land" &&
      tile.strain < 3
  );

  for (const source of commonLands) {
    const capacity = source.side === "upgraded" ? 3 : 1;
    const candidates = state.map.placedTiles
      .filter(
        (tile) =>
          tile.instanceId !== source.instanceId &&
          tile.strain < 3 &&
          getPlacedTileCategory(tile) === "housing" &&
          source.hexIds.some((hexId) =>
            getHexNeighbors(hexId).some((neighborId) => tile.hexIds.includes(neighborId))
          )
      )
      .sort((a, b) => {
        const aAlreadySupported =
          alreadySupportedIds.has(a.instanceId) || supportedIds.has(a.instanceId);
        const bAlreadySupported =
          alreadySupportedIds.has(b.instanceId) || supportedIds.has(b.instanceId);
        return Number(aAlreadySupported) - Number(bAlreadySupported);
      });

    for (const tile of candidates.slice(0, capacity)) {
      supportedIds.add(tile.instanceId);
    }
  }

  return supportedIds;
}

export function recalculatePassiveSupported(state: GameState): GameState {
  const lanternSupportedIds = getLanternRoadhouseSupportedTileIds(state);
  const goldenHearthSupportedIds = getGoldenHearthSupportedTileIds(state);
  const intrinsicSupportedIds = new Set(
    state.map.placedTiles
      .filter(hasPrintedPassiveSupport)
      .map((tile) => tile.instanceId)
  );
  const alreadySupportedIds = new Set([
    ...intrinsicSupportedIds,
    ...lanternSupportedIds,
    ...goldenHearthSupportedIds
  ]);
  const commonLandSupportedIds = getCommonLandSupportedTileIds(
    state,
    alreadySupportedIds
  );
  let changed = false;

  const placedTiles = state.map.placedTiles.map((tile) => {
    const passive =
      intrinsicSupportedIds.has(tile.instanceId) ||
      lanternSupportedIds.has(tile.instanceId) ||
      goldenHearthSupportedIds.has(tile.instanceId) ||
      commonLandSupportedIds.has(tile.instanceId);
    if (tile.support.passive === passive) return tile;

    changed = true;
    return {
      ...tile,
      support: {
        ...tile.support,
        passive
      }
    };
  });

  return changed ? { ...state, map: { placedTiles } } : state;
}

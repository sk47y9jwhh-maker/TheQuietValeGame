import { arePlacedTilesAdjacent, getPlacedTileCategory } from "./placedTiles";
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

export function recalculatePassiveSupported(state: GameState): GameState {
  // Supported is single-use only (bronze shield). Common Land, The Pleasance,
  // Stone Bridge, and The Golden Hearth use once-per-round Strain prevention
  // tracked in tileActivationRecords instead of Passive Supported.
  let changed = false;
  const placedTiles = state.map.placedTiles.map((tile) => {
    if (!tile.support.passive) return tile;
    changed = true;
    return {
      ...tile,
      support: {
        ...tile.support,
        passive: false
      }
    };
  });

  return changed ? { ...state, map: { placedTiles } } : state;
}

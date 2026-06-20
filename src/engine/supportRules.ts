import { coreTileById, specialTileById } from "../data/tiles";
import { areTilesNetworkAdjacent } from "./reachability";
import type { GameState, PlacedTile, TileCategory } from "./types";

function getTileCategory(tile: PlacedTile): TileCategory {
  if (tile.kind === "special") return specialTileById[tile.tileId].category;
  return coreTileById[tile.tileId].category;
}

function getTileEffectText(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.effectText ?? "";
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.effectText : data.basic.effectText;
}

function hasPrintedPassiveSupport(tile: PlacedTile): boolean {
  return /\.\s*Supported\.?$/i.test(getTileEffectText(tile));
}

function getConnectedSettlementTileIds(state: GameState, root: PlacedTile): Set<string> {
  if (root.strain >= 3) return new Set();

  const connected = new Set<string>([root.instanceId]);
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    for (const candidate of state.map.placedTiles) {
      if (connected.has(candidate.instanceId)) continue;
      if (!areTilesNetworkAdjacent(current, candidate)) continue;
      connected.add(candidate.instanceId);
      queue.push(candidate);
    }
  }

  return connected;
}

function getLanternRoadhouseSupportedTileIds(state: GameState): Set<string> {
  const supportedIds = new Set<string>();

  const lanterns = state.map.placedTiles.filter(
    (tile) => tile.tileId === "special_lantern_roadhouse" && tile.strain < 3
  );

  for (const lantern of lanterns) {
    const connectedIds = getConnectedSettlementTileIds(state, lantern);
    for (const tile of state.map.placedTiles) {
      if (!connectedIds.has(tile.instanceId)) continue;
      if (tile.strain >= 3 || getTileCategory(tile) !== "travel") continue;
      supportedIds.add(tile.instanceId);
    }
  }

  return supportedIds;
}

export function recalculatePassiveSupported(state: GameState): GameState {
  const lanternSupportedIds = getLanternRoadhouseSupportedTileIds(state);
  let changed = false;

  const placedTiles = state.map.placedTiles.map((tile) => {
    const passive = hasPrintedPassiveSupport(tile) || lanternSupportedIds.has(tile.instanceId);
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

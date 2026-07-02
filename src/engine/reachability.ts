import { coreTileById } from "../data/tiles";
import { mapById, mapColumns } from "../data/map";
import { getHexNeighbors } from "./hex";
import type { GameState, PlacedTile } from "./types";

export function getPlacedTileAtHex(
  state: Pick<GameState, "map">,
  hexId: string
): PlacedTile | undefined {
  return state.map.placedTiles.find((tile) => tile.hexIds.includes(hexId));
}

export function isOverstrained(tile: Pick<PlacedTile, "strain">): boolean {
  return tile.strain >= 3;
}

export function tileConnectsAcrossWater(tile: PlacedTile): boolean {
  if (tile.kind !== "core") return false;
  const data = coreTileById[tile.tileId];
  return data?.basic.name === "Bridge" || data?.upgraded.name === "Stone Bridge";
}

function isBridge(tile: PlacedTile): boolean {
  if (tile.kind !== "core") return false;
  const data = coreTileById[tile.tileId];
  return data?.basic.name === "Bridge" || data?.upgraded.name === "Stone Bridge";
}

/**
 * A bridge only forms a completed crossing when settlement tiles actually meet
 * it from both banks. Merely having unrelated tiles somewhere west and east of
 * the river is not enough.
 */
export function hasConnectedBridgeCrossing(tiles: PlacedTile[]): boolean {
  const eligibleTiles = tiles.filter((tile) => !isOverstrained(tile));

  return eligibleTiles.filter(isBridge).some((bridge) => {
    const bridgeHex = bridge.hexIds[0];
    const bridgeCell = mapById[bridgeHex];
    if (!bridgeCell || bridgeCell.terrain !== "water") return false;

    const bridgeCol = mapColumns.indexOf(bridgeCell.col);
    const adjacentTiles = eligibleTiles.filter(
      (tile) =>
        tile.instanceId !== bridge.instanceId &&
        tile.hexIds.some((hexId) => getHexNeighbors(bridgeHex).includes(hexId))
    );
    const touchesWestBank = adjacentTiles.some((tile) =>
      tile.hexIds.some(
        (hexId) => mapColumns.indexOf(mapById[hexId]?.col ?? bridgeCell.col) < bridgeCol
      )
    );
    const touchesEastBank = adjacentTiles.some((tile) =>
      tile.hexIds.some(
        (hexId) => mapColumns.indexOf(mapById[hexId]?.col ?? bridgeCell.col) > bridgeCol
      )
    );

    return touchesWestBank && touchesEastBank;
  });
}

function isActiveDocks(tile: PlacedTile): boolean {
  return tile.kind === "special" && tile.tileId === "special_docks" && !isOverstrained(tile);
}

function isTileAdjacentToWater(tile: PlacedTile): boolean {
  return tile.hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => mapById[neighborId]?.terrain === "water")
  );
}

function areTilesConnectedByDocks(a: PlacedTile, b: PlacedTile): boolean {
  return (
    (isActiveDocks(a) && isTileAdjacentToWater(b)) ||
    (isActiveDocks(b) && isTileAdjacentToWater(a))
  );
}

export function areTilesNetworkAdjacent(a: PlacedTile, b: PlacedTile): boolean {
  if (isOverstrained(a) || isOverstrained(b)) return false;

  return (
    a.hexIds.some((aHex) =>
      b.hexIds.some((bHex) => getHexNeighbors(aHex).includes(bHex))
    ) || areTilesConnectedByDocks(a, b)
  );
}

export function selectReachablePlacedTileIds(
  state: GameState,
  playerId: string
): Set<string> {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return new Set();

  const candidateStartingTiles = [
    getPlacedTileAtHex(state, player.stewardHexId),
    player.temporaryReachHexId
      ? getPlacedTileAtHex(state, player.temporaryReachHexId)
      : undefined
  ];
  const startingTiles = candidateStartingTiles.filter((tile, index): tile is PlacedTile => {
    if (!tile || isOverstrained(tile)) return false;
    return (
      candidateStartingTiles.findIndex(
        (candidate) => candidate?.instanceId === tile.instanceId
      ) === index
    );
  });

  const reachable = new Set<string>(startingTiles.map((tile) => tile.instanceId));
  const queue = [...startingTiles];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    for (const candidate of state.map.placedTiles) {
      if (reachable.has(candidate.instanceId)) continue;
      if (!areTilesNetworkAdjacent(current, candidate)) continue;
      reachable.add(candidate.instanceId);
      queue.push(candidate);
    }
  }

  return reachable;
}

export function isTileReachable(
  state: GameState,
  playerId: string,
  placedTileId: string
): boolean {
  return selectReachablePlacedTileIds(state, playerId).has(placedTileId);
}

import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import type { PlacedTile, TileCategory } from "./types";

export function getPlacedTileName(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.name ?? tile.tileId;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.name : data.basic.name;
}

export function getPlacedTileCategory(tile: PlacedTile): TileCategory {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.category ?? "special";
  return coreTileById[tile.tileId]?.category ?? "special";
}

export function getPlacedTileEffectText(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.effectText ?? tile.tileId;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.effectText : data.basic.effectText;
}

export function getPlacedTileRenown(tile: PlacedTile): number {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.renown ?? 0;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.renown : data.basic.renown;
}

export function arePlacedTilesAdjacent(a: PlacedTile, b: PlacedTile): boolean {
  return a.hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => b.hexIds.includes(neighborId))
  );
}

export function isPlacedTileAdjacentToCategory(
  tile: PlacedTile,
  tiles: PlacedTile[],
  category: TileCategory,
  options: { includeOverstrained?: boolean } = {}
): boolean {
  return tiles.some(
    (candidate) =>
      candidate.instanceId !== tile.instanceId &&
      (options.includeOverstrained || candidate.strain < 3) &&
      getPlacedTileCategory(candidate) === category &&
      arePlacedTilesAdjacent(tile, candidate)
  );
}

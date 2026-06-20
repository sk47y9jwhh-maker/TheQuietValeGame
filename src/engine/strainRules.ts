import type { PlacedTile } from "./types";

export function applyStrainToTile(tile: PlacedTile, amount: number): PlacedTile {
  if (amount <= 0) return tile;

  if ((tile.support.passive || tile.support.singleUse) && !tile.support.preventedThisRound) {
    const remaining = amount - 1;
    return {
      ...tile,
      strain: Math.min(3, tile.strain + remaining),
      support: {
        passive: tile.support.passive,
        singleUse: false,
        preventedThisRound: true
      }
    };
  }

  return {
    ...tile,
    strain: Math.min(3, tile.strain + amount)
  };
}

export function removeStrainFromTile(tile: PlacedTile, amount: number): PlacedTile {
  return {
    ...tile,
    strain: Math.max(0, tile.strain - amount)
  };
}

export function refreshPassiveSupported(tile: PlacedTile): PlacedTile {
  return {
    ...tile,
    support: {
      ...tile.support,
      preventedThisRound: false,
      singleUse: tile.support.singleUse
    }
  };
}


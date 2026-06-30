import { getHexNeighbors } from "./hex";
import type { GameState, PlacedTile } from "./types";

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

function areTilesAdjacent(a: PlacedTile, b: PlacedTile): boolean {
  return a.hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => b.hexIds.includes(neighborId))
  );
}

export function applyStrainToState(
  state: GameState,
  targetTileId: string,
  amount: number
): GameState {
  const target = state.map.placedTiles.find((tile) => tile.instanceId === targetTileId);
  if (!target || amount <= 0) return state;
  const garden = state.map.placedTiles.find(
    (tile) =>
      tile.tileId === "golden_tile_the_golden_garden" &&
      tile.strain < 3 &&
      areTilesAdjacent(tile, target) &&
      state.tileActivationRecords[tile.instanceId]?.round !== state.round
  );
  const nextTarget = applyStrainToTile(target, Math.max(0, amount - (garden ? 1 : 0)));

  return {
    ...state,
    map: {
      placedTiles: state.map.placedTiles.map((tile) =>
        tile.instanceId === target.instanceId ? nextTarget : tile
      )
    },
    tileActivationRecords: garden
      ? {
          ...state.tileActivationRecords,
          [garden.instanceId]: {
            ...state.tileActivationRecords[garden.instanceId],
            round: state.round
          }
        }
      : state.tileActivationRecords,
    log: garden
      ? [
          {
            id: `log_${state.log.length + 1}_${Date.now()}`,
            round: state.round,
            message: "The Golden Garden prevented 1 Strain."
          },
          ...state.log
        ].slice(0, 80)
      : state.log
  };
}

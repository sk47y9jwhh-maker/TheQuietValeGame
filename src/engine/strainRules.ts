import { getHexNeighbors } from "./hex";
import { getPlacedTileCategory } from "./placedTiles";
import { selectConnectedPlacedTileIds } from "./reachability";
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

function getPreventedTargetsThisRound(
  state: GameState,
  sourceTileId: string,
  preventionRound: number
): string[] {
  const record = state.tileActivationRecords[sourceTileId];
  if (record?.round !== preventionRound) return [];
  return record.preventedTargetIds ?? [];
}

function getAvailableStoneBridge(
  state: GameState,
  target: PlacedTile,
  preventionRound: number
): PlacedTile | undefined {
  if (
    target.tileId === "c19_bridge" &&
    target.side === "upgraded" &&
    target.strain < 3 &&
    state.tileActivationRecords[target.instanceId]?.round !== preventionRound
  ) {
    return target;
  }
  return undefined;
}

function getAvailableCommonLand(
  state: GameState,
  target: PlacedTile,
  preventionRound: number
): PlacedTile | undefined {
  if (getPlacedTileCategory(target) !== "housing" || target.strain >= 3) {
    return undefined;
  }
  return state.map.placedTiles.find((tile) => {
    if (
      tile.kind !== "core" ||
      tile.tileId !== "c18_common_land" ||
      tile.strain >= 3 ||
      !areTilesAdjacent(tile, target)
    ) {
      return false;
    }
    const capacity = tile.side === "upgraded" ? 3 : 1;
    const used = getPreventedTargetsThisRound(state, tile.instanceId, preventionRound);
    return used.length < capacity && !used.includes(target.instanceId);
  });
}

function getAvailableGoldenHearth(
  state: GameState,
  target: PlacedTile,
  preventionRound: number
): PlacedTile | undefined {
  if (getPlacedTileCategory(target) !== "housing" || target.strain >= 3) {
    return undefined;
  }
  return state.map.placedTiles.find((tile) => {
    if (
      tile.tileId !== "golden_tile_the_golden_hearth" ||
      tile.strain >= 3 ||
      !areTilesAdjacent(tile, target)
    ) {
      return false;
    }
    const used = getPreventedTargetsThisRound(state, tile.instanceId, preventionRound);
    return !used.includes(target.instanceId);
  });
}

function getAvailableGoldenGarden(
  state: GameState,
  target: PlacedTile,
  preventionRound: number
): PlacedTile | undefined {
  return state.map.placedTiles.find(
    (tile) =>
      tile.tileId === "golden_tile_the_golden_garden" &&
      tile.strain < 3 &&
      areTilesAdjacent(tile, target) &&
      state.tileActivationRecords[tile.instanceId]?.round !== preventionRound
  );
}

function getAvailableLanternRoadhouse(
  state: GameState,
  target: PlacedTile,
  preventionRound: number
): PlacedTile | undefined {
  if (getPlacedTileCategory(target) !== "travel") return undefined;

  return state.map.placedTiles.find((tile) => {
    if (
      tile.tileId !== "special_lantern_roadhouse" ||
      tile.strain >= 3 ||
      state.tileActivationRecords[tile.instanceId]?.round === preventionRound
    ) {
      return false;
    }
    return selectConnectedPlacedTileIds(state.map.placedTiles, [tile]).has(
      target.instanceId
    );
  });
}

export function getStrainPreventionPreview(
  state: GameState,
  target: PlacedTile,
  preventionRound = state.round
): {
  supported: boolean;
  stoneBridgeTileId?: string;
  commonLandTileId?: string;
  goldenHearthTileId?: string;
  goldenGardenTileId?: string;
  lanternRoadhouseTileId?: string;
} {
  const stoneBridge = getAvailableStoneBridge(state, target, preventionRound);
  const commonLand = getAvailableCommonLand(state, target, preventionRound);
  const goldenHearth = getAvailableGoldenHearth(state, target, preventionRound);
  const goldenGarden = getAvailableGoldenGarden(
    state,
    target,
    preventionRound
  );
  const lanternRoadhouse = getAvailableLanternRoadhouse(
    state,
    target,
    preventionRound
  );
  return {
    supported:
      (target.support.passive || target.support.singleUse) &&
      !target.support.preventedThisRound,
    stoneBridgeTileId: stoneBridge?.instanceId,
    commonLandTileId: commonLand?.instanceId,
    goldenHearthTileId: goldenHearth?.instanceId,
    goldenGardenTileId: goldenGarden?.instanceId,
    lanternRoadhouseTileId: lanternRoadhouse?.instanceId
  };
}

export function getStrainPlacementCapacity(
  state: GameState,
  target: PlacedTile,
  maxAmount = Number.MAX_SAFE_INTEGER,
  preventionRound = state.round
): number {
  const prevention = getStrainPreventionPreview(
    state,
    target,
    preventionRound
  );
  const preventionCount =
    (prevention.supported ? 1 : 0) +
    (prevention.stoneBridgeTileId ? 1 : 0) +
    (prevention.commonLandTileId ? 1 : 0) +
    (prevention.goldenHearthTileId ? 1 : 0) +
    (prevention.goldenGardenTileId ? 1 : 0) +
    (prevention.lanternRoadhouseTileId ? 1 : 0);
  return Math.min(
    maxAmount,
    Math.max(0, 3 - target.strain) + preventionCount
  );
}

export function applyStrainToState(
  state: GameState,
  targetTileId: string,
  amount: number,
  preventionRound = state.round
): GameState {
  const target = state.map.placedTiles.find((tile) => tile.instanceId === targetTileId);
  if (!target || amount <= 0) return state;

  let remaining = amount;
  const tileActivationRecords = { ...state.tileActivationRecords };
  const preventionMessages: string[] = [];

  const stoneBridge = remaining > 0
    ? getAvailableStoneBridge(state, target, preventionRound)
    : undefined;
  if (stoneBridge) {
    remaining -= 1;
    tileActivationRecords[stoneBridge.instanceId] = {
      ...tileActivationRecords[stoneBridge.instanceId],
      round: preventionRound
    };
    preventionMessages.push("Stone Bridge prevented 1 Strain.");
  }

  const commonLand = remaining > 0
    ? getAvailableCommonLand(state, target, preventionRound)
    : undefined;
  if (commonLand) {
    remaining -= 1;
    const prevTargets = getPreventedTargetsThisRound(state, commonLand.instanceId, preventionRound);
    tileActivationRecords[commonLand.instanceId] = {
      ...tileActivationRecords[commonLand.instanceId],
      round: preventionRound,
      preventedTargetIds: [...prevTargets, target.instanceId]
    };
    preventionMessages.push(
      `${commonLand.side === "upgraded" ? "The Pleasance" : "Common Land"} prevented 1 Strain.`
    );
  }

  const goldenHearth = remaining > 0
    ? getAvailableGoldenHearth(state, target, preventionRound)
    : undefined;
  if (goldenHearth) {
    remaining -= 1;
    const prevTargets = getPreventedTargetsThisRound(state, goldenHearth.instanceId, preventionRound);
    tileActivationRecords[goldenHearth.instanceId] = {
      ...tileActivationRecords[goldenHearth.instanceId],
      round: preventionRound,
      preventedTargetIds: [...prevTargets, target.instanceId]
    };
    preventionMessages.push("The Golden Hearth prevented 1 Strain.");
  }

  const garden = remaining > 0
    ? getAvailableGoldenGarden(state, target, preventionRound)
    : undefined;
  if (garden) {
    remaining -= 1;
    tileActivationRecords[garden.instanceId] = {
      ...tileActivationRecords[garden.instanceId],
      round: preventionRound
    };
    preventionMessages.push("The Golden Garden prevented 1 Strain.");
  }

  const lantern = remaining > 0
    ? getAvailableLanternRoadhouse(state, target, preventionRound)
    : undefined;
  if (lantern) {
    remaining -= 1;
    tileActivationRecords[lantern.instanceId] = {
      ...tileActivationRecords[lantern.instanceId],
      round: preventionRound
    };
    preventionMessages.push("Lantern Roadhouse prevented 1 Strain.");
  }

  const nextTarget = applyStrainToTile(target, remaining);

  return {
    ...state,
    map: {
      placedTiles: state.map.placedTiles.map((tile) =>
        tile.instanceId === target.instanceId ? nextTarget : tile
      )
    },
    tileActivationRecords,
    log: preventionMessages.length > 0
      ? [
          ...preventionMessages.map((message, index) => ({
            id: `log_${state.log.length + index + 1}_${Date.now()}`,
            round: preventionRound,
            message
          })),
          ...state.log
        ].slice(0, 80)
      : state.log
  };
}

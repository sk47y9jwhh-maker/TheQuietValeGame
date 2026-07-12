import { getHexNeighbors } from "./hex";
import { intrinsicallySupportedTileSides } from "../data/contentRules";
import { getPlacedTileCategory } from "./placedTiles";
import { selectConnectedPlacedTileIds } from "./reachability";
import type { GameState, PlacedTile } from "./types";

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

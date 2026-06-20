import { mapById, mapColumns } from "../data/map";
import { stewardById } from "../data/stewards";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import type { GameState, PlacedTile, TileSideData } from "./types";

const activeBurdenPenalty = 6;
const strainPenalty = 3;

function getPrintedPopulation(tile: PlacedTile): number {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.population ?? 0;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.population : data.basic.population;
}

function getPrintedRenown(tile: PlacedTile): number {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.renown ?? 0;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.renown : data.basic.renown;
}

function getTileCategory(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.category ?? "special";
  return coreTileById[tile.tileId]?.category ?? "unknown";
}

function getTileSide(tile: PlacedTile): TileSideData | null {
  if (tile.kind === "special") return null;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded : data.basic;
}

function arePlacedTilesAdjacent(a: PlacedTile, b: PlacedTile): boolean {
  return a.hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => b.hexIds.includes(neighborId))
  );
}

function getAdjacentTiles(tile: PlacedTile, tiles: PlacedTile[]): PlacedTile[] {
  return tiles.filter(
    (candidate) =>
      candidate.instanceId !== tile.instanceId && arePlacedTilesAdjacent(tile, candidate)
  );
}

function isPartOfHousingCluster(tile: PlacedTile, tiles: PlacedTile[]): boolean {
  if (getTileCategory(tile) !== "housing") return false;
  return getAdjacentTiles(tile, tiles).some(
    (candidate) => getTileCategory(candidate) === "housing"
  );
}

function getTravelGroup(tile: PlacedTile, tiles: PlacedTile[]): PlacedTile[] {
  if (getTileCategory(tile) !== "travel") return [];

  const travelTiles = tiles.filter((candidate) => getTileCategory(candidate) === "travel");
  const visited = new Set<string>([tile.instanceId]);
  const queue = [tile];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    for (const candidate of travelTiles) {
      if (visited.has(candidate.instanceId)) continue;
      if (!arePlacedTilesAdjacent(current, candidate)) continue;
      visited.add(candidate.instanceId);
      queue.push(candidate);
    }
  }

  return travelTiles.filter((candidate) => visited.has(candidate.instanceId));
}

function getPassivePopulationBonus(tile: PlacedTile, tiles: PlacedTile[]): number {
  const side = getTileSide(tile);
  if (!side || !isPartOfHousingCluster(tile, tiles)) return 0;

  const match = side.effectText.match(/\+(\d+)\s+Population if part of a Housing cluster/i);
  return match ? Number(match[1]) : 0;
}

function getPassiveRenownBonus(tile: PlacedTile, tiles: PlacedTile[]): number {
  const side = getTileSide(tile);
  if (!side) return 0;

  let total = 0;
  const adjacentTiles = getAdjacentTiles(tile, tiles);
  const adjacentCategories = adjacentTiles.map(getTileCategory);

  const adjacentTravelMatch = side.effectText.match(/\+(\d+)\s+Renown if adjacent to Travel/i);
  if (adjacentTravelMatch && adjacentCategories.includes("travel")) {
    total += Number(adjacentTravelMatch[1]);
  }

  if (
    /\+1 Renown if adjacent to 3 or more non-Travel Tiles/i.test(side.effectText) &&
    adjacentCategories.filter((category) => category !== "travel").length >= 3
  ) {
    total += 1;
  }

  if (/connected Travel group, max \+4/i.test(side.effectText)) {
    total += Math.min(4, Math.max(0, getTravelGroup(tile, tiles).length - 1));
  }

  return total;
}

function largestHousingClusterSize(tiles: PlacedTile[]): number {
  const housingTiles = tiles.filter((tile) => getTileCategory(tile) === "housing");
  const visited = new Set<string>();
  let largest = 0;

  for (const tile of housingTiles) {
    if (visited.has(tile.instanceId)) continue;
    const queue = [tile];
    visited.add(tile.instanceId);
    let size = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      size += 1;

      for (const candidate of housingTiles) {
        if (visited.has(candidate.instanceId)) continue;
        if (!arePlacedTilesAdjacent(current, candidate)) continue;
        visited.add(candidate.instanceId);
        queue.push(candidate);
      }
    }

    largest = Math.max(largest, size);
  }

  return largest;
}

function hasBridgeConnectedRiverObjective(tiles: PlacedTile[]): boolean {
  const bridges = tiles.filter((tile) => {
    if (tile.kind !== "core") return false;
    const data = coreTileById[tile.tileId];
    return data.basic.name === "Bridge" || data.upgraded.name === "Stone Bridge";
  });

  return bridges.some((bridge) => {
    const bridgeColIndex = mapColumns.indexOf(mapById[bridge.hexIds[0]]?.col ?? "A");
    const hasWest = tiles.some((tile) =>
      tile.hexIds.some((hexId) => mapColumns.indexOf(mapById[hexId]?.col ?? "A") < bridgeColIndex)
    );
    const hasEast = tiles.some((tile) =>
      tile.hexIds.some((hexId) => mapColumns.indexOf(mapById[hexId]?.col ?? "A") > bridgeColIndex)
    );
    return hasWest && hasEast;
  });
}

export function scoreStewardObjectives(state: GameState): number {
  const eligibleTiles = state.map.placedTiles.filter((tile) => tile.strain < 3);

  return state.players.reduce((total, player) => {
    const steward = stewardById[player.stewardId];
    if (!steward) return total;

    let met = false;
    if (player.stewardId === "vanguard") {
      met = hasBridgeConnectedRiverObjective(eligibleTiles);
    } else if (player.stewardId === "knight") {
      met = largestHousingClusterSize(eligibleTiles) >= 4;
    } else if (player.stewardId === "sentinel") {
      met =
        eligibleTiles.filter((tile) => tile.kind === "core" && tile.side === "upgraded")
          .length >= 5;
    } else if (player.stewardId === "ranger") {
      const terrainTypes = new Set(
        eligibleTiles
          .flatMap((tile) => tile.hexIds)
          .map((hexId) => mapById[hexId]?.terrain)
          .filter((terrain) => terrain && terrain !== "grasslands" && terrain !== "water")
      );
      met = terrainTypes.size >= 3;
    } else if (player.stewardId === "warden") {
      met = state.encounters.activeBurdens.length < state.playerCount;
    } else if (player.stewardId === "quartermaster") {
      met = Object.values(state.warehouse).filter((amount) => amount >= 5).length >= 4;
    }

    return met ? total + steward.objectiveRenown : total;
  }, 0);
}

export function calculateFinalScore(state: GameState) {
  const eligibleTiles = state.map.placedTiles.filter((tile) => tile.strain < 3);
  const printedPopulation = eligibleTiles.reduce(
    (total, tile) => total + getPrintedPopulation(tile),
    0
  );
  const passivePopulation = eligibleTiles.reduce(
    (total, tile) => total + getPassivePopulationBonus(tile, eligibleTiles),
    0
  );
  const population = printedPopulation + passivePopulation;
  const printedRenown = eligibleTiles.reduce((total, tile) => total + getPrintedRenown(tile), 0);
  const passiveRenown = eligibleTiles.reduce(
    (total, tile) => total + getPassiveRenownBonus(tile, eligibleTiles),
    0
  );
  const stewardObjectiveRenown = scoreStewardObjectives(state);
  const burdenPenalty = state.encounters.activeBurdens.length * activeBurdenPenalty;
  const strainTokens = state.map.placedTiles.reduce((total, tile) => total + tile.strain, 0);
  const strainPenaltyTotal = strainTokens * strainPenalty;
  const renown =
    printedRenown +
    passiveRenown +
    stewardObjectiveRenown -
    burdenPenalty -
    strainPenaltyTotal;

  return {
    printedPopulation,
    passivePopulation,
    population,
    printedRenown,
    passiveRenown,
    stewardObjectiveRenown,
    burdenPenalty,
    strainPenalty: strainPenaltyTotal,
    finalScore: population + renown
  };
}

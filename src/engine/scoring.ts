import { mapById, terrainLabels } from "../data/map";
import { encounterById } from "../data/encounters";
import { stewardById } from "../data/stewards";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import { hasConnectedBridgeCrossing } from "./reachability";
import type { GameState, PlacedTile, TileSideData } from "./types";

const activeBurdenPenalty = 5;
const strainPenalty = 5;
const failedArrivalPenalty = 5;

function countFailedArrivals(state: GameState): number {
  return state.encounters.discardPile.filter(
    (cardId) => encounterById[cardId]?.type === "arrival"
  ).length;
}

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

function scoreGoldenTiles(state: GameState, eligibleTiles: PlacedTile[]): number {
  let total = 0;
  const eligibleByHex = new Map(
    eligibleTiles.flatMap((tile) => tile.hexIds.map((hexId) => [hexId, tile] as const))
  );

  for (const golden of eligibleTiles.filter((tile) =>
    tile.tileId.startsWith("golden_tile_")
  )) {
    let met = false;
    if (golden.tileId === "golden_tile_the_golden_charter") {
      const categories = new Set(
        getAdjacentTiles(golden, eligibleTiles)
          .map(getTileCategory)
          .filter((category) => category !== "special" && category !== "unknown")
      );
      met = categories.size >= 4;
    } else if (golden.tileId === "golden_tile_the_golden_hearth") {
      const neighbors = getHexNeighbors(golden.hexIds[0]);
      const surroundingTileIds = new Set(
        neighbors.map((hexId) => eligibleByHex.get(hexId)?.instanceId).filter(Boolean)
      );
      met = neighbors.length === 6 && surroundingTileIds.size === 6;
    } else if (golden.tileId === "golden_tile_the_golden_river_gate") {
      met = hasConnectedBridgeCrossing(eligibleTiles);
    } else if (golden.tileId === "golden_tile_the_golden_cairn") {
      const terrainTypes = new Set(
        eligibleTiles
          .flatMap((tile) => tile.hexIds)
          .map((hexId) => mapById[hexId]?.terrain)
          .filter((terrain) => terrain && terrain !== "water")
      );
      met = terrainTypes.size >= 4;
    } else if (golden.tileId === "golden_tile_the_golden_garden") {
      met = state.map.placedTiles.every((tile) => tile.strain < 3);
    }
    if (met) total += 5;
  }
  return total;
}

export interface StewardObjectiveProgress {
  playerId: string;
  playerName: string;
  stewardId: string;
  stewardName: string;
  objectiveText: string;
  reward: number;
  met: boolean;
  current: number;
  target: number;
  progressLabel: string;
  detail: string;
}

export function evaluateStewardObjectives(state: GameState): StewardObjectiveProgress[] {
  const eligibleTiles = state.map.placedTiles.filter((tile) => tile.strain < 3);

  return state.players.flatMap((player) => {
    const steward = stewardById[player.stewardId];
    if (!steward) return [];

    let current = 0;
    let target = 1;
    let met = false;
    let progressLabel = "Not yet complete";
    let detail = "This condition is checked against the current settlement.";

    if (player.stewardId === "vanguard") {
      met = hasConnectedBridgeCrossing(eligibleTiles);
      current = met ? 1 : 0;
      progressLabel = met ? "Crossing connected" : "Crossing not yet connected";
      detail = "Place a Bridge with eligible settlement tiles connected on both river sides.";
    } else if (player.stewardId === "knight") {
      current = largestHousingClusterSize(eligibleTiles);
      target = 3;
      met = current >= target;
      progressLabel = `${current}/${target} Housing in the largest cluster`;
      detail = "Only non-Overstrained Housing Tiles count toward the cluster.";
    } else if (player.stewardId === "sentinel") {
      current = eligibleTiles.filter(
        (tile) => tile.kind === "core" && tile.side === "upgraded"
      ).length;
      target = 5;
      met = current >= target;
      progressLabel = `${current}/${target} upgraded Core Tiles`;
      detail = "Overstrained upgrades do not count.";
    } else if (player.stewardId === "ranger") {
      const terrainTypes = new Set(
        eligibleTiles
          .flatMap((tile) => tile.hexIds)
          .map((hexId) => mapById[hexId]?.terrain)
          .filter((terrain) => terrain && terrain !== "grasslands" && terrain !== "water")
      );
      current = terrainTypes.size;
      target = 3;
      met = current >= target;
      progressLabel = `${current}/${target} qualifying terrain types`;
      detail = terrainTypes.size
        ? `Present: ${[...terrainTypes].map((terrain) => terrainLabels[terrain]).join(", ")}.`
        : "Build on non-Grasslands, non-River terrain.";
    } else if (player.stewardId === "warden") {
      const activeBurdens = state.encounters.activeBurdens.length;
      met = activeBurdens === 0;
      current = met ? 1 : 0;
      progressLabel = met ? "No active Burdens" : `${activeBurdens} active Burden${activeBurdens === 1 ? "" : "s"}`;
      detail = met ? "The settlement is currently clear." : "Resolve every active Burden before final scoring.";
    } else if (player.stewardId === "quartermaster") {
      current = Object.values(state.warehouse).filter((amount) => amount >= 5).length;
      target = 3;
      met = current >= target;
      progressLabel = `${current}/${target} resource types at 5+`;
      detail = "The Warehouse condition is checked at final scoring.";
    }

    return [
      {
        playerId: player.id,
        playerName: player.name,
        stewardId: player.stewardId,
        stewardName: steward.name,
        objectiveText: steward.objectiveText,
        reward: steward.objectiveRenown,
        met,
        current,
        target,
        progressLabel,
        detail
      }
    ];
  });
}

export function scoreStewardObjectives(state: GameState): number {
  return evaluateStewardObjectives(state).reduce(
    (total, objective) => total + (objective.met ? objective.reward : 0),
    0
  );
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
  const goldenRenown = scoreGoldenTiles(state, eligibleTiles);
  const burdenPenalty = state.encounters.activeBurdens.length * activeBurdenPenalty;
  const failedArrivals = countFailedArrivals(state);
  const failedArrivalPenaltyTotal = failedArrivals * failedArrivalPenalty;
  const strainTokens = state.map.placedTiles.reduce((total, tile) => total + tile.strain, 0);
  const strainPenaltyTotal = strainTokens * strainPenalty;
  const renown =
    printedRenown +
    passiveRenown +
    stewardObjectiveRenown +
    goldenRenown -
    burdenPenalty -
    failedArrivalPenaltyTotal -
    strainPenaltyTotal;

  return {
    printedPopulation,
    passivePopulation,
    population,
    printedRenown,
    passiveRenown,
    stewardObjectiveRenown,
    goldenRenown,
    burdenPenalty,
    failedArrivals,
    failedArrivalPenalty: failedArrivalPenaltyTotal,
    strainPenalty: strainPenaltyTotal,
    finalScore: population + renown
  };
}

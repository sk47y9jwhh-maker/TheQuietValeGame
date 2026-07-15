import {
  countCompletedLedgerEntries,
  type LedgerCampaign,
  type LedgerGameRecord
} from "./ledgerCampaign";
import { isVowAvailableForPlayerCount, ledgerEntries, type LedgerEntry } from "../data/ledger";
import { mapById, mapCells } from "../data/map";
import { coreTileById, goldenTileById, specialTileById } from "../data/tiles";
import { stewardById } from "../data/stewards";
import { getHexNeighbors } from "./hex";
import { hasConnectedBridgeCrossing } from "./reachability";
import { calculateFinalScore, evaluateStewardObjectives } from "./scoring";
import type {
  GameState,
  LedgerRunState,
  PlacedTile,
  ResourceType,
  Season,
  Terrain,
  TileCategory,
  WarehouseState
} from "./types";

const seasons: Season[] = [1, 2, 3];
const mainResourceTileIds = [
  "c01_lumber_yard",
  "c02_mine_tunnel",
  "c03_gathering_outpost",
  "c04_farmstead"
];

export interface LedgerEntryEvaluation {
  entry: LedgerEntry;
  eligible: boolean;
  locked: boolean;
  met: boolean;
  unavailableReason?: string;
  progressLabel: string;
}

export interface LedgerRecordResult {
  campaign: LedgerCampaign;
  state: GameState;
  completedEntryIds: string[];
  newlyCompletedEntryIds: string[];
}

function cloneWarehouse(warehouse: WarehouseState): WarehouseState {
  return { ...warehouse };
}

function emptySeasonCounts(): Record<Season, number> {
  return { 1: 0, 2: 0, 3: 0 };
}

export function createLedgerRunState(
  warehouse: WarehouseState,
  declaredVowId?: string,
  playerCount = 4,
  gameId = `qv_game_${Date.now().toString(36)}`
): LedgerRunState {
  const validDeclaredVowId = isVowAvailableForPlayerCount(declaredVowId, playerCount)
    ? declaredVowId
    : undefined;
  const initialVowViolations =
    validDeclaredVowId === "LE-043" && Math.max(...Object.values(warehouse)) > 8
      ? ["The starting Warehouse already exceeds 8 of a resource."]
      : [];
  return {
    gameId,
    declaredVowId: validDeclaredVowId || undefined,
    recorded: false,
    arrivalsRevealed: 0,
    arrivalsCompleted: 0,
    arrivalsExpired: 0,
    burdensRevealed: 0,
    burdensResolved: 0,
    arrivalsCompletedBySeason: emptySeasonCounts(),
    burdensResolvedBySeason: emptySeasonCounts(),
    burdensRevealedBySeason: emptySeasonCounts(),
    arrivalCompletionEvents: [],
    burdenRevealEvents: [],
    burdenResolutionEvents: [],
    strainPreventedBySupported: 0,
    strainRemovedByRoundCategory: {},
    maxOverstrainedTiles: 0,
    rangerPowerTerrainTypes: [],
    upgradeActions: 0,
    warehousePeakByResource: cloneWarehouse(warehouse),
    seasonSnapshots: {},
    violatedVowReasons: initialVowViolations
  };
}

export function getLedgerRun(state: GameState): LedgerRunState {
  const declaredVowId = isVowAvailableForPlayerCount(state.ledgerRun?.declaredVowId, state.playerCount)
    ? state.ledgerRun?.declaredVowId
    : undefined;
  const fallback = createLedgerRunState(state.warehouse, declaredVowId, state.playerCount, state.ledgerRun?.gameId ?? "legacy_game");
  const run = state.ledgerRun;
  if (!run) return fallback;
  return {
    ...fallback,
    ...run,
    arrivalsCompletedBySeason: { ...fallback.arrivalsCompletedBySeason, ...run.arrivalsCompletedBySeason },
    burdensResolvedBySeason: { ...fallback.burdensResolvedBySeason, ...run.burdensResolvedBySeason },
    burdensRevealedBySeason: { ...fallback.burdensRevealedBySeason, ...run.burdensRevealedBySeason },
    arrivalCompletionEvents: [...(run.arrivalCompletionEvents ?? [])],
    burdenRevealEvents: [...(run.burdenRevealEvents ?? [])],
    burdenResolutionEvents: [...(run.burdenResolutionEvents ?? [])],
    strainRemovedByRoundCategory: { ...(run.strainRemovedByRoundCategory ?? {}) },
    rangerPowerTerrainTypes: [...(run.rangerPowerTerrainTypes ?? [])],
    warehousePeakByResource: { ...fallback.warehousePeakByResource, ...run.warehousePeakByResource },
    seasonSnapshots: { ...run.seasonSnapshots },
    declaredVowId,
    violatedVowReasons: declaredVowId ? [...run.violatedVowReasons] : []
  };
}

function placedTileCategory(tile: PlacedTile): TileCategory {
  if (tile.tileId.startsWith("golden_tile_")) {
    return goldenTileById[tile.tileId]?.category ?? "special";
  }
  return tile.kind === "special"
    ? specialTileById[tile.tileId]?.category ?? "special"
    : coreTileById[tile.tileId]?.category ?? "special";
}

function countSupportedPreventions(previous: GameState, next: GameState): number {
  const previousById = new Map(previous.map.placedTiles.map((tile) => [tile.instanceId, tile]));
  return next.map.placedTiles.filter((tile) => {
    const before = previousById.get(tile.instanceId);
    return Boolean(before && !before.support.preventedThisRound && tile.support.preventedThisRound);
  }).length;
}

function getNewLogMessages(previous: GameState, next: GameState): string[] {
  const previousIds = new Set(previous.log.map((entry) => entry.id));
  return next.log.filter((entry) => !previousIds.has(entry.id)).map((entry) => entry.message);
}

function addVowViolation(run: LedgerRunState, reason: string): LedgerRunState {
  return run.violatedVowReasons.includes(reason)
    ? run
    : { ...run, violatedVowReasons: [...run.violatedVowReasons, reason] };
}

function countPlacedCategory(state: GameState, category: TileCategory): number {
  return state.map.placedTiles.filter((tile) => placedTileCategory(tile) === category).length;
}

function countUpgradedCore(state: GameState): number {
  return state.map.placedTiles.filter((tile) => tile.kind === "core" && tile.side === "upgraded").length;
}

function recordStrainRemoval(previous: GameState, next: GameState, run: LedgerRunState): void {
  const nextById = new Map(next.map.placedTiles.map((tile) => [tile.instanceId, tile]));
  const key = String(previous.round);
  const totals = { ...(run.strainRemovedByRoundCategory[key] ?? {}) };
  for (const before of previous.map.placedTiles) {
    const after = nextById.get(before.instanceId);
    if (!after || after.strain >= before.strain) continue;
    const category = placedTileCategory(before);
    totals[category] = (totals[category] ?? 0) + before.strain - after.strain;
  }
  if (Object.keys(totals).length > 0) run.strainRemovedByRoundCategory[key] = totals;
}

function recordRangerTerrain(previous: GameState, next: GameState, run: LedgerRunState): void {
  const ranger = previous.players.find(
    (player) => player.stewardId === "ranger" && player.temporaryReachHexId
  );
  if (!ranger?.temporaryReachHexId) return;
  const beforeById = new Map(previous.map.placedTiles.map((tile) => [tile.instanceId, tile]));
  const changed = next.map.placedTiles.some((tile) => {
    const before = beforeById.get(tile.instanceId);
    const newlyPlaced = !before && tile.hexIds.includes(ranger.temporaryReachHexId!);
    const newlyUpgraded = Boolean(
      before && before.side !== "upgraded" && tile.side === "upgraded" && tile.hexIds.includes(ranger.temporaryReachHexId!)
    );
    return newlyPlaced || newlyUpgraded;
  });
  if (!changed) return;
  const terrain = mapById[ranger.temporaryReachHexId]?.terrain;
  if (!terrain || terrain === "grasslands" || terrain === "water") return;
  run.rangerPowerTerrainTypes = [...new Set([...run.rangerPowerTerrainTypes, terrain])];
}

export function trackLedgerTransition(previous: GameState, next: GameState): GameState {
  if (next === previous) return next;
  const previousRun = getLedgerRun(previous);
  let run: LedgerRunState = {
    ...previousRun,
    arrivalsCompletedBySeason: { ...previousRun.arrivalsCompletedBySeason },
    burdensResolvedBySeason: { ...previousRun.burdensResolvedBySeason },
    burdensRevealedBySeason: { ...previousRun.burdensRevealedBySeason },
    arrivalCompletionEvents: [...previousRun.arrivalCompletionEvents],
    burdenRevealEvents: [...previousRun.burdenRevealEvents],
    burdenResolutionEvents: [...previousRun.burdenResolutionEvents],
    strainRemovedByRoundCategory: { ...previousRun.strainRemovedByRoundCategory },
    rangerPowerTerrainTypes: [...previousRun.rangerPowerTerrainTypes],
    warehousePeakByResource: cloneWarehouse(previousRun.warehousePeakByResource),
    seasonSnapshots: { ...previousRun.seasonSnapshots },
    violatedVowReasons: [...previousRun.violatedVowReasons]
  };

  for (const resource of Object.keys(next.warehouse) as ResourceType[]) {
    run.warehousePeakByResource[resource] = Math.max(run.warehousePeakByResource[resource] ?? 0, next.warehouse[resource]);
  }
  run.strainPreventedBySupported += countSupportedPreventions(previous, next);
  recordStrainRemoval(previous, next, run);
  recordRangerTerrain(previous, next, run);

  const previousArrivals = new Set(previous.encounters.activeArrivals.map((arrival) => arrival.cardId));
  const newlyRevealedArrivals = next.encounters.activeArrivals.filter((arrival) => !previousArrivals.has(arrival.cardId));
  run.arrivalsRevealed += newlyRevealedArrivals.length;

  const previousBurdens = new Set(previous.encounters.activeBurdens);
  const newlyRevealedBurdens = next.encounters.activeBurdens.filter((cardId) => !previousBurdens.has(cardId));
  for (const cardId of newlyRevealedBurdens) {
    run.burdensRevealed += 1;
    run.burdensRevealedBySeason[previous.season] += 1;
    run.burdenRevealEvents.push({ cardId, round: previous.round, season: previous.season });
  }

  const completedBefore = new Set(previous.encounters.completedArrivals.map((arrival) => arrival.cardId));
  const newlyCompleted = next.encounters.completedArrivals.filter((arrival) => !completedBefore.has(arrival.cardId));
  for (const arrival of newlyCompleted) {
    const timerTokens = previous.encounters.activeArrivals.find((candidate) => candidate.cardId === arrival.cardId)?.timerTokens;
    run.arrivalsCompleted += 1;
    run.arrivalsCompletedBySeason[previous.season] += 1;
    run.arrivalCompletionEvents.push({
      cardId: arrival.cardId,
      round: previous.round,
      season: previous.season,
      specialTileIds: [...arrival.specialTileIds],
      timerTokens
    });
  }

  const arrivalsExpired = getNewLogMessages(previous, next).filter((message) =>
    message.startsWith("Arrival expired unresolved:")
  ).length;
  run.arrivalsExpired += arrivalsExpired;

  const resolvedBurdens = previous.encounters.activeBurdens.filter(
    (cardId) => !next.encounters.activeBurdens.includes(cardId)
  );
  for (const cardId of resolvedBurdens) {
    run.burdensResolved += 1;
    run.burdensResolvedBySeason[previous.season] += 1;
    run.burdenResolutionEvents.push({ cardId, round: previous.round, season: previous.season });
  }

  const upgradedNow = next.map.placedTiles.filter((tile) => {
    const before = previous.map.placedTiles.find((candidate) => candidate.instanceId === tile.instanceId);
    return tile.kind === "core" && tile.side === "upgraded" && before?.side !== "upgraded";
  }).length;
  run.upgradeActions = (run.upgradeActions ?? 0) + upgradedNow;
  run.maxOverstrainedTiles = Math.max(
    run.maxOverstrainedTiles,
    next.map.placedTiles.filter((tile) => tile.strain >= 3).length
  );

  if (previous.phase === "endRound" && (previous.round === 4 || previous.round === 8) && next.round !== previous.round) {
    const season = previous.season;
    run.seasonSnapshots[season] = {
      activeBurdens: next.encounters.activeBurdens.length,
      overstrainedTiles: next.map.placedTiles.filter((tile) => tile.strain >= 3).length,
      arrivalsCompleted: run.arrivalsCompletedBySeason[season],
      burdensResolved: run.burdensResolvedBySeason[season]
    };
  }

  if (run.declaredVowId === "LE-041" && countPlacedCategory(next, "travel") > 0) {
    run = addVowViolation(run, "A Travel Tile was placed.");
  }
  if (run.declaredVowId === "LE-042" && countUpgradedCore(next) > countUpgradedCore(previous)) {
    run = addVowViolation(run, "A Core Tile was upgraded.");
  }
  if (run.declaredVowId === "LE-043" && Math.max(...Object.values(run.warehousePeakByResource)) > 8) {
    run = addVowViolation(run, "The Warehouse exceeded 8 of a resource.");
  }
  return { ...next, ledgerRun: run };
}

function areTilesAdjacent(a: PlacedTile, b: PlacedTile): boolean {
  return a.hexIds.some((hexId) => getHexNeighbors(hexId).some((neighborId) => b.hexIds.includes(neighborId)));
}

interface LedgerBoardIndex {
  adjacentIdsByTileId: Map<string, Set<string>>;
  categoryByTileId: Map<string, TileCategory>;
  tileByHexId: Map<string, PlacedTile>;
}

function createLedgerBoardIndex(tiles: PlacedTile[]): LedgerBoardIndex {
  const adjacentIdsByTileId = new Map(
    tiles.map((tile) => [tile.instanceId, new Set<string>()])
  );
  const categoryByTileId = new Map(
    tiles.map((tile) => [tile.instanceId, placedTileCategory(tile)])
  );
  const tileByHexId = new Map<string, PlacedTile>();

  for (const tile of tiles) {
    for (const hexId of tile.hexIds) tileByHexId.set(hexId, tile);
  }
  for (let leftIndex = 0; leftIndex < tiles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < tiles.length; rightIndex += 1) {
      const left = tiles[leftIndex];
      const right = tiles[rightIndex];
      if (!areTilesAdjacent(left, right)) continue;
      adjacentIdsByTileId.get(left.instanceId)?.add(right.instanceId);
      adjacentIdsByTileId.get(right.instanceId)?.add(left.instanceId);
    }
  }

  return { adjacentIdsByTileId, categoryByTileId, tileByHexId };
}

function connectedGroups(
  tiles: PlacedTile[],
  adjacentIdsByTileId: Map<string, Set<string>>
): PlacedTile[][] {
  const remaining = new Set(tiles.map((tile) => tile.instanceId));
  const byId = new Map(tiles.map((tile) => [tile.instanceId, tile]));
  const groups: PlacedTile[][] = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value as string;
    remaining.delete(first);
    const queue = [first];
    const group: PlacedTile[] = [];
    for (let index = 0; index < queue.length; index += 1) {
      const tile = byId.get(queue[index]);
      if (!tile) continue;
      group.push(tile);
      for (const candidateId of adjacentIdsByTileId.get(tile.instanceId) ?? []) {
        if (!remaining.has(candidateId)) continue;
        remaining.delete(candidateId);
        queue.push(candidateId);
      }
    }
    groups.push(group);
  }
  return groups;
}

function ringTilesAt(
  tileByHexId: Map<string, PlacedTile>,
  centerHexId: string
): PlacedTile[] | null {
  const neighbors = getHexNeighbors(centerHexId);
  if (neighbors.length !== 6) return null;
  const ring = neighbors.map((hexId) => tileByHexId.get(hexId));
  if (ring.some((tile) => !tile)) return null;
  const present = ring as PlacedTile[];
  return new Set(present.map((tile) => tile.instanceId)).size === 6 ? present : null;
}

function thresholdFor(entry: LedgerEntry, playerCount: number): number {
  return entry.thresholdsByPlayerCount?.[String(playerCount)] ?? 0;
}

function formatProgress(current: number, target: number, label: string): string {
  return `${current}/${target} ${label}`;
}

function usesPowerEverySeason(state: GameState, stewardId: string): boolean {
  const player = state.players.find((candidate) => candidate.stewardId === stewardId);
  return Boolean(player && seasons.every((season) => (player.stewardPowerUsesBySeason[season] ?? 0) >= 1));
}

export function evaluateLedgerEntries(state: GameState, campaign: LedgerCampaign): LedgerEntryEvaluation[] {
  const run = getLedgerRun(state);
  const completedCount = countCompletedLedgerEntries(campaign);
  const tiles = state.map.placedTiles;
  const eligible = tiles.filter((tile) => tile.strain < 3);
  const boardIndex = createLedgerBoardIndex(eligible);
  const tileCategory = (tile: PlacedTile) =>
    boardIndex.categoryByTileId.get(tile.instanceId) ?? placedTileCategory(tile);
  const tilesAreAdjacent = (left: PlacedTile, right: PlacedTile) =>
    boardIndex.adjacentIdsByTileId.get(left.instanceId)?.has(right.instanceId) ?? false;
  const score = calculateFinalScore(state);
  const renown = score.finalScore - score.population;
  const overstrained = tiles.filter((tile) => tile.strain >= 3).length;
  const strain = tiles.reduce((total, tile) => total + tile.strain, 0);
  const activeBurdens = state.encounters.activeBurdens.length;
  const warehouseTotal = Object.values(state.warehouse).reduce((sum, amount) => sum + amount, 0);
  const occupied = new Set(eligible.flatMap((tile) => tile.hexIds));
  const eligibleHousing = eligible.filter((tile) => tileCategory(tile) === "housing");
  const housingGroups = connectedGroups(eligibleHousing, boardIndex.adjacentIdsByTileId);
  const travelGroups = connectedGroups(
    eligible.filter((tile) => tileCategory(tile) === "travel"),
    boardIndex.adjacentIdsByTileId
  );
  const categorySet = new Set(eligible.map(tileCategory));
  const adjacentToCategory = (tile: PlacedTile, category: TileCategory) =>
    [...(boardIndex.adjacentIdsByTileId.get(tile.instanceId) ?? [])].some(
      (candidateId) => boardIndex.categoryByTileId.get(candidateId) === category
    );
  const allHousingPaired = eligibleHousing.length > 0 && eligibleHousing.every((tile) => adjacentToCategory(tile, "housing"));
  const specialTiles = eligible.filter((tile) => tile.kind === "special" && !tile.tileId.startsWith("golden_tile_"));
  const placedSpecialIds = specialTiles.map((tile) => tile.tileId);
  const supported = eligible.filter((tile) => tile.support.passive || tile.support.singleUse);
  const supportedCategoryCount = new Set(supported.map(tileCategory)).size;
  const bridges = eligible.filter((tile) => tile.tileId === "c19_bridge");
  const upgradedEligible = eligible.filter((tile) => tile.kind === "core" && tile.side === "upgraded");
  const edgeHexes = [...occupied].filter((hexId) => {
    const cell = mapById[hexId];
    return cell && cell.terrain !== "water" && (cell.col === "A" || cell.col === "N" || cell.row === 1 || cell.row === 9);
  });
  const riverbankHexes = [...occupied].filter((hexId) =>
    mapById[hexId]?.terrain !== "water" && getHexNeighbors(hexId).some((neighbor) => mapById[neighbor]?.terrain === "water")
  );
  const terrainTypes = new Set([...occupied].map((hexId) => mapById[hexId]?.terrain).filter(Boolean));
  const riverCategories = new Set(
    eligible.filter((tile) => tile.hexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => mapById[neighbor]?.terrain === "water"))).map(tileCategory)
  );
  const gardenCommunity = eligible.some((center) => {
    if (center.tileId !== "c18_common_land" || center.hexIds.length !== 1) return false;
    const ring = ringTilesAt(boardIndex.tileByHexId, center.hexIds[0]);
    return Boolean(ring && ring.every((tile) => tileCategory(tile) === "housing"));
  });
  const shelterAndSong = housingGroups.some((group) => group.length >= 4 &&
    eligible.some((tile) => tileCategory(tile) === "social" && group.some((home) => tilesAreAdjacent(tile, home))) &&
    eligible.some((tile) => tileCategory(tile) === "wellbeing" && group.some((home) => tilesAreAdjacent(tile, home))));
  const careRing = eligible.some((center) => {
    if (tileCategory(center) !== "wellbeing" || center.hexIds.length !== 1) return false;
    const ring = ringTilesAt(boardIndex.tileByHexId, center.hexIds[0]);
    return Boolean(ring && ring.filter((tile) => ["housing", "social", "wellbeing"].includes(tileCategory(tile))).length >= 4);
  });
  const fairDay = eligible.some((tile) => tileCategory(tile) === "merchant" &&
    ["housing", "social", "travel"].every((category) => adjacentToCategory(tile, category as TileCategory)));
  const quietCourtyard = mapCells.some((cell) => {
    if (occupied.has(cell.id)) return false;
    const ring = ringTilesAt(boardIndex.tileByHexId, cell.id);
    return Boolean(ring && new Set(ring.map(tileCategory)).size >= 4);
  });
  const marketTrack = eligible.some((track) => track.tileId === "c17_track" &&
    eligible.filter((tile) => tileCategory(tile) === "crafting" && tilesAreAdjacent(track, tile)).length >= 2 &&
    eligible.filter((tile) => tileCategory(tile) === "merchant" && tilesAreAdjacent(track, tile)).length >= 2);
  const workAndRest = eligible.some((tile) => tile.tileId === "c11_washhouse" &&
    ["crafting", "merchant", "social"].every((category) => adjacentToCategory(tile, category as TileCategory)));
  const twinFarmsteads = eligible.filter((tile) => tile.tileId === "c04_farmstead");
  const twinShafts = eligible.filter((tile) => tile.tileId === "c02_mine_tunnel");
  const doubledUpgradedLineages = mainResourceTileIds.filter((tileId) =>
    eligible.filter((tile) => tile.tileId === tileId && tile.side === "upgraded").length >= 2
  ).length;
  const allResourceCopies = mainResourceTileIds.every((tileId) => eligible.filter((tile) => tile.tileId === tileId).length >= 2);
  const resourceChain = travelGroups.some((group) =>
    ["c01_lumber_yard", "c02_mine_tunnel", "c04_farmstead"].every((tileId) =>
      eligible.some((tile) => tile.tileId === tileId && group.some((travel) => tilesAreAdjacent(tile, travel)))));
  const resourceTypesAt10 = Object.values(state.warehouse).filter((amount) => amount >= 10).length;
  const specialAdjacentHousing = specialTiles.filter((tile) => adjacentToCategory(tile, "housing")).length;
  const stewardObjectives = evaluateStewardObjectives(state);
  const objectiveIds = new Set(stewardObjectives.filter((objective) => objective.met).map((objective) => objective.stewardId));
  const completedObjectiveIds = new Set([
    ...campaign.games.flatMap((game) => game.completedStewardObjectiveIds ?? []),
    ...objectiveIds
  ]);

  return ledgerEntries.map((entry) => {
    const target = thresholdFor(entry, state.playerCount);
    const locked = completedCount < entry.unlockAt;
    const stewardPresent = !entry.requiredSteward || state.players.some((player) => player.stewardId === entry.requiredSteward);
    const vowSelected = !entry.declaredVow || run.declaredVowId === entry.id;
    const vowFailed = entry.declaredVow && vowSelected && run.violatedVowReasons.length > 0;
    let met = false;
    let progressLabel = "Checked at game end";
    switch (entry.id) {
      case "LE-001": met = score.finalScore >= target; progressLabel = formatProgress(score.finalScore, target, "score"); break;
      case "LE-002": met = score.population >= target; progressLabel = formatProgress(score.population, target, "Population"); break;
      case "LE-003": met = renown >= target; progressLabel = formatProgress(renown, target, "Renown"); break;
      case "LE-004": met = activeBurdens === 0 && overstrained === 0 && strain <= target; progressLabel = `${activeBurdens} Burdens · ${overstrained} Overstrained · ${strain}/${target} Strain`; break;
      case "LE-005": { const corners = ["A1", "A9", "N1", "N9"].filter((hexId) => occupied.has(hexId)).length; met = corners >= 3; progressLabel = formatProgress(corners, 3, "corners"); break; }
      case "LE-006": met = edgeHexes.length >= target; progressLabel = formatProgress(edgeHexes.length, target, "edge hexes"); break;
      case "LE-007": met = ["grasslands", "woodland", "mountains", "heaths", "arable", "ruins"].every((terrain) => terrainTypes.has(terrain as Terrain)); progressLabel = `${[...terrainTypes].filter((terrain) => terrain !== "water").length}/6 terrain types`; break;
      case "LE-008": met = gardenCommunity; progressLabel = met ? "Garden Community complete" : "Six Housing neighbours required"; break;
      case "LE-009": met = shelterAndSong; progressLabel = met ? "Shelter and Song complete" : "Housing cluster needs Social and Wellbeing"; break;
      case "LE-010": met = careRing; progressLabel = met ? "Care Ring complete" : "Wellbeing centre needs a complete care ring"; break;
      case "LE-011": met = eligibleHousing.length >= target && allHousingPaired; progressLabel = `${eligibleHousing.length}/${target} Housing · ${allHousingPaired ? "all paired" : "an isolated home remains"}`; break;
      case "LE-012": met = categorySet.size >= target; progressLabel = formatProgress(categorySet.size, target, "categories"); break;
      case "LE-013": met = fairDay; progressLabel = met ? "Fair Day district complete" : "Merchant needs Housing, Social, and Travel"; break;
      case "LE-014": met = quietCourtyard; progressLabel = met ? "Quiet Courtyard complete" : "Mixed six-tile ring required"; break;
      case "LE-015": met = hasConnectedBridgeCrossing(eligible); progressLabel = met ? "River crossing connected" : "No complete crossing"; break;
      case "LE-016": met = riverbankHexes.length >= target; progressLabel = formatProgress(riverbankHexes.length, target, "riverbank hexes"); break;
      case "LE-017": met = ["housing", "merchant", "social", "wellbeing"].every((category) => riverCategories.has(category as TileCategory)); progressLabel = `${["housing", "merchant", "social", "wellbeing"].filter((category) => riverCategories.has(category as TileCategory)).length}/4 river categories`; break;
      case "LE-018": met = bridges.length >= 2 && bridges.some((tile) => tile.side === "upgraded"); progressLabel = `${bridges.length}/2 Bridges · ${bridges.some((tile) => tile.side === "upgraded") ? "Stone Bridge ready" : "upgrade required"}`; break;
      case "LE-019": met = specialTiles.length >= target; progressLabel = formatProgress(specialTiles.length, target, "Special Tiles"); break;
      case "LE-020": { const count = seasons.filter((season) => run.arrivalsCompletedBySeason[season] >= 1).length; met = count === 3; progressLabel = formatProgress(count, 3, "Seasons with an Arrival"); break; }
      case "LE-021": met = run.arrivalCompletionEvents.some((event) => event.timerTokens === 1); progressLabel = met ? "Arrival completed at 1 timer" : "No 1-timer completion yet"; break;
      case "LE-022": { const rewards = run.arrivalCompletionEvents.filter((event) => event.round < 12).flatMap((event) => event.specialTileIds); const unplaced = rewards.filter((tileId) => !placedSpecialIds.includes(tileId)).length; const allowance = state.playerCount + 1; met = specialTiles.length >= target && unplaced <= allowance; progressLabel = `${specialTiles.length}/${target} placed · ${unplaced}/${allowance} early rewards unplaced`; break; }
      case "LE-023": met = specialAdjacentHousing >= 4; progressLabel = formatProgress(specialAdjacentHousing, 4, "Special Tiles beside Housing"); break;
      case "LE-024": met = run.burdensResolved >= target && activeBurdens < state.playerCount; progressLabel = `${run.burdensResolved}/${target} resolved · ${activeBurdens}/${state.playerCount - 1} active cap`; break;
      case "LE-025": { const count = seasons.filter((season) => run.burdenRevealEvents.some((event) => event.season === season) && run.burdenResolutionEvents.some((resolved) => resolved.season === season && run.burdenRevealEvents.some((revealed) => revealed.cardId === resolved.cardId && revealed.round === resolved.round))).length; met = count === 3; progressLabel = formatProgress(count, 3, "Seasons answered in reveal round"); break; }
      case "LE-026": met = overstrained === 0 && strain <= target; progressLabel = `${overstrained} Overstrained · ${strain}/${target} Strain`; break;
      case "LE-027": met = strain === 0; progressLabel = `${strain} Strain tokens`; break;
      case "LE-028": met = supported.length >= 6 && supportedCategoryCount >= 3; progressLabel = `${supported.length}/6 Supported · ${supportedCategoryCount}/3 categories`; break;
      case "LE-029": met = run.maxOverstrainedTiles >= 2 && overstrained === 0; progressLabel = `${run.maxOverstrainedTiles}/2 peak Overstrained · ${overstrained} now`; break;
      case "LE-030": { const best = Math.max(0, ...Object.values(run.strainRemovedByRoundCategory).map((byCategory) => Object.values(byCategory).reduce((sum, amount) => sum + (amount ?? 0), 0))); const diverse = Object.values(run.strainRemovedByRoundCategory).some((byCategory) => Object.values(byCategory).filter((amount) => (amount ?? 0) > 0).length >= 2 && Object.values(byCategory).reduce((sum, amount) => sum + (amount ?? 0), 0) >= 3); met = diverse; progressLabel = `${best}/3 Strain removed in best round`; break; }
      case "LE-031": met = (run.upgradeActions ?? 0) >= target; progressLabel = formatProgress(run.upgradeActions ?? 0, target, "upgrades"); break;
      case "LE-032": met = marketTrack; progressLabel = met ? "One physical Track serves all four tiles" : "Market Track incomplete"; break;
      case "LE-033": met = workAndRest; progressLabel = met ? "Work and Rest district complete" : "Washhouse needs Crafting, Merchant, and Social"; break;
      case "LE-034": met = twinFarmsteads.length >= 2 && twinFarmsteads.every((tile) => adjacentToCategory(tile, "housing")); progressLabel = `${twinFarmsteads.filter((tile) => adjacentToCategory(tile, "housing")).length}/2 Farmsteads beside Housing`; break;
      case "LE-035": met = twinShafts.length >= 2 && twinShafts.every((tile) => adjacentToCategory(tile, "travel")); progressLabel = `${twinShafts.filter((tile) => adjacentToCategory(tile, "travel")).length}/2 Shafts beside Travel`; break;
      case "LE-036": met = doubledUpgradedLineages >= 3; progressLabel = formatProgress(doubledUpgradedLineages, 3, "doubled upgraded lineages"); break;
      case "LE-037": met = allResourceCopies; progressLabel = `${mainResourceTileIds.filter((tileId) => eligible.filter((tile) => tile.tileId === tileId).length >= 2).length}/4 doubled lineages`; break;
      case "LE-038": met = warehouseTotal >= target; progressLabel = formatProgress(warehouseTotal, target, "Warehouse resources"); break;
      case "LE-039": met = warehouseTotal <= 2 && score.finalScore >= target; progressLabel = `${warehouseTotal}/2 resources · ${score.finalScore}/${target} score`; break;
      case "LE-040": met = resourceChain; progressLabel = met ? "Resource chain complete" : "Three lineages need one Travel group"; break;
      case "LE-041": met = countPlacedCategory(state, "travel") === 0 && score.finalScore >= target; progressLabel = `0 Travel required · ${score.finalScore}/${target} score`; break;
      case "LE-042": met = countUpgradedCore(state) === 0 && score.finalScore >= target; progressLabel = `0 Core upgrades required · ${score.finalScore}/${target} score`; break;
      case "LE-043": { const peak = Math.max(...Object.values(run.warehousePeakByResource)); met = peak <= 8; progressLabel = `${peak}/8 highest Warehouse amount`; break; }
      case "LE-044": met = usesPowerEverySeason(state, "vanguard") && hasConnectedBridgeCrossing(eligible); progressLabel = `${usesPowerEverySeason(state, "vanguard") ? "Power used each Season" : "Power use incomplete"} · ${hasConnectedBridgeCrossing(eligible) ? "crossing ready" : "crossing missing"}`; break;
      case "LE-045": { const largest = Math.max(0, ...housingGroups.map((group) => group.length)); met = usesPowerEverySeason(state, "knight") && largest >= 6; progressLabel = `${largest}/6 Housing cluster · ${usesPowerEverySeason(state, "knight") ? "power complete" : "power incomplete"}`; break; }
      case "LE-046": { const count = upgradedEligible.filter((tile) => upgradedEligible.some((other) => tilesAreAdjacent(tile, other))).length; met = usesPowerEverySeason(state, "sentinel") && count >= 3; progressLabel = `${count}/3 adjacent upgrades · ${usesPowerEverySeason(state, "sentinel") ? "power complete" : "power incomplete"}`; break; }
      case "LE-047": met = run.rangerPowerTerrainTypes.length >= 3; progressLabel = formatProgress(run.rangerPowerTerrainTypes.length, 3, "Ranger terrains"); break;
      case "LE-048": { const revealSeasons = seasons.filter((season) => run.burdensRevealedBySeason[season] >= 1).length; met = usesPowerEverySeason(state, "warden") && revealSeasons === 3 && overstrained === 0 && activeBurdens <= 1; progressLabel = `${revealSeasons}/3 reveal Seasons · ${usesPowerEverySeason(state, "warden") ? "power complete" : "power incomplete"} · ${activeBurdens} active`; break; }
      case "LE-049": met = usesPowerEverySeason(state, "quartermaster") && resourceTypesAt10 >= target; progressLabel = `${resourceTypesAt10}/${target} resource types · ${usesPowerEverySeason(state, "quartermaster") ? "power complete" : "power incomplete"}`; break;
      case "LE-050": met = completedObjectiveIds.size >= 6; progressLabel = formatProgress(completedObjectiveIds.size, 6, "Steward objectives"); break;
    }

    const unavailableReason = locked
      ? `Complete ${entry.unlockAt} named entries first.`
      : !stewardPresent
        ? `${stewardById[entry.requiredSteward!]?.name ?? entry.requiredSteward} must be chosen.`
        : !vowSelected
          ? "This Vow was not declared before setup."
          : vowFailed
            ? run.violatedVowReasons.join(" ")
            : undefined;
    return { entry, eligible: !unavailableReason, locked, met: met && !vowFailed, unavailableReason, progressLabel };
  });
}

export function recordLedgerGame(state: GameState, campaign: LedgerCampaign): LedgerRecordResult {
  const run = getLedgerRun(state);
  if (state.phase !== "gameEnd" || campaign.games.some((game) => game.id === run.gameId)) {
    return { campaign, state, completedEntryIds: [], newlyCompletedEntryIds: [] };
  }
  const evaluations = evaluateLedgerEntries(state, campaign);
  const achieved = evaluations.filter((evaluation) => evaluation.eligible && evaluation.met);
  const nextCompletions = { ...campaign.completions };
  const newlyCompletedEntryIds: string[] = [];
  const newRecordEntryIds: string[] = [];
  for (const evaluation of achieved) {
    const existing = nextCompletions[evaluation.entry.id];
    const completedPlayerCounts = new Set(existing?.completedPlayerCounts ?? []);
    const hadPlayerCountRecord = completedPlayerCounts.has(state.playerCount);
    if (evaluation.entry.playerCountPrestige) completedPlayerCounts.add(state.playerCount);
    const wasComplete = Boolean(existing?.completedOnce || (existing?.completedPlayerCounts?.length ?? 0) > 0);
    nextCompletions[evaluation.entry.id] = {
      entryId: evaluation.entry.id,
      completedOnce: true,
      completedPlayerCounts: [...completedPlayerCounts].sort(),
      firstCompletedAt: existing?.firstCompletedAt ?? new Date().toISOString(),
      firstGameId: existing?.firstGameId ?? run.gameId,
      notes: existing?.notes
    };
    if (!wasComplete) newlyCompletedEntryIds.push(evaluation.entry.id);
    if (!wasComplete || (evaluation.entry.playerCountPrestige && !hadPlayerCountRecord)) {
      newRecordEntryIds.push(evaluation.entry.id);
    }
  }
  const completedObjectiveIds = evaluateStewardObjectives(state).filter((objective) => objective.met).map((objective) => objective.stewardId);
  const score = calculateFinalScore(state);
  const gameRecord: LedgerGameRecord = {
    id: run.gameId,
    completedAt: new Date().toISOString(),
    playerCount: state.playerCount,
    stewardIds: state.players.map((player) => player.stewardId),
    completedStewardObjectiveIds: completedObjectiveIds,
    finalScore: score.finalScore,
    declaredVowId: run.declaredVowId,
    completedEntryIds: achieved.map((evaluation) => evaluation.entry.id),
    newRecordEntryIds
  };
  const nextCampaign: LedgerCampaign = { ...campaign, completions: nextCompletions, games: [gameRecord, ...campaign.games] };
  return {
    campaign: nextCampaign,
    state: { ...state, ledgerRun: { ...run, recorded: true } },
    completedEntryIds: gameRecord.completedEntryIds,
    newlyCompletedEntryIds
  };
}

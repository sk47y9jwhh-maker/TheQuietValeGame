import { recordQuestGame, type LedgerCampaign } from "./ledgerCampaign";
import { mapById } from "../data/map";
import { coreTileById, goldenTileById, specialTileById } from "../data/tiles";
import { evaluateQuest, trackQuest } from "./quests";
import { calculateFinalScore } from "./scoring";
import type {
  GameState,
  LedgerRunState,
  PlacedTile,
  ResourceType,
  Season,
  TileCategory,
  WarehouseState
} from "./types";

export interface LedgerRecordResult {
  campaign: LedgerCampaign;
  state: GameState;
  /** True when the game's Quest Card was completed. */
  questCompleted: boolean;
  questCardNumber: number | null;
}

function cloneWarehouse(warehouse: WarehouseState): WarehouseState {
  return { ...warehouse };
}

function emptySeasonCounts(): Record<Season, number> {
  return { 1: 0, 2: 0, 3: 0 };
}

export function createLedgerRunState(
  warehouse: WarehouseState,
  playerCount = 4,
  gameId = `qv_game_${Date.now().toString(36)}`
): LedgerRunState {
  void playerCount;
  return {
    gameId,
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
    violatedVowReasons: []
  };
}

export function getLedgerRun(state: GameState): LedgerRunState {
  const fallback = createLedgerRunState(state.warehouse, state.playerCount, state.ledgerRun?.gameId ?? "legacy_game");
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
    declaredVowId: undefined,
    violatedVowReasons: []
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

  return trackQuest({ ...next, ledgerRun: run });
}

/**
 * Records a finished game in the Steward's Ledger: a completed Quest Card goes
 * into the Ledger, a failed one to the bottom of the deck.
 */
export function recordLedgerGame(state: GameState, campaign: LedgerCampaign): LedgerRecordResult {
  const run = getLedgerRun(state);
  const questCardNumber = state.questRun?.cardNumber ?? null;
  const questCompleted = evaluateQuest(state)?.complete ?? false;
  if (state.phase !== "gameEnd" || campaign.games.some((game) => game.id === run.gameId)) {
    return { campaign, state, questCompleted, questCardNumber };
  }
  const next = recordQuestGame(campaign, {
    id: run.gameId,
    playerCount: state.playerCount,
    stewardIds: state.players.map((player) => player.stewardId),
    finalScore: calculateFinalScore(state).finalScore,
    questCardNumber: questCardNumber ?? 0,
    questCompleted
  });
  return { campaign: next, state: { ...state, ledgerRun: { ...run, recorded: true } }, questCompleted, questCardNumber };
}

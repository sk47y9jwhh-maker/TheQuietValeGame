import type { LedgerCampaign, LedgerGameRecord } from "../app/ledgerPersistence";
import { encounterById } from "../data/encounters";
import { ledgerEntries, type LedgerEntry } from "../data/ledger";
import { mapById, mapCells, mapColumns } from "../data/map";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import { hasConnectedBridgeCrossing } from "./reachability";
import { calculateFinalScore, evaluateStewardObjectives } from "./scoring";
import type {
  GameState,
  LedgerRunState,
  PlacedTile,
  ResourceType,
  Season,
  WarehouseState
} from "./types";

const seasons: Season[] = [1, 2, 3];

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
  gameId = `qv_game_${Date.now().toString(36)}`
): LedgerRunState {
  const initialVowViolations =
    declaredVowId === "LE-030" && Math.max(...Object.values(warehouse)) > 8
      ? ["The starting Warehouse already exceeds 8 of a resource."]
      : [];
  return {
    gameId,
    declaredVowId: declaredVowId || undefined,
    recorded: false,
    arrivalsRevealed: 0,
    arrivalsCompleted: 0,
    arrivalsExpired: 0,
    burdensRevealed: 0,
    burdensResolved: 0,
    arrivalsCompletedBySeason: emptySeasonCounts(),
    burdensResolvedBySeason: emptySeasonCounts(),
    strainPreventedBySupported: 0,
    warehousePeakByResource: cloneWarehouse(warehouse),
    seasonSnapshots: {},
    violatedVowReasons: initialVowViolations
  };
}

export function getLedgerRun(state: GameState): LedgerRunState {
  return state.ledgerRun ?? createLedgerRunState(state.warehouse, undefined, "legacy_game");
}

function countSupportedPreventions(previous: GameState, next: GameState): number {
  const previousById = new Map(
    previous.map.placedTiles.map((tile) => [tile.instanceId, tile])
  );
  return next.map.placedTiles.filter((tile) => {
    const before = previousById.get(tile.instanceId);
    return Boolean(before && !before.support.preventedThisRound && tile.support.preventedThisRound);
  }).length;
}

function getNewLogMessages(previous: GameState, next: GameState): string[] {
  const previousIds = new Set(previous.log.map((entry) => entry.id));
  return next.log
    .filter((entry) => !previousIds.has(entry.id))
    .map((entry) => entry.message);
}

function addVowViolation(run: LedgerRunState, reason: string): LedgerRunState {
  if (run.violatedVowReasons.includes(reason)) return run;
  return { ...run, violatedVowReasons: [...run.violatedVowReasons, reason] };
}

function placedTileCategory(tile: PlacedTile): string {
  return tile.kind === "special"
    ? specialTileById[tile.tileId]?.category ?? "special"
    : coreTileById[tile.tileId]?.category ?? "unknown";
}

function countPlacedCategory(state: GameState, category: string): number {
  return state.map.placedTiles.filter((tile) => placedTileCategory(tile) === category).length;
}

function countFarmsteads(state: GameState): number {
  return state.map.placedTiles.filter((tile) => {
    if (tile.kind !== "core") return false;
    const data = coreTileById[tile.tileId];
    return /farmstead/i.test(data?.basic.name ?? "") || /farmstead/i.test(data?.upgraded.name ?? "");
  }).length;
}

function countUpgradedCore(state: GameState): number {
  return state.map.placedTiles.filter(
    (tile) => tile.kind === "core" && tile.side === "upgraded"
  ).length;
}

export function trackLedgerTransition(previous: GameState, next: GameState): GameState {
  if (next === previous) return next;

  const previousRun = getLedgerRun(previous);
  let run: LedgerRunState = {
    ...previousRun,
    warehousePeakByResource: cloneWarehouse(previousRun.warehousePeakByResource),
    arrivalsCompletedBySeason: { ...previousRun.arrivalsCompletedBySeason },
    burdensResolvedBySeason: { ...previousRun.burdensResolvedBySeason },
    seasonSnapshots: { ...previousRun.seasonSnapshots },
    violatedVowReasons: [...previousRun.violatedVowReasons]
  };

  for (const resource of Object.keys(next.warehouse) as ResourceType[]) {
    run.warehousePeakByResource[resource] = Math.max(
      run.warehousePeakByResource[resource] ?? 0,
      next.warehouse[resource]
    );
  }

  run.strainPreventedBySupported += countSupportedPreventions(previous, next);

  if (previous.phase === "reveal" && next.phase !== "reveal") {
    const revealCount = Math.max(0, previous.encounters.deck.length - next.encounters.deck.length);
    const revealed = previous.encounters.deck.slice(0, revealCount);
    run.arrivalsRevealed += revealed.filter(
      (cardId) => encounterById[cardId]?.type === "arrival"
    ).length;
    run.burdensRevealed += revealed.filter(
      (cardId) => encounterById[cardId]?.type === "burden"
    ).length;
  }

  const arrivalsCompleted = Math.max(
    0,
    next.encounters.completedArrivals.length - previous.encounters.completedArrivals.length
  );
  run.arrivalsCompleted += arrivalsCompleted;
  run.arrivalsCompletedBySeason[previous.season] += arrivalsCompleted;

  const newMessages = getNewLogMessages(previous, next);
  const arrivalsExpired = newMessages.filter((message) =>
    message.startsWith("Arrival expired unresolved:")
  ).length;
  run.arrivalsExpired += arrivalsExpired;

  const burdensResolved = Math.max(
    0,
    previous.encounters.activeBurdens.length - next.encounters.activeBurdens.length
  );
  run.burdensResolved += burdensResolved;
  run.burdensResolvedBySeason[previous.season] += burdensResolved;

  if (
    previous.phase === "endRound" &&
    (previous.round === 4 || previous.round === 8) &&
    next.round !== previous.round
  ) {
    const season = previous.season;
    run.seasonSnapshots[season] = {
      activeBurdens: next.encounters.activeBurdens.length,
      overstrainedTiles: next.map.placedTiles.filter((tile) => tile.strain >= 3).length,
      arrivalsCompleted: run.arrivalsCompletedBySeason[season],
      burdensResolved: run.burdensResolvedBySeason[season]
    };
  }

  if (run.declaredVowId === "LE-026" && countPlacedCategory(next, "travel") > 0) {
    run = addVowViolation(run, "A Travel Tile was placed.");
  }
  if (run.declaredVowId === "LE-027" && countFarmsteads(next) > 0) {
    run = addVowViolation(run, "A Farmstead was placed.");
  }
  if (
    run.declaredVowId === "LE-028" &&
    countUpgradedCore(next) > countUpgradedCore(previous)
  ) {
    run = addVowViolation(run, "A Core Tile was upgraded.");
  }
  if (run.declaredVowId === "LE-029" && arrivalsExpired > 0) {
    run = addVowViolation(run, "An Arrival expired.");
  }
  if (
    run.declaredVowId === "LE-030" &&
    Math.max(...Object.values(run.warehousePeakByResource)) > 8
  ) {
    run = addVowViolation(run, "The Warehouse exceeded 8 of a resource.");
  }

  return { ...next, ledgerRun: run };
}

function areTilesAdjacent(a: PlacedTile, b: PlacedTile): boolean {
  return a.hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => b.hexIds.includes(neighborId))
  );
}

function eligibleTiles(state: GameState): PlacedTile[] {
  return state.map.placedTiles.filter((tile) => tile.strain < 3);
}

function tileAtHex(tiles: PlacedTile[], hexId: string): PlacedTile | undefined {
  return tiles.find((tile) => tile.hexIds.includes(hexId));
}

function ringTileSets(tiles: PlacedTile[]): Set<string>[] {
  const rings: Set<string>[] = [];
  for (const cell of mapCells) {
    const neighbors = getHexNeighbors(cell.id);
    if (neighbors.length !== 6) continue;
    const ringTiles = neighbors.map((hexId) => tileAtHex(tiles, hexId));
    if (ringTiles.some((tile) => !tile)) continue;
    const ids = new Set(ringTiles.map((tile) => tile?.instanceId ?? ""));
    if (ids.size === 6) rings.push(ids);
  }
  return rings;
}

function countSeparateRings(rings: Set<string>[]): number {
  const used = new Set<string>();
  let count = 0;
  for (const ring of rings) {
    if ([...ring].some((id) => used.has(id))) continue;
    ring.forEach((id) => used.add(id));
    count += 1;
  }
  return count;
}

function housingTouchesRiverSide(tiles: PlacedTile[], side: "west" | "east"): boolean {
  const riverColumns = mapCells
    .filter((cell) => cell.terrain === "water")
    .map((cell) => mapColumns.indexOf(cell.col));
  const riverMidpoint = riverColumns.reduce((sum, col) => sum + col, 0) / riverColumns.length;
  return tiles.some((tile) => {
    if (placedTileCategory(tile) !== "housing") return false;
    const cols = tile.hexIds.map((hexId) => mapColumns.indexOf(mapById[hexId]?.col ?? "A"));
    const onSide = side === "west"
      ? cols.some((col) => col < riverMidpoint)
      : cols.some((col) => col > riverMidpoint);
    const touchesWater = tile.hexIds.some((hexId) =>
      getHexNeighbors(hexId).some((neighborId) => mapById[neighborId]?.terrain === "water")
    );
    return onSide && touchesWater;
  });
}

function largestTravelGroupHexes(tiles: PlacedTile[]): number {
  const travelTiles = tiles.filter((tile) => placedTileCategory(tile) === "travel");
  const visited = new Set<string>();
  let largest = 0;
  for (const tile of travelTiles) {
    if (visited.has(tile.instanceId)) continue;
    const queue = [tile];
    visited.add(tile.instanceId);
    let hexes = 0;
    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      hexes += current.hexIds.length;
      for (const candidate of travelTiles) {
        if (visited.has(candidate.instanceId) || !areTilesAdjacent(current, candidate)) continue;
        visited.add(candidate.instanceId);
        queue.push(candidate);
      }
    }
    largest = Math.max(largest, hexes);
  }
  return largest;
}

function campaignCompletedCount(campaign: LedgerCampaign): number {
  return Object.values(campaign.completions).filter(
    (completion) => completion.completedOnce || (completion.completedPlayerCounts?.length ?? 0) > 0
  ).length;
}

function thresholdFor(entry: LedgerEntry, playerCount: number): number {
  return entry.thresholdsByPlayerCount?.[String(playerCount)] ?? 0;
}

function formatProgress(current: number, target: number, label: string): string {
  return `${current}/${target} ${label}`;
}

export function evaluateLedgerEntries(
  state: GameState,
  campaign: LedgerCampaign
): LedgerEntryEvaluation[] {
  const run = getLedgerRun(state);
  const completedCount = campaignCompletedCount(campaign);
  const tiles = state.map.placedTiles;
  const eligible = eligibleTiles(state);
  const score = calculateFinalScore(state);
  const renown = score.finalScore - score.population;
  const overstrained = tiles.filter((tile) => tile.strain >= 3).length;
  const strain = tiles.reduce((total, tile) => total + tile.strain, 0);
  const activeBurdens = state.encounters.activeBurdens.length;
  const warehouseTotal = Object.values(state.warehouse).reduce((sum, amount) => sum + amount, 0);
  const categoryCounts = new Map<string, number>();
  const eligibleCategoryCounts = new Map<string, number>();
  for (const tile of tiles) {
    const category = placedTileCategory(tile);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  for (const tile of eligible) {
    const category = placedTileCategory(tile);
    eligibleCategoryCounts.set(category, (eligibleCategoryCounts.get(category) ?? 0) + 1);
  }
  const housing = tiles.filter((tile) => placedTileCategory(tile) === "housing");
  const eligibleHousing = eligible.filter((tile) => placedTileCategory(tile) === "housing");
  const allHousingPaired = eligibleHousing.every((tile) =>
    eligibleHousing.some(
      (candidate) => candidate.instanceId !== tile.instanceId && areTilesAdjacent(tile, candidate)
    )
  );
  const maxHousingStrain = housing.reduce((max, tile) => Math.max(max, tile.strain), 0);
  const upgraded = tiles.filter(
    (tile) => tile.kind === "core" && tile.side === "upgraded"
  ).length;
  const upgradedEligible = eligible.filter(
    (tile) => tile.kind === "core" && tile.side === "upgraded"
  ).length;
  const specialPlaced = tiles.filter(
    (tile) => tile.kind === "special" && !tile.tileId.startsWith("golden_tile_")
  ).length;
  const unlockedSpecial = state.encounters.completedArrivals.reduce(
    (total, arrival) => total + arrival.specialTileIds.length,
    0
  );
  const rings = ringTileSets(eligible);
  const separateRings = countSeparateRings(rings);
  const mixedRings = countSeparateRings(
    rings.filter((ring) => {
      const qualifying = [...ring].filter((id) => {
        const tile = eligible.find((candidate) => candidate.instanceId === id);
        return tile && ["housing", "social", "wellbeing"].includes(placedTileCategory(tile));
      }).length;
      return qualifying >= 3;
    })
  );
  const travelAdjacentRiver = eligible.filter(
    (tile) =>
      placedTileCategory(tile) === "travel" &&
      tile.hexIds.some((hexId) =>
        getHexNeighbors(hexId).some((neighborId) => mapById[neighborId]?.terrain === "water")
      )
  ).length;
  const qualifyingTerrains = new Set(
    eligible
      .flatMap((tile) => tile.hexIds)
      .map((hexId) => mapById[hexId]?.terrain)
      .filter((terrain) => terrain && terrain !== "grasslands" && terrain !== "water")
  ).size;
  const categoriesAdjacentHousing = new Set(
    eligible
      .filter((tile) => ["crafting", "merchant", "social", "wellbeing"].includes(placedTileCategory(tile)))
      .filter((tile) => eligibleHousing.some((home) => areTilesAdjacent(tile, home)))
      .map(placedTileCategory)
  );
  const specialAdjacentHousing = eligible.filter(
    (tile) =>
      tile.kind === "special" &&
      !tile.tileId.startsWith("golden_tile_") &&
      eligibleHousing.some((home) => areTilesAdjacent(tile, home))
  ).length;
  const resourceTypesAt10 = Object.values(state.warehouse).filter((amount) => amount >= 10).length;
  const stewardObjectives = evaluateStewardObjectives(state);
  const objectiveIds = new Set(
    stewardObjectives.filter((objective) => objective.met).map((objective) => objective.stewardId)
  );
  const chosenStewards = new Set([
    ...campaign.games.flatMap((game) => game.stewardIds),
    ...state.players.map((player) => player.stewardId)
  ]);
  const completedObjectiveIds = new Set([
    ...campaign.games.flatMap((game) => game.completedStewardObjectiveIds ?? []),
    ...objectiveIds
  ]);

  return ledgerEntries.map((entry) => {
    const target = thresholdFor(entry, state.playerCount);
    const locked = completedCount < entry.unlockAt;
    const stewardPresent = !entry.requiredSteward || state.players.some(
      (player) => player.stewardId === entry.requiredSteward?.toLowerCase()
    );
    const vowSelected = !entry.declaredVow || run.declaredVowId === entry.id;
    const vowFailed = entry.declaredVow && run.declaredVowId === entry.id && run.violatedVowReasons.length > 0;
    let met = false;
    let progressLabel = "Checked at game end";

    switch (entry.id) {
      case "LE-001": met = score.finalScore >= target; progressLabel = formatProgress(score.finalScore, target, "score"); break;
      case "LE-002": met = score.population >= target; progressLabel = formatProgress(score.population, target, "Population"); break;
      case "LE-003": met = renown >= target; progressLabel = formatProgress(renown, target, "Renown"); break;
      case "LE-004": met = activeBurdens === 0 && overstrained === 0 && strain <= target; progressLabel = `${activeBurdens} Burdens · ${overstrained} Overstrained · ${strain}/${target} Strain`; break;
      case "LE-005": met = separateRings >= 3; progressLabel = formatProgress(separateRings, 3, "separate rings"); break;
      case "LE-006": met = mixedRings >= 2; progressLabel = formatProgress(mixedRings, 2, "mixed rings"); break;
      case "LE-007": met = eligibleHousing.length >= target && allHousingPaired; progressLabel = `${eligibleHousing.length}/${target} Housing · ${allHousingPaired ? "all paired" : "an isolated home remains"}`; break;
      case "LE-008": met = eligibleCategoryCounts.size >= target; progressLabel = formatProgress(eligibleCategoryCounts.size, target, "categories"); break;
      case "LE-009": met = eligibleCategoryCounts.size >= 8; progressLabel = formatProgress(eligibleCategoryCounts.size, 8, "categories"); break;
      case "LE-010": met = hasConnectedBridgeCrossing(eligible); progressLabel = met ? "River crossing connected" : "No complete crossing"; break;
      case "LE-011": met = hasConnectedBridgeCrossing(eligible) && housingTouchesRiverSide(eligible, "west") && housingTouchesRiverSide(eligible, "east"); progressLabel = met ? "Hearths reach both banks" : "Both banks are not yet housed"; break;
      case "LE-012": met = travelAdjacentRiver >= target; progressLabel = formatProgress(travelAdjacentRiver, target, "riverside Travel Tiles"); break;
      case "LE-013": case "LE-014": met = specialPlaced >= target; progressLabel = formatProgress(specialPlaced, target, "Special Tiles"); break;
      case "LE-015": met = specialPlaced >= target && specialPlaced >= unlockedSpecial; progressLabel = `${specialPlaced}/${target} placed · ${Math.max(0, unlockedSpecial - specialPlaced)} unlocked unplaced`; break;
      case "LE-016": met = run.arrivalsRevealed > 0 && run.arrivalsCompleted === run.arrivalsRevealed && run.arrivalsExpired === 0 && activeBurdens === 0; progressLabel = `${run.arrivalsCompleted}/${run.arrivalsRevealed} Arrivals · ${run.arrivalsExpired} expired`; break;
      case "LE-017": met = activeBurdens === 0 && overstrained === 0; progressLabel = `${activeBurdens} Burdens · ${overstrained} Overstrained`; break;
      case "LE-018": met = overstrained === 0 && strain <= target; progressLabel = `${overstrained} Overstrained · ${strain}/${target} Strain`; break;
      case "LE-019": case "LE-044": met = run.strainPreventedBySupported >= target; progressLabel = formatProgress(run.strainPreventedBySupported, target, "Strain prevented"); break;
      case "LE-020": met = housing.length >= target && maxHousingStrain < 2; progressLabel = `${housing.length}/${target} Housing · max ${maxHousingStrain} Strain`; break;
      case "LE-021": case "LE-022": met = upgraded >= target; progressLabel = formatProgress(upgraded, target, "upgrades"); break;
      case "LE-023": met = warehouseTotal >= target; progressLabel = formatProgress(warehouseTotal, target, "Warehouse resources"); break;
      case "LE-024": met = (categoryCounts.get("crafting") ?? 0) >= target && (categoryCounts.get("merchant") ?? 0) >= target; progressLabel = `${categoryCounts.get("crafting") ?? 0}/${target} Crafting · ${categoryCounts.get("merchant") ?? 0}/${target} Merchant`; break;
      case "LE-025": met = (eligibleCategoryCounts.get("travel") ?? 0) >= target; progressLabel = formatProgress(eligibleCategoryCounts.get("travel") ?? 0, target, "non-Overstrained Travel Tiles"); break;
      case "LE-026": met = (categoryCounts.get("travel") ?? 0) === 0 && score.finalScore >= target; progressLabel = `0 Travel required · ${score.finalScore}/${target} score`; break;
      case "LE-027": met = countFarmsteads(state) === 0 && score.finalScore >= target; progressLabel = `0 Farmsteads required · ${score.finalScore}/${target} score`; break;
      case "LE-028": met = upgraded === 0 && score.finalScore >= target; progressLabel = `0 upgrades required · ${score.finalScore}/${target} score`; break;
      case "LE-029": met = run.arrivalsRevealed > 0 && run.arrivalsExpired === 0; progressLabel = `${run.arrivalsRevealed} revealed · ${run.arrivalsExpired} expired`; break;
      case "LE-030": { const peak = Math.max(...Object.values(run.warehousePeakByResource)); met = peak <= 8; progressLabel = `${peak}/8 highest Warehouse amount`; break; }
      case "LE-031": met = chosenStewards.size >= 6; progressLabel = formatProgress(chosenStewards.size, 6, "Stewards used"); break;
      case "LE-032": met = objectiveIds.has("vanguard") && hasConnectedBridgeCrossing(eligible); progressLabel = objectiveIds.has("vanguard") ? "Vanguard objective complete" : "Vanguard objective incomplete"; break;
      case "LE-033": met = objectiveIds.has("knight") && maxHousingStrain === 0; progressLabel = `${objectiveIds.has("knight") ? "Objective complete" : "Objective incomplete"} · max ${maxHousingStrain} Housing Strain`; break;
      case "LE-034": met = objectiveIds.has("sentinel") && upgradedEligible >= 8; progressLabel = `${upgradedEligible}/8 eligible upgrades`; break;
      case "LE-035": met = objectiveIds.has("ranger") && qualifyingTerrains >= 4; progressLabel = `${qualifyingTerrains}/4 terrain types`; break;
      case "LE-036": met = objectiveIds.has("warden") && activeBurdens === 0; progressLabel = `${activeBurdens} active Burdens`; break;
      case "LE-037": met = objectiveIds.has("quartermaster") && resourceTypesAt10 >= target; progressLabel = formatProgress(resourceTypesAt10, target, "resource types at 10+"); break;
      case "LE-038": met = completedObjectiveIds.size >= 6; progressLabel = formatProgress(completedObjectiveIds.size, 6, "Steward objectives"); break;
      case "LE-039": { const snapshot = run.seasonSnapshots[1]; met = Boolean(snapshot && snapshot.overstrainedTiles === 0 && snapshot.arrivalsCompleted >= target && snapshot.burdensResolved >= target); progressLabel = snapshot ? `${snapshot.arrivalsCompleted}/${target} Arrivals · ${snapshot.burdensResolved}/${target} Burdens` : "Season I not complete"; break; }
      case "LE-040": { const snapshot = run.seasonSnapshots[2]; met = Boolean(snapshot && snapshot.overstrainedTiles === 0 && snapshot.activeBurdens === 0 && snapshot.burdensResolved >= target); progressLabel = snapshot ? `${snapshot.burdensResolved}/${target} Burdens · ${snapshot.activeBurdens} active` : "Season II not complete"; break; }
      case "LE-041": met = activeBurdens === 0 && overstrained === 0; progressLabel = `${activeBurdens} Burdens · ${overstrained} Overstrained`; break;
      case "LE-042": met = strain === 0; progressLabel = `${strain} Strain tokens`; break;
      case "LE-043": met = run.burdensRevealed >= 2 && run.burdensResolved >= run.burdensRevealed && activeBurdens === 0 && overstrained === 0; progressLabel = `${run.burdensResolved}/${run.burdensRevealed} Burdens answered`; break;
      case "LE-045": met = resourceTypesAt10 >= 3; progressLabel = formatProgress(resourceTypesAt10, 3, "resource types at 10+"); break;
      case "LE-046": met = warehouseTotal <= 2 && score.finalScore >= target; progressLabel = `${warehouseTotal}/2 resources · ${score.finalScore}/${target} score`; break;
      case "LE-047": met = state.warehouse.wood >= 10 && state.warehouse.stone >= 10 && state.warehouse.food >= 10; progressLabel = `${state.warehouse.wood}/10 Wood · ${state.warehouse.stone}/10 Stone · ${state.warehouse.food}/10 Food`; break;
      case "LE-048": met = ["crafting", "merchant", "social", "wellbeing"].every((category) => categoriesAdjacentHousing.has(category)); progressLabel = `${categoriesAdjacentHousing.size}/4 trades beside Housing`; break;
      case "LE-049": { const largest = largestTravelGroupHexes(eligible); met = largest >= target; progressLabel = formatProgress(largest, target, "connected Travel hexes"); break; }
      case "LE-050": met = specialAdjacentHousing >= 4; progressLabel = formatProgress(specialAdjacentHousing, 4, "Special Tiles beside Housing"); break;
    }

    const unavailableReason = locked
      ? `Complete ${entry.unlockAt} named entries first.`
      : !stewardPresent
        ? `${entry.requiredSteward} must be chosen.`
        : !vowSelected
          ? "This Vow was not declared before setup."
          : vowFailed
            ? run.violatedVowReasons.join(" ")
            : undefined;

    return {
      entry,
      eligible: !unavailableReason,
      locked,
      met: met && !vowFailed,
      unavailableReason,
      progressLabel
    };
  });
}

export function recordLedgerGame(
  state: GameState,
  campaign: LedgerCampaign
): LedgerRecordResult {
  const run = getLedgerRun(state);
  if (state.phase !== "gameEnd" || campaign.games.some((game) => game.id === run.gameId)) {
    return { campaign, state, completedEntryIds: [], newlyCompletedEntryIds: [] };
  }

  const evaluations = evaluateLedgerEntries(state, campaign);
  const achieved = evaluations.filter((evaluation) => evaluation.eligible && evaluation.met);
  const nextCompletions = { ...campaign.completions };
  const newlyCompletedEntryIds: string[] = [];

  for (const evaluation of achieved) {
    const existing = nextCompletions[evaluation.entry.id];
    const completedPlayerCounts = new Set(existing?.completedPlayerCounts ?? []);
    if (evaluation.entry.playerCountPrestige) completedPlayerCounts.add(state.playerCount);
    const wasComplete = Boolean(
      existing?.completedOnce || (existing?.completedPlayerCounts?.length ?? 0) > 0
    );
    nextCompletions[evaluation.entry.id] = {
      entryId: evaluation.entry.id,
      completedOnce: true,
      completedPlayerCounts: [...completedPlayerCounts].sort(),
      firstCompletedAt: existing?.firstCompletedAt ?? new Date().toISOString(),
      firstGameId: existing?.firstGameId ?? run.gameId,
      notes: existing?.notes
    };
    if (!wasComplete) newlyCompletedEntryIds.push(evaluation.entry.id);
  }

  const completedObjectiveIds = evaluateStewardObjectives(state)
    .filter((objective) => objective.met)
    .map((objective) => objective.stewardId);
  const score = calculateFinalScore(state);
  const gameRecord: LedgerGameRecord = {
    id: run.gameId,
    completedAt: new Date().toISOString(),
    playerCount: state.playerCount,
    stewardIds: state.players.map((player) => player.stewardId),
    completedStewardObjectiveIds: completedObjectiveIds,
    finalScore: score.finalScore,
    declaredVowId: run.declaredVowId,
    completedEntryIds: achieved.map((evaluation) => evaluation.entry.id)
  };
  const nextCampaign: LedgerCampaign = {
    ...campaign,
    completions: nextCompletions,
    games: [gameRecord, ...campaign.games]
  };
  return {
    campaign: nextCampaign,
    state: { ...state, ledgerRun: { ...run, recorded: true } },
    completedEntryIds: gameRecord.completedEntryIds,
    newlyCompletedEntryIds
  };
}

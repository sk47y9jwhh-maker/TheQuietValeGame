import { describe, expect, it } from "vitest";
import {
  createEmptyLedgerCampaign,
  countCompletedLedgerEntries,
  type LedgerCampaign
} from "../app/ledgerPersistence";
import { ledgerEntries, ledgerMilestones, ledgerUnlockGates } from "../data/ledger";
import { mapById, mapCells, mapColumns } from "../data/map";
import { specialTiles } from "../data/tiles";
import { evaluateLedgerEntries } from "../engine/ledger";
import { evaluateStewardObjectives } from "../engine/scoring";
import { createNewGame } from "../engine/setup";
import { getHexNeighbors } from "../engine/hex";
import type { GameState, PlacedTile, PlayerCount, TileCategory } from "../engine/types";

type PlayStyle = "casual" | "balanced" | "scoreFirst" | "ledgerAware";

interface PacingPolicy {
  name: string;
  gate(entryId: string): number;
  milestones: number[];
  maxNewPerGame?: number;
}

const stewards = ["vanguard", "knight", "sentinel", "ranger", "warden", "quartermaster"];
const styles: PlayStyle[] = ["casual", "balanced", "scoreFirst", "ledgerAware"];
const currentMilestones = [5, 10, 15, 20, 30];
const proposedMilestones = ledgerMilestones.map((milestone) => milestone.threshold);

function legacyGate(entryId: string): number {
  if (["LE-001", "LE-002", "LE-003", "LE-021", "LE-022", "LE-044"].includes(entryId)) return 5;
  if (["LE-015", "LE-035", "LE-037", "LE-040", "LE-041", "LE-050"].includes(entryId)) return 10;
  if (["LE-004", "LE-023", "LE-026", "LE-027", "LE-028", "LE-030", "LE-045", "LE-046", "LE-047"].includes(entryId)) return 20;
  return 0;
}

const policies: PacingPolicy[] = [
  {
    name: "current",
    gate: legacyGate,
    milestones: currentMilestones
  },
  {
    name: "milestones-only",
    gate: legacyGate,
    milestones: proposedMilestones
  },
  {
    name: "staggered",
    gate: (entryId) => ledgerUnlockGates[entryId] ?? 0,
    milestones: proposedMilestones
  },
  {
    name: "six-entry-cap",
    gate: legacyGate,
    milestones: proposedMilestones,
    maxNewPerGame: 6
  }
];

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function qualityFor(style: PlayStyle, random: () => number, goldenPairs: number): number {
  const center = { casual: 0.5, balanced: 0.68, scoreFirst: 0.76, ledgerAware: 0.84 }[style];
  return Math.min(0.98, Math.max(0.25, center + (random() - 0.5) * 0.22 + goldenPairs * 0.012));
}

function crossingHexes(): [string, string, string] {
  for (const cell of mapCells) {
    if (cell.terrain !== "water") continue;
    const col = mapColumns.indexOf(cell.col);
    const neighbors = getHexNeighbors(cell.id).filter(
      (hexId) => mapById[hexId]?.terrain !== "water"
    );
    const west = neighbors.find((hexId) => mapColumns.indexOf(mapById[hexId].col) < col);
    const east = neighbors.find((hexId) => mapColumns.indexOf(mapById[hexId].col) > col);
    if (west && east) return [west, cell.id, east];
  }
  throw new Error("The map needs at least one one-hex river crossing.");
}

const crossing = crossingHexes();

function orderedHexes(): string[] {
  const visited = new Set<string>(["G5"]);
  const queue = ["G5"];
  const result: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || !mapById[current]) continue;
    result.push(current);
    for (const neighbor of getHexNeighbors(current)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return [...crossing, ...result.filter((hexId) => !crossing.includes(hexId))];
}

const hexes = orderedHexes();
const categoryTileIds: Record<Exclude<TileCategory, "special">, string[]> = {
  resource: ["c01_lumber_yard", "c02_mine_tunnel", "c03_gathering_outpost", "c20_dig_site"],
  housing: ["c05_cabin", "c06_cottage", "c08_inn", "c07_stedding"],
  crafting: ["c13_workshops"],
  merchant: ["c14_market_stalls"],
  social: ["c09_tavern", "c10_eatery"],
  wellbeing: ["c11_washhouse", "c12_apothecary"],
  travel: ["c15_path", "c16_street", "c17_track", "c18_common_land"]
};

function placedTile(
  instanceId: string,
  tileId: string,
  hexId: string,
  upgraded: boolean,
  strain: number,
  special = false
): PlacedTile {
  return {
    instanceId,
    tileId,
    kind: special ? "special" : "core",
    side: special ? "special" : upgraded ? "upgraded" : "basic",
    hexIds: [hexId],
    strain,
    support: { passive: false, singleUse: false, preventedThisRound: false }
  };
}

function chooseVow(
  style: PlayStyle,
  campaign: LedgerCampaign,
  policy: PacingPolicy,
  random: () => number
): string | undefined {
  const chance = { casual: 0.18, balanced: 0.42, scoreFirst: 0.28, ledgerAware: 0.92 }[style];
  if (random() > chance) return undefined;
  const completed = countCompletedLedgerEntries(campaign);
  const candidates = ledgerEntries.filter(
    (entry) =>
      entry.declaredVow &&
      policy.gate(entry.id) <= completed &&
      !campaign.completions[entry.id]
  );
  return candidates[Math.floor(random() * candidates.length)]?.id;
}

function makeEndState(
  playerCount: PlayerCount,
  style: PlayStyle,
  gameIndex: number,
  campaign: LedgerCampaign,
  policy: PacingPolicy,
  random: () => number
): GameState {
  const completed = countCompletedLedgerEntries(campaign);
  const goldenPairs = policy.milestones.filter((threshold) => completed >= threshold).length;
  const quality = qualityFor(style, random, goldenPairs);
  const stewardIds = Array.from(
    { length: playerCount },
    (_, index) => stewards[(gameIndex * playerCount + index) % stewards.length]
  );
  const vowId = chooseVow(style, campaign, policy, random);
  const state = createNewGame(playerCount, stewardIds, {
    declaredVowId: vowId,
    encounterSeed: `pacing-${policy.name}-${style}-${playerCount}-${gameIndex}`
  });
  state.phase = "gameEnd";
  state.round = 12;
  state.season = 3;

  const tileCount = Math.min(78, 18 + playerCount * 6 + Math.round(quality * 11));
  const categoryCounts: Record<Exclude<TileCategory, "special">, number> = {
    resource: 4 + playerCount,
    housing: 5 + playerCount * 2 + (style === "scoreFirst" ? 3 : 0),
    crafting: playerCount > 2 ? 2 : 1,
    merchant: playerCount > 2 ? 2 : 1,
    social: 2 + playerCount,
    wellbeing: 2 + playerCount,
    travel: 4 + playerCount * 2
  };
  const specialCount = Math.max(1, Math.round((2 + playerCount * 1.5) * quality));

  if (vowId === "LE-009") {
    for (const category of Object.keys(categoryCounts) as (keyof typeof categoryCounts)[]) {
      categoryCounts[category] = Math.max(1, categoryCounts[category]);
    }
  }
  if (vowId === "LE-014") categoryCounts.housing += 2;
  if (vowId === "LE-026") categoryCounts.travel = 0;
  if (vowId === "LE-049") categoryCounts.travel = 8 + (playerCount - 1) * 2;

  const categorySequence = (Object.entries(categoryCounts) as [keyof typeof categoryCounts, number][])
    .flatMap(([category, count]) => Array.from({ length: count }, () => category));
  while (categorySequence.length + specialCount < tileCount) {
    categorySequence.push(["housing", "travel", "social", "wellbeing"][categorySequence.length % 4] as keyof typeof categoryCounts);
  }
  categorySequence.length = Math.max(0, tileCount - specialCount);

  const zeroStrain = random() < Math.pow(quality, 4.2);
  const strainTokens = zeroStrain ? 0 : Math.max(1, Math.round((1 - quality) * (4 + playerCount * 3)));
  const hasOverstrained = !zeroStrain && random() > quality + 0.08;
  const upgradedTarget = vowId === "LE-028"
    ? 0
    : Math.round(tileCount * (0.12 + quality * 0.28));
  const placements: PlacedTile[] = [];

  for (let index = 0; index < categorySequence.length; index += 1) {
    const category = categorySequence[index];
    const choices = categoryTileIds[category];
    const tileId = index === 0 && category === "travel"
      ? "c19_bridge"
      : choices[index % choices.length];
    placements.push(
      placedTile(
        `tile_${index}`,
        tileId,
        hexes[index],
        index < upgradedTarget,
        hasOverstrained && index === categorySequence.length - 1 ? 3 : 0
      )
    );
  }
  for (let index = 0; index < specialCount; index += 1) {
    const data = specialTiles[index % specialTiles.length];
    placements.push(
      placedTile(
        `special_${index}`,
        data.id,
        hexes[categorySequence.length + index],
        false,
        0,
        true
      )
    );
  }
  for (let index = 0; index < strainTokens; index += 1) {
    const tile = placements[(index * 7 + 3) % placements.length];
    if (tile.strain < 2) tile.strain += 1;
  }

  // Ledger-aware bridge games deliberately complete the actual crossing shape.
  if ((style === "ledgerAware" || random() < quality * 0.6) && categoryCounts.travel > 0) {
    const bridgeIndex = placements.findIndex((tile) => tile.tileId === "c19_bridge");
    if (bridgeIndex >= 0) placements[bridgeIndex].hexIds = [crossing[1]];
    if (placements[bridgeIndex + 1]) placements[bridgeIndex + 1].hexIds = [crossing[0]];
    if (placements[bridgeIndex + 2]) placements[bridgeIndex + 2].hexIds = [crossing[2]];
  }
  state.map.placedTiles = placements;

  const arrivalsRevealed = 3 + playerCount * 2;
  const arrivalsCompleted = Math.min(
    arrivalsRevealed,
    Math.round(arrivalsRevealed * (quality + (style === "ledgerAware" ? 0.12 : 0)))
  );
  const arrivalsExpired = Math.max(0, arrivalsRevealed - arrivalsCompleted - (random() < quality ? 1 : 0));
  const burdensRevealed = 3 + playerCount * 2;
  const burdensResolved = Math.min(
    burdensRevealed,
    Math.round(burdensRevealed * (quality + (style === "ledgerAware" ? 0.1 : 0)))
  );
  const activeBurdens = random() < quality
    ? Math.max(0, burdensRevealed - burdensResolved - 1)
    : Math.max(1, burdensRevealed - burdensResolved);
  state.encounters.completedArrivals = Array.from({ length: arrivalsCompleted }, (_, index) => ({
    cardId: `sim_arrival_${index}`,
    specialTileIds: index < specialCount ? [specialTiles[index % specialTiles.length].id] : []
  }));
  state.encounters.activeBurdens = Array.from({ length: activeBurdens }, (_, index) => `sim_burden_${index}`);

  const warehouseCenter = style === "scoreFirst" ? 5 : 4 + quality * 8;
  for (const resource of Object.keys(state.warehouse) as (keyof typeof state.warehouse)[]) {
    state.warehouse[resource] = Math.max(0, Math.round(warehouseCenter + (random() - 0.5) * 6));
  }
  if (vowId === "LE-030") {
    for (const resource of Object.keys(state.warehouse) as (keyof typeof state.warehouse)[]) {
      state.warehouse[resource] = Math.min(8, state.warehouse[resource]);
    }
  }
  if (vowId === "LE-045") {
    state.warehouse.wood = 10;
    state.warehouse.stone = 10;
    state.warehouse.food = 10;
  }
  if (vowId === "LE-047") {
    state.warehouse.wood = 10;
    state.warehouse.stone = 10;
    state.warehouse.food = 10;
  }

  const run = state.ledgerRun!;
  run.gameId = `sim_${policy.name}_${style}_${playerCount}_${gameIndex}_${Math.floor(random() * 1e9)}`;
  run.arrivalsRevealed = arrivalsRevealed;
  run.arrivalsCompleted = arrivalsCompleted;
  run.arrivalsExpired = vowId === "LE-029" && style === "ledgerAware" ? 0 : arrivalsExpired;
  run.burdensRevealed = burdensRevealed;
  run.burdensResolved = vowId === "LE-043" ? burdensRevealed : burdensResolved;
  if (vowId === "LE-043") state.encounters.activeBurdens = [];
  run.strainPreventedBySupported = Math.round(quality * (2 + playerCount * 2) + random() * 2);
  run.warehousePeakByResource = { ...state.warehouse };
  run.seasonSnapshots = {
    1: {
      activeBurdens: Math.max(0, activeBurdens - 1),
      overstrainedTiles: hasOverstrained ? 1 : 0,
      arrivalsCompleted: Math.max(0, Math.round(arrivalsCompleted / 3)),
      burdensResolved: Math.max(0, Math.round(burdensResolved / 3))
    },
    2: {
      activeBurdens,
      overstrainedTiles: hasOverstrained ? 1 : 0,
      arrivalsCompleted: Math.max(0, Math.round(arrivalsCompleted / 3)),
      burdensResolved: Math.max(0, Math.round(burdensResolved / 3))
    }
  };
  return state;
}

function unlockedCampaign(campaign: LedgerCampaign): LedgerCampaign {
  const completions = { ...campaign.completions };
  for (const entry of ledgerEntries) {
    completions[`simulation_unlock_${entry.id}`] = {
      entryId: `simulation_unlock_${entry.id}`,
      completedOnce: true,
      completedPlayerCounts: []
    };
  }
  return { ...campaign, completions };
}

function recordSimulatedGame(
  state: GameState,
  campaign: LedgerCampaign,
  policy: PacingPolicy
): { campaign: LedgerCampaign; newCount: number } {
  const completedAtStart = countCompletedLedgerEntries(campaign);
  let achieved = evaluateLedgerEntries(state, unlockedCampaign(campaign)).filter(
    (evaluation) =>
      evaluation.eligible &&
      evaluation.met &&
      policy.gate(evaluation.entry.id) <= completedAtStart &&
      !campaign.completions[evaluation.entry.id]
  );
  if (policy.maxNewPerGame) achieved = achieved.slice(0, policy.maxNewPerGame);
  const completions = { ...campaign.completions };
  for (const evaluation of achieved) {
    completions[evaluation.entry.id] = {
      entryId: evaluation.entry.id,
      completedOnce: true,
      completedPlayerCounts: evaluation.entry.playerCountPrestige ? [state.playerCount] : [],
      firstGameId: state.ledgerRun?.gameId
    };
  }
  const completedStewardObjectiveIds = evaluateStewardObjectives(state)
    .filter((objective) => objective.met)
    .map((objective) => objective.stewardId);
  return {
    campaign: {
      ...campaign,
      completions,
      games: [
        ...campaign.games,
        {
          id: state.ledgerRun?.gameId ?? `sim_${campaign.games.length}`,
          completedAt: "simulation",
          playerCount: state.playerCount,
          stewardIds: state.players.map((player) => player.stewardId),
          finalScore: 0,
          declaredVowId: state.ledgerRun?.declaredVowId,
          completedStewardObjectiveIds,
          completedEntryIds: achieved.map((evaluation) => evaluation.entry.id)
        }
      ]
    },
    newCount: achieved.length
  };
}

function percentile(values: number[], proportion: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * proportion))];
}

interface SimulationSummary {
  policy: string;
  style: PlayStyle;
  playerCount: PlayerCount;
  medianByGame: number[];
  p10ByGame: number[];
  p90ByGame: number[];
  medianFinalGoldenGame: number | null;
}

function simulate(policy: PacingPolicy, style: PlayStyle, playerCount: PlayerCount): SimulationSummary {
  const campaigns = Math.max(1, Number(process.env.QV_PACING_CAMPAIGNS ?? 3));
  const games = 12;
  const curves: number[][] = [];
  const finalGoldenGames: number[] = [];
  for (let campaignIndex = 0; campaignIndex < campaigns; campaignIndex += 1) {
    const random = seededRandom(
      100_000 * policies.indexOf(policy) + 10_000 * styles.indexOf(style) + 1_000 * playerCount + campaignIndex
    );
    let campaign = createEmptyLedgerCampaign();
    const curve: number[] = [];
    let finalGoldenGame = 0;
    for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
      const state = makeEndState(playerCount, style, gameIndex, campaign, policy, random);
      campaign = recordSimulatedGame(state, campaign, policy).campaign;
      const count = countCompletedLedgerEntries(campaign);
      curve.push(count);
      if (!finalGoldenGame && count >= policy.milestones.at(-1)!) finalGoldenGame = gameIndex + 1;
    }
    curves.push(curve);
    if (finalGoldenGame) finalGoldenGames.push(finalGoldenGame);
  }
  const valuesAtGame = (index: number) => curves.map((curve) => curve[index]);
  return {
    policy: policy.name,
    style,
    playerCount,
    medianByGame: Array.from({ length: games }, (_, index) => percentile(valuesAtGame(index), 0.5)),
    p10ByGame: Array.from({ length: games }, (_, index) => percentile(valuesAtGame(index), 0.1)),
    p90ByGame: Array.from({ length: games }, (_, index) => percentile(valuesAtGame(index), 0.9)),
    medianFinalGoldenGame: finalGoldenGames.length
      ? percentile(finalGoldenGames, 0.5)
      : null
  };
}

describe("Steward's Ledger pacing simulation", () => {
  it("compares deterministic campaign curves across play styles and player counts", () => {
    const summaries = policies.flatMap((policy) =>
      styles.flatMap((style) =>
        ([1, 2, 3, 4] as PlayerCount[]).map((playerCount) => simulate(policy, style, playerCount))
      )
    );
    const compact = summaries.map((summary) => ({
      policy: summary.policy,
      style: summary.style,
      players: summary.playerCount,
      g1: summary.medianByGame[0],
      g2: summary.medianByGame[1],
      g3: summary.medianByGame[2],
      g5: summary.medianByGame[4],
      g8: summary.medianByGame[7],
      g12: summary.medianByGame[11],
      g2Range: `${summary.p10ByGame[1]}-${summary.p90ByGame[1]}`,
      finalGolden: summary.medianFinalGoldenGame
    }));
    if (process.env.QV_PRINT_PACING_RESULTS === "1") {
      const solo = compact.filter((summary) => summary.players === 1);
      const proposedByPlayerCount = compact.filter(
        (summary) => summary.policy === "staggered" && summary.style === "ledgerAware"
      );
      console.log(
        "LEDGER_PACING_RESULTS",
        JSON.stringify({ campaignsPerCombination: Number(process.env.QV_PACING_CAMPAIGNS ?? 3), solo, proposedByPlayerCount })
      );
    }

    const currentThoughtfulSolo = summaries.find(
      (summary) => summary.policy === "current" && summary.style === "ledgerAware" && summary.playerCount === 1
    );
    const staggeredThoughtfulSolo = summaries.find(
      (summary) => summary.policy === "staggered" && summary.style === "ledgerAware" && summary.playerCount === 1
    );
    expect(currentThoughtfulSolo?.medianByGame[1]).toBeGreaterThanOrEqual(15);
    expect(staggeredThoughtfulSolo?.medianByGame[1]).toBeLessThanOrEqual(12);
    expect(staggeredThoughtfulSolo?.medianByGame[0]).toBeLessThanOrEqual(6);
  }, 30_000);
});

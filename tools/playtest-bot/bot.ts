import fs from "node:fs/promises";
import path from "node:path";
import {
  countCompletedLedgerEntries,
  createEmptyLedgerCampaign,
  type LedgerCampaign,
} from "../../src/app/ledgerPersistence";
import { ledgerEntries, type LedgerEntry } from "../../src/data/ledger";
import { stewardById } from "../../src/data/stewards";
import {
  evaluateLedgerEntries,
  recordLedgerGame,
} from "../../src/engine/ledger";
import { calculateFinalScore } from "../../src/engine/scoring";
import type { GameState, PlayerCount } from "../../src/engine/types";
import { simulateCurrentGame } from "../ledger-pacing/current-prototype-simulation";

export type BotProfile = "human" | "casual" | "guided" | "chaser";

export interface PlaytestBotOptions {
  playerCount: PlayerCount;
  profile: BotProfile;
  games: number;
  seed: string;
  campaign?: LedgerCampaign;
}

export interface BotGameResult {
  game: number;
  seed: string;
  profile: BotProfile;
  playerCount: PlayerCount;
  targetEntryIds: string[];
  achievedTargetEntryIds: string[];
  newlyCompletedEntryIds: string[];
  cumulativeCompletedEntries: number;
  finalScore: number;
  population: number;
  renown: number;
  placedTiles: number;
  upgradedTiles: number;
  activeBurdens: number;
  totalStrain: number;
  declaredVowId?: string;
  selectedGoldenTileId?: string;
  selectedGoldenBoonId?: string;
  actions: {
    place: number;
    upgrade: number;
    activate: number;
    encounter: number;
    freePlacement: number;
    unused: number;
    earlyEndTurns: number;
  };
  stewardIds: string[];
  warehouse: GameState["warehouse"];
  categoryCounts: Record<string, number>;
  completedArrivals: number;
  arrivalsExpired: number;
  burdensResolved: number;
  overstrainedTiles: number;
  boardTiles: Array<{
    instanceId: string;
    tileId: string;
    side: "basic" | "upgraded" | "special";
    strain: number;
    activated: number;
    scoreContribution: number;
    populationContribution: number;
    renownContribution: number;
  }>;
  encounterCardIdsSeen: string[];
  completedArrivalIds: string[];
  resolvedBurdenIds: string[];
  activeBurdenIds: string[];
  activeArrivalIds: string[];
  usedBoonIds: string[];
  strategyPlans: any[];
  actionReasons: any[];
  engineMetrics: Record<string, unknown>;
  eventLog: string[];
  decisionNotes: string[];
  errors: string[];
}

export interface PlaytestCampaignResult {
  seed: string;
  profile: BotProfile;
  playerCount: PlayerCount;
  games: BotGameResult[];
  campaign: LedgerCampaign;
}

interface PlanningMemory {
  previousTargets: string[];
  previousAchievedTargets: string[];
  failedAttemptsByEntry: Record<string, number>;
}

const engineProfile: Record<BotProfile, "passive_normal" | "guided_ledger" | "achievement_chaser" | "human_like"> = {
  human: "human_like",
  casual: "passive_normal",
  guided: "guided_ledger",
  chaser: "achievement_chaser",
};

function seedHash(text: string): number {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function createRandom(seed: string): () => number {
  let value = seedHash(seed);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function completionIds(campaign: LedgerCampaign): Set<string> {
  return new Set(
    Object.entries(campaign.completions)
      .filter(([, completion]) => completion.completedOnce || completion.completedPlayerCounts.length > 0)
      .map(([entryId]) => entryId),
  );
}

function entriesConflict(a: LedgerEntry, b: LedgerEntry): boolean {
  if (a.declaredVow && b.declaredVow) return true;
  const pair = new Set([a.id, b.id]);
  if (pair.has("LE-026") && ["LE-010", "LE-011", "LE-012", "LE-025", "LE-032", "LE-049"].some((id) => pair.has(id))) return true;
  if (pair.has("LE-028") && ["LE-021", "LE-022", "LE-034"].some((id) => pair.has(id))) return true;
  if (pair.has("LE-046") && ["LE-023", "LE-045", "LE-047"].some((id) => pair.has(id))) return true;
  return false;
}

function entryPlanningScore(
  entry: LedgerEntry,
  profile: BotProfile,
  gameIndex: number,
  memory: PlanningMemory,
  random: () => number,
): number {
  const bandScore = {
    Foundation: 9,
    Standard: 7,
    Directed: 5,
    Capstone: 2,
  }[entry.pacingBand] ?? 4;
  let score = bandScore + random() * 2;
  if (profile === "chaser") score += entry.pacingBand === "Capstone" ? 2 : 5;
  if (["guided", "human"].includes(profile) && entry.pacingBand === "Directed") score += gameIndex >= 3 ? 3 : 0;
  if (entry.declaredVow) score += profile === "chaser" ? 5 : gameIndex % 2 === 0 ? 2 : -4;
  if (entry.requiredSteward) score += 2;
  if (memory.previousTargets.includes(entry.id) && !memory.previousAchievedTargets.includes(entry.id)) score += 1;
  if (entry.unlockAt > 20 && gameIndex < 6) score -= 5;
  // Rotate away from a stubborn goal after a few failed Seasons, as a human
  // group normally would, so the campaign still explores other Ledger ideas.
  const failedAttempts = memory.failedAttemptsByEntry[entry.id] ?? 0;
  score -= Math.min(12, Math.max(0, failedAttempts - 2) * 2.5);
  return score;
}

export function chooseLedgerTargets(
  campaign: LedgerCampaign,
  profile: BotProfile,
  gameIndex: number,
  seed: string,
  memory: PlanningMemory = {
    previousTargets: [],
    previousAchievedTargets: [],
    failedAttemptsByEntry: {},
  },
  playerCount: PlayerCount = 1,
): string[] {
  if (profile === "casual") return [];
  const random = createRandom(`${seed}:targets:${gameIndex}`);
  const completed = completionIds(campaign);
  const completedCount = countCompletedLedgerEntries(campaign);
  const attemptedVows = new Set(
    campaign.games.map((game) => game.declaredVowId).filter(Boolean),
  );
  const ranked = ledgerEntries
    .filter((entry) => !completed.has(entry.id) && completedCount >= entry.unlockAt)
    .map((entry) => ({
      entry,
      score:
        entryPlanningScore(entry, profile, gameIndex, memory, random) -
        (entry.declaredVow && attemptedVows.has(entry.id) ? 8 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const limit = profile === "chaser" ? 3 : 2;
  const selected: LedgerEntry[] = [];
  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    if (selected.some((entry) => entriesConflict(entry, candidate.entry))) continue;
    const requiredStewards = new Set(
      [...selected, candidate.entry]
        .map((entry) => entry.requiredSteward)
        .filter((steward): steward is string => Boolean(steward)),
    );
    if (requiredStewards.size > playerCount) continue;
    selected.push(candidate.entry);
  }
  return selected.map((entry) => entry.id);
}

function legacyCampaignState(campaign: LedgerCampaign) {
  const chosenStewards = campaign.games
    .flatMap((game) => game.stewardIds)
    .map((stewardId) => stewardById[stewardId]?.name ?? stewardId);
  return {
    completed_named_entries: [...completionIds(campaign)],
    completed_prestige_boxes: Object.values(campaign.completions).flatMap((completion) =>
      completion.completedPlayerCounts.map((playerCount) => `${completion.entryId}:${playerCount}`),
    ),
    chosen_stewards: [...new Set(chosenStewards)],
    completed_steward_objectives: [
      ...new Set(campaign.games.flatMap((game) => game.completedStewardObjectiveIds ?? [])),
    ],
    attempted_vows: [
      ...new Set(campaign.games.map((game) => game.declaredVowId).filter(Boolean)),
    ],
  };
}

function summarizeGame(
  state: GameState,
  log: any,
  gameIndex: number,
  seed: string,
  profile: BotProfile,
  targets: string[],
  achievedTargets: string[],
  newlyCompletedEntryIds: string[],
  completedCount: number,
): BotGameResult {
  const score = calculateFinalScore(state);
  const categoryCounts: Record<string, number> = {};
  for (const tile of state.map.placedTiles) {
    const category = tile.kind === "special"
      ? "special"
      : log.board.tiles.find((loggedTile: any) => loggedTile.tile_id === tile.tileId)?.category?.toLowerCase() ?? "unknown";
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
  }
  return {
    game: gameIndex,
    seed,
    profile,
    playerCount: state.playerCount,
    targetEntryIds: targets,
    achievedTargetEntryIds: achievedTargets,
    newlyCompletedEntryIds,
    cumulativeCompletedEntries: completedCount,
    finalScore: score.finalScore,
    population: score.population,
    renown: score.finalScore - score.population,
    placedTiles: state.map.placedTiles.length,
    upgradedTiles: state.map.placedTiles.filter(
      (tile) => tile.kind === "core" && tile.side === "upgraded",
    ).length,
    activeBurdens: state.encounters.activeBurdens.length,
    totalStrain: state.map.placedTiles.reduce((total, tile) => total + tile.strain, 0),
    declaredVowId: state.ledgerRun?.declaredVowId,
    selectedGoldenTileId: state.goldenSetup.selectedTileId,
    selectedGoldenBoonId: state.encounters.selectedGoldenBoonId,
    actions: {
      place: log.actions.place_actions,
      upgrade: log.actions.upgrade_actions,
      activate: log.actions.activate_actions,
      encounter: log.actions.encounter_interact_actions,
      freePlacement: log.actions.free_place_effects_used,
      unused: log.actions.unused_actions,
      earlyEndTurns: log.actions.early_end_turns,
    },
    stewardIds: state.players.map((player) => player.stewardId),
    warehouse: { ...state.warehouse },
    categoryCounts,
    completedArrivals: state.encounters.completedArrivals.length,
    arrivalsExpired: state.ledgerRun?.arrivalsExpired ?? 0,
    burdensResolved: state.ledgerRun?.burdensResolved ?? 0,
    overstrainedTiles: state.map.placedTiles.filter((tile) => tile.strain >= 3).length,
    boardTiles: state.map.placedTiles.map((tile) => {
      const without = calculateFinalScore({
        ...state,
        map: {
          ...state.map,
          placedTiles: state.map.placedTiles.filter((candidate) => candidate.instanceId !== tile.instanceId),
        },
      });
      const withoutRenown = without.finalScore - without.population;
      return {
        instanceId: tile.instanceId,
        tileId: tile.tileId,
        side: tile.side,
        strain: tile.strain,
        activated: log.actions.tile_activation_counts_by_instance?.[tile.instanceId] ?? 0,
        scoreContribution: score.finalScore - without.finalScore,
        populationContribution: score.population - without.population,
        renownContribution: (score.finalScore - score.population) - withoutRenown,
      };
    }),
    encounterCardIdsSeen: [...(log.encounters.card_ids_seen ?? [])],
    completedArrivalIds: [...(log.encounters.completed_arrival_ids ?? [])],
    resolvedBurdenIds: [...(log.encounters.resolved_burden_ids ?? [])],
    activeBurdenIds: [...state.encounters.activeBurdens],
    activeArrivalIds: state.encounters.activeArrivals.map((arrival) => arrival.cardId),
    usedBoonIds: [...(log.encounters.used_boon_ids ?? [])],
    strategyPlans: [...(log.strategy_plan_log ?? [])],
    actionReasons: [...(log.action_reason_log ?? [])],
    engineMetrics: { ...(log.engine_metrics ?? {}) },
    eventLog: state.log.map((entry) => `R${entry.round}: ${entry.message}`),
    decisionNotes: [...(log.decision_notes ?? [])],
    errors: [...log.simulation_errors],
  };
}

export function runPlaytestCampaign(options: PlaytestBotOptions): PlaytestCampaignResult {
  let campaign = options.campaign ?? createEmptyLedgerCampaign();
  const results: BotGameResult[] = [];
  let memory: PlanningMemory = {
    previousTargets: [],
    previousAchievedTargets: [],
    failedAttemptsByEntry: {},
  };

  for (let gameIndex = 1; gameIndex <= options.games; gameIndex += 1) {
    const targets = chooseLedgerTargets(
      campaign,
      options.profile,
      gameIndex,
      options.seed,
      memory,
      options.playerCount,
    );
    const gameSeed = `${options.seed}:${options.playerCount}p:${options.profile}:g${gameIndex}`;
    const simulated = simulateCurrentGame({
      playerCount: options.playerCount,
      profile: engineProfile[options.profile],
      seed: gameSeed,
      targets,
      campaignState: legacyCampaignState(campaign),
      unlockCountStart: countCompletedLedgerEntries(campaign),
      returnState: true,
    }) as { state: GameState; log: any };
    const evaluations = evaluateLedgerEntries(simulated.state, campaign);
    const achievedTargets = evaluations
      .filter((evaluation) =>
        targets.includes(evaluation.entry.id) && evaluation.eligible && evaluation.met,
      )
      .map((evaluation) => evaluation.entry.id);
    const recorded = recordLedgerGame(simulated.state, campaign);
    campaign = recorded.campaign;
    results.push(
      summarizeGame(
        recorded.state,
        simulated.log,
        gameIndex,
        gameSeed,
        options.profile,
        targets,
        achievedTargets,
        recorded.newlyCompletedEntryIds,
        countCompletedLedgerEntries(campaign),
      ),
    );
    const failedAttemptsByEntry = { ...memory.failedAttemptsByEntry };
    for (const entryId of targets) {
      if (!achievedTargets.includes(entryId)) {
        failedAttemptsByEntry[entryId] = (failedAttemptsByEntry[entryId] ?? 0) + 1;
      }
    }
    memory = {
      previousTargets: targets,
      previousAchievedTargets: achievedTargets,
      failedAttemptsByEntry,
    };
  }

  return {
    seed: options.seed,
    profile: options.profile,
    playerCount: options.playerCount,
    games: results,
    campaign,
  };
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const value = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] ?? fallback : fallback;
  };
  return {
    playerCount: Number(value("--players", "1")) as PlayerCount,
    profile: value("--profile", "human") as BotProfile,
    games: Number(value("--games", "4")),
    seed: value("--seed", "quiet-vale-playtest"),
    output: value("--output", "outputs/playtest-bot/latest.json"),
  };
}

async function main() {
  const options = parseCliArgs();
  if (![1, 2, 3, 4].includes(options.playerCount)) throw new Error("--players must be 1, 2, 3, or 4");
  if (!["human", "casual", "guided", "chaser"].includes(options.profile)) throw new Error("--profile must be human, casual, guided, or chaser");
  const result = runPlaytestCampaign(options);
  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    output: options.output,
    games: result.games.length,
    finalCompletedEntries: result.games.at(-1)?.cumulativeCompletedEntries ?? 0,
    averageScore: Math.round(
      result.games.reduce((total, game) => total + game.finalScore, 0) /
        Math.max(1, result.games.length),
    ),
    errors: result.games.flatMap((game) => game.errors).length,
  }, null, 2));
}

if (process.env.QV_BOT_CLI === "1") {
  await main();
}

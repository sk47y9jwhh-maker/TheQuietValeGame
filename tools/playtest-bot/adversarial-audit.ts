import fs from "node:fs/promises";
import path from "node:path";
import { coreTileById, specialTileById } from "../../src/data/tiles";
import {
  calculateFinalScore,
  evaluateStewardObjectives,
} from "../../src/engine/scoring";
import type {
  GameState,
  PlayerCount,
  ResourceType,
  TileCategory,
} from "../../src/engine/types";
import { simulateCurrentGame } from "../ledger-pacing/current-prototype-simulation";

type EngineProfile =
  | "passive_normal"
  | "guided_ledger"
  | "achievement_chaser";

interface StrategyArm {
  id: string;
  description: string;
  profile: EngineProfile;
  targets: string[];
  primarySteward?: string;
  declaredVowId?: string;
}

interface AuditOptions {
  runsPerCell: number;
  shardIndex: number;
  shardCount: number;
  output: string;
  maxCells: number;
  maxTiles: number;
  maxPlacementsPerTile: number;
  armIds: string[];
  replayFailuresFrom: string;
}

const strategyArms: StrategyArm[] = [
  {
    id: "casual_baseline",
    description: "Untargeted viable-settlement baseline.",
    profile: "passive_normal",
    targets: [],
  },
  {
    id: "guided_baseline",
    description: "Untargeted but interventionist baseline.",
    profile: "guided_ledger",
    targets: [],
  },
  {
    id: "achievement_mix",
    description: "Broad category, Arrival, Burden, and upgrade pursuit.",
    profile: "achievement_chaser",
    targets: ["LE-012", "LE-019", "LE-024", "LE-031"],
  },
  {
    id: "raw_score_rush",
    description: "Maximise final score without a narrower layout thesis.",
    profile: "guided_ledger",
    targets: ["LE-001"],
  },
  {
    id: "population_rush",
    description: "Convert resources into clustered Housing Population.",
    profile: "guided_ledger",
    targets: ["LE-002", "LE-011"],
    primarySteward: "knight",
  },
  {
    id: "knight_housing_fortress",
    description: "Free Housing placements around support and cluster payoffs.",
    profile: "achievement_chaser",
    targets: ["LE-008", "LE-028", "LE-045"],
    primarySteward: "knight",
  },
  {
    id: "renown_rush",
    description: "Prefer printed and passive Renown over Population.",
    profile: "guided_ledger",
    targets: ["LE-003"],
    primarySteward: "sentinel",
  },
  {
    id: "vanguard_crossing",
    description: "Free Travel action plus repeated Bridges and upgrades.",
    profile: "achievement_chaser",
    targets: ["LE-015", "LE-018", "LE-044"],
    primarySteward: "vanguard",
  },
  {
    id: "travel_web_score",
    description: "Large connected Travel group with boundary and riverbank coverage.",
    profile: "guided_ledger",
    targets: ["LE-001", "LE-006", "LE-016"],
    primarySteward: "vanguard",
  },
  {
    id: "no_roads_vow",
    description: "Adversarial no-Travel expansion and score conversion.",
    profile: "achievement_chaser",
    targets: ["LE-001", "LE-041"],
    primarySteward: "ranger",
    declaredVowId: "LE-041",
  },
  {
    id: "no_upgrades_vow",
    description: "Adversarial all-basic-tile economy and scoring plan.",
    profile: "achievement_chaser",
    targets: ["LE-002", "LE-042"],
    primarySteward: "knight",
    declaredVowId: "LE-042",
  },
  {
    id: "small_storehouse_vow",
    description: "Keep every resource type at eight or fewer while spending efficiently.",
    profile: "achievement_chaser",
    targets: ["LE-039", "LE-043"],
    primarySteward: "quartermaster",
    declaredVowId: "LE-043",
  },
  {
    id: "spend_everything",
    description: "End nearly empty while maximising converted board value.",
    profile: "guided_ledger",
    targets: ["LE-001", "LE-039"],
    primarySteward: "quartermaster",
  },
  {
    id: "resource_hoard",
    description: "Maximise final Warehouse stock and Quartermaster objective value.",
    profile: "achievement_chaser",
    targets: ["LE-038", "LE-049"],
    primarySteward: "quartermaster",
  },
  {
    id: "resource_crown",
    description: "Dense upgraded Resource lineages and Linked Production.",
    profile: "achievement_chaser",
    targets: ["LE-036", "LE-037", "LE-038"],
    primarySteward: "sentinel",
  },
  {
    id: "workshop_upgrade_engine",
    description: "Stack Crafting discounts, upgrade tempo, and adjacency rewards.",
    profile: "achievement_chaser",
    targets: ["LE-031", "LE-032", "LE-046"],
    primarySteward: "sentinel",
  },
  {
    id: "special_tile_rush",
    description: "Complete Arrivals and convert every unlock into Special Tile score.",
    profile: "achievement_chaser",
    targets: ["LE-019", "LE-022", "LE-023"],
    primarySteward: "quartermaster",
  },
  {
    id: "burden_control",
    description: "Resolve Burdens immediately and suppress Strain exposure.",
    profile: "achievement_chaser",
    targets: ["LE-024", "LE-025", "LE-027"],
    primarySteward: "warden",
  },
  {
    id: "support_fortress",
    description: "Prioritise Supported coverage and zero Overstrain.",
    profile: "guided_ledger",
    targets: ["LE-004", "LE-026", "LE-028"],
    primarySteward: "warden",
  },
  {
    id: "riverbank_sprawl",
    description: "Expand along River/Water with mixed civic categories.",
    profile: "guided_ledger",
    targets: ["LE-016", "LE-017"],
    primarySteward: "vanguard",
  },
  {
    id: "dense_civic_geometry",
    description: "Pursue rings, six-neighbour layouts, variety, and Housing adjacency.",
    profile: "achievement_chaser",
    targets: ["LE-008", "LE-009", "LE-010", "LE-012", "LE-014"],
    primarySteward: "knight",
  },
  {
    id: "no_roads_resource_crown",
    description: "Exploit-test the no-Travel Vow with free Resource infrastructure and Housing conversion.",
    profile: "achievement_chaser",
    targets: ["LE-036", "LE-037", "LE-041"],
    primarySteward: "sentinel",
    declaredVowId: "LE-041",
  },
  {
    id: "no_upgrades_basic_sprawl",
    description: "Exploit-test the no-upgrade Vow with basic Housing, Special Tiles, and repeated basic Production.",
    profile: "achievement_chaser",
    targets: ["LE-002", "LE-019", "LE-042"],
    primarySteward: "knight",
    declaredVowId: "LE-042",
  },
  {
    id: "small_storehouse_microbatch",
    description: "Exploit-test the eight-resource cap through spend-then-produce micro-batches.",
    profile: "guided_ledger",
    targets: ["LE-001", "LE-039", "LE-043"],
    primarySteward: "quartermaster",
    declaredVowId: "LE-043",
  },
];

const playerCounts: PlayerCount[] = [1, 2, 3, 4];
const stewardIds = [
  "vanguard",
  "knight",
  "sentinel",
  "ranger",
  "warden",
  "quartermaster",
];
const unlockTiers = [0, 5, 12, 18, 25, 32];
const resourceTypes: ResourceType[] = [
  "wood",
  "stone",
  "metal",
  "food",
  "herbs",
  "goods",
];

function parseOptions(): AuditOptions {
  const args = process.argv.slice(2);
  const value = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] ?? fallback : fallback;
  };
  return {
    runsPerCell: Number(value("--runs-per-cell", "16")),
    shardIndex: Number(value("--shard-index", "0")),
    shardCount: Number(value("--shard-count", "1")),
    output: value("--output", "outputs/adversarial-audit/shard-0.json"),
    maxCells: Number(value("--max-cells", "8")),
    maxTiles: Number(value("--max-tiles", "8")),
    maxPlacementsPerTile: Number(value("--max-placements-per-tile", "2")),
    armIds: value("--arm-ids", "")
      .split(",")
      .map((armId) => armId.trim())
      .filter(Boolean),
    replayFailuresFrom: value("--replay-failures-from", ""),
  };
}

async function replayFailureSeeds(filePath: string): Promise<Set<string> | null> {
  if (!filePath) return null;
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  const games = Array.isArray(parsed) ? parsed : parsed.games;
  if (!Array.isArray(games)) {
    throw new Error("--replay-failures-from must contain an array or a games array");
  }
  return new Set(
    games.flatMap((game: any) =>
      typeof game?.seed === "string" && Array.isArray(game.errors) && game.errors.length > 0
        ? [game.seed]
        : []
    )
  );
}

function chooseStewards(
  playerCount: PlayerCount,
  primarySteward: string | undefined,
  run: number,
): string[] {
  const rotated = stewardIds.map(
    (_, index) => stewardIds[(index + run) % stewardIds.length],
  );
  const ordered = primarySteward
    ? [primarySteward, ...rotated.filter((id) => id !== primarySteward)]
    : rotated;
  return ordered.slice(0, playerCount);
}

function tileCategory(state: GameState, tileId: string): TileCategory {
  const placed = state.map.placedTiles.find((tile) => tile.tileId === tileId);
  if (placed?.kind === "core") return coreTileById[tileId]?.category ?? "special";
  return specialTileById[tileId]?.category ?? "special";
}

function summarizeState(state: GameState, log: any) {
  const score = calculateFinalScore(state);
  const objectives = evaluateStewardObjectives(state);
  const categoryCounts: Record<string, number> = {};
  const tileCounts: Record<string, number> = {};
  for (const tile of state.map.placedTiles) {
    const category = tileCategory(state, tile.tileId);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    const key = `${tile.tileId}@${tile.side}`;
    tileCounts[key] = (tileCounts[key] ?? 0) + 1;
  }
  const warehouseTotal = resourceTypes.reduce(
    (total, resource) => total + state.warehouse[resource],
    0,
  );
  const totalStrain = state.map.placedTiles.reduce(
    (total, tile) => total + tile.strain,
    0,
  );
  return {
    score,
    scorePerPlayer: score.finalScore / state.playerCount,
    phase: state.phase,
    round: state.round,
    warehouse: { ...state.warehouse },
    warehouseTotal,
    warehousePeak: { ...(state.ledgerRun?.warehousePeakByResource ?? state.warehouse) },
    categoryCounts,
    tileCounts,
    placedTiles: state.map.placedTiles.length,
    upgradedTiles: state.map.placedTiles.filter(
      (tile) => tile.kind === "core" && tile.side === "upgraded",
    ).length,
    specialTiles: state.map.placedTiles.filter((tile) => tile.kind === "special").length,
    supportedTiles: state.map.placedTiles.filter(
      (tile) => tile.support.passive || tile.support.singleUse,
    ).length,
    totalStrain,
    overstrainedTiles: state.map.placedTiles.filter((tile) => tile.strain >= 3).length,
    activeBurdens: state.encounters.activeBurdens.length,
    activeArrivals: state.encounters.activeArrivals.length,
    completedArrivals: state.encounters.completedArrivals.length,
    discardedArrivals: score.failedArrivals,
    objectives: objectives.map((objective) => ({
      stewardId: objective.stewardId,
      met: objective.met,
      current: objective.current,
      target: objective.target,
    })),
    selectedGoldenTileId: state.goldenSetup.selectedTileId,
    selectedGoldenBoonId: state.encounters.selectedGoldenBoonId,
    declaredVowId: state.ledgerRun?.declaredVowId,
    violatedVowReasons: [...(state.ledgerRun?.violatedVowReasons ?? [])],
    actions: { ...(log.actions ?? {}) },
    encounters: {
      cardIdsSeen: [...(log.encounters?.card_ids_seen ?? [])],
      completedArrivalIds: [...(log.encounters?.completed_arrival_ids ?? [])],
      resolvedBurdenIds: [...(log.encounters?.resolved_burden_ids ?? [])],
      usedBoonIds: [...(log.encounters?.used_boon_ids ?? [])],
    },
    engineMetrics: { ...(log.engine_metrics ?? {}) },
    errors: [...(log.simulation_errors ?? [])],
    board: state.map.placedTiles.map((tile) => ({
      instanceId: tile.instanceId,
      tileId: tile.tileId,
      side: tile.side,
      hexIds: [...tile.hexIds],
      strain: tile.strain,
      supported: tile.support.passive || tile.support.singleUse,
      activations: log.actions?.tile_activation_counts_by_instance?.[tile.instanceId] ?? 0,
    })),
  };
}

async function main() {
  const options = parseOptions();
  const replaySeeds = await replayFailureSeeds(options.replayFailuresFrom);
  if (!Number.isInteger(options.runsPerCell) || options.runsPerCell <= 0) {
    throw new Error("--runs-per-cell must be a positive integer");
  }
  if (
    !Number.isInteger(options.shardCount) ||
    options.shardCount <= 0 ||
    !Number.isInteger(options.shardIndex) ||
    options.shardIndex < 0 ||
    options.shardIndex >= options.shardCount
  ) {
    throw new Error("Shard index must be in [0, shard count)");
  }

  const selectedArms = options.armIds.length > 0
    ? strategyArms.filter((arm) => options.armIds.includes(arm.id))
    : strategyArms;
  if (selectedArms.length === 0) {
    throw new Error(`No strategy arms matched --arm-ids ${options.armIds.join(",")}`);
  }
  const plannedGames = replaySeeds?.size ??
    selectedArms.length * playerCounts.length * options.runsPerCell;
  const games: any[] = [];
  let globalIndex = 0;
  const startedAt = Date.now();

  for (const arm of selectedArms) {
    for (const playerCount of playerCounts) {
      for (let run = 0; run < options.runsPerCell; run += 1) {
        const index = globalIndex;
        globalIndex += 1;
        if (index % options.shardCount !== options.shardIndex) continue;

        const unlockCountStart = unlockTiers[
          (run + strategyArms.indexOf(arm) + playerCount) % unlockTiers.length
        ];
        const seed = `adversarial-v1:${arm.id}:${playerCount}p:r${run + 1}:u${unlockCountStart}`;
        if (replaySeeds && !replaySeeds.has(seed)) continue;
        const selectedStewards = chooseStewards(
          playerCount,
          arm.primarySteward,
          run + strategyArms.indexOf(arm),
        );
        const startedGameAt = Date.now();
        try {
          const simulated = simulateCurrentGame({
            playerCount,
            profile: arm.profile,
            seed,
            targets: arm.targets,
            declaredVowId: arm.declaredVowId,
            stewardIds: selectedStewards,
            campaignState: {
              completed_named_entries: [],
              completed_prestige_boxes: [],
              chosen_stewards: [],
              completed_steward_objectives: [],
              attempted_vows: [],
            },
            unlockCountStart,
            returnState: true,
            searchLimits: {
              maxCells: options.maxCells,
              maxTiles: options.maxTiles,
              maxPlacementsPerTile: options.maxPlacementsPerTile,
            },
          }) as { state: GameState; log: any };
          games.push({
            globalIndex: index,
            armId: arm.id,
            playerCount,
            run: run + 1,
            seed,
            profile: arm.profile,
            targets: [...arm.targets],
            stewardIds: selectedStewards,
            unlockCountStart,
            durationMs: Date.now() - startedGameAt,
            ...summarizeState(simulated.state, simulated.log),
          });
        } catch (error) {
          games.push({
            globalIndex: index,
            armId: arm.id,
            playerCount,
            run: run + 1,
            seed,
            profile: arm.profile,
            targets: [...arm.targets],
            stewardIds: selectedStewards,
            unlockCountStart,
            durationMs: Date.now() - startedGameAt,
            errors: [error instanceof Error ? error.stack ?? error.message : String(error)],
          });
        }

        if (games.length % 20 === 0) {
          console.log(
            `Shard ${options.shardIndex + 1}/${options.shardCount}: ${games.length} games complete`,
          );
        }
      }
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    auditVersion: 1,
    plannedGames,
    strategyArms: selectedArms,
    options,
    durationMs: Date.now() - startedAt,
    games,
  };
  if (replaySeeds && games.length !== replaySeeds.size) {
    const replayed = new Set(games.map((game) => game.seed));
    const missing = [...replaySeeds].filter((seed) => !replayed.has(seed));
    throw new Error(`Did not match replay seeds: ${missing.join(", ")}`);
  }
  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, JSON.stringify(result));
  console.log(
    JSON.stringify(
      {
        output: options.output,
        games: games.length,
        errors: games.filter((game) => game.errors?.length).length,
        durationMs: result.durationMs,
      },
      null,
      2,
    ),
  );
}

await main();

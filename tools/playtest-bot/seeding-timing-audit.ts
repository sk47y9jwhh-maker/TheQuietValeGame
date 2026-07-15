import fs from "node:fs/promises";
import path from "node:path";
import { calculateFinalScore } from "../../src/engine/scoring";
import type { GameState, PlayerCount } from "../../src/engine/types";
import { simulateCurrentGame } from "../ledger-pacing/current-prototype-simulation";

const policies = [
  "default",
  "boon_top",
  "burden_top",
  "burden_bottom",
  "arrival_top",
] as const;
const playerCounts: PlayerCount[] = [1, 2, 3, 4];
const stewardIds = [
  "vanguard",
  "knight",
  "sentinel",
  "ranger",
  "warden",
  "quartermaster",
];
const unlockTiers = [0, 18, 32];

function value(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? fallback : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const runs = Number(value(args, "--runs", "12"));
  const shardCount = Number(value(args, "--shard-count", "1"));
  const shardIndex = Number(value(args, "--shard-index", "0"));
  const output = value(
    args,
    "--output",
    `outputs/adversarial-audit/seeding/raw/shard-${shardIndex}.json`,
  );
  const replayFailuresFrom = value(args, "--replay-failures-from", "");
  const replayKeys = replayFailuresFrom
    ? new Set(
        ((JSON.parse(await fs.readFile(replayFailuresFrom, "utf8"))).games ?? [])
          .flatMap((game: any) =>
            Array.isArray(game.errors) && game.errors.length > 0
              ? [`${game.policy}:${game.playerCount}:${game.run}`]
              : []
          )
      )
    : null;
  const games: any[] = [];
  let globalIndex = 0;
  const startedAt = Date.now();

  for (const policy of policies) {
    for (const playerCount of playerCounts) {
      for (let run = 0; run < runs; run += 1) {
        const index = globalIndex;
        globalIndex += 1;
        if (index % shardCount !== shardIndex) continue;
        const replayKey = `${policy}:${playerCount}:${run + 1}`;
        if (replayKeys && !replayKeys.has(replayKey)) continue;
        const seed = `seeding-pair:${playerCount}p:r${run + 1}`;
        const unlockCountStart = unlockTiers[run % unlockTiers.length];
        const selectedStewards = stewardIds
          .map((_, stewardIndex) =>
            stewardIds[(stewardIndex + run) % stewardIds.length],
          )
          .slice(0, playerCount);
        const startedGameAt = Date.now();
        try {
          const simulated = simulateCurrentGame({
            playerCount,
            profile: "guided_ledger",
            seed,
            targets: ["LE-001"],
            stewardIds: selectedStewards,
            unlockCountStart,
            seedingPolicy: policy === "default" ? undefined : policy,
            campaignState: {
              completed_named_entries: [],
              completed_prestige_boxes: [],
              chosen_stewards: [],
              completed_steward_objectives: [],
              attempted_vows: [],
            },
            returnState: true,
            searchLimits: {
              maxCells: 5,
              maxTiles: 6,
              maxPlacementsPerTile: 1,
            },
          }) as { state: GameState; log: any };
          const { state, log } = simulated;
          const score = calculateFinalScore(state);
          games.push({
            globalIndex: index,
            policy,
            playerCount,
            run: run + 1,
            pairedSeed: seed,
            unlockCountStart,
            stewardIds: selectedStewards,
            durationMs: Date.now() - startedGameAt,
            phase: state.phase,
            round: state.round,
            score,
            placedTiles: state.map.placedTiles.length,
            upgradedTiles: state.map.placedTiles.filter(
              (tile) => tile.kind === "core" && tile.side === "upgraded",
            ).length,
            totalStrain: state.map.placedTiles.reduce(
              (total, tile) => total + tile.strain,
              0,
            ),
            overstrainedTiles: state.map.placedTiles.filter(
              (tile) => tile.strain >= 3,
            ).length,
            activeBurdensAtEnd: state.encounters.activeBurdens.length,
            activeArrivalsAtEnd: state.encounters.activeArrivals.length,
            completedArrivals: state.encounters.completedArrivals.length,
            failedArrivals: score.failedArrivals,
            warehouseTotal: Object.values(state.warehouse).reduce(
              (total, amount) => total + amount,
              0,
            ),
            burdenResolutions:
              Number(log.engine_metrics?.burdens_resolved ?? 0),
            unusedActions: Number(log.actions?.unused_actions ?? 0),
            errors: [...(log.simulation_errors ?? [])],
          });
        } catch (error) {
          games.push({
            globalIndex: index,
            policy,
            playerCount,
            run: run + 1,
            pairedSeed: seed,
            unlockCountStart,
            stewardIds: selectedStewards,
            durationMs: Date.now() - startedGameAt,
            errors: [error instanceof Error ? error.stack ?? error.message : String(error)],
          });
        }
      }
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    policies,
    runs,
    plannedGames: replayKeys?.size ?? policies.length * playerCounts.length * runs,
    shardCount,
    shardIndex,
    durationMs: Date.now() - startedAt,
    games,
  };
  if (replayKeys && games.length !== replayKeys.size) {
    const replayed = new Set(
      games.map((game) => `${game.policy}:${game.playerCount}:${game.run}`)
    );
    const missing = [...replayKeys].filter((key) => !replayed.has(key));
    throw new Error(`Did not match replay games: ${missing.join(", ")}`);
  }
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result));
  console.log(JSON.stringify({
    output,
    games: games.length,
    errors: games.filter((game) => game.errors.length > 0).length,
    durationMs: result.durationMs,
  }, null, 2));
}

await main();

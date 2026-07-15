import fs from "node:fs/promises";
import path from "node:path";
import { coreTileById, specialTileById } from "../../src/data/tiles";
import { encounterById } from "../../src/data/encounters";

const scoreThresholds: Record<number, number> = {
  1: 140,
  2: 200,
  3: 320,
  4: 320,
};

const vowScoreThresholds: Record<string, Record<number, number>> = {
  "LE-041": { 1: 80, 2: 120, 3: 170, 4: 190 },
  "LE-042": { 1: 60, 2: 80, 3: 110, 4: 130 },
};

const mean = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const quantile = (values: number[], probability: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower + 1] === undefined
    ? sorted[lower]
    : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
};

function correlation(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const xMean = mean(xs);
  const yMean = mean(ys);
  let numerator = 0;
  let xSquare = 0;
  let ySquare = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index] - xMean;
    const y = ys[index] - yMean;
    numerator += x * y;
    xSquare += x * x;
    ySquare += y * y;
  }
  return xSquare > 0 && ySquare > 0
    ? numerator / Math.sqrt(xSquare * ySquare)
    : 0;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const groupKey = key(row);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  }
  return groups;
}

function spentActions(game: any): number {
  return [
    "place_actions",
    "upgrade_actions",
    "activate_actions",
    "encounter_interact_actions",
  ].reduce((total, key) => total + Number(game.actions?.[key] ?? 0), 0);
}

function producedResources(game: any): number {
  return Object.values(
    game.engineMetrics?.resources_produced_by_resource ?? {},
  ).reduce<number>((total, amount) => total + Number(amount), 0);
}

function maximumTileActivations(game: any): number {
  return Math.max(
    0,
    ...Object.values(
      game.actions?.tile_activation_counts_by_instance ?? {},
    ).map(Number),
  );
}

function maximumWarehouseAmount(game: any): number {
  return Math.max(
    0,
    ...Object.values(game.warehousePeak ?? game.warehouse ?? {}).map(Number),
  );
}

function vowViolation(game: any): boolean | undefined {
  if (game.declaredVowId === "LE-041") {
    return Number(game.categoryCounts?.travel ?? 0) > 0;
  }
  if (game.declaredVowId === "LE-042") return game.upgradedTiles > 0;
  if (game.declaredVowId === "LE-043") {
    return game.warehousePeak ? maximumWarehouseAmount(game) > 8 : undefined;
  }
  return (game.violatedVowReasons ?? []).length > 0;
}

function vowMet(game: any): boolean | undefined {
  const violation = vowViolation(game);
  if (violation === undefined) return undefined;
  if (violation) return false;
  const threshold = vowScoreThresholds[game.declaredVowId]?.[game.playerCount];
  if (game.declaredVowId === "LE-041") {
    return Number(game.categoryCounts?.travel ?? 0) === 0 &&
      game.score.finalScore >= threshold;
  }
  if (game.declaredVowId === "LE-042") {
    return game.upgradedTiles === 0 && game.score.finalScore >= threshold;
  }
  if (game.declaredVowId === "LE-043") {
    return maximumWarehouseAmount(game) <= 8;
  }
  return false;
}

function summarize(games: any[]) {
  const scores = games.map((game) => game.score.finalScore as number);
  const ratios = games.map(
    (game) => game.score.finalScore / scoreThresholds[game.playerCount],
  );
  return {
    games: games.length,
    meanScore: round(mean(scores), 1),
    medianScore: round(quantile(scores, 0.5), 1),
    p10Score: round(quantile(scores, 0.1), 1),
    p90Score: round(quantile(scores, 0.9), 1),
    p95Score: round(quantile(scores, 0.95), 1),
    minScore: Math.min(...scores),
    maxScore: Math.max(...scores),
    meanThresholdRatio: round(mean(ratios), 3),
    thresholdHitRate: round(
      mean(
        games.map((game) =>
          Number(game.score.finalScore >= scoreThresholds[game.playerCount]),
        ),
      ),
      3,
    ),
    meanPopulation: round(mean(games.map((game) => game.score.population)), 1),
    meanRenown: round(
      mean(games.map((game) => game.score.finalScore - game.score.population)),
      1,
    ),
    meanObjectiveRenown: round(
      mean(games.map((game) => game.score.stewardObjectiveRenown)),
      1,
    ),
    meanGoldenRenown: round(mean(games.map((game) => game.score.goldenRenown)), 1),
    meanPenalty: round(
      mean(
        games.map(
          (game) =>
            game.score.burdenPenalty +
            game.score.failedArrivalPenalty +
            (game.score.unfulfilledPromisePenalty ?? 0) +
            game.score.strainPenalty,
        ),
      ),
      1,
    ),
    meanWarehouse: round(mean(games.map((game) => game.warehouseTotal)), 1),
    meanPlacedTiles: round(mean(games.map((game) => game.placedTiles)), 1),
    meanCompletedArrivals: round(
      mean(games.map((game) => game.completedArrivals)),
      2,
    ),
    meanActiveArrivalsAtEnd: round(
      mean(
        games.map(
          (game) =>
            game.activeArrivals ??
            Math.max(
              0,
              Number(game.engineMetrics?.arrivals_abandoned ?? 0) -
                game.discardedArrivals,
            ),
        ),
      ),
      2,
    ),
    meanUnfulfilledPromises: round(
      mean(
        games.map(
          (game) =>
            game.score.unfulfilledPromises ?? game.activeArrivals ?? 0,
        ),
      ),
      2,
    ),
    meanUnfulfilledPromisePenalty: round(
      mean(
        games.map(
          (game) => game.score.unfulfilledPromisePenalty ?? 0,
        ),
      ),
      1,
    ),
    meanSpentActions: round(mean(games.map(spentActions)), 1),
    meanActivateActions: round(
      mean(games.map((game) => Number(game.actions?.activate_actions ?? 0))),
      1,
    ),
    meanActivationShare: round(
      mean(
        games.map((game) =>
          spentActions(game) > 0
            ? Number(game.actions?.activate_actions ?? 0) / spentActions(game)
            : 0,
        ),
      ),
      3,
    ),
    meanMaxSingleTileActivations: round(
      mean(games.map(maximumTileActivations)),
      1,
    ),
    meanResourcesProduced: round(mean(games.map(producedResources)), 1),
    meanUnusedActions: round(
      mean(games.map((game) => game.actions?.unused_actions ?? 0)),
      1,
    ),
  };
}

function tileName(id: string): string {
  const [tileId, side] = id.split("@");
  const core = coreTileById[tileId];
  if (core) return side === "upgraded" ? core.upgraded.name : core.basic.name;
  return specialTileById[tileId]?.name ?? tileId;
}

async function jsonFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) return jsonFiles(full);
      return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
    }),
  );
  return nested.flat();
}

function residualize(games: any[]): void {
  const strata = groupBy(
    games,
    (game) => `${game.armId}:${game.playerCount}:${game.unlockCountStart}`,
  );
  for (const rows of strata.values()) {
    const scoreMean = mean(rows.map((game) => game.score.finalScore));
    for (const game of rows) game.scoreResidual = game.score.finalScore - scoreMean;
  }
}

function tileAssociations(games: any[]) {
  const tileIds = new Set(
    games.flatMap((game) => Object.keys(game.tileCounts ?? {})),
  );
  return [...tileIds]
    .map((id) => {
      const present = games.filter((game) => (game.tileCounts[id] ?? 0) > 0);
      const absent = games.filter((game) => (game.tileCounts[id] ?? 0) === 0);
      const counts = games.map((game) => game.tileCounts[id] ?? 0);
      const residuals = games.map((game) => game.scoreResidual ?? 0);
      return {
        id,
        name: tileName(id),
        present: present.length,
        occurrences: counts.reduce((total, count) => total + count, 0),
        meanCountWhenPresent: round(mean(present.map((game) => game.tileCounts[id])), 2),
        residualLift: round(
          mean(present.map((game) => game.scoreResidual ?? 0)) -
            mean(absent.map((game) => game.scoreResidual ?? 0)),
          2,
        ),
        countCorrelation: round(correlation(counts, residuals), 3),
        meanRawScoreWhenPresent: round(
          mean(present.map((game) => game.score.finalScore)),
          1,
        ),
      };
    })
    .filter((row) => row.present >= 30 && games.length - row.present >= 30)
    .sort((a, b) => b.residualLift - a.residualLift);
}

function metricAssociations(games: any[]) {
  const metrics: Record<string, (game: any) => number> = {
    placedTiles: (game) => game.placedTiles,
    upgradedTiles: (game) => game.upgradedTiles,
    specialTiles: (game) => game.specialTiles,
    supportedTiles: (game) => game.supportedTiles,
    totalStrain: (game) => game.totalStrain,
    activeBurdens: (game) => game.activeBurdens,
    completedArrivals: (game) => game.completedArrivals,
    activeArrivalsAtEnd: (game) =>
      game.activeArrivals ??
      Math.max(
        0,
        Number(game.engineMetrics?.arrivals_abandoned ?? 0) - game.discardedArrivals,
      ),
    warehouseTotal: (game) => game.warehouseTotal,
    placeActions: (game) => Number(game.actions?.place_actions ?? 0),
    upgradeActions: (game) => Number(game.actions?.upgrade_actions ?? 0),
    activateActions: (game) => Number(game.actions?.activate_actions ?? 0),
    encounterActions: (game) =>
      Number(game.actions?.encounter_interact_actions ?? 0),
    freePlacements: (game) =>
      Number(game.actions?.free_place_effects_used ?? 0),
    unusedActions: (game) => Number(game.actions?.unused_actions ?? 0),
    printedPopulation: (game) => game.score.printedPopulation,
    passivePopulation: (game) => game.score.passivePopulation,
    printedRenown: (game) => game.score.printedRenown,
    passiveRenown: (game) => game.score.passiveRenown,
    objectiveRenown: (game) => game.score.stewardObjectiveRenown,
    goldenRenown: (game) => game.score.goldenRenown,
    resourcesProduced: producedResources,
    activationShare: (game) =>
      spentActions(game) > 0
        ? Number(game.actions?.activate_actions ?? 0) / spentActions(game)
        : 0,
    maxSingleTileActivations: maximumTileActivations,
    supportPreventions: (game) =>
      Number(game.engineMetrics?.strain_prevented_by_support ?? 0),
    burdenResolutions: (game) =>
      Number(game.engineMetrics?.burdens_resolved ?? 0),
  };
  const residuals = games.map((game) => game.scoreResidual ?? 0);
  return Object.entries(metrics)
    .map(([metric, getter]) => ({
      metric,
      correlation: round(
        correlation(
          games.map(getter),
          residuals,
        ),
        3,
      ),
      mean: round(mean(games.map(getter)), 2),
    }))
    .sort((a, b) => b.correlation - a.correlation);
}

function componentAssociations(
  games: any[],
  kind: "completedArrivalIds" | "resolvedBurdenIds" | "usedBoonIds",
) {
  const ids = new Set(
    games.flatMap((game) => game.encounters?.[kind] ?? []),
  );
  return [...ids]
    .map((id) => {
      const present = games.filter((game) =>
        (game.encounters?.[kind] ?? []).includes(id),
      );
      const absent = games.filter(
        (game) => !(game.encounters?.[kind] ?? []).includes(id),
      );
      return {
        id,
        name: encounterById[id]?.name ?? id,
        present: present.length,
        residualLift: round(
          mean(present.map((game) => game.scoreResidual ?? 0)) -
            mean(absent.map((game) => game.scoreResidual ?? 0)),
          2,
        ),
      };
    })
    .filter((row) => row.present >= 20 && games.length - row.present >= 20)
    .sort((a, b) => b.residualLift - a.residualLift);
}

async function main() {
  const [inputDir, outputBase = path.join(inputDir ?? ".", "analysis")] =
    process.argv.slice(2).filter((argument) => argument !== "--");
  if (!inputDir) {
    throw new Error(
      "Usage: vite-node analyse-adversarial-audit.ts <shard-directory> [output-base]",
    );
  }

  const sourceFiles = (await jsonFiles(inputDir)).filter((file) =>
    path.basename(file).startsWith("shard-"),
  );
  const shards = await Promise.all(
    sourceFiles.map(async (file) => JSON.parse(await fs.readFile(file, "utf8"))),
  );
  const allGames = shards.flatMap((shard) => shard.games ?? []);
  const validGames = allGames.filter(
    (game) => game.score && game.phase === "gameEnd" && game.errors?.length === 0,
  );
  const erroredGames = allGames.filter((game) => !validGames.includes(game));
  residualize(validGames);

  const byPlayerCount = Object.fromEntries(
    [1, 2, 3, 4].map((playerCount) => [
      playerCount,
      summarize(validGames.filter((game) => game.playerCount === playerCount)),
    ]),
  );
  const armIds = [...new Set(validGames.map((game) => game.armId as string))];
  const byArm = Object.fromEntries(
    armIds.map((armId) => {
      const games = validGames.filter((game) => game.armId === armId);
      return [
        armId,
        {
          ...summarize(games),
          byPlayerCount: Object.fromEntries(
            [1, 2, 3, 4].map((playerCount) => [
              playerCount,
              summarize(games.filter((game) => game.playerCount === playerCount)),
            ]),
          ),
        },
      ];
    }),
  );
  const byUnlockTier = Object.fromEntries(
    [...new Set(validGames.map((game) => game.unlockCountStart))]
      .sort((a, b) => a - b)
      .map((unlock) => [
        unlock,
        summarize(validGames.filter((game) => game.unlockCountStart === unlock)),
      ]),
  );
  const goldenIds = [
    ...new Set(
      validGames.flatMap((game) => [
        game.selectedGoldenTileId,
        game.selectedGoldenBoonId,
      ]).filter(Boolean),
    ),
  ];
  const goldenContent = goldenIds
    .map((id) => {
      const present = validGames.filter(
        (game) =>
          game.selectedGoldenTileId === id || game.selectedGoldenBoonId === id,
      );
      const absent = validGames.filter(
        (game) =>
          game.selectedGoldenTileId !== id && game.selectedGoldenBoonId !== id,
      );
      return {
        id,
        residualLift: round(
          mean(present.map((game) => game.scoreResidual ?? 0)) -
            mean(absent.map((game) => game.scoreResidual ?? 0)),
          2,
        ),
        ...summarize(present),
      };
    })
    .sort((a, b) => b.meanThresholdRatio - a.meanThresholdRatio);

  const stewardObjectives = [
    ...new Set(
      validGames.flatMap((game) =>
        game.objectives.map((objective: any) => objective.stewardId),
      ),
    ),
  ].map((stewardId) => {
    const rows = validGames.flatMap((game) =>
      game.objectives
        .filter((objective: any) => objective.stewardId === stewardId)
        .map((objective: any) => ({ game, objective })),
    );
    return {
      stewardId,
      appearances: rows.length,
      metRate: round(mean(rows.map((row) => Number(row.objective.met))), 3),
      meanGameThresholdRatio: round(
        mean(
          rows.map(
            (row) =>
              row.game.score.finalScore / scoreThresholds[row.game.playerCount],
          ),
        ),
        3,
      ),
    };
  }).sort((a, b) => b.metRate - a.metRate);

  const vowArms = validGames
    .filter((game) => game.declaredVowId)
    .reduce((groups: Record<string, any[]>, game) => {
      groups[game.armId] = [...(groups[game.armId] ?? []), game];
      return groups;
    }, {});
  const vows = Object.entries(vowArms).map(([armId, games]) => {
    const vowStats = (rows: any[]) => ({
      games: rows.length,
      trackedGames: rows.filter((game) => vowViolation(game) !== undefined).length,
      violations: rows.filter((game) => vowViolation(game) === true).length,
      violationRate: rows.some((game) => vowViolation(game) !== undefined)
        ? round(
            mean(
              rows
                .map(vowViolation)
                .filter((value): value is boolean => value !== undefined)
                .map(Number),
            ),
            3,
          )
        : null,
      successes: rows.filter((game) => vowMet(game) === true).length,
      successRate: rows.some((game) => vowMet(game) !== undefined)
        ? round(
            mean(
              rows
                .map(vowMet)
                .filter((value): value is boolean => value !== undefined)
                .map(Number),
            ),
            3,
          )
        : null,
      maxWarehouseAmount: Math.max(0, ...rows.map(maximumWarehouseAmount)),
    });
    return {
      armId,
      vowId: games[0]?.declaredVowId,
      ...summarize(games),
      ...vowStats(games),
      byPlayerCount: Object.fromEntries(
        [1, 2, 3, 4].map((playerCount) => {
          const rows = games.filter((game) => game.playerCount === playerCount);
          return [playerCount, { ...summarize(rows), ...vowStats(rows) }];
        }),
      ),
    };
  });

  const topGamesByPlayerCount = Object.fromEntries(
    [1, 2, 3, 4].map((playerCount) => [
      playerCount,
      validGames
        .filter((game) => game.playerCount === playerCount)
        .sort((a, b) => b.score.finalScore - a.score.finalScore)
        .slice(0, 10)
        .map((game) => ({
          globalIndex: game.globalIndex,
          seed: game.seed,
          armId: game.armId,
          score: game.score.finalScore,
          population: game.score.population,
          renown: game.score.finalScore - game.score.population,
          thresholdRatio: round(
            game.score.finalScore / scoreThresholds[playerCount],
            3,
          ),
          unlockCountStart: game.unlockCountStart,
          stewardIds: game.stewardIds,
          placedTiles: game.placedTiles,
          upgradedTiles: game.upgradedTiles,
          specialTiles: game.specialTiles,
          totalStrain: game.totalStrain,
          activeBurdens: game.activeBurdens,
          warehouseTotal: game.warehouseTotal,
          scoreBreakdown: game.score,
          actions: game.actions,
          engineMetrics: game.engineMetrics,
          tileCounts: game.tileCounts,
        })),
    ]),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    sourceFiles: sourceFiles.length,
    totalGames: allGames.length,
    validGames: validGames.length,
    erroredGames: erroredGames.length,
    uniqueSeeds: new Set(allGames.map((game) => game.seed)).size,
    searchOptions: shards[0]?.options,
    scoreThresholds,
    overall: summarize(validGames),
    byPlayerCount,
    byArm,
    byUnlockTier,
    goldenContent,
    stewardObjectives,
    vows,
    metricAssociations: metricAssociations(validGames),
    tileAssociations: tileAssociations(validGames),
    completedArrivalAssociations: componentAssociations(
      validGames,
      "completedArrivalIds",
    ),
    resolvedBurdenAssociations: componentAssociations(
      validGames,
      "resolvedBurdenIds",
    ),
    usedBoonAssociations: componentAssociations(validGames, "usedBoonIds"),
    topGamesByPlayerCount,
    errors: erroredGames.map((game) => ({
      globalIndex: game.globalIndex,
      seed: game.seed,
      armId: game.armId,
      playerCount: game.playerCount,
      errors: game.errors,
    })),
  };

  const armLeaderboard = Object.entries(byArm)
    .map(([armId, summary]: [string, any]) => ({ armId, ...summary }))
    .sort((a, b) => b.meanThresholdRatio - a.meanThresholdRatio);
  const md: string[] = [
    "# Adversarial playtest sweep: statistical summary",
    "",
    `Analysed ${validGames.length} valid full-engine games from ${sourceFiles.length} shards; ${erroredGames.length} errored or incomplete games are excluded. Strategy comparisons use score divided by the current LE-001 threshold for that player count. Tile/component lifts are within strategy × player-count × Golden-tier residual associations, not causal effects.`,
    "",
    "## Player-count scaling",
    "",
    "| Players | Games | Mean | Median | P90 | Max | Threshold hit | Mean penalty | Unused actions |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(byPlayerCount).map(([playerCount, value]: [string, any]) =>
      `| ${playerCount} | ${value.games} | ${value.meanScore} | ${value.medianScore} | ${value.p90Score} | ${value.maxScore} | ${round(value.thresholdHitRate * 100, 1)}% | ${value.meanPenalty} | ${value.meanUnusedActions} |`,
    ),
    "",
    "## Strategy leaderboard",
    "",
    "| Strategy | Games | Mean threshold ratio | Mean score | P90 | Max | Hit rate |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...armLeaderboard.map(
      (row) =>
        `| ${row.armId} | ${row.games} | ${round(row.meanThresholdRatio * 100, 1)}% | ${row.meanScore} | ${row.p90Score} | ${row.maxScore} | ${round(row.thresholdHitRate * 100, 1)}% |`,
    ),
    "",
    "## Strongest within-cell score associations",
    "",
    "| Metric | Correlation | Mean |",
    "|---|---:|---:|",
    ...report.metricAssociations.slice(0, 12).map(
      (row) => `| ${row.metric} | ${row.correlation} | ${row.mean} |`,
    ),
    "",
    "## Strongest tile-side associations",
    "",
    "| Tile side | Games present | Occurrences | Residual lift | Count correlation |",
    "|---|---:|---:|---:|---:|",
    ...report.tileAssociations.slice(0, 15).map(
      (row) =>
        `| ${row.name} (${row.id.split("@")[1]}) | ${row.present} | ${row.occurrences} | ${row.residualLift} | ${row.countCorrelation} |`,
    ),
    "",
    "## Lowest tile-side associations",
    "",
    "| Tile side | Games present | Occurrences | Residual lift | Count correlation |",
    "|---|---:|---:|---:|---:|",
    ...report.tileAssociations
      .slice(-15)
      .reverse()
      .map(
        (row) =>
          `| ${row.name} (${row.id.split("@")[1]}) | ${row.present} | ${row.occurrences} | ${row.residualLift} | ${row.countCorrelation} |`,
      ),
    "",
    "## Steward objective hit rates",
    "",
    "| Steward | Appearances | Objective hit | Mean game threshold ratio |",
    "|---|---:|---:|---:|",
    ...stewardObjectives.map(
      (row) =>
        `| ${row.stewardId} | ${row.appearances} | ${round(row.metRate * 100, 1)}% | ${round(row.meanGameThresholdRatio * 100, 1)}% |`,
    ),
    "",
    "## Declared Vow results",
    "",
    "| Strategy | Vow | Games | Rules violation | Vow success | Max score |",
    "|---|---|---:|---:|---:|---:|",
    ...vows.map(
      (row) =>
        `| ${row.armId} | ${row.vowId} | ${row.games} | ${row.violationRate === null ? "n/a" : `${round(row.violationRate * 100, 1)}%`} | ${row.successRate === null ? "n/a" : `${round(row.successRate * 100, 1)}%`} | ${row.maxScore} |`,
    ),
    "",
    "## Highest games",
    "",
    ...[1, 2, 3, 4].flatMap((playerCount) => [
      `### ${playerCount} player`,
      "",
      "| Score | Strategy | Golden tier | Tiles | Upgrades | Specials | Strain | Burdens |",
      "|---:|---|---:|---:|---:|---:|---:|---:|",
      ...topGamesByPlayerCount[playerCount].slice(0, 5).map(
        (game: any) =>
          `| ${game.score} | ${game.armId} | ${game.unlockCountStart} | ${game.placedTiles} | ${game.upgradedTiles} | ${game.specialTiles} | ${game.totalStrain} | ${game.activeBurdens} |`,
      ),
      "",
    ]),
  ];

  await fs.mkdir(path.dirname(outputBase), { recursive: true });
  await fs.writeFile(`${outputBase}.json`, JSON.stringify(report, null, 2));
  await fs.writeFile(`${outputBase}.md`, md.join("\n"));
  await fs.writeFile(
    path.join(path.dirname(outputBase), "combined.json"),
    JSON.stringify({ games: allGames }),
  );
  console.log(
    JSON.stringify(
      {
        totalGames: allGames.length,
        validGames: validGames.length,
        erroredGames: erroredGames.length,
        outputs: [`${outputBase}.json`, `${outputBase}.md`],
      },
      null,
      2,
    ),
  );
}

await main();

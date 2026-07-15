import fs from "node:fs/promises";
import path from "node:path";

const mean = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
const rounded = (value: number, digits = 2) => Number(value.toFixed(digits));
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

const sampleStandardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      (values.length - 1),
  );
};

const totalPenalty = (game: any) =>
  game.score.burdenPenalty +
  game.score.failedArrivalPenalty +
  game.score.strainPenalty;

function summarize(games: any[]) {
  const scores = games.map((game) => game.score.finalScore as number);
  return {
    games: games.length,
    meanScore: rounded(mean(scores), 1),
    medianScore: rounded(quantile(scores, 0.5), 1),
    p10Score: rounded(quantile(scores, 0.1), 1),
    p90Score: rounded(quantile(scores, 0.9), 1),
    minScore: scores.length ? Math.min(...scores) : 0,
    maxScore: scores.length ? Math.max(...scores) : 0,
    meanPenalty: rounded(mean(games.map(totalPenalty)), 1),
    meanStrain: rounded(mean(games.map((game) => game.totalStrain)), 2),
    meanActiveBurdens: rounded(
      mean(games.map((game) => game.activeBurdensAtEnd)),
      2,
    ),
    meanBurdenResolutions: rounded(
      mean(games.map((game) => game.burdenResolutions)),
      2,
    ),
    meanCompletedArrivals: rounded(
      mean(games.map((game) => game.completedArrivals)),
      2,
    ),
    meanActiveArrivals: rounded(
      mean(games.map((game) => game.activeArrivalsAtEnd)),
      2,
    ),
    meanUnusedActions: rounded(
      mean(games.map((game) => game.unusedActions)),
      1,
    ),
  };
}

function pairedComparison(games: any[], baseline: string, challenger: string) {
  const baselineGames = new Map(
    games
      .filter((game) => game.policy === baseline)
      .map((game) => [`${game.playerCount}:${game.run}`, game]),
  );
  const pairs = games
    .filter((game) => game.policy === challenger)
    .flatMap((game) => {
      const control = baselineGames.get(`${game.playerCount}:${game.run}`);
      return control ? [{ control, game }] : [];
    });
  const scoreDeltas = pairs.map(
    ({ control, game }) => game.score.finalScore - control.score.finalScore,
  );
  const meanDelta = mean(scoreDeltas);
  const confidenceHalfWidth = scoreDeltas.length > 1
    ? 1.96 * sampleStandardDeviation(scoreDeltas) / Math.sqrt(scoreDeltas.length)
    : 0;
  return {
    baseline,
    challenger,
    pairs: pairs.length,
    meanScoreDelta: rounded(meanDelta, 1),
    scoreDelta95Ci: [
      rounded(meanDelta - confidenceHalfWidth, 1),
      rounded(meanDelta + confidenceHalfWidth, 1),
    ],
    medianScoreDelta: rounded(quantile(scoreDeltas, 0.5), 1),
    p10ScoreDelta: rounded(quantile(scoreDeltas, 0.1), 1),
    p90ScoreDelta: rounded(quantile(scoreDeltas, 0.9), 1),
    winRate: rounded(mean(scoreDeltas.map((delta) => Number(delta > 0))), 3),
    tieRate: rounded(mean(scoreDeltas.map((delta) => Number(delta === 0))), 3),
    meanPenaltyDelta: rounded(
      mean(pairs.map(({ control, game }) => totalPenalty(game) - totalPenalty(control))),
      1,
    ),
    meanStrainDelta: rounded(
      mean(pairs.map(({ control, game }) => game.totalStrain - control.totalStrain)),
      2,
    ),
    meanActiveBurdenDelta: rounded(
      mean(
        pairs.map(
          ({ control, game }) =>
            game.activeBurdensAtEnd - control.activeBurdensAtEnd,
        ),
      ),
      2,
    ),
    byPlayerCount: Object.fromEntries(
      [1, 2, 3, 4].map((playerCount) => {
        const playerPairs = pairs.filter(
          ({ game }) => game.playerCount === playerCount,
        );
        const deltas = playerPairs.map(
          ({ control, game }) => game.score.finalScore - control.score.finalScore,
        );
        return [
          playerCount,
          {
            pairs: playerPairs.length,
            meanScoreDelta: rounded(mean(deltas), 1),
            winRate: rounded(mean(deltas.map((delta) => Number(delta > 0))), 3),
          },
        ];
      }),
    ),
  };
}

async function main() {
  const [inputDir, outputBase = "outputs/adversarial-audit/seeding/analysis"] =
    process.argv.slice(2).filter((argument) => argument !== "--");
  if (!inputDir) {
    throw new Error(
      "Usage: vite-node analyse-seeding-timing.ts <shard-directory> [output-base]",
    );
  }
  const files = (await fs.readdir(inputDir))
    .filter((file) => file.startsWith("shard-") && file.endsWith(".json"))
    .map((file) => path.join(inputDir, file));
  const shards = await Promise.all(
    files.map(async (file) => JSON.parse(await fs.readFile(file, "utf8"))),
  );
  const allGames = shards.flatMap((shard) => shard.games ?? []);
  const validGames = allGames.filter(
    (game) => game.phase === "gameEnd" && game.score && game.errors.length === 0,
  );
  const policies = [...new Set(validGames.map((game) => game.policy as string))];
  const byPolicy = Object.fromEntries(
    policies.map((policy) => [
      policy,
      summarize(validGames.filter((game) => game.policy === policy)),
    ]),
  );
  const byPlayerCount = Object.fromEntries(
    [1, 2, 3, 4].map((playerCount) => [
      playerCount,
      Object.fromEntries(
        policies.map((policy) => [
          policy,
          summarize(
            validGames.filter(
              (game) =>
                game.playerCount === playerCount && game.policy === policy,
            ),
          ),
        ]),
      ),
    ]),
  );
  const pairedVsDefault = policies
    .filter((policy) => policy !== "default")
    .map((policy) => pairedComparison(validGames, "default", policy));
  const burdenTopVsBottom = pairedComparison(
    validGames,
    "burden_bottom",
    "burden_top",
  );
  const report = {
    generatedAt: new Date().toISOString(),
    totalGames: allGames.length,
    validGames: validGames.length,
    erroredGames: allGames.length - validGames.length,
    policies,
    byPolicy,
    byPlayerCount,
    pairedVsDefault,
    burdenTopVsBottom,
    errors: allGames
      .filter((game) => game.errors.length > 0)
      .map((game) => ({
        policy: game.policy,
        playerCount: game.playerCount,
        run: game.run,
        errors: game.errors,
      })),
  };

  const markdown = [
    "# Paired seeding-timing experiment",
    "",
    `Analysed ${validGames.length}/${allGames.length} completed full-engine games. Every policy uses the same player-count/run seed, Golden tier, and Steward lineup as its paired controls.`,
    "",
    "## Policy summaries",
    "",
    "| Policy | Games | Mean score | P10 | P90 | Penalty | Strain | Active Burdens | Burden resolutions |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...policies.map((policy) => {
      const value = byPolicy[policy];
      return `| ${policy} | ${value.games} | ${value.meanScore} | ${value.p10Score} | ${value.p90Score} | ${value.meanPenalty} | ${value.meanStrain} | ${value.meanActiveBurdens} | ${value.meanBurdenResolutions} |`;
    }),
    "",
    "## Paired differences from default",
    "",
    "| Policy | Pairs | Mean score delta | Median | Win rate | Penalty delta | Strain delta | Active Burden delta |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...pairedVsDefault.map(
      (row) =>
        `| ${row.challenger} | ${row.pairs} | ${row.meanScoreDelta} | ${row.medianScoreDelta} | ${rounded(row.winRate * 100, 1)}% | ${row.meanPenaltyDelta} | ${row.meanStrainDelta} | ${row.meanActiveBurdenDelta} |`,
    ),
    "",
    `Burden-top versus Burden-bottom: ${burdenTopVsBottom.meanScoreDelta} mean score (${burdenTopVsBottom.pairs} pairs; approximate 95% CI ${burdenTopVsBottom.scoreDelta95Ci[0]} to ${burdenTopVsBottom.scoreDelta95Ci[1]}), ${rounded(burdenTopVsBottom.winRate * 100, 1)}% win rate for Burden-top.`,
  ];

  await fs.mkdir(path.dirname(outputBase), { recursive: true });
  await fs.writeFile(`${outputBase}.json`, JSON.stringify(report, null, 2));
  await fs.writeFile(`${outputBase}.md`, markdown.join("\n"));
  console.log(JSON.stringify({
    totalGames: allGames.length,
    validGames: validGames.length,
    erroredGames: allGames.length - validGames.length,
    outputs: [`${outputBase}.json`, `${outputBase}.md`],
  }, null, 2));
}

await main();

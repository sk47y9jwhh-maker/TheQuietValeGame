import fs from "node:fs/promises";
import path from "node:path";
import { encounterById } from "../../src/data/encounters";
import { coreTileById, specialTileById } from "../../src/data/tiles";
import type { BotGameResult, PlaytestCampaignResult } from "./bot";

type Metric = "score" | "population" | "renown";
type ComponentKind = "tile" | "upgradedTile" | "activatedTile" | "encounter" | "completedArrival" | "resolvedBurden" | "activeBurden" | "usedBoon";

const metrics: Metric[] = ["score", "population", "renown"];
const thresholds: Record<Metric, Record<number, number>> = {
  score: { 1: 80, 2: 115, 3: 155, 4: 240 },
  population: { 1: 75, 2: 105, 3: 130, 4: 175 },
  renown: { 1: 25, 2: 40, 3: 60, 4: 90 },
};

interface AnalysisGame extends BotGameResult {
  ratios: Record<Metric, number>;
  success: Record<Metric, boolean>;
}

interface Association {
  id: string;
  name: string;
  kind: ComponentKind;
  present: number;
  absent: number;
  meanRatioPresent: number;
  meanRatioAbsent: number;
  rawRatioDelta: number;
  matchedRatioDelta: number | null;
  successRatePresent: number;
  successRateAbsent: number;
  successRateLift: number;
}

interface MarginalTileContribution {
  id: string;
  tileId: string;
  name: string;
  side: string;
  occurrences: number;
  games: number;
  meanContribution: number;
  positiveRate: number;
  zeroRate: number;
  negativeRate: number;
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

function componentName(kind: ComponentKind, id: string): string {
  if (["tile", "upgradedTile", "activatedTile"].includes(kind)) {
    const tile = coreTileById[id];
    if (tile) return kind === "upgradedTile" ? tile.upgraded.name : tile.basic.name;
    return specialTileById[id]?.name ?? id;
  }
  return encounterById[id]?.name ?? id;
}

function componentIds(game: AnalysisGame, kind: ComponentKind): Set<string> {
  if (kind === "tile") return new Set(game.boardTiles.map((tile) => tile.tileId));
  if (kind === "upgradedTile") return new Set(game.boardTiles.filter((tile) => tile.side === "upgraded").map((tile) => tile.tileId));
  if (kind === "activatedTile") return new Set(game.boardTiles.filter((tile) => tile.activated > 0).map((tile) => tile.tileId));
  if (kind === "encounter") return new Set(game.encounterCardIdsSeen);
  if (kind === "completedArrival") return new Set(game.completedArrivalIds);
  if (kind === "activeBurden") return new Set(game.activeBurdenIds);
  if (kind === "usedBoon") return new Set(game.usedBoonIds);
  return new Set(game.resolvedBurdenIds);
}

function marginalTileContributions(games: AnalysisGame[], metric: Metric): MarginalTileContribution[] {
  const contributionKey = `${metric}Contribution` as "scoreContribution" | "populationContribution" | "renownContribution";
  const groups = new Map<string, Array<{ gameKey: string; value: number }>>();
  for (const game of games) {
    for (const tile of game.boardTiles) {
      const key = `${tile.tileId}@${tile.side}`;
      groups.set(key, [...(groups.get(key) ?? []), { gameKey: game.seed, value: tile[contributionKey] }]);
    }
  }
  return [...groups.entries()].map(([id, rows]) => {
    const [tileId, side] = id.split("@");
    const tile = coreTileById[tileId];
    const name = tile
      ? side === "upgraded" ? tile.upgraded.name : tile.basic.name
      : specialTileById[tileId]?.name ?? tileId;
    return {
      id,
      tileId,
      name,
      side,
      occurrences: rows.length,
      games: new Set(rows.map((row) => row.gameKey)).size,
      meanContribution: round(mean(rows.map((row) => row.value)), 2),
      positiveRate: round(mean(rows.map((row) => Number(row.value > 0)))),
      zeroRate: round(mean(rows.map((row) => Number(row.value === 0)))),
      negativeRate: round(mean(rows.map((row) => Number(row.value < 0)))),
    };
  }).filter((row) => row.occurrences >= 8).sort((a, b) => b.meanContribution - a.meanContribution);
}

function matchedDelta(games: AnalysisGame[], kind: ComponentKind, id: string, metric: Metric): number | null {
  const strata = new Map<string, AnalysisGame[]>();
  for (const game of games) {
    const key = `${game.playerCount}p:g${game.game}`;
    strata.set(key, [...(strata.get(key) ?? []), game]);
  }
  let weightedTotal = 0;
  let totalWeight = 0;
  for (const stratum of strata.values()) {
    const present = stratum.filter((game) => componentIds(game, kind).has(id));
    const absent = stratum.filter((game) => !componentIds(game, kind).has(id));
    if (!present.length || !absent.length) continue;
    const weight = Math.min(present.length, absent.length);
    weightedTotal += (mean(present.map((game) => game.ratios[metric])) - mean(absent.map((game) => game.ratios[metric]))) * weight;
    totalWeight += weight;
  }
  return totalWeight ? weightedTotal / totalWeight : null;
}

function associations(games: AnalysisGame[], kind: ComponentKind, metric: Metric, minimum = 8): Association[] {
  const ids = new Set(games.flatMap((game) => [...componentIds(game, kind)]));
  return [...ids].flatMap((id): Association[] => {
    const present = games.filter((game) => componentIds(game, kind).has(id));
    const absent = games.filter((game) => !componentIds(game, kind).has(id));
    if (present.length < minimum || absent.length < minimum) return [];
    const meanPresent = mean(present.map((game) => game.ratios[metric]));
    const meanAbsent = mean(absent.map((game) => game.ratios[metric]));
    const successPresent = mean(present.map((game) => Number(game.success[metric])));
    const successAbsent = mean(absent.map((game) => Number(game.success[metric])));
    const matched = matchedDelta(games, kind, id, metric);
    return [{
      id,
      name: componentName(kind, id),
      kind,
      present: present.length,
      absent: absent.length,
      meanRatioPresent: round(meanPresent),
      meanRatioAbsent: round(meanAbsent),
      rawRatioDelta: round(meanPresent - meanAbsent),
      matchedRatioDelta: matched === null ? null : round(matched),
      successRatePresent: round(successPresent),
      successRateAbsent: round(successAbsent),
      successRateLift: round(successPresent - successAbsent),
    }];
  }).sort((a, b) => (b.matchedRatioDelta ?? b.rawRatioDelta) - (a.matchedRatioDelta ?? a.rawRatioDelta));
}

async function jsonFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return jsonFiles(full);
    return entry.isFile() && entry.name.endsWith(".json") ? [full] : [];
  }));
  return nested.flat();
}

function table(rows: Association[], metric: Metric, limit: number, strongest: boolean): string {
  const selected = strongest ? rows.slice(0, limit) : rows.slice(-limit).reverse();
  if (!selected.length) return "No components met the sample-size requirement.\n";
  return [
    "| Component | Seen | Matched threshold lift | Achievement-rate lift |",
    "|---|---:|---:|---:|",
    ...selected.map((row) => `| ${row.name} | ${row.present} | ${row.matchedRatioDelta === null ? "n/a" : `${round(row.matchedRatioDelta * 100, 1)}%`} | ${round(row.successRateLift * 100, 1)} pts |`),
    "",
  ].join("\n");
}

async function main() {
  const [inputDir, outputBase = path.join(inputDir ?? ".", "strength-analysis")] = process.argv.slice(2).filter((arg) => arg !== "--");
  if (!inputDir) throw new Error("Usage: vite-node analyse-strength.ts <campaign-directory> [output-base]");
  const campaigns: PlaytestCampaignResult[] = [];
  for (const file of await jsonFiles(inputDir)) {
    if (path.resolve(file).startsWith(path.resolve(outputBase))) continue;
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (Array.isArray(parsed.games) && parsed.games[0]?.boardTiles) campaigns.push(parsed);
  }
  const allGames = campaigns.flatMap((campaign) => campaign.games);
  const excludedErroredGames = allGames.filter((game) => game.errors.length > 0).length;
  const games: AnalysisGame[] = allGames.filter((game) => game.errors.length === 0).map((game) => ({
    ...game,
    ratios: Object.fromEntries(metrics.map((metric) => [metric, game[metric === "score" ? "finalScore" : metric] / thresholds[metric][game.playerCount]])) as Record<Metric, number>,
    success: Object.fromEntries(metrics.map((metric) => [metric, game[metric === "score" ? "finalScore" : metric] >= thresholds[metric][game.playerCount]])) as Record<Metric, boolean>,
  })) as AnalysisGame[];
  if (!games.length) throw new Error(`No instrumented campaign results found in ${inputDir}`);

  const kinds: ComponentKind[] = ["tile", "upgradedTile", "activatedTile", "encounter", "completedArrival", "resolvedBurden", "activeBurden", "usedBoon"];
  const results = Object.fromEntries(metrics.map((metric) => [metric, Object.fromEntries(kinds.map((kind) => [kind, associations(games, kind, metric)]))]));
  const marginalResults = Object.fromEntries(metrics.map((metric) => [metric, marginalTileContributions(games, metric)]));
  const byPlayerCount = Object.fromEntries([1, 2, 3, 4].map((playerCount) => {
    const subset = games.filter((game) => game.playerCount === playerCount);
    return [playerCount, {
      games: subset.length,
      score: round(mean(subset.map((game) => game.finalScore)), 1),
      population: round(mean(subset.map((game) => game.population)), 1),
      renown: round(mean(subset.map((game) => game.renown)), 1),
      hitRates: Object.fromEntries(metrics.map((metric) => [metric, round(mean(subset.map((game) => Number(game.success[metric]))))])),
    }];
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    campaignFiles: campaigns.length,
    games: games.length,
    excludedErroredGames,
    profiles: [...new Set(games.map((game) => game.profile))],
    thresholds,
    byPlayerCount,
    associations: results,
    marginalTileContributions: marginalResults,
  };

  const md: string[] = [
    "# High-score component strength study",
    "",
    `Analysed ${games.length} valid games from ${campaigns.length} seeded campaigns (${excludedErroredGames} bot-error game excluded). “Matched threshold lift” compares games within the same player count and campaign game number; it is an association, not a guaranteed causal effect. Components require at least 8 games both present and absent.`,
    "",
    "## Achievement hit rates",
    "",
    "| Players | Games | Mean score | Mean Population | Mean Renown | Score hit | Population hit | Renown hit |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(byPlayerCount).map(([playerCount, value]: any) => `| ${playerCount} | ${value.games} | ${value.score} | ${value.population} | ${value.renown} | ${round(value.hitRates.score * 100, 1)}% | ${round(value.hitRates.population * 100, 1)}% | ${round(value.hitRates.renown * 100, 1)}% |`),
    "",
  ];
  for (const metric of metrics) {
    const marginal = (marginalResults as any)[metric] as MarginalTileContribution[];
    const marginalTable = (rows: MarginalTileContribution[]) => [
      "| Tile side | Occurrences | Mean marginal points | Positive |",
      "|---|---:|---:|---:|",
      ...rows.map((row) => `| ${row.name} | ${row.occurrences} | ${row.meanContribution} | ${round(row.positiveRate * 100, 1)}% |`),
      "",
    ].join("\n");
    md.push(`## ${metric[0].toUpperCase() + metric.slice(1)}`, "", "### Highest direct end-board contribution", "", marginalTable(marginal.slice(0, 10)), "### Lowest direct end-board contribution", "", marginalTable(marginal.slice(-10).reverse()), "### Tiles most positively associated", "", table((results as any)[metric].tile, metric, 8, true), "### Tiles most negatively associated", "", table((results as any)[metric].tile, metric, 8, false), "### Encounter cards most positively associated", "", table((results as any)[metric].encounter, metric, 8, true), "### Encounter cards most negatively associated", "", table((results as any)[metric].encounter, metric, 8, false));
  }
  await fs.mkdir(path.dirname(outputBase), { recursive: true });
  await fs.writeFile(`${outputBase}.json`, JSON.stringify(report, null, 2));
  await fs.writeFile(`${outputBase}.md`, md.join("\n"));
  console.log(JSON.stringify({ games: games.length, campaigns: campaigns.length, output: [`${outputBase}.json`, `${outputBase}.md`] }, null, 2));
}

await main();

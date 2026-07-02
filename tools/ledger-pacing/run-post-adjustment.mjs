import fs from "node:fs/promises";
import path from "node:path";

const [baselinePath, adjustedPath, baselineSourceDir, adjustedSourceDir, outputDir] = process.argv.slice(2);
if (!baselinePath || !adjustedPath || !baselineSourceDir || !adjustedSourceDir || !outputDir) {
  throw new Error("Usage: node run-post-adjustment.mjs <baseline-bundle.json> <adjusted-bundle.json> <baseline-source-dir> <adjusted-source-dir> <output-dir>");
}

const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
const adjusted = JSON.parse(await fs.readFile(adjustedPath, "utf8"));
const baselineSpecs = JSON.parse(await fs.readFile(path.join(baselineSourceDir, "ledger_entry_specs.json"), "utf8"));
const adjustedSpecs = JSON.parse(await fs.readFile(path.join(adjustedSourceDir, "ledger_entry_specs.json"), "utf8"));
const baselineHashes = JSON.parse(await fs.readFile(path.join(baselineSourceDir, "component_source_hashes.json"), "utf8"));
const adjustedHashes = JSON.parse(await fs.readFile(path.join(adjustedSourceDir, "component_source_hashes.json"), "utf8"));

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
function firstUnlock(campaign, threshold, horizon) {
  const result = campaign.results.find((item) => item.log.game_index <= horizon && item.log.unlock_count_end >= threshold);
  return result?.log.game_index ?? null;
}
function censoredMedian(campaigns, threshold, horizon) {
  const values = campaigns.map((campaign) => firstUnlock(campaign, threshold, horizon) ?? Number.POSITIVE_INFINITY).sort((a, b) => a - b);
  const lower = values[Math.floor((values.length - 1) / 2)];
  const upper = values[Math.ceil((values.length - 1) / 2)];
  if (!Number.isFinite(upper)) return null;
  return (lower + upper) / 2;
}
function endCount(campaign, horizon) {
  return campaign.results.find((result) => result.log.game_index === horizon)?.log.unlock_count_end ?? null;
}
function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function rate(successes, total) {
  return total ? successes / total : 0;
}
function percent(value) {
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}
function format(value) {
  return value === null ? "NR" : Number(value).toFixed(1).replace(/\.0$/, "");
}
function wilson80(successes, total) {
  const z = 1.281551565545;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
function specFor(specs, entryId) {
  return specs.find((spec) => spec.entry_id === entryId);
}

const baselineById = new Map(baseline.campaigns.map((campaign) => [campaign.campaignId, campaign]));
const adjustedById = new Map(adjusted.campaigns.map((campaign) => [campaign.campaignId, campaign]));
const pairedIds = [...adjustedById.keys()].filter((id) => baselineById.has(id));

const campaignRows = pairedIds.map((id) => {
  const before = baselineById.get(id);
  const after = adjustedById.get(id);
  const horizon = after.profile === "guided_ledger" ? 4 : 3;
  const beforeEnd = endCount(before, horizon);
  const afterEnd = endCount(after, horizon);
  return [id, after.profile, after.playerCount, horizon, beforeEnd, afterEnd, afterEnd - beforeEnd, ...[5, 10, 15, 20].flatMap((threshold) => [firstUnlock(before, threshold, horizon), firstUnlock(after, threshold, horizon)])];
});

const entryRows = [];
for (const entryId of ["LE-023", "LE-045"]) {
  for (const playerCount of ["all", 1, 2, 3, 4]) {
    const select = (bundle) => bundle.campaigns
      .filter((campaign) => campaign.profile === "passive_normal" && (playerCount === "all" || campaign.playerCount === playerCount))
      .map((campaign) => campaign.results.find((result) => result.log.game_index === 1));
    const beforeGames = select(baseline);
    const afterGames = select(adjusted);
    const beforeSuccess = beforeGames.filter((result) => result.evaluation.entry_results[entryId].complete).length;
    const afterSuccess = afterGames.filter((result) => result.evaluation.entry_results[entryId].complete).length;
    const interval = wilson80(afterSuccess, afterGames.length);
    entryRows.push([
      entryId,
      specFor(adjustedSpecs, entryId).name,
      playerCount,
      JSON.stringify(specFor(baselineSpecs, entryId).thresholds_by_player_count),
      JSON.stringify(specFor(adjustedSpecs, entryId).thresholds_by_player_count),
      beforeSuccess,
      beforeGames.length,
      rate(beforeSuccess, beforeGames.length),
      afterSuccess,
      afterGames.length,
      rate(afterSuccess, afterGames.length),
      interval[0],
      interval[1],
      playerCount === "all" ? (rate(afterSuccess, afterGames.length) <= .6 ? "PASS" : "FLAG") : "DIAGNOSTIC",
    ]);
  }
}

const profileMetrics = [];
for (const profile of ["guided_ledger", "passive_normal"]) {
  const horizon = profile === "guided_ledger" ? 4 : 3;
  const beforeCampaigns = baseline.campaigns.filter((campaign) => campaign.profile === profile);
  const afterCampaigns = adjusted.campaigns.filter((campaign) => campaign.profile === profile);
  profileMetrics.push({
    profile,
    horizon,
    beforeCampaigns,
    afterCampaigns,
    beforeMean: mean(beforeCampaigns.map((campaign) => endCount(campaign, horizon))),
    afterMean: mean(afterCampaigns.map((campaign) => endCount(campaign, horizon))),
  });
}

const passiveBefore = baseline.campaigns.filter((campaign) => campaign.profile === "passive_normal");
const passiveAfter = adjusted.campaigns.filter((campaign) => campaign.profile === "passive_normal");
const passive5Before = rate(passiveBefore.filter((campaign) => firstUnlock(campaign, 5, 1) === 1).length, passiveBefore.length);
const passive5After = rate(passiveAfter.filter((campaign) => firstUnlock(campaign, 5, 1) === 1).length, passiveAfter.length);
const passive10Before = rate(passiveBefore.filter((campaign) => firstUnlock(campaign, 10, 3) !== null).length, passiveBefore.length);
const passive10After = rate(passiveAfter.filter((campaign) => firstUnlock(campaign, 10, 3) !== null).length, passiveAfter.length);
const guidedBefore = baseline.campaigns.filter((campaign) => campaign.profile === "guided_ledger");
const guidedAfter = adjusted.campaigns.filter((campaign) => campaign.profile === "guided_ledger");

const allResults = adjusted.campaigns.flatMap((campaign) => campaign.results);
const simulationErrors = allResults.filter((result) => result.validationErrors.length).length;
const le23All = entryRows.find((row) => row[0] === "LE-023" && row[2] === "all");
const le45All = entryRows.find((row) => row[0] === "LE-045" && row[2] === "all");

const report = `# Ledger Post-Adjustment Validation

Baseline workbook: \`${baselineHashes.workbook.filename}\` · SHA-256 \`${baselineHashes.workbook.sha256}\`

Adjusted workbook: \`${adjustedHashes.workbook.filename}\` · SHA-256 \`${adjustedHashes.workbook.sha256}\`

## Scope

- 112 fresh current-engine games using the same campaign IDs and random seeds as the Stage 2 baseline.
- 16 Guided Ledger campaigns through game 4.
- 16 Passive Normal campaigns through game 3.
- No player-facing Ledger or Golden feature implementation.
- Simulation errors: ${simulationErrors}.

## Entry-Level Effect

| Entry | Old target | New target | Passive game-1 before | Passive game-1 after | 80% Wilson interval | Result |
|---|---|---|---:|---:|---:|---|
| LE-023 Stores Set Aside | 35/55/55/55 | 41/64/64/64 | ${percent(le23All[7])} | ${percent(le23All[10])} | ${percent(le23All[11])}–${percent(le23All[12])} | ${le23All[13]} |
| LE-045 The Storehouse Sang | 3/3/3/3 | 4/4/4/4 | ${percent(le45All[7])} | ${percent(le45All[10])} | ${percent(le45All[11])}–${percent(le45All[12])} | ${le45All[13]} |

LE-023 now falls below the plan's 60% single-entry first-game warning. LE-045 improves substantially but remains slightly above it.

## Campaign-Level Effect

| Check | Before | After | Acceptance |
|---|---:|---:|---|
| Passive reaches 5 in game 1 | ${percent(passive5Before)} | ${percent(passive5After)} | Must be 35% or lower |
| Passive reaches 10 by game 3 | ${percent(passive10Before)} | ${percent(passive10After)} | Must be 35% or lower |
| Guided mean completed entries after game 4 | ${format(profileMetrics[0].beforeMean)} | ${format(profileMetrics[0].afterMean)} | Directional diagnostic |
| Passive mean completed entries after game 3 | ${format(profileMetrics[1].beforeMean)} | ${format(profileMetrics[1].afterMean)} | Directional diagnostic |

## Guided Timing Through Game 4

| Unlock | Baseline median | Adjusted median | Baseline reached | Adjusted reached |
|---:|---:|---:|---:|---:|
${[5, 10, 15, 20].map((threshold) => `| ${threshold} | ${format(censoredMedian(guidedBefore, threshold, 4))} | ${format(censoredMedian(guidedAfter, threshold, 4))} | ${guidedBefore.filter((campaign) => firstUnlock(campaign, threshold, 4) !== null).length}/16 | ${guidedAfter.filter((campaign) => firstUnlock(campaign, threshold, 4) !== null).length}/16 |`).join("\n")}

## Decision

**Retain both changes as directional improvements, but do not treat the Ledger curve as repaired.** LE-023 clears its entry-level warning; LE-045 remains marginally automatic. The global Passive warnings are unchanged at 100%, and Guided groups still reach early unlocks far ahead of the intended windows.

The next tuning decision should focus on the non-numeric automatic drivers identified in Stage 2: LE-020, LE-039, LE-040, and LE-043. Further increasing LE-023 alone would not address the dominant early crossings.
`;

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "post_adjustment_validation.md"), report);
await fs.writeFile(path.join(outputDir, "post_adjustment_campaign_comparison.csv"), toCsv([
  "campaign_id", "profile", "player_count", "horizon", "baseline_entries", "adjusted_entries", "delta_entries",
  "baseline_unlock_5", "adjusted_unlock_5", "baseline_unlock_10", "adjusted_unlock_10", "baseline_unlock_15", "adjusted_unlock_15", "baseline_unlock_20", "adjusted_unlock_20",
], campaignRows));
await fs.writeFile(path.join(outputDir, "post_adjustment_entry_comparison.csv"), toCsv([
  "entry_id", "entry_name", "player_count", "baseline_thresholds", "adjusted_thresholds", "baseline_successes", "baseline_games", "baseline_rate", "adjusted_successes", "adjusted_games", "adjusted_rate", "adjusted_wilson80_low", "adjusted_wilson80_high", "result",
], entryRows));

console.log(JSON.stringify({
  adjusted_games: allResults.length,
  simulation_errors: simulationErrors,
  le_023_first_game_rate: le23All[10],
  le_045_first_game_rate: le45All[10],
  passive_5_game_1_rate: passive5After,
  passive_10_game_3_rate: passive10After,
  guided_mean_entries_game_4: profileMetrics[0].afterMean,
}, null, 2));

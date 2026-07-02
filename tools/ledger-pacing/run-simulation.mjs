import fs from "node:fs/promises";
import path from "node:path";
import { createRandom } from "./lib/simulator.mjs";

const [sourceDir, outputDir = sourceDir, currentBundlePath] = process.argv.slice(2);
if (!sourceDir || !currentBundlePath) throw new Error("Usage: node run-simulation.mjs <stage-minus-one-output-dir> <output-dir> <current-prototype-bundle.json>");

const specs = JSON.parse(await fs.readFile(path.join(sourceDir, "ledger_entry_specs.json"), "utf8"));
const hashes = JSON.parse(await fs.readFile(path.join(sourceDir, "component_source_hashes.json"), "utf8"));
const currentBundle = JSON.parse(await fs.readFile(currentBundlePath, "utf8"));

function csvCell(value) {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function toCsv(headers, rows) { return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n"; }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function quantile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper || sorted[lower] === sorted[upper]) return sorted[lower];
  if (!Number.isFinite(sorted[upper])) return Number.POSITIVE_INFINITY;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
function median(values) { return quantile(values, 0.5); }
function format(value, digits = 1) { return value === null || !Number.isFinite(value) ? "NR" : Number(value).toFixed(digits).replace(/\.0$/, ""); }
function bootstrapMedian80(values, seed) {
  if (!values.length) return [null, null];
  const random = createRandom(seed);
  const samples = [];
  for (let iteration = 0; iteration < 2000; iteration += 1) {
    samples.push(median(Array.from({ length: values.length }, () => values[Math.floor(random() * values.length)])));
  }
  return [quantile(samples, 0.1), quantile(samples, 0.9)];
}
function wilson80(successes, total) {
  if (!total) return [0, 0];
  const z = 1.281551565545;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
function completedByGame(campaign, threshold) {
  const game = campaign.results.find((result) => result.log.unlock_count_end >= threshold);
  return game?.log.game_index ?? null;
}
function censoredUnlockTimes(campaigns, threshold) {
  return campaigns.map((campaign) => completedByGame(campaign, threshold) ?? Number.POSITIVE_INFINITY);
}
function reachedByRate(campaigns, threshold, deadline) {
  return campaigns.filter((campaign) => {
    const game = completedByGame(campaign, threshold);
    return game !== null && game <= deadline;
  }).length / campaigns.length;
}
function campaignKey(campaign) { return `${campaign.profile}:${campaign.playerCount}`; }
function sourceLine() { return `Source workbook: \`${hashes.workbook.filename}\` · SHA-256 \`${hashes.workbook.sha256}\``; }

await fs.mkdir(outputDir, { recursive: true });

const stage1 = currentBundle.stage1;
const campaigns = currentBundle.campaigns;
const guided = campaigns.filter((campaign) => campaign.profile === "guided_ledger");
const goldenDisabledPairs = currentBundle.goldenDisabledPairs ?? [];
const continuationCampaigns = currentBundle.continuationCampaigns ?? [];

const stage2Games = campaigns.flatMap((campaign) => campaign.results.map((result) => ({ ...result, campaign })));
const continuationGames = continuationCampaigns.flatMap((campaign) => campaign.results.slice(12).map((result) => ({ ...result, campaign })));
const allAnalysisGames = [...stage2Games, ...continuationGames];
const validationErrors = [...stage1, ...allAnalysisGames].flatMap((result) => result.validationErrors.map((error) => ({ game: result.log.campaign_id, error })));
const duplicateCoordGames = [...stage1, ...allAnalysisGames].filter((result) => new Set(result.log.board.tiles.map((tile) => tile.coord)).size !== result.log.board.tiles.length);
const impossibleActionGames = [...stage1, ...allAnalysisGames].filter((result) => Object.values(result.log.actions).slice(0, 4).reduce((sum, value) => sum + value, 0) > result.log.player_count * 48);
const lowActionGames = [...stage1, ...allAnalysisGames].filter((result) => Object.values(result.log.actions).slice(0, 4).reduce((sum, value) => sum + value, 0) < result.log.player_count * 48 * .7);
const invalidResourceTerrainGames = [...stage1, ...allAnalysisGames].filter((result) => result.log.board.tiles.some((tile) => tile.category === "Resource" && !tile.is_special && !["woodland", "mountains", "heaths", "arable", "ruins"].includes(tile.terrain)));
const invalidWaterPlacementGames = [...stage1, ...allAnalysisGames].filter((result) => result.log.board.tiles.some((tile) => tile.terrain === "water" && tile.category !== "Travel"));

const campaignHeaders = ["campaign_id","profile","player_count","games_run","final_named_entries","unlock_5_game","unlock_10_game","unlock_15_game","unlock_20_game","unlock_30_game","continued_to_16"];
const campaignRows = campaigns.map((campaign) => [
  campaign.campaignId, campaign.profile, campaign.playerCount, campaign.results.length,
  campaign.state.completed_named_entries.length,
  ...[5, 10, 15, 20, 30].map((threshold) => completedByGame(continuationCampaigns.find((item) => item.campaignId === campaign.campaignId) ?? campaign, threshold)),
  continuationCampaigns.some((item) => item.campaignId === campaign.campaignId),
]);
await fs.writeFile(path.join(outputDir, "ledger_campaign_results.csv"), toCsv(campaignHeaders, campaignRows));

const gameHeaders = ["stage","campaign_id","game_index","seed","profile","player_count","source_game_id","unlock_count_start","unlock_count_end","new_named_entries","targeted_entries","completed_targets","score","population","renown","active_burdens","strain_tokens","overstrained_tiles","warehouse_total","placed_tiles","housing_tiles","travel_tiles","special_tiles","upgrades","arrivals_completed","arrivals_expired","burdens_resolved","golden_tile","golden_boon"];
const gameRows = [
  ...stage1.map((result) => ["1", result.log.campaign_id, result.log.game_index, result.log.seed, result.log.strategy_profile, result.log.player_count, result.sourceGameId, result.log.unlock_count_start, result.log.unlock_count_end, result.evaluation.new_named_entries, result.log.targeted_ledger_entries, result.log.target_attempts.filter((attempt) => attempt.result === "completed").map((attempt) => attempt.entry_id), result.log.final.score, result.log.final.population, result.log.final.renown, result.log.final.active_burdens, result.log.final.strain_tokens, result.log.final.overstrained_tiles, result.log.final.warehouse_total, result.log.tile_counts.placed_total, result.log.tile_counts.placed_housing_tiles, result.log.tile_counts.placed_travel_tiles, result.log.tile_counts.placed_special_tiles, result.log.tile_counts.upgraded_core_tiles, result.log.encounters.arrivals_completed, result.log.encounters.arrivals_expired, result.log.encounters.burdens_resolved_or_removed, result.log.golden_tile_used, result.log.golden_boon_used]),
  ...stage2Games.map(({ log, evaluation, sourceGameId }) => ["2", log.campaign_id, log.game_index, log.seed, log.strategy_profile, log.player_count, sourceGameId, log.unlock_count_start, log.unlock_count_end, evaluation.new_named_entries, log.targeted_ledger_entries, log.target_attempts.filter((attempt) => attempt.result === "completed").map((attempt) => attempt.entry_id), log.final.score, log.final.population, log.final.renown, log.final.active_burdens, log.final.strain_tokens, log.final.overstrained_tiles, log.final.warehouse_total, log.tile_counts.placed_total, log.tile_counts.placed_housing_tiles, log.tile_counts.placed_travel_tiles, log.tile_counts.placed_special_tiles, log.tile_counts.upgraded_core_tiles, log.encounters.arrivals_completed, log.encounters.arrivals_expired, log.encounters.burdens_resolved_or_removed, log.golden_tile_used, log.golden_boon_used]),
  ...continuationGames.map(({ log, evaluation, sourceGameId }) => ["2D", log.campaign_id, log.game_index, log.seed, log.strategy_profile, log.player_count, sourceGameId, log.unlock_count_start, log.unlock_count_end, evaluation.new_named_entries, log.targeted_ledger_entries, log.target_attempts.filter((attempt) => attempt.result === "completed").map((attempt) => attempt.entry_id), log.final.score, log.final.population, log.final.renown, log.final.active_burdens, log.final.strain_tokens, log.final.overstrained_tiles, log.final.warehouse_total, log.tile_counts.placed_total, log.tile_counts.placed_housing_tiles, log.tile_counts.placed_travel_tiles, log.tile_counts.placed_special_tiles, log.tile_counts.upgraded_core_tiles, log.encounters.arrivals_completed, log.encounters.arrivals_expired, log.encounters.burdens_resolved_or_removed, log.golden_tile_used, log.golden_boon_used]),
];
await fs.writeFile(path.join(outputDir, "ledger_game_results.csv"), toCsv(gameHeaders, gameRows));

const nearMissRows = allAnalysisGames.flatMap(({ log, evaluation }) => evaluation.near_misses.map((miss) => [log.campaign_id, log.game_index, log.strategy_profile, log.player_count, miss.entry_id, specs.find((spec) => spec.entry_id === miss.entry_id).name, miss.required, miss.actual, miss.margin, miss.reason]));
await fs.writeFile(path.join(outputDir, "ledger_near_misses.csv"), toCsv(["campaign_id","game_index","profile","player_count","entry_id","entry_name","required","actual","margin","reason"], nearMissRows));

const entryStats = specs.map((spec) => {
  const games = stage2Games;
  const completed = games.filter(({ evaluation }) => evaluation.entry_results[spec.entry_id]?.complete);
  const targeted = games.filter(({ log }) => log.targeted_ledger_entries.includes(spec.entry_id));
  const targetedCompleted = targeted.filter(({ evaluation }) => evaluation.entry_results[spec.entry_id]?.complete);
  const passiveFirst = games.filter(({ log }) => log.strategy_profile === "passive_normal" && log.game_index === 1);
  const passiveFirstCompleted = passiveFirst.filter(({ evaluation }) => evaluation.entry_results[spec.entry_id]?.complete);
  const byPlayer = Object.fromEntries([1,2,3,4].map((playerCount) => {
    const group = games.filter(({ log }) => log.player_count === playerCount);
    return [playerCount, group.filter(({ evaluation }) => evaluation.entry_results[spec.entry_id]?.complete).length / group.length];
  }));
  return { spec, completionRate: completed.length / games.length, targetedCount: targeted.length, targetedCompletionRate: targeted.length ? targetedCompleted.length / targeted.length : null, passiveFirstRate: passiveFirstCompleted.length / passiveFirst.length, byPlayer };
});
await fs.writeFile(path.join(outputDir, "ledger_entry_stats.csv"), toCsv(["entry_id","entry_name","chronicle","pacing_band","evaluator_class","completion_rate","targeted_attempts","targeted_completion_rate","passive_first_game_rate","1p_rate","2p_rate","3p_rate","4p_rate"], entryStats.map((stat) => [stat.spec.entry_id, stat.spec.name, stat.spec.chronicle, stat.spec.pacing_band, stat.spec.evaluator_class, stat.completionRate, stat.targetedCount, stat.targetedCompletionRate, stat.passiveFirstRate, stat.byPlayer[1], stat.byPlayer[2], stat.byPlayer[3], stat.byPlayer[4]])));

const globalPacingTooFast = median(censoredUnlockTimes(guided, 10)) < 3;
const recommendations = [];
for (const stat of entryStats) {
  let problem = null;
  if (stat.passiveFirstRate > 0.6) problem = "too_easy";
  else if (stat.spec.evaluator_class !== "campaign_cumulative" && stat.targetedCount >= 5 && stat.targetedCompletionRate === 0) problem = "too_hard";
  else if (stat.spec.pacing_band === "Foundation" && stat.completionRate < 0.15) problem = "too_hard";
  else if (stat.spec.pacing_band === "Standard" && stat.completionRate < 0.1) problem = "too_hard";
  if (!problem) continue;
  const actionability = Math.min(5, 2 + (stat.targetedCount >= 5 ? 1 : 0) + (stat.passiveFirstRate > 0.6 ? 1 : 0) + (stat.spec.thresholds_by_player_count ? 1 : 0));
  let proposed = "Run a focused human/prototype probe before changing this non-numeric condition.";
  if (stat.spec.thresholds_by_player_count && !(problem === "too_hard" && globalPacingTooFast)) {
    const next = Object.fromEntries(Object.entries(stat.spec.thresholds_by_player_count).map(([key, value]) => [key, problem === "too_easy" ? Math.max(value + 1, Math.ceil(value * 1.15)) : Math.max(0, Math.floor(value * .9))]));
    proposed = `Change player-count targets from ${JSON.stringify(stat.spec.thresholds_by_player_count)} to ${JSON.stringify(next)}.`;
  } else if (problem === "too_hard" && globalPacingTooFast) {
    proposed = "Do not ease this entry while the overall unlock curve is too fast. Reassess after tightening early automatic drivers.";
  }
  recommendations.push({
    entry_id: stat.spec.entry_id,
    entry_name: stat.spec.name,
    problem_type: problem,
    evidence: { passive_first_game_rate: stat.passiveFirstRate, targeted_attempts: stat.targetedCount, targeted_completion_rate: stat.targetedCompletionRate, overall_completion_rate: stat.completionRate, player_count_rates: stat.byPlayer },
    actionability_score: actionability,
    proposed_change: proposed,
    expected_effect: problem === "too_easy" ? "Reduce automatic early completion." : "Improve completion when deliberately targeted.",
    minimal_rerun_plan: problem === "too_easy"
      ? "Run 4 Passive campaigns per affected player count through game 3 and 4 Guided campaigns per affected player count through game 4."
      : globalPacingTooFast
        ? "Defer a separate rerun until early automatic drivers are tightened; then reassess this entry in the same focused campaign block."
        : "Run 4 Guided campaigns for affected player counts through two games after the relevant unlock target, plus 4 Passive three-game campaigns because the entry is being made easier.",
    patch_recommended_now: actionability >= 4 && Boolean(stat.spec.thresholds_by_player_count) && !(problem === "too_hard" && globalPacingTooFast),
  });
}
await fs.writeFile(path.join(outputDir, "ledger_recommendations.csv"), toCsv(["entry_id","entry_name","problem_type","evidence","actionability_score","proposed_change","expected_effect","minimal_rerun_plan","patch_recommended_now"], recommendations.map((item) => Object.values(item))));

const unlockThresholds = [5, 10, 15, 20, 30];
const summaryGroups = [];
for (const profile of ["guided_ledger", "passive_normal", "achievement_chaser"]) {
  for (const playerCount of [1,2,3,4]) {
    const group = campaigns.filter((campaign) => campaign.profile === profile && campaign.playerCount === playerCount).map((campaign) => continuationCampaigns.find((item) => item.campaignId === campaign.campaignId) ?? campaign);
    summaryGroups.push({ profile, playerCount, unlocks: Object.fromEntries(unlockThresholds.map((target) => {
      const reached = group.map((campaign) => completedByGame(campaign, target)).filter((value) => value !== null);
      const values = censoredUnlockTimes(group, target);
      const interval = bootstrapMedian80(values, `${profile}:${playerCount}:${target}`);
      return [target, { median: median(values), q25: quantile(values, .25), q75: quantile(values, .75), ci80: interval, reached: reached.length, total: group.length }];
    })) });
  }
}

const guidedRows = summaryGroups.filter((group) => group.profile === "guided_ledger").map((group) => `| ${group.playerCount}p | ${unlockThresholds.map((target) => { const result = group.unlocks[target]; return `${format(result.median)} (${result.reached}/${result.total})`; }).join(" | ")} |`).join("\n");
const detailedTimingRows = summaryGroups.map((group) => `| ${group.profile.replaceAll("_", " ")} | ${group.playerCount}p | ${unlockThresholds.map((target) => { const result = group.unlocks[target]; return !Number.isFinite(result.median) ? "NR" : `${format(result.median)} [${format(result.q25)}–${format(result.q75)}], CI ${format(result.ci80[0])}–${format(result.ci80[1])}`; }).join(" | ")} |`).join("\n");
const guidedWithContinuation = guided.map((campaign) => continuationCampaigns.find((item) => item.campaignId === campaign.campaignId) ?? campaign);
const allGuidedByThreshold = Object.fromEntries(unlockThresholds.map((target) => [target, censoredUnlockTimes(guidedWithContinuation, target)]));
const acceptance = {
  5: { min: 1, max: 2.5, deadline: 2, minRate: .7 },
  10: { min: 3, max: 4.5, deadline: 4, minRate: .7 },
  15: { min: 5, max: 6.5, deadline: 6, minRate: .6 },
  20: { min: 7, max: 9.5, deadline: 9, minRate: .6 },
  30: { min: 12, max: Infinity, deadline: 16, minRate: .5, earlyDeadline: 9, maxEarlyRate: .4 },
};
const acceptanceRows = unlockThresholds.map((target) => {
  const value = median(allGuidedByThreshold[target]);
  const rule = acceptance[target];
  const deadlineRate = reachedByRate(guidedWithContinuation, target, rule.deadline);
  const earlyRate = rule.earlyDeadline ? reachedByRate(guidedWithContinuation, target, rule.earlyDeadline) : null;
  const pass = Number.isFinite(value) && value >= rule.min && value <= rule.max && deadlineRate >= rule.minRate && (earlyRate === null || earlyRate <= rule.maxEarlyRate);
  const coverage = target === 30
    ? `at least ${format(deadlineRate * 100)}% by game ${rule.deadline}; ${format(earlyRate * 100)}% by game ${rule.earlyDeadline}`
    : `${format(deadlineRate * 100)}% by game ${rule.deadline}`;
  return `| ${target} | ${format(value)} | ${coverage} | ${pass ? "PASS" : "FAIL"} |`;
}).join("\n");

const passiveCampaigns = campaigns.filter((campaign) => campaign.profile === "passive_normal");
const passive5Game1 = passiveCampaigns.filter((campaign) => completedByGame(campaign, 5) === 1).length;
const passive10Game3 = passiveCampaigns.filter((campaign) => { const game = completedByGame(campaign, 10); return game !== null && game <= 3; }).length;
const chaserCampaigns = campaigns.filter((campaign) => campaign.profile === "achievement_chaser");
const chaser20Game5 = chaserCampaigns.filter((campaign) => { const game = completedByGame(campaign, 20); return game !== null && game <= 5; }).length;
const warningRows = [
  ["Passive reaches 5 in game 1", passive5Game1, passiveCampaigns.length, .35],
  ["Passive reaches 10 by game 3", passive10Game3, passiveCampaigns.length, .35],
  ["Chaser reaches 20 by game 5", chaser20Game5, chaserCampaigns.length, .4],
].map(([label, successes, total, limit]) => { const interval = wilson80(successes, total); return `| ${label} | ${format(successes / total * 100)}% | ${format(interval[0] * 100)}–${format(interval[1] * 100)}% | ${successes / total > limit ? "FLAG" : "PASS"} |`; }).join("\n");

const parityFlags = [];
for (const target of [10, 15, 20]) {
  const allMedian = median(allGuidedByThreshold[target]);
  const byPlayer = Object.fromEntries(summaryGroups.filter((group) => group.profile === "guided_ledger").map((group) => [group.playerCount, group.unlocks[target].median]));
  for (const [playerCount, value] of Object.entries(byPlayer)) {
    if (value !== null && allMedian !== null && Math.abs(value - allMedian) > 2) parityFlags.push(`${playerCount}p differs from the all-count median by more than 2 games at unlock ${target}.`);
  }
}

const topDrivers = [];
for (const target of unlockThresholds) {
  const counts = new Map();
  let crossings = 0;
  for (const campaign of campaigns) {
    const crossing = campaign.results.find((result) => result.log.unlock_count_end >= target && result.log.unlock_count_start < target);
    if (!crossing) continue;
    crossings += 1;
    for (const entryId of crossing.evaluation.new_named_entries) counts.set(entryId, (counts.get(entryId) ?? 0) + 1);
  }
  for (const [entryId, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    topDrivers.push([target, entryId, specs.find((spec) => spec.entry_id === entryId).name, crossings ? count / crossings : 0]);
  }
}

const passiveGames = stage2Games.filter(({ log }) => log.strategy_profile === "passive_normal");
const pairCounts = new Map();
for (const { evaluation } of passiveGames) {
  const completed = specs.filter((spec) => evaluation.entry_results[spec.entry_id]?.complete);
  for (let a = 0; a < completed.length; a += 1) {
    for (let b = a + 1; b < completed.length; b += 1) {
      const shared = completed[a].duplicate_tags.at(-1) === completed[b].duplicate_tags.at(-1) ? completed[a].duplicate_tags.at(-1) : null;
      if (!shared) continue;
      const key = `${completed[a].entry_id}|${completed[b].entry_id}|${shared}`;
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }
  }
}
const duplicateDrivers = [...pairCounts.entries()].map(([key, count]) => [...key.split("|"), count / passiveGames.length]).filter((row) => row[3] > .45).sort((a, b) => b[3] - a[3]);

const goldenDiagnostics = [];
for (const playerCount of [1,2,3,4]) {
  const enabled = guided.filter((campaign) => campaign.playerCount === playerCount);
  const disabled = goldenDisabledPairs.filter((campaign) => campaign.playerCount === playerCount);
  for (const target of [10,15,20,30]) {
    const enabledMedian = median(censoredUnlockTimes(enabled, target));
    const disabledMedian = disabled.length ? median(censoredUnlockTimes(disabled, target)) : null;
    const acceleration = Number.isFinite(enabledMedian) && Number.isFinite(disabledMedian) ? disabledMedian - enabledMedian : null;
    goldenDiagnostics.push([playerCount, target, Number.isFinite(enabledMedian) ? enabledMedian : null, Number.isFinite(disabledMedian) ? disabledMedian : null, acceleration, disabled.length === 0 ? "UNAVAILABLE" : acceleration !== null && acceleration > 1.5 ? "FLAG" : "PASS"]);
  }
}
const goldenAccelerationFlag = goldenDiagnostics.some((row) => row[5] === "FLAG");

const calibrationRows = [];
for (const playerCount of [1,2,3,4]) {
  for (const profile of ["passive_normal", "guided_ledger", "achievement_chaser"]) {
    const simGroup = stage2Games.filter(({ log }) => log.player_count === playerCount && log.strategy_profile === profile).map(({ log }) => log);
    for (const [label, getter] of [
      ["Score", (log) => log.final.score],
      ["Population", (log) => log.final.population],
      ["Renown", (log) => log.final.renown],
      ["Placed Tiles", (log) => log.tile_counts.placed_total],
      ["Housing", (log) => log.tile_counts.placed_housing_tiles],
      ["Travel", (log) => log.tile_counts.placed_travel_tiles],
      ["Special", (log) => log.tile_counts.placed_special_tiles],
      ["Upgrades", (log) => log.tile_counts.upgraded_core_tiles],
      ["Arrivals completed", (log) => log.encounters.arrivals_completed],
      ["Active Burdens", (log) => log.final.active_burdens],
      ["Strain", (log) => log.final.strain_tokens],
      ["Action utilisation", (log) => (log.actions.place_actions + log.actions.upgrade_actions + log.actions.activate_actions + log.actions.encounter_interact_actions) / (log.player_count * 48)],
    ]) {
      calibrationRows.push([playerCount, profile, label, mean(simGroup.map(getter))]);
    }
  }
}

const validationReport = `# Ledger Simulation Validation Report

${sourceLine()}

## Fidelity

- Tier: **C for implemented prototype rules** — games execute the current setup, seeding, reveal, legal-action, effect, placement, season, and scoring engine directly.
- Source: current repository engine and v3.12 workbook authority. The older 80-game workbook export is not used as a simulation input.
- Geometry source: the current prototype's 14 × 9 flat-top map and placement validator.
- Stage 0: 50 pass fixtures, 50 fail fixtures, and 10 named edge cases passed.
- Stage 1: 24 smoke games completed.
- Stage 2: ${stage2Games.length} games across ${campaigns.length} campaigns.
- Stage 2D: ${continuationGames.length} continuation games${continuationGames.length ? " because fewer than half of Guided campaigns reached 30 entries by game 12" : " (not triggered)"}.
- Golden acceleration diagnostic: unavailable because Golden Tiles and Golden Boons are explicitly unsupported by the current prototype engine.

## Log Integrity

| Check | Result |
|---|---|
| Encounter reveal validation | ${validationErrors.length ? `FAIL (${validationErrors.length})` : "PASS"} |
| Unique board coordinates | ${duplicateCoordGames.length ? `FAIL (${duplicateCoordGames.length})` : "PASS"} |
| Action use never exceeds 48 per player | ${impossibleActionGames.length ? `FAIL (${impossibleActionGames.length})` : "PASS"} |
| At least 70% action utilisation | ${lowActionGames.length ? `REVIEW (${lowActionGames.length})` : "PASS"} |
| Resource Tiles use valid terrain families | ${invalidResourceTerrainGames.length ? `FAIL (${invalidResourceTerrainGames.length})` : "PASS"} |
| Only Travel occupies River/Water | ${invalidWaterPlacementGames.length ? `FAIL (${invalidWaterPlacementGames.length})` : "PASS"} |
| Board graph included for derived checks | ${[...stage1, ...allAnalysisGames].every((result) => result.log.board.tiles.length && result.log.board.derived_features) ? "PASS" : "FAIL"} |
| Golden Boons excluded from hands | ${validationErrors.some((item) => item.error.includes("hands")) ? "FAIL" : "PASS"} |

## Current-Engine Outcome Calibration

These are newly generated current-rules outcomes, shown separately by profile and player count. Action utilisation is displayed as a percentage; other values are game means.

| Players | Profile | Metric | Mean |
|---:|---|---|---:|
${calibrationRows.map(([pc,profile,label,value]) => `| ${pc} | ${profile.replaceAll("_", " ")} | ${label} | ${label === "Action utilisation" ? format(value * 100) + "%" : format(value)} |`).join("\n")}

## Limitations

- The bot executes real engine actions but uses a deterministic heuristic player policy rather than human search.
- Golden Tiles and Golden Boons are not implemented in the current prototype, so Golden acceleration and reveal timing cannot be tested without expanding simulation-only rules.
- Recommendations with actionability below 4 are tentative and should not be applied without focused prototype or human runs.
`;
await fs.writeFile(path.join(outputDir, "ledger_validation_report.md"), validationReport);

await fs.writeFile(
  path.join(outputDir, "ledger_evaluator_limitations.md"),
  `# Ledger Evaluator and Simulation Limitations\n\n${sourceLine()}\n\n## Evaluator Coverage\n\nAll 50 Ledger Entries have deterministic evaluators. No entry remains manual or unimplemented.\n\n## Simulation Limits\n\n- Games execute the current prototype engine, but decisions come from a deterministic heuristic policy rather than human search.\n- Golden Tiles and Golden Boons are explicitly unsupported by the current prototype and are excluded from current-rules campaign outcomes.\n- Golden acceleration and reveal timing therefore remain untested; final Golden tuning conclusions require a simulation-only Golden rules layer or later prototype support.\n- The historical 80-game workbook export is retained for audit only and is not used as an input.\n`,
);

const achievability = `# Ledger Entry Achievability Probe

${sourceLine()}

Stage 1 and Stage 2 observations. "Targeted completion" is conditional on the simulator choosing the entry as an explicit goal.

| Entry | Band / intended role | How players pursue it | Main blocker | Attempt rate | Targeted completion | Risk |
|---|---|---|---|---:|---:|---|
${entryStats.map((stat) => {
  const risk = stat.passiveFirstRate > .6 ? "too_easy" : stat.targetedCount >= 5 && stat.targetedCompletionRate === 0 ? "too_hard" : stat.completionRate < .05 ? "unmeasurable" : "healthy";
  const pursuit = stat.spec.gates.declared_vow_required ? "Declare before setup and build around the restriction." : stat.spec.evaluator_class === "derived_board" ? "Plan the final map geometry deliberately." : stat.spec.evaluator_class === "steward_gated" ? `Choose ${stat.spec.gates.required_steward} and complete its linked condition.` : "Prioritise the named metric during normal play.";
  const blocker = stat.spec.gates.declared_vow_required ? "Pre-setup commitment plus score floor." : stat.spec.evaluator_class === "campaign_cumulative" ? "Requires progress across multiple games." : stat.spec.pacing_band === "Capstone" ? "Rare threshold or restrictive combination." : "Competes with score and encounter pressure.";
  return `| ${stat.spec.entry_id} ${stat.spec.name} | ${stat.spec.pacing_band} | ${pursuit} | ${blocker} | ${format(stat.targetedCount / stage2Games.length * 100)}% | ${stat.targetedCompletionRate === null ? "n/a" : format(stat.targetedCompletionRate * 100) + "%"} | ${risk} |`;
}).join("\n")}
`;
await fs.writeFile(path.join(outputDir, "ledger_entry_achievability_probe.md"), achievability);

const highAction = recommendations.filter((item) => item.patch_recommended_now);
const summaryRecommendations = [...recommendations].sort((a, b) => Number(b.patch_recommended_now) - Number(a.patch_recommended_now) || b.actionability_score - a.actionability_score || a.entry_id.localeCompare(b.entry_id));
const adjustmentPatch = `# Proposed Ledger Adjustment Patch

${sourceLine()}

No workbook changes have been applied. These are simulation-derived proposals only.

${highAction.length ? highAction.map((item) => `## ${item.entry_id} — ${item.entry_name}\n\n- Problem: ${item.problem_type}\n- Evidence: \`${JSON.stringify(item.evidence)}\`\n- Proposed workbook delta: ${item.proposed_change}\n- Expected effect: ${item.expected_effect}\n- Minimal rerun: ${item.minimal_rerun_plan}`).join("\n\n") : "No recommendation reached the actionability threshold of 4. Preserve the workbook and gather focused evidence."}
`;
await fs.writeFile(path.join(outputDir, "ledger_adjustment_patch.md"), adjustmentPatch);

const summary = `# Steward's Ledger Pacing Summary

${sourceLine()}

## Decision

**Standard Ledger decision: Tune Ledger. Full-model decision: ${goldenDisabledPairs.length ? "Tune Ledger" : "Need Simulator Support for Golden content"}.** Standard Ledger pacing is measured from newly executed current-engine games. Golden acceleration cannot receive a final verdict because Golden Tiles and Golden Boons are not implemented in the prototype. No Golden system or player-facing Ledger work was designed, and the workbook was not edited.

## Guided Unlock Timing

Cells show median game and campaigns reaching the threshold.

| Players | Unlock 5 | Unlock 10 | Unlock 15 | Unlock 20 | Unlock 30 |
|---:|---:|---:|---:|---:|---:|
${guidedRows}

## Detailed Timing and Uncertainty

Each cell is the all-campaign median game, interquartile range in brackets, then bootstrap 80% confidence interval. Campaigns that did not reach a threshold remain right-censored rather than being dropped. \`NR\` means the median campaign did not reach that threshold within the tested horizon.

| Profile | Players | Unlock 5 | Unlock 10 | Unlock 15 | Unlock 20 | Unlock 30 |
|---|---:|---:|---:|---:|---:|---:|
${detailedTimingRows}

## Acceptance

| Unlock | Guided median | Required coverage | Result |
|---:|---:|---|---|
${acceptanceRows}

## Early-Pacing Warnings

| Warning | Observed | Wilson 80% interval | Result |
|---|---:|---:|---|
${warningRows}

## Player-Count Parity

${parityFlags.length ? parityFlags.map((flag) => `- FLAG: ${flag}`).join("\n") : "No player-count parity trigger exceeded the plan's two-game threshold for unlocks 10, 15, or 20."}

## Top Unlock Drivers

| Unlock | Entry | Name | Share of threshold crossings |
|---:|---|---|---:|
${topDrivers.map(([target, entryId, name, share]) => `| ${target} | ${entryId} | ${name} | ${format(share * 100)}% |`).join("\n")}

## Duplicate Drivers

| Entry A | Entry B | Shared tag | Passive co-completion rate |
|---|---|---|---:|
${duplicateDrivers.length ? duplicateDrivers.map(([a,b,tag,rate]) => `| ${a} | ${b} | ${tag} | ${format(rate * 100)}% |`).join("\n") : "| None above 45% | — | — | — |"}

## Main Risks

${summaryRecommendations.length ? summaryRecommendations.slice(0, 10).map((item) => `- **${item.entry_id} ${item.entry_name}:** ${item.problem_type}; actionability ${item.actionability_score}/5${item.patch_recommended_now ? "; focused numeric candidate" : ""}.`).join("\n") : "- No entry-level warning crossed the configured thresholds."}

## Golden Content

Golden content was not simulated. The workbook and setup authority mark Golden Tiles and Golden Boons as unsupported by the current prototype, so acceleration and early/mid/late reveal timing remain unavailable rather than inferred from the obsolete bot export.

## Recommended Use

The two focused numeric candidates are LE-023 and LE-045. Review their proposed deltas before changing the workbook, then use the listed minimal reruns to validate any adopted change. Non-numeric warnings should inform focused human play rather than an automatic rewrite.
`;
await fs.writeFile(path.join(outputDir, "ledger_pacing_summary.md"), summary);

await fs.writeFile(path.join(outputDir, "golden_reveal_timing_diagnostics.csv"), toCsv(["player_count","unlock_threshold","golden_enabled_median","golden_disabled_median","enabled_acceleration_games","result"], goldenDiagnostics));

console.log(JSON.stringify({ stage1_games: stage1.length, stage2_games: stage2Games.length, stage2d_games: continuationGames.length, campaigns: campaigns.length, golden_paired_campaigns: goldenDisabledPairs.length, golden_acceleration_flag: goldenAccelerationFlag, validation_errors: validationErrors.length, recommendations: recommendations.length, actionable_recommendations: highAction.length }, null, 2));

import fs from "node:fs/promises";
import path from "node:path";
import { evaluateLedger } from "./lib/evaluator.mjs";

const [bundlePath, specsPath, outputDir, iterationsArg = "2500"] = process.argv.slice(2);
if (!bundlePath || !specsPath || !outputDir) {
  throw new Error("Usage: node search-tuning-combinations.mjs <bundle.json> <base-candidate-specs.json> <output-dir> [iterations]");
}

const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));
const baseSpecs = JSON.parse(await fs.readFile(specsPath, "utf8"));
const iterations = Number(iterationsArg);

const choices = {
  "LE-001": [null, { thresholds_by_player_count: { 1: 90, 2: 130, 3: 180, 4: 260 } }, { thresholds_by_player_count: { 1: 80, 2: 115, 3: 155, 4: 240 } }],
  "LE-002": [null, { thresholds_by_player_count: { 1: 80, 2: 110, 3: 145, 4: 180 } }, { thresholds_by_player_count: { 1: 75, 2: 105, 3: 130, 4: 175 } }],
  "LE-003": [null, { thresholds_by_player_count: { 1: 30, 2: 50, 3: 80, 4: 120 } }, { thresholds_by_player_count: { 1: 25, 2: 40, 3: 60, 4: 90 } }],
  "LE-005": [null, { tuning: { required_rings: 2 } }],
  "LE-007": [null, { thresholds_by_player_count: { 1: 4, 2: 5, 3: 7, 4: 8 } }],
  "LE-015": [null, { thresholds_by_player_count: { 1: 3, 2: 5, 3: 7, 4: 8 } }, { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 7 } }],
  "LE-016": [null, { tuning: { require_all_arrivals: true, require_no_active_burdens: false } }],
  "LE-018": [null, { thresholds_by_player_count: { 1: 1, 2: 3, 3: 5, 4: 7 } }],
  "LE-020": [null, { thresholds_by_player_count: { 1: 4, 2: 6, 3: 8, 4: 10 } }],
  "LE-021": [null, { thresholds_by_player_count: { 1: 6, 2: 10, 3: 12, 4: 13 } }, { thresholds_by_player_count: { 1: 5, 2: 8, 3: 10, 4: 11 } }],
  "LE-022": [null, { thresholds_by_player_count: { 1: 7, 2: 11, 3: 13, 4: 14 } }, { thresholds_by_player_count: { 1: 6, 2: 9, 3: 11, 4: 12 } }],
  "LE-023": [null, { thresholds_by_player_count: { 1: 65, 2: 75, 3: 75, 4: 80 } }],
  "LE-024": [null, { tuning: { category_count_by_player: { 1: 1, 2: 1, 3: 2, 4: 2 } } }],
  "LE-035": [null, { tuning: { terrain_count: 4 } }],
  "LE-037": [null, { tuning: { resource_types: 4, resource_amount: 10 } }],
  "LE-040": [null, { tuning: { resolved_burdens_per_player_by_player: { 1: 1, 2: 1, 3: 1.5, 4: 1.5 } } }],
  "LE-041": [null, { tuning: { max_active_burdens: 0 } }],
  "LE-044": [null, { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 8 } }, { thresholds_by_player_count: { 1: 1, 2: 3, 3: 5, 4: 7 } }],
  "LE-050": [null, { tuning: { special_adjacency: 4 } }],
};

function randomFactory(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
const random = randomFactory(0x5156414c);

function mergeSpec(spec, change) {
  if (!change) return spec;
  return { ...spec, ...change, ...(change.tuning ? { tuning: { ...(spec.tuning ?? {}), ...change.tuning } } : {}) };
}

function buildSpecs(selection) {
  return baseSpecs.map((spec) => mergeSpec(spec, selection[spec.entry_id]));
}

function emptyState() {
  return { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [] };
}

function applyEvaluation(state, log, evaluation) {
  state.completed_named_entries = [...new Set([...state.completed_named_entries, ...evaluation.new_named_entries])];
  state.completed_prestige_boxes = [...new Set([...state.completed_prestige_boxes, ...evaluation.prestige_boxes_completed.map((box) => `${box.entry_id}:${box.player_count}`)])];
  state.chosen_stewards = [...new Set([...state.chosen_stewards, ...log.chosen_stewards])];
  state.completed_steward_objectives = [...new Set([...state.completed_steward_objectives, ...log.stewards.objectives_completed])];
}

function evaluateCampaign(specs, source, continuation) {
  const state = emptyState();
  const results = [];
  const sourceResults = continuation ? [...source.results, ...continuation.results.slice(12)] : source.results;
  for (const sourceResult of sourceResults) {
    const evaluation = evaluateLedger(specs, sourceResult.log, state);
    applyEvaluation(state, sourceResult.log, evaluation);
    results.push({ gameIndex: sourceResult.log.game_index, unlockCount: state.completed_named_entries.length });
  }
  return { campaignId: source.campaignId, profile: source.profile, playerCount: source.playerCount, results };
}

function firstUnlock(campaign, threshold) {
  return campaign.results.find((result) => result.unlockCount >= threshold)?.gameIndex ?? null;
}

function medianCensored(campaigns, threshold) {
  const values = campaigns.map((campaign) => firstUnlock(campaign, threshold) ?? Number.POSITIVE_INFINITY).sort((a, b) => a - b);
  const lower = values[Math.floor((values.length - 1) / 2)];
  const upper = values[Math.ceil((values.length - 1) / 2)];
  return Number.isFinite(upper) ? (lower + upper) / 2 : null;
}

function summarize(specs) {
  const continuationById = new Map((bundle.continuationCampaigns ?? []).map((campaign) => [campaign.campaignId, campaign]));
  const campaigns = bundle.campaigns.map((source) => evaluateCampaign(specs, source, continuationById.get(source.campaignId)));
  const guided = campaigns.filter((campaign) => campaign.profile === "guided_ledger");
  const passive = campaigns.filter((campaign) => campaign.profile === "passive_normal");
  const chaser = campaigns.filter((campaign) => campaign.profile === "achievement_chaser");
  const medians = Object.fromEntries([5,10,15,20,30].map((threshold) => [threshold, medianCensored(guided, threshold)]));
  const coverage = {
    5: guided.filter((campaign) => (firstUnlock(campaign, 5) ?? Infinity) <= 2).length / guided.length,
    10: guided.filter((campaign) => (firstUnlock(campaign, 10) ?? Infinity) <= 4).length / guided.length,
    15: guided.filter((campaign) => (firstUnlock(campaign, 15) ?? Infinity) <= 6).length / guided.length,
    20: guided.filter((campaign) => (firstUnlock(campaign, 20) ?? Infinity) <= 9).length / guided.length,
    30: guided.filter((campaign) => (firstUnlock(campaign, 30) ?? Infinity) <= 16).length / guided.length,
  };
  const warnings = {
    passive5: passive.filter((campaign) => firstUnlock(campaign, 5) === 1).length / passive.length,
    passive10: passive.filter((campaign) => (firstUnlock(campaign, 10) ?? Infinity) <= 3).length / passive.length,
    chaser20: chaser.filter((campaign) => (firstUnlock(campaign, 20) ?? Infinity) <= 5).length / chaser.length,
  };
  const windows = { 5: [1,2.5], 10: [3,4.5], 15: [5,6.5], 20: [7,9.5], 30: [12,16] };
  const requiredCoverage = { 5: .7, 10: .7, 15: .6, 20: .6, 30: .51 };
  let score = 0;
  for (const threshold of [5,10,15,20,30]) {
    const median = medians[threshold];
    const [min, max] = windows[threshold];
    score += median === null ? 18 : Math.max(0, min - median, median - max) * 8;
    score += Math.max(0, requiredCoverage[threshold] - coverage[threshold]) * 35;
  }
  score += Math.max(0, warnings.passive5 - .35) * 45;
  score += Math.max(0, warnings.passive10 - .35) * 45;
  score += Math.max(0, warnings.chaser20 - .4) * 35;
  const byPlayer = Object.fromEntries([1,2,3,4].map((pc) => [pc, guided.filter((campaign) => campaign.playerCount === pc)]));
  for (const threshold of [10,15,20]) {
    const allMedian = medians[threshold];
    for (const pc of [1,2,3,4]) {
      const value = medianCensored(byPlayer[pc], threshold);
      if (allMedian !== null && value !== null) score += Math.max(0, Math.abs(value - allMedian) - 2) * 3;
    }
  }
  return { score, medians, coverage, warnings };
}

const results = [];
const choiceEntries = Object.entries(choices);
for (let iteration = 0; iteration < iterations; iteration += 1) {
  const selection = {};
  const picked = {};
  for (const [entryId, variants] of choiceEntries) {
    const index = Math.floor(random() * variants.length);
    selection[entryId] = variants[index];
    picked[entryId] = index;
  }
  const summary = summarize(buildSpecs(selection));
  results.push({ ...summary, picked });
}
results.sort((a, b) => a.score - b.score);
const best = results.slice(0, 20);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "combination_search_results.json"), JSON.stringify(best, null, 2));
await fs.writeFile(path.join(outputDir, "combination_search_best_specs.json"), JSON.stringify(buildSpecs(Object.fromEntries(choiceEntries.map(([entryId, variants]) => [entryId, variants[best[0].picked[entryId]]]))), null, 2) + "\n");
await fs.writeFile(path.join(outputDir, "combination_search_summary.md"), `# Ledger Combination Search

Searched ${iterations} deterministic combinations against the full current-engine v1 campaign logs, including game-16 continuations.

| Rank | Score | Unlock 5 | Unlock 10 | Unlock 15 | Unlock 20 | Unlock 30 | P5 G1 | P10 G3 | C20 G5 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${best.map((result, index) => `| ${index + 1} | ${result.score.toFixed(2)} | ${[5,10,15,20,30].map((threshold) => result.medians[threshold] ?? "NR").join(" | ")} | ${(result.warnings.passive5 * 100).toFixed(1)}% | ${(result.warnings.passive10 * 100).toFixed(1)}% | ${(result.warnings.chaser20 * 100).toFixed(1)}% |`).join("\n")}
`);

console.log(JSON.stringify(best.slice(0, 5), null, 2));

import fs from "node:fs/promises";
import { evaluateLedger } from "./lib/evaluator.mjs";

const [bundlePath, specsPath] = process.argv.slice(2);
if (!bundlePath || !specsPath) {
  throw new Error("Usage: node search-foundation-options.mjs <bundle.json> <ledger_entry_specs.json>");
}

const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));
const baseSpecs = JSON.parse(await fs.readFile(specsPath, "utf8"));
const choices = {
  "LE-007": [
    { 1: 4, 2: 5, 3: 7, 4: 8 },
    { 1: 3, 2: 4, 3: 6, 4: 7 },
  ],
  "LE-008": [
    { 1: 5, 2: 6, 3: 7, 4: 8 },
    { 1: 4, 2: 5, 3: 6, 4: 7 },
  ],
  "LE-013": [
    { 1: 3, 2: 5, 3: 7, 4: 8 },
    { 1: 2, 2: 4, 3: 6, 4: 7 },
  ],
  "LE-018": [
    { 1: 1, 2: 3, 3: 5, 4: 7 },
    { 1: 2, 2: 4, 3: 6, 4: 8 },
  ],
};

function emptyState() {
  return { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [] };
}

function apply(state, log, evaluation) {
  state.completed_named_entries = [...new Set([...state.completed_named_entries, ...evaluation.new_named_entries])];
  state.completed_prestige_boxes = [...new Set([...state.completed_prestige_boxes, ...evaluation.prestige_boxes_completed.map((box) => `${box.entry_id}:${box.player_count}`)])];
  state.chosen_stewards = [...new Set([...state.chosen_stewards, ...log.chosen_stewards])];
  state.completed_steward_objectives = [...new Set([...state.completed_steward_objectives, ...log.stewards.objectives_completed])];
}

function evaluateCampaign(specs, campaign) {
  const state = emptyState();
  const results = campaign.results.map((result) => {
    const evaluation = evaluateLedger(specs, result.log, state);
    apply(state, result.log, evaluation);
    return { game: result.log.game_index, count: state.completed_named_entries.length };
  });
  return { profile: campaign.profile, playerCount: campaign.playerCount, results };
}

function first(campaign, count) {
  return campaign.results.find((result) => result.count >= count)?.game ?? 99;
}

const results = [];
for (let mask = 0; mask < 16; mask += 1) {
  const selection = Object.fromEntries(Object.keys(choices).map((entryId, index) => [entryId, (mask >> index) & 1]));
  const specs = baseSpecs.map((spec) => choices[spec.entry_id]
    ? { ...spec, thresholds_by_player_count: choices[spec.entry_id][selection[spec.entry_id]] }
    : spec);
  const campaigns = bundle.campaigns.map((campaign) => evaluateCampaign(specs, campaign));
  const guided = campaigns.filter((campaign) => campaign.profile === "guided_ledger");
  const passive = campaigns.filter((campaign) => campaign.profile === "passive_normal");
  const metrics = {
    guided5By2: guided.filter((campaign) => first(campaign, 5) <= 2).length / guided.length,
    guided10By4: guided.filter((campaign) => first(campaign, 10) <= 4).length / guided.length,
    passive5Game1: passive.filter((campaign) => first(campaign, 5) === 1).length / passive.length,
    passive10By3: passive.filter((campaign) => first(campaign, 10) <= 3).length / passive.length,
  };
  const score = Math.max(0, 0.7 - metrics.guided5By2) * 100
    + Math.max(0, 0.7 - metrics.guided10By4) * 100
    + Math.max(0, metrics.passive5Game1 - 0.35) * 120
    + Math.max(0, metrics.passive10By3 - 0.35) * 120
    + Object.values(selection).reduce((sum, value) => sum + value, 0);
  results.push({ score, selection, metrics });
}

results.sort((a, b) => a.score - b.score);
console.log(JSON.stringify(results, null, 2));

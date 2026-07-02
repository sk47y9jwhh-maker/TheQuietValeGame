import fs from "node:fs/promises";
import path from "node:path";
import { evaluateLedger } from "./lib/evaluator.mjs";

const [bundlePath, specsPath, outputPath] = process.argv.slice(2);
if (!bundlePath || !specsPath || !outputPath) {
  throw new Error("Usage: node reevaluate-bundle.mjs <source-bundle.json> <ledger_entry_specs.json> <output.json>");
}

const source = JSON.parse(await fs.readFile(bundlePath, "utf8"));
const specs = JSON.parse(await fs.readFile(specsPath, "utf8"));
const specsById = new Map(specs.map((spec) => [spec.entry_id, spec]));

function emptyState() {
  return { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [] };
}

function applyResult(state, log, evaluation) {
  state.completed_named_entries = [...new Set([...state.completed_named_entries, ...evaluation.new_named_entries])];
  state.completed_prestige_boxes = [...new Set([...state.completed_prestige_boxes, ...evaluation.prestige_boxes_completed.map((box) => `${box.entry_id}:${box.player_count}`)])];
  state.chosen_stewards = [...new Set([...state.chosen_stewards, ...log.chosen_stewards])];
  state.completed_steward_objectives = [...new Set([...state.completed_steward_objectives, ...log.stewards.objectives_completed])];
}

function reevaluateResult(sourceResult, state) {
  const log = structuredClone(sourceResult.log);
  log.declared_vows = (log.targeted_ledger_entries ?? [])
    .filter((entryId) => specsById.get(entryId)?.gates.declared_vow_required)
    .slice(0, 1);
  log.unlock_count_start = state.completed_named_entries.length;
  const evaluation = evaluateLedger(specs, log, state);
  log.unlock_count_end = state.completed_named_entries.length + evaluation.new_named_entries.length;
  applyResult(state, log, evaluation);
  return { ...sourceResult, log, evaluation };
}

const stage1 = source.stage1.map((sourceResult) => reevaluateResult(sourceResult, emptyState()));
const campaigns = source.campaigns.map((campaign) => {
  const state = emptyState();
  const results = campaign.results.map((result) => reevaluateResult(result, state));
  return { ...campaign, state, results };
});
const campaignStateById = new Map(campaigns.map((campaign) => [campaign.campaignId, structuredClone(campaign.state)]));
const continuationCampaigns = (source.continuationCampaigns ?? []).map((campaign) => {
  const state = campaignStateById.get(campaign.campaignId) ?? emptyState();
  const baseResults = campaigns.find((candidate) => candidate.campaignId === campaign.campaignId)?.results ?? [];
  const continuation = campaign.results.slice(12).map((result) => reevaluateResult(result, state));
  return { ...campaign, state, results: [...baseResults, ...continuation] };
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify({ ...source, generatedAt: new Date().toISOString(), mode: "offline_reevaluation", stage1, campaigns, continuationCampaigns }, null, 0));

console.log(JSON.stringify({ stage1_games: stage1.length, stage2_games: campaigns.flatMap((campaign) => campaign.results).length, stage2d_games: continuationCampaigns.flatMap((campaign) => campaign.results.slice(12)).length, campaigns: campaigns.length }, null, 2));

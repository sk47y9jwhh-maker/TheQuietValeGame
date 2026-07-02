import fs from "node:fs/promises";
import path from "node:path";
import { evaluateEntry } from "./lib/evaluator.mjs";

const [bundlePath, specsPath, outputDir] = process.argv.slice(2);
if (!bundlePath || !specsPath || !outputDir) {
  throw new Error("Usage: node screen-tuning-options.mjs <bundle.json> <ledger_entry_specs.json> <output-dir>");
}

const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));
const baseSpecs = JSON.parse(await fs.readFile(specsPath, "utf8"));

const options = [
  {
    id: "targeted",
    label: "Targeted automatic-driver tightening",
    rules: {
      rings: 2,
      housing: { 1: 4, 2: 5, 3: 6, 4: 7 },
      warehouse: { 1: 61, 2: 70, 3: 77, 4: 80 },
      sentinelUpgrades: 7,
      season1Both: true,
      season2ResolvedPerPlayer: 1,
      finalActiveBurdens: 0,
      burdenFraction: 1,
      stockedTypes: 5,
      specialAdjacency: 4,
    },
  },
  {
    id: "balanced",
    label: "Balanced band-aware stagger",
    rules: {
      rings: 2,
      mixedRings: 2,
      allArrivals: true,
      strainCaps: { 1: 1, 2: 3, 3: 5, 4: 7 },
      housing: { 1: 4, 2: 5, 3: 6, 4: 7 },
      warehouse: { 1: 61, 2: 70, 3: 77, 4: 80 },
      craftMerchantCount: 2,
      sentinelUpgrades: 7,
      rangerTerrain: 5,
      quartermasterTypes: 4,
      quartermasterAmount: 8,
      season1Both: true,
      season2ResolvedPerPlayer: 1,
      finalActiveBurdens: 0,
      burdenFraction: 1,
      stockedTypes: 5,
      stapleAmount: 10,
      specialAdjacency: 4,
    },
  },
  {
    id: "strict",
    label: "Strict long-campaign stagger",
    rules: {
      rings: 2,
      mixedRings: 2,
      allArrivals: true,
      strainCaps: { 1: 0, 2: 2, 3: 4, 4: 6 },
      housing: { 1: 5, 2: 6, 3: 7, 4: 8 },
      warehouse: { 1: 61, 2: 70, 3: 77, 4: 80 },
      craftMerchantCount: 2,
      sentinelUpgrades: 8,
      rangerTerrain: 5,
      quartermasterTypes: 4,
      quartermasterAmount: 10,
      season1Both: true,
      season2ResolvedPerPlayer: 1,
      finalActiveBurdens: 0,
      finalStrainCap: 0,
      burdenFraction: 1,
      stockedTypes: 5,
      stapleAmount: 10,
      specialAdjacency: 5,
    },
  },
  {
    id: "strict_plus",
    label: "Strict stagger with specialist tightening",
    rules: {
      rings: 3,
      mixedRings: 2,
      allArrivals: true,
      strainCaps: { 1: 0, 2: 1, 3: 3, 4: 5 },
      housing: { 1: 5, 2: 7, 3: 9, 4: 11 },
      warehouse: { 1: 65, 2: 75, 3: 80, 4: 85 },
      craftMerchantCount: 2,
      sentinelUpgrades: 8,
      rangerTerrain: 5,
      quartermasterTypes: 5,
      quartermasterAmount: 10,
      season1Both: true,
      season2ResolvedPerPlayer: 1,
      finalActiveBurdens: 0,
      finalStrainCap: 0,
      burdenFraction: 1,
      stockedTypes: 6,
      stapleAmount: 12,
      specialAdjacency: 5,
    },
  },
];

const strictPlus = options.find((option) => option.id === "strict_plus");
options.push({
  id: "strict_plus_refined",
  label: "Refined strict stagger",
  rules: {
    ...strictPlus.rules,
    season2ResolvedPerPlayer: 1.5,
    noBurdenNoOverstrained: true,
    knightMaxHousingStrain: 0,
  },
});
const strictPlusRefined = options.find((option) => option.id === "strict_plus_refined");
options.push({
  id: "strict_plus_refined_2",
  label: "Refined stagger with scaled resilience records",
  rules: {
    ...strictPlusRefined.rules,
    recordStrainCaps: { 1: 0, 2: 2, 3: 4, 4: 6 },
    riverTravel: { 1: 3, 2: 4, 3: 5, 4: 6 },
    season1PerPlayer: true,
    burdenRequiresCleanBoard: true,
    travelGroup: { 1: 8, 2: 10, 3: 12, 4: 14 },
  },
});
const strictPlusRefined2 = options.find((option) => option.id === "strict_plus_refined_2");
options.push({
  id: "strict_plus_refined_3",
  label: "Refined stagger with Arrival completion guardrail",
  rules: {
    ...strictPlusRefined2.rules,
    allArrivalsNoActiveBurdens: true,
  },
});
const strictPlusRefined3 = options.find((option) => option.id === "strict_plus_refined_3");
options.push({
  id: "strict_plus_refined_4",
  label: "Final screened stagger",
  rules: {
    ...strictPlusRefined3.rules,
    riverTravel: { 1: 4, 2: 5, 3: 6, 4: 7 },
  },
});
options.push({
  id: "strict_plus_refined_5",
  label: "Final stagger with Directed Riverwork scaling",
  rules: {
    ...strictPlusRefined3.rules,
    riverTravel: { 1: 5, 2: 7, 3: 9, 4: 11 },
  },
});

function threshold(spec, playerCount) {
  return spec.thresholds_by_player_count?.[String(playerCount)] ?? null;
}

function numeric(complete, actual, required, reason) {
  return { complete, actual, required, margin: typeof actual === "number" && typeof required === "number" ? actual - required : null, reason };
}

function withThresholds(specs, rules) {
  return specs.map((spec) => {
    if (spec.entry_id === "LE-004" && rules.recordStrainCaps) return { ...spec, thresholds_by_player_count: rules.recordStrainCaps };
    if (spec.entry_id === "LE-012" && rules.riverTravel) return { ...spec, thresholds_by_player_count: rules.riverTravel };
    if (spec.entry_id === "LE-023" && rules.warehouse) return { ...spec, thresholds_by_player_count: rules.warehouse };
    if (spec.entry_id === "LE-045" && rules.stockedTypes) return { ...spec, thresholds_by_player_count: { 1: rules.stockedTypes, 2: rules.stockedTypes, 3: rules.stockedTypes, 4: rules.stockedTypes } };
    if (spec.entry_id === "LE-049" && rules.travelGroup) return { ...spec, thresholds_by_player_count: rules.travelGroup };
    return spec;
  });
}

function evaluateTuned(spec, log, campaignState, rules) {
  const base = evaluateEntry(spec, log, campaignState);
  if (base.blocked) return base;
  const d = log.board.derived_features;
  const season1 = log.season_snapshots.end_season_1;
  const season2 = log.season_snapshots.end_season_2;
  switch (spec.entry_id) {
    case "LE-005":
      return rules.rings ? numeric(d.complete_six_tile_rings.length >= rules.rings, d.complete_six_tile_rings.length, rules.rings, "complete six-tile rings") : base;
    case "LE-006":
      return rules.mixedRings ? numeric(d.qualifying_mixed_six_tile_rings.length >= rules.mixedRings, d.qualifying_mixed_six_tile_rings.length, rules.mixedRings, "qualifying mixed six-tile rings") : base;
    case "LE-016":
      if (rules.allArrivalsNoActiveBurdens) return numeric(log.encounters.arrivals_expired === 0 && log.encounters.arrivals_completed >= log.encounters.arrivals_revealed && log.final.active_burdens === 0, log.encounters.arrivals_completed, log.encounters.arrivals_revealed, "all revealed Arrivals completed with no active Burdens");
      return rules.allArrivals ? numeric(log.encounters.arrivals_expired === 0 && log.encounters.arrivals_completed >= log.encounters.arrivals_revealed, log.encounters.arrivals_completed, log.encounters.arrivals_revealed, "all revealed Arrivals completed") : base;
    case "LE-017":
      return rules.noBurdenNoOverstrained ? numeric(log.final.active_burdens === 0 && log.final.overstrained_tiles === 0, log.final.active_burdens, 0, "no active Burdens or Overstrained tiles") : base;
    case "LE-018": {
      if (!rules.strainCaps) return base;
      const required = rules.strainCaps[log.player_count];
      return numeric(log.final.overstrained_tiles === 0 && log.final.strain_tokens <= required, log.final.strain_tokens, required, "final Strain cap with no Overstrained tiles");
    }
    case "LE-020": {
      if (!rules.housing) return base;
      const required = rules.housing[log.player_count];
      return numeric(log.tile_counts.placed_housing_tiles >= required && log.support_and_strain.housing_overstrained_count === 0 && log.support_and_strain.max_strain_on_housing < 2, log.tile_counts.placed_housing_tiles, required, "Housing count with no Housing at 2+ Strain");
    }
    case "LE-024":
      return rules.craftMerchantCount ? numeric((log.tile_counts.placed_by_category.Crafting ?? 0) >= rules.craftMerchantCount && (log.tile_counts.placed_by_category.Merchant ?? 0) >= rules.craftMerchantCount, Math.min(log.tile_counts.placed_by_category.Crafting ?? 0, log.tile_counts.placed_by_category.Merchant ?? 0), rules.craftMerchantCount, "Crafting and Merchant count") : base;
    case "LE-034":
      return rules.sentinelUpgrades ? numeric(log.stewards.objectives_completed.includes("Sentinel") && log.tile_counts.upgraded_non_overstrained_core_tiles >= rules.sentinelUpgrades, log.tile_counts.upgraded_non_overstrained_core_tiles, rules.sentinelUpgrades, "Sentinel Objective and upgraded Core Tiles") : base;
    case "LE-033":
      return rules.knightMaxHousingStrain !== undefined ? numeric(log.stewards.objectives_completed.includes("Knight") && log.support_and_strain.housing_overstrained_count === 0 && log.support_and_strain.max_strain_on_housing <= rules.knightMaxHousingStrain, log.support_and_strain.max_strain_on_housing, rules.knightMaxHousingStrain, "Knight Objective and Housing Strain cap") : base;
    case "LE-035":
      return rules.rangerTerrain ? numeric(log.stewards.objectives_completed.includes("Ranger") && d.occupied_non_grasslands_non_river_terrain_types >= rules.rangerTerrain, d.occupied_non_grasslands_non_river_terrain_types, rules.rangerTerrain, "Ranger Objective and terrain spread") : base;
    case "LE-037": {
      if (!rules.quartermasterTypes) return base;
      const actual = Object.values(log.final.warehouse_by_resource).filter((value) => value >= rules.quartermasterAmount).length;
      return numeric(log.stewards.objectives_completed.includes("Quartermaster") && actual >= rules.quartermasterTypes, actual, rules.quartermasterTypes, "Quartermaster Objective and stocked resource types");
    }
    case "LE-039":
      if (rules.season1PerPlayer) return numeric(season1.overstrained_tiles === 0 && season1.arrivals_completed_this_season >= log.player_count && season1.burdens_resolved_this_season >= log.player_count, Math.min(season1.arrivals_completed_this_season, season1.burdens_resolved_this_season), log.player_count, "Season I scaled Arrival and Burden progress");
      return rules.season1Both ? numeric(season1.overstrained_tiles === 0 && season1.arrivals_completed_this_season >= 1 && season1.burdens_resolved_this_season >= 1, Math.min(season1.arrivals_completed_this_season, season1.burdens_resolved_this_season), 1, "Season I Arrival and Burden progress") : base;
    case "LE-040": {
      if (!rules.season2ResolvedPerPlayer) return base;
      const required = Math.ceil(log.player_count * rules.season2ResolvedPerPlayer);
      return numeric(season2.overstrained_tiles === 0 && season2.active_burdens === 0 && season2.burdens_resolved_this_season >= required, season2.burdens_resolved_this_season, required, "Season II clean board and Burdens resolved") ;
    }
    case "LE-041": {
      if (rules.finalActiveBurdens === undefined) return base;
      const strainOkay = rules.finalStrainCap === undefined || log.final.strain_tokens <= rules.finalStrainCap;
      return numeric(log.final.overstrained_tiles === 0 && log.final.active_burdens <= rules.finalActiveBurdens && strainOkay, log.final.active_burdens, rules.finalActiveBurdens, "final clean Burden state");
    }
    case "LE-043": {
      if (!rules.burdenFraction) return base;
      const required = Math.ceil(log.encounters.burdens_revealed * rules.burdenFraction);
      const cleanEnough = !rules.burdenRequiresCleanBoard || log.final.overstrained_tiles === 0;
      return numeric(log.encounters.burdens_revealed >= 2 && log.encounters.burdens_resolved_or_removed >= required && cleanEnough, log.encounters.burdens_resolved_or_removed, required, "Burdens resolved or removed") ;
    }
    case "LE-047":
      return rules.stapleAmount ? numeric(["Wood", "Stone", "Food"].every((resource) => log.final.warehouse_by_resource[resource] >= rules.stapleAmount), Math.min(log.final.warehouse_by_resource.Wood, log.final.warehouse_by_resource.Stone, log.final.warehouse_by_resource.Food), rules.stapleAmount, "Wood, Stone, and Food stock") : base;
    case "LE-050":
      return rules.specialAdjacency ? numeric(d.special_tiles_adjacent_to_housing >= rules.specialAdjacency, d.special_tiles_adjacent_to_housing, rules.specialAdjacency, "Special Tiles adjacent to Housing") : base;
    default:
      return base;
  }
}

function simulateEvaluation(option) {
  const specs = withThresholds(baseSpecs, option.rules);
  const campaigns = [];
  for (const source of bundle.campaigns) {
    const state = { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [] };
    const results = [];
    for (const sourceResult of source.results) {
      const entryResults = Object.fromEntries(specs.map((spec) => [spec.entry_id, evaluateTuned(spec, sourceResult.log, state, option.rules)]));
      const newlyCompleted = specs.filter((spec) => entryResults[spec.entry_id].complete && !state.completed_named_entries.includes(spec.entry_id)).map((spec) => spec.entry_id);
      state.completed_named_entries = [...state.completed_named_entries, ...newlyCompleted];
      state.chosen_stewards = [...new Set([...state.chosen_stewards, ...sourceResult.log.chosen_stewards])];
      state.completed_steward_objectives = [...new Set([...state.completed_steward_objectives, ...sourceResult.log.stewards.objectives_completed])];
      results.push({ gameIndex: sourceResult.log.game_index, unlockCount: state.completed_named_entries.length, newEntries: newlyCompleted, entryResults });
    }
    campaigns.push({ campaignId: source.campaignId, profile: source.profile, playerCount: source.playerCount, results });
  }
  return campaigns;
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

function format(value) {
  return value === null ? "NR" : Number(value).toFixed(1).replace(/\.0$/, "");
}

function pct(value) {
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

function summarize(option, campaigns) {
  const guided = campaigns.filter((campaign) => campaign.profile === "guided_ledger");
  const passive = campaigns.filter((campaign) => campaign.profile === "passive_normal");
  const chaser = campaigns.filter((campaign) => campaign.profile === "achievement_chaser");
  const medians = Object.fromEntries([5, 10, 15, 20, 30].map((threshold) => [threshold, medianCensored(guided, threshold)]));
  const passiveMeanFirst = passive.reduce((sum, campaign) => sum + campaign.results[0].unlockCount, 0) / passive.length;
  const passive5Game1 = passive.filter((campaign) => firstUnlock(campaign, 5) === 1).length / passive.length;
  const passive10Game3 = passive.filter((campaign) => { const game = firstUnlock(campaign, 10); return game !== null && game <= 3; }).length / passive.length;
  const chaser20Game5 = chaser.filter((campaign) => { const game = firstUnlock(campaign, 20); return game !== null && game <= 5; }).length / chaser.length;
  const entryFirstGameRates = Object.fromEntries(baseSpecs.map((spec) => [
    spec.entry_id,
    passive.filter((campaign) => campaign.results[0].entryResults[spec.entry_id].complete).length / passive.length,
  ]));
  const passiveNewEntryRatesByGame = Object.fromEntries(baseSpecs.map((spec) => [
    spec.entry_id,
    Object.fromEntries([1, 2, 3].map((gameIndex) => [
      gameIndex,
      passive.filter((campaign) => campaign.results.find((result) => result.gameIndex === gameIndex)?.newEntries.includes(spec.entry_id)).length / passive.length,
    ])),
  ]));
  const passiveCampaignCounts = passive.map((campaign) => ({
    campaignId: campaign.campaignId,
    game1: campaign.results[0].unlockCount,
    game3: campaign.results.find((result) => result.gameIndex === 3)?.unlockCount ?? null,
    entriesBy3: [...new Set(campaign.results.filter((result) => result.gameIndex <= 3).flatMap((result) => result.newEntries))],
  }));
  const target = { 5: 2, 10: 3.5, 15: 5.5, 20: 8, 30: 12 };
  const distance = Object.entries(target).reduce((sum, [key, value]) => sum + (medians[key] === null ? 8 : Math.abs(medians[key] - value)), 0);
  const warningPenalty = passive5Game1 * 5 + passive10Game3 * 5 + chaser20Game5 * 3;
  return { option, campaigns, medians, passiveMeanFirst, passive5Game1, passive10Game3, chaser20Game5, entryFirstGameRates, passiveNewEntryRatesByGame, passiveCampaignCounts, score: distance + warningPenalty };
}

const summaries = options.map((option) => summarize(option, simulateEvaluation(option))).sort((a, b) => a.score - b.score);

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "tuning_option_screen.json"), JSON.stringify(summaries.map(({ campaigns, ...summary }) => summary), null, 2));
await fs.writeFile(path.join(outputDir, "tuning_option_screen.md"), `# Ledger Tuning Option Screen

This is a deterministic re-evaluation of existing current-engine logs. It is a screening step only; selected options require fresh simulation because Guided target choices can change.

| Option | Unlock 5 | Unlock 10 | Unlock 15 | Unlock 20 | Unlock 30 | Passive G1 mean | Passive 5 in G1 | Passive 10 by G3 | Chaser 20 by G5 | Screen score |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${summaries.map((summary) => `| ${summary.option.id} | ${[5,10,15,20,30].map((threshold) => format(summary.medians[threshold])).join(" | ")} | ${format(summary.passiveMeanFirst)} | ${pct(summary.passive5Game1)} | ${pct(summary.passive10Game3)} | ${pct(summary.chaser20Game5)} | ${format(summary.score)} |`).join("\n")}

## Option Definitions

${summaries.map((summary) => `### ${summary.option.id}: ${summary.option.label}\n\n\`${JSON.stringify(summary.option.rules)}\``).join("\n\n")}
`);

console.log(JSON.stringify(summaries.map((summary) => ({ id: summary.option.id, medians: summary.medians, passiveMeanFirst: summary.passiveMeanFirst, passive5Game1: summary.passive5Game1, passive10Game3: summary.passive10Game3, chaser20Game5: summary.chaser20Game5, score: summary.score })), null, 2));

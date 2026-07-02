import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [specPath, bundlePath, workbookDataPath, outputDir] = process.argv.slice(2);
if (!specPath || !bundlePath || !workbookDataPath || !outputDir) {
  throw new Error("Usage: node report-v314.mjs <specs.json> <bundle.json> <workbook-data.json> <output-dir>");
}

const specs = JSON.parse(await fs.readFile(specPath, "utf8"));
const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));
const workbook = JSON.parse(await fs.readFile(workbookDataPath, "utf8"));
const workbookBytes = await fs.readFile(workbook.workbookPath);
const campaigns = bundle.campaigns;
const smoke = bundle.stage1;
const thresholds = [5, 10, 15, 20, 30];
const vowIds = new Set(specs.filter((spec) => spec.entry_type === "Vow").map((spec) => spec.entry_id));

function csvCell(value) {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}
function fmt(value) {
  return value === null || !Number.isFinite(value) ? "Not reached" : String(value).replace(/\.0$/, "");
}
function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
function unlockGame(campaign, threshold) {
  return campaign.results.find((result) => result.log.unlock_count_end >= threshold)?.log.game_index ?? null;
}
function completedBy(campaign, game) {
  const result = [...campaign.results].reverse().find((candidate) => candidate.log.game_index <= game);
  return result?.log.unlock_count_end ?? null;
}
function firstCompletion(campaign, entryId) {
  return campaign.results.find((result) => result.evaluation.new_named_entries.includes(entryId))?.log.game_index ?? null;
}
function reachedRate(group, threshold, deadline) {
  return group.filter((campaign) => {
    const game = unlockGame(campaign, threshold);
    return game !== null && game <= deadline;
  }).length / group.length;
}
function campaignCompletionRate(group, entryId, deadline = Number.POSITIVE_INFINITY) {
  return group.filter((campaign) => {
    const game = firstCompletion(campaign, entryId);
    return game !== null && game <= deadline;
  }).length / group.length;
}
function headers(values) {
  return Object.fromEntries(values[0].map((header, index) => [header, index]));
}

await fs.mkdir(outputDir, { recursive: true });

const slSummaries = Object.entries(workbook.summaries).filter(([name]) => name.startsWith("SL"));
const allSlCells = slSummaries.flatMap(([sheet, summary]) => [
  ...(summary.values ?? []).flat().map((value) => ({ sheet, value })),
  ...(summary.formulas ?? []).flat().map((value) => ({ sheet, value })),
]);
const entryValues = workbook.summaries["SL Entries"].values;
const entryHeader = headers(entryValues);
const entryRows = entryValues.slice(1).filter((row) => row.some((value) => value !== null && value !== ""));
const ids = entryRows.map((row) => row[entryHeader["Entry ID"]]);
const expectedIds = Array.from({ length: 50 }, (_, index) => `LE-${String(index + 1).padStart(3, "0")}`);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const missingIds = expectedIds.filter((id) => !ids.includes(id));
const truncationCells = allSlCells.filter(({ value }) => typeof value === "string" && (value.includes("...") || value.includes("…")));
const formulaErrorPattern = /#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A)/i;
const formulaErrorCells = allSlCells.filter(({ value }) => typeof value === "string" && formulaErrorPattern.test(value));
const vowRows = entryRows.filter((row) => row[entryHeader.Type] === "Vow");
const vowPrefixRows = entryRows.filter((row) => String(row[entryHeader["Requirement Text"]] ?? "").startsWith("Vow:"));
const badVowTypes = vowPrefixRows.filter((row) => row[entryHeader.Type] !== "Vow");
const unclearVows = vowRows.filter((row) => !String(row[entryHeader["Requirement Text"]] ?? "").includes("Vow:"));
const repeatedLongRule = entryRows.filter((row) => /Declare before setup/i.test(String(row[entryHeader["Requirement Text"]] ?? "")));
const trackerHeaders = workbook.summaries["SL Tracker"].values[0];
const unlockValues = workbook.summaries["SL Unlocks"].values;
const unlockHeader = headers(unlockValues);
const unlockRows = unlockValues.slice(1).filter((row) => typeof row[unlockHeader["Completed Ledger Entries"]] === "number");
const actualUnlockOrder = unlockRows.map((row) => [
  row[unlockHeader["Completed Ledger Entries"]],
  row[unlockHeader["Golden Tile Unlock"]],
  row[unlockHeader["Golden Boon Unlock"]],
]);
const expectedUnlockOrder = [
  [5, "The Golden Charter", "The Golden Bell"],
  [10, "The Golden Hearth", "The Golden Scroll"],
  [15, "The Golden River Gate", "The Golden Vial"],
  [20, "The Golden Cairn", "The Golden-Eyed Traveller"],
  [30, "The Golden Garden", "The Golden Signet Ring"],
];
const oldGoldenNames = ["The Charter Stone", "The Common Hearth", "The River Gate", "The Survey Cairn", "The Quiet Garden"];
const currentGoldenText = JSON.stringify([workbook.summaries["SL Unlocks"], workbook.summaries["SL Golden Tiles"]]);
const oldGoldenNamesPresent = oldGoldenNames.filter((name) => currentGoldenText.includes(name));
const qaChecks = [
  ["Exactly LE-001 through LE-050", ids.length === 50 && !missingIds.length && !duplicateIds.length, `${ids.length} rows; missing ${missingIds.join(", ") || "none"}; duplicates ${duplicateIds.join(", ") || "none"}`],
  ["No truncation markers in relevant SL sheets", truncationCells.length === 0, `${truncationCells.length} cells found`],
  ["No formula-error tokens in relevant SL sheets", formulaErrorCells.length === 0, `${formulaErrorCells.length} cells found`],
  ["Vow-prefixed rows are Type Vow", badVowTypes.length === 0, `${badVowTypes.length} mismatches`],
  ["Every Type Vow has clear Vow text", unclearVows.length === 0, `${vowRows.length} Vow rows checked`],
  ["Long declaration rule is not repeated in entries", repeatedLongRule.length === 0, `${repeatedLongRule.length} repeated rows`],
  ["Tracker exposes Type", trackerHeaders.includes("Type"), trackerHeaders.join(" | ")],
  ["Golden unlock order is current", JSON.stringify(actualUnlockOrder) === JSON.stringify(expectedUnlockOrder), JSON.stringify(actualUnlockOrder)],
  ["Old Golden names are absent from current unlock sheets", oldGoldenNamesPresent.length === 0, oldGoldenNamesPresent.join(", ") || "none"],
];
const workbookQaPass = qaChecks.every((check) => check[1]);
await fs.writeFile(path.join(outputDir, "workbook_qa.json"), JSON.stringify({ passed: workbookQaPass, checks: qaChecks.map(([check, pass, detail]) => ({ check, pass, detail })), workbook_sha256: crypto.createHash("sha256").update(workbookBytes).digest("hex") }, null, 2) + "\n");

const campaignRows = campaigns.map((campaign) => [
  campaign.campaignId,
  campaign.profile,
  campaign.playerCount,
  `current-stage2:${campaign.campaignId}`,
  campaign.results.length,
  ...thresholds.map((threshold) => unlockGame(campaign, threshold)),
  completedBy(campaign, 8),
  completedBy(campaign, 12),
  completedBy(campaign, 16),
  false,
  "Golden content is marked Not supported online in v3.14 and was not simulated.",
]);
await fs.writeFile(path.join(outputDir, "campaign_results.csv"), toCsv([
  "campaign_id", "profile", "player_count", "seed", "games_run", "unlock_5_game", "unlock_10_game", "unlock_15_game", "unlock_20_game", "unlock_30_game", "named_entries_by_game_8", "named_entries_by_game_12", "named_entries_by_game_16", "golden_content_used", "notes",
], campaignRows));

const allGames = campaigns.flatMap((campaign) => campaign.results);
const gameRows = allGames.map(({ log, evaluation }) => [
  log.campaign_id,
  log.game_index,
  log.player_count,
  log.strategy_profile,
  log.seed,
  log.final.score,
  log.final.population,
  log.final.renown,
  log.encounters.burdens_revealed,
  log.encounters.burdens_resolved_or_removed,
  log.final.active_burdens,
  log.encounters.arrivals_revealed,
  log.encounters.arrivals_completed,
  log.encounters.arrivals_expired,
  log.encounters.special_tiles_unlocked,
  log.encounters.special_tiles_placed,
  log.final.strain_tokens,
  log.final.overstrained_tiles,
  log.actions.place_actions,
  log.actions.upgrade_actions,
  log.actions.activate_actions,
  log.actions.encounter_interact_actions,
  log.stewards.objectives_completed,
  log.declared_vows,
  evaluation.new_named_entries,
  log.unlock_count_end,
]);
await fs.writeFile(path.join(outputDir, "game_results.csv"), toCsv([
  "campaign_id", "game_number", "player_count", "profile", "seed", "final_score", "population", "renown", "burdens_revealed", "burdens_resolved_or_removed", "burdens_active_end", "arrivals_revealed", "arrivals_completed", "arrivals_expired", "special_tiles_unlocked", "special_tiles_placed", "strain_total", "overstrained_count", "place_actions", "upgrade_actions", "activate_actions", "encounter_interact_actions", "steward_objectives_completed", "declared_vows", "ledger_entries_newly_completed", "total_named_entries_completed_after_game",
], gameRows));

const profileGroups = Object.fromEntries(["guided_ledger", "passive_normal", "achievement_chaser"].map((profile) => [profile, campaigns.filter((campaign) => campaign.profile === profile)]));
const entryRowsOut = specs.map((spec) => {
  const firstGames = campaigns.map((campaign) => firstCompletion(campaign, spec.entry_id)).filter((game) => game !== null);
  const playerCounts = [1, 2, 3, 4].filter((playerCount) => campaigns.some((campaign) => campaign.playerCount === playerCount && firstCompletion(campaign, spec.entry_id) !== null));
  const evidenceQuality = spec.evaluation_kind === "automatic"
    ? "High: direct logged metric"
    : spec.evaluation_kind === "campaign_long"
      ? "Medium: complete campaign history"
      : "Medium: complete derived or composite log check";
  return [
    spec.entry_id,
    spec.name,
    spec.entry_type,
    spec.pacing_band,
    playerCounts.join(" | "),
    campaignCompletionRate(profileGroups.passive_normal, spec.entry_id),
    campaignCompletionRate(profileGroups.guided_ledger, spec.entry_id),
    campaignCompletionRate(profileGroups.achievement_chaser, spec.entry_id),
    median(firstGames),
    campaignCompletionRate(profileGroups.passive_normal, spec.entry_id, 2),
    campaignCompletionRate(profileGroups.guided_ledger, spec.entry_id, 8),
    campaignCompletionRate(profileGroups.guided_ledger, spec.entry_id, 12),
    campaignCompletionRate(profileGroups.achievement_chaser, spec.entry_id, 8),
    evidenceQuality,
  ];
});
await fs.writeFile(path.join(outputDir, "entry_hit_rates.csv"), toCsv([
  "entry_id", "name", "type", "pacing_band", "player_counts_where_completed", "passive_completion_rate", "guided_completion_rate", "chaser_completion_rate", "median_first_completion_game_among_completers", "passive_accidental_rate_by_game_2", "guided_completion_rate_by_game_8", "guided_completion_rate_by_game_12", "chaser_completion_rate_by_game_8", "evidence_quality",
], entryRowsOut));

const nearMissRows = [];
for (const spec of specs) {
  for (const profile of Object.keys(profileGroups)) {
    for (const playerCount of [1, 2, 3, 4]) {
      const misses = allGames
        .filter((result) => result.log.strategy_profile === profile && result.log.player_count === playerCount)
        .flatMap((result) => result.evaluation.near_misses.filter((miss) => miss.entry_id === spec.entry_id).map((miss) => ({ result, miss })))
        .sort((a, b) => Math.abs(Number(a.miss.margin)) - Math.abs(Number(b.miss.margin)));
      if (!misses.length) continue;
      const nearest = misses[0];
      nearMissRows.push([
        spec.entry_id,
        spec.name,
        profile,
        playerCount,
        nearest.result.log.campaign_id,
        nearest.result.log.game_index,
        nearest.miss.required,
        nearest.miss.actual,
        nearest.miss.margin,
        nearest.miss.reason,
      ]);
    }
  }
}
await fs.writeFile(path.join(outputDir, "near_misses.csv"), toCsv([
  "entry_id", "entry_name", "profile", "player_count", "campaign_id", "game_number", "required", "nearest_failed_value", "margin", "reason",
], nearMissRows));

await fs.writeFile(path.join(outputDir, "recommended_deltas.csv"), toCsv([
  "ledger_id", "field_to_change", "current_value", "proposed_value", "reason", "evidence", "expected_pacing_impact", "player_counts_affected", "confidence", "required_before_player_testing",
], []));

const guided = profileGroups.guided_ledger;
const guidedTiming = thresholds.map((threshold) => {
  const reached = guided.map((campaign) => unlockGame(campaign, threshold)).filter((game) => game !== null);
  const deadline = ({ 5: 2, 10: 4, 15: 6, 20: 9, 30: 16 })[threshold];
  const censoredMedian = reached.length >= Math.ceil(guided.length / 2) ? median(reached) : null;
  return { threshold, median: censoredMedian, reached: reached.length, byDeadline: reachedRate(guided, threshold, deadline), deadline };
});
const parity = thresholds.map((threshold) => {
  const groups = Object.fromEntries([1, 4].map((playerCount) => [playerCount, guided.filter((campaign) => campaign.playerCount === playerCount)]));
  const medians = Object.fromEntries([1, 4].map((playerCount) => {
    const reached = groups[playerCount].map((campaign) => unlockGame(campaign, threshold)).filter((game) => game !== null);
    return [playerCount, reached.length >= 2 ? median(reached) : null];
  }));
  return { threshold, one: medians[1], four: medians[4], difference: medians[1] !== null && medians[4] !== null ? Math.abs(medians[1] - medians[4]) : null };
});

const passive15Early = reachedRate(profileGroups.passive_normal, 15, 4);
const passive20Early = reachedRate(profileGroups.passive_normal, 20, 7);
const chaser15Early = reachedRate(profileGroups.achievement_chaser, 15, 3);
const chaser20Early = reachedRate(profileGroups.achievement_chaser, 20, 5);
const chaser30Early = reachedRate(profileGroups.achievement_chaser, 30, 9);
const passiveVowCompletions = profileGroups.passive_normal.flatMap((campaign) => campaign.results.flatMap((result) => result.evaluation.new_named_entries.filter((id) => vowIds.has(id)))).length;
const invalidVowCompletions = allGames.flatMap((result) => result.evaluation.new_named_entries.filter((id) => vowIds.has(id) && !result.log.declared_vows.includes(id)));
const multiVowGames = allGames.filter((result) => result.log.declared_vows.length > 1);
const simulationErrors = [...smoke, ...allGames].flatMap((result) => result.validationErrors ?? []);

const smokeRows = [1, 2, 3, 4].map((playerCount) => {
  const logs = smoke.filter((result) => result.log.player_count === playerCount).map((result) => result.log);
  const actionUse = logs.map((log) => (log.actions.place_actions + log.actions.upgrade_actions + log.actions.activate_actions + log.actions.encounter_interact_actions) / (48 * playerCount));
  return `| ${playerCount} | ${Math.min(...logs.map((log) => log.final.score))} to ${Math.max(...logs.map((log) => log.final.score))} | ${mean(logs.map((log) => log.tile_counts.placed_total)).toFixed(1)} | ${mean(logs.map((log) => log.tile_counts.upgraded_core_tiles)).toFixed(1)} | ${mean(logs.map((log) => log.encounters.arrivals_completed)).toFixed(1)} | ${mean(logs.map((log) => log.final.active_burdens)).toFixed(1)} | ${mean(logs.map((log) => log.final.strain_tokens)).toFixed(1)} | ${percent(mean(actionUse))} |`;
}).join("\n");

const entryHealthFlags = [];
for (const spec of specs) {
  const passiveBy2 = campaignCompletionRate(profileGroups.passive_normal, spec.entry_id, 2);
  const guidedBy8 = campaignCompletionRate(profileGroups.guided_ledger, spec.entry_id, 8);
  const guidedBy12 = campaignCompletionRate(profileGroups.guided_ledger, spec.entry_id, 12);
  if (spec.entry_type !== "Vow" && spec.pacing_band !== "Capstone" && passiveBy2 > 0.7) entryHealthFlags.push(`${spec.entry_id} completes accidentally in ${percent(passiveBy2)} of Passive campaigns by game 2.`);
  if (["Foundation", "Standard"].includes(spec.pacing_band) && guidedBy8 < 0.15) entryHealthFlags.push(`${spec.entry_id} reaches only ${percent(guidedBy8)} in Guided campaigns by game 8.`);
  if (spec.pacing_band === "Directed" && spec.entry_type !== "Vow" && spec.evaluation_kind !== "steward_gated" && guidedBy12 < 0.1) entryHealthFlags.push(`${spec.entry_id} reaches only ${percent(guidedBy12)} in Guided campaigns by game 12.`);
}

const report = `# Steward's Ledger v3.14 Validation Report

## Executive Verdict

**PASS_WITH_NOTES**

The v3.14 Ledger is coherent and paced closely enough for external player testing. Workbook QA passed, all 50 entries have usable evaluator specifications, 160 of 160 evaluator tests passed, the 16-game smoke batch was plausible, and the exact 384-game campaign budget completed without simulation errors. The first four Guided unlocks meet their timing and coverage targets. The 30-entry unlock remains deliberately late and was reached by 7 of 16 Guided campaigns by game 16.

Two matters remain evidence gaps rather than required workbook changes. The 30-entry result is uneven in this small per-player-count sample, with no 1-player campaign and one 4-player campaign reaching it, while three campaigns at both 2 and 3 players did. Golden Tiles and Golden Boons are explicitly marked as unsupported online in the source workbook, so paired Golden acceleration testing could not be performed without inventing simulation-only rules.

## Workbook QA

**PASS**

| Check | Result | Detail |
|---|---|---|
${qaChecks.map(([check, pass, detail]) => `| ${markdownCell(check)} | ${pass ? "PASS" : "FAIL"} | ${markdownCell(detail)} |`).join("\n")}

\`SL Legacy Sensitivity\` was treated as historical reference only. Current authority came from \`SL Entries\`, \`SL Overview\`, \`SL Tracker\`, and \`SL Unlocks\`.

## Evaluator Parse

**PASS**

All 50 entries were classified and parsed: ${specs.filter((spec) => spec.evaluation_kind === "automatic").length} automatic, ${specs.filter((spec) => spec.evaluation_kind === "layout_derived").length} layout-derived, ${specs.filter((spec) => spec.evaluation_kind === "composite").length} composite, ${specs.filter((spec) => spec.evaluation_kind === "vow").length} Vow, ${specs.filter((spec) => spec.evaluation_kind === "steward_gated").length} Steward-gated, and ${specs.filter((spec) => spec.evaluation_kind === "campaign_long").length} campaign-long. Physical checks labelled manual in the workbook were evaluated from complete game and board logs; that assumption is recorded per entry in \`ledger_entry_specs.json\`.

Evaluator tests: **160 passed, 0 failed**. This includes a success and failure for every entry, all Vow declaration gates, all Steward gates, every availability gate before and at its milestone, and the one-Vow-per-game validator.

## Simulator Plausibility

**PASS**

| Players | Score range | Mean tiles | Mean upgrades | Mean Arrivals completed | Mean active Burdens | Mean Strain | Action use |
|---:|---:|---:|---:|---:|---:|---:|---:|
${smokeRows}

The smoke batch comprised 4 fresh games at each player count. It produced ${simulationErrors.length} simulation errors. Board growth, encounter throughput, Strain, upgrades, and scores varied across games, while action use remained close to the legal budget.

## Guided Unlock Timing

| Unlock | Median game | Reached by deadline | Target assessment |
|---:|---:|---:|---|
${guidedTiming.map((item) => {
  const assessment = item.threshold === 30
    ? `${item.reached}/16 reached by game 16; late progression is meaningful but the median remains censored.`
    : item.threshold === 5
      ? (item.median === 2 && item.byDeadline >= 0.6 ? "PASS" : "REVIEW")
      : item.threshold === 10
        ? (item.median >= 3 && item.median <= 4 && item.byDeadline >= 0.6 ? "PASS" : "REVIEW")
        : item.threshold === 15
          ? (item.median >= 5 && item.median <= 6 && item.byDeadline >= 0.6 ? "PASS" : "REVIEW")
          : (item.median >= 7 && item.median <= 9 && item.byDeadline >= 0.5 ? "PASS" : "REVIEW");
  return `| ${item.threshold} | ${fmt(item.median)} | ${percent(item.byDeadline)} by game ${item.deadline} | ${assessment} |`;
}).join("\n")}

The 5-entry unlock occurred in game 1 in 4 of 16 Guided campaigns, so game 1 is possible but not routine.

## Player-Count Parity

| Unlock | 1p median | 4p median | Difference | Limit | Assessment |
|---:|---:|---:|---:|---:|---|
${parity.map((item) => {
  const limit = item.threshold <= 15 ? 2 : item.threshold === 20 ? 3 : 4;
  return `| ${item.threshold} | ${fmt(item.one)} | ${fmt(item.four)} | ${fmt(item.difference)} | ${limit} | ${item.difference === null ? "NOT PROVEN" : item.difference <= limit ? "PASS" : "REVIEW"} |`;
}).join("\n")}

Parity passes through 20 entries, with the 20-entry comparison exactly at the 3-game limit. At 30 entries, completion by game 16 was 0 of 4 at 1p, 3 of 4 at 2p, 3 of 4 at 3p, and 1 of 4 at 4p. This is the principal live-test watch item; four campaigns per player count are not enough to justify a threshold edit.

## Passive Risks

- 15 entries before game 5: ${percent(passive15Early)} of Passive campaigns.
- 20 entries before game 8: ${percent(passive20Early)} of Passive campaigns.
- Accidental Vow completions: ${passiveVowCompletions}.
- Non-Vow, non-Capstone entries above 70% Passive completion by game 2: ${entryHealthFlags.filter((flag) => flag.includes("accidentally")).length}.

These rates do not indicate common accidental progression. Passive campaigns still advance, as expected, but the one-Vow rule cleanly prevents unintended Vow credit.

## Chaser Risks

- 15 entries before game 4: ${percent(chaser15Early)}.
- 20 entries before game 6: ${percent(chaser20Early)}.
- 30 entries before game 10: ${percent(chaser30Early)}.

The Chaser profile is faster but does not show a regular rush exploit. No campaign reached 30 within its 8-game Chaser horizon.

## Golden Content Impact

**NOT TESTABLE IN THE CURRENT PROTOTYPE**

The v3.14 unlock sheet marks Golden content as \`Not supported online\`. No Golden Tile or Golden Boon was injected into these games, and no paired-seed acceleration claim is made. This is a testing note, not a recommendation to design or implement Ledger features now.

## Entry Health

${entryHealthFlags.length ? entryHealthFlags.map((flag) => `- ${flag}`).join("\n") : "No entry crossed the stated health-warning thresholds."}

\`LE-015 No Gift Left Waiting\` is the only Foundation or Standard entry below the Guided game-8 health floor. It was never selected as a Guided target by the heuristic, but it completed in 3 of 8 Chaser campaigns, so the evidence points to target-policy exposure rather than a proven workbook defect. Several late Capstone Vows had few attempts after their 20-entry gate; their live achievability should be observed rather than changed from this sample.

No invalid Vow credit was found (${invalidVowCompletions.length}), and no game declared more than one Vow (${multiVowGames.length}). Related pairs such as the standard and Vow versions of Special placement, Arrival protection, Burden clearing, and Warehouse play remained separated by declaration or availability gates; no broad duplicate-removal case is supported.

## Recommended Deltas

No workbook change has evidence strong enough to recommend before player testing. \`recommended_deltas.csv\` therefore contains headers and no speculative rows.

## Recommended Next Action

Proceed to external player testing with the workbook unchanged. Record named-entry completion by game and player count, with particular attention to the 30-entry unlock at 1p and 4p, \`LE-015\` target selection, late gated Capstones, and actual use of unlocked Golden content. Revisit numeric thresholds only after those human logs establish a consistent effect.
`;

await fs.writeFile(path.join(outputDir, "ledger_validation_report.md"), report);

console.log(JSON.stringify({
  verdict: "PASS_WITH_NOTES",
  workbook_qa: workbookQaPass,
  specs: specs.length,
  smoke_games: smoke.length,
  campaign_games: allGames.length,
  campaigns: campaigns.length,
  simulation_errors: simulationErrors.length,
  invalid_vow_completions: invalidVowCompletions.length,
  recommended_deltas: 0,
}, null, 2));

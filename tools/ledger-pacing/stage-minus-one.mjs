import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [workbookPath, extractedWorkbookPath, outputDir] = process.argv.slice(2);

if (!workbookPath || !extractedWorkbookPath || !outputDir) {
  throw new Error(
    "Usage: node stage-minus-one.mjs <workbook.xlsx> <artifact-tool-export.json> <output-dir>",
  );
}

const requiredSheets = [
  "SL Entries",
  "SL Tracker",
  "SL Unlocks",
  "SL Legacy Sensitivity",
  "SL Benchmarks",
  "Golden Tiles",
  "Golden Boons",
  "Core Tiles",
  "Special Tiles",
  "Boons",
  "Burdens",
  "Arrivals",
  "Steward Powers",
  "Map v0.2",
];
const supplementalAuditSheets = ["Overview", "Setup Rules", "SL Overview"];
const supplementalTabularSheets = ["SL Raw Summary", "SL Source Notes"];

const evaluatorMetadata = {
  "LE-001": automatic("final.score", "final.score >= threshold_by_player_count", "score_record"),
  "LE-002": automatic("final.population", "final.population >= threshold_by_player_count", "population_record"),
  "LE-003": automatic("final.renown", "final.renown >= threshold_by_player_count", "renown_record"),
  "LE-004": automatic(
    "final.strain_tokens",
    "final.active_burdens == 0 && final.overstrained_tiles == 0 && final.strain_tokens <= threshold_by_player_count",
    "strain_resilience",
  ),
  "LE-005": board("board.derived_features.complete_six_tile_rings", "complete_six_tile_rings.non_overstrained.length >= 3", ["complete_six_tile_rings"], "six_tile_ring"),
  "LE-006": board("board.derived_features.qualifying_mixed_six_tile_rings", "qualifying_mixed_six_tile_rings.length >= 2", ["complete_six_tile_rings", "ring_category_counts"], "six_tile_ring"),
  "LE-007": board("tile_counts.placed_housing_tiles", "placed_housing_tiles >= threshold_by_player_count && all_non_overstrained_housing_has_housing_neighbor", ["all_non_overstrained_housing_has_housing_neighbor"], "housing_layout"),
  "LE-008": automatic("tile_counts.non_overstrained_categories", "tile_counts.non_overstrained_categories >= threshold_by_player_count", "category_variety"),
  "LE-009": vow("tile_counts.non_overstrained_categories", "tile_counts.non_overstrained_categories >= 8", "category_variety"),
  "LE-010": board("board.derived_features.river_connected_sides", "river_connected_sides == true", ["river_connected_sides"], "river_bridge"),
  "LE-011": board("board.derived_features.housing_on_both_river_sides_connected", "housing_on_both_river_sides_connected == true", ["river_connected_sides", "housing_on_both_river_sides"], "river_bridge"),
  "LE-012": board("board.derived_features.non_overstrained_travel_hexes_adjacent_to_river", "non_overstrained_travel_hexes_adjacent_to_river >= threshold_by_player_count", ["non_overstrained_travel_hexes_adjacent_to_river"], "river_travel"),
  "LE-013": automatic("tile_counts.placed_special_tiles", "tile_counts.placed_special_tiles >= threshold_by_player_count", "special_tile_placement"),
  "LE-014": vow("tile_counts.placed_special_tiles", "tile_counts.placed_special_tiles >= threshold_by_player_count", "special_tile_placement"),
  "LE-015": automatic("encounters.special_tiles_placed", "encounters.special_tiles_placed >= threshold_by_player_count && encounters.unlocked_special_tiles_unplaced == 0", "special_tile_placement"),
  "LE-016": automatic("encounters.arrivals_expired", "encounters.arrivals_expired == 0", "arrival_expiry"),
  "LE-017": automatic("final.active_burdens", "final.active_burdens == 0", "active_burden_zero"),
  "LE-018": automatic("final.strain_tokens", "final.overstrained_tiles == 0 && final.strain_tokens <= threshold_by_player_count", "strain_resilience"),
  "LE-019": automatic("support_and_strain.strain_prevented_by_supported", "strain_prevented_by_supported >= threshold_by_player_count", "supported_prevention"),
  "LE-020": board("support_and_strain.max_strain_on_housing", "housing_overstrained_count == 0 && max_strain_on_housing < 2", ["housing_strain_summary"], "housing_resilience"),
  "LE-021": automatic("tile_counts.upgraded_core_tiles", "tile_counts.upgraded_core_tiles >= threshold_by_player_count", "upgrade_count"),
  "LE-022": automatic("tile_counts.upgraded_core_tiles", "tile_counts.upgraded_core_tiles >= threshold_by_player_count", "upgrade_count"),
  "LE-023": automatic("final.warehouse_total", "final.warehouse_total >= threshold_by_player_count", "warehouse_total"),
  "LE-024": automatic("tile_counts.placed_by_category", "placed_by_category.Crafting >= 1 && placed_by_category.Merchant >= 1", "category_presence"),
  "LE-025": automatic("tile_counts.placed_travel_tiles", "tile_counts.placed_travel_tiles >= threshold_by_player_count", "travel_count"),
  "LE-026": vow("tile_counts.placed_travel_tiles", "placed_travel_tiles == 0 && final.score >= threshold_by_player_count", "travel_vow"),
  "LE-027": vow("tile_counts.farmstead_tiles", "farmstead_tiles == 0 && final.score >= threshold_by_player_count", "farmstead_vow"),
  "LE-028": vow("tile_counts.upgraded_core_tiles", "upgraded_core_tiles == 0 && final.score >= threshold_by_player_count", "upgrade_vow"),
  "LE-029": vow("encounters.arrivals_expired", "encounters.arrivals_expired == 0", "arrival_expiry"),
  "LE-030": vow("warehouse_peak_by_resource", "max(warehouse_peak_by_resource) <= 8", "warehouse_cap_vow"),
  "LE-031": cumulative("campaign.chosen_stewards", "unique_chosen_stewards >= 6", "chosen_stewards", "steward_campaign"),
  "LE-032": steward("Vanguard", "stewards.objectives_completed includes Vanguard && board.bridges.length >= 1", ["bridge_count"], "steward_objective"),
  "LE-033": steward("Knight", "stewards.objectives_completed includes Knight && housing_overstrained_count == 0", ["housing_strain_summary"], "steward_objective"),
  "LE-034": steward("Sentinel", "stewards.objectives_completed includes Sentinel && upgraded_non_overstrained_core_tiles >= 5", ["upgraded_non_overstrained_core_tiles"], "steward_objective"),
  "LE-035": steward("Ranger", "stewards.objectives_completed includes Ranger && occupied_non_grasslands_non_river_terrain_types >= 4", ["occupied_non_grasslands_non_river_terrain_types"], "steward_objective"),
  "LE-036": steward("Warden", "stewards.objectives_completed includes Warden && final.active_burdens == 0", [], "steward_objective"),
  "LE-037": steward("Quartermaster", "stewards.objectives_completed includes Quartermaster && resource_types_at_5_plus >= 3", [], "steward_objective"),
  "LE-038": cumulative("campaign.completed_steward_objectives", "unique_completed_steward_objectives >= 6", "completed_steward_objectives", "steward_campaign"),
  "LE-039": automatic("season_snapshots.end_season_1", "overstrained_tiles == 0 && (arrivals_completed_this_season >= 1 || burdens_resolved_this_season >= 1)", "season_resilience"),
  "LE-040": automatic("season_snapshots.end_season_2", "overstrained_tiles == 0 && active_burdens < player_count", "season_resilience"),
  "LE-041": vow("final.overstrained_tiles", "final.overstrained_tiles == 0 && final.active_burdens == 0", "strain_resilience"),
  "LE-042": automatic("final.strain_tokens", "final.strain_tokens == 0", "strain_resilience"),
  "LE-043": vow("encounters.burdens_resolved_or_removed", "burdens_revealed >= 2 && burdens_resolved_or_removed == burdens_revealed && final.active_burdens == 0 && final.overstrained_tiles == 0", "burden_resolution"),
  "LE-044": automatic("support_and_strain.strain_prevented_by_supported", "strain_prevented_by_supported >= threshold_by_player_count", "supported_prevention"),
  "LE-045": vow("final.warehouse_by_resource", "resource_types_at_10_plus >= 3", "warehouse_distribution"),
  "LE-046": automatic("final.warehouse_total", "final.warehouse_total <= 2 && final.score >= threshold_by_player_count", "warehouse_efficiency"),
  "LE-047": vow("final.warehouse_by_resource", "Wood >= 10 && Stone >= 10 && Food >= 10", "warehouse_distribution"),
  "LE-048": board("board.derived_features.categories_adjacent_to_housing", "categories_adjacent_to_housing contains Crafting, Merchant, Social, and Wellbeing", ["categories_adjacent_to_housing"], "housing_adjacency"),
  "LE-049": { ...board("board.derived_features.largest_connected_travel_group", "largest_connected_travel_group >= threshold_by_player_count", ["travel_groups", "largest_connected_travel_group"], "connected_travel"), declared_vow_required: true, evaluator_class: "declared_vow" },
  "LE-050": board("board.derived_features.special_tiles_adjacent_to_housing", "special_tiles_adjacent_to_housing >= 3", ["special_tiles_adjacent_to_housing"], "special_housing_adjacency"),
};

function automatic(primaryMetric, expression, tag) {
  return metadata("automatic_metric", primaryMetric, expression, tag);
}

function board(primaryMetric, expression, features, tag) {
  return { ...metadata("derived_board", primaryMetric, expression, tag), required_derived_board_features: features };
}

function vow(primaryMetric, expression, tag) {
  return { ...metadata("declared_vow", primaryMetric, expression, tag), declared_vow_required: true };
}

function steward(requiredSteward, expression, features, tag) {
  return {
    ...metadata("steward_gated", "stewards.objectives_completed", expression, tag),
    required_steward: requiredSteward,
    required_derived_board_features: features,
  };
}

function cumulative(primaryMetric, expression, counter, tag) {
  return { ...metadata("campaign_cumulative", primaryMetric, expression, tag), cumulative_counter: counter };
}

function limited(reason, tag) {
  return { ...metadata("manual_or_unimplemented", null, null, tag), limitation_reason: reason };
}

function limitedVow(reason, tag) {
  return { ...limited(reason, tag), declared_vow_required: true };
}

function metadata(evaluatorClass, primaryMetric, expression, tag) {
  return {
    evaluator_class: evaluatorClass,
    primary_metric: primaryMetric,
    requirement_expression: expression,
    near_miss_metric: expression ? `distance_to(${expression})` : null,
    duplicate_tags: [tag],
    required_derived_board_features: [],
    declared_vow_required: false,
    required_steward: null,
  };
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function asRows(values) {
  const [headers, ...rows] = values;
  return rows
    .filter((row) => row.some((value) => value !== null && value !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));
}

function thresholdsFor(row) {
  if (["LE-026", "LE-027", "LE-028", "LE-046"].includes(row["Entry ID"])) {
    return { 1: 90, 2: 140, 3: 220, 4: 210 };
  }

  const direct = {
    1: row["1p Target"],
    2: row["2p Target"],
    3: row["3p Target"],
    4: row["4p Target"],
  };
  if (Object.values(direct).every((value) => typeof value === "number")) return direct;

  const singleton = Object.values(direct).find((value) => typeof value === "number");
  if (singleton !== undefined && row.Scope === "Once") {
    return { 1: singleton, 2: singleton, 3: singleton, 4: singleton };
  }

  if (row["Entry ID"] === "LE-004") return { 1: 2, 2: 6, 3: 10, 4: 14 };
  if (row["Entry ID"] === "LE-012") return { 1: 2, 2: 3, 3: 4, 4: 5 };
  return null;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

const extracted = JSON.parse(await fs.readFile(extractedWorkbookPath, "utf8"));
const workbookBytes = await fs.readFile(workbookPath);
const workbookStats = await fs.stat(workbookPath);
const missingSheets = requiredSheets.filter((name) => !extracted.summaries[name]);
const sourceRows = Object.fromEntries(
  [...requiredSheets, ...supplementalTabularSheets]
    .filter((name) => extracted.summaries[name])
    .map((name) => [name, asRows(extracted.summaries[name].values)]),
);
const supplementalSources = Object.fromEntries(
  supplementalAuditSheets
    .filter((name) => extracted.summaries[name])
    .map((name) => [name, extracted.summaries[name].values]),
);
const ledgerRows = sourceRows["SL Entries"] ?? [];
const workbookVersion = extracted.summaries.Overview.values.find(
  (row) => row[0] === "Version",
)?.[1];

const specs = ledgerRows.map((row) => {
  const id = row["Entry ID"];
  const evaluator = evaluatorMetadata[id];
  if (!evaluator) throw new Error(`No evaluator metadata for ${id}.`);
  const byPlayerCount = row.Scope === "By player count";
  return {
    entry_id: id,
    name: row["Ledger Entry"],
    chronicle: row.Chronicle,
    entry_type: row.Type,
    scope: row.Scope,
    pacing_band: row["Pacing Band"],
    evaluator_class: row.Type === "Vow" ? "declared_vow" : evaluator.evaluator_class,
    counts_toward_unlock: true,
    prestige_boxes_only: false,
    player_count_boxes_are_prestige_only: byPlayerCount,
    gates: {
      declared_vow_required: row.Type === "Vow",
      required_steward: evaluator.required_steward,
      requires_golden_disabled: false,
    },
    thresholds_by_player_count: thresholdsFor(row),
    unlock_gate: Number(row["Requirement Text"]?.match(/Available after (\d+) completed Ledger Entries/i)?.[1] ?? 0),
    primary_metric: evaluator.primary_metric,
    requirement_expression: evaluator.requirement_expression,
    near_miss_metric: evaluator.near_miss_metric,
    required_derived_board_features: evaluator.required_derived_board_features,
    cumulative_counter: evaluator.cumulative_counter ?? null,
    duplicate_tags: [slug(row.Chronicle), slug(row.Type), ...evaluator.duplicate_tags],
    limitation_reason: evaluator.limitation_reason ?? null,
    tuning: {
      ...(id === "LE-005" ? { required_rings: 3 } : {}),
      ...(id === "LE-006" ? { required_mixed_rings: 2 } : {}),
      ...(id === "LE-016" ? { require_all_arrivals: true, require_no_active_burdens: true } : {}),
      ...(id === "LE-017" ? { require_no_overstrained: true } : {}),
      ...(id === "LE-024" ? { category_count_by_player: thresholdsFor(row) } : {}),
      ...(id === "LE-033" ? { max_housing_strain: 0 } : {}),
      ...(id === "LE-034" ? { upgrade_count: 8 } : {}),
      ...(id === "LE-037" ? { resource_amount: 10, resource_types_by_player: thresholdsFor(row) } : {}),
      ...(id === "LE-039" ? { progress_per_player_by_player: thresholdsFor(row) } : {}),
      ...(id === "LE-040" ? { resolved_burdens_by_player: thresholdsFor(row) } : {}),
      ...(id === "LE-041" ? { max_active_burdens: 0 } : {}),
      ...(id === "LE-043" ? { resolution_fraction: 1, require_no_overstrained: true, require_no_active_burdens: true } : {}),
      ...(id === "LE-045" ? { resource_amount: 10, resource_types: 3 } : {}),
      ...(id === "LE-047" ? { resource_amount: 10 } : {}),
      ...(id === "LE-050" ? { special_adjacency: 4 } : {}),
    },
    evaluation_kind: row.Type === "Vow"
      ? "vow"
      : ["LE-031", "LE-038"].includes(id)
        ? "campaign_long"
        : ["LE-032", "LE-033", "LE-034", "LE-035", "LE-036", "LE-037"].includes(id)
          ? "steward_gated"
          : evaluator.evaluator_class === "derived_board"
            ? "layout_derived"
            : row["Metric / Check"]?.startsWith("manual_")
              ? "composite"
              : "automatic",
    metrics_required: [evaluator.primary_metric, ...evaluator.required_derived_board_features].filter(Boolean),
    simulation_evaluable: true,
    evaluation_assumptions: row["Metric / Check"]?.startsWith("manual_")
      ? "The physical Ledger check is manual; simulation evaluates the same condition from complete game and board logs."
      : "Directly evaluated from the recorded game or campaign metrics.",
    source: {
      metric_check: row["Metric / Check"],
      comparator: row.Comparator,
      requirement_text: row["Requirement Text"],
      balance_notes: row["Balance Notes"],
      pacing_action: row["Pacing Action"],
    },
  };
});

const ambiguous = specs.filter((spec) => spec.evaluator_class === "manual_or_unimplemented");
const duplicateIds = specs
  .map((spec) => spec.entry_id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);
const expectedIds = Array.from({ length: 50 }, (_, index) => `LE-${String(index + 1).padStart(3, "0")}`);
const missingIds = expectedIds.filter((id) => !specs.some((spec) => spec.entry_id === id));
const unlockRows = sourceRows["SL Unlocks"] ?? [];
const expectedUnlocks = [5, 10, 15, 20, 30];
const actualUnlocks = unlockRows.map((row) => row["Completed Ledger Entries"]);
const unlockThresholdsMatch = JSON.stringify(actualUnlocks) === JSON.stringify(expectedUnlocks);

const warnings = ambiguous.map((spec) => [
  spec.entry_id,
  spec.name,
  "ambiguous_success_condition",
  spec.limitation_reason,
  `Replace the undefined success phrase with a numeric final-score threshold for 1p, 2p, 3p, and 4p.`,
]);

const normalizedSources = {};
const sourceHashes = {};
for (const [sheetName, rows] of Object.entries({ ...supplementalSources, ...sourceRows })) {
  const serialized = JSON.stringify(rows, null, 2) + "\n";
  normalizedSources[sheetName] = rows;
  sourceHashes[sheetName] = sha256(serialized);
}

const stagePass =
  missingSheets.length === 0 &&
  missingIds.length === 0 &&
  duplicateIds.length === 0 &&
  specs.length === 50 &&
  unlockThresholdsMatch &&
  ambiguous.length <= 2;

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "ledger_entry_specs.json"), JSON.stringify(specs, null, 2) + "\n");
await fs.writeFile(
  path.join(outputDir, "ledger_entry_parse_warnings.csv"),
  toCsv(
    ["entry_id", "entry_name", "warning_type", "reason", "proposed_parseable_wording"],
    warnings,
  ),
);
await fs.writeFile(
  path.join(outputDir, "component_source_hashes.json"),
  JSON.stringify(
    {
      workbook: {
        filename: path.basename(workbookPath),
        modified_at: workbookStats.mtime.toISOString(),
        size_bytes: workbookStats.size,
        sha256: sha256(workbookBytes),
      },
      normalized_sheet_exports: sourceHashes,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(
  path.join(outputDir, "normalized_component_sources.json"),
  JSON.stringify(normalizedSources, null, 2) + "\n",
);

const limitationLines = ambiguous.map(
  (spec) =>
    `- **${spec.entry_id} — ${spec.name}:** ${spec.limitation_reason} The current prototype records raw score only, so this cannot be inferred from a win band.`,
);
const limitationsBody = ambiguous.length
  ? `${limitationLines.join("\n")}\n\nThese entries are excluded from hard pacing conclusions until their score condition is numeric. No simulation substitute has been assumed.`
  : "None. All 50 entries have deterministic evaluator specifications.";
await fs.writeFile(
  path.join(outputDir, "ledger_evaluator_limitations.md"),
  `# Ledger Evaluator Limitations\n\n## Stage -1 Blocking Ambiguities\n\n${limitationsBody}\n`,
);

const parseabilityFinding = ambiguous.length
  ? `## Blocking Finding

The workbook uses undefined outcome language in ${ambiguous.length} entries:

${limitationLines.join("\n")}

Per the supplied test plan, Stage 0 and campaign simulation must not begin while more than two entries remain \`manual_or_unimplemented\`.`
  : `## Confirmed Test Interpretation

The user confirmed that LE-027, LE-028, and LE-046 use final-score floors of **90 / 140 / 220 / 210** for 1p / 2p / 3p / 4p. All 50 entries are therefore evaluable and Stage 0 may proceed.`;

const audit = `# Steward's Ledger Workbook Source Audit

## Source

- Workbook: \`${path.basename(workbookPath)}\`
- Modified: \`${workbookStats.mtime.toISOString()}\`
- Size: \`${workbookStats.size}\` bytes
- SHA-256: \`${sha256(workbookBytes)}\`
- Workbook version: \`${workbookVersion ?? "not found"}\`
- Sheets present: ${extracted.sheetNames.length}
- Required source sheets present: ${requiredSheets.length - missingSheets.length}/${requiredSheets.length}

## Parseability Gate

**Result: ${stagePass ? "PASS" : "FAIL"}**

| Check | Result | Detail |
|---|---|---|
| Ledger entries present exactly once | ${specs.length === 50 && missingIds.length === 0 && duplicateIds.length === 0 ? "PASS" : "FAIL"} | ${specs.length} rows; missing: ${missingIds.join(", ") || "none"}; duplicates: ${duplicateIds.join(", ") || "none"}. |
| Golden thresholds | ${unlockThresholdsMatch ? "PASS" : "FAIL"} | Workbook values: ${actualUnlocks.join(" / ")}. |
| Pacing bands and evaluator classes | ${specs.every((spec) => spec.pacing_band && spec.evaluator_class) ? "PASS" : "FAIL"} | All entries have one pacing band and one primary evaluator class. |
| Declared Vow gates | ${specs.filter((spec) => spec.entry_type === "Vow").every((spec) => spec.gates.declared_vow_required) ? "PASS" : "FAIL"} | All entries typed \`Vow\` require pre-setup declaration. LE-016 is retained as a non-declared elite Arrival entry; LE-029 is the declared Vow. |
| Steward gates | ${specs.filter((spec) => spec.evaluator_class === "steward_gated").every((spec) => spec.gates.required_steward) ? "PASS" : "FAIL"} | LE-032 through LE-037 name their required Steward. |
| Campaign cumulative counters | ${specs.filter((spec) => spec.evaluator_class === "campaign_cumulative").every((spec) => spec.cumulative_counter) ? "PASS" : "FAIL"} | LE-031 and LE-038 have explicit counters. |
| Board-derived features | ${specs.filter((spec) => spec.evaluator_class === "derived_board").every((spec) => spec.required_derived_board_features.length > 0) ? "PASS" : "FAIL"} | Former spreadsheet-manual layout checks map to prototype hex-graph features. |
| Manual or unimplemented limit | ${ambiguous.length <= 2 ? "PASS" : "FAIL"} | ${ambiguous.length} entries remain ambiguous: ${ambiguous.map((spec) => spec.entry_id).join(", ") || "none"}. Limit is 2. |

${parseabilityFinding}

## Normalized Source Hashes

Each required source sheet was exported as deterministic JSON. Its SHA-256 appears in \`component_source_hashes.json\`; the complete normalized export is \`normalized_component_sources.json\`.
`;
await fs.writeFile(path.join(outputDir, "workbook_source_audit.md"), audit);

console.log(
  JSON.stringify(
    {
      stage: -1,
      passed: stagePass,
      ledger_entries: specs.length,
      manual_or_unimplemented: ambiguous.map((spec) => spec.entry_id),
      missing_sheets: missingSheets,
      output_dir: outputDir,
    },
    null,
    2,
  ),
);

if (!stagePass) process.exitCode = 2;

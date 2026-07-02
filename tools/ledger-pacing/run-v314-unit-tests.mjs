import fs from "node:fs/promises";
import path from "node:path";
import { evaluateEntry } from "./lib/evaluator.mjs";
import { validateGameLogRules } from "./lib/validation.mjs";

const [specPath, outputPath] = process.argv.slice(2);
if (!specPath || !outputPath) {
  throw new Error("Usage: node run-v314-unit-tests.mjs <ledger_entry_specs.json> <output.csv>");
}

const specs = JSON.parse(await fs.readFile(specPath, "utf8"));
const stewardNames = ["Vanguard", "Knight", "Sentinel", "Ranger", "Warden", "Quartermaster"];

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function campaignAtGate(spec) {
  return {
    completed_named_entries: Array.from({ length: spec.unlock_gate ?? 0 }, (_, index) => `GATE-${index + 1}`),
    completed_prestige_boxes: [],
    chosen_stewards: stewardNames.slice(0, 5),
    completed_steward_objectives: stewardNames.slice(0, 5),
  };
}

function baseLog() {
  return {
    campaign_id: "UNIT",
    game_index: 1,
    seed: "unit",
    player_count: 2,
    strategy_profile: "fixture",
    chosen_stewards: [],
    declared_vows: [],
    targeted_ledger_entries: [],
    target_attempts: [],
    golden_tile_used: null,
    golden_boon_used: null,
    golden_boons_revealed: [],
    golden_content_enabled: false,
    unlock_count_start: 0,
    unlock_count_end: 0,
    warehouse_peak_by_resource: { Wood: 15, Stone: 15, Metal: 15, Food: 15, Herbs: 15, Goods: 15 },
    final: {
      score: 0,
      population: 0,
      renown: 0,
      active_burdens: 3,
      strain_tokens: 20,
      overstrained_tiles: 2,
      warehouse_total: 20,
      warehouse_by_resource: { Wood: 1, Stone: 1, Metal: 1, Food: 1, Herbs: 1, Goods: 1 },
    },
    encounters: {
      boons_revealed: 8,
      burdens_revealed: 8,
      burdens_resolved_or_removed: 0,
      arrivals_revealed: 8,
      arrivals_completed: 0,
      arrivals_expired: 2,
      special_tiles_unlocked: 2,
      special_tiles_placed: 0,
      unlocked_special_tiles_unplaced: 2,
      standard_reveals: 24,
      golden_bonus_reveals: 0,
      total_reveals: 24,
      player_hands: { player_1: [], player_2: [] },
    },
    actions: { place_actions: 0, upgrade_actions: 0, activate_actions: 0, encounter_interact_actions: 0, steward_power_uses: 0, free_place_effects_used: 0 },
    stewards: { objectives_completed: [], powers_used_by_steward: {} },
    tile_counts: {
      placed_total: 4,
      placed_by_category: { Resource: 0, Housing: 0, Crafting: 0, Merchant: 0, Social: 0, Wellbeing: 0, Travel: 0, Special: 0, Golden: 0 },
      placed_housing_tiles: 0,
      placed_travel_tiles: 2,
      placed_path_tiles: 0,
      placed_street_tiles: 0,
      placed_track_tiles: 0,
      placed_special_tiles: 0,
      upgraded_core_tiles: 1,
      upgraded_non_overstrained_core_tiles: 0,
      non_overstrained_categories: 0,
      farmstead_tiles: 1,
    },
    support_and_strain: { strain_prevented_by_supported: 0, strain_removed: 0, max_strain_on_housing: 2, housing_overstrained_count: 1 },
    season_snapshots: {
      end_season_1: { active_burdens: 3, overstrained_tiles: 1, arrivals_completed_this_season: 0, burdens_resolved_this_season: 0 },
      end_season_2: { active_burdens: 3, overstrained_tiles: 1, arrivals_completed_this_season: 0, burdens_resolved_this_season: 0 },
      end_season_3: { active_burdens: 3, overstrained_tiles: 2 },
    },
    board: {
      tiles: [],
      bridges: [],
      derived_features: {
        complete_six_tile_rings: [],
        qualifying_mixed_six_tile_rings: [],
        river_connected_sides: false,
        housing_on_both_river_sides_connected: false,
        all_non_overstrained_housing_has_housing_neighbor: false,
        non_overstrained_travel_hexes_adjacent_to_river: 0,
        occupied_non_grasslands_non_river_terrain_types: 0,
        categories_adjacent_to_housing: [],
        special_tiles_adjacent_to_housing: 0,
        largest_connected_travel_group: 0,
      },
    },
  };
}

function passingLog(spec) {
  const log = baseLog();
  const threshold = spec.thresholds_by_player_count?.["2"] ?? 1;
  log.chosen_stewards = [...stewardNames];
  log.declared_vows = spec.gates.declared_vow_required ? [spec.entry_id] : [];
  log.warehouse_peak_by_resource = { Wood: 8, Stone: 8, Metal: 8, Food: 8, Herbs: 8, Goods: 8 };
  Object.assign(log.final, {
    score: 1000,
    population: 1000,
    renown: 1000,
    active_burdens: 0,
    strain_tokens: 0,
    overstrained_tiles: 0,
    warehouse_total: 1000,
    warehouse_by_resource: { Wood: 100, Stone: 100, Metal: 100, Food: 100, Herbs: 100, Goods: 100 },
  });
  Object.assign(log.encounters, {
    burdens_revealed: 8,
    burdens_resolved_or_removed: 8,
    arrivals_revealed: 8,
    arrivals_completed: 8,
    arrivals_expired: 0,
    special_tiles_unlocked: 12,
    special_tiles_placed: 12,
    unlocked_special_tiles_unplaced: 0,
  });
  log.stewards.objectives_completed = [...stewardNames];
  Object.assign(log.tile_counts, {
    placed_total: 60,
    placed_by_category: { Resource: 10, Housing: 12, Crafting: 4, Merchant: 4, Social: 4, Wellbeing: 4, Travel: 20, Special: 12, Golden: 0 },
    placed_housing_tiles: 12,
    placed_travel_tiles: 20,
    placed_special_tiles: 12,
    upgraded_core_tiles: 20,
    upgraded_non_overstrained_core_tiles: 20,
    non_overstrained_categories: 8,
    farmstead_tiles: 4,
  });
  Object.assign(log.support_and_strain, { strain_prevented_by_supported: 20, max_strain_on_housing: 0, housing_overstrained_count: 0 });
  log.season_snapshots.end_season_1 = { active_burdens: 0, overstrained_tiles: 0, arrivals_completed_this_season: 8, burdens_resolved_this_season: 8 };
  log.season_snapshots.end_season_2 = { active_burdens: 0, overstrained_tiles: 0, arrivals_completed_this_season: 8, burdens_resolved_this_season: 8 };
  log.board.bridges = [{ coord: "E4" }];
  Object.assign(log.board.derived_features, {
    complete_six_tile_rings: Array.from({ length: 3 }, (_, index) => [`R${index}`]),
    qualifying_mixed_six_tile_rings: Array.from({ length: 2 }, (_, index) => [`M${index}`]),
    river_connected_sides: true,
    housing_on_both_river_sides_connected: true,
    all_non_overstrained_housing_has_housing_neighbor: true,
    non_overstrained_travel_hexes_adjacent_to_river: 20,
    occupied_non_grasslands_non_river_terrain_types: 5,
    categories_adjacent_to_housing: ["Crafting", "Merchant", "Social", "Wellbeing"],
    special_tiles_adjacent_to_housing: 8,
    largest_connected_travel_group: 20,
  });

  if (spec.entry_id === "LE-026") log.tile_counts.placed_travel_tiles = 0;
  if (spec.entry_id === "LE-027") log.tile_counts.farmstead_tiles = 0;
  if (spec.entry_id === "LE-028") log.tile_counts.upgraded_core_tiles = 0;
  if (spec.entry_id === "LE-030") log.warehouse_peak_by_resource = { Wood: 8, Stone: 8, Metal: 8, Food: 8, Herbs: 8, Goods: 8 };
  if (spec.entry_id === "LE-046") log.final.warehouse_total = 2;
  if (spec.entry_id === "LE-031") {
    log.chosen_stewards = [stewardNames[5]];
  }
  if (spec.entry_id === "LE-038") {
    log.stewards.objectives_completed = [stewardNames[5]];
  }
  if (["LE-001", "LE-002", "LE-003", "LE-004", "LE-007", "LE-012", "LE-013", "LE-014", "LE-018", "LE-019", "LE-020", "LE-021", "LE-022", "LE-023", "LE-025", "LE-034", "LE-037", "LE-039", "LE-040", "LE-044", "LE-045", "LE-047", "LE-049"].includes(spec.entry_id) && threshold === null) {
    throw new Error(`Missing threshold for ${spec.entry_id}`);
  }
  return log;
}

const rows = [];
const defects = [];
function record(spec, testType, expected, result, detail) {
  const actual = Boolean(result.complete);
  const pass = actual === expected;
  rows.push([spec.entry_id, spec.name, testType, expected, actual, result.blocked ?? "", pass ? "PASS" : "FAIL", detail]);
  if (!pass) defects.push(`${spec.entry_id} ${testType}: expected ${expected}, got ${actual} (${result.blocked ?? result.reason ?? "no reason"})`);
}

for (const spec of specs) {
  const campaign = campaignAtGate(spec);
  record(spec, "should_complete", true, evaluateEntry(spec, passingLog(spec), campaign), "Artificial log satisfies the printed condition.");

  const failing = baseLog();
  failing.declared_vows = spec.gates.declared_vow_required ? [spec.entry_id] : [];
  failing.chosen_stewards = spec.gates.required_steward ? [spec.gates.required_steward] : [];
  record(spec, "should_not_complete", false, evaluateEntry(spec, failing, campaign), "Artificial log fails the printed condition after all gates are open.");

  if (spec.gates.declared_vow_required) {
    const undeclared = passingLog(spec);
    undeclared.declared_vows = [];
    const result = evaluateEntry(spec, undeclared, campaign);
    record(spec, "undeclared_vow_blocked", false, result, "A qualifying Vow must fail without pre-setup declaration.");
    if (result.blocked !== "vow_not_declared") defects.push(`${spec.entry_id} undeclared Vow did not report vow_not_declared.`);
  }

  if (spec.gates.required_steward) {
    const wrongSteward = passingLog(spec);
    wrongSteward.chosen_stewards = stewardNames.filter((name) => name !== spec.gates.required_steward);
    const result = evaluateEntry(spec, wrongSteward, campaign);
    record(spec, "wrong_steward_blocked", false, result, "A qualifying result must fail when the required Steward was not chosen.");
    if (result.blocked !== "required_steward_not_chosen") defects.push(`${spec.entry_id} wrong Steward did not report required_steward_not_chosen.`);
  }

  if ((spec.unlock_gate ?? 0) > 0) {
    const beforeGate = { ...campaignAtGate(spec), completed_named_entries: Array.from({ length: spec.unlock_gate - 1 }, (_, index) => `PRE-${index + 1}`) };
    const blocked = evaluateEntry(spec, passingLog(spec), beforeGate);
    record(spec, "availability_before_gate", false, blocked, `Entry must remain unavailable before ${spec.unlock_gate} named entries.`);
    if (blocked.blocked !== "ledger_tier_locked") defects.push(`${spec.entry_id} availability gate did not report ledger_tier_locked.`);
    record(spec, "availability_at_gate", true, evaluateEntry(spec, passingLog(spec), campaign), `Entry must become evaluable at ${spec.unlock_gate} named entries.`);
  }
}

const twoVowLog = baseLog();
twoVowLog.declared_vows = ["LE-009", "LE-014"];
if (!validateGameLogRules(twoVowLog).some((message) => message.includes("Only one Steward's Ledger Vow"))) {
  defects.push("The one-Vow-per-game validator did not reject two declarations.");
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, toCsv(["entry_id", "entry_name", "test_type", "expected_complete", "actual_complete", "blocked_reason", "result", "detail"], rows));
console.log(JSON.stringify({ tests: rows.length, passed: rows.filter((row) => row[6] === "PASS").length, failed: defects.length, defects }, null, 2));
if (defects.length) process.exitCode = 2;

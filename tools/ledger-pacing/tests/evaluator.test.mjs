import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { evaluateEntry, evaluateLedger, stewardNames } from "../lib/evaluator.mjs";
import { validateGameLogRules } from "../lib/validation.mjs";

const specs = JSON.parse(
  fs.readFileSync(new URL("../../../analysis/ledger-pacing/v3_12/ledger_entry_specs.json", import.meta.url)),
);

function baseGameLog() {
  return {
    campaign_id: "FIXTURE",
    game_index: 1,
    seed: 1,
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
      player_hands: { player_1: ["boon_1"], player_2: ["burden_1"] },
    },
    actions: { place_actions: 0, upgrade_actions: 0, activate_actions: 0, encounter_interact_actions: 0, steward_power_uses: 0, free_place_effects_used: 0 },
    stewards: { objectives_completed: [], powers_used_by_steward: {} },
    tile_counts: {
      placed_total: 4,
      placed_by_category: { Resource: 0, Housing: 0, Crafting: 0, Merchant: 0, Social: 0, Wellbeing: 0, Travel: 2, Special: 0, Golden: 0 },
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

function makePassingFixture(id) {
  const log = baseGameLog();
  const campaign = { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [] };
  const threshold = specs.find((spec) => spec.entry_id === id).thresholds_by_player_count?.["2"];
  const d = log.board.derived_features;
  switch (id) {
    case "LE-001": log.final.score = threshold; break;
    case "LE-002": log.final.population = threshold; break;
    case "LE-003": log.final.renown = threshold; break;
    case "LE-004": Object.assign(log.final, { active_burdens: 0, overstrained_tiles: 0, strain_tokens: threshold }); break;
    case "LE-005": d.complete_six_tile_rings = [["A1", "A2", "B2", "C2", "C1", "B1"]]; break;
    case "LE-006": d.qualifying_mixed_six_tile_rings = [["A1", "A2", "B2", "C2", "C1", "B1"]]; break;
    case "LE-007": log.tile_counts.placed_housing_tiles = threshold; d.all_non_overstrained_housing_has_housing_neighbor = true; break;
    case "LE-008":
    case "LE-009": log.tile_counts.non_overstrained_categories = threshold; break;
    case "LE-010": d.river_connected_sides = true; break;
    case "LE-011": d.housing_on_both_river_sides_connected = true; break;
    case "LE-012": d.non_overstrained_travel_hexes_adjacent_to_river = threshold; break;
    case "LE-013":
    case "LE-014": log.tile_counts.placed_special_tiles = threshold; break;
    case "LE-015": log.encounters.special_tiles_placed = threshold; log.encounters.unlocked_special_tiles_unplaced = 0; break;
    case "LE-016": log.encounters.arrivals_expired = 0; break;
    case "LE-017": log.final.active_burdens = 0; break;
    case "LE-018": log.final.overstrained_tiles = 0; log.final.strain_tokens = threshold; break;
    case "LE-019":
    case "LE-044": log.support_and_strain.strain_prevented_by_supported = threshold; break;
    case "LE-020": log.support_and_strain.housing_overstrained_count = 0; log.support_and_strain.max_strain_on_housing = 1; break;
    case "LE-021":
    case "LE-022": log.tile_counts.upgraded_core_tiles = threshold; break;
    case "LE-023": log.final.warehouse_total = threshold; break;
    case "LE-024": log.tile_counts.placed_by_category.Crafting = 1; log.tile_counts.placed_by_category.Merchant = 1; break;
    case "LE-025": log.tile_counts.placed_travel_tiles = threshold; break;
    case "LE-026": log.declared_vows = [id]; log.tile_counts.placed_travel_tiles = 0; log.final.score = threshold; break;
    case "LE-027": log.declared_vows = [id]; log.tile_counts.farmstead_tiles = 0; log.final.score = threshold; break;
    case "LE-028": log.declared_vows = [id]; log.tile_counts.upgraded_core_tiles = 0; log.final.score = threshold; break;
    case "LE-029": log.declared_vows = [id]; log.encounters.arrivals_expired = 0; break;
    case "LE-030": log.declared_vows = [id]; Object.keys(log.warehouse_peak_by_resource).forEach((key) => { log.warehouse_peak_by_resource[key] = 8; }); break;
    case "LE-031": campaign.chosen_stewards = stewardNames.slice(0, 5); log.chosen_stewards = [stewardNames[5]]; break;
    case "LE-032": log.chosen_stewards = ["Vanguard"]; log.stewards.objectives_completed = ["Vanguard"]; log.board.bridges = [{ coord: "E4" }]; break;
    case "LE-033": log.chosen_stewards = ["Knight"]; log.stewards.objectives_completed = ["Knight"]; log.support_and_strain.housing_overstrained_count = 0; break;
    case "LE-034": log.chosen_stewards = ["Sentinel"]; log.stewards.objectives_completed = ["Sentinel"]; log.tile_counts.upgraded_non_overstrained_core_tiles = 5; break;
    case "LE-035": log.chosen_stewards = ["Ranger"]; log.stewards.objectives_completed = ["Ranger"]; d.occupied_non_grasslands_non_river_terrain_types = 4; break;
    case "LE-036": log.chosen_stewards = ["Warden"]; log.stewards.objectives_completed = ["Warden"]; log.final.active_burdens = 0; break;
    case "LE-037": log.chosen_stewards = ["Quartermaster"]; log.stewards.objectives_completed = ["Quartermaster"]; Object.assign(log.final.warehouse_by_resource, { Wood: 5, Stone: 5, Food: 5 }); break;
    case "LE-038": campaign.completed_steward_objectives = stewardNames.slice(0, 5); log.stewards.objectives_completed = [stewardNames[5]]; break;
    case "LE-039": Object.assign(log.season_snapshots.end_season_1, { overstrained_tiles: 0, arrivals_completed_this_season: 1 }); break;
    case "LE-040": Object.assign(log.season_snapshots.end_season_2, { overstrained_tiles: 0, active_burdens: 1 }); break;
    case "LE-041": Object.assign(log.final, { overstrained_tiles: 0, active_burdens: 1 }); break;
    case "LE-042": log.final.strain_tokens = 0; break;
    case "LE-043": log.encounters.burdens_revealed = 3; log.encounters.burdens_resolved_or_removed = 2; break;
    case "LE-045": Object.assign(log.final.warehouse_by_resource, { Wood: 10, Stone: 10, Food: 10 }); break;
    case "LE-046": log.final.warehouse_total = 2; log.final.score = threshold; break;
    case "LE-047": Object.assign(log.final.warehouse_by_resource, { Wood: 8, Stone: 8, Food: 8 }); break;
    case "LE-048": d.categories_adjacent_to_housing = ["Crafting", "Merchant", "Social", "Wellbeing"]; break;
    case "LE-049": d.largest_connected_travel_group = threshold; break;
    case "LE-050": d.special_tiles_adjacent_to_housing = 3; break;
    default: throw new Error(`No pass fixture for ${id}`);
  }
  return { log, campaign };
}

test("Stage 0: every Ledger Entry has a passing fixture", () => {
  for (const spec of specs) {
    const { log, campaign } = makePassingFixture(spec.entry_id);
    assert.equal(evaluateEntry(spec, log, campaign).complete, true, `${spec.entry_id} should pass`);
  }
});

test("Stage 0: every Ledger Entry has a failing fixture", () => {
  for (const spec of specs) {
    const result = evaluateEntry(spec, baseGameLog(), {});
    assert.equal(result.complete, false, `${spec.entry_id} should fail`);
  }
});

test("confirmed Vow and low-Warehouse score floors override workbook zeroes", () => {
  for (const entryId of ["LE-026", "LE-027", "LE-028", "LE-046"]) {
    const spec = specs.find((item) => item.entry_id === entryId);
    assert.deepEqual(spec.thresholds_by_player_count, { 1: 90, 2: 140, 3: 220, 4: 210 });
  }
});

test("LE-045 machine-readable requirement follows its workbook threshold", () => {
  const spec = specs.find((item) => item.entry_id === "LE-045");
  assert.match(spec.requirement_expression, /threshold_by_player_count/);
});

test("edge 1: declared Vow cannot complete without declaration", () => {
  const spec = specs.find((item) => item.entry_id === "LE-029");
  const { log } = makePassingFixture("LE-029");
  log.declared_vows = [];
  assert.equal(evaluateEntry(spec, log).blocked, "vow_not_declared");
});

test("edge 2: Steward entry cannot complete with the wrong Steward", () => {
  const spec = specs.find((item) => item.entry_id === "LE-034");
  const { log } = makePassingFixture("LE-034");
  log.chosen_stewards = ["Knight"];
  assert.equal(evaluateEntry(spec, log).blocked, "required_steward_not_chosen");
});

test("edge 3: repeated named entry does not add unlock progress", () => {
  const { log, campaign } = makePassingFixture("LE-013");
  campaign.completed_named_entries = ["LE-013"];
  const result = evaluateLedger(specs, log, campaign);
  assert.equal(result.new_named_entries.includes("LE-013"), false);
});

test("edge 4: a new player-count prestige box does not recreate the named unlock", () => {
  const { log, campaign } = makePassingFixture("LE-013");
  campaign.completed_named_entries = ["LE-013"];
  const result = evaluateLedger(specs, log, campaign);
  assert.equal(result.prestige_boxes_completed.some((box) => box.entry_id === "LE-013"), true);
  assert.equal(result.new_named_entries.includes("LE-013"), false);
});

test("edge 5: an already recorded prestige box is not duplicated", () => {
  const { log, campaign } = makePassingFixture("LE-013");
  campaign.completed_prestige_boxes = ["LE-013:2"];
  const result = evaluateLedger(specs, log, campaign);
  assert.equal(result.prestige_boxes_completed.some((box) => box.entry_id === "LE-013"), false);
});

test("edge 6: Golden Boons in player hands are rejected", () => {
  const log = baseGameLog();
  log.encounters.player_hands.player_1.push("golden_bell");
  assert.match(validateGameLogRules(log).join(" "), /never enter player hands/);
});

test("edge 7: Golden Boon reveal remains additional to all standard reveals", () => {
  const log = baseGameLog();
  log.encounters.golden_bonus_reveals = 1;
  log.encounters.total_reveals = 25;
  assert.deepEqual(validateGameLogRules(log), []);
});

test("edge 8: a Golden Boon cannot replace a standard reveal", () => {
  const log = baseGameLog();
  log.encounters.standard_reveals = 23;
  log.encounters.golden_bonus_reveals = 1;
  log.encounters.total_reveals = 24;
  assert.match(validateGameLogRules(log).join(" "), /Expected 24 standard/);
});

test("edge 9: burden two-thirds entry requires at least two revealed Burdens", () => {
  const spec = specs.find((item) => item.entry_id === "LE-043");
  const log = baseGameLog();
  log.encounters.burdens_revealed = 1;
  log.encounters.burdens_resolved_or_removed = 1;
  assert.equal(evaluateEntry(spec, log).complete, false);
});

test("edge 10: LE-016 is not declaration-gated while LE-029 is", () => {
  const log = baseGameLog();
  log.encounters.arrivals_expired = 0;
  assert.equal(evaluateEntry(specs.find((item) => item.entry_id === "LE-016"), log).complete, true);
  assert.equal(evaluateEntry(specs.find((item) => item.entry_id === "LE-029"), log).complete, false);
});

test("edge 11: only one Steward's Ledger Vow may be declared per game", () => {
  const log = baseGameLog();
  log.declared_vows = ["LE-026", "LE-029"];
  assert.match(validateGameLogRules(log).join(" "), /Only one Steward's Ledger Vow/);
});

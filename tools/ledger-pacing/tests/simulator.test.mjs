import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runCampaign, simulateGame } from "../lib/simulator.mjs";

const specs = JSON.parse(fs.readFileSync(new URL("../../../analysis/ledger-pacing/v3_12/ledger_entry_specs.json", import.meta.url)));
const sources = JSON.parse(fs.readFileSync(new URL("../../../analysis/ledger-pacing/v3_12/normalized_component_sources.json", import.meta.url)));
const rawGames = sources["SL Raw Summary"];
const emptyState = { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [] };

test("Stage 1 shape: every player/profile cell produces a legal full game log", () => {
  for (const playerCount of [1, 2, 3, 4]) {
    for (const profile of ["passive_normal", "guided_ledger", "achievement_chaser"]) {
      const result = simulateGame({ specs, rawGames, playerCount, profile, campaignId: "TEST", gameIndex: 1, seed: `test:${playerCount}:${profile}`, campaignState: structuredClone(emptyState), previousEvaluation: null });
      const log = result.log;
      assert.deepEqual(result.validationErrors, []);
      assert.equal(log.encounters.boons_revealed, playerCount * 4);
      assert.equal(log.encounters.burdens_revealed, playerCount * 4);
      assert.equal(log.encounters.arrivals_revealed, playerCount * 4);
      assert.equal(log.encounters.standard_reveals, playerCount * 12);
      assert.equal(new Set(log.board.tiles.map((tile) => tile.coord)).size, log.board.tiles.length);
      assert.ok(log.board.tiles.every((tile) => tile.adjacent_coords.length > 0));
      assert.ok(log.board.tiles.filter((tile) => tile.category === "Resource").every((tile) => ["Woodland", "Mountains", "Heaths", "Arable Land"].includes(tile.terrain)));
      assert.ok(log.board.tiles.filter((tile) => tile.terrain === "Water/River").every((tile) => tile.category === "Travel"));
      assert.equal(log.actions.place_actions + log.actions.upgrade_actions + log.actions.activate_actions + log.actions.encounter_interact_actions, playerCount * 48);
    }
  }
});

test("Golden content remains optional bonus content after unlock", () => {
  const state = { ...structuredClone(emptyState), completed_named_entries: specs.slice(0, 30).map((spec) => spec.entry_id) };
  const result = simulateGame({ specs, rawGames, playerCount: 2, profile: "guided_ledger", campaignId: "GOLDEN", gameIndex: 8, seed: "golden-test", campaignState: state, previousEvaluation: null });
  assert.equal(result.log.golden_content_enabled, true);
  assert.equal(result.log.encounters.golden_bonus_reveals, 1);
  assert.equal(result.log.encounters.total_reveals, result.log.encounters.standard_reveals + 1);
  assert.equal(Object.values(result.log.encounters.player_hands).flat().some((card) => card.startsWith("golden_")), false);
});

test("campaign replay is deterministic for a fixed seed prefix", () => {
  const first = runCampaign({ specs, rawGames, playerCount: 2, profile: "guided_ledger", campaignId: "A", games: 4, seedPrefix: "same-seed" });
  const second = runCampaign({ specs, rawGames, playerCount: 2, profile: "guided_ledger", campaignId: "B", games: 4, seedPrefix: "same-seed" });
  assert.deepEqual(first.results.map((result) => result.log.final), second.results.map((result) => result.log.final));
  assert.deepEqual(first.results.map((result) => result.evaluation.new_named_entries), second.results.map((result) => result.evaluation.new_named_entries));
});

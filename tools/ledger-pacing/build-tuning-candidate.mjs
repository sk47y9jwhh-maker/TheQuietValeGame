import fs from "node:fs/promises";
import path from "node:path";

const [sourcePath, outputDir, variant = "v1"] = process.argv.slice(2);
if (!sourcePath || !outputDir) {
  throw new Error("Usage: node build-tuning-candidate.mjs <ledger_entry_specs.json> <output-dir> [v1|v2|v3|v4|v5|v6|tiered|milestone|milestone2|vow4|vow6|vow8|vowLate]");
}

const specs = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const baseChanges = {
  "LE-004": { thresholds_by_player_count: { 1: 0, 2: 2, 3: 4, 4: 6 } },
  "LE-005": { tuning: { required_rings: 3 } },
  "LE-006": { tuning: { required_mixed_rings: 2 } },
  "LE-012": { thresholds_by_player_count: { 1: 5, 2: 7, 3: 9, 4: 11 } },
  "LE-016": { tuning: { require_all_arrivals: true, require_no_active_burdens: true } },
  "LE-017": { tuning: { require_no_overstrained: true } },
  "LE-018": { thresholds_by_player_count: { 1: 0, 2: 1, 3: 3, 4: 5 } },
  "LE-020": { thresholds_by_player_count: { 1: 5, 2: 7, 3: 9, 4: 11 } },
  "LE-023": { thresholds_by_player_count: { 1: 65, 2: 75, 3: 80, 4: 85 } },
  "LE-024": { tuning: { category_count: 2 } },
  "LE-033": { tuning: { max_housing_strain: 0 } },
  "LE-034": { tuning: { upgrade_count: 8 } },
  "LE-035": { tuning: { terrain_count: 5 } },
  "LE-037": { tuning: { resource_types: 5, resource_amount: 10 } },
  "LE-039": { tuning: { scale_progress_by_player: true } },
  "LE-040": { tuning: { resolved_burdens_per_player: 1.5 } },
  "LE-041": { tuning: { require_zero_strain: true } },
  "LE-043": { tuning: { resolution_fraction: 1, require_no_overstrained: true } },
  "LE-045": { thresholds_by_player_count: { 1: 6, 2: 6, 3: 6, 4: 6 } },
  "LE-047": { tuning: { resource_amount: 12 } },
  "LE-049": { thresholds_by_player_count: { 1: 8, 2: 10, 3: 12, 4: 14 } },
  "LE-050": { tuning: { special_adjacency: 5 } },
};
const v2Changes = {
  "LE-001": { thresholds_by_player_count: { 1: 80, 2: 115, 3: 155, 4: 240 } },
  "LE-002": { thresholds_by_player_count: { 1: 75, 2: 105, 3: 130, 4: 175 } },
  "LE-003": { thresholds_by_player_count: { 1: 25, 2: 40, 3: 60, 4: 90 } },
  "LE-015": { thresholds_by_player_count: { 1: 3, 2: 5, 3: 7, 4: 8 } },
  "LE-018": { thresholds_by_player_count: { 1: 1, 2: 3, 3: 5, 4: 7 } },
  "LE-021": { thresholds_by_player_count: { 1: 5, 2: 8, 3: 10, 4: 11 } },
  "LE-022": { thresholds_by_player_count: { 1: 6, 2: 9, 3: 11, 4: 12 } },
  "LE-023": { thresholds_by_player_count: { 1: 65, 2: 75, 3: 75, 4: 80 } },
  "LE-024": { tuning: { category_count_by_player: { 1: 1, 2: 1, 3: 2, 4: 2 } } },
  "LE-041": { tuning: { max_active_burdens: 0 } },
  "LE-044": { thresholds_by_player_count: { 1: 1, 2: 3, 3: 5, 4: 7 } },
};
const v3Changes = {
  ...v2Changes,
  "LE-015": { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 7 } },
  "LE-021": { thresholds_by_player_count: { 1: 6, 2: 10, 3: 12, 4: 13 } },
  "LE-022": { thresholds_by_player_count: { 1: 7, 2: 11, 3: 13, 4: 14 } },
  "LE-040": { tuning: { resolved_burdens_per_player_by_player: { 1: 1, 2: 1, 3: 1.5, 4: 1.5 } } },
  "LE-044": { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 8 } },
  "LE-050": { tuning: { special_adjacency: 4 } },
};
const v5Changes = {
  "LE-002": { thresholds_by_player_count: { 1: 75, 2: 105, 3: 130, 4: 175 } },
  "LE-007": { thresholds_by_player_count: { 1: 3, 2: 4, 3: 6, 4: 7 } },
  "LE-015": { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 7 } },
  "LE-021": { thresholds_by_player_count: { 1: 6, 2: 10, 3: 12, 4: 13 } },
  "LE-022": { thresholds_by_player_count: { 1: 7, 2: 11, 3: 13, 4: 14 } },
  "LE-024": { tuning: { category_count_by_player: { 1: 1, 2: 1, 3: 2, 4: 2 } } },
  "LE-035": { tuning: { terrain_count: 4 } },
  "LE-037": { tuning: { resource_types: 4, resource_amount: 10 } },
  "LE-040": { tuning: { resolved_burdens_per_player_by_player: { 1: 1, 2: 1, 3: 1.5, 4: 1.5 } } },
  "LE-041": { tuning: { max_active_burdens: 0 } },
  "LE-050": { tuning: { special_adjacency: 4 } },
};
const v6Changes = {
  "LE-007": { thresholds_by_player_count: { 1: 4, 2: 5, 3: 7, 4: 8 } },
  "LE-008": { thresholds_by_player_count: { 1: 4, 2: 5, 3: 6, 4: 7 } },
  "LE-012": { thresholds_by_player_count: { 1: 4, 2: 6, 3: 8, 4: 10 } },
  "LE-013": { thresholds_by_player_count: { 1: 3, 2: 5, 3: 7, 4: 8 } },
  "LE-014": { thresholds_by_player_count: { 1: 4, 2: 6, 3: 9, 4: 10 } },
  "LE-015": { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 7 } },
  "LE-020": { thresholds_by_player_count: { 1: 4, 2: 6, 3: 8, 4: 10 } },
  "LE-021": { thresholds_by_player_count: { 1: 6, 2: 10, 3: 12, 4: 13 } },
  "LE-022": { thresholds_by_player_count: { 1: 7, 2: 11, 3: 13, 4: 14 } },
  "LE-024": { tuning: { category_count_by_player: { 1: 1, 2: 1, 3: 2, 4: 2 } } },
  "LE-025": { thresholds_by_player_count: { 1: 7, 2: 9, 3: 13, 4: 15 } },
  "LE-034": { tuning: { upgrade_count: 7 } },
  "LE-035": { tuning: { terrain_count: 4 } },
  "LE-049": { thresholds_by_player_count: { 1: 7, 2: 9, 3: 11, 4: 13 } },
  "LE-050": { tuning: { special_adjacency: 4 } },
};
const tierAssignments = {
  Foundation: ["LE-007","LE-008","LE-010","LE-013","LE-018","LE-021","LE-024","LE-039"],
  Standard: ["LE-005","LE-012","LE-014","LE-016","LE-017","LE-019","LE-020","LE-025","LE-033","LE-034","LE-040","LE-043"],
  Directed: ["LE-001","LE-002","LE-003","LE-006","LE-011","LE-015","LE-022","LE-031","LE-032","LE-035","LE-036","LE-037","LE-041","LE-049","LE-050"],
};
const tierGate = { Foundation: 0, Standard: 5, Directed: 10, Capstone: 20 };
const milestoneChanges = {
  "LE-001": { thresholds_by_player_count: { 1: 80, 2: 115, 3: 155, 4: 240 }, unlock_gate: 10 },
  "LE-002": { thresholds_by_player_count: { 1: 75, 2: 105, 3: 130, 4: 175 }, unlock_gate: 10 },
  "LE-003": { thresholds_by_player_count: { 1: 25, 2: 40, 3: 60, 4: 90 }, unlock_gate: 10 },
  "LE-015": { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 7 }, unlock_gate: 10 },
  "LE-021": { thresholds_by_player_count: { 1: 5, 2: 8, 3: 10, 4: 11 }, unlock_gate: 5 },
  "LE-022": { thresholds_by_player_count: { 1: 6, 2: 9, 3: 11, 4: 12 }, unlock_gate: 5 },
  "LE-023": { thresholds_by_player_count: { 1: 65, 2: 75, 3: 75, 4: 80 }, unlock_gate: 20 },
  "LE-024": { tuning: { category_count_by_player: { 1: 1, 2: 1, 3: 2, 4: 2 } }, unlock_gate: 5 },
  "LE-035": { tuning: { terrain_count: 4 }, unlock_gate: 10 },
  "LE-037": { tuning: { resource_types: 4, resource_amount: 10 }, unlock_gate: 10 },
  "LE-040": { tuning: { resolved_burdens_per_player_by_player: { 1: 1, 2: 1, 3: 1.5, 4: 1.5 } }, unlock_gate: 10 },
  "LE-041": { tuning: { max_active_burdens: 0 }, unlock_gate: 10 },
  "LE-044": { thresholds_by_player_count: { 1: 1, 2: 3, 3: 5, 4: 7 }, unlock_gate: 5 },
  "LE-050": { tuning: { special_adjacency: 4 }, unlock_gate: 10 },
};
const milestone2Changes = {
  ...milestoneChanges,
  "LE-001": { ...milestoneChanges["LE-001"], unlock_gate: 5 },
  "LE-002": { ...milestoneChanges["LE-002"], unlock_gate: 5 },
  "LE-003": { ...milestoneChanges["LE-003"], unlock_gate: 5 },
};
const withVows = (changes, entryIds) => ({
  ...changes,
  ...Object.fromEntries(entryIds.map((entryId) => [entryId, {
    ...(changes[entryId] ?? {}),
    entry_type: "Vow",
    evaluator_class: "declared_vow",
    gates: { declared_vow_required: true, required_steward: null, requires_golden_disabled: false },
  }])),
});
const milestone2FullChanges = { ...baseChanges, ...milestone2Changes };
const vow4Changes = withVows(milestone2FullChanges, ["LE-009", "LE-014", "LE-041", "LE-049"]);
const vow6Changes = withVows(milestone2FullChanges, ["LE-006", "LE-009", "LE-014", "LE-025", "LE-041", "LE-049"]);
const vow8Changes = withVows(milestone2FullChanges, ["LE-006", "LE-009", "LE-011", "LE-014", "LE-025", "LE-041", "LE-043", "LE-049"]);
const vowLateChanges = withVows({
  ...vow4Changes,
  "LE-004": { thresholds_by_player_count: { 1: 2, 2: 6, 3: 10, 4: 14 }, unlock_gate: 20 },
  "LE-007": { thresholds_by_player_count: { 1: 4, 2: 5, 3: 7, 4: 8 } },
  "LE-008": { thresholds_by_player_count: { 1: 5, 2: 6, 3: 7, 4: 8 } },
  "LE-009": { tuning: { target_weight: 2 } },
  "LE-013": { thresholds_by_player_count: { 1: 3, 2: 5, 3: 7, 4: 8 } },
  "LE-014": { thresholds_by_player_count: { 1: 4, 2: 6, 3: 8, 4: 9 }, tuning: { target_weight: 4 } },
  "LE-018": { thresholds_by_player_count: { 1: 2, 2: 4, 3: 6, 4: 8 } },
  "LE-023": { thresholds_by_player_count: { 1: 65, 2: 75, 3: 75, 4: 80 }, tuning: { target_weight: 4 }, unlock_gate: 20 },
  "LE-024": { tuning: { category_count_by_player: { 1: 1, 2: 1, 3: 2, 4: 2 } }, pacing_band: "Foundation", unlock_gate: 0 },
  "LE-026": { unlock_gate: 20 },
  "LE-027": { unlock_gate: 20 },
  "LE-028": { unlock_gate: 20 },
  "LE-030": { unlock_gate: 20 },
  "LE-037": { tuning: { resource_types_by_player: { 1: 4, 2: 4, 3: 5, 4: 6 }, resource_amount: 10 }, unlock_gate: 10 },
  "LE-039": { tuning: { progress_per_player_by_player: { 1: 1, 2: 1, 3: 2, 4: 2 } } },
  "LE-041": { tuning: { max_active_burdens: 0, target_weight: 3 }, unlock_gate: 10 },
  "LE-045": { thresholds_by_player_count: { 1: 3, 2: 3, 3: 3, 4: 3 }, tuning: { target_weight: 6 }, unlock_gate: 20 },
  "LE-046": { pacing_band: "Capstone", unlock_gate: 20 },
  "LE-047": { tuning: { resource_amount: 10, target_weight: 5 }, unlock_gate: 20 },
  "LE-049": { thresholds_by_player_count: { 1: 8, 2: 10, 3: 12, 4: 14 }, tuning: { target_weight: 5 } },
}, ["LE-009", "LE-014", "LE-041", "LE-043", "LE-045", "LE-047", "LE-049"]);
const targetWeights = {
  "LE-001": -5, "LE-002": -5, "LE-003": -5, "LE-004": -5, "LE-005": -4, "LE-006": -4,
  "LE-007": 2, "LE-008": 3, "LE-009": -4, "LE-010": 2, "LE-011": -3, "LE-012": 2,
  "LE-013": 3, "LE-014": 2, "LE-015": -4, "LE-016": 2, "LE-017": 2, "LE-018": -4,
  "LE-019": 2, "LE-020": 2, "LE-021": 2, "LE-022": -4, "LE-023": -5, "LE-024": 3,
  "LE-025": 2, "LE-026": -5, "LE-027": -5, "LE-028": -5, "LE-029": -4, "LE-030": -5,
  "LE-031": 1, "LE-032": 2, "LE-033": 2, "LE-034": 2, "LE-035": 2, "LE-036": 2,
  "LE-037": -3, "LE-038": 1, "LE-039": 2, "LE-040": -4, "LE-041": -4, "LE-042": -5,
  "LE-043": 2, "LE-044": -4, "LE-045": -5, "LE-046": -5, "LE-047": -4, "LE-048": -4,
  "LE-049": 2, "LE-050": -3,
};
const changes = variant === "vowLate" ? vowLateChanges : variant === "vow8" ? vow8Changes : variant === "vow6" ? vow6Changes : variant === "vow4" ? vow4Changes : variant === "milestone2" ? milestone2FullChanges : variant === "milestone" ? { ...baseChanges, ...milestoneChanges } : variant === "v6" ? { ...baseChanges, ...v6Changes } : variant === "v5" ? { ...baseChanges, ...v5Changes } : variant === "v3" ? { ...baseChanges, ...v3Changes } : variant === "v2" ? { ...baseChanges, ...v2Changes } : baseChanges;

const candidate = specs.map((spec) => {
  const change = changes[spec.entry_id] ?? {};
  const tuning = { ...(spec.tuning ?? {}), ...(change.tuning ?? {}) };
  if (variant === "v4") tuning.target_weight = targetWeights[spec.entry_id] ?? 0;
  if (variant === "tiered") {
    const pacingBand = Object.entries(tierAssignments).find(([, entryIds]) => entryIds.includes(spec.entry_id))?.[0] ?? "Capstone";
    return { ...spec, pacing_band: pacingBand, unlock_gate: tierGate[pacingBand] };
  }
  return { ...spec, ...change, ...(Object.keys(tuning).length ? { tuning } : {}) };
});
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, "ledger_entry_specs.json"), JSON.stringify(candidate, null, 2) + "\n");
await fs.writeFile(path.join(outputDir, "candidate_changes.json"), JSON.stringify({ variant, changes }, null, 2) + "\n");

console.log(JSON.stringify({ variant, entries: candidate.length, changed_entries: Object.keys(changes).length, output_dir: outputDir }, null, 2));

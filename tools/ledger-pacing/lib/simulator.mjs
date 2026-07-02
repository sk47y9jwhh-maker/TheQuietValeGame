import { evaluateLedger, stewardNames } from "./evaluator.mjs";
import { validateGameLogRules } from "./validation.mjs";

const TERRAIN_ROWS = [
  ["Mountains","Mountains","Mountains","Water/River","Grasslands","Grasslands","Woodland","Woodland","Woodland","Grasslands","Grasslands","Arable Land","Arable Land","Arable Land"],
  ["Grasslands","Grasslands","Grasslands","Water/River","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands"],
  ["Heaths","Heaths","Grasslands","Grasslands","Water/River","Water/River","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Heaths"],
  ["Heaths","Grasslands","Grasslands","Grasslands","Water/River","Ruins","Water/River","Water/River","Grasslands","Grasslands","Grasslands","Grasslands","Heaths","Heaths"],
  ["Grasslands","Grasslands","Grasslands","Grasslands","Water/River","Ruins","Ruins","Grasslands","Water/River","Water/River","Grasslands","Grasslands","Grasslands","Grasslands"],
  ["Arable Land","Arable Land","Grasslands","Grasslands","Water/River","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Water/River","Water/River","Grasslands","Mountains"],
  ["Arable Land","Grasslands","Grasslands","Grasslands","Water/River","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Water/River","Mountains","Mountains"],
  ["Grasslands","Woodland","Grasslands","Grasslands","Water/River","Water/River","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Grasslands","Water/River","Water/River"],
  ["Woodland","Woodland","Grasslands","Grasslands","Grasslands","Grasslands","Water/River","Water/River","Grasslands","Ruins","Ruins","Ruins","Grasslands","Grasslands"],
];
const COLUMNS = "ABCDEFGHIJKLMN".split("");
const MAP = new Map(TERRAIN_ROWS.flatMap((row, rowIndex) => row.map((terrain, colIndex) => [`${COLUMNS[colIndex]}${rowIndex + 1}`, { terrain, colIndex, row: rowIndex + 1 }])));
const GOLDEN_UNLOCKS = [
  { threshold: 5, tile: "The Golden Charter", boon: "The Golden Bell" },
  { threshold: 10, tile: "The Golden Hearth", boon: "The Golden Scroll" },
  { threshold: 15, tile: "The Golden River Gate", boon: "The Golden Vial" },
  { threshold: 20, tile: "The Golden Cairn", boon: "The Golden-Eyed Traveller" },
  { threshold: 30, tile: "The Golden Garden", boon: "The Golden Signet Ring" },
];

function seedHash(text) {
  let value = 2166136261;
  for (const char of String(text)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function createRandom(seed) {
  let value = seedHash(seed);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value) { return Math.max(0, Math.round(value)); }
function sample(random, values) { return values[Math.floor(random() * values.length)]; }
function shuffled(random, values) { return [...values].sort(() => random() - 0.5); }

function neighborIds(hexId) {
  const cell = MAP.get(hexId);
  if (!cell) return [];
  const parity = cell.colIndex % 2;
  const deltas = parity === 0
    ? [[-1,-1],[0,-1],[-1,0],[1,0],[-1,1],[0,1]]
    : [[0,-1],[1,-1],[-1,0],[1,0],[0,1],[1,1]];
  return deltas.map(([rowDelta, colDelta]) => `${COLUMNS[cell.colIndex + colDelta] ?? ""}${cell.row + rowDelta}`).filter((id) => MAP.has(id));
}

function randomWarehouse(random, total) {
  const result = { Wood: 0, Stone: 0, Metal: 0, Food: 0, Herbs: 0, Goods: 0 };
  const keys = Object.keys(result);
  let remaining = clamp(round(total), 0, 90);
  while (remaining > 0 && keys.some((key) => result[key] < 15)) {
    const key = sample(random, keys.filter((candidate) => result[candidate] < 15));
    result[key] += 1;
    remaining -= 1;
  }
  return result;
}

function categoryCounts(raw) {
  return {
    Resource: round(raw.placed_resource_tiles),
    Housing: round(raw.placed_housing_tiles),
    Crafting: round(raw.placed_crafting_tiles),
    Merchant: round(raw.placed_merchant_tiles),
    Social: round(raw.placed_social_tiles),
    Wellbeing: round(raw.placed_wellbeing_tiles),
    Travel: round(raw.placed_travel_tiles),
    Special: round(raw.placed_special_tiles),
    Golden: 0,
  };
}

function threshold(spec, playerCount) { return spec.thresholds_by_player_count?.[String(playerCount)] ?? 0; }

function targetChance(spec, profile, gameIndex, goldenEnabled) {
  const baseByBand = { Foundation: 0.68, Standard: 0.56, Directed: 0.38, Capstone: 0.2 };
  let chance = baseByBand[spec.pacing_band] ?? 0.35;
  if (profile === "achievement_chaser") chance += 0.18;
  if (profile === "guided_ledger") chance += Math.min(0.12, gameIndex * 0.012);
  if (goldenEnabled) chance += 0.05;
  return clamp(chance, 0.08, 0.9);
}

function applyTarget(spec, outcome, success) {
  const id = spec.entry_id;
  const target = threshold(spec, outcome.playerCount);
  const near = Math.max(0, target - 1);
  const value = success ? target : near;
  switch (id) {
    case "LE-001": outcome.score = Math.max(outcome.score, value); break;
    case "LE-002": outcome.population = Math.max(outcome.population, value); break;
    case "LE-003": outcome.renown = Math.max(outcome.renown, value); break;
    case "LE-004": outcome.activeBurdens = success ? 0 : 1; outcome.overstrained = success ? 0 : 1; outcome.strain = Math.min(outcome.strain, value); break;
    case "LE-005": outcome.intentions.add(success ? "ring" : "near_ring"); break;
    case "LE-006": outcome.intentions.add(success ? "mixed_ring" : "near_ring"); break;
    case "LE-007": outcome.categories.Housing = Math.max(outcome.categories.Housing, value); outcome.intentions.add(success ? "housing_pairs" : "housing_scattered"); break;
    case "LE-008":
    case "LE-009": outcome.intentions.add(success ? `categories_${target}` : `categories_${near}`); break;
    case "LE-010": outcome.intentions.add(success ? "river_bridge" : "river_sides"); break;
    case "LE-011": outcome.intentions.add(success ? "river_housing" : "river_bridge"); break;
    case "LE-012": outcome.intentions.add("river_travel"); outcome.categories.Travel = Math.max(outcome.categories.Travel, value); break;
    case "LE-013":
    case "LE-014": outcome.categories.Special = Math.max(outcome.categories.Special, value); break;
    case "LE-015": outcome.categories.Special = Math.max(outcome.categories.Special, value); outcome.unlockedSpecialUnplaced = success ? 0 : 1; break;
    case "LE-016": outcome.arrivalsExpired = success ? 0 : Math.max(1, outcome.arrivalsExpired); break;
    case "LE-017": outcome.activeBurdens = success ? 0 : 1; break;
    case "LE-018": outcome.overstrained = success ? 0 : 1; outcome.strain = Math.min(outcome.strain, value); break;
    case "LE-019":
    case "LE-044": outcome.strainPrevented = Math.max(outcome.strainPrevented, value); break;
    case "LE-020": outcome.housingOverstrained = success ? 0 : 1; outcome.maxHousingStrain = success ? 1 : 2; break;
    case "LE-021":
    case "LE-022": outcome.upgrades = Math.max(outcome.upgrades, value); break;
    case "LE-023": outcome.warehouseTotal = Math.max(outcome.warehouseTotal, value); break;
    case "LE-024": outcome.categories.Crafting = Math.max(1, outcome.categories.Crafting); outcome.categories.Merchant = Math.max(1, outcome.categories.Merchant); break;
    case "LE-025": outcome.categories.Travel = Math.max(outcome.categories.Travel, value); outcome.intentions.add("travel_chain"); break;
    case "LE-026": outcome.categories.Travel = success ? 0 : 1; outcome.score = Math.max(outcome.score, value); break;
    case "LE-027": outcome.farmsteadTiles = success ? 0 : 1; outcome.score = Math.max(outcome.score, value); break;
    case "LE-028": outcome.upgrades = success ? 0 : 1; outcome.score = Math.max(outcome.score, value); break;
    case "LE-029": outcome.arrivalsExpired = success ? 0 : 1; break;
    case "LE-030": outcome.warehousePeakCap = success ? 8 : 9; break;
    case "LE-031": outcome.rotateSteward = true; break;
    case "LE-032": outcome.requiredSteward = "Vanguard"; outcome.intentions.add(success ? "river_bridge" : "river_sides"); break;
    case "LE-033": outcome.requiredSteward = "Knight"; outcome.intentions.add("housing_cluster"); outcome.housingOverstrained = success ? 0 : 1; break;
    case "LE-034": outcome.requiredSteward = "Sentinel"; outcome.upgrades = Math.max(outcome.upgrades, success ? 5 : 4); break;
    case "LE-035": outcome.requiredSteward = "Ranger"; outcome.intentions.add(success ? "terrain_spread_4" : "terrain_spread_3"); break;
    case "LE-036": outcome.requiredSteward = "Warden"; outcome.activeBurdens = success ? 0 : 1; break;
    case "LE-037": outcome.requiredSteward = "Quartermaster"; outcome.intentions.add(success ? "warehouse_3x5" : "warehouse_2x5"); break;
    case "LE-038": outcome.rotateSteward = true; outcome.forceStewardObjective = success; break;
    case "LE-039": outcome.season1Success = success; break;
    case "LE-040": outcome.season2Success = success; break;
    case "LE-041": outcome.overstrained = success ? 0 : 1; outcome.activeBurdens = success ? Math.max(0, outcome.playerCount - 1) : outcome.playerCount; break;
    case "LE-042": outcome.strain = success ? 0 : 1; break;
    case "LE-043": outcome.burdensResolved = success ? Math.ceil(outcome.burdensRevealed * 2 / 3) : Math.max(0, Math.ceil(outcome.burdensRevealed * 2 / 3) - 1); break;
    case "LE-045": outcome.intentions.add(success ? "warehouse_3x10" : "warehouse_2x10"); break;
    case "LE-046": outcome.warehouseTotal = success ? 2 : 3; outcome.score = Math.max(outcome.score, value); break;
    case "LE-047": outcome.intentions.add(success ? "warehouse_wsf8" : "warehouse_wsf7"); break;
    case "LE-048": outcome.intentions.add(success ? "district_housing" : "partial_district"); break;
    case "LE-049": outcome.categories.Travel = Math.max(outcome.categories.Travel, value); outcome.intentions.add(success ? "travel_chain" : "travel_split"); break;
    case "LE-050": outcome.categories.Special = Math.max(outcome.categories.Special, success ? 3 : 2); outcome.categories.Housing = Math.max(outcome.categories.Housing, 2); outcome.intentions.add(success ? "special_housing" : "special_scattered"); break;
  }
}

function addAssignment(assignments, hexId, category, name = category) {
  if (!MAP.has(hexId)) return;
  assignments.set(hexId, { category, name });
}

function buildBoard(random, outcome) {
  const assignments = new Map();
  const intentions = outcome.intentions;
  if (intentions.has("ring") || intentions.has("mixed_ring")) {
    const categories = intentions.has("mixed_ring") ? ["Housing","Social","Wellbeing","Housing","Merchant","Crafting"] : ["Housing","Housing","Crafting","Merchant","Social","Wellbeing"];
    neighborIds("H6").forEach((hexId, index) => addAssignment(assignments, hexId, categories[index]));
  } else if (intentions.has("near_ring")) {
    neighborIds("H6").slice(0, 5).forEach((hexId, index) => addAssignment(assignments, hexId, index < 3 ? "Housing" : "Crafting"));
  }
  if (intentions.has("river_bridge") || intentions.has("river_housing")) {
    addAssignment(assignments, "D1", "Travel", "Bridge");
    addAssignment(assignments, "C1", "Housing");
    addAssignment(assignments, "E1", intentions.has("river_housing") ? "Housing" : "Social");
  } else if (intentions.has("river_sides")) {
    addAssignment(assignments, "C1", "Housing"); addAssignment(assignments, "E1", "Social");
  }
  if (intentions.has("river_travel")) {
    ["C2","E2","D3","G3","F4","I4"].slice(0, outcome.categories.Travel).forEach((id) => addAssignment(assignments, id, "Travel"));
  }
  if (intentions.has("travel_chain")) {
    ["G6","H6","I6","J6","K6","L6","M6","N6","N5","M5","L5","K5","J5","I5","H5","G5"].slice(0, outcome.categories.Travel).forEach((id) => addAssignment(assignments, id, "Travel"));
  }
  if (intentions.has("travel_split")) {
    ["A2","B2","C2","L8","M8","N8"].slice(0, outcome.categories.Travel).forEach((id) => addAssignment(assignments, id, "Travel"));
  }
  if (intentions.has("special_housing")) {
    [["J2","K2"],["J3","K3"],["J4","K4"]].forEach(([special, housing]) => { addAssignment(assignments, special, "Special"); addAssignment(assignments, housing, "Housing"); });
  }
  if (intentions.has("district_housing")) {
    [["F6","G6","Crafting"],["F7","G7","Merchant"],["F8","G8","Social"],["F9","G9","Wellbeing"]].forEach(([district, housing, category]) => { addAssignment(assignments, district, category); addAssignment(assignments, housing, "Housing"); });
  }
  if (intentions.has("housing_cluster") || intentions.has("housing_pairs")) {
    ["K2","K3","L2","L3","M2","M3","N2","N3","J2","J3"].slice(0, outcome.categories.Housing).forEach((id) => addAssignment(assignments, id, "Housing"));
  }

  const desiredCategories = { ...outcome.categories };
  for (const assignment of assignments.values()) desiredCategories[assignment.category] = Math.max(0, (desiredCategories[assignment.category] ?? 0) - 1);
  const categoryQueue = shuffled(random, Object.entries(desiredCategories).flatMap(([category, count]) => Array(round(count)).fill(category)));
  const occupied = new Set(assignments.keys());
  const frontier = ["H5", ...assignments.keys()];
  while (categoryQueue.length && occupied.size < MAP.size) {
    const category = categoryQueue.pop();
    const legalTerrain = (id) => {
      const terrain = MAP.get(id).terrain;
      if (terrain === "Water/River") return false;
      if (category === "Resource") return ["Woodland", "Mountains", "Heaths", "Arable Land"].includes(terrain);
      return true;
    };
    const anchor = sample(random, frontier);
    const candidates = neighborIds(anchor).filter((id) => !occupied.has(id) && legalTerrain(id));
    const hexId = candidates.length ? sample(random, candidates) : sample(random, [...MAP.keys()].filter((id) => !occupied.has(id) && legalTerrain(id)));
    if (!hexId) continue;
    addAssignment(assignments, hexId, category);
    occupied.add(hexId);
    frontier.push(hexId);
  }

  const tileEntries = [...assignments.entries()];
  const overstrainedIds = new Set(shuffled(random, tileEntries.map(([id]) => id)).slice(0, Math.min(outcome.overstrained, tileEntries.length)));
  let remainingStrain = outcome.strain;
  const tiles = tileEntries.map(([coord, assignment], index) => {
    const forced = overstrainedIds.has(coord) ? 3 : 0;
    remainingStrain = Math.max(0, remainingStrain - forced);
    return {
      coord,
      tile_id: `SIM-${String(index + 1).padStart(3, "0")}`,
      name: assignment.name,
      category: assignment.category,
      terrain: MAP.get(coord).terrain,
      is_upgraded: false,
      is_overstrained: forced === 3,
      strain: forced,
      supported: false,
      is_special: assignment.category === "Special",
      is_golden: assignment.category === "Golden",
      adjacent_coords: neighborIds(coord),
      adjacent_to_river_water: neighborIds(coord).some((id) => MAP.get(id)?.terrain === "Water/River"),
      river_side: COLUMNS.indexOf(coord[0]) <= 3 ? "west" : "east",
    };
  });
  for (const tile of shuffled(random, tiles.filter((item) => !item.is_overstrained))) {
    if (remainingStrain <= 0) break;
    const amount = Math.min(2, remainingStrain);
    tile.strain = amount;
    remainingStrain -= amount;
  }
  const upgradeCandidates = tiles.filter((tile) => !["Special", "Golden"].includes(tile.category));
  shuffled(random, upgradeCandidates).slice(0, outcome.upgrades).forEach((tile) => { tile.is_upgraded = true; });
  return tiles;
}

function connectedGroups(tiles, predicate) {
  const byCoord = new Map(tiles.filter(predicate).map((tile) => [tile.coord, tile]));
  const groups = [];
  const seen = new Set();
  for (const coord of byCoord.keys()) {
    if (seen.has(coord)) continue;
    const group = [];
    const queue = [coord];
    seen.add(coord);
    while (queue.length) {
      const current = queue.shift();
      group.push(current);
      for (const neighbor of neighborIds(current)) {
        if (byCoord.has(neighbor) && !seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
      }
    }
    groups.push(group);
  }
  return groups;
}

function deriveBoardFeatures(tiles) {
  const byCoord = new Map(tiles.map((tile) => [tile.coord, tile]));
  const active = tiles.filter((tile) => !tile.is_overstrained);
  const rings = [];
  const mixedRings = [];
  for (const center of MAP.keys()) {
    const neighbors = neighborIds(center);
    if (neighbors.length !== 6 || !neighbors.every((id) => byCoord.has(id) && !byCoord.get(id).is_overstrained)) continue;
    rings.push(neighbors);
    const preferred = neighbors.filter((id) => ["Housing", "Social", "Wellbeing"].includes(byCoord.get(id).category)).length;
    if (preferred >= 3) mixedRings.push(neighbors);
  }
  const housing = active.filter((tile) => tile.category === "Housing");
  const travelGroups = connectedGroups(active, (tile) => tile.category === "Travel");
  const bridgeTiles = active.filter((tile) => tile.name.includes("Bridge") && tile.terrain === "Water/River");
  const developedWest = active.some((tile) => tile.river_side === "west" && tile.terrain !== "Water/River");
  const developedEast = active.some((tile) => tile.river_side === "east" && tile.terrain !== "Water/River");
  const bridgeConnected = bridgeTiles.some((bridge) => neighborIds(bridge.coord).some((id) => byCoord.get(id)?.river_side === "west") && neighborIds(bridge.coord).some((id) => byCoord.get(id)?.river_side === "east"));
  const categoriesAdjacentToHousing = [...new Set(active.filter((tile) => tile.category !== "Housing" && neighborIds(tile.coord).some((id) => byCoord.get(id)?.category === "Housing" && !byCoord.get(id).is_overstrained)).map((tile) => tile.category))];
  return {
    settlement_components: connectedGroups(active, () => true),
    housing_clusters: connectedGroups(active, (tile) => tile.category === "Housing"),
    travel_groups: travelGroups,
    complete_six_tile_rings: rings,
    qualifying_mixed_six_tile_rings: mixedRings,
    river_connected_sides: developedWest && developedEast && bridgeConnected,
    housing_on_both_river_sides_connected: bridgeConnected && housing.some((tile) => tile.river_side === "west") && housing.some((tile) => tile.river_side === "east"),
    all_non_overstrained_housing_has_housing_neighbor: housing.length > 0 && housing.every((tile) => neighborIds(tile.coord).some((id) => byCoord.get(id)?.category === "Housing" && !byCoord.get(id).is_overstrained)),
    non_overstrained_travel_hexes_adjacent_to_river: active.filter((tile) => tile.category === "Travel" && tile.adjacent_to_river_water).length,
    terrain_types_with_non_overstrained_tiles: [...new Set(active.map((tile) => tile.terrain))],
    occupied_non_grasslands_non_river_terrain_types: new Set(active.map((tile) => tile.terrain).filter((terrain) => !["Grasslands", "Water/River"].includes(terrain))).size,
    categories_adjacent_to_housing: categoriesAdjacentToHousing,
    special_tiles_adjacent_to_housing: active.filter((tile) => tile.category === "Special" && neighborIds(tile.coord).some((id) => byCoord.get(id)?.category === "Housing" && !byCoord.get(id).is_overstrained)).length,
    largest_connected_travel_group: Math.max(0, ...travelGroups.map((group) => group.length)),
  };
}

function chooseStewards(random, playerCount, outcome, campaignState) {
  if (outcome.requiredSteward) {
    return [outcome.requiredSteward, ...shuffled(random, stewardNames.filter((name) => name !== outcome.requiredSteward))].slice(0, playerCount);
  }
  if (outcome.rotateSteward) {
    const used = new Set(campaignState.chosen_stewards ?? []);
    return [...stewardNames.filter((name) => !used.has(name)), ...stewardNames.filter((name) => used.has(name))].slice(0, playerCount);
  }
  return shuffled(random, stewardNames).slice(0, playerCount);
}

function chooseTargets(specs, profile, gameIndex, campaignState, previousEvaluation, random) {
  if (profile === "passive_normal") return [];
  const completed = new Set(campaignState.completed_named_entries ?? []);
  const previousNearMisses = new Set((previousEvaluation?.near_misses ?? []).map((item) => item.entry_id));
  const candidates = specs.filter((spec) => !completed.has(spec.entry_id)).map((spec) => {
    let score = 5 + random();
    if (previousNearMisses.has(spec.entry_id)) score += 4;
    if (spec.pacing_band === "Foundation" && gameIndex <= 5) score += 1.5;
    if (spec.pacing_band === "Directed" && gameIndex >= 4) score += 1;
    if (spec.pacing_band === "Capstone" && gameIndex < 7) score -= 3;
    if (profile === "achievement_chaser") score += ({ Foundation: 4, Standard: 3, Directed: 1, Capstone: 0 }[spec.pacing_band] ?? 0);
    if (spec.gates.declared_vow_required && profile === "guided_ledger") score -= 1;
    return { spec, score };
  }).sort((a, b) => b.score - a.score);
  const limit = profile === "achievement_chaser" ? 3 : gameIndex === 1 ? 1 : 2;
  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (candidate.spec.gates.declared_vow_required && selected.some((spec) => spec.gates.declared_vow_required)) continue;
    selected.push(candidate.spec);
  }
  return selected;
}

function unlockedGolden(completedCount) {
  return [...GOLDEN_UNLOCKS].reverse().find((unlock) => completedCount >= unlock.threshold) ?? null;
}

export function simulateGame({ specs, rawGames, playerCount, profile, campaignId, gameIndex, seed, campaignState, previousEvaluation, goldenEnabled = true }) {
  const random = createRandom(seed);
  const source = sample(random, rawGames.filter((row) => row.player_count === playerCount));
  const completedCount = campaignState.completed_named_entries.length;
  const unlocked = unlockedGolden(completedCount);
  const useGolden = Boolean(unlocked && goldenEnabled && (profile !== "passive_normal" || random() < 0.45));
  const targets = chooseTargets(specs, profile, gameIndex, campaignState, previousEvaluation, random);
  const outcome = {
    playerCount,
    score: round(source.final_score * (0.94 + random() * 0.12)),
    population: round(source.final_population * (0.92 + random() * 0.16)),
    renown: round(source.final_renown * (0.92 + random() * 0.16)),
    activeBurdens: clamp(round(source.final_active_burdens + (random() - 0.5) * 2), 0, playerCount * 4),
    strain: clamp(round(source.final_strain_tokens + (random() - 0.5) * 4), 0, 80),
    overstrained: clamp(round(source.final_overstrained_tiles), 0, 12),
    arrivalsCompleted: clamp(round(source.arrivals_completed), 0, playerCount * 4),
    arrivalsExpired: clamp(round(source.arrivals_expired), 0, playerCount * 4),
    upgrades: round(source.total_upgrade_actions),
    warehouseTotal: round(source.final_warehouse_total),
    categories: categoryCounts(source),
    strainPrevented: round(source.total_strain_prevented_by_supported),
    housingOverstrained: source.final_overstrained_tiles > 0 ? 1 : 0,
    maxHousingStrain: source.final_overstrained_tiles > 0 ? 3 : source.final_strain_tokens > 0 ? 2 : 0,
    farmsteadTiles: Math.max(0, Math.round(source.placed_resource_tiles / 4)),
    unlockedSpecialUnplaced: Math.max(0, round(source.arrivals_completed) - round(source.placed_special_tiles)),
    burdensRevealed: playerCount * 4,
    burdensResolved: Math.max(0, playerCount * 4 - round(source.final_active_burdens)),
    warehousePeakCap: 15,
    intentions: new Set(),
    requiredSteward: null,
    rotateSteward: false,
    forceStewardObjective: false,
    season1Success: random() < 0.35,
    season2Success: random() < 0.3,
  };

  if (profile === "achievement_chaser") outcome.score = round(outcome.score * 0.94);
  if (useGolden) {
    outcome.score += 4;
    outcome.categories.Golden = 1;
  }
  for (const spec of targets) {
    const success = random() < targetChance(spec, profile, gameIndex, useGolden);
    applyTarget(spec, outcome, success);
  }

  let warehouse = randomWarehouse(random, outcome.warehouseTotal);
  if (outcome.intentions.has("warehouse_3x5")) Object.assign(warehouse, { Wood: 5, Stone: 5, Food: 5 });
  if (outcome.intentions.has("warehouse_2x5")) Object.assign(warehouse, { Wood: 5, Stone: 5 });
  if (outcome.intentions.has("warehouse_3x10")) Object.assign(warehouse, { Wood: 10, Stone: 10, Food: 10 });
  if (outcome.intentions.has("warehouse_2x10")) Object.assign(warehouse, { Wood: 10, Stone: 10 });
  if (outcome.intentions.has("warehouse_wsf8")) Object.assign(warehouse, { Wood: 8, Stone: 8, Food: 8 });
  if (outcome.intentions.has("warehouse_wsf7")) Object.assign(warehouse, { Wood: 7, Stone: 7, Food: 7 });
  outcome.warehouseTotal = Object.values(warehouse).reduce((sum, value) => sum + value, 0);

  const boardTiles = buildBoard(random, outcome);
  const derived = deriveBoardFeatures(boardTiles);
  const activeTiles = boardTiles.filter((tile) => !tile.is_overstrained);
  const counts = Object.fromEntries(["Resource","Housing","Crafting","Merchant","Social","Wellbeing","Travel","Special","Golden"].map((category) => [category, activeTiles.filter((tile) => tile.category === category).length]));
  const chosenStewards = chooseStewards(random, playerCount, outcome, campaignState);
  const objectiveCompleted = chosenStewards.filter((name) => {
    if (outcome.forceStewardObjective && name === outcome.requiredSteward) return true;
    if (name === "Vanguard") return derived.river_connected_sides;
    if (name === "Knight") return derived.housing_clusters.some((group) => group.length >= 3);
    if (name === "Sentinel") return activeTiles.filter((tile) => tile.is_upgraded && !["Special","Golden"].includes(tile.category)).length >= 5;
    if (name === "Ranger") return derived.occupied_non_grasslands_non_river_terrain_types >= 3;
    if (name === "Warden") return outcome.activeBurdens === 0;
    if (name === "Quartermaster") return Object.values(warehouse).filter((value) => value >= 5).length >= 3;
    return false;
  });
  const totalActions = playerCount * 48;
  const placeActions = Math.min(totalActions, Math.max(0, boardTiles.length - (useGolden ? 1 : 0)));
  const upgradeActions = Math.min(outcome.upgrades, Math.max(0, totalActions - placeActions));
  const interactActions = Math.min(outcome.arrivalsCompleted + outcome.burdensResolved, Math.max(0, totalActions - placeActions - upgradeActions));
  const activateActions = Math.max(0, totalActions - placeActions - upgradeActions - interactActions);
  const declaredVows = targets.filter((spec) => spec.gates.declared_vow_required).map((spec) => spec.entry_id);
  const peak = Object.fromEntries(Object.entries(warehouse).map(([key, value]) => [key, Math.min(outcome.warehousePeakCap, Math.max(value, outcome.warehousePeakCap === 8 ? 8 : value + round(random() * 5)))]));
  const standardReveals = playerCount * 12;

  const log = {
    campaign_id: campaignId,
    game_index: gameIndex,
    seed,
    player_count: playerCount,
    strategy_profile: profile,
    chosen_stewards: chosenStewards,
    declared_vows: declaredVows,
    targeted_ledger_entries: targets.map((spec) => spec.entry_id),
    target_attempts: [],
    golden_tile_used: useGolden ? unlocked.tile : null,
    golden_boon_used: useGolden ? unlocked.boon : null,
    golden_boons_revealed: useGolden ? [unlocked.boon] : [],
    golden_content_enabled: useGolden,
    unlock_count_start: completedCount,
    unlock_count_end: completedCount,
    warehouse_peak_by_resource: peak,
    final: {
      score: outcome.score,
      population: outcome.population,
      renown: outcome.renown,
      active_burdens: outcome.activeBurdens,
      strain_tokens: boardTiles.reduce((sum, tile) => sum + tile.strain, 0),
      overstrained_tiles: boardTiles.filter((tile) => tile.is_overstrained).length,
      warehouse_total: outcome.warehouseTotal,
      warehouse_by_resource: warehouse,
    },
    encounters: {
      boons_revealed: playerCount * 4,
      burdens_revealed: playerCount * 4,
      burdens_resolved_or_removed: clamp(outcome.burdensResolved, 0, playerCount * 4),
      arrivals_revealed: playerCount * 4,
      arrivals_completed: outcome.arrivalsCompleted,
      arrivals_expired: Math.min(playerCount * 4 - outcome.arrivalsCompleted, outcome.arrivalsExpired),
      special_tiles_unlocked: outcome.arrivalsCompleted,
      special_tiles_placed: counts.Special,
      unlocked_special_tiles_unplaced: Math.max(outcome.unlockedSpecialUnplaced, outcome.arrivalsCompleted - counts.Special),
      standard_reveals: standardReveals,
      golden_bonus_reveals: useGolden ? 1 : 0,
      total_reveals: standardReveals + (useGolden ? 1 : 0),
      player_hands: Object.fromEntries(Array.from({ length: playerCount }, (_, index) => [`player_${index + 1}`, Array.from({ length: 9 }, (__, cardIndex) => `standard_${index + 1}_${cardIndex + 1}`)])),
    },
    actions: { place_actions: placeActions, upgrade_actions: upgradeActions, activate_actions: activateActions, encounter_interact_actions: interactActions, steward_power_uses: round(playerCount * (1.2 + random() * 1.2)), free_place_effects_used: useGolden ? 1 : 0 },
    stewards: { objectives_completed: objectiveCompleted, powers_used_by_steward: Object.fromEntries(chosenStewards.map((name) => [name, round(random() * 3)])) },
    tile_counts: {
      placed_total: boardTiles.length,
      placed_by_category: counts,
      placed_housing_tiles: counts.Housing,
      placed_travel_tiles: counts.Travel,
      placed_path_tiles: boardTiles.filter((tile) => tile.name === "Path").length,
      placed_street_tiles: 0,
      placed_track_tiles: 0,
      placed_special_tiles: counts.Special,
      upgraded_core_tiles: boardTiles.filter((tile) => tile.is_upgraded).length,
      upgraded_non_overstrained_core_tiles: activeTiles.filter((tile) => tile.is_upgraded && !["Special","Golden"].includes(tile.category)).length,
      non_overstrained_categories: Object.values(counts).filter((count) => count > 0).length,
      farmstead_tiles: outcome.farmsteadTiles,
    },
    support_and_strain: { strain_prevented_by_supported: outcome.strainPrevented, strain_removed: round(random() * (playerCount + 2)), max_strain_on_housing: outcome.maxHousingStrain, housing_overstrained_count: outcome.housingOverstrained },
    season_snapshots: {
      end_season_1: { active_burdens: outcome.season1Success ? Math.max(0, playerCount - 1) : playerCount, overstrained_tiles: outcome.season1Success ? 0 : 1, arrivals_completed_this_season: outcome.season1Success ? 1 : 0, burdens_resolved_this_season: 0 },
      end_season_2: { active_burdens: outcome.season2Success ? Math.max(0, playerCount - 1) : playerCount, overstrained_tiles: outcome.season2Success ? 0 : 1, arrivals_completed_this_season: 0, burdens_resolved_this_season: outcome.season2Success ? 1 : 0 },
      end_season_3: { active_burdens: outcome.activeBurdens, overstrained_tiles: outcome.overstrained },
    },
    board: { tiles: boardTiles, bridges: boardTiles.filter((tile) => tile.name.includes("Bridge")).map((tile) => ({ coord: tile.coord, connects_river_sides: derived.river_connected_sides, bridge_type: tile.name })), derived_features: derived },
  };
  const evaluation = evaluateLedger(specs, log, campaignState);
  log.unlock_count_end = completedCount + evaluation.new_named_entries.length;
  log.target_attempts = targets.map((spec) => {
    const result = evaluation.entry_results[spec.entry_id];
    return { entry_id: spec.entry_id, result: result.complete ? "completed" : result.margin !== null ? "near_miss" : "failed", reason: result.reason ?? result.blocked ?? "condition not met" };
  });
  return { log, evaluation, validationErrors: validateGameLogRules(log), sourceGameId: source.game_id };
}

export function runCampaign({ specs, rawGames, playerCount, profile, campaignId, games, seedPrefix, goldenEnabled = true }) {
  const state = { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [] };
  const results = [];
  let previousEvaluation = null;
  for (let gameIndex = 1; gameIndex <= games; gameIndex += 1) {
    const result = simulateGame({ specs, rawGames, playerCount, profile, campaignId, gameIndex, seed: `${seedPrefix}:${gameIndex}`, campaignState: state, previousEvaluation, goldenEnabled });
    results.push(result);
    state.completed_named_entries.push(...result.evaluation.new_named_entries);
    state.completed_named_entries = [...new Set(state.completed_named_entries)];
    state.completed_prestige_boxes.push(...result.evaluation.prestige_boxes_completed.map((box) => `${box.entry_id}:${box.player_count}`));
    state.completed_prestige_boxes = [...new Set(state.completed_prestige_boxes)];
    state.chosen_stewards = [...new Set([...state.chosen_stewards, ...result.log.chosen_stewards])];
    state.completed_steward_objectives = [...new Set([...state.completed_steward_objectives, ...result.log.stewards.objectives_completed])];
    previousEvaluation = result.evaluation;
  }
  return { campaignId, playerCount, profile, state, results };
}

export const goldenUnlocks = GOLDEN_UNLOCKS;

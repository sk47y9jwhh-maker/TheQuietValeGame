const STEWARDS = ["Vanguard", "Knight", "Sentinel", "Ranger", "Warden", "Quartermaster"];

function thresholdFor(spec, playerCount) {
  return spec.thresholds_by_player_count?.[String(playerCount)] ?? null;
}

function includesName(values, name) {
  return (values ?? []).some((value) => String(value).toLowerCase() === name.toLowerCase());
}

function countAtLeast(values, amount) {
  return Object.values(values ?? {}).filter((value) => Number(value) >= amount).length;
}

function numeric(complete, actual, required, reason) {
  return {
    complete,
    actual,
    required,
    margin:
      typeof actual === "number" && typeof required === "number"
        ? actual - required
        : null,
    reason,
  };
}

function booleanResult(complete, reason) {
  return { complete, actual: complete, required: true, margin: null, reason };
}

export function evaluateEntry(spec, gameLog, campaignState = {}) {
  const id = spec.entry_id;
  const playerCount = gameLog.player_count;
  const threshold = thresholdFor(spec, playerCount);
  const final = gameLog.final;
  const encounters = gameLog.encounters;
  const tiles = gameLog.tile_counts;
  const support = gameLog.support_and_strain;
  const board = gameLog.board?.derived_features ?? {};
  const stewards = gameLog.stewards;
  const tuning = spec.tuning ?? {};

  if ((campaignState.completed_named_entries?.length ?? 0) < (spec.unlock_gate ?? 0)) {
    return { complete: false, blocked: "ledger_tier_locked", actual: campaignState.completed_named_entries?.length ?? 0, required: spec.unlock_gate, margin: null };
  }

  if (spec.gates.declared_vow_required && !gameLog.declared_vows.includes(id)) {
    return { complete: false, blocked: "vow_not_declared", actual: null, required: threshold, margin: null };
  }
  if (
    spec.gates.required_steward &&
    !includesName(gameLog.chosen_stewards, spec.gates.required_steward)
  ) {
    return { complete: false, blocked: "required_steward_not_chosen", actual: null, required: spec.gates.required_steward, margin: null };
  }

  switch (id) {
    case "LE-001": return numeric(final.score >= threshold, final.score, threshold, "final score");
    case "LE-002": return numeric(final.population >= threshold, final.population, threshold, "final Population");
    case "LE-003": return numeric(final.renown >= threshold, final.renown, threshold, "final Renown");
    case "LE-004": return numeric(final.active_burdens === 0 && final.overstrained_tiles === 0 && final.strain_tokens <= threshold, final.strain_tokens, threshold, "strain cap with no active Burdens or Overstrained tiles");
    case "LE-005": {
      const required = tuning.required_rings ?? 1;
      return numeric((board.complete_six_tile_rings ?? []).length >= required, (board.complete_six_tile_rings ?? []).length, required, "complete six-tile rings");
    }
    case "LE-006": {
      const required = tuning.required_mixed_rings ?? 1;
      return numeric((board.qualifying_mixed_six_tile_rings ?? []).length >= required, (board.qualifying_mixed_six_tile_rings ?? []).length, required, "qualifying mixed six-tile rings");
    }
    case "LE-007": return numeric(tiles.placed_housing_tiles >= threshold && board.all_non_overstrained_housing_has_housing_neighbor === true, tiles.placed_housing_tiles, threshold, "Housing count and adjacency");
    case "LE-008":
    case "LE-009": return numeric(tiles.non_overstrained_categories >= threshold, tiles.non_overstrained_categories, threshold, "non-Overstrained tile categories");
    case "LE-010": return booleanResult(board.river_connected_sides === true, "Bridge connects developed river sides");
    case "LE-011": return booleanResult(board.housing_on_both_river_sides_connected === true, "Housing on both connected river sides");
    case "LE-012": return numeric(board.non_overstrained_travel_hexes_adjacent_to_river >= threshold, board.non_overstrained_travel_hexes_adjacent_to_river, threshold, "Travel hexes adjacent to River/Water");
    case "LE-013":
    case "LE-014": return numeric(tiles.placed_special_tiles >= threshold, tiles.placed_special_tiles, threshold, "placed Special Tiles");
    case "LE-015": return numeric(encounters.special_tiles_placed >= threshold && encounters.unlocked_special_tiles_unplaced === 0, encounters.special_tiles_placed, threshold, "all unlocked Special Tiles placed");
    case "LE-016": {
      if (!tuning.require_all_arrivals) return numeric(encounters.arrivals_expired === 0, encounters.arrivals_expired, 0, "Arrivals expired");
      const complete = encounters.arrivals_expired === 0 && encounters.arrivals_completed >= encounters.arrivals_revealed && (!tuning.require_no_active_burdens || final.active_burdens === 0);
      return numeric(complete, encounters.arrivals_completed, encounters.arrivals_revealed, "all revealed Arrivals completed");
    }
    case "LE-029": return numeric(encounters.arrivals_expired === 0, encounters.arrivals_expired, 0, "Arrivals expired");
    case "LE-017": return numeric(final.active_burdens === 0 && (!tuning.require_no_overstrained || final.overstrained_tiles === 0), final.active_burdens, 0, "active Burdens");
    case "LE-018": return numeric(final.overstrained_tiles === 0 && final.strain_tokens <= threshold, final.strain_tokens, threshold, "Strain with no Overstrained tiles");
    case "LE-019":
    case "LE-044": return numeric(support.strain_prevented_by_supported >= threshold, support.strain_prevented_by_supported, threshold, "Strain prevented by Supported");
    case "LE-020": return threshold === null
      ? numeric(support.housing_overstrained_count === 0 && support.max_strain_on_housing < 2, support.max_strain_on_housing, 1, "Housing Strain maximum")
      : numeric(tiles.placed_housing_tiles >= threshold && support.housing_overstrained_count === 0 && support.max_strain_on_housing < 2, tiles.placed_housing_tiles, threshold, "Housing count with no Housing at 2+ Strain");
    case "LE-021":
    case "LE-022": return numeric(tiles.upgraded_core_tiles >= threshold, tiles.upgraded_core_tiles, threshold, "Core Tile upgrades");
    case "LE-023": return numeric(final.warehouse_total >= threshold, final.warehouse_total, threshold, "Warehouse total");
    case "LE-024": {
      const required = tuning.category_count_by_player?.[String(playerCount)] ?? tuning.category_count ?? 1;
      return numeric((tiles.placed_by_category.Crafting ?? 0) >= required && (tiles.placed_by_category.Merchant ?? 0) >= required, Math.min(tiles.placed_by_category.Crafting ?? 0, tiles.placed_by_category.Merchant ?? 0), required, "Crafting and Merchant count");
    }
    case "LE-025": return numeric(tiles.placed_travel_tiles >= threshold, tiles.placed_travel_tiles, threshold, "non-Overstrained Travel Tiles");
    case "LE-026": return numeric(tiles.placed_travel_tiles === 0 && final.score >= threshold, final.score, threshold, "no Travel Tiles and score floor");
    case "LE-027": return numeric(tiles.farmstead_tiles === 0 && final.score >= threshold, final.score, threshold, "no Farmstead and score floor");
    case "LE-028": return numeric(tiles.upgraded_core_tiles === 0 && final.score >= threshold, final.score, threshold, "no upgrades and score floor");
    case "LE-030": return numeric(Math.max(...Object.values(gameLog.warehouse_peak_by_resource)) <= 8, Math.max(...Object.values(gameLog.warehouse_peak_by_resource)), 8, "Warehouse resource peak");
    case "LE-031": {
      const chosen = new Set([...(campaignState.chosen_stewards ?? []), ...gameLog.chosen_stewards]);
      return numeric(STEWARDS.every((name) => chosen.has(name)), chosen.size, STEWARDS.length, "unique Stewards chosen across campaign");
    }
    case "LE-032": return booleanResult(includesName(stewards.objectives_completed, "Vanguard") && (gameLog.board.bridges ?? []).length >= 1, "Vanguard Objective and Bridge");
    case "LE-033": {
      const maxHousingStrain = tuning.max_housing_strain;
      return booleanResult(includesName(stewards.objectives_completed, "Knight") && support.housing_overstrained_count === 0 && (maxHousingStrain === undefined || support.max_strain_on_housing <= maxHousingStrain), "Knight Objective and Housing resilience");
    }
    case "LE-034": {
      const required = tuning.upgrade_count ?? 5;
      return numeric(includesName(stewards.objectives_completed, "Sentinel") && tiles.upgraded_non_overstrained_core_tiles >= required, tiles.upgraded_non_overstrained_core_tiles, required, "Sentinel Objective and upgraded Core Tiles");
    }
    case "LE-035": {
      const required = tuning.terrain_count ?? 4;
      return numeric(includesName(stewards.objectives_completed, "Ranger") && board.occupied_non_grasslands_non_river_terrain_types >= required, board.occupied_non_grasslands_non_river_terrain_types, required, "Ranger Objective and terrain spread");
    }
    case "LE-036": return numeric(includesName(stewards.objectives_completed, "Warden") && final.active_burdens === 0, final.active_burdens, 0, "Warden Objective and active Burdens");
    case "LE-037": {
      const amount = tuning.resource_amount ?? 5;
      const required = tuning.resource_types_by_player?.[String(playerCount)] ?? tuning.resource_types ?? 3;
      const actual = countAtLeast(final.warehouse_by_resource, amount);
      return numeric(includesName(stewards.objectives_completed, "Quartermaster") && actual >= required, actual, required, "Quartermaster Objective and stocked resource types");
    }
    case "LE-038": {
      const completed = new Set([...(campaignState.completed_steward_objectives ?? []), ...stewards.objectives_completed]);
      return numeric(STEWARDS.every((name) => completed.has(name)), completed.size, STEWARDS.length, "unique Steward Objectives completed across campaign");
    }
    case "LE-039": {
      const snapshot = gameLog.season_snapshots.end_season_1;
      const scaledRequirement = tuning.progress_per_player_by_player?.[String(playerCount)];
      if (scaledRequirement !== undefined) {
        return numeric(snapshot.overstrained_tiles === 0 && snapshot.arrivals_completed_this_season >= scaledRequirement && snapshot.burdens_resolved_this_season >= scaledRequirement, Math.min(snapshot.arrivals_completed_this_season, snapshot.burdens_resolved_this_season), scaledRequirement, "Season I scaled Arrival and Burden progress");
      }
      if (tuning.scale_progress_by_player) {
        return numeric(snapshot.overstrained_tiles === 0 && snapshot.arrivals_completed_this_season >= playerCount && snapshot.burdens_resolved_this_season >= playerCount, Math.min(snapshot.arrivals_completed_this_season, snapshot.burdens_resolved_this_season), playerCount, "Season I scaled Arrival and Burden progress");
      }
      return booleanResult(snapshot.overstrained_tiles === 0 && (snapshot.arrivals_completed_this_season >= 1 || snapshot.burdens_resolved_this_season >= 1), "Season I resilience and encounter progress");
    }
    case "LE-040": {
      const snapshot = gameLog.season_snapshots.end_season_2;
      const directRequirement = tuning.resolved_burdens_by_player?.[String(playerCount)];
      if (directRequirement !== undefined) {
        return numeric(snapshot.overstrained_tiles === 0 && snapshot.active_burdens === 0 && snapshot.burdens_resolved_this_season >= directRequirement, snapshot.burdens_resolved_this_season, directRequirement, "Season II clean board and Burdens resolved");
      }
      const resolvedPerPlayer = tuning.resolved_burdens_per_player_by_player?.[String(playerCount)] ?? tuning.resolved_burdens_per_player;
      if (resolvedPerPlayer) {
        const required = Math.ceil(playerCount * resolvedPerPlayer);
        return numeric(snapshot.overstrained_tiles === 0 && snapshot.active_burdens === 0 && snapshot.burdens_resolved_this_season >= required, snapshot.burdens_resolved_this_season, required, "Season II clean board and Burdens resolved");
      }
      return numeric(snapshot.overstrained_tiles === 0 && snapshot.active_burdens < playerCount, snapshot.active_burdens, playerCount - 1, "Season II active Burdens");
    }
    case "LE-041": {
      if (tuning.require_zero_strain) return numeric(final.overstrained_tiles === 0 && final.active_burdens === 0 && final.strain_tokens === 0, final.strain_tokens, 0, "final clean board");
      if (tuning.max_active_burdens !== undefined) return numeric(final.overstrained_tiles === 0 && final.active_burdens <= tuning.max_active_burdens, final.active_burdens, tuning.max_active_burdens, "final active Burden cap with no Overstrained tiles");
      return numeric(final.overstrained_tiles === 0 && final.active_burdens < playerCount, final.active_burdens, playerCount - 1, "final active Burdens with no Overstrained tiles");
    }
    case "LE-042": return numeric(final.strain_tokens === 0, final.strain_tokens, 0, "final Strain tokens");
    case "LE-043": {
      const required = Math.ceil(encounters.burdens_revealed * (tuning.resolution_fraction ?? (2 / 3)));
      const cleanEnough = !tuning.require_no_overstrained || final.overstrained_tiles === 0;
      const burdensClear = !tuning.require_no_active_burdens || final.active_burdens === 0;
      return numeric(encounters.burdens_revealed >= 2 && encounters.burdens_resolved_or_removed >= required && cleanEnough && burdensClear, encounters.burdens_resolved_or_removed, required, "Burdens resolved or removed");
    }
    case "LE-045": {
      const amount = tuning.resource_amount ?? 10;
      const required = tuning.resource_types ?? threshold;
      return numeric(countAtLeast(final.warehouse_by_resource, amount) >= required, countAtLeast(final.warehouse_by_resource, amount), required, `resource types at ${amount}+`);
    }
    case "LE-046": return numeric(final.warehouse_total <= 2 && final.score >= threshold, final.score, threshold, "low Warehouse and score floor");
    case "LE-047": {
      const required = tuning.resource_amount ?? 8;
      return numeric(final.warehouse_by_resource.Wood >= required && final.warehouse_by_resource.Stone >= required && final.warehouse_by_resource.Food >= required, Math.min(final.warehouse_by_resource.Wood, final.warehouse_by_resource.Stone, final.warehouse_by_resource.Food), required, "Wood, Stone, and Food stock");
    }
    case "LE-048": return numeric(["Crafting", "Merchant", "Social", "Wellbeing"].every((category) => (board.categories_adjacent_to_housing ?? []).includes(category)), (board.categories_adjacent_to_housing ?? []).length, 4, "required categories adjacent to Housing");
    case "LE-049": return numeric(board.largest_connected_travel_group >= threshold, board.largest_connected_travel_group, threshold, "largest connected Travel group");
    case "LE-050": {
      const required = tuning.special_adjacency ?? 3;
      return numeric(board.special_tiles_adjacent_to_housing >= required, board.special_tiles_adjacent_to_housing, required, "Special Tiles adjacent to Housing");
    }
    default: throw new Error(`No evaluator implemented for ${id}.`);
  }
}

export function evaluateLedger(specs, gameLog, campaignState = {}) {
  const completedNamed = new Set(campaignState.completed_named_entries ?? []);
  const completedPrestige = new Set(campaignState.completed_prestige_boxes ?? []);
  const newNamedEntries = [];
  const prestigeBoxesCompleted = [];
  const nearMisses = [];
  const blockedEntries = [];
  const entryResults = {};

  for (const spec of specs) {
    const result = evaluateEntry(spec, gameLog, campaignState);
    entryResults[spec.entry_id] = result;
    if (result.blocked) {
      blockedEntries.push({ entry_id: spec.entry_id, reason: result.blocked });
      continue;
    }
    if (result.complete) {
      if (!completedNamed.has(spec.entry_id)) newNamedEntries.push(spec.entry_id);
      if (spec.player_count_boxes_are_prestige_only) {
        const key = `${spec.entry_id}:${gameLog.player_count}`;
        if (!completedPrestige.has(key)) {
          prestigeBoxesCompleted.push({ entry_id: spec.entry_id, player_count: gameLog.player_count });
        }
      }
    } else if (result.margin !== null) {
      nearMisses.push({
        entry_id: spec.entry_id,
        required: result.required,
        actual: result.actual,
        margin: result.margin,
        reason: result.reason,
      });
    }
  }

  return {
    game_id: `${gameLog.campaign_id}-G${String(gameLog.game_index).padStart(2, "0")}`,
    new_named_entries: newNamedEntries,
    prestige_boxes_completed: prestigeBoxesCompleted,
    near_misses: nearMisses,
    blocked_entries: blockedEntries,
    evaluator_warnings: [],
    entry_results: entryResults,
  };
}

export const stewardNames = STEWARDS;

import type {
  PassiveCostOption,
  ResourceCost,
  ResourceType,
  Season
} from "../engine/types";

const cost = (values: Partial<ResourceCost>): ResourceCost => ({
  wood: 0,
  stone: 0,
  metal: 0,
  food: 0,
  herbs: 0,
  goods: 0,
  ...values
});

export interface ArrivalRequirementRule {
  cost: ResourceCost;
  requiresHousing?: boolean;
}

export const arrivalRequirementRules: Record<string, ArrivalRequirementRule> = {
  arrival_acorns_and_oak_trees: { cost: cost({ herbs: 2, stone: 2, goods: 2 }) },
  arrival_blessed_harvest: { cost: cost({ food: 2, stone: 4 }) },
  arrival_from_battle_to_cattle: { cost: cost({ wood: 2, metal: 2, food: 2 }) },
  arrival_from_blade_swingers_to_herb_stringers: { cost: cost({ wood: 2, metal: 2, food: 2 }) },
  arrival_from_dark_decay_to_light_display: { cost: cost({ wood: 2, stone: 2, food: 2 }) },
  arrival_from_plunderer_to_lumber: { cost: cost({ wood: 2, metal: 2, food: 2 }) },
  arrival_from_songs_of_war_to_the_search_for_ore: { cost: cost({ wood: 2, metal: 2, food: 2 }) },
  arrival_hands_for_heavy_work: { cost: cost({ food: 2, stone: 2, goods: 2 }) },
  arrival_lanterns_for_the_long_roads: { cost: cost({ wood: 2, metal: 2, goods: 2 }) },
  arrival_lay_down_the_tools_of_destruction: { cost: cost({ metal: 4, goods: 2 }) },
  arrival_lest_we_forget: { cost: cost({ wood: 4, metal: 4 }) },
  arrival_moving_mountains: { cost: cost({ food: 2, stone: 2, goods: 2 }) },
  arrival_news_travels_faster_than_goods: { cost: cost({ food: 2, goods: 4 }) },
  arrival_no_soul_shall_go_without: { cost: cost({ goods: 2, herbs: 2 }) },
  arrival_reablement_for_the_realm: { cost: cost({ wood: 4, metal: 4 }) },
  arrival_remnants_of_the_cavalry: { cost: cost({ wood: 2, herbs: 4, goods: 2 }) },
  arrival_remnants_of_the_fleet: { cost: cost({ wood: 2, herbs: 4, goods: 2 }) },
  arrival_spirit_lifting_spirit: { cost: cost({ wood: 2, metal: 2, goods: 2 }) },
  arrival_strong_foundations: { cost: cost({ goods: 2, herbs: 2 }) },
  arrival_the_burden_bearers: { cost: cost({ herbs: 2, stone: 2, metal: 2 }), requiresHousing: true },
  arrival_the_dryads: { cost: cost({ herbs: 2, stone: 2, goods: 2 }) },
  arrival_the_hearthbound_circle: { cost: cost({ herbs: 4, food: 4 }) },
  arrival_the_quiet_quest: { cost: cost({ goods: 4, herbs: 2 }) },
  arrival_the_transmutation_traveler: { cost: cost({ herbs: 2, goods: 2 }) },
  arrival_what_came_before_the_last_age: { cost: cost({ stone: 2, metal: 2, goods: 2 }) }
};

export const burdenResolutionResources: Record<string, ResourceType> = {
  burden_smoke_over_hearths: "goods",
  burden_forest_s_grudge: "wood",
  burden_blighted_lands: "food",
  burden_awoken_in_the_deep: "food",
  burden_stampede: "metal",
  burden_return_to_the_trenches: "metal",
  burden_wares_of_war: "metal",
  burden_old_names_old_debts: "goods",
  burden_the_quiet_fractures: "goods",
  burden_tools_left_to_rust: "metal",
  burden_the_long_cough: "herbs",
  burden_the_storehouses_disagree: "goods",
  burden_bare_walls: "wood",
  burden_empty_shelves: "goods",
  burden_promises_overstretched: "goods",
  burden_welcome_wears_thin: "herbs",
  burden_coin_before_craft: "goods",
  burden_foundations_remember_war: "stone",
  burden_ill_omen_of_discontent: "herbs",
  burden_old_wounds_reopen: "herbs",
  burden_only_road_in: "goods",
  burden_roads_carry_needs: "goods",
  burden_roads_too_far_from_home: "wood",
  burden_stores_run_thin: "goods",
  burden_the_burden_of_command: "goods",
  burden_the_rot_within_the_vault: "herbs",
  burden_too_many_houses_too_little_homes: "goods"
};

export const burdenResolutionResourceOptions: Record<string, ResourceType[]> = {
  ...Object.fromEntries(
    Object.entries(burdenResolutionResources).map(([id, resource]) => [
      id,
      [resource]
    ])
  ),
  burden_too_many_houses_too_little_homes: ["food", "goods"]
};

export function getBurdenResolutionCost(
  cardId: string,
  season: Season
): ResourceCost | undefined {
  const resource = burdenResolutionResources[cardId];
  return resource ? cost({ [resource]: season * 2 }) : undefined;
}

export function getBurdenResolutionCostOptions(
  cardId: string,
  season: Season
): PassiveCostOption[] {
  if (cardId !== "burden_too_many_houses_too_little_homes") return [];
  return Array.from({ length: season * 2 }, (_, index) => ({
    id: `burden-flex:${cardId}:${index + 1}`,
    sourceTileId: cardId,
    sourceKind: "boon" as const,
    sourceName: `Flexible payment ${index + 1}/${season * 2}`,
    effectText: "Pay this part of the resolution cost with Food instead of Goods.",
    kind: "substitute" as const,
    cadence: "round" as const,
    substituteFrom: "goods" as const,
    resourceChoices: ["food" as const]
  }));
}

export const persistentBoonIds = new Set([
  "boon_a_little_more_time",
  "boon_many_hands_make_light_work",
  "boon_raised_in_good_season",
  "boon_when_the_roads_filled_once_more",
  "boon_shared_hands_lighter_loads",
  "boon_the_apprentice_steward",
  "boon_a_welcome_well_met",
  "boon_bounty_of_the_first_harvest",
  "boon_carts_before_sunrise",
  "boon_craft_fair",
  "boon_old_foundations_still_remain",
  "boon_one_thousand_swings_of_the_pickaxe_opens_up_a_new_path",
  "boon_the_ancient_ways_gradually_reemerge",
  "boon_the_rains_that_we_sheltered_from_now_yield_the_bounty_of_nature"
]);

export interface SpecialTileBehavior {
  trigger: "activated" | "placedOrActivated" | "passive";
  cadence?: "round" | "season";
}

const placedOrActivated = [
  "special_alms_house",
  "special_atelier_workshop",
  "special_house_of_learning",
  "special_the_iron_roots_respite",
  "special_the_lorekeepers_respite",
  "special_the_reavers_respite",
  "special_the_root_weavers_respite",
  "special_the_tamers_respite",
  "special_theater"
];
const seasonActivated = [
  "special_adventurers_guild",
  "special_hearth_garden",
  "special_reliquary"
];
const passiveSpecials = [
  "special_brewery_of_legends",
  "special_labourers_yard",
  "special_docks",
  "special_lantern_roadhouse",
  "special_stables",
  "special_the_resting_hall",
  "special_shrine_of_ancestors",
  "special_shrine_of_ancients",
  "special_shrine_of_bounty",
  "special_shrine_of_depths",
  "special_shrine_of_renewal"
];

export const specialTileBehaviors: Record<string, SpecialTileBehavior> = Object.fromEntries([
  ...placedOrActivated.map((id) => [id, { trigger: "placedOrActivated" as const }]),
  ...seasonActivated.map((id) => [id, { trigger: "activated" as const, cadence: "season" as const }]),
  ...passiveSpecials.map((id) => [id, { trigger: "passive" as const }]),
  ["special_alchemist_s_workshop", { trigger: "activated" as const }],
  ["special_the_waystation", { trigger: "activated" as const }]
]);

export interface ProductionPassiveRule {
  sourceTileId: string;
  gain: { kind: "fixed"; resources: Partial<ResourceCost> } | { kind: "producedTypes"; amount: number };
}

export const productionPassiveRules: Record<string, ProductionPassiveRule> = {
  special_shrine_of_ancestors: { sourceTileId: "c20_dig_site", gain: { kind: "producedTypes", amount: 2 } },
  special_shrine_of_ancients: { sourceTileId: "c03_gathering_outpost", gain: { kind: "fixed", resources: { herbs: 2 } } },
  special_shrine_of_bounty: { sourceTileId: "c04_farmstead", gain: { kind: "fixed", resources: { food: 2 } } },
  special_shrine_of_depths: { sourceTileId: "c02_mine_tunnel", gain: { kind: "producedTypes", amount: 2 } },
  special_shrine_of_renewal: { sourceTileId: "c01_lumber_yard", gain: { kind: "producedTypes", amount: 2 } }
};

export interface TileScoringRule {
  housingClusterPopulation?: number;
  adjacentTravelRenown?: number;
  adjacentNonTravelRenown?: number;
  connectedTravelRenownMax?: number;
}

export const tileScoringRules: Record<string, Partial<Record<"basic" | "upgraded", TileScoringRule>>> = {
  c05_cabin: { basic: { housingClusterPopulation: 2 }, upgraded: { housingClusterPopulation: 3, adjacentTravelRenown: 2 } },
  c06_cottage: { basic: { housingClusterPopulation: 3 }, upgraded: { housingClusterPopulation: 5, adjacentTravelRenown: 3 } },
  c07_stedding: { basic: { housingClusterPopulation: 5 }, upgraded: { housingClusterPopulation: 7, adjacentTravelRenown: 5 } },
  c15_path: { basic: { adjacentNonTravelRenown: 1 }, upgraded: { connectedTravelRenownMax: 4 } },
  c16_street: { basic: { adjacentNonTravelRenown: 1 }, upgraded: { connectedTravelRenownMax: 4 } },
  c17_track: { basic: { adjacentNonTravelRenown: 1 }, upgraded: { connectedTravelRenownMax: 4 } }
};

export const intrinsicallySupportedTileSides = new Set(["c19_bridge:upgraded"]);

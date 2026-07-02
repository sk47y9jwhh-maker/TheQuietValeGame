import type {
  ArrivalData,
  BoonData,
  BurdenData,
  GoldenBoonData
} from "../engine/types";

const season = (season1: string, season2: string, season3: string) => ({
  season1,
  season2,
  season3
});

export const boons: BoonData[] = [
  {
    id: "boon_a_little_more_time",
    type: "boon",
    name: "A Little Time",
    effects: season(
      "Add 1 timer token to 1 active Arrival, to a maximum of 3.",
      "Add up to 2 timer tokens among active Arrivals, to a maximum of 3 on each.",
      "Add up to 3 timer tokens among active Arrivals, to a maximum of 3 on each."
    ),
    lifecycle: "Keep face-up until used, or discard at Season end."
  },
  {
    id: "boon_many_hands_make_light_work",
    type: "boon",
    name: "Many Hands, Light Work",
    effects: season(
      "The next tile placed this Season costs 1 fewer resource.",
      "The next 2 tiles placed this Season each cost 1 fewer resource.",
      "The next 2 tiles placed or upgraded this Season each cost 2 fewer resources."
    ),
    lifecycle: "Keep face-up until all uses are spent, or discard at Season end."
  },
  {
    id: "boon_raised_in_good_season",
    type: "boon",
    name: "Raised in Season",
    effects: season(
      "The next Core Tile upgraded this Season costs 1 fewer resource.",
      "The next Core Tile upgraded this Season costs 2 fewer resources.",
      "The next Core Tile upgraded this Season costs 3 fewer resources."
    ),
    lifecycle: "Keep face-up until used, or discard at Season end."
  },
  {
    id: "boon_stores_made_ready",
    type: "boon",
    name: "Stores Ready",
    effects: season(
      "Exchange up to 2 Warehouse resources for the same number of resources of any type.",
      "Exchange up to 4 Warehouse resources for the same number of resources of any type.",
      "Exchange up to 6 Warehouse resources for the same number of resources of any type."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_when_the_roads_filled_once_more",
    type: "boon",
    name: "Roads Filled Again",
    effects: season(
      "Place the next Travel Tile this Season for 0 Actions. Pay costs and follow placement rules.",
      "Place or upgrade the next Travel Tile this Season for 0 Actions. Pay costs and follow normal rules.",
      "Place or upgrade the next Travel Tile this Season for 0 Actions. Pay costs and follow normal rules."
    ),
    lifecycle: "Keep face-up until used, or discard at Season end."
  },
  {
    id: "boon_from_the_brink",
    type: "boon",
    name: "From the Brink",
    effects: season(
      "Remove up to 2 Strain from 1 Overstrained tile. If none, remove 1 Strain from 1 placed tile instead.",
      "Remove up to 2 Strain from 1 Overstrained tile. If none, remove 1 Strain from up to 2 placed tiles instead.",
      "Remove up to 2 Strain from each of up to 2 Overstrained tiles. If none, remove 1 Strain from up to 3 placed tiles instead."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_clear_nights_make_for_clear_plans",
    type: "boon",
    name: "Clear Nights and Plans",
    effects: season(
      "Look at the top 2 cards of the Encounter Deck. Return them in any order.",
      "Look at the top 3 cards of the Encounter Deck. Return them in any order.",
      "Look at the top 4 cards of the Encounter Deck. Return them in any order. You may move 1 of them to the top."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_shared_hands_lighter_loads",
    type: "boon",
    name: "Shared Hands",
    effects: season(
      "The next active Burden resolved this Season costs 2 fewer resources.",
      "The next active Burden resolved this Season costs 4 fewer resources.",
      "The next active Burden resolved this Season costs 6 fewer resources."
    ),
    lifecycle: "Keep face-up until used, or discard at Season end."
  },
  {
    id: "boon_the_apprentice_steward",
    type: "boon",
    name: "Apprentice Steward",
    effects: season(
      "Place the next Resource Tile this Season for 0 Actions. Pay costs and follow placement rules.",
      "Place the next Resource or Housing Tile this Season for 0 Actions. Pay costs and follow placement rules.",
      "Place the next tile this Season for 0 Actions. Pay costs and follow placement rules."
    ),
    lifecycle: "Keep face-up until used, or discard at Season end. Applies to Action cost only."
  },
  {
    id: "boon_shelter_holds",
    type: "boon",
    name: "Shelter Holds",
    effects: season(
      "Remove 1 Strain from 1 Supported tile.",
      "Remove 1 Strain from up to 2 Supported tiles.",
      "Remove 1 Strain from up to 3 Supported tiles."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_a_welcome_well_met",
    type: "boon",
    name: "Welcome Well Met",
    effects: season(
      "For the next Arrival completed this Season, reduce its Requirement cost by 1 resource.",
      "For the next Arrival completed this Season, reduce its Requirement cost by 2 resources.",
      "For the next Arrival completed this Season, reduce its Requirement cost by 3 resources."
    ),
    lifecycle: "Keep face-up until used, or discard at Season end."
  },
  {
    id: "boon_where_help_stands",
    type: "boon",
    name: "Help Stands",
    effects: season(
      "For each Steward-occupied tile, remove 1 Strain. For each that had none, gain 1 resource, up to 2 total.",
      "For each Steward-occupied tile, remove 1 Strain. For each that had none, gain 2 resources, up to 4 total.",
      "For each Steward-occupied tile, remove 1 Strain. For each that had none, gain 3 resources, up to 6 total."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_a_wonderful_find",
    type: "boon",
    name: "The Wonderful Find",
    effects: season(
      "Gain 1 Metal or 1 Goods. If there is a placed Dig Site / Excavation Site, one such tile gains Supported.",
      "Gain 1 Metal and 1 Goods. Then remove 1 Strain from 1 Dig Site / Excavation Site or 1 tile adjacent to Ruins terrain.",
      "Gain 2 Metal and 2 Goods. Then remove 1 Strain from each of up to 2 Dig Site / Excavation Site tiles and/or tiles adjacent to Ruins terrain."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_festival_of_trade",
    type: "boon",
    name: "Trade Festival",
    effects: season(
      "Choose 1 Merchant Tile. Gain 1 Goods for each different tile category adjacent to it, max 2 Goods.",
      "Choose 1 Merchant Tile. Gain 1 Goods for each different tile category adjacent to it, max 4 Goods. If one adjacent tile is Housing, that Housing Tile gains Supported.",
      "Choose 1 Merchant Tile. Gain 1 Goods for each different tile category adjacent to it, max 6 Goods. If one adjacent tile is Housing, that Housing Tile gains Supported."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_hearths_soften_feuds",
    type: "boon",
    name: "Hearths Soften Feuds",
    effects: season(
      "Choose 1 Housing Tile. It gains Supported. If it is part of a Housing cluster, remove 1 Strain from it.",
      "Choose up to 2 Housing Tiles. Each gains Supported. If either is part of a Housing cluster, remove 1 Strain from that tile.",
      "Choose 1 Housing cluster. Up to 3 Housing Tiles in that cluster gain Supported. Remove up to 2 Strain among those tiles."
    ),
    lifecycle: "Resolve, then discard."
  },
  {
    id: "boon_the_settlement_of_plenty",
    type: "boon",
    name: "Settlement of Plenty",
    effects: season(
      "Choose 1 connected group of 3 or more non-Overstrained tiles. Remove 1 Strain from 1 tile in that group. If no Strain is removed, gain 2 Food or Goods.",
      "Choose 1 connected group of 4 or more non-Overstrained tiles. Remove up to 2 Strain among tiles in that group. If none is removed, gain 3 Food and/or Goods.",
      "Choose 1 connected group of 5 or more non-Overstrained tiles. Remove up to 3 Strain among tiles in that group. If none is removed, gain 5 Food and/or Goods."
    ),
    lifecycle: "Resolve, then discard."
  }
];

export const burdens: BurdenData[] = [
  {
    id: "burden_smoke_over_hearths",
    type: "burden",
    name: "Smoke over Hearths",
    effects: season(
      "Choose 1 Housing Tile with fewer than 3 Strain adjacent to a Crafting Tile and place 1 Strain on it.",
      "Choose 2 Housing Tiles with fewer than 3 Strain each adjacent to a Crafting Tile. Place 1 Strain on each.",
      "Choose 3 Housing Tiles with fewer than 3 Strain each adjacent to a Crafting Tile. Place 1 Strain on each. If none, choose 1 Crafting Tile with fewer than 3 Strain instead."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Goods by Season. Then discard."
  },
  {
    id: "burden_forest_s_grudge",
    type: "burden",
    name: "Forest's Grudge",
    effects: season(
      "Choose 1 Lumber Yard / Sustainable Lumber Yard with fewer than 3 Strain and place 1 Strain on it.",
      "Choose 1 Lumber Yard / Sustainable Lumber Yard with fewer than 3 Strain and place 2 Strain on it.",
      "Choose 1 Lumber Yard / Sustainable Lumber Yard with fewer than 3 Strain and place 2 Strain on it. Then choose 1 adjacent placed tile with fewer than 3 Strain and place 1 Strain on it."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Wood by Season. Then discard."
  },
  {
    id: "burden_blighted_lands",
    type: "burden",
    name: "Blighted Lands",
    effects: season(
      "Choose 1 Farmstead / Artisan Farm with fewer than 3 Strain and place 1 Strain on it.",
      "Choose 1 Farmstead / Artisan Farm with fewer than 3 Strain and place 2 Strain on it.",
      "Choose 1 Farmstead / Artisan Farm with fewer than 3 Strain and place 2 Strain on it. Then choose 1 adjacent placed tile with fewer than 3 Strain and place 1 Strain on it."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Food by Season. Then discard."
  },
  {
    id: "burden_awoken_in_the_deep",
    type: "burden",
    name: "Awoken Below",
    effects: season(
      "Choose 1 Mine Tunnel / Mine Shaft tile with fewer than 3 Strain and place 1 Strain on it.",
      "Choose 1 Mine Tunnel / Mine Shaft tile with fewer than 3 Strain and place 2 Strain on it.",
      "Choose 1 Mine Tunnel / Mine Shaft tile with fewer than 3 Strain and place 2 Strain on it. Then choose 1 adjacent Travel or Resource Tile with fewer than 3 Strain and place 1 Strain on it."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Food by Season. Then discard."
  },
  {
    id: "burden_stampede",
    type: "burden",
    name: "Stampede",
    effects: season(
      "Choose 1 Gathering Outpost / Gathering Lodge with fewer than 3 Strain and place 1 Strain on it.",
      "Choose 1 Gathering Outpost / Gathering Lodge with fewer than 3 Strain and place 2 Strain on it.",
      "Choose 1 Gathering Outpost / Gathering Lodge with fewer than 3 Strain and place 2 Strain on it. Then choose 1 adjacent Housing or Travel Tile with fewer than 3 Strain and place 1 Strain on it."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Metal by Season. Then discard."
  },
  {
    id: "burden_return_to_the_trenches",
    type: "burden",
    name: "Old Trenches Return",
    effects: season(
      "Choose 1 Travel Tile with fewer than 3 Strain adjacent to a Resource Tile and place 1 Strain on it.",
      "Choose 2 Travel Tiles with fewer than 3 Strain each adjacent to a Resource Tile. Place 1 Strain on each.",
      "Choose 3 Travel Tiles with fewer than 3 Strain each adjacent to a Resource Tile. Place 1 Strain on each. If none, choose 1 Resource Tile with fewer than 3 Strain instead."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Metal by Season. Then discard."
  },
  {
    id: "burden_wares_of_war",
    type: "burden",
    name: "Wares of War",
    effects: season(
      "Choose 1 Housing Tile with fewer than 3 Strain adjacent to a Merchant Tile and place 1 Strain on it.",
      "Choose 2 Housing Tiles with fewer than 3 Strain each adjacent to a Merchant Tile. Place 1 Strain on each.",
      "Choose 3 Housing Tiles with fewer than 3 Strain each adjacent to a Merchant Tile. Place 1 Strain on each. If none, choose 1 Merchant Tile with fewer than 3 Strain instead."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Metal by Season. Then discard."
  },
  {
    id: "burden_old_names_old_debts",
    type: "burden",
    name: "Old Names, Old Debts",
    effects: season(
      "Choose 1 tile with Renown and fewer than 3 Strain. Place 1 Strain on it.",
      "Choose 2 tiles with Renown and fewer than 3 Strain. Place 1 Strain on each.",
      "Choose 3 tiles with Renown and fewer than 3 Strain. Place 1 Strain on each."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Goods by Season. Then discard."
  },
  {
    id: "burden_the_quiet_fractures",
    type: "burden",
    name: "The Quiet Fractures",
    effects: season(
      "Choose 1 tile with 1-2 Strain and place 1 Strain on it.",
      "Choose 1 tile with 1-2 Strain and place 1 Strain on it. Then place 1 Strain on 1 adjacent placed tile with 0 Strain.",
      "Choose 1 Overstrained tile. Then place 1 Strain on each of 2 adjacent placed tiles with 0 Strain. If none, choose 1 tile with 1-2 Strain and place 1 Strain on it, then place 1 Strain on 1 adjacent placed tile with 0 Strain instead."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Goods by Season. Then discard."
  },
  {
    id: "burden_tools_left_to_rust",
    type: "burden",
    name: "Tools Left to Rust",
    effects: season(
      "Choose 1 Crafting or Merchant Tile with fewer than 3 Strain and place 1 Strain on it.",
      "Choose 1 Crafting or Merchant Tile with fewer than 3 Strain and place 1 Strain on it. Then lose 1 Metal if able.",
      "Choose 2 Crafting and/or Merchant Tiles with fewer than 3 Strain. Place 1 Strain on each. Then lose 2 Metal if able."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Metal by Season. Then discard."
  },
  {
    id: "burden_the_long_cough",
    type: "burden",
    name: "The Long Cough",
    effects: season(
      "Choose 1 Social or Wellbeing Tile with fewer than 3 Strain. Place 1 Strain on it.",
      "Choose 1 Social Tile and 1 Wellbeing Tile, each with fewer than 3 Strain, if possible. Place 1 Strain on each chosen tile.",
      "Choose up to 3 Social and/or Wellbeing Tiles with fewer than 3 Strain. Place 1 Strain on each."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Herbs by Season. Then discard."
  },
  {
    id: "burden_the_storehouses_disagree",
    type: "burden",
    name: "Storehouses Disagree",
    effects: season(
      "Choose Wood, Stone, or Food. If the Warehouse has at least 2 of it, lose 2. Otherwise, place 1 Strain on 1 Resource Tile with fewer than 3 Strain.",
      "Choose Wood, Stone, Metal, Food, or Herbs. If the Warehouse has at least 3 of it, lose 3. Otherwise, place 2 Strain on 1 Resource Tile with fewer than 3 Strain.",
      "Choose any non-Goods resource. If the Warehouse has at least 5 of it, lose 5. Otherwise, place 2 Strain on each of 2 Resource Tiles with fewer than 3 Strain."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Goods by Season. Then discard."
  },
  {
    id: "burden_bare_walls",
    type: "burden",
    name: "Bare Walls",
    effects: season(
      "Choose 1 Housing Tile with fewer than 3 Strain that is not adjacent to Social or Wellbeing. Place 1 Strain on it. If none is valid, lose 1 Goods.",
      "Choose up to 2 Housing Tiles with fewer than 3 Strain that are not adjacent to Social or Wellbeing. Place 1 Strain on each. If none are valid, lose 2 Goods.",
      "Choose up to 3 Housing Tiles with fewer than 3 Strain that are not adjacent to Social or Wellbeing. Place 1 Strain on each. If none are valid, lose 3 Goods."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Wood by Season. Then discard."
  },
  {
    id: "burden_empty_shelves",
    type: "burden",
    name: "Empty Shelves",
    effects: season(
      "Choose 1 Social Tile with fewer than 3 Strain. Pay 1 Goods, or place 1 Strain on it.",
      "Choose 2 Social Tiles with fewer than 3 Strain. For each, pay 1 Goods or place 1 Strain on it.",
      "Choose 3 Social Tiles with fewer than 3 Strain. For each, pay 1 Goods or place 1 Strain on it. If none, choose 1 Housing Tile with fewer than 3 Strain instead."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Goods by Season. Then discard."
  },
  {
    id: "burden_promises_overstretched",
    type: "burden",
    name: "Promises Overstretched",
    effects: season(
      "Choose 1 active Arrival, if any. Pay 1 Goods or remove 1 timer token. If there is no active Arrival, no effect.",
      "Choose up to 2 active Arrivals. For each, pay 1 Goods or remove 1 timer token. If there are none, no effect.",
      "Choose up to 3 active Arrivals. For each, pay 1 Goods or remove 1 timer token. If there are none, place 1 Strain on each of 2 placed tiles with fewer than 3 Strain."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Goods by Season. Then discard."
  },
  {
    id: "burden_welcome_wears_thin",
    type: "burden",
    name: "Welcome Wears Thin",
    effects: season(
      "Choose 1 active Arrival, if any. Pay 1 Herbs or remove 1 timer token. If there is no active Arrival, no effect.",
      "Choose up to 2 active Arrivals. For each, pay 1 Herbs or remove 1 timer token. If there are none, no effect.",
      "Choose up to 3 active Arrivals. For each, pay 1 Herbs or remove 1 timer token. If there are none, place 1 Strain on each of 2 placed tiles with fewer than 3 Strain."
    ),
    resolutionText: "Spend 1 Action and pay 2/4/6 Herbs by Season. Then discard."
  }
];

export const arrivals: ArrivalData[] = [
  {
    id: "arrival_acorns_and_oak_trees",
    type: "arrival",
    name: "Acorns & Oak Trees",
    requirementText: "Pay 2 Herbs, 2 Stone, and 2 Goods.",
    rewardSpecialTileIds: ["special_shrine_of_renewal"]
  },
  {
    id: "arrival_blessed_harvest",
    type: "arrival",
    name: "Blessed Harvest",
    requirementText: "Pay 2 Food and 4 Stone.",
    rewardSpecialTileIds: ["special_shrine_of_bounty"]
  },
  {
    id: "arrival_from_battle_to_cattle",
    type: "arrival",
    name: "Battle to Cattle",
    requirementText: "Pay 2 Wood, 2 Metal, and 2 Food.",
    rewardSpecialTileIds: ["special_the_tamers_respite"]
  },
  {
    id: "arrival_from_blade_swingers_to_herb_stringers",
    type: "arrival",
    name: "Blade to Herb",
    requirementText: "Pay 2 Wood, 2 Metal, and 2 Food.",
    rewardSpecialTileIds: ["special_the_root_weavers_respite"]
  },
  {
    id: "arrival_from_dark_decay_to_light_display",
    type: "arrival",
    name: "Dark Decay to Light",
    requirementText: "Pay 2 Wood, 2 Stone, and 2 Food.",
    rewardSpecialTileIds: ["special_the_lorekeepers_respite"]
  },
  {
    id: "arrival_from_plunderer_to_lumber",
    type: "arrival",
    name: "Plunderer to Lumber",
    requirementText: "Pay 2 Wood, 2 Metal, and 2 Food.",
    rewardSpecialTileIds: ["special_the_reavers_respite"]
  },
  {
    id: "arrival_from_songs_of_war_to_the_search_for_ore",
    type: "arrival",
    name: "Songs of War to Ore",
    requirementText: "Pay 2 Wood, 2 Metal, and 2 Food.",
    rewardSpecialTileIds: ["special_the_iron_roots_respite"]
  },
  {
    id: "arrival_hands_for_heavy_work",
    type: "arrival",
    name: "Hands for Heavy Work",
    requirementText: "Pay 2 Food, 2 Stone, and 2 Goods.",
    rewardSpecialTileIds: ["special_labourers_yard"]
  },
  {
    id: "arrival_lanterns_for_the_long_roads",
    type: "arrival",
    name: "Lanterns for Roads",
    requirementText: "Pay 2 Wood, 2 Metal, and 2 Goods.",
    rewardSpecialTileIds: ["special_lantern_roadhouse"]
  },
  {
    id: "arrival_lay_down_the_tools_of_destruction",
    type: "arrival",
    name: "Repurpose Tools",
    requirementText: "Pay 4 Metal and 2 Goods.",
    rewardSpecialTileIds: ["special_reliquary"]
  },
  {
    id: "arrival_lest_we_forget",
    type: "arrival",
    name: "Lest We Forget",
    requirementText: "Pay 4 Wood and 4 Metal.",
    rewardSpecialTileIds: ["special_theater"]
  },
  {
    id: "arrival_moving_mountains",
    type: "arrival",
    name: "Moving Mountains",
    requirementText: "Pay 2 Food, 2 Stone, and 2 Goods.",
    rewardSpecialTileIds: ["special_shrine_of_depths"]
  },
  {
    id: "arrival_news_travels_faster_than_goods",
    type: "arrival",
    name: "News Travels Faster",
    requirementText: "Pay 2 Food and 4 Goods.",
    rewardSpecialTileIds: ["special_the_waystation"]
  },
  {
    id: "arrival_no_soul_shall_go_without",
    type: "arrival",
    name: "No Soul Goes Unserved",
    requirementText: "Pay 2 Goods and 2 Herbs.",
    rewardSpecialTileIds: ["special_alms_house"]
  },
  {
    id: "arrival_reablement_for_the_realm",
    type: "arrival",
    name: "Reablement for the Vale",
    requirementText: "Pay 4 Wood and 4 Metal.",
    rewardSpecialTileIds: ["special_atelier_workshop"]
  },
  {
    id: "arrival_remnants_of_the_cavalry",
    type: "arrival",
    name: "Remnants of the Cavalry",
    requirementText: "Pay 2 Wood, 4 Herbs, and 2 Goods.",
    rewardSpecialTileIds: ["special_stables", "special_stables"]
  },
  {
    id: "arrival_remnants_of_the_fleet",
    type: "arrival",
    name: "Remnants of the Fleet",
    requirementText: "Pay 2 Wood, 4 Herbs, and 2 Goods.",
    rewardSpecialTileIds: ["special_docks"]
  },
  {
    id: "arrival_spirit_lifting_spirit",
    type: "arrival",
    name: "Spirit-Lifting",
    requirementText: "Pay 2 Wood, 2 Metal, and 2 Goods.",
    rewardSpecialTileIds: ["special_brewery_of_legends"]
  },
  {
    id: "arrival_strong_foundations",
    type: "arrival",
    name: "Strong Foundations",
    requirementText: "Pay 2 Goods and 2 Herbs.",
    rewardSpecialTileIds: ["special_house_of_learning"]
  },
  {
    id: "arrival_the_burden_bearers",
    type: "arrival",
    name: "Burden-Bearers",
    requirementText: "Have at least 1 Housing Tile and pay 2 Herbs, 2 Stone, and 2 Metal.",
    rewardSpecialTileIds: ["special_the_resting_hall"]
  },
  {
    id: "arrival_the_dryads",
    type: "arrival",
    name: "The Dryads",
    requirementText: "Pay 2 Herbs, 2 Stone, and 2 Goods.",
    rewardSpecialTileIds: ["special_shrine_of_ancients"]
  },
  {
    id: "arrival_the_hearthbound_circle",
    type: "arrival",
    name: "Hearthbound Circle",
    requirementText: "Pay 4 Herbs and 4 Food.",
    rewardSpecialTileIds: ["special_hearth_garden"]
  },
  {
    id: "arrival_the_quiet_quest",
    type: "arrival",
    name: "Quiet Quest",
    requirementText: "Pay 4 Goods and 2 Herbs.",
    rewardSpecialTileIds: ["special_adventurers_guild"]
  },
  {
    id: "arrival_the_transmutation_traveler",
    type: "arrival",
    name: "Transmutation Traveller",
    requirementText: "Pay 2 Herbs and 2 Goods.",
    rewardSpecialTileIds: ["special_alchemist_s_workshop"]
  },
  {
    id: "arrival_what_came_before_the_last_age",
    type: "arrival",
    name: "Before the Last Age",
    requirementText: "Pay 2 Stone, 2 Metal, and 2 Goods.",
    rewardSpecialTileIds: ["special_shrine_of_ancestors"]
  }
];

export const goldenBoons: GoldenBoonData[] = [
  {
    id: "golden_boon_the_golden_bell",
    type: "goldenBoon",
    name: "The Golden Bell",
    enabledInOnlinePrototype: true,
    unlockAt: 5,
    lifecycle: "Resolve immediately for free, reveal a replacement Encounter Card, then discard.",
    effectText:
      "When revealed, reveal 3 unused Arrival Cards from the game box. Choose 1 and complete it immediately without paying its Requirement and without spending an Action. Unlock its Special Tile as normal. Return the other revealed Arrival Cards to the box. Then discard this card."
  },
  {
    id: "golden_boon_the_golden_scroll",
    type: "goldenBoon",
    name: "The Golden Scroll",
    enabledInOnlinePrototype: true,
    unlockAt: 12,
    lifecycle: "Resolve immediately for free, reveal a replacement Encounter Card, then discard.",
    effectText:
      "When revealed, each player may choose 1 standard Encounter Card from their hand and return it to the game box. Each player who did draws 1 random standard Boon Card from the game box into their hand. Golden Boons cannot be drawn this way. If there are not enough standard Boon Cards in the box, draw as many as possible. Then discard this card."
  },
  {
    id: "golden_boon_the_golden_vial",
    type: "goldenBoon",
    name: "The Golden Vial",
    enabledInOnlinePrototype: true,
    unlockAt: 18,
    lifecycle: "Keep face-up for the rest of the game; reveal a replacement Encounter Card.",
    effectText:
      "When revealed, keep this card face-up near the Stewards Board. For the rest of the game, once per round, the group may place 1 Path Tile without spending an Action. Pay its cost and follow normal placement rules. If no Path Tiles remain, this effect cannot be used."
  },
  {
    id: "golden_boon_the_golden_eyed_traveler",
    type: "goldenBoon",
    name: "The Golden-Eyed Traveller",
    enabledInOnlinePrototype: true,
    unlockAt: 25,
    lifecycle: "Resolve immediately for free, reveal a replacement Encounter Card, then discard.",
    effectText:
      "When revealed, after the normal Player Turns phase this round, each player takes 1 bonus turn with the normal action allowance. Then continue to End of Round. Do not reveal additional Encounter Cards, remove Arrival timers, resolve End of Round effects, or advance the Round Timer before these bonus turns. Then discard this card."
  },
  {
    id: "golden_boon_the_golden_signet_ring",
    type: "goldenBoon",
    name: "The Golden Signet Ring",
    enabledInOnlinePrototype: true,
    unlockAt: 32,
    lifecycle: "Resolve immediately for free, reveal a replacement Encounter Card, then discard.",
    effectText:
      "When revealed, choose up to 5 placed tiles. Remove those tiles, then place each chosen tile into a legal empty map space. Chosen tiles may use spaces vacated by other chosen tiles. Ignore adjacency and reachability restrictions, but all terrain restrictions still apply. Multi-hex tiles must cover only empty, legal hexes. Chosen tiles keep Strain, Supported, upgrade state, and all tokens. Recalculate connectivity and Overstrained effects immediately. Then discard this card."
  }
];

const encounterFlavorById: Record<string, string> = {
  boon_a_little_more_time:
    "A gate held open for one extra moment can change a welcome. For a little while, patience did what speed could not. It made room for the hesitant, the weary, and the nearly turned away.",
  boon_many_hands_make_light_work:
    "Stones moved today that would have broken a single back. Beams rose, meals were passed along, and each task became lighter as hands joined it. Cooperation lifted more than timber.",
  boon_raised_in_good_season:
    "The report of swift progress sounded unlikely until the beams were raised, the mortar set, and the ledger proved the work had truly happened.",
  boon_stores_made_ready:
    "The stores were not plentiful, but they were dry, counted, and well organised. Each provision had a place, and each place had a record. Order prevented the first edge of crisis from finding purchase.",
  boon_when_the_roads_filled_once_more:
    "At first there was one traveller, then wagons, then families. Roads once emptied by fear began to carry voices again. Each arrival tied the settlement a little closer to the world beyond its lanterns.",
  boon_from_the_brink:
    "The Vale bends under strain, but it has not broken. Pressure revealed weak places, yet also the hands ready to mend them. Resilience showed itself quietly, in repairs made before despair could settle.",
  boon_clear_nights_make_for_clear_plans:
    "The clouds parted after sunset, and lamps burned late over maps and ledgers. In the quiet, choices that had seemed tangled became plain. A clear night can give momentum before a single tool is lifted.",
  boon_shared_hands_lighter_loads:
    "We divided the burden before it could divide us. Every small effort left a mark: a lifted beam, a carried pail, a repaired hinge. Shared work steadied the settlement more surely than any single grand gesture.",
  boon_the_apprentice_steward:
    "The apprentice asked more questions than I had answers for. Three ledgers, two errands, and a day of close observation later, their sharp eyes had found gaps I had missed. Eager hands can widen the settlement's reach without fanfare.",
  boon_shelter_holds:
    "After the storm, I inspected the shelters and found the old repairs still holding. Beams strained but did not fail; walls shuddered but stayed true. Care given early had kept fear from becoming loss.",
  boon_a_welcome_well_met:
    "Doors opened, and the arrivals answered with care of their own. A phrase repeated at the threshold, a gesture offered without demand, a cup placed before a question: these became customs before anyone named them.",
  boon_where_help_stands:
    "Help remained where others might have moved on. By evening, broken beams, scattered tools, and frightened faces had begun to gather into a place of repair rather than loss. Steady presence can alter the shape of trouble.",
  boon_a_wonderful_find:
    "Beneath the fallen vaults we uncovered leather-bound pages, star charts, and intricate tools. Damp had marked them, but not claimed them. What endured there now guides harvest and craft, a quiet proof that patience can preserve more than stone.",
  boon_festival_of_trade:
    "Lanterns lined the road while goods changed hands under careful eyes. There was laughter, but not carelessness; bargaining, but not greed. Small wonders passed from stall to stall, and by dusk the market felt like a promise the settlement could keep.",
  boon_hearths_soften_feuds:
    "Fewer quarrels reached the board this week. Shared meals, mended fences, and small courtesies did more than any order could have done. Trust returned by degrees, carried in bowls of stew and quiet apologies.",
  boon_the_settlement_of_plenty:
    "We set aside what could be spared and sent it where hardship had taken root. Each parcel was small, yet the effect was not. Generosity, carefully tended, multiplied faster than the stores diminished.",
  burden_smoke_over_hearths:
    "The workshops burned day and night, filling nearby homes with sound and smoke. Children coughed behind shuttered windows while neighbours tried to keep out the very labour meant to sustain them.",
  burden_forest_s_grudge:
    "Whole groves vanished to feed the engines of war, and the forest has not forgotten. Healthy branches fall without warning, paths close behind walkers, and woodcutters return early with the look of people overheard by trees.",
  burden_blighted_lands:
    "I marked the first spoiled field at dawn and the second before noon. Farmers say the soil was driven too hard in the years of war. Now it answers every seed with a little less mercy.",
  burden_awoken_in_the_deep:
    "The miners heard something deep within the seam. Whatever hid beneath the earth during the war may still be wounded. Wounded things do not always recognise kindness.",
  burden_stampede:
    "When the armies retreated, they left beasts too frightened to command. We found fences burst outward and tracks driven deep through the mud. With time they may settle, but today they remember only flight.",
  burden_return_to_the_trenches:
    "No one ordered the ditches dug that way, yet the old shapes returned to the earth. Roads meant to connect us began tracing defensive lines, and the settlement remembered tactics we had tried to bury.",
  burden_wares_of_war:
    "Merchants still trade from the old war stores: dented shields, boiled leather, hole-ridden breastplates, and blades worn too thin by use. After each bargain, silence lingers over the table.",
  burden_old_names_old_debts:
    "Not every welcome is easily given. The past is not so simple to extinguish, and old loyalties can flare from a single careless name. Some embers remain dangerous long after the fire is gone.",
  burden_the_quiet_fractures:
    "The Vale rarely announces that it is breaking. It shows itself in the missed greeting, the empty market, the kindness withheld. Small fractures need tending before they learn to widen.",
  burden_tools_left_to_rust:
    "A tool unused becomes another thing to mend. Good blades dull orange, handles split, and hinges stiffen with neglect. Waste is quieter than theft, but it robs the settlement all the same.",
  burden_the_long_cough:
    "The gathering halls remain full, but the air within them has grown stale. Crowded benches and shared cups have carried sickness through the Vale. What began as one cough now follows warmth and fellowship alike.",
  burden_the_storehouses_disagree:
    "Ledgers that once seemed clear no longer agree. Barrels are marked twice, crates move without notation, and every keeper swears their count is true. Numbers can quarrel like neighbours.",
  burden_bare_walls:
    "The houses keep out wind and rain, but little else. Bare timber, cold rooms, and empty shelves make shelter feel unfinished. Settlement comes slowly when homes still look temporary.",
  burden_empty_shelves:
    "These halls were built for warmth, music, and shared meals. Now bowls are half-filled, ale is watered, and singers leave early. Fellowship is harder to maintain when the shelves can no longer support generosity.",
  burden_promises_overstretched:
    "Word travels faster than preparation. The settlement's welcome is now spoken of beyond the hills, but open doors require more than roofs and food. Every promise made must still be carried.",
  burden_welcome_wears_thin:
    "Kind words fade when action can no longer follow. Provisions are scarce, and hands now pause at once-welcoming doors. Shame gathers on both sides of the threshold.",
  arrival_acorns_and_oak_trees:
    "The smallest hands brought acorns; the oldest brought names of groves burned before those children were born. I wrote them together in the ledger. Renewal begins when memory is entrusted to those who will outlive us.",
  arrival_blessed_harvest:
    "The caretakers buried offerings beneath the first seeds and left a share of every harvest for wandering spirits and hungry birds. Whether by blessing, patience, or simply better care, their fields rarely failed.",
  arrival_from_battle_to_cattle:
    "The beast-handler had once kept war mounts and worse. Now his evenings are spent tending lame oxen and brushing ageing draft horses. As I recorded the need for more feed, pasture, and fences, I felt the Vale changing for the better.",
  arrival_from_blade_swingers_to_herb_stringers:
    "They asked for herb beds, drying racks, clean water, and clear instruction. Whether preparing tinctures or trimming roots, their discipline was unmistakable. Peace had not softened their hands; it had given them gentler work.",
  arrival_from_dark_decay_to_light_display:
    "The lorekeepers carried rescued pages in oilcloth, each bundle treated like a patient not yet safe. They asked for shelves, glass lamps, and dryness above all. Their urgency proved well founded.",
  arrival_from_plunderer_to_lumber:
    "They laid their axes on the table before speaking, sharp edges wrapped in cloth. Once, such tools broke doors and threatened homes. Now their owners asked where beams were needed. The first useful swing sounded different.",
  arrival_from_songs_of_war_to_the_search_for_ore:
    "Their marching songs reached us before they did, though the words had changed. Underground, they said, a steady voice can soothe the mountain and steady the hand. I recorded the saying, then heard the tunnels answer.",
  arrival_hands_for_heavy_work:
    "They arrived in a crowded wagon: strong backs, calloused hands, and a need to be useful. They asked for modest meals, safe shelter, and work that builds rather than breaks. By dusk, walls were rising twice as fast.",
  arrival_lanterns_for_the_long_roads:
    "They came at dusk with oil, mirrors, hooks, and a stubborn belief that roads should not surrender after sunset. I saw the first lamp lit beyond the nearest homes, then the second, then the third fading into distance.",
  arrival_lay_down_the_tools_of_destruction:
    "Old armour was surrendered piece by piece: helms for lantern casings, blades for ploughshares, buckles for harness. The veterans overseeing the work said little. The damage on the metal had already spoken enough.",
  arrival_lest_we_forget:
    "They arrived in painted wagons, asking for a place where old names could be spoken without glorifying the wars that took them. By dusk, wood, ribbons, and young hands had gathered. Remembrance began before anyone dared call it theatre.",
  arrival_moving_mountains:
    "The miners arrived with faces marked by dust, sweat, and the scrape of stone. They spoke of the deep earth with reverence rather than greed. Their advice was simple: disasters begin when folk stop listening to the mountain.",
  arrival_news_travels_faster_than_goods:
    "The messenger arrived ahead of the wagons, carrying names, rumours, warnings, and hope in equal measure. They believed knowledge might be the first true bridge rebuilt. I copied the news they brought with particular care.",
  arrival_no_soul_shall_go_without:
    "Canvas awnings became walls, wagons became kitchens, and by nightfall lantern light spilled across the shelter. Those who ran it turned none away: orphan, labourer, refugee, or wanderer. By morning, the settlement had grown a fuller heart.",
  arrival_reablement_for_the_realm:
    "A caravan arrived with unusual cargo: half-finished prosthetics carved from polished wood and hinged with brass. Once battlefield surgeons and armourers, they offered advice worth recording. The Vale must be built for every body that comes to it.",
  arrival_remnants_of_the_cavalry:
    "They rode in slowly, cloaks heavy with rain and years alike. Their horses were older, but immaculately kept. I marked their arrival with a note: find pasture, fresh water, and a reason for these riders to stay.",
  arrival_remnants_of_the_fleet:
    "A river vessel arrived patched with timber from forgotten ports and ruined warships. Once ashore, its crew unloaded strange cargo and studied the banks with practised eyes. They spoke not of raids, but of trade, crossings, and quieter journeys.",
  arrival_spirit_lifting_spirit:
    "The brewer claimed a settlement without laughter ferments only bitterness. I considered striking the remark from the record, then heard the yard erupt in song. By nightfall, even our most reserved settlers had given the tale a second verse.",
  arrival_strong_foundations:
    "The teachers brought slates, timber rules, worn books, and minds sharper than any blade. I marked their arrival as the day careful learning became available to all who now call the Quiet Vale home.",
  arrival_the_burden_bearers:
    "The burden-bearers of the last years asked for a space where grief and exhaustion could be set down. I recorded the request exactly. Even the naming of it seemed to steady the room.",
  arrival_the_dryads:
    "They came with seeds wrapped in green thread and bark carvings reminiscent of relics. Their soft words seemed to sink into roots older than any kingdom. Where they walked, the wildlands grew calmer.",
  arrival_the_hearthbound_circle:
    "They arrived carrying seeds, recipes, and iron cooking pots blackened by years of use. They promised no miracles, only that hardship need not be faced alone. Community makes strong roots; strong roots make resilience.",
  arrival_the_quiet_quest:
    "The adventurers were nothing like tavern stories. Their armour was mismatched, functional, and often repaired. Their first question was which roads ended in unanswered questions. I recorded them as a small company of useful trouble.",
  arrival_the_transmutation_traveler:
    "A broad workbench arrived first, crowded with glass vessels that bubbled softly through the night. Their owner promised no miracles, only changes carefully persuaded from stubborn things. I recorded the work with caution; the impossible had become merely expensive.",
  arrival_what_came_before_the_last_age:
    "Beneath the broken stones, the old world still sleeps. Its intricate tools remember hands that once cultivated knowledge with great care. Not all that came before us was lost; some of it was waiting to be found.",
  golden_boon_the_golden_bell:
    "We found the bell beneath root and rubble, warm beneath the hand despite its long burial. When it rang across the Vale, even abandoned roads seemed to listen. Days later, strangers arrived by ways we thought forgotten.",
  golden_boon_the_golden_scroll:
    "The scroll arrived sealed in gold thread. Its ink shifted between readings: maps into letters, warnings into opportunities, forgotten names into doors. I recorded it as possibility, not prophecy.",
  golden_boon_the_golden_vial:
    "The vial lay sealed in golden wax within the hollow roots of a dead pale tree. Its liquid caught the light like dawn held still. Those who carried it found storms softening, paths opening, and distance less certain of itself.",
  golden_boon_the_golden_eyed_traveler:
    "The traveller appeared after dusk, dry-cloaked despite the rain, and asked only for a place by the fire. Through the night, a melody moved through the sleeping settlement. By morning, the season's weariness had loosened its grip.",
  golden_boon_the_golden_signet_ring:
    "The ring came from a collapsed cairn beneath the mines, its gold untouched by age. When raised, it seemed to remind roads, walls, and foundations of older orders. For a moment, the settlement obeyed memory."
};

for (const card of [...boons, ...burdens, ...arrivals, ...goldenBoons]) {
  card.flavorText = encounterFlavorById[card.id];
}

export const encounterById = Object.fromEntries(
  [...boons, ...burdens, ...arrivals, ...goldenBoons].map((card) => [
    card.id,
    card
  ])
);

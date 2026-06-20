import type { CoreTileData, ResourceCost, SpecialTileData } from "../engine/types";

const cost = (values: Partial<ResourceCost>): ResourceCost => ({
  wood: 0,
  stone: 0,
  metal: 0,
  food: 0,
  herbs: 0,
  goods: 0,
  ...values
});

export const coreTiles: CoreTileData[] = [
  {
    id: "c01_lumber_yard",
    category: "resource",
    count: 2,
    size: 1,
    placement: { terrain: ["woodland"], text: "Place on Woodland." },
    basic: {
      name: "Lumber Yard",
      cost: cost({}),
      effectText: "Activate: Gain 2 Wood.",
      effectType: "production",
      production: cost({ wood: 2 }),
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Sustainable Lumber Yard",
      cost: cost({}),
      effectText: "Activate: Gain 3 Wood and 2 Food.",
      effectType: "production",
      production: cost({ wood: 3, food: 2 }),
      population: 0,
      renown: 0
    }
  },
  {
    id: "c02_mine_tunnel",
    category: "resource",
    count: 2,
    size: 1,
    placement: { terrain: ["mountains"], text: "Place on Mountains." },
    basic: {
      name: "Mine Tunnel",
      cost: cost({}),
      effectText: "Activate: Gain 2 Stone.",
      effectType: "production",
      production: cost({ stone: 2 }),
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Mine Shaft",
      cost: cost({}),
      effectText: "Activate: Gain 3 Stone and 2 Metal.",
      effectType: "production",
      production: cost({ stone: 3, metal: 2 }),
      population: 0,
      renown: 0
    }
  },
  {
    id: "c03_gathering_outpost",
    category: "resource",
    count: 2,
    size: 1,
    placement: { terrain: ["heaths"], text: "Place on Heaths." },
    basic: {
      name: "Gathering Outpost",
      cost: cost({}),
      effectText: "Activate: Gain 2 Herbs.",
      effectType: "production",
      production: cost({ herbs: 2 }),
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Gathering Lodge",
      cost: cost({}),
      effectText: "Activate: Gain 3 Herbs and 2 Food.",
      effectType: "production",
      production: cost({ herbs: 3, food: 2 }),
      population: 0,
      renown: 0
    }
  },
  {
    id: "c04_farmstead",
    category: "resource",
    count: 2,
    size: 1,
    placement: { terrain: ["arable"], text: "Place on Arable Land." },
    basic: {
      name: "Farmstead",
      cost: cost({}),
      effectText: "Activate: Gain 2 Food.",
      effectType: "production",
      production: cost({ food: 2 }),
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Artisan Farm",
      cost: cost({}),
      effectText: "Activate: Gain 3 Food and 2 Goods.",
      effectType: "production",
      production: cost({ food: 3, goods: 2 }),
      population: 0,
      renown: 0
    }
  },
  {
    id: "c05_cabin",
    category: "housing",
    count: 4,
    size: 1,
    basic: {
      name: "Cabin",
      cost: cost({ wood: 2, food: 5 }),
      effectText: "Passive: +2 Population if part of a Housing cluster.",
      effectType: "passive",
      population: 5,
      renown: 0
    },
    upgraded: {
      name: "Fine Cabin",
      cost: cost({ stone: 2, food: 5 }),
      effectText:
        "Passive: +3 Population if part of a Housing cluster. +2 Renown if adjacent to Travel.",
      effectType: "passive",
      population: 10,
      renown: 0
    }
  },
  {
    id: "c06_cottage",
    category: "housing",
    count: 3,
    size: 1,
    placement: {
      adjacentToCategory: ["housing"],
      text: "Place adjacent to a Housing Tile."
    },
    basic: {
      name: "Cottage",
      cost: cost({ wood: 2, metal: 2, food: 8 }),
      effectText: "Passive: +3 Population if part of a Housing cluster.",
      effectType: "passive",
      population: 10,
      renown: 0
    },
    upgraded: {
      name: "Fine Cottage",
      cost: cost({ stone: 2, metal: 4, food: 8 }),
      effectText:
        "Passive: +5 Population if part of a Housing cluster. +3 Renown if adjacent to Travel.",
      effectType: "passive",
      population: 15,
      renown: 0
    }
  },
  {
    id: "c08_inn",
    category: "housing",
    count: 2,
    size: 1,
    placement: {
      adjacentToCategory: ["travel"],
      text: "Place adjacent to a Travel Tile."
    },
    basic: {
      name: "Inn",
      cost: cost({ metal: 6, food: 8, goods: 2 }),
      effectText: "Activate: Add 1 timer token to an active Arrival (max 3).",
      effectType: "activated",
      population: 10,
      renown: 5
    },
    upgraded: {
      name: "Dawn Break Inn",
      cost: cost({ food: 8, goods: 5 }),
      effectText: "Activate: Add up to 2 timer tokens to an active Arrival (max 3).",
      effectType: "activated",
      population: 15,
      renown: 10
    }
  },
  {
    id: "c07_stedding",
    category: "housing",
    count: 2,
    size: 1,
    placement: {
      adjacentToCategory: ["housing"],
      text: "Place adjacent to a Housing Tile."
    },
    basic: {
      name: "Stedding",
      cost: cost({ stone: 4, metal: 6, food: 8 }),
      effectText: "Passive: +5 Population if part of a Housing cluster.",
      effectType: "passive",
      population: 15,
      renown: 0
    },
    upgraded: {
      name: "Fine Stedding",
      cost: cost({ stone: 4, metal: 6, food: 8 }),
      effectText:
        "Passive: +7 Population if part of a Housing cluster. +5 Renown if adjacent to Travel.",
      effectType: "passive",
      population: 20,
      renown: 0
    }
  },
  {
    id: "c09_tavern",
    category: "social",
    count: 2,
    size: 1,
    placement: {
      adjacentToCategory: ["travel"],
      text: "Place adjacent to a Travel Tile."
    },
    basic: {
      name: "Tavern",
      cost: cost({ wood: 2, metal: 2, food: 5 }),
      effectText: "Activate: Remove 1 Strain from an adjacent tile.",
      effectType: "activated",
      population: 0,
      renown: 5
    },
    upgraded: {
      name: "The Steward's Arms",
      cost: cost({ stone: 2, metal: 4, food: 5 }),
      effectText: "Activate: Remove 1 Strain from up to 2 adjacent tiles.",
      effectType: "activated",
      population: 0,
      renown: 10
    }
  },
  {
    id: "c10_eatery",
    category: "social",
    count: 2,
    size: 1,
    basic: {
      name: "Eatery",
      cost: cost({ wood: 2, food: 5, goods: 1 }),
      effectText: "Activate: Remove 1 Strain from an adjacent tile.",
      effectType: "activated",
      population: 5,
      renown: 0
    },
    upgraded: {
      name: "The Crock and Ladle",
      cost: cost({ metal: 4, food: 5, goods: 2 }),
      effectText: "Activate: Remove 1 Strain from up to 2 adjacent tiles.",
      effectType: "activated",
      population: 5,
      renown: 5
    }
  },
  {
    id: "c11_washhouse",
    category: "wellbeing",
    count: 2,
    size: 1,
    placement: {
      adjacentToTerrain: ["water"],
      text: "Place adjacent to Water/River terrain."
    },
    basic: {
      name: "Washhouse",
      cost: cost({ stone: 2, metal: 1, herbs: 5 }),
      effectText: "Activate: Remove 1 Strain from an adjacent tile.",
      effectType: "activated",
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Sweet Flag Bathhouse",
      cost: cost({ stone: 2, metal: 2, herbs: 8 }),
      effectText: "Activate: Remove 1 Strain from up to 2 adjacent tiles.",
      effectType: "activated",
      population: 5,
      renown: 5
    }
  },
  {
    id: "c12_apothecary",
    category: "wellbeing",
    count: 2,
    size: 1,
    basic: {
      name: "Apothecary",
      cost: cost({ wood: 2, stone: 2, herbs: 5 }),
      effectText: "Activate: Remove 1 Strain from an adjacent tile.",
      effectType: "activated",
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Amaryllis Bloom",
      cost: cost({ wood: 4, herbs: 8, goods: 4 }),
      effectText: "Activate: Remove up to 2 Strain from 1 adjacent tile.",
      effectType: "activated",
      population: 0,
      renown: 10
    }
  },
  {
    id: "c13_workshops",
    category: "crafting",
    count: 2,
    size: 1,
    placement: {
      adjacentToCategory: ["travel"],
      text: "Place adjacent to a Travel Tile."
    },
    basic: {
      name: "Workshops",
      cost: cost({ wood: 2, metal: 1 }),
      effectText:
        "Passive: Once per round, when upgrading an adjacent Core Tile, reduce its cost by 1 resource.",
      effectType: "passive",
      population: 0,
      renown: 5
    },
    upgraded: {
      name: "The Makers Conclave",
      cost: cost({ wood: 3, metal: 3, goods: 1 }),
      effectText:
        "Passive: Once per round, when upgrading a reachable Core Tile, reduce its cost by up to 2 resources.",
      effectType: "passive",
      population: 0,
      renown: 10
    }
  },
  {
    id: "c14_market_stalls",
    category: "merchant",
    count: 2,
    size: 1,
    placement: {
      adjacentToCategory: ["travel"],
      text: "Place adjacent to a Travel Tile."
    },
    basic: {
      name: "Market Stalls",
      cost: cost({ wood: 2, stone: 1, goods: 1 }),
      effectText:
        "Passive: Once per round, when paying a cost, you may spend 1 Goods as 1 resource of any type.",
      effectType: "passive",
      population: 0,
      renown: 5
    },
    upgraded: {
      name: "The Seldes",
      cost: cost({ stone: 3, metal: 3, goods: 3 }),
      effectText:
        "Passive: Once per round, when paying a cost, you may spend 1 Goods as up to 2 resources of one type.",
      effectType: "passive",
      population: 0,
      renown: 10
    }
  },
  {
    id: "c15_path",
    category: "travel",
    count: 8,
    size: 1,
    basic: {
      name: "Path",
      cost: cost({}),
      effectText: "Passive: +1 Renown if adjacent to 3 or more non-Travel Tiles.",
      effectType: "passive",
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Improved Path",
      cost: cost({ stone: 2 }),
      alternateCostText: "2 Stone or 2 Wood",
      effectText:
        "Passive: +1 bonus Renown for each other Travel Tile in this connected Travel group, max +4.",
      effectType: "passive",
      population: 0,
      renown: 1
    }
  },
  {
    id: "c18_common_land",
    category: "travel",
    count: 2,
    size: 1,
    basic: {
      name: "Common Land",
      cost: cost({ metal: 2, herbs: 2 }),
      effectText:
        "Passive: 1 adjacent Housing Tile has Supported while this tile is not Overstrained.",
      effectType: "passive",
      population: 0,
      renown: 5
    },
    upgraded: {
      name: "The Pleasance",
      cost: cost({ metal: 2, herbs: 2 }),
      effectText:
        "Passive: Up to 3 adjacent Housing Tiles have Supported while this tile is not Overstrained.",
      effectType: "passive",
      population: 0,
      renown: 5
    }
  },
  {
    id: "c16_street",
    category: "travel",
    count: 6,
    size: 2,
    footprint: "line",
    basic: {
      name: "Street",
      cost: cost({ stone: 2 }),
      alternateCostText: "2 Stone or 2 Wood",
      effectText: "Passive: +1 Renown if adjacent to 3 or more non-Travel Tiles.",
      effectType: "passive",
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Improved Street",
      cost: cost({ stone: 3 }),
      alternateCostText: "3 Stone or 3 Wood",
      effectText:
        "Passive: +1 bonus Renown for each other Travel Tile in this connected Travel group, max +4.",
      effectType: "passive",
      population: 0,
      renown: 1
    }
  },
  {
    id: "c17_track",
    category: "travel",
    count: 4,
    size: 3,
    footprint: "line",
    basic: {
      name: "Track",
      cost: cost({ stone: 3 }),
      alternateCostText: "3 Stone or 3 Wood",
      effectText: "Passive: +1 Renown if adjacent to 3 or more non-Travel Tiles.",
      effectType: "passive",
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Improved Track",
      cost: cost({ stone: 4 }),
      alternateCostText: "4 Stone or 4 Wood",
      effectText:
        "Passive: +1 bonus Renown for each other Travel Tile in this connected Travel group, max +4.",
      effectType: "passive",
      population: 0,
      renown: 1
    }
  },
  {
    id: "c19_bridge",
    category: "travel",
    count: 3,
    size: 1,
    placement: { terrain: ["water"], text: "Place on Water/River terrain." },
    basic: {
      name: "Bridge",
      cost: cost({ wood: 2 }),
      effectText: "Passive: Connect the settlement network across this river.",
      effectType: "passive",
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Stone Bridge",
      cost: cost({ stone: 2 }),
      effectText:
        "Passive: Connect the settlement network across this river. Supported.",
      effectType: "passive",
      population: 0,
      renown: 5
    }
  },
  {
    id: "c20_dig_site",
    category: "resource",
    count: 1,
    size: 1,
    placement: { terrain: ["ruins"], text: "Place on Ruins." },
    basic: {
      name: "Dig Site",
      cost: cost({}),
      effectText: "Activate: Gain 2 Metal.",
      effectType: "production",
      production: cost({ metal: 2 }),
      population: 0,
      renown: 0
    },
    upgraded: {
      name: "Excavation Site",
      cost: cost({}),
      effectText: "Activate: Gain 3 Metal and 2 Goods.",
      effectType: "production",
      production: cost({ metal: 3, goods: 2 }),
      population: 0,
      renown: 0
    }
  },
  {
    id: "c21_the_vaults",
    category: "wellbeing",
    count: 1,
    size: 1,
    placement: {
      adjacentToTerrain: ["ruins"],
      text: "Place adjacent to Ruins terrain."
    },
    basic: {
      name: "The Vaults",
      cost: cost({ wood: 3, stone: 3, herbs: 5 }),
      effectText: "Activate: Remove 1 Strain from an adjacent tile.",
      effectType: "activated",
      population: 0,
      renown: 5
    },
    upgraded: {
      name: "Archaeologists' Archives",
      cost: cost({ wood: 5, stone: 5, herbs: 5 }),
      effectText: "Activate: Remove up to 2 Strain from 1 adjacent tile.",
      effectType: "activated",
      population: 0,
      renown: 10
    }
  }
];

export const specialTiles: SpecialTileData[] = [
  {
    id: "special_adventurers_guild",
    name: "Adventurers' Guild",
    category: "crafting",
    count: 1,
    unlockSource: "Quiet Quest",
    placement: {
      adjacentToCategory: ["social"],
      text: "Place adjacent to a Social Tile."
    },
    effectText: "Activated Effect, once per Season: Resolve 1 active Burden.",
    population: 5,
    renown: 5
  },
  {
    id: "special_alchemist_s_workshop",
    name: "Alchemist's Workshop",
    category: "crafting",
    count: 1,
    unlockSource: "Transmutation Traveller",
    placement: {
      adjacentToTerrain: ["ruins"],
      text: "Place adjacent to Ruins terrain."
    },
    effectText:
      "Activated Effect: Exchange up to 5 total Warehouse resources for the same number of non-Goods resources, or exchange 5 total resources for 3 Goods.",
    population: 5,
    renown: 5
  },
  {
    id: "special_alms_house",
    name: "Alms House",
    category: "wellbeing",
    count: 1,
    unlockSource: "No Soul Goes Unserved",
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_atelier_workshop",
    name: "Atelier Workshop",
    category: "wellbeing",
    count: 1,
    unlockSource: "Reablement for the Vale",
    placement: {
      adjacentToCategory: ["wellbeing"],
      text: "Place adjacent to a Wellbeing Tile."
    },
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_brewery_of_legends",
    name: "Brewery of Legends",
    category: "crafting",
    count: 1,
    unlockSource: "Spirit-Lifting",
    placement: {
      adjacentToCategory: ["social"],
      text: "Place adjacent to a Social Tile."
    },
    effectText:
      "Once per Season, when any player places a Housing tile adjacent to this tile, that tile costs 0 resources.",
    population: 5,
    renown: 5
  },
  {
    id: "special_docks",
    name: "Docks",
    category: "travel",
    count: 1,
    unlockSource: "Remnants of the Fleet",
    placement: { terrain: ["water"], text: "Place on Water/River terrain." },
    effectText:
      "Passive: Connects its settlement network to every non-Overstrained tile adjacent to Water/River terrain.",
    population: 5,
    renown: 5
  },
  {
    id: "special_hearth_garden",
    name: "Hearth Garden",
    category: "wellbeing",
    count: 1,
    unlockSource: "Hearthbound Circle",
    placement: {
      adjacentToCategory: ["housing"],
      text: "Place adjacent to a Housing Tile."
    },
    effectText:
      "Activated Effect, once per Season: Remove up to 2 Strain from Housing, Social, and/or Wellbeing Tiles.",
    population: 5,
    renown: 5
  },
  {
    id: "special_house_of_learning",
    name: "House of Learning",
    category: "social",
    count: 1,
    unlockSource: "Strong Foundations",
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_labourers_yard",
    name: "Labourers' Yard",
    category: "crafting",
    count: 1,
    unlockSource: "Hands for Heavy Work",
    placement: {
      adjacentToCategory: ["travel"],
      text: "Place adjacent to a Travel Tile."
    },
    effectText:
      "Once per round, when any player places a tile adjacent to this tile, reduce that tile's cost by 2 resources.",
    population: 5,
    renown: 5
  },
  {
    id: "special_lantern_roadhouse",
    name: "Lantern Roadhouse",
    category: "travel",
    count: 1,
    unlockSource: "Lanterns for Roads",
    placement: {
      adjacentToCategory: ["travel"],
      text: "Place adjacent to a Travel Tile."
    },
    effectText:
      "When placed or activated: Travel Tiles in this tile's connected settlement network gain Supported while this tile is not Overstrained.",
    population: 5,
    renown: 5
  },
  {
    id: "special_reliquary",
    name: "Reliquary",
    category: "merchant",
    count: 1,
    unlockSource: "Repurpose Tools",
    placement: {
      adjacentToCategory: ["merchant"],
      text: "Place adjacent to a Merchant Tile."
    },
    effectText: "Activated Effect, once per Season: Resolve 1 active Burden.",
    population: 5,
    renown: 5
  },
  {
    id: "special_shrine_of_ancestors",
    name: "Shrine of Ancestors",
    category: "resource",
    count: 1,
    unlockSource: "Before the Last Age",
    placement: {
      adjacentToTileIds: ["c20_dig_site"],
      text: "Place adjacent to a Dig Site / Excavation Site."
    },
    effectText:
      "Passive: Once per round, when an adjacent Dig Site / Excavation Site is activated for Production, gain 2 additional resources of types that tile can produce.",
    population: 0,
    renown: 5
  },
  {
    id: "special_shrine_of_ancients",
    name: "Shrine of Ancients",
    category: "resource",
    count: 1,
    unlockSource: "The Dryads",
    placement: {
      adjacentToTileIds: ["c03_gathering_outpost"],
      text: "Place adjacent to a Gathering Outpost / Gathering Lodge."
    },
    effectText:
      "Passive: Once per round, when an adjacent Gathering Outpost / Gathering Lodge is activated for Production, gain +2 Herbs.",
    population: 0,
    renown: 5
  },
  {
    id: "special_shrine_of_bounty",
    name: "Shrine of Bounty",
    category: "resource",
    count: 1,
    unlockSource: "Blessed Harvest",
    placement: {
      adjacentToTileIds: ["c04_farmstead"],
      text: "Place adjacent to a Farmstead / Artisan Farm."
    },
    effectText:
      "Passive: Once per round, when an adjacent Farmstead / Artisan Farm is activated for Production, gain +2 Food.",
    population: 0,
    renown: 5
  },
  {
    id: "special_shrine_of_depths",
    name: "Shrine of Depths",
    category: "resource",
    count: 1,
    unlockSource: "Moving Mountains",
    placement: {
      adjacentToTileIds: ["c02_mine_tunnel"],
      text: "Place adjacent to a Mine Tunnel / Mine Shaft tile."
    },
    effectText:
      "Passive: Once per round, when an adjacent Mine Tunnel / Mine Shaft is activated for Production, gain +2 resources of types that tile can produce.",
    population: 0,
    renown: 5
  },
  {
    id: "special_shrine_of_renewal",
    name: "Shrine of Renewal",
    category: "resource",
    count: 1,
    unlockSource: "Acorns & Oak Trees",
    placement: {
      adjacentToTileIds: ["c01_lumber_yard"],
      text: "Place adjacent to a Lumber Yard / Sustainable Lumber Yard."
    },
    effectText:
      "Passive: Once per round, when an adjacent Lumber Yard / Sustainable Lumber Yard is activated for Production, gain +2 resources of types that tile can produce.",
    population: 0,
    renown: 5
  },
  {
    id: "special_stables",
    name: "Stables",
    category: "travel",
    count: 2,
    size: 2,
    footprint: "detached",
    unlockSource: "Remnants of the Cavalry",
    effectText:
      "Passive: Move a Steward Token between placed Stables or adjacent tiles. The destination tile must not be Overstrained.",
    population: 0,
    renown: 5
  },
  {
    id: "special_the_iron_roots_respite",
    name: "The Iron Roots Respite",
    category: "resource",
    count: 1,
    unlockSource: "Songs of War to Ore",
    placement: {
      adjacentToTileIds: ["c02_mine_tunnel"],
      text: "Place adjacent to a Mine Tunnel / Mine Shaft tile."
    },
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_the_lorekeepers_respite",
    name: "The Lorekeepers' Respite",
    category: "resource",
    count: 1,
    unlockSource: "Dark Decay to Light",
    placement: {
      adjacentToTileIds: ["c20_dig_site"],
      text: "Place adjacent to a Dig Site / Excavation Site."
    },
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_the_reavers_respite",
    name: "The Reavers' Respite",
    category: "resource",
    count: 1,
    unlockSource: "Plunderer to Lumber",
    placement: {
      adjacentToTileIds: ["c01_lumber_yard"],
      text: "Place adjacent to a Lumber Yard / Sustainable Lumber Yard."
    },
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_the_resting_hall",
    name: "The Resting Hall",
    category: "wellbeing",
    count: 1,
    unlockSource: "Burden-Bearers",
    placement: {
      adjacentToCategory: ["housing", "wellbeing"],
      text: "Place adjacent to a Housing Tile or Wellbeing Tile."
    },
    effectText:
      "Passive: When players resolve an active Burden, remove 1 Strain from 1 placed tile.",
    population: 5,
    renown: 5
  },
  {
    id: "special_the_root_weavers_respite",
    name: "The Root Weavers Respite",
    category: "resource",
    count: 1,
    unlockSource: "Blade to Herb",
    placement: {
      adjacentToTileIds: ["c03_gathering_outpost"],
      text: "Place adjacent to a Gathering Outpost / Gathering Lodge."
    },
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_the_tamers_respite",
    name: "The Tamers' Respite",
    category: "resource",
    count: 1,
    unlockSource: "Battle to Cattle",
    placement: {
      adjacentToTileIds: ["c04_farmstead"],
      text: "Place adjacent to a Farmstead / Artisan Farm."
    },
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  },
  {
    id: "special_the_waystation",
    name: "The Waystation",
    category: "merchant",
    count: 1,
    unlockSource: "News Travels Faster",
    placement: {
      adjacentToCategory: ["travel"],
      text: "Place adjacent to a Travel Tile."
    },
    effectText:
      "Activated Effect: Look at the top 3 cards of the Encounter Deck, then return them in any order.",
    population: 5,
    renown: 5
  },
  {
    id: "special_theater",
    name: "Theatre",
    category: "social",
    count: 1,
    unlockSource: "Lest We Forget",
    placement: {
      adjacentToCategory: ["social"],
      text: "Place adjacent to a Social Tile."
    },
    effectText:
      "When placed or activated: Choose up to two adjacent tiles. They gain Supported.",
    population: 5,
    renown: 5
  }
];

export const coreTileById = Object.fromEntries(
  coreTiles.map((tile) => [tile.id, tile])
) as Record<string, CoreTileData>;

export const specialTileById = Object.fromEntries(
  specialTiles.map((tile) => [tile.id, tile])
) as Record<string, SpecialTileData>;

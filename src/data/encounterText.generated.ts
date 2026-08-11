// Generated from design/component-list/The_Quiet_Vale_Master_Component_List.xlsx.
// Run tmp/card-prototype-update/inspect_component_list.mjs and this generator to refresh.
import type { SeasonEffectText } from "../engine/types";

interface CanonicalSeasonCardText {
  name: string;
  flavorText: string;
  effects: SeasonEffectText;
}

interface CanonicalBoonText extends CanonicalSeasonCardText {
  lifecycles: SeasonEffectText;
}

interface CanonicalBurdenText extends CanonicalSeasonCardText {
  resolutions: SeasonEffectText;
}

interface CanonicalArrivalText {
  name: string;
  flavorText: string;
  requirementText: string;
  rewardText: string;
}

interface CanonicalGoldenBoonText {
  name: string;
  flavorText: string;
  effectText: string;
  lifecycle: string;
}

export const canonicalBoonText: Record<string, CanonicalBoonText> = {
  "boon_a_light_on_the_long_dark_lanterns_illuminated_the_way_to_a_safer_day": {
    "name": "Lanterns in the Dark",
    "flavorText": "Lanterns were hung along roads and crossings fighting back the dark. Fewer feet slipped, fewer travellers lost heart, and confidence grew in the night.",
    "effects": {
      "season1": "You may pay 2 Metal to remove 1 Strain from any Tile.",
      "season2": "You may pay 4 Metal to remove up to 2 Strain from 1 Travel/Housing Tile; it gains Supported.",
      "season3": "You may pay 6 Metal to remove up to 3 Strain from up to 2 Travel/Housing Tiles; each gains Supported."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_a_little_more_time": {
    "name": "A Little Time",
    "flavorText": "A gate held open for one more moment can change a welcome. Patience did what speed could not and made room for the hesitant, the weary, and the nearly turned away.",
    "effects": {
      "season1": "Add 1 timer to an active Arrival (max 3).",
      "season2": "Add up to 2 timers among active Arrivals (max 3 each).",
      "season3": "Add up to 3 timers among active Arrivals (max 3 each)."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_a_welcome_well_met": {
    "name": "Welcome Well Met",
    "flavorText": "Doors opened, and newcomers repaid welcome with kindness. A threshold greeting, a helping hand, a cup before questions. These courtesies became customs before anyone named them.",
    "effects": {
      "season1": "Next completed Arrival costs 1 fewer Requirement resource.",
      "season2": "Next completed Arrival costs 2 fewer Requirement resources.",
      "season3": "Next completed Arrival costs 3 fewer Requirement resources."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_a_wonderful_find": {
    "name": "The Wonderful Find",
    "flavorText": "Under the fallen vaults waited watermarked pages, star charts, and delicate tools. Though damp had touched them, their knowledge endured to guide our harvests and craft.",
    "effects": {
      "season1": "Gain 1 Metal or 1 Goods. If a Salvage Tile is placed, one gains Supported.",
      "season2": "Gain 1 Metal and 1 Goods; then −1 Strain from a Salvage Tile or a Tile adjacent to Ruins.",
      "season3": "Gain 2 Metal and 2 Goods; then −1 Strain from each of up to 2 Salvage or Ruins-adjacent Tiles."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_bounty_of_the_first_harvest": {
    "name": "First Harvest Bounty",
    "flavorText": "At dawn the first harvest seemed modest. By midday it exceeded all counts; by evening, bread and broth scented the streets. Shared baskets made the Vale feel like home.",
    "effects": {
      "season1": "Next Farm Production: +1 Food.",
      "season2": "Next 2 Farm Productions: +1 Food and +1 Goods each.",
      "season3": "Each Farm Production this round: +2 Food or Goods."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until 2 uses or Season end.",
      "season3": "Keep until round end, then discard."
    }
  },
  "boon_carts_before_sunrise": {
    "name": "Carts Before Sunrise",
    "flavorText": "By sunrise, carts had already rolled between storehouse, stall, and workshop a half dozen times. Nothing grand was announced, yet the day’s work had begun before anyone thought to ask.",
    "effects": {
      "season1": "Next Production by a Resource Tile beside Travel costs 0 Actions.",
      "season2": "Next Crafting/Merchant Passive beside Travel may apply once extra.",
      "season3": "Each use: Resource beside Travel produces for 0 Actions, or Crafting/Merchant beside Travel triggers twice."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until 2 uses or Season end."
    }
  },
  "boon_clear_nights_make_for_clear_plans": {
    "name": "Clear Nights and Plans",
    "flavorText": "Under a clear night sky, lamps burned late above maps and ledgers. Knotted choices loosened into plans, and by dawn the settlement was ready to move.",
    "effects": {
      "season1": "Look at the top 2 Encounter Cards; return them in any order.",
      "season2": "Look at the top 3 Encounter Cards; return them in any order.",
      "season3": "Look at the top 4 Encounter Cards; return them in any order. You may move 1 to the top."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_craft_fair": {
    "name": "Crafting Fair",
    "flavorText": "The square filled with tools, cloth, carvings, and cookfires. Craftsfolk shared their pride and skill, and neighbours who came only to look left carrying new knowledge.",
    "effects": {
      "season1": "Next Crafting place/upgrade: −1 resource. If beside Housing, that Housing gains Supported.",
      "season2": "Next Crafting place/upgrade: −2 resources. If beside Housing/Merchant, −1 Strain from an adjacent Tile.",
      "season3": "Next Crafting place/upgrade: 0 resources. If beside Housing/Merchant, up to 2 neighbours gain Supported."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_festival_of_trade": {
    "name": "Trade Festival",
    "flavorText": "Lanterns lit the market as goods changed hands and laughter rose between the stalls. By dusk, honest bargains and small wonders renewed the settlement’s faith in trade.",
    "effects": {
      "season1": "Choose a Merchant: +1 Goods per adjacent Tile category (max 2).",
      "season2": "Choose a Merchant: +1 Goods per adjacent Tile category (max 4). One adjacent Housing gains Supported.",
      "season3": "Choose a Merchant: +1 Goods per adjacent Tile category (max 6). One adjacent Housing gains Supported."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_hearths_soften_feuds": {
    "name": "Hearths Soften Feuds",
    "flavorText": "Shared meals and mended fences softened quarrels no order could settle. Trust returned by degrees, carried between neighbours in bowls of stew and quiet apologies.",
    "effects": {
      "season1": "Choose 1 Housing Tile: it gains Supported; if in a Housing cluster, −1 Strain from it.",
      "season2": "Choose up to 2 Housing Tiles: each gains Supported; if in a Housing cluster, −1 Strain from that Tile.",
      "season3": "Choose a Housing cluster: up to 3 Tiles gain Supported; remove up to 2 Strain among them."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_from_the_brink": {
    "name": "From the Brink",
    "flavorText": "Strain bent the Vale without breaking it. Every weakness revealed someone ready to mend it, and quiet repairs began before despair could take root.",
    "effects": {
      "season1": "Remove up to 2 Strain from 1 Overstrained Tile. If none, −1 Strain from any Tile.",
      "season2": "Remove up to 2 Strain from 1 Overstrained Tile. If none, −1 Strain from up to 2 Tiles.",
      "season3": "Remove up to 2 Strain from each of up to 2 Overstrained Tiles. If none, −1 Strain from up to 3 Tiles."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_ledgers_flow": {
    "name": "Ledgers Flow",
    "flavorText": "Once the paths were known, ledgers, tools, and goods began to move before anyone had to ask. What was needed was provided.",
    "effects": {
      "season1": "If a Resource Tile connects to a Crafting/Merchant Tile, gain 2 Goods.",
      "season2": "If Resource, Crafting and Merchant Tiles form a connected group, gain 3 Goods.",
      "season3": "If Resource, Crafting and Merchant Tiles form a connected group, gain 4 Goods."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_many_hands_make_light_work": {
    "name": "Many Hands, Light Work",
    "flavorText": "Stones moved today that would have broken a single back. Beams rose, meals were passed along, and each task became lighter as hands joined it. Cooperation lifted more than timber.",
    "effects": {
      "season1": "Next Tile placed costs 1 fewer resource.",
      "season2": "Next 2 Tiles placed cost 1 fewer resource each.",
      "season3": "Next 2 Tiles placed/upgraded cost 2 fewer resources each."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until 2 uses or Season end.",
      "season3": "Keep until 2 uses or Season end."
    }
  },
  "boon_old_foundations_still_remain": {
    "name": "Old Foundations",
    "flavorText": "Our spades struck foundations older than memory, their stones firm beneath the soil. The hands that laid them are gone, yet their careful work still carries the Vale.",
    "effects": {
      "season1": "Next Housing placed gains Supported. If beside Ruins, −1 Strain from a neighbouring Tile.",
      "season2": "Next Housing placed gains Supported. If beside Ruins/Housing, remove up to 2 Strain from neighbours.",
      "season3": "Next Housing place/upgrade gains Supported. Beside Ruins/Housing: remove up to 3 Strain from neighbours."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_one_thousand_swings_of_the_pickaxe_opens_up_a_new_path": {
    "name": "Pickaxe Reveals Passage",
    "flavorText": "The stone yielded after weeks beneath the pickaxe. Miners emerged grey with dust and bright with pride. Beyond the broken wall, a passage wound into promising depths.",
    "effects": {
      "season1": "Next Mine Production: +1 Stone.",
      "season2": "Next 2 Mine Productions: +1 Stone and +1 Metal each.",
      "season3": "Each Mine Production this round: +2 Stone or Metal."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until 2 uses or Season end.",
      "season3": "Keep until round end, then discard."
    }
  },
  "boon_raised_in_good_season": {
    "name": "Raised in Season",
    "flavorText": "The report of swift progress sounded unlikely until the beams were raised, the mortar set, and the ledger proved the work had truly happened.",
    "effects": {
      "season1": "Next Core upgrade costs 1 fewer resource.",
      "season2": "Next Core upgrade costs 2 fewer resources.",
      "season3": "Next Core upgrade costs 3 fewer resources."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_shared_hands_lighter_loads": {
    "name": "Shared Hands",
    "flavorText": "No single deed saved the day. A beam lifted here, a pail carried there, a hinge repaired before dusk. Together, these small efforts became more than their sum.",
    "effects": {
      "season1": "Next Burden resolved costs 2 fewer resources.",
      "season2": "Next Burden resolved costs 4 fewer resources.",
      "season3": "Next Burden resolved costs 6 fewer resources."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_shelter_holds": {
    "name": "Shelter Holds",
    "flavorText": "At dawn we found the shelters battered but standing. Every mended beam and patched wall had held through the night, proving that care given early is never wasted.",
    "effects": {
      "season1": "−1 Strain from 1 Supported Tile.",
      "season2": "Remove 1 Strain from up to 2 Supported Tiles.",
      "season3": "Remove 1 Strain from up to 3 Supported Tiles."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_stores_made_ready": {
    "name": "Stores Ready",
    "flavorText": "Our stores held little excess, yet everything was dry, counted, and in its proper place. When trouble came looking for weakness, careful records gave it none.",
    "effects": {
      "season1": "Exchange up to 2 Warehouse resources for the same number of any resource types.",
      "season2": "Exchange up to 4 Warehouse resources for the same number of any resource types.",
      "season3": "Exchange up to 6 Warehouse resources for the same number of any resource types."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_the_ancient_ways_gradually_reemerge": {
    "name": "Ancient Paths Reopen",
    "flavorText": "Careful cutting let the woodland breathe. Under bramble and leaf mould, forgotten paths emerged, leading toward hidden groves and trails the Vale had long abandoned.",
    "effects": {
      "season1": "Next Lumber Production: +1 Wood.",
      "season2": "Next 2 Lumber Productions: +2 Wood each.",
      "season3": "Each Lumber Production this round: +2 Wood or Food."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until 2 uses or Season end.",
      "season3": "Keep until round end, then discard."
    }
  },
  "boon_the_apprentice_steward": {
    "name": "Apprentice Steward",
    "flavorText": "The apprentice asked more questions than I could answer. Three ledgers and a day of close observation later, their sharp eyes had found gaps I had missed.",
    "effects": {
      "season1": "Place next Resource Tile for 0 Actions.",
      "season2": "Place next Resource/Housing Tile for 0 Actions.",
      "season3": "Place next Tile for 0 Actions."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_the_rains_that_we_sheltered_from_now_yield_the_bounty_of_nature": {
    "name": "Rain Brings Bounty",
    "flavorText": "Rain held the Vale quiet for a day and night. When clouds cleared, moss had thickened, herbs had risen, and the softened ground answered with green abundance.",
    "effects": {
      "season1": "Next Gathering Production: +1 Herbs.",
      "season2": "Next 2 Gathering Productions: +2 Herbs each.",
      "season3": "Each Gathering Production this round: +2 Herbs or Food."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until 2 uses or Season end.",
      "season3": "Keep until round end, then discard."
    }
  },
  "boon_the_scent_of_herb_and_tonic": {
    "name": "Herb & Tonic",
    "flavorText": "Herbal smoke curled above the roofs after dark. Careful hands prepared tonics and poultices through the night. By morning, sickrooms were quieter and the Vale stronger.",
    "effects": {
      "season1": "You may pay 2 Herbs to remove 1 Strain from any Tile.",
      "season2": "You may pay 4 Herbs to remove up to 2 Strain from any Tile.",
      "season3": "You may pay 6 Herbs to remove up to 3 Strain from up to 2 Tiles."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_the_settlement_of_plenty": {
    "name": "Settlement of Plenty",
    "flavorText": "What the settlement could spare was divided into modest parcels and sent where need was greatest. Our stores diminished, yet the kindness they carried multiplied across the Vale.",
    "effects": {
      "season1": "Choose 3+ connected, non-Overstrained Tiles: −1 Strain from one. If none, gain 2 Food or Goods.",
      "season2": "4+ connected, non-Overstrained Tiles: remove up to 2 Strain among them; if none, gain 3 Food/Goods.",
      "season3": "5+ connected, non-Overstrained Tiles: remove up to 3 Strain among them; if none, gain 5 Food/Goods."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_what_is_written_in_the_stars_can_finally_be_heeded": {
    "name": "Stars Guide Plans",
    "flavorText": "The Vale fell quiet beneath a clear night sky. We followed the stars across our maps until uncertain routes became plans and guesses gave way to purpose.",
    "effects": {
      "season1": "Look at the top 5 Encounter Cards. Keep their order, but you may move 1 to the bottom.",
      "season2": "Look at the top 5 Encounter Cards; return them in any order.",
      "season3": "Look through the remaining Encounter Deck; return it in any order."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  },
  "boon_when_the_roads_filled_once_more": {
    "name": "Roads Filled Again",
    "flavorText": "The roads filled slowly. A traveller, a wagon, whole families. With every new voice, paths once ruled by fear became threads joining the Vale to the wider world.",
    "effects": {
      "season1": "Place next Travel Tile for 0 Actions.",
      "season2": "Place or upgrade next Travel Tile for 0 Actions.",
      "season3": "Place or upgrade next Travel Tile for 0 Actions."
    },
    "lifecycles": {
      "season1": "Keep until used or Season end.",
      "season2": "Keep until used or Season end.",
      "season3": "Keep until used or Season end."
    }
  },
  "boon_where_help_stands": {
    "name": "Help Stands",
    "flavorText": "They stayed when others might have moved on. Broken beams were lifted, tools gathered, and frightened faces steadied. By evening, trouble had begun to resemble recovery.",
    "effects": {
      "season1": "Each Steward-occupied Tile: −1 Strain; if it had none, gain 1 resource (max 2 total).",
      "season2": "Each Steward-occupied Tile: −1 Strain; if it had none, gain 2 resources (max 4 total).",
      "season3": "Each Steward-occupied Tile: −1 Strain; if it had none, gain 3 resources (max 6 total)."
    },
    "lifecycles": {
      "season1": "Resolve, then discard.",
      "season2": "Resolve, then discard.",
      "season3": "Resolve, then discard."
    }
  }
};

export const canonicalBurdenText: Record<string, CanonicalBurdenText> = {
  "burden_awoken_in_the_deep": {
    "name": "Awoken Below",
    "flavorText": "The miners heard something deep within the seam. Whatever hid beneath the earth during the war may still be wounded. Wounded things do not always recognise kindness.",
    "effects": {
      "season1": "Choose 1 Mine Tile: +1 Strain.",
      "season2": "Choose 1 Mine Tile: +2 Strain.",
      "season3": "Choose 1 Mine Tile: +2 Strain. Then choose 1 adjacent Travel/Resource Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Food, discard.",
      "season2": "Spend 1 Action, pay 4 Food, discard.",
      "season3": "Spend 1 Action, pay 6 Food, discard."
    }
  },
  "burden_bare_walls": {
    "name": "Bare Walls",
    "flavorText": "The houses keep out wind and rain, but little else. Bare timber, cold rooms, and empty shelves make shelter feel unfinished. Settlement comes slowly when homes still look temporary.",
    "effects": {
      "season1": "Choose 1 Housing Tile not adjacent to Social/Wellbeing: +1 Strain. If none, lose 1 Goods.",
      "season2": "Choose up to 2 Housing Tiles not adjacent to Social/Wellbeing: +1 Strain each. If none, lose 2 Goods.",
      "season3": "Choose up to 3 Housing Tiles not adjacent to Social/Wellbeing: +1 Strain each. If none, lose 3 Goods."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Wood, discard.",
      "season2": "Spend 1 Action, pay 4 Wood, discard.",
      "season3": "Spend 1 Action, pay 6 Wood, discard."
    }
  },
  "burden_blighted_lands": {
    "name": "Blighted Lands",
    "flavorText": "I marked the first spoiled field at dawn and the second before noon. Farmers say the soil was driven too hard in the years of war. Now it answers every seed with a little less mercy.",
    "effects": {
      "season1": "Choose 1 Farm Tile: +1 Strain.",
      "season2": "Choose 1 Farm Tile: +2 Strain.",
      "season3": "Choose 1 Farm Tile: +2 Strain. Then choose 1 adjacent Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Food, discard.",
      "season2": "Spend 1 Action, pay 4 Food, discard.",
      "season3": "Spend 1 Action, pay 6 Food, discard."
    }
  },
  "burden_coin_before_craft": {
    "name": "Coin Before Craft",
    "flavorText": "The markets have grown faster than the workshops can sustain. Good hands set down precious tools to argue over time, price, and fairness. Even after compromise, resentment remains on the bench.",
    "effects": {
      "season1": "Choose 1 Merchant/Crafting Tile adjacent to the other type: +1 Strain.",
      "season2": "Choose 1 Merchant and 1 Crafting Tile adjacent to each other: +1 Strain each.",
      "season3": "Up to 2 Merchant and 2 Crafting, adjacent across types: +1 Strain each. If none, 1 of either: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_empty_shelves": {
    "name": "Empty Shelves",
    "flavorText": "These warm halls were built for music and shared meals. Now bowls are half-filled, ale watered, and singers leave early. Fellowship falters when shelves cannot support generosity.",
    "effects": {
      "season1": "Choose 1 Social Tile: pay 1 Goods or +1 Strain.",
      "season2": "Choose 2 Social Tiles; each: pay 1 Goods or +1 Strain.",
      "season3": "Choose 3 Social Tiles; each: pay 1 Goods or +1 Strain. If none, choose 1 Housing Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_forest_s_grudge": {
    "name": "Forest’s Grudge",
    "flavorText": "Whole hillsides were stripped bare for war. Since then, the forest has grown watchful and angry. Paths vanish, branches fall, and each axe stroke seems to wake something deeper.",
    "effects": {
      "season1": "Choose 1 Lumber Tile: +1 Strain.",
      "season2": "Choose 1 Lumber Tile: +2 Strain.",
      "season3": "Choose 1 Lumber Tile: +2 Strain. Then choose 1 adjacent Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Wood, discard.",
      "season2": "Spend 1 Action, pay 4 Wood, discard.",
      "season3": "Spend 1 Action, pay 6 Wood, discard."
    }
  },
  "burden_foundations_remember_war": {
    "name": "Foundations Remember War",
    "flavorText": "Beneath the new walls, the mason found old iron set for a harder purpose than housing. Rust had split the footing, and with it the confidence that peaceful homes could stand there.",
    "effects": {
      "season1": "Choose 1 upgraded Core Tile: +1 Strain.",
      "season2": "Choose 1 upgraded Core Tile: +1 Strain. Then 1 adjacent Tile: +1 Strain.",
      "season3": "Choose 1 upgraded Core Tile: +2 Strain. Then 1 adjacent Tile: +2 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Stone, discard.",
      "season2": "Spend 1 Action, pay 4 Stone, discard.",
      "season3": "Spend 1 Action, pay 6 Stone, discard."
    }
  },
  "burden_ill_omen_of_discontent": {
    "name": "Omen of Discontent",
    "flavorText": "The signs were nothing at first: cracked paving, a twisted tree, a rumour carried from a tired doorstep. By dusk, every weary household had given them meaning, and the route lay empty.",
    "effects": {
      "season1": "Choose 1 Travel Tile adjacent to Housing with 1+ Strain: +1 Strain.",
      "season2": "Choose 2 Travel Tiles, each adjacent to Housing with 1+ Strain: +1 Strain each.",
      "season3": "Choose 3 Travel Tiles beside Housing with 1+ Strain: +1 Strain each. If none, 1 Travel: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Herbs, discard.",
      "season2": "Spend 1 Action, pay 4 Herbs, discard.",
      "season3": "Spend 1 Action, pay 6 Herbs, discard."
    }
  },
  "burden_old_names_old_debts": {
    "name": "Old Names, Old Debts",
    "flavorText": "Not every welcome is easily given. The past is not so simple to extinguish, and old loyalties can flare from a single careless name. Some embers remain dangerous long after the fire is gone.",
    "effects": {
      "season1": "Choose 1 Tile with Renown: +1 Strain.",
      "season2": "Choose 2 Tiles with Renown: +1 Strain each.",
      "season3": "Choose 3 Tiles with Renown: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_old_wounds_reopen": {
    "name": "Old Wounds Reopen",
    "flavorText": "Peace does not close every hurt. A song, a sigil, a name spoken too lightly can uncover wounds only just beginning to heal. Afterwards, silence does the damage words began.",
    "effects": {
      "season1": "Choose 1 Social/Wellbeing Tile: pay 2 Herbs or +1 Strain.",
      "season2": "Choose 2 Social/Wellbeing Tiles: pay 4 Herbs total or +1 Strain each.",
      "season3": "Choose 3 Social/Wellbeing Tiles: pay 6 Herbs total or +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Herbs, discard.",
      "season2": "Spend 1 Action, pay 4 Herbs, discard.",
      "season3": "Spend 1 Action, pay 6 Herbs, discard."
    }
  },
  "burden_only_road_in": {
    "name": "Only Road In",
    "flavorText": "Every cart and errand passed through the same narrow way until they did not. One broken wheel, one flooded rut, and the whole settlement remembered how fragile a single road can be.",
    "effects": {
      "season1": "Choose 1 Merchant/Crafting Tile adjacent to exactly 1 Travel Tile: +1 Strain.",
      "season2": "Choose 2 Merchant/Crafting Tiles, each adjacent to exactly 1 Travel Tile: +1 Strain each.",
      "season3": "Choose 3 Merchant/Crafting Tiles, each adjacent to exactly 1 Travel Tile: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_promises_overstretched": {
    "name": "Promises Overstretched",
    "flavorText": "Word travels faster than preparation. The settlement’s welcome is now spoken of beyond the hills, but open doors require more than roofs and food. Every promise made must still be carried.",
    "effects": {
      "season1": "Choose 1 active Arrival, if any: pay 1 Goods or remove 1 timer. If none, no effect.",
      "season2": "Choose up to 2 active Arrivals; each: pay 1 Goods or remove 1 timer. If none, no effect.",
      "season3": "Up to 3 active Arrivals; each: pay 1 Goods or remove 1 timer. If none, 2 Tiles: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_return_to_the_trenches": {
    "name": "Old Trenches Return",
    "flavorText": "No one ordered the ditches dug that way, yet the old shapes returned to the earth. Roads meant to connect us began tracing defensive lines, and the settlement remembered tactics we had tried to bury.",
    "effects": {
      "season1": "Choose 1 Travel Tile adjacent to Resource: +1 Strain.",
      "season2": "Choose 2 Travel Tiles adjacent to Resource: +1 Strain each.",
      "season3": "Choose 3 Travel Tiles adjacent to Resource: +1 Strain each. If none, 1 Resource Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Metal, discard.",
      "season2": "Spend 1 Action, pay 4 Metal, discard.",
      "season3": "Spend 1 Action, pay 6 Metal, discard."
    }
  },
  "burden_roads_carry_needs": {
    "name": "Roads Carry Needs",
    "flavorText": "The busiest paths became the hungriest ones, worn down by every errand, repair, and request. A road can serve everyone and still be neglected by all.",
    "effects": {
      "season1": "Choose 1 Travel Tile adjacent to 2+ Tiles: +1 Strain.",
      "season2": "Choose 1 Travel Tile adjacent to 3+ Tiles: +2 Strain.",
      "season3": "Choose 2 Travel Tiles, each adjacent to 3+ Tiles: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_roads_too_far_from_home": {
    "name": "Roads Too Far",
    "flavorText": "We laid roads farther than our hands could maintain. Mud fills the ruts, lanterns go unlit, and travellers reach the Vale already wondering whether the journey was worth it.",
    "effects": {
      "season1": "Choose 1 Travel Tile not adjacent to Housing: +1 Strain.",
      "season2": "Choose 2 Travel Tiles not adjacent to Housing: +1 Strain each.",
      "season3": "Choose 3 Travel Tiles not adjacent to Housing: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Wood, discard.",
      "season2": "Spend 1 Action, pay 4 Wood, discard.",
      "season3": "Spend 1 Action, pay 6 Wood, discard."
    }
  },
  "burden_smoke_over_hearths": {
    "name": "Smoke over Hearths",
    "flavorText": "The workshops burned day and night, filling nearby homes with sound and smoke. Children coughed behind shuttered windows while neighbours tried to keep out the very labour meant to sustain them.",
    "effects": {
      "season1": "Choose 1 Housing Tile adjacent to Crafting: +1 Strain.",
      "season2": "Choose 2 Housing Tiles adjacent to Crafting: +1 Strain each.",
      "season3": "Choose 3 Housing Tiles adjacent to Crafting: +1 Strain each. If none, 1 Crafting Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_stampede": {
    "name": "Stampede",
    "flavorText": "When armies retreated, they left beasts too frightened to command. We found fences burst and tracks deep in the mud. They may settle, but today every sound sends them running.",
    "effects": {
      "season1": "Choose 1 Gathering Tile: +1 Strain.",
      "season2": "Choose 1 Gathering Tile: +2 Strain.",
      "season3": "Choose 1 Gathering Tile: +2 Strain. Then choose 1 adjacent Housing/Travel Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Metal, discard.",
      "season2": "Spend 1 Action, pay 4 Metal, discard.",
      "season3": "Spend 1 Action, pay 6 Metal, discard."
    }
  },
  "burden_stores_run_thin": {
    "name": "Stores Run Thin",
    "flavorText": "The shelves are full in one corner and bare in another, which may be worse than general scarcity. People see waste beside want, and frustration grows in the space between them.",
    "effects": {
      "season1": "Choose a most-stocked resource; lose 2. If none is lost, choose 1 Tile: +1 Strain.",
      "season2": "Choose a most-stocked resource; lose 4. If fewer than 4 are lost, choose 2 Tiles: +1 Strain each.",
      "season3": "Choose a most-stocked resource; lose 6. If fewer than 6 are lost, choose 2 Tiles: +2 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_the_burden_of_command": {
    "name": "Burden of Command",
    "flavorText": "The settlement’s weight rests first on those who lead it. Today, every necessary choice angered someone, and none could be undone without failing someone else.",
    "effects": {
      "season1": "Choose up to 2 Steward-occupied Tiles: +1 Strain each.",
      "season2": "Choose up to 2 Steward-occupied Tiles: +1 Strain each. Then 1 adjacent Tile, if any: +1 Strain.",
      "season3": "Choose up to 3 Steward-occupied Tiles: +1 Strain each. Then up to 2 adjacent Tiles: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_the_long_cough": {
    "name": "The Long Cough",
    "flavorText": "The halls are still crowded, though laughter now breaks beneath a spreading cough. Warmth draws people together, and the sickness follows wherever they gather.",
    "effects": {
      "season1": "Choose 1 Social/Wellbeing Tile: +1 Strain.",
      "season2": "Choose 1 Social and 1 Wellbeing Tile, if possible: +1 Strain each.",
      "season3": "Choose up to 3 Social/Wellbeing Tiles: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Herbs, discard.",
      "season2": "Spend 1 Action, pay 4 Herbs, discard.",
      "season3": "Spend 1 Action, pay 6 Herbs, discard."
    }
  },
  "burden_the_quiet_fractures": {
    "name": "The Quiet Fractures",
    "flavorText": "The Vale rarely announces that it is breaking. It shows itself in the missed greeting, the empty market, the kindness withheld. Small fractures need tending before they learn to widen.",
    "effects": {
      "season1": "Choose 1 Tile with 1–2 Strain: +1 Strain.",
      "season2": "Choose 1 Tile with 1–2 Strain: +1 Strain. Then 1 adjacent Tile with 0 Strain: +1 Strain.",
      "season3": "Choose 1 Overstrained Tile; 2 adjacent Tiles with 0 Strain: +1 Strain each. If none, use Season II."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_the_rot_within_the_vault": {
    "name": "Rot in the Vault",
    "flavorText": "The vault opened cleanly, but damp had worked there for centuries. Pages clung together like old wounds, and ink bled where hope had been stored. Care may save some of it; haste will ruin the rest.",
    "effects": {
      "season1": "Choose 1 Salvage Tile: +1 Strain.",
      "season2": "Choose 1 Salvage Tile: +2 Strain.",
      "season3": "Choose 1 Salvage Tile: +2 Strain. Then choose 1 adjacent Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Herbs, discard.",
      "season2": "Spend 1 Action, pay 4 Herbs, discard.",
      "season3": "Spend 1 Action, pay 6 Herbs, discard."
    }
  },
  "burden_the_storehouses_disagree": {
    "name": "Storehouses Disagree",
    "flavorText": "Ledgers that once seemed clear no longer agree. Barrels are marked twice, crates move without notation, and every keeper swears their count is true. Numbers can quarrel like neighbours.",
    "effects": {
      "season1": "Choose Wood, Stone or Food. If 2+ stored, lose 2; otherwise, 1 Resource Tile: +1 Strain.",
      "season2": "Choose a non-Goods resource. If 3+ stored, lose 3; otherwise, 1 Resource Tile: +2 Strain.",
      "season3": "Choose a non-Goods resource. If 5+ stored, lose 5; otherwise, 2 Resource Tiles: +2 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Goods, discard."
    }
  },
  "burden_welcome_wears_thin": {
    "name": "Welcome Wears Thin",
    "flavorText": "Kind words fade when action can no longer follow. Provisions are scarce, and hands now pause at once-welcoming doors. Shame gathers on both sides of the threshold.",
    "effects": {
      "season1": "Choose 1 active Arrival, if any: pay 1 Herbs or remove 1 timer. If none, no effect.",
      "season2": "Choose up to 2 active Arrivals; each: pay 1 Herbs or remove 1 timer. If none, no effect.",
      "season3": "Up to 3 active Arrivals; each: pay 1 Herbs or remove 1 timer. If none, 2 Tiles: +1 Strain each."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Herbs, discard.",
      "season2": "Spend 1 Action, pay 4 Herbs, discard.",
      "season3": "Spend 1 Action, pay 6 Herbs, discard."
    }
  },
  "burden_too_many_houses_too_little_homes": {
    "name": "Houses, Not Homes",
    "flavorText": "New houses rise quickly, but walls alone are not enough. I counted roofs fit for shelter, yet too few warm meals, blankets, and outstretched hands to make those roofs feel like home.",
    "effects": {
      "season1": "Choose 1 Housing Tile: pay 1 Food or 1 Goods, or +1 Strain.",
      "season2": "Choose 2 Housing Tiles; each: pay 1 Food or 1 Goods, or +1 Strain.",
      "season3": "Choose 3 Housing Tiles; each: pay 1 Food or 1 Goods, or +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Food/Goods, discard.",
      "season2": "Spend 1 Action, pay 4 Food/Goods, discard.",
      "season3": "Spend 1 Action, pay 6 Food/Goods, discard."
    }
  },
  "burden_tools_left_to_rust": {
    "name": "Tools Left to Rust",
    "flavorText": "A tool unused becomes another thing to mend. Good blades dull orange, handles split, and hinges stiffen with neglect. Waste is quieter than theft, but it robs the settlement all the same.",
    "effects": {
      "season1": "Choose 1 Crafting/Merchant Tile: +1 Strain.",
      "season2": "Choose 1 Crafting/Merchant Tile: +1 Strain. Then lose 1 Metal if able.",
      "season3": "Choose 2 Crafting/Merchant Tiles: +1 Strain each. Then lose 2 Metal if able."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Metal, discard.",
      "season2": "Spend 1 Action, pay 4 Metal, discard.",
      "season3": "Spend 1 Action, pay 6 Metal, discard."
    }
  },
  "burden_wares_of_war": {
    "name": "Wares of War",
    "flavorText": "Merchants still trade from the old war stores: dented shields, boiled leather, hole-ridden breastplates, and blades worn too thin by use. After each bargain, silence lingers over the table.",
    "effects": {
      "season1": "Choose 1 Housing Tile adjacent to Merchant: +1 Strain.",
      "season2": "Choose 2 Housing Tiles adjacent to Merchant: +1 Strain each.",
      "season3": "Choose 3 Housing Tiles adjacent to Merchant: +1 Strain each. If none, 1 Merchant Tile: +1 Strain."
    },
    "resolutions": {
      "season1": "Spend 1 Action, pay 2 Metal, discard.",
      "season2": "Spend 1 Action, pay 4 Metal, discard.",
      "season3": "Spend 1 Action, pay 6 Metal, discard."
    }
  }
};

export const canonicalArrivalText: Record<string, CanonicalArrivalText> = {
  "arrival_acorns_and_oak_trees": {
    "name": "Acorns & Oak Trees",
    "flavorText": "The smallest hands brought acorns; the oldest brought names of groves burned before those children were born. I wrote them together in the ledger. Renewal begins when memory is entrusted to those who will outlive us.",
    "requirementText": "Pay 2 Herbs, 2 Stone, and 2 Goods.",
    "rewardText": "Unlock Shrine of Renewal."
  },
  "arrival_blessed_harvest": {
    "name": "Blessed Harvest",
    "flavorText": "The caretakers buried offerings beneath the first seeds and left a share of every harvest for wandering spirits and hungry birds. Whether by blessing, patience, or simply better care, their fields rarely failed.",
    "requirementText": "Pay 2 Food and 4 Stone.",
    "rewardText": "Unlock Shrine of Bounty."
  },
  "arrival_from_battle_to_cattle": {
    "name": "Battle to Cattle",
    "flavorText": "The beast-handler had once kept war mounts and worse. Now his evenings are spent tending lame oxen and brushing ageing draft horses. As I recorded the need for more feed, pasture, and fences, I felt the Vale changing for the better.",
    "requirementText": "Pay 2 Wood, 2 Metal, and 2 Food.",
    "rewardText": "Unlock The Tamers’ Respite."
  },
  "arrival_from_blade_swingers_to_herb_stringers": {
    "name": "Blade to Herb",
    "flavorText": "They asked for herb beds, drying racks, clean water, and clear instruction. Whether preparing tinctures or trimming roots, their discipline was unmistakable. Peace had not softened their hands; it had given them gentler work.",
    "requirementText": "Pay 2 Wood, 2 Metal, and 2 Food.",
    "rewardText": "Unlock The Root Weavers Respite."
  },
  "arrival_from_dark_decay_to_light_display": {
    "name": "Dark Decay to Light",
    "flavorText": "The lorekeepers carried rescued pages in oilcloth, each bundle treated like a patient not yet safe. They asked for shelves, glass lamps, and dryness above all. Their urgency proved well founded.",
    "requirementText": "Pay 2 Wood, 2 Stone, and 2 Food.",
    "rewardText": "Unlock The Lorekeepers’ Respite."
  },
  "arrival_from_plunderer_to_lumber": {
    "name": "Plunderer to Lumber",
    "flavorText": "They laid their axes on the table before speaking, sharp edges wrapped in cloth. Once, such tools broke doors and threatened homes. Now their owners asked where beams were needed. The first useful swing sounded different.",
    "requirementText": "Pay 2 Wood, 2 Metal, and 2 Food.",
    "rewardText": "Unlock The Reavers’ Respite."
  },
  "arrival_from_songs_of_war_to_the_search_for_ore": {
    "name": "Songs of War to Ore",
    "flavorText": "Their marching songs reached us before they did, though the words had changed. Underground, they said, a steady voice can soothe the mountain and steady the hand. I recorded the saying, then heard the tunnels answer.",
    "requirementText": "Pay 2 Wood, 2 Metal, and 2 Food.",
    "rewardText": "Unlock The Iron Roots Respite."
  },
  "arrival_hands_for_heavy_work": {
    "name": "Hands for Heavy Work",
    "flavorText": "They arrived in a crowded wagon: strong backs, calloused hands, and a need to be useful. They asked for modest meals, safe shelter, and work that builds rather than breaks. By dusk, walls were rising twice as fast.",
    "requirementText": "Pay 2 Food, 2 Stone, and 2 Goods.",
    "rewardText": "Unlock Labourers’ Yard."
  },
  "arrival_lanterns_for_the_long_roads": {
    "name": "Lanterns for Roads",
    "flavorText": "They came at dusk with oil, mirrors, hooks, and a stubborn belief that roads should not surrender after sunset. I saw the first lamp lit beyond the nearest homes, then the second, then the third fading into distance.",
    "requirementText": "Pay 2 Wood, 2 Metal, and 2 Goods.",
    "rewardText": "Unlock Lantern Roadhouse."
  },
  "arrival_lay_down_the_tools_of_destruction": {
    "name": "Repurpose Tools",
    "flavorText": "Old armour was surrendered piece by piece: helms for lantern casings, blades for ploughshares, buckles for harness. The veterans overseeing the work said little. The damage on the metal had already spoken enough.",
    "requirementText": "Pay 4 Metal and 2 Goods.",
    "rewardText": "Unlock Reliquary."
  },
  "arrival_lest_we_forget": {
    "name": "Lest We Forget",
    "flavorText": "They arrived in painted wagons, asking for a place where old names could be spoken without glorifying the wars that took them. By dusk, wood, ribbons, and young hands had gathered. Remembrance began before anyone dared call it theatre.",
    "requirementText": "Pay 4 Wood and 4 Metal.",
    "rewardText": "Unlock Theatre."
  },
  "arrival_moving_mountains": {
    "name": "Moving Mountains",
    "flavorText": "The miners arrived with faces marked by dust, sweat, and the scrape of stone. They spoke of the deep earth with reverence rather than greed. Their advice was simple: disasters begin when folk stop listening to the mountain.",
    "requirementText": "Pay 2 Food, 2 Stone, and 2 Goods.",
    "rewardText": "Unlock Shrine of Depths."
  },
  "arrival_news_travels_faster_than_goods": {
    "name": "News Travels Faster",
    "flavorText": "The messenger arrived ahead of the wagons, carrying names, rumours, warnings, and hope in equal measure. They believed knowledge might be the first true bridge rebuilt. I copied the news they brought with particular care.",
    "requirementText": "Pay 2 Food and 4 Goods.",
    "rewardText": "Unlock The Waystation."
  },
  "arrival_no_soul_shall_go_without": {
    "name": "No Soul Goes Unserved",
    "flavorText": "By nightfall, canvas and wagons had become a shelter with a working kitchen. Its keepers welcomed every orphan, labourer, refugee, and wanderer who came to the door.",
    "requirementText": "Pay 2 Goods and 2 Herbs.",
    "rewardText": "Unlock Alms House."
  },
  "arrival_reablement_for_the_realm": {
    "name": "Reablement for the Vale",
    "flavorText": "Battlefield surgeons and armourers arrived with wooden prosthetics hinged in brass. Their craft carried a simple lesson. The Vale must be built for every body that comes to it.",
    "requirementText": "Pay 4 Wood and 4 Metal.",
    "rewardText": "Unlock Atelier Workshop."
  },
  "arrival_remnants_of_the_cavalry": {
    "name": "Remnants of the Cavalry",
    "flavorText": "They rode in slowly, cloaks heavy with rain and years alike. Their horses were older, but immaculately kept. I marked their arrival with a note: find pasture, fresh water, and a reason for these riders to stay.",
    "requirementText": "Pay 2 Wood, 4 Herbs, and 2 Goods.",
    "rewardText": "Unlock 2 Stables."
  },
  "arrival_remnants_of_the_fleet": {
    "name": "Remnants of the Fleet",
    "flavorText": "The vessel bore timber from forgotten ports and ruined warships. Ashore, its crew studied the riverbanks and spoke not of raids, but of trade, crossings, and safer journeys.",
    "requirementText": "Pay 2 Wood, 4 Herbs, and 2 Goods.",
    "rewardText": "Unlock Docks."
  },
  "arrival_spirit_lifting_spirit": {
    "name": "Spirit-Lifting",
    "flavorText": "A settlement without laughter ferments only bitterness, the brewer said. Before I could object, the yard erupted in song. By nightfall, even our most reserved settlers had joined the second verse.",
    "requirementText": "Pay 2 Wood, 2 Metal, and 2 Goods.",
    "rewardText": "Unlock Brewery of Legends."
  },
  "arrival_strong_foundations": {
    "name": "Strong Foundations",
    "flavorText": "The teachers brought slates, timber rules, worn books, and minds sharper than any blade. I marked their arrival as the day careful learning became available to all who now call the Quiet Vale home.",
    "requirementText": "Pay 2 Goods and 2 Herbs.",
    "rewardText": "Unlock House of Learning."
  },
  "arrival_the_burden_bearers": {
    "name": "Burden-Bearers",
    "flavorText": "The burden-bearers of the last years asked for a space where grief and exhaustion could be set down. I recorded the request exactly. Even the naming of it seemed to steady the room.",
    "requirementText": "Have a Housing Tile; pay 2 Herbs, 2 Stone and 2 Metal.",
    "rewardText": "Unlock The Resting Hall."
  },
  "arrival_the_dryads": {
    "name": "The Dryads",
    "flavorText": "They came with seeds wrapped in green thread and bark carvings reminiscent of relics. Their soft words seemed to sink into roots older than any kingdom. Where they walked, the wildlands grew calmer.",
    "requirementText": "Pay 2 Herbs, 2 Stone, and 2 Goods.",
    "rewardText": "Unlock Shrine of Ancients."
  },
  "arrival_the_hearthbound_circle": {
    "name": "Hearthbound Circle",
    "flavorText": "They arrived carrying seeds, recipes, and iron cooking pots blackened by years of use. They promised no miracles, only that hardship need not be faced alone. Community makes strong roots; strong roots make resilience.",
    "requirementText": "Pay 4 Herbs and 4 Food.",
    "rewardText": "Unlock Hearth Garden."
  },
  "arrival_the_quiet_quest": {
    "name": "Quiet Quest",
    "flavorText": "The adventurers were nothing like tavern stories. Their armour was mismatched, functional, and often repaired. Their first question was which roads ended in unanswered questions. I recorded them as a small company of useful trouble.",
    "requirementText": "Pay 4 Goods and 2 Herbs.",
    "rewardText": "Unlock Adventurers’ Guild."
  },
  "arrival_the_transmutation_traveler": {
    "name": "Transmutation Traveller",
    "flavorText": "Glass vessels bubbled across the traveller’s broad workbench. They promised unlikely transformations. I remained cautious, though the results were hard to deny.",
    "requirementText": "Pay 2 Herbs and 2 Goods.",
    "rewardText": "Unlock Alchemist’s Workshop."
  },
  "arrival_what_came_before_the_last_age": {
    "name": "Before the Last Age",
    "flavorText": "Beneath the broken stones, the old world still sleeps. Its intricate tools remember hands that once cultivated knowledge with great care. Not all that came before us was lost; some of it was waiting to be found.",
    "requirementText": "Pay 2 Stone, 2 Metal, and 2 Goods.",
    "rewardText": "Unlock Shrine of Ancestors."
  }
};

export const canonicalGoldenBoonText: Record<string, CanonicalGoldenBoonText> = {
  "golden_boon_the_golden_bell": {
    "name": "The Golden Bell",
    "flavorText": "We found the bell beneath root and rubble, warm beneath the hand despite its long burial. When it rang across the Vale, even abandoned roads seemed to listen. Days later, strangers arrived by ways we thought forgotten.",
    "effectText": "When revealed, choose 3 unused Arrival Cards from the box. Shuffle and reveal 1; place it on the Stewards Board as an active Arrival with 3 timer tokens. Return the other 2 to the box.",
    "lifecycle": "Resolve, then discard."
  },
  "golden_boon_the_golden_scroll": {
    "name": "The Golden Scroll",
    "flavorText": "The scroll arrived sealed in gold thread. Its ink shifted between readings: maps into letters, warnings into opportunities, forgotten names into doors. I recorded it as possibility, not prophecy.",
    "effectText": "When revealed, each player may discard any standard Encounter Cards from their hand, then draw the same number at random from the box. Golden Boons cannot be drawn. If the box runs short, draw as many as possible.",
    "lifecycle": "Resolve, then discard."
  },
  "golden_boon_the_golden_vial": {
    "name": "The Golden Vial",
    "flavorText": "The vial lay sealed in golden wax within the hollow roots of a dead pale tree. Its liquid caught the light like dawn held still. Those who carried it found storms softening, paths opening, and distance less certain of itself.",
    "effectText": "Once per round for the rest of the game, you may place 1 Travel Tile for 0 Actions.",
    "lifecycle": "Keep for the rest of the game."
  },
  "golden_boon_the_golden_eyed_traveler": {
    "name": "The Golden-Eyed Traveller",
    "flavorText": "The traveller appeared after dusk, dry-cloaked despite the rain, and asked only for a place by the fire. Through the night, a melody moved through the sleeping settlement. By morning, the season’s weariness had loosened its grip.",
    "effectText": "After the normal Player Turns this round, resolve 1 additional Player Turns phase. Do not seed, reveal Encounters, remove Arrival timers, resolve end-of-round effects or advance the Round Timer. Each player takes 1 normal turn.",
    "lifecycle": "Resolve, then discard."
  },
  "golden_boon_the_golden_signet_ring": {
    "name": "The Golden Signet Ring",
    "flavorText": "The ring came from a collapsed cairn beneath the mines, its gold untouched by age. When raised, it seemed to remind roads, walls, and foundations of older orders. For a moment, the settlement obeyed memory.",
    "effectText": "Choose up to 5 placed Tiles. Move each to any legal empty map space, including one vacated by another chosen Tile. Ignore adjacency and reachability, but obey terrain and multi-hex placement rules. Chosen Tiles keep Strain, Supported, upgrade state and tokens. Recalculate connectivity and Overstrained effects.",
    "lifecycle": "Resolve, then discard."
  }
};

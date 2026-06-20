import type { StewardData } from "../engine/types";

export const stewards: StewardData[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    startingTerrains: ["woodland"],
    startingBenefit:
      "First Travel Tile or Resource Tile placement costs 1 fewer resource.",
    power:
      "Once per Season, reduce a Travel or Resource placement cost by 2 resources. All normal placement requirements still apply.",
    objective:
      "+15 Renown if the settlement has non-Overstrained tiles on both sides of the river connected by a Bridge.",
    objectiveRenown: 15
  },
  {
    id: "knight",
    name: "Knight",
    startingTerrains: ["arable"],
    startingBenefit: "First Housing placement costs 1 fewer resource.",
    power:
      "Once per Season, place a Housing Tile for 0 Actions. Pay costs and follow normal placement rules.",
    objective:
      "+15 Renown if the settlement contains a Housing cluster of 4+ non-Overstrained Housing Tiles.",
    objectiveRenown: 15
  },
  {
    id: "sentinel",
    name: "Sentinel",
    startingTerrains: ["mountains"],
    startingBenefit: "First upgrade costs 1 fewer resource.",
    power:
      "Once per Season, upgrade a reachable Core Tile for 0 Actions. Pay costs and follow normal upgrade rules.",
    objective:
      "+15 Renown if the settlement contains 5+ upgraded non-Overstrained Core Tiles.",
    objectiveRenown: 15
  },
  {
    id: "ranger",
    name: "Ranger",
    startingTerrains: ["heaths"],
    startingBenefit:
      "In Season I, Ranger may use their movement/reachability power one extra time.",
    power:
      "Once per Season, move/reach one placed non-Overstrained tile for the next map action at 0 Actions. Season I has 2 uses.",
    objective:
      "+15 Renown if the settlement has tiles on 3+ non-Grasslands terrain types.",
    objectiveRenown: 15
  },
  {
    id: "warden",
    name: "Warden",
    startingTerrains: ["ruins"],
    startingBenefit: "After the first tile is placed, it gains Supported.",
    power: "Once per Season, ignore one Burden this round.",
    objective:
      "+15 Renown if active Burdens are fewer than the player count.",
    objectiveRenown: 15
  },
  {
    id: "quartermaster",
    name: "Quartermaster",
    startingTerrains: ["woodland", "mountains", "heaths", "arable", "ruins"],
    startingBenefit:
      "Once during Season I, exchange up to 2 Warehouse resources for resources of any type.",
    power:
      "Once per Season, substitute/exchange up to 3 resources in a cost.",
    objective:
      "+15 Renown if the Warehouse has 5+ resources in at least 4 resource types.",
    objectiveRenown: 15
  }
];

export const stewardById = Object.fromEntries(
  stewards.map((steward) => [steward.id, steward])
) as Record<string, StewardData>;


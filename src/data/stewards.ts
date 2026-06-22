import type { StewardData } from "../engine/types";

export const stewards: StewardData[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    startingTerrains: ["woodland"],
    powerText:
      "Once per Season, when you place a Travel Tile, you may place it without spending an Action. Pay its cost and follow all placement rules. If it is placed adjacent to another Travel Tile or placed on a River/Water hex, it gains Supported.",
    objectiveText:
      "At final scoring, gain +15 Renown if the settlement has non-Overstrained placed tiles on both sides of the river connected by a Bridge.",
    objectiveRenown: 15
  },
  {
    id: "knight",
    name: "Knight",
    startingTerrains: ["arable"],
    powerText:
      "Once per Season, when you place a Housing Tile, you may place it without spending an Action. Pay its cost and follow all placement rules. If it is placed adjacent to another Housing Tile, it gains Supported.",
    objectiveText:
      "At final scoring, gain +15 Renown if the settlement contains a Housing cluster of 3 or more non-Overstrained Housing Tiles.",
    objectiveRenown: 15
  },
  {
    id: "sentinel",
    name: "Sentinel",
    startingTerrains: ["mountains"],
    powerText:
      "Once per Season, when you upgrade a Core Tile, you may upgrade it without spending an Action. Pay its cost and follow all upgrade rules. If it is adjacent to another upgraded Core Tile after upgrading, it gains Supported.",
    objectiveText:
      "At final scoring, gain +15 Renown if the settlement contains 5 or more upgraded non-Overstrained Core Tiles.",
    objectiveRenown: 15
  },
  {
    id: "ranger",
    name: "Ranger",
    startingTerrains: ["heaths"],
    powerText:
      "Once per Season, choose any legal empty hex or any placed non-Overstrained tile, connected or disconnected. Until the end of your turn, you may treat that hex or tile as reachable for your tile actions. If you place a tile there, pay its cost and follow all terrain, River/Water, and printed placement requirements.",
    objectiveText:
      "At final scoring, gain +15 Renown if the settlement contains non-Overstrained placed tiles on at least 3 terrain types other than Grasslands and River/Water.",
    objectiveRenown: 15
  },
  {
    id: "warden",
    name: "Warden",
    startingTerrains: ["ruins"],
    powerText:
      "Once per Season, when a Burden is revealed, you may prevent that Burden's revealed effect from triggering. The Burden still becomes active. Then either remove 1 Strain from any tile or place Supported on one tile.",
    objectiveText:
      "At final scoring, gain +15 Renown if there are no active Burdens.",
    objectiveRenown: 15
  },
  {
    id: "quartermaster",
    name: "Quartermaster",
    startingTerrains: ["woodland", "mountains", "heaths", "arable", "ruins"],
    powerText:
      "Once per Season, exchange up to 5 resources in the Warehouse for the same number of resources of any type. Then add 1 timer token to an active Arrival with fewer than 3 timer tokens on it.",
    objectiveText:
      "At final scoring, gain +15 Renown if the Warehouse contains 5 or more resources in at least 3 different resource types.",
    objectiveRenown: 15
  }
];

export const stewardById = Object.fromEntries(
  stewards.map((steward) => [steward.id, steward])
) as Record<string, StewardData>;

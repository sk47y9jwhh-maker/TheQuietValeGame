export const ledgerChronicles = [
  "Settlement Records",
  "Shape of the Settlement",
  "River and Bridge",
  "Arrivals Remembered",
  "Strain and Burdens",
  "Work and Stores",
  "Vows",
  "Steward Record"
] as const;

export type LedgerChronicle = (typeof ledgerChronicles)[number];

export interface LedgerEntry {
  id: string;
  name: string;
  chronicle: LedgerChronicle;
  entryType: string;
  scope: string;
  pacingBand: string;
  countsTowardUnlock: boolean;
  playerCountPrestige: boolean;
  unlockAt: number;
  declaredVow: boolean;
  requiredSteward: string | null;
  thresholdsByPlayerCount: Record<string, number> | null;
  cumulativeCounter: string | null;
  requirement: string;
}

export interface LedgerMilestone {
  threshold: number;
  goldenTileId: string;
  goldenTile: string;
  goldenTileTheme: string;
  goldenBoonId: string;
  goldenBoon: string;
  goldenBoonTheme: string;
}

// Eligibility gates and entry definitions are generated from the v4.6 final-balance workbook.
export const ledgerUnlockGates: Record<string, number> = {
  "LE-001": 6,
  "LE-002": 7,
  "LE-003": 8,
  "LE-004": 22,
  "LE-005": 0,
  "LE-006": 10,
  "LE-007": 0,
  "LE-008": 16,
  "LE-009": 5,
  "LE-010": 9,
  "LE-011": 0,
  "LE-012": 2,
  "LE-013": 5,
  "LE-014": 16,
  "LE-015": 0,
  "LE-016": 5,
  "LE-017": 8,
  "LE-018": 12,
  "LE-019": 0,
  "LE-020": 2,
  "LE-021": 8,
  "LE-022": 5,
  "LE-023": 10,
  "LE-024": 0,
  "LE-025": 2,
  "LE-026": 5,
  "LE-027": 18,
  "LE-028": 5,
  "LE-029": 12,
  "LE-030": 10,
  "LE-031": 8,
  "LE-032": 10,
  "LE-033": 9,
  "LE-034": 2,
  "LE-035": 2,
  "LE-036": 20,
  "LE-037": 25,
  "LE-038": 25,
  "LE-039": 20,
  "LE-040": 9,
  "LE-041": 25,
  "LE-042": 28,
  "LE-043": 34,
  "LE-044": 9,
  "LE-045": 10,
  "LE-046": 12,
  "LE-047": 15,
  "LE-048": 3,
  "LE-049": 16,
  "LE-050": 25
};

export const ledgerMilestones: LedgerMilestone[] = [
  { threshold: 5, goldenTileId: "golden_tile_the_golden_charter", goldenTile: "The Golden Charter", goldenTileTheme: "Mixed civic district", goldenBoonId: "golden_boon_the_golden_bell", goldenBoon: "The Golden Bell", goldenBoonTheme: "Immediate Arrival completion" },
  { threshold: 12, goldenTileId: "golden_tile_the_golden_hearth", goldenTile: "The Golden Hearth", goldenTileTheme: "Settlement core and Supported Housing", goldenBoonId: "golden_boon_the_golden_scroll", goldenBoon: "The Golden Scroll", goldenBoonTheme: "Replace a hand card with a random Boon" },
  { threshold: 18, goldenTileId: "golden_tile_the_golden_river_gate", goldenTile: "The Golden River Gate", goldenTileTheme: "Riverbank settlement and bridge incentive", goldenBoonId: "golden_boon_the_golden_vial", goldenBoon: "The Golden Vial", goldenBoonTheme: "Ongoing Path placement" },
  { threshold: 25, goldenTileId: "golden_tile_the_golden_cairn", goldenTile: "The Golden Cairn", goldenTileTheme: "Terrain spread and remote expansion", goldenBoonId: "golden_boon_the_golden_eyed_traveler", goldenBoon: "The Golden-Eyed Traveller", goldenBoonTheme: "Bonus player turns" },
  { threshold: 32, goldenTileId: "golden_tile_the_golden_garden", goldenTile: "The Golden Garden", goldenTileTheme: "Resilience and recovery district", goldenBoonId: "golden_boon_the_golden_signet_ring", goldenBoon: "The Golden Signet Ring", goldenBoonTheme: "Tile repositioning" }
];

const ledgerEntryDefinitions: LedgerEntry[] = [
  {"id":"LE-001","name":"The Vale Endures","chronicle":"Settlement Records","entryType":"Record","scope":"By player count","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":6,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":140,"2":200,"3":320,"4":320},"cumulativeCounter":null,"requirement":"Record a final score at or above the threshold for that player count. Available after 6 named Ledger Entries have been completed."},
  {"id":"LE-002","name":"Hearths Drawn Together","chronicle":"Settlement Records","entryType":"Record","scope":"By player count","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":7,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":90,"2":115,"3":160,"4":150},"cumulativeCounter":null,"requirement":"Record final Population at or above the threshold for that player count. Available after 7 named Ledger Entries have been completed."},
  {"id":"LE-003","name":"Remembered Across the Vale","chronicle":"Settlement Records","entryType":"Record","scope":"By player count","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":8,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":25,"2":40,"3":60,"4":90},"cumulativeCounter":null,"requirement":"Record final Renown at or above the threshold for that player count. Available after 8 named Ledger Entries have been completed."},
  {"id":"LE-004","name":"No Ash in the Record","chronicle":"Settlement Records","entryType":"Resilience","scope":"By player count","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":22,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":2,"2":6,"3":10,"4":14},"cumulativeCounter":null,"requirement":"End with 0 active Burdens, 0 Overstrained tiles, and no more than 2 / 6 / 10 / 14 Strain in 1p / 2p / 3p / 4p. Available after 22 named Ledger Entries have been completed."},
  {"id":"LE-005","name":"Three Corners of the Vale","chronicle":"Shape of the Settlement","entryType":"Map Edge","scope":"Once","pacingBand":"Foundation","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":0,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with non-Overstrained placed tiles covering at least three of the four corner hexes: A1, A9, N1, and N9."},
  {"id":"LE-006","name":"Lanterns on the Boundary","chronicle":"Shape of the Settlement","entryType":"Map Edge","scope":"By player count","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":10,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":8,"2":14,"3":20,"4":26},"cumulativeCounter":null,"requirement":"End with at least 8 / 14 / 20 / 26 non-River/Water edge hexes covered by non-Overstrained placed tiles in 1p / 2p / 3p / 4p. Available after 10 named Ledger Entries have been completed."},
  {"id":"LE-007","name":"Six Lands Remembered","chronicle":"Shape of the Settlement","entryType":"Terrain","scope":"Once","pacingBand":"Foundation","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":0,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with at least one non-Overstrained placed tile on each non-Water terrain type: Grasslands, Woodland, Mountains, Heaths, Arable Land, and Ruins."},
  {"id":"LE-008","name":"Garden Community","chronicle":"Shape of the Settlement","entryType":"Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":16,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with Common Land or The Pleasance non-Overstrained and adjacent to six non-Overstrained Housing Tiles. The six Housing Tiles must occupy six distinct neighbouring hexes around that tile. Available after 16 named Ledger Entries have been completed."},
  {"id":"LE-009","name":"Shelter and Song","chronicle":"Shape of the Settlement","entryType":"Layout","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":5,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with a connected Housing cluster of at least four non-Overstrained Housing Tiles adjacent to both a Social Tile and a Wellbeing Tile. Available after 5 named Ledger Entries have been completed."},
  {"id":"LE-010","name":"The Care Ring","chronicle":"Shape of the Settlement","entryType":"Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":9,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with a non-Overstrained Wellbeing Tile surrounded by six non-Overstrained placed tiles, at least four of which are Housing, Social, or Wellbeing Tiles. Available after 9 named Ledger Entries have been completed."},
  {"id":"LE-011","name":"No Hearth Stands Alone","chronicle":"Shape of the Settlement","entryType":"Layout","scope":"By player count","pacingBand":"Foundation","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":0,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":4,"2":5,"3":7,"4":8},"cumulativeCounter":null,"requirement":"End with at least 4 / 5 / 7 / 8 non-Overstrained Housing Tiles in 1p / 2p / 3p / 4p. Each non-Overstrained Housing Tile must be adjacent to at least one other Housing Tile."},
  {"id":"LE-012","name":"A Settlement of Many Hands","chronicle":"Shape of the Settlement","entryType":"Variety","scope":"By player count","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":2,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":6,"2":6,"3":7,"4":7},"cumulativeCounter":null,"requirement":"End with non-Overstrained placed tiles in at least 6 / 6 / 7 / 7 different tile categories in 1p / 2p / 3p / 4p. Available after 2 named Ledger Entries have been completed."},
  {"id":"LE-013","name":"The Fair Day","chronicle":"Shape of the Settlement","entryType":"Layout","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":5,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with one non-Overstrained Merchant Tile adjacent to at least one Housing Tile, one Social Tile, and one Travel Tile. Available after 5 named Ledger Entries have been completed."},
  {"id":"LE-014","name":"The Quiet Courtyard","chronicle":"Shape of the Settlement","entryType":"Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":16,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with a complete six-tile ring around one empty central hex. The ring must include at least four different tile categories and all six ring tiles must be non-Overstrained. Available after 16 named Ledger Entries have been completed."},
  {"id":"LE-015","name":"The First Crossing Held","chronicle":"River and Bridge","entryType":"River","scope":"Once","pacingBand":"Foundation","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":0,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with non-Overstrained placed tiles on both sides of the river connected by a Bridge or Stone Bridge."},
  {"id":"LE-016","name":"Riverbank Lanterns","chronicle":"River and Bridge","entryType":"River","scope":"By player count","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":5,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":8,"2":12,"3":16,"4":20},"cumulativeCounter":null,"requirement":"End with at least 8 / 12 / 16 / 20 riverbank hexes covered by non-Overstrained placed tiles in 1p / 2p / 3p / 4p. A riverbank hex is a non-River/Water hex adjacent to River/Water terrain. Available after 5 named Ledger Entries have been completed."},
  {"id":"LE-017","name":"The River Is Welcomed","chronicle":"River and Bridge","entryType":"River / Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":8,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with at least one Housing Tile, one Merchant Tile, one Social Tile, and one Wellbeing Tile adjacent to River/Water terrain. Available after 8 named Ledger Entries have been completed."},
  {"id":"LE-018","name":"Stone over Running Water","chronicle":"River and Bridge","entryType":"River","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":12,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with at least two Bridge / Stone Bridge tiles placed and non-Overstrained, with at least one upgraded to Stone Bridge. Available after 12 named Ledger Entries have been completed."},
  {"id":"LE-019","name":"The Door Was Opened","chronicle":"Arrivals Remembered","entryType":"Arrival","scope":"By player count","pacingBand":"Foundation","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":0,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":3,"2":5,"3":7,"4":8},"cumulativeCounter":null,"requirement":"End with at least 3 / 5 / 7 / 8 Special Tiles placed in 1p / 2p / 3p / 4p."},
  {"id":"LE-020","name":"Seasonal Welcome","chronicle":"Arrivals Remembered","entryType":"Arrival / Timing","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":2,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"During a game, complete at least one Arrival Card in each Season. Available after 2 named Ledger Entries have been completed."},
  {"id":"LE-021","name":"The Last Lantern Stayed Lit","chronicle":"Arrivals Remembered","entryType":"Arrival / Timing","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":8,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"During a game, complete an Arrival while it has exactly 1 timer token remaining. Available after 8 named Ledger Entries have been completed."},
  {"id":"LE-022","name":"No Gift Left Waiting","chronicle":"Arrivals Remembered","entryType":"Arrival","scope":"By player count","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":5,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":2,"2":4,"3":6,"4":7},"cumulativeCounter":null,"requirement":"During a game, place at least 2 / 4 / 6 / 7 Special Tiles in 1p / 2p / 3p / 4p. Of the Special Tiles unlocked by Arrivals completed before Round 12, leave no more than 2 / 3 / 4 / 5 unplaced in 1p / 2p / 3p / 4p. Available after 5 named Ledger Entries have been completed."},
  {"id":"LE-023","name":"The Vale Made Room","chronicle":"Arrivals Remembered","entryType":"Arrival / Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":10,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":4,"2":4,"3":4,"4":4},"cumulativeCounter":null,"requirement":"End with at least 4 non-Overstrained Special Tiles. Each counted Special Tile must be adjacent to at least one Housing Tile. Available after 10 named Ledger Entries have been completed."},
  {"id":"LE-024","name":"Burdens Set Down","chronicle":"Strain and Burdens","entryType":"Burden","scope":"By player count","pacingBand":"Foundation","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":0,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":2,"2":3,"3":4,"4":5},"cumulativeCounter":null,"requirement":"During a game, resolve or remove at least 2 / 3 / 4 / 5 Burdens in 1p / 2p / 3p / 4p. End with fewer active Burdens than player count."},
  {"id":"LE-025","name":"Burdens Answered in Season","chronicle":"Strain and Burdens","entryType":"Burden / Timing","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":2,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"During each Season, reveal at least one Burden. In each Season, resolve or remove at least one Burden during the same round in which it was revealed. Available after 2 named Ledger Entries have been completed."},
  {"id":"LE-026","name":"The Quiet Holds","chronicle":"Strain and Burdens","entryType":"Resilience","scope":"By player count","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":5,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":4,"2":8,"3":12,"4":16},"cumulativeCounter":null,"requirement":"End with 0 Overstrained tiles and no more than 4 / 8 / 12 / 16 Strain tokens on the map in 1p / 2p / 3p / 4p. Available after 5 named Ledger Entries have been completed."},
  {"id":"LE-027","name":"No Strain Took Root","chronicle":"Strain and Burdens","entryType":"Resilience","scope":"By player count","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":18,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":0,"2":0,"3":0,"4":0},"cumulativeCounter":null,"requirement":"End with 0 Strain tokens on the map. Available after 18 named Ledger Entries have been completed."},
  {"id":"LE-028","name":"Sheltered District","chronicle":"Strain and Burdens","entryType":"Supported / Layout","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":5,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with at least 6 non-Overstrained tiles with Supported, spread across at least 3 different tile categories. Available after 5 named Ledger Entries have been completed."},
  {"id":"LE-029","name":"The Vale Bent, Not Broke","chronicle":"Strain and Burdens","entryType":"Recovery","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":12,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"During a game, have at least 2 Overstrained tiles on the map at the same time, then end with 0 Overstrained tiles. Available after 12 named Ledger Entries have been completed."},
  {"id":"LE-030","name":"Mended Before Nightfall","chronicle":"Strain and Burdens","entryType":"Recovery","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":10,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"During a single round, remove at least 3 Strain total from tiles across at least 2 different tile categories. Available after 10 named Ledger Entries have been completed."},
  {"id":"LE-031","name":"Good Work Made Last","chronicle":"Work and Stores","entryType":"Upgrade","scope":"By player count","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":8,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":5,"2":8,"3":10,"4":11},"cumulativeCounter":null,"requirement":"Complete at least 5 / 8 / 10 / 11 upgrades in 1p / 2p / 3p / 4p. Available after 8 named Ledger Entries have been completed."},
  {"id":"LE-032","name":"The Market Track","chronicle":"Work and Stores","entryType":"Craft / Merchant / Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":10,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with both Crafting Tiles and both Merchant Tiles placed. All four must be non-Overstrained and adjacent to the same single physical Track / Improved Track Tile, not merely the same connected Travel group. Available after 10 named Ledger Entries have been completed."},
  {"id":"LE-033","name":"Work and Rest","chronicle":"Work and Stores","entryType":"Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":9,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with a Washhouse or Sweet Flag Bathhouse non-Overstrained and adjacent to at least one Crafting Tile, one Merchant Tile, and one Social Tile. Available after 9 named Ledger Entries have been completed."},
  {"id":"LE-034","name":"Twin Farmsteads","chronicle":"Work and Stores","entryType":"Resource / Layout","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":2,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with both Farmstead / Artisan Farm tiles placed and non-Overstrained. Each must be adjacent to at least one Housing Tile. Available after 2 named Ledger Entries have been completed."},
  {"id":"LE-035","name":"Twin Shafts","chronicle":"Work and Stores","entryType":"Resource / Layout","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":2,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with both Mine Tunnel / Mine Shaft tiles placed and non-Overstrained. Each must be adjacent to at least one Travel Tile. Available after 2 named Ledger Entries have been completed."},
  {"id":"LE-036","name":"The Resource Crown","chronicle":"Work and Stores","entryType":"Resource / Upgrade","scope":"Once","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":20,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":3,"2":3,"3":3,"4":3},"cumulativeCounter":null,"requirement":"End with both copies of any three different Resource Tile lineages placed, upgraded, and non-Overstrained. Available after 20 named Ledger Entries have been completed."},
  {"id":"LE-037","name":"The Four Storehouses","chronicle":"Work and Stores","entryType":"Resource","scope":"Once","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":25,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with both copies of each main Resource Tile lineage placed and non-Overstrained: Lumber Yard / Sustainable Lumber Yard, Mine Tunnel / Mine Shaft, Gathering Outpost / Gathering Lodge, and Farmstead / Artisan Farm. Available after 25 named Ledger Entries have been completed."},
  {"id":"LE-038","name":"Stores Set Aside","chronicle":"Work and Stores","entryType":"Warehouse","scope":"By player count","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":25,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":65,"2":75,"3":75,"4":80},"cumulativeCounter":null,"requirement":"End with at least 65 / 75 / 75 / 80 total resources in the Warehouse in 1p / 2p / 3p / 4p. Available after 25 named Ledger Entries have been completed."},
  {"id":"LE-039","name":"Nothing Left to Spare","chronicle":"Work and Stores","entryType":"Warehouse","scope":"Once","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":20,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":{"1":80,"2":120,"3":170,"4":190},"cumulativeCounter":null,"requirement":"Available after 20 named Ledger Entries have been completed. End with no more than 2 total Warehouse resources and a final score of at least 80 / 120 / 170 / 190 in 1p / 2p / 3p / 4p."},
  {"id":"LE-040","name":"Bread, Stone, and Timber","chronicle":"Work and Stores","entryType":"Resource / Layout","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":9,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"End with a Lumber Yard / Sustainable Lumber Yard, a Mine Tunnel / Mine Shaft, and a Farmstead / Artisan Farm all non-Overstrained and connected through the same non-Overstrained Travel group. Available after 9 named Ledger Entries have been completed."},
  {"id":"LE-041","name":"No Roads Raised","chronicle":"Vows","entryType":"Vow","scope":"By player count","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":25,"declaredVow":true,"requiredSteward":null,"thresholdsByPlayerCount":{"1":80,"2":120,"3":170,"4":190},"cumulativeCounter":null,"requirement":"Available after 25 named Ledger Entries have been completed. Declare before setup. Place no Travel Tiles and reach a final score of at least 80 / 120 / 170 / 190 in 1p / 2p / 3p / 4p. Any Steward Power, Boon, or Golden effect that places a Travel Tile breaks this Vow. Only one Steward’s Ledger Vow may be declared per game."},
  {"id":"LE-042","name":"No Fine Work","chronicle":"Vows","entryType":"Vow","scope":"By player count","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":28,"declaredVow":true,"requiredSteward":null,"thresholdsByPlayerCount":{"1":60,"2":80,"3":110,"4":130},"cumulativeCounter":null,"requirement":"Available after 28 named Ledger Entries have been completed. Declare before setup. Upgrade no Core Tiles by any source and reach a final score of at least 60 / 80 / 110 / 130 in 1p / 2p / 3p / 4p. Any Steward Power, Boon, or Golden effect that upgrades a Core Tile breaks this Vow. Only one Steward’s Ledger Vow may be declared per game."},
  {"id":"LE-043","name":"The Small Storehouse","chronicle":"Vows","entryType":"Vow","scope":"Once","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":34,"declaredVow":true,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"Available after 34 named Ledger Entries have been completed. Declare before setup. The Warehouse may never hold more than 8 of any resource type at any time. Only one Steward’s Ledger Vow may be declared per game."},
  {"id":"LE-044","name":"The Vanguard’s Crossing","chronicle":"Steward Record","entryType":"Steward","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":9,"declaredVow":false,"requiredSteward":"vanguard","thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"With Vanguard chosen, use the Vanguard Power in each Season and end with non-Overstrained placed tiles on both sides of the river connected by a Bridge or Stone Bridge. Available after 9 named Ledger Entries have been completed."},
  {"id":"LE-045","name":"The Knight’s Hearth","chronicle":"Steward Record","entryType":"Steward","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":10,"declaredVow":false,"requiredSteward":"knight","thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"With Knight chosen, use the Knight Power in each Season and end with a connected Housing cluster of at least six non-Overstrained Housing Tiles. Available after 10 named Ledger Entries have been completed."},
  {"id":"LE-046","name":"The Sentinel’s Craft","chronicle":"Steward Record","entryType":"Steward","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":12,"declaredVow":false,"requiredSteward":"sentinel","thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"With Sentinel chosen, use the Sentinel Power in each Season and end with at least three upgraded non-Overstrained Core Tiles adjacent to another upgraded Core Tile. Available after 12 named Ledger Entries have been completed."},
  {"id":"LE-047","name":"The Ranger’s Reach","chronicle":"Steward Record","entryType":"Steward","scope":"Once","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":15,"declaredVow":false,"requiredSteward":"ranger","thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"With Ranger chosen, use the Ranger Power to place or upgrade in three different non-Grasslands, non-River/Water terrain types during the game. Available after 15 named Ledger Entries have been completed."},
  {"id":"LE-048","name":"The Warden’s Vigil","chronicle":"Steward Record","entryType":"Steward","scope":"Once","pacingBand":"Standard","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":3,"declaredVow":false,"requiredSteward":"warden","thresholdsByPlayerCount":null,"cumulativeCounter":null,"requirement":"With Warden chosen, reveal at least one Burden in each Season, use the Warden Power in each Season, and end with no Overstrained tiles and no more than one active Burden. Available after 3 named Ledger Entries have been completed."},
  {"id":"LE-049","name":"The Quartermaster’s Stores","chronicle":"Steward Record","entryType":"Steward","scope":"By player count","pacingBand":"Directed","countsTowardUnlock":true,"playerCountPrestige":true,"unlockAt":16,"declaredVow":false,"requiredSteward":"quartermaster","thresholdsByPlayerCount":{"1":3,"2":4,"3":4,"4":5},"cumulativeCounter":null,"requirement":"With Quartermaster chosen, use the Quartermaster Power in each Season and end with 10+ resources in at least 3 / 4 / 4 / 5 resource types in 1p / 2p / 3p / 4p. Available after 16 named Ledger Entries have been completed."},
  {"id":"LE-050","name":"Six Hands, One Vale","chronicle":"Steward Record","entryType":"Steward","scope":"Once","pacingBand":"Capstone","countsTowardUnlock":true,"playerCountPrestige":false,"unlockAt":25,"declaredVow":false,"requiredSteward":null,"thresholdsByPlayerCount":null,"cumulativeCounter":"completed_steward_objectives","requirement":"Across multiple games, complete every Steward Objective at least once. Available after 25 named Ledger Entries have been completed."}
];

export const ledgerEntries: LedgerEntry[] = ledgerEntryDefinitions.map((entry) => ({
  ...entry,
  unlockAt: ledgerUnlockGates[entry.id] ?? entry.unlockAt
}));

export const ledgerEntryById = Object.fromEntries(
  ledgerEntries.map((entry) => [entry.id, entry])
) as Record<string, LedgerEntry>;

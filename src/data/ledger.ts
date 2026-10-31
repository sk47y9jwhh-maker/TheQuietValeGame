/**
 * The Steward's Ledger's Golden milestones: the number of completed Quest
 * Cards that unlocks each Golden pair.
 */
export interface LedgerMilestone {
  threshold: number;
  goldenTileId: string;
  goldenTile: string;
  goldenTileTheme: string;
  goldenBoonId: string;
  goldenBoon: string;
  goldenBoonTheme: string;
}

export const ledgerMilestones: LedgerMilestone[] = [
  { threshold: 3, goldenTileId: "golden_tile_the_golden_charter", goldenTile: "The Golden Charter", goldenTileTheme: "Mixed civic district", goldenBoonId: "golden_boon_the_golden_bell", goldenBoon: "The Golden Bell", goldenBoonTheme: "Reveal a new active Arrival" },
  { threshold: 6, goldenTileId: "golden_tile_the_golden_hearth", goldenTile: "The Golden Hearth", goldenTileTheme: "Settlement core and Supported Housing", goldenBoonId: "golden_boon_the_golden_scroll", goldenBoon: "The Golden Scroll", goldenBoonTheme: "Redraw standard hand cards as Boons" },
  { threshold: 9, goldenTileId: "golden_tile_the_golden_river_gate", goldenTile: "The Golden River Gate", goldenTileTheme: "Riverbank settlement and bridge incentive", goldenBoonId: "golden_boon_the_golden_vial", goldenBoon: "The Golden Vial", goldenBoonTheme: "Ongoing Travel placement" },
  { threshold: 12, goldenTileId: "golden_tile_the_golden_cairn", goldenTile: "The Golden Cairn", goldenTileTheme: "Terrain spread and remote expansion", goldenBoonId: "golden_boon_the_golden_eyed_traveler", goldenBoon: "The Golden-Eyed Traveller", goldenBoonTheme: "Bonus player turns" },
  { threshold: 15, goldenTileId: "golden_tile_the_golden_garden", goldenTile: "The Golden Garden", goldenTileTheme: "Resilience and recovery district", goldenBoonId: "golden_boon_the_golden_signet_ring", goldenBoon: "The Golden Signet Ring", goldenBoonTheme: "Tile repositioning" }
];

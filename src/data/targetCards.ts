import type {
  TargetCardDefinition,
  TargetCardFilterName
} from "../engine/types";

/**
 * The physical 15-card Target Deck. Cards 1–12 cover the 6 combinations of
 * Tile (Basic, Upgraded, Special / Golden) and Strain (Already Strained,
 * Unstrained), two copies each with opposite compass directions, so each of
 * the six flat-top hex directions (N, NE, SE, S, SW, NW) appears twice.
 * Cards 13–15 are Open cards: both rows read Any and players choose any
 * eligible tile.
 */
export const targetCards: TargetCardDefinition[] = [
  { id: 1, tile: "basic", strain: "strained", direction: "N" },
  { id: 2, tile: "basic", strain: "unstrained", direction: "S" },
  { id: 3, tile: "basic", strain: "strained", direction: "NE" },
  { id: 4, tile: "basic", strain: "unstrained", direction: "SW" },
  { id: 5, tile: "upgraded", strain: "strained", direction: "SE" },
  { id: 6, tile: "upgraded", strain: "unstrained", direction: "NW" },
  { id: 7, tile: "upgraded", strain: "strained", direction: "S" },
  { id: 8, tile: "upgraded", strain: "unstrained", direction: "N" },
  { id: 9, tile: "specialOrGolden", strain: "strained", direction: "SW" },
  { id: 10, tile: "specialOrGolden", strain: "unstrained", direction: "NE" },
  { id: 11, tile: "specialOrGolden", strain: "strained", direction: "NW" },
  { id: 12, tile: "specialOrGolden", strain: "unstrained", direction: "SE" },
  { id: 13, tile: "any", strain: "any" },
  { id: 14, tile: "any", strain: "any" },
  { id: 15, tile: "any", strain: "any" }
];

export const targetCardById = Object.fromEntries(
  targetCards.map((card) => [card.id, card])
) as Record<number, TargetCardDefinition>;

export function isOpenTargetCard(card: TargetCardDefinition): boolean {
  return card.direction === undefined &&
    card.tile === "any" &&
    card.strain === "any";
}

export const targetCardRulesText =
  "Target Cards: Shuffle the 15-card deck once during setup. Start with only the tiles eligible under the triggering effect. Draw the top card and check 1. Tile, then 2. Current Strain (unless already set by the triggering effect). Stop as soon as 1 tile remains. Skip a row if no remaining tile matches it. If 2 or more tiles still remain, take the tied tile closest to the card's compass direction. If still tied, players choose. Open cards (13–15) let players choose any eligible target. Return each resolved card face down to the bottom of the deck. Resolve Supported and other prevention normally. Prevented Strain is not redirected.";

export const targetCardFilterLabels: Record<TargetCardFilterName, string> = {
  tile: "Tile",
  strain: "Strain",
  class: "Class",
  side: "Side",
  adjacency: "Adjacency"
};

export function describeTargetCard(card: TargetCardDefinition): {
  tile: string;
  strain: string;
} {
  return {
    tile: card.tile === "any"
      ? "Any"
      : card.tile === "basic"
        ? "Basic"
        : card.tile === "upgraded"
          ? "Upgraded"
          : "Special / Golden",
    strain: card.strain === "any"
      ? "Any"
      : card.strain === "strained"
        ? "Already Strained"
        : "Unstrained"
  };
}

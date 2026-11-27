import type {
  TargetCardDefinition,
  TargetCardFilterName
} from "../engine/types";

/**
 * The physical 30-card Target Deck. Cards 1–24 cover the 6 combinations of
 * Tile (Basic, Upgraded, Special / Golden) and Strain (Already Strained,
 * Unstrained), four copies each, with each of the six flat-top hex directions
 * (N, NE, SE, S, SW, NW) appearing four times (cards 13–24 mirror 1–12 with
 * opposite directions). Cards 25–30 are Open cards: both rows read Any and
 * they have no tie direction.
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
  { id: 13, tile: "basic", strain: "strained", direction: "S" },
  { id: 14, tile: "basic", strain: "unstrained", direction: "N" },
  { id: 15, tile: "basic", strain: "strained", direction: "SW" },
  { id: 16, tile: "basic", strain: "unstrained", direction: "NE" },
  { id: 17, tile: "upgraded", strain: "strained", direction: "NW" },
  { id: 18, tile: "upgraded", strain: "unstrained", direction: "SE" },
  { id: 19, tile: "upgraded", strain: "strained", direction: "N" },
  { id: 20, tile: "upgraded", strain: "unstrained", direction: "S" },
  { id: 21, tile: "specialOrGolden", strain: "strained", direction: "NE" },
  { id: 22, tile: "specialOrGolden", strain: "unstrained", direction: "SW" },
  { id: 23, tile: "specialOrGolden", strain: "strained", direction: "SE" },
  { id: 24, tile: "specialOrGolden", strain: "unstrained", direction: "NW" },
  { id: 25, tile: "any", strain: "any" },
  { id: 26, tile: "any", strain: "any" },
  { id: 27, tile: "any", strain: "any" },
  { id: 28, tile: "any", strain: "any" },
  { id: 29, tile: "any", strain: "any" },
  { id: 30, tile: "any", strain: "any" }
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
  "Target Cards: Shuffle the 30-card deck once during setup. Start with the tiles eligible under the effect causing the Strain. Draw the top card and check Tile, then Current Strain. Stop as soon as 1 tile remains. Skip a row if no remaining tile matches it. If 2 or more tiles still remain, take the one furthest in the card's compass direction. Open cards have no direction: choose any eligible target. Return each resolved card face down to the bottom of the deck. Resolve Supported and other prevention normally. Prevented Strain is not redirected.";

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

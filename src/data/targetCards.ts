import type {
  TargetCardDefinition,
  TargetCardFilterName
} from "../engine/types";

/**
 * The physical deck. Cards 13–24 repeat the preference profiles
 * of cards 1–12 with the opposite arrow. Keep this list explicit: its paired
 * preferences and arrows are part of the balance, not generated data.
 */
export const targetCards: TargetCardDefinition[] = [
  { id: 1, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "strained", direction: "NE" },
  { id: 2, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "unstrained", direction: "SW" },
  { id: 3, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "strained", direction: "E" },
  { id: 4, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "unstrained", direction: "W" },
  { id: 5, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "strained", direction: "SE" },
  { id: 6, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "unstrained", direction: "NW" },
  { id: 7, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "strained", direction: "SW" },
  { id: 8, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "unstrained", direction: "NE" },
  { id: 9, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "strained", direction: "W" },
  { id: 10, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "unstrained", direction: "E" },
  { id: 11, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "strained", direction: "NW" },
  { id: 12, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "unstrained", direction: "SE" },
  { id: 13, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "strained", direction: "SW" },
  { id: 14, tileClass: "core", side: "basic", adjacency: "threePlus", strain: "unstrained", direction: "NE" },
  { id: 15, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "strained", direction: "W" },
  { id: 16, tileClass: "core", side: "basic", adjacency: "zeroToTwo", strain: "unstrained", direction: "E" },
  { id: 17, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "strained", direction: "NW" },
  { id: 18, tileClass: "core", side: "upgraded", adjacency: "threePlus", strain: "unstrained", direction: "SE" },
  { id: 19, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "strained", direction: "NE" },
  { id: 20, tileClass: "core", side: "upgraded", adjacency: "zeroToTwo", strain: "unstrained", direction: "SW" },
  { id: 21, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "strained", direction: "E" },
  { id: 22, tileClass: "specialOrGolden", side: "either", adjacency: "threePlus", strain: "unstrained", direction: "W" },
  { id: 23, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "strained", direction: "SE" },
  { id: 24, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "unstrained", direction: "NW" }
];

export const targetCardById = Object.fromEntries(
  targetCards.map((card) => [card.id, card])
) as Record<number, TargetCardDefinition>;

export const targetCardRulesText =
  "Target Cards: Shuffle the 24-card deck once during setup. Start with the tiles eligible under the effect causing the Strain. Draw the top card and read it from top to bottom. Apply each preference if at least one currently considered tile matches it; otherwise ignore that preference. Use the arrow to resolve any remaining tie. After resolving the target, return the card face down to the bottom of the deck. Resolve Supported and other prevention normally. Prevented Strain is not redirected.";

export const targetCardFilterLabels: Record<TargetCardFilterName, string> = {
  class: "Class",
  side: "Side",
  adjacency: "Adjacency",
  strain: "Strain"
};

export function describeTargetCard(card: TargetCardDefinition): {
  tileClass: string;
  side: string;
  adjacency: string;
  strain: string;
} {
  return {
    tileClass: card.tileClass === "core" ? "Core" : "Special / Golden",
    side: card.side === "either"
      ? "Either"
      : card.side === "basic"
        ? "Basic"
        : "Upgraded",
    adjacency: card.adjacency === "threePlus" ? "3+ neighbours" : "0–2 neighbours",
    strain: card.strain === "strained" ? "Already Strained" : "Unstrained"
  };
}

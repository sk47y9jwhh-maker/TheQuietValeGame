import type {
  TargetCardDefinition,
  TargetCardFilterName
} from "../engine/types";

/**
 * The experimental physical deck. Keep this list explicit: its paired
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
  { id: 12, tileClass: "specialOrGolden", side: "either", adjacency: "zeroToTwo", strain: "unstrained", direction: "SE" }
];

export const targetCardById = Object.fromEntries(
  targetCards.map((card) => [card.id, card])
) as Record<number, TargetCardDefinition>;

export const targetCardRulesText =
  "Target Cards: Start with the tiles eligible under the effect causing the Strain. Read the Target Card from top to bottom. Apply each preference if at least one currently considered tile matches it; otherwise ignore that preference. Use the arrow to resolve any remaining tie. After selecting the target, resolve Supported and other prevention normally. Prevented Strain is not redirected.";

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

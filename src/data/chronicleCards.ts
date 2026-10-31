import chronicleDeck from "./chronicleCards.json";

/**
 * Chronicle Cards: the quest-card replacement for the Steward's Ledger.
 * The card list is shared with the printed deck (design/chronicle-cards).
 * Each card has an easier top half and a harder bottom half; both are live,
 * and completing either one completes the card.
 */
export type ChronicleHalfKey = "top" | "bottom";
export type ChronicleCheck = "Moment" | "Final" | "All game";
export type ChronicleStripValue = number | string;
export type ChronicleStrip = [label: string, values: ChronicleStripValue[]];

export interface ChronicleHalf {
  name: string;
  kind: "Goal" | "Vow";
  check: ChronicleCheck;
  text: string;
  strips: ChronicleStrip[];
  keep?: ChronicleStrip;
}

export interface ChronicleCard {
  n: number;
  theme: string;
  top: ChronicleHalf;
  bottom: ChronicleHalf;
}

export const chronicleCards = chronicleDeck.cards as ChronicleCard[];

export const chronicleCardByNumber = Object.fromEntries(
  chronicleCards.map((card) => [card.n, card])
) as Record<number, ChronicleCard>;

/** Renown for completing the drawn card, once per game. */
export const chronicleCompletionRenown = 20;

/** Completed cards needed for each Golden pair, in the existing unlock order. */
export const chronicleGoldenThresholds = [3, 6, 9, 12, 15] as const;

/** The value a strip gives at this player count (1 to 5). */
export function stripValue(half: ChronicleHalf, label: string, playerCount: number): ChronicleStripValue {
  const strip = half.strips.find(([name]) => name === label);
  if (!strip) throw new Error(`Chronicle quest ${half.name} has no strip ${label}.`);
  return strip[1][playerCount - 1];
}

export function keepValue(half: ChronicleHalf, playerCount: number): number {
  if (!half.keep) throw new Error(`Chronicle quest ${half.name} has no Keep it line.`);
  return Number(half.keep[1][playerCount - 1]);
}

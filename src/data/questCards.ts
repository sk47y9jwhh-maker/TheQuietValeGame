import questDeck from "./questCards.json";

/**
 * Quest Cards. Completed cards go into the Steward's Ledger, which unlocks the
 * Golden pairs. The card list is shared with the printed deck
 * (design/quest-cards).
 * Each card has an easier top half and a harder bottom half; both are live,
 * and completing either one completes the card.
 */
export type QuestHalfKey = "top" | "bottom";
export type QuestCheckKind = "Moment" | "Final" | "All game";
export type QuestStripValue = number | string;
export type QuestStrip = [label: string, values: QuestStripValue[]];

export interface QuestHalf {
  name: string;
  kind: "Goal" | "Vow";
  check: QuestCheckKind;
  text: string;
  strips: QuestStrip[];
  keep?: QuestStrip;
}

export interface QuestCard {
  n: number;
  theme: string;
  top: QuestHalf;
  bottom: QuestHalf;
}

export const questCards = questDeck.cards as QuestCard[];

export const questCardByNumber = Object.fromEntries(
  questCards.map((card) => [card.n, card])
) as Record<number, QuestCard>;

/** Renown for completing the drawn card, once per game. */
export const questCompletionRenown = 20;

/** Completed cards needed for each Golden pair, in the existing unlock order. */
export const questGoldenThresholds = [3, 6, 9, 12, 15] as const;

/** The value a strip gives at this player count (1 to 5). */
export function stripValue(half: QuestHalf, label: string, playerCount: number): QuestStripValue {
  const strip = half.strips.find(([name]) => name === label);
  if (!strip) throw new Error(`Quest ${half.name} has no strip ${label}.`);
  return strip[1][playerCount - 1];
}

export function keepValue(half: QuestHalf, playerCount: number): number {
  if (!half.keep) throw new Error(`Quest ${half.name} has no Keep it line.`);
  return Number(half.keep[1][playerCount - 1]);
}

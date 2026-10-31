/**
 * The Steward's Ledger: the campaign record for Quest Cards.
 *
 * One open deck of 21 Quest Cards. Each game draws the top card. A completed
 * card goes into the Ledger; a failed card goes to the bottom of the deck, so
 * it never comes straight back. Golden pairs unlock as the Ledger fills
 * (3, 6, 9, 12 and 15 cards).
 */
import { questCards } from "../data/questCards";

export const ledgerCampaignVersion = 3;

export interface LedgerGameRecord {
  id: string;
  completedAt: string;
  playerCount: number;
  stewardIds: string[];
  finalScore: number;
  questCardNumber: number;
  questCompleted: boolean;
}

export interface LedgerCampaign {
  version: typeof ledgerCampaignVersion;
  /** Quest Card numbers still to play, top first. */
  deck: number[];
  /** Completed Quest Card numbers, in the order they were completed. */
  box: number[];
  games: LedgerGameRecord[];
  /** Golden pairs earned under the old 50-entry Ledger, kept when it was replaced. */
  grandfatheredGoldenMilestoneCount?: number;
}

function shuffle(numbers: number[], seed: string): number[] {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  const random = () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
  const next = [...numbers];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

export function createEmptyLedgerCampaign(seed = `ledger-${Date.now().toString(36)}`): LedgerCampaign {
  return {
    version: ledgerCampaignVersion,
    deck: shuffle(questCards.map((card) => card.n), seed),
    box: [],
    games: []
  };
}

/** Completed Quest Cards in the Ledger. */
export function countCompletedLedgerEntries(campaign: LedgerCampaign): number {
  return campaign.box.length;
}

export function isGoldenMilestoneUnlocked(
  campaign: LedgerCampaign,
  milestoneIndex: number,
  threshold: number
): boolean {
  return (
    countCompletedLedgerEntries(campaign) >= threshold ||
    (campaign.grandfatheredGoldenMilestoneCount ?? 0) > milestoneIndex
  );
}

/**
 * The Quest Card for the next game. Once every card is in the Ledger, the
 * completed cards come round again in order, for replay.
 */
export function nextQuestCard(campaign: LedgerCampaign): number {
  if (campaign.deck.length > 0) return campaign.deck[0];
  return campaign.box[campaign.games.length % campaign.box.length] ?? questCards[0].n;
}

/** Records a finished game. Recording the same game twice changes nothing. */
export function recordQuestGame(campaign: LedgerCampaign, game: Omit<LedgerGameRecord, "completedAt">): LedgerCampaign {
  if (campaign.games.some((record) => record.id === game.id)) return campaign;
  const inDeck = campaign.deck.includes(game.questCardNumber);
  const rest = campaign.deck.filter((n) => n !== game.questCardNumber);
  const deck = !inDeck ? campaign.deck : game.questCompleted ? rest : [...rest, game.questCardNumber];
  const box = inDeck && game.questCompleted ? [...campaign.box, game.questCardNumber] : campaign.box;
  return {
    ...campaign,
    deck,
    box,
    games: [{ ...game, completedAt: new Date().toISOString() }, ...campaign.games]
  };
}

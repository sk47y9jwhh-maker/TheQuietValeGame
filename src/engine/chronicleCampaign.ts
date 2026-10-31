/**
 * The Chronicle campaign: one open deck of 21 cards and the Chronicle box.
 * Draw the top card for each game. A completed card goes into the box; a
 * failed card goes to the bottom of the deck, so it never comes straight back.
 * Golden pairs unlock as the box fills (3, 6, 9, 12 and 15 cards).
 */
import { chronicleCards, chronicleGoldenThresholds } from "../data/chronicleCards";

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

export interface ChronicleCampaign {
  version: 1;
  /** Card numbers still to play, top first. */
  deck: number[];
  /** Completed card numbers, in the order they were completed. */
  box: number[];
  games: ChronicleGameRecord[];
}

export interface ChronicleGameRecord {
  gameId: string;
  cardNumber: number;
  playerCount: number;
  completed: boolean;
  completedAt: string;
}

export function createChronicleCampaign(seed = `chronicle-${Date.now().toString(36)}`): ChronicleCampaign {
  const numbers = chronicleCards.map((card) => card.n);
  return { version: 1, deck: shuffle(numbers, seed), box: [], games: [] };
}

/** The card for the next game, or null once every card is in the box. */
export function nextChronicleCard(campaign: ChronicleCampaign): number | null {
  return campaign.deck[0] ?? null;
}

/** Records a finished game. Recording the same game twice changes nothing. */
export function recordChronicleGame(
  campaign: ChronicleCampaign,
  game: { gameId: string; cardNumber: number; playerCount: number; completed: boolean }
): ChronicleCampaign {
  if (campaign.games.some((record) => record.gameId === game.gameId)) return campaign;
  if (!campaign.deck.includes(game.cardNumber)) return campaign;
  const rest = campaign.deck.filter((n) => n !== game.cardNumber);
  return {
    ...campaign,
    deck: game.completed ? rest : [...rest, game.cardNumber],
    box: game.completed ? [...campaign.box, game.cardNumber] : campaign.box,
    games: [...campaign.games, { ...game, completedAt: new Date().toISOString() }]
  };
}

/** How many Golden pairs are unlocked (0 to 5), in the existing pair order. */
export function unlockedGoldenPairCount(campaign: ChronicleCampaign): number {
  return chronicleGoldenThresholds.filter((threshold) => campaign.box.length >= threshold).length;
}

/** Cards still needed for the next Golden pair, or null when all are unlocked. */
export function cardsToNextGoldenPair(campaign: ChronicleCampaign): number | null {
  const next = chronicleGoldenThresholds.find((threshold) => campaign.box.length < threshold);
  return next === undefined ? null : next - campaign.box.length;
}

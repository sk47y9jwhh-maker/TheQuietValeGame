import { supportedPlayerCounts, type Season } from "./types";

export function getSeasonForRound(round: number): Season {
  if (round < 1 || round > 12) {
    throw new Error(`Round must be between 1 and 12. Received ${round}.`);
  }

  if (round <= 4) return 1;
  if (round <= 8) return 2;
  return 3;
}

export function isSeasonStartRound(round: number): boolean {
  return round === 1 || round === 5 || round === 9;
}

export function revealCountForPlayers(playerCount: number): number {
  if (!supportedPlayerCounts.includes(playerCount as (typeof supportedPlayerCounts)[number])) {
    throw new Error("Standard online prototype supports 1-5 players.");
  }

  return playerCount;
}

/** Actions per turn: 4 at 1 to 3 players, 3 at 4 to 5 players. */
export function actionsPerTurn(playerCount: number): number {
  return playerCount >= 4 ? 3 : 4;
}

/**
 * Turn order for a round. Seats stay in setup order; the first player moves
 * one seat along each round, so Round 1 starts with seat 1, Round 2 with
 * seat 2, and so on, wrapping round the table.
 */
export function turnOrderForRound<T>(players: readonly T[], round: number): T[] {
  if (!players.length) return [];
  const start = (((round - 1) % players.length) + players.length) % players.length;
  return [...players.slice(start), ...players.slice(0, start)];
}

/** The player who goes first in a round. */
export function firstPlayerForRound<T>(players: readonly T[], round: number): T {
  return turnOrderForRound(players, round)[0];
}

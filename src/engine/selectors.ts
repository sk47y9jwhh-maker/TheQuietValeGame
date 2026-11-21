import { encounterById } from "../data/encounters";
import { getPlacedTileName } from "./placedTiles";
import type { GameState, PlacedTile } from "./types";

export function selectCurrentPlayer(state: GameState) {
  return state.players.find((player) => player.id === state.currentPlayerId) ?? state.players[0];
}

export function selectTileName(tile: PlacedTile): string {
  return getPlacedTileName(tile);
}

export function selectEncounterName(cardId: string): string {
  return encounterById[cardId]?.name ?? cardId;
}

/**
 * Whether a tile carries an X token: its once-per-round ability, or its Linked
 * Production, has been used this round. The tokens come off at the end of the round.
 */
export function hasRoundUseToken(state: GameState, tile: PlacedTile): boolean {
  const record = state.tileActivationRecords[tile.instanceId];
  return record?.round === state.round || record?.linkedProductionRound === state.round;
}

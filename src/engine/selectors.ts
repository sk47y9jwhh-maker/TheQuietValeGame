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

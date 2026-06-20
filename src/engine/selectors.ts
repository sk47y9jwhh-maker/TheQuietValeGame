import { encounterById } from "../data/encounters";
import { coreTileById, specialTileById } from "../data/tiles";
import { calculateFinalScore } from "./scoring";
import type { GameState, PlacedTile } from "./types";

export function selectCurrentPlayer(state: GameState) {
  return state.players.find((player) => player.id === state.currentPlayerId) ?? state.players[0];
}

export function selectTileName(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.name ?? tile.tileId;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.name : data.basic.name;
}

export function selectAlerts(state: GameState): string[] {
  const alerts: string[] = [];
  const expiring = state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens <= 1);
  const overstrained = state.map.placedTiles.filter((tile) => tile.strain >= 3);

  if (expiring.length) alerts.push(`${expiring.length} Arrival expiring`);
  const activeBurdenCount = state.encounters.activeBurdens.filter(
    (cardId) => !state.ignoredBurdenIdsThisRound.includes(cardId)
  ).length;
  if (activeBurdenCount) {
    alerts.push(`${activeBurdenCount} Active Burdens`);
  }
  if (overstrained.length) alerts.push(`${overstrained.length} Overstrained`);

  const score = calculateFinalScore(state);
  if (score.strainPenalty > 0) alerts.push(`${score.strainPenalty} Renown at risk from Strain`);

  return alerts;
}

export function selectEncounterName(cardId: string): string {
  return encounterById[cardId]?.name ?? cardId;
}

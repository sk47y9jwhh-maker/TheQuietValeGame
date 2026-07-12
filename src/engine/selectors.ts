import { encounterById } from "../data/encounters";
import { getPlacedTileName } from "./placedTiles";
import { calculateFinalScore } from "./scoring";
import type { GameState, PlacedTile } from "./types";

export function selectCurrentPlayer(state: GameState) {
  return state.players.find((player) => player.id === state.currentPlayerId) ?? state.players[0];
}

export function selectTileName(tile: PlacedTile): string {
  return getPlacedTileName(tile);
}

export function selectAlerts(state: GameState): string[] {
  const alerts: string[] = [];
  const expiring = state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens <= 1);
  const overstrained = state.map.placedTiles.filter((tile) => tile.strain >= 3);

  if (expiring.length) {
    alerts.push(`${expiring.length} Arrival${expiring.length === 1 ? "" : "s"} expiring`);
  }
  const activeBurdenCount = state.encounters.activeBurdens.filter(
    (cardId) => !state.ignoredBurdenIdsThisRound.includes(cardId)
  ).length;
  if (activeBurdenCount) {
    alerts.push(
      `${activeBurdenCount} Active Burden${activeBurdenCount === 1 ? "" : "s"}`
    );
  }
  if (overstrained.length) {
    alerts.push(
      `${overstrained.length} Overstrained tile${overstrained.length === 1 ? "" : "s"}`
    );
  }

  const score = calculateFinalScore(state);
  if (score.strainPenalty > 0) alerts.push(`${score.strainPenalty} Renown at risk`);

  return alerts;
}

export function selectEncounterName(cardId: string): string {
  return encounterById[cardId]?.name ?? cardId;
}

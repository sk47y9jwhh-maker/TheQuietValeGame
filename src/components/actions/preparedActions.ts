import type { GameState, TileCategory } from "../../engine/types";

interface StewardPreparation {
  mode: "place" | "upgrade";
  category?: TileCategory;
  prepareLabel: string;
  nextAction: string;
  reviewLabel: string;
  support: string;
}

export const stewardPreparations: Record<string, StewardPreparation> = {
  vanguard: {
    mode: "place", category: "travel", prepareLabel: "Prepare 0-action Travel",
    nextAction: "Your next Travel placement costs 0 actions.", reviewLabel: "Choose a Travel tile",
    support: "It gains Supported beside another Travel Tile or on River/Water."
  },
  knight: {
    mode: "place", category: "housing", prepareLabel: "Prepare 0-action Housing",
    nextAction: "Your next Housing placement costs 0 actions.", reviewLabel: "Choose a Housing tile",
    support: "It gains Supported beside another Housing Tile."
  },
  sentinel: {
    mode: "upgrade", prepareLabel: "Prepare 0-action upgrade",
    nextAction: "Your next Core upgrade costs 0 actions.", reviewLabel: "Review Core upgrades",
    support: "It gains Supported beside another upgraded, non-Overstrained Core Tile."
  }
};

export function getPreparedStewardPower(state: GameState) {
  const stewardId = state.players.find((player) => player.id === state.currentPlayerId)?.stewardId;
  const preparation = stewardId ? stewardPreparations[stewardId] : undefined;
  const modifier = preparation && state.boonModifiers.find((candidate) =>
    candidate.sourceType === "steward" && candidate.sourceCardId === stewardId && candidate.remainingUses > 0);
  return modifier ? { ...preparation!, modifier, stewardId: stewardId! } : null;
}

/** Only preparations that should open the current player's tile action pane. */
export function getActionPreparationIds(state: GameState, mode?: "place" | "upgrade"): string[] {
  const steward = getPreparedStewardPower(state);
  return state.boonModifiers.filter((modifier) =>
    modifier.remainingUses > 0 &&
    (!mode || modifier.actions.includes(mode)) &&
    (modifier.id === steward?.modifier.id || modifier.sourceCardId === "golden_boon_the_golden_vial")
  ).map((modifier) => modifier.id);
}

/**
 * The moves of the "Watch a demo" game, as plain data. The game is recorded
 * once by `tools/build-watch-demo.ts` and replayed here through the ordinary
 * rules engine, so everything the viewer sees is a legal position.
 */
import { activateTile, commitSeasonSeeding, completeArrival, confirmCostChoice, endCurrentTurn, placeTile, resolveBurden, resolveEndRound, revealEncounters, upgradeTile, useFaceUpBoon, useStewardPower } from "../../engine/gameActions";
import { preparePendingEffectQueueHead, resolvePendingEffect, skipPendingEffect } from "../../engine/manualEffects";
import { skipDeckReorder } from "../../engine/deckReorder";
import { trackLedgerTransition } from "../../engine/ledger";
import type { EffectAdjustment, GameState, HexDirection } from "../../engine/types";

export type WatchMove =
  | { k: "seed"; p: string; top: string; middle: string; bottom: string }
  | { k: "reveal" }
  | { k: "endRound" }
  | { k: "endTurn" }
  | { k: "place"; tile: string; hex: string; o?: HexDirection }
  | { k: "activate"; id: string }
  | { k: "upgrade"; id: string }
  | { k: "arrival"; id: string }
  | { k: "burden"; id: string }
  | { k: "power" }
  | { k: "boon"; id: string }
  | { k: "cost" }
  | { k: "effect"; adj: EffectAdjustment }
  | { k: "skip" }
  | { k: "reorder" };

function act(state: GameState, move: WatchMove): GameState {
  const player = state.currentPlayerId;
  switch (move.k) {
    case "seed": return commitSeasonSeeding(state, move.p, { top: move.top, middle: move.middle, bottom: move.bottom });
    case "reveal": return revealEncounters(state);
    case "endRound": return resolveEndRound(state);
    case "endTurn": return endCurrentTurn(state);
    case "place": return placeTile(state, player, move.tile, move.o === undefined ? { anchorHexId: move.hex } : { anchorHexId: move.hex, orientation: move.o });
    case "activate": return activateTile(state, player, move.id);
    case "upgrade": return upgradeTile(state, player, move.id);
    case "arrival": return completeArrival(state, move.id);
    case "burden": return resolveBurden(state, move.id);
    case "power": return useStewardPower(state, player);
    case "boon": return useFaceUpBoon(state, move.id);
    case "cost": return confirmCostChoice(state, { selectedOptionIds: [] });
    case "effect": return resolvePendingEffect(preparePendingEffectQueueHead(state), move.adj);
    case "skip": return skipPendingEffect(preparePendingEffectQueueHead(state));
    case "reorder": return skipDeckReorder(state);
  }
}

/** One recorded move. Throws if the engine refuses it: the recording no longer matches the rules. */
export function applyWatchMove(state: GameState, move: WatchMove): GameState {
  const next = act(state, move);
  if (next === state) throw new Error(`The demo move ${move.k} made no change in round ${state.round} (${state.phase}).`);
  return trackLedgerTransition(state, next);
}

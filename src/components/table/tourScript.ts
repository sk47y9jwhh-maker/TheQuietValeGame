/**
 * The guided tour: a short scripted opening that plays itself, one step per
 * Next. Every move goes through the ordinary rules engine, so what the tour
 * shows is exactly what a player could do. Steps that no longer apply (the
 * player took their own action, say) return null and the tour offers to hand
 * over instead.
 */
import { activateTile, canResolveBurden, resolveBurden, commitSeasonSeeding, completeArrival, canCompleteArrival, confirmCostChoice, endCurrentTurn, placeTile, resolveEndRound, revealEncounters } from "../../engine/gameActions";
import { getAlternativeEffectRule, preparePendingEffectQueueHead, resolvePendingEffect, skipPendingEffect } from "../../engine/manualEffects";
import { skipDeckReorder } from "../../engine/deckReorder";
import { getLegalPlacementHexes } from "../../engine/placementRules";
import { getHexNeighbors } from "../../engine/hex";
import { trackLedgerTransition } from "../../engine/ledger";
import { calculateFinalScore } from "../../engine/scoring";
import { encounterById } from "../../data/encounters";
import type { EffectAdjustment, GameState } from "../../engine/types";
import type { CoachTarget } from "./TableCoach";

export interface TourStep {
  id: string;
  title: string;
  text: (state: GameState) => string;
  /** What Next does. The same state means nothing to play. Null means the step no longer fits. */
  play?: (state: GameState) => GameState | null;
  /** Steps that do not apply in this game are passed over. */
  skip?: (state: GameState) => boolean;
  /** The Next button's label. */
  verb?: string;
  target?: (state: GameState) => CoachTarget | null;
}

const me = (state: GameState) => state.players.find((player) => player.id === state.currentPlayerId) ?? state.players[0];
const tileAt = (state: GameState, tileId: string, nth = 0) => state.map.placedTiles.filter((tile) => tile.tileId === tileId)[nth];

/** Settle anything the engine queues: no-choice effects, then payments before Strain. */
export function settleForTour(input: GameState, stopAtChoice = false): GameState | null {
  let state = input;
  for (let guard = 0; guard < 60; guard++) {
    if (state.pendingCostChoice) {
      const paid = confirmCostChoice(state, { selectedOptionIds: [] });
      if (paid === state) return null;
      state = paid;
      continue;
    }
    if (state.pendingDeckReorder) { state = skipDeckReorder(state); continue; }
    if (!state.pendingEffects.length) return state;
    state = preparePendingEffectQueueHead(state);
    const pending = state.pendingEffects[0];
    if (stopAtChoice) {
      const plain = resolvePendingEffect(state, {});
      if (plain.pendingEffects.some((effect) => effect.id === pending.id)) return state;
      state = plain;
      continue;
    }
    const alternative = getAlternativeEffectRule(state, pending.ruleId);
    const tries: EffectAdjustment[] = alternative?.kind === "pay_or_strain" || alternative?.kind === "pay_or_timer" || alternative?.kind === "pay_total_or_strain"
      ? alternative.resources.map((resource) => ({ resourceDeltas: { [resource]: -alternative.resourceStep * alternative.requiredChoices }, tileStrainDeltas: {}, arrivalTimerDeltas: {} }))
      : [];
    tries.push({});
    let next: GameState | null = null;
    for (const choice of tries) {
      const candidate = resolvePendingEffect(state, choice);
      if (!candidate.pendingEffects.some((effect) => effect.id === pending.id)) { next = candidate; break; }
    }
    if (!next && pending.canSkip) next = skipPendingEffect(state);
    if (!next || next.pendingEffects.some((effect) => effect.id === pending.id)) return null;
    state = next;
  }
  return null;
}

/** One engine action, then everything it sets off. Null if it changed nothing. */
function step(state: GameState, action: (state: GameState) => GameState, stopAtChoice = false): GameState | null {
  const next = action(state);
  if (next === state) return null;
  const settled = settleForTour(next, stopAtChoice);
  return settled ? trackLedgerTransition(state, settled) : null;
}

/** A legal space for a tile, preferring one that touches the given hex. */
function spaceBeside(state: GameState, tileId: string, nearHexId?: string): string | undefined {
  const legal = getLegalPlacementHexes(state, me(state).id, tileId);
  const near = nearHexId ? new Set(getHexNeighbors(nearHexId)) : null;
  return legal.find((hexId) => near?.has(hexId)) ?? legal[0];
}

function place(state: GameState, tileId: string, hexId: string | undefined): GameState | null {
  if (!hexId || state.phase !== "turns") return null;
  return step(state, (current) => placeTile(current, current.currentPlayerId, tileId, { anchorHexId: hexId }));
}

function firstArrival(state: GameState) {
  const id = state.encounters.activeArrivals[0]?.cardId;
  return id ? encounterById[id] : undefined;
}

function costText(state: GameState): string {
  const card = firstArrival(state)
  const text = (card && "requirementText" in card ? card.requirementText : "").trim().replace(/\.$/, "");
  return text ? `asks you to ${text.charAt(0).toLowerCase()}${text.slice(1)}` : "asks for resources"
}

export const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "A guided tour",
    text: () => "Press Next and the game plays itself, one step at a time. Each card says what is about to happen and lights up where it happens. Back steps backwards, and you can take over whenever you like.",
    verb: "Start the tour"
  },
  {
    id: "seed",
    title: "Seeding the Season",
    text: () => "Before Round 1, the Vanguard secretly adds three cards from their hand to the Encounter Deck: one near the top, one in the middle and one near the bottom. An Arrival goes on top, so newcomers come first.",
    verb: "Seed three cards",
    target: () => ({ ui: "seed" }),
    play: (state) => {
      if (state.phase !== "seeding") return null;
      const player = me(state);
      const hand = state.encounters.handsByPlayerId[player.id] ?? [];
      const top = hand.find((id) => encounterById[id]?.type === "arrival") ?? hand[0];
      const rest = hand.filter((id) => id !== top);
      if (!top || rest.length < 2) return null;
      return step(state, (current) => commitSeasonSeeding(current, player.id, { top, middle: rest[0], bottom: rest[1] }));
    }
  },
  {
    id: "reveal",
    title: "Round 1 begins",
    text: () => "Each round starts by turning over cards from the Encounter Deck. The top card is the Arrival the Vanguard just seeded.",
    verb: "Reveal the cards",
    target: () => ({ ui: "encounters" }),
    // The table reveals by itself after seeding. Then this step only explains.
    play: (state) => state.phase === "reveal" ? step(state, revealEncounters) : state.phase === "turns" && state.round === 1 ? state : null
  },
  {
    id: "build",
    title: "Build a Lumber Yard",
    text: (state) => `${firstArrival(state)?.name ?? "An Arrival"} is waiting beside the board. First, the Vanguard builds where they stand. Placing a tile spends one of four actions and the resources printed on it, paid from the shared Warehouse.`,
    verb: "Build it",
    target: (state) => ({ hexIds: [me(state).stewardHexId], label: "Lumber Yard" }),
    play: (state) => place(state, "c01_lumber_yard", me(state).stewardHexId)
  },
  {
    id: "cabin",
    title: "Add a Cabin",
    text: () => "New tiles must be within reach, touching the settlement. A Cabin houses people, and every person counts as a point of Population at the end.",
    verb: "Build the Cabin",
    target: (state) => { const hexId = spaceBeside(state, "c05_cabin", tileAt(state, "c01_lumber_yard")?.hexIds[0]); return hexId ? { hexIds: [hexId], label: "Cabin" } : null; },
    play: (state) => place(state, "c05_cabin", spaceBeside(state, "c05_cabin", tileAt(state, "c01_lumber_yard")?.hexIds[0]))
  },
  {
    id: "arrival",
    title: "Welcome the Arrival",
    text: (state) => `${firstArrival(state)?.name ?? "The Arrival"} ${costText(state)}. Paying with an Interact action completes it and unlocks its Special tile, ready to build. Its timer tokens show how long it will wait.`,
    verb: "Pay and welcome them",
    target: () => ({ ui: "arrivals" }),
    play: (state) => {
      const id = state.encounters.activeArrivals[0]?.cardId;
      if (!id || state.phase !== "turns" || !canCompleteArrival(state, id).ok) return null;
      return step(state, (current) => completeArrival(current, id));
    }
  },
  {
    id: "produce",
    title: "Produce Wood",
    text: () => "Activating the Lumber Yard refills the Warehouse with Wood. That is the fourth and last action of this turn.",
    verb: "Activate it",
    target: (state) => { const tile = tileAt(state, "c01_lumber_yard"); return tile ? { hexIds: [tile.hexIds[0]], label: "Produce" } : null; },
    play: (state) => { const tile = tileAt(state, "c01_lumber_yard"); return tile && state.phase === "turns" ? step(state, (current) => activateTile(current, current.currentPlayerId, tile.instanceId)) : null; }
  },
  {
    id: "round-end",
    title: "End of the round",
    text: () => "With the actions spent, the turn ends. At the end of each round, waiting Arrivals lose a timer, and then the next cards are revealed.",
    verb: "End the round",
    target: () => ({ ui: "end-turn" }),
    play: (state) => {
      if (state.phase !== "turns") return null;
      let next = step(state, endCurrentTurn);
      for (let guard = 0; next && guard < 6 && next.phase !== "turns"; guard++) {
        if (next.phase === "endRound") next = step(next, resolveEndRound);
        else if (next.phase === "reveal") next = step(next, revealEncounters, true);
        else break;
      }
      return next && next.phase === "turns" ? next : null;
    }
  },
  {
    id: "burden",
    title: "A Burden arrives",
    skip: (state) => !state.pendingEffects.length,
    text: (state) => { const pending = state.pendingEffects[0]; return `${pending?.sourceName ?? "A Burden"} is a hardship: “${pending?.effectText ?? ""}” Its choices are marked on the board and set out beside it. The tour pays rather than take Strain.`; },
    verb: "Pay it",
    play: (state) => state.pendingEffects.length ? settleForTour(state) : null
  },
  {
    id: "linked",
    title: "Linked Production",
    text: (state) => `Round ${state.round}: new cards are beside the board. Now a second Lumber Yard goes right next to the first. Matching production tiles that touch work together.`,
    verb: "Build the second one",
    target: (state) => { const hexId = spaceBeside(state, "c01_lumber_yard", tileAt(state, "c01_lumber_yard")?.hexIds[0]); return hexId ? { hexIds: [hexId], label: "Beside the first" } : null; },
    play: (state) => place(state, "c01_lumber_yard", spaceBeside(state, "c01_lumber_yard", tileAt(state, "c01_lumber_yard")?.hexIds[0]))
  },
  {
    id: "linked-activate",
    title: "One action, two tiles",
    text: () => "Activate either Lumber Yard and its matching neighbour produces too, for the same single action. Groups of matching tiles are the heart of a strong settlement.",
    verb: "Activate one",
    target: (state) => { const tiles = state.map.placedTiles.filter((tile) => tile.tileId === "c01_lumber_yard"); return tiles.length ? { hexIds: tiles.map((tile) => tile.hexIds[0]), label: "Produce together" } : null; },
    play: (state) => { const tile = tileAt(state, "c01_lumber_yard"); return tile && state.phase === "turns" ? step(state, (current) => activateTile(current, current.currentPlayerId, tile.instanceId)) : null; }
  },
  {
    id: "resolve-burden",
    title: "Set the Burden down",
    skip: (state) => !state.encounters.activeBurdens.some((id) => canResolveBurden(state, id).ok),
    text: (state) => { const id = state.encounters.activeBurdens[0]; return `${id ? encounterById[id]?.name ?? "The Burden" : "The Burden"} stays on the table after its first effect. It costs 10 points at the end and strikes again next Season. Resolving it takes an Interact action and its printed cost.`; },
    verb: "Resolve it",
    target: () => ({ ui: "encounters" }),
    play: (state) => { const id = state.encounters.activeBurdens.find((candidate) => canResolveBurden(state, candidate).ok); return id && state.phase === "turns" ? step(state, (current) => resolveBurden(current, id)) : null; }
  },
  {
    id: "score",
    title: "Score now",
    text: (state) => {
      const score = calculateFinalScore(state);
      const renown = score.printedRenown + score.passiveRenown + score.stewardObjectiveRenown + score.goldenRenown;
      const penalties = score.burdenPenalty + score.failedArrivalPenalty + score.strainPenalty;
      return `The score at the top is the result if the game ended this moment. Right now that is ${score.population} Population + ${renown} Renown − ${penalties} in penalties = ${score.finalScore}.${score.burdenPenalty ? " A Burden still on the table costs 10 until it is resolved." : ""} Twelve rounds make a game.`;
    },
    target: () => ({ ui: "score" })
  },
  {
    id: "handover",
    title: "Your turn",
    text: () => "That is the rhythm of the Vale: seed, reveal, build, produce and welcome newcomers, while keeping Strain down. Take over and play on from here, or jump to a moment from later in a game."
  }
];

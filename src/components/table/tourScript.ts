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
import { stewardById } from "../../data/stewards";
import { coreTileById, specialTileById } from "../../data/tiles";
import { getActivatableTileIds } from "../../engine/gameActions";
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

const stewardName = (id: string) => stewardById[id]?.name ?? "A Steward";
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
    // An open Target Card leaves the choice to the player: take the most strained eligible tile.
    const eligible = [...(pending.targetCardTargetTileIds ?? [])].sort((a, b) => (state.map.placedTiles.find((tile) => tile.instanceId === b)?.strain ?? 0) - (state.map.placedTiles.find((tile) => tile.instanceId === a)?.strain ?? 0));
    for (const tileId of eligible) tries.push({ tileStrainDeltas: { [tileId]: 1 } });
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
    title: "Your turn next",
    text: () => "That is the rhythm of the Vale: seed, reveal, build, produce and welcome newcomers, while keeping Strain down. Now start a real game of your own, or watch a moment from later in a game."
  }
];

// Walkthroughs for the moments: a few Next steps that point at what matters,
// play the key event and hand the table over.

const tileName = (state: GameState, instanceId: string) => {
  const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === instanceId);
  if (!tile) return "a tile";
  const core = coreTileById[tile.tileId];
  const name = core ? (tile.side === "upgraded" ? core.upgraded.name : core.basic.name) : specialTileById[tile.tileId]?.name ?? tileLabel(tile.tileId);
  return `${name} (${tile.hexIds[0]})`;
};
const tileLabel = (tileId: string) => tileId.replace(/^c\d+_|^special_/, "").split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const strained = (state: GameState) => state.map.placedTiles.filter((tile) => tile.strain > 0).sort((a, b) => b.strain - a.strain);
const scoreLine = (state: GameState) => {
  const score = calculateFinalScore(state);
  const renown = score.printedRenown + score.passiveRenown + score.stewardObjectiveRenown + score.goldenRenown;
  const penalties = score.burdenPenalty + score.failedArrivalPenalty + score.strainPenalty;
  return `${score.population} Population + ${renown} Renown − ${penalties} in penalties = ${score.finalScore}`;
};
/** Production tiles that come three or more to a kind: the Linked groups. */
const groups = (state: GameState) => {
  const counts = new Map<string, number>();
  for (const tile of state.map.placedTiles) counts.set(tile.tileId, (counts.get(tile.tileId) ?? 0) + 1);
  return state.map.placedTiles.filter((tile) => (counts.get(tile.tileId) ?? 0) >= 3 && /mine|outpost|lumber|farmstead/.test(tile.tileId) && tile.strain < 3);
};
const handover = (text: string): TourStep => ({ id: "handover", title: "Your turn next", text: () => text });

const lateTour: TourStep[] = [
  {
    id: "late-intro",
    title: "A thriving settlement",
    text: (state) => `Round ${state.round} of 12 in a two-player game. ${state.players.map((player) => stewardName(player.stewardId)).join(" and ")} have built ${state.map.placedTiles.length} tiles across the Vale together. This walkthrough points out what matters at this stage.`,
    verb: "Start the walkthrough"
  },
  {
    id: "late-groups",
    title: "Linked groups",
    text: (state) => { const kinds = [...new Set(groups(state).map((tile) => tileLabel(tile.tileId)))]; return `Matching production tiles sit together. ${kinds.length ? `The ${kinds.join("s and ")}s` : "Matching tiles"} form groups, and activating one makes its matching neighbours produce too, for a single action.`; },
    target: (state) => { const hexIds = groups(state).map((tile) => tile.hexIds[0]); return hexIds.length ? { hexIds, label: "Linked" } : null; }
  },
  {
    id: "late-arrivals",
    title: "Arrivals waiting",
    text: (state) => {
      const arrivals = [...state.encounters.activeArrivals].sort((a, b) => a.timerTokens - b.timerTokens);
      const first = arrivals[0];
      const name = first ? encounterById[first.cardId]?.name : undefined;
      return `${arrivals.length} Arrival${arrivals.length === 1 ? " waits" : "s wait"} beside the board.${name ? ` ${name} has ${first.timerTokens} timer${first.timerTokens === 1 ? "" : "s"} left. If no one pays for it before its timers run out, it leaves, places Strain and costs 10 points.` : ""}`;
    },
    target: () => ({ ui: "arrivals" })
  },
  {
    id: "late-strain",
    title: "The cost of hardship",
    text: (state) => { const worst = strained(state)[0]; return `Dots under a tile are Strain, and each one costs 10 at the end.${worst ? ` ${tileName(state, worst.instanceId)} carries ${worst.strain}.${worst.strain >= 3 ? " At 3 a tile is Overstrained: it stops working and scores nothing." : ""}` : ""}`; },
    target: (state) => { const hexIds = strained(state).map((tile) => tile.hexIds[0]); return hexIds.length ? { hexIds, label: "Strain" } : null; }
  },
  {
    id: "late-produce",
    title: "One action, a whole group",
    text: (state) => { const tile = groups(state).find((candidate) => getActivatableTileIds(state, state.currentPlayerId).includes(candidate.instanceId)); return `It is ${stewardName(me(state).stewardId)}’s turn. ${tile ? `Activating the ${tileLabel(tile.tileId)} at ${tile.hexIds[0]} sets its whole group producing. Watch the Warehouse at the top.` : "Activating a production tile fills the Warehouse."}`; },
    verb: "Activate it",
    target: (state) => { const tile = groups(state).find((candidate) => getActivatableTileIds(state, state.currentPlayerId).includes(candidate.instanceId)); return tile ? { hexIds: state.map.placedTiles.filter((candidate) => candidate.tileId === tile.tileId).map((candidate) => candidate.hexIds[0]), label: "Produce" } : null; },
    play: (state) => {
      const ids = getActivatableTileIds(state, state.currentPlayerId);
      const tile = groups(state).find((candidate) => ids.includes(candidate.instanceId)) ?? state.map.placedTiles.find((candidate) => ids.includes(candidate.instanceId));
      return tile && state.phase === "turns" ? step(state, (current) => activateTile(current, current.currentPlayerId, tile.instanceId)) : null;
    }
  },
  {
    id: "late-score",
    title: "Score now",
    text: (state) => `If the game ended now: ${scoreLine(state)}. Two rounds remain to welcome Arrivals, set down Burdens and keep Strain off the tiles.`,
    target: () => ({ ui: "score" })
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another moment.")
];

const chainTour: TourStep[] = [
  {
    id: "chain-intro",
    title: "The Strain spreads",
    text: (state) => { const worst = strained(state).find((tile) => tile.strain >= 3); return `Round ${state.round}. Arrivals that were not welcomed in time have left, and each one placed Strain on a tile.${worst ? ` ${tileName(state, worst.instanceId)} has reached 3 Strain: it is Overstrained.` : ""}`; },
    verb: "Start the walkthrough",
    target: (state) => { const worst = strained(state).find((tile) => tile.strain >= 3); return worst ? { hexIds: [worst.hexIds[0]], label: "Overstrained" } : null; }
  },
  {
    id: "chain-eligible",
    title: "Where will it go?",
    text: () => "An Overstrained tile stops working and spreads 1 Strain to a neighbour with fewer than 3. The Target Card decides which neighbour. The glowing tiles are the ones it may choose.",
    target: (state) => { const ids = state.pendingEffects[0]?.targetCardTargetTileIds ?? []; const hexIds = state.map.placedTiles.filter((tile) => ids.includes(tile.instanceId)).map((tile) => tile.hexIds[0]); return hexIds.length ? { hexIds, label: "Eligible" } : null; }
  },
  {
    id: "chain-spread",
    title: "The chain moves on",
    text: (state) => { const ids = [...(state.pendingEffects[0]?.targetCardTargetTileIds ?? [])]; return `This card leaves the choice open, so a player picks. The walkthrough picks the most strained: ${ids.length ? tileName(state, ids.sort((a, b) => (state.map.placedTiles.find((tile) => tile.instanceId === b)?.strain ?? 0) - (state.map.placedTiles.find((tile) => tile.instanceId === a)?.strain ?? 0))[0]) : "a neighbour"}. If that tile reaches 3, the chain carries on.`; },
    verb: "Spread the Strain",
    skip: (state) => !state.pendingEffects.length,
    play: (state) => {
      const head = state.pendingEffects[0];
      if (!head) return null;
      const after = settleOne(state);
      return after && !after.pendingEffects.some((effect) => effect.id === head.id) ? trackLedgerTransition(state, after) : null;
    }
  },
  {
    id: "chain-cost",
    title: "Counting the cost",
    text: (state) => `Every Strain token costs 10 points at the end. Right now: ${scoreLine(state)}. Supported tiles prevent the next Strain, and resolving Burdens keeps it from coming at all.`,
    target: (state) => { const hexIds = strained(state).map((tile) => tile.hexIds[0]); return hexIds.length ? { hexIds, label: "Strain" } : null; }
  },
  {
    id: "chain-continue",
    title: "The round goes on",
    text: () => "With the chain settled, the rest of the round’s cards come out and the Stewards take their turns.",
    verb: "Continue the round",
    play: (state) => {
      let next: GameState | null = state.pendingEffects.length ? settleForTour(state) : state;
      if (next && next.phase === "reveal") next = step(next, revealEncounters, true);
      return next;
    }
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another moment.")
];

const seasonTour: TourStep[] = [
  {
    id: "season-intro",
    title: "The turning of the Season",
    text: (state) => `Round ${state.round} is over, and with it Season II. Before Round ${state.round + 1}, Season III begins. This walkthrough plays the change for you.`,
    verb: "Start the walkthrough"
  },
  {
    id: "season-end-round",
    title: "End of the round",
    text: (state) => {
      const arrival = state.encounters.activeArrivals[0];
      const name = arrival ? encounterById[arrival.cardId]?.name : undefined;
      if (state.phase === "endRound") return `At the end of every round, waiting Arrivals lose a timer.${name ? ` ${name} has ${arrival.timerTokens} and is about to lose one.` : ""} Then, because this was the last round of the Season, Season III starts.`;
      return `At the end of every round, waiting Arrivals lose a timer.${name ? ` ${name} now has ${arrival.timerTokens} left.` : ""} Round 8 was the last of Season II, so Season III has begun.`;
    },
    target: () => ({ ui: "arrivals" }),
    // The table ends a finished round by itself. Then this step only explains.
    play: (state) => state.phase === "endRound" ? step(state, resolveEndRound, true) : state.season === 3 ? state : null
  },
  {
    id: "season-seed",
    title: "Seeding Season III",
    text: (state) => `Each Steward secretly adds three more cards to the Encounter Deck: near the top, the middle and the bottom. ${state.playerCount > 1 ? "In a real game each player seeds in private and passes the device." : ""}${state.encounters.activeBurdens.length ? " Burdens on the table now use their harsher Season III text." : ""}`,
    verb: "Seed for both Stewards",
    target: () => ({ ui: "seed" }),
    play: (state) => {
      if (state.phase !== "seeding") return null;
      let next: GameState | null = state;
      for (const player of state.players) {
        if (!next || next.phase !== "seeding") break;
        const hand = next.encounters.handsByPlayerId[player.id] ?? [];
        if (hand.length < 3) continue;
        const top = hand.find((id) => encounterById[id]?.type === "arrival") ?? hand[0];
        const rest = hand.filter((id) => id !== top);
        next = step(next, (current) => commitSeasonSeeding(current, player.id, { top, middle: rest[0], bottom: rest[1] }), true);
      }
      return next;
    }
  },
  {
    id: "season-reveal",
    title: "Season III begins",
    text: (state) => `Round ${state.round} turns over its cards. From here on, every Burden strikes at its hardest, so the last four rounds reward a settlement that has kept its Strain low.`,
    target: () => ({ ui: "encounters" }),
    play: (state) => state.phase === "reveal" ? step(state, revealEncounters, true) : state
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another moment.")
];

/** One effect at the head of the queue, settled the way the tour settles everything. */
function settleOne(state: GameState): GameState | null {
  const head = state.pendingEffects[0];
  if (!head) return state;
  const solo = { ...state, pendingEffects: [head] };
  const settled = settleForTour(solo);
  if (!settled) return null;
  return { ...settled, pendingEffects: [...settled.pendingEffects, ...state.pendingEffects.slice(1)] };
}

export const momentTours: Record<string, TourStep[]> = { guided: tourSteps, "showcase-late": lateTour, "showcase-chain": chainTour, "showcase-season": seasonTour };

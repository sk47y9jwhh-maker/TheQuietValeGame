/**
 * The guided tour: a short scripted opening that plays itself, one step per
 * Next. Every move goes through the ordinary rules engine, so what the tour
 * shows is exactly what a player could do. Steps that no longer apply (the
 * player took their own action, say) return null and the tour offers to hand
 * over instead.
 */
import { cancelPendingBurdenWithWarden, useFaceUpBoon, activateTile, canResolveBurden, resolveBurden, commitSeasonSeeding, completeArrival, canCompleteArrival, confirmCostChoice, endCurrentTurn, placeTile, resolveEndRound, revealEncounters } from "../../engine/gameActions";
import { getAlternativeEffectRule, preparePendingEffectQueueHead, resolvePendingEffect, skipPendingEffect } from "../../engine/manualEffects";
import { skipDeckReorder } from "../../engine/deckReorder";
import { getLegalPlacementHexes } from "../../engine/placementRules";
import { getHexNeighbors } from "../../engine/hex";
import { trackLedgerTransition } from "../../engine/ledger";
import { evaluateQuest } from "../../engine/quests";
import { applyStrainToState } from "../../engine/strainRules";
import { calculateFinalScore } from "../../engine/scoring";
import { encounterById } from "../../data/encounters";
import { getBurdenResolutionCost } from "../../data/contentRules";
import { resourceLabels } from "../../data/resources";
import { stewardById } from "../../data/stewards";
import { coreTileById, specialTileById } from "../../data/tiles";
import { getActivatableTileIds } from "../../engine/gameActions";
import type { EffectAdjustment, GameState, PlacedTile } from "../../engine/types";
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
  /** A decision: the options side by side, each with what the engine says would happen. */
  decision?: (state: GameState) => DecisionOption[];
}

/** One option in a decision, with its outcome worked out by the rules engine. */
export interface DecisionOption {
  id: string;
  label: string;
  lines: string[];
  chosen?: boolean;
}

/** A score as it would be printed: a true minus sign, not a hyphen. */
const points = (value: number) => value < 0 ? `−${Math.abs(value)}` : `${value}`;
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
    // An open Target Card leaves the choice to the player: choose as a careful player would.
    const eligible = openTargetOrder(state, pending.targetCardTargetTileIds ?? []);
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

/** Whether a tile's Supported marker will stop the next Strain this round. */
const shielded = (tile?: PlacedTile) => Boolean(tile && (tile.support.passive || tile.support.singleUse) && !tile.support.preventedThisRound);

/**
 * How a careful player picks from an open Target Card: a tile whose Supported
 * marker stops the Strain first (nothing lands), then the least strained, so
 * no tile is pushed towards Overstrain. Ties keep the card's order.
 */
function openTargetOrder(state: GameState, ids: string[]): string[] {
  const tileOf = (id: string) => state.map.placedTiles.find((tile) => tile.instanceId === id);
  return ids.map((id, index) => ({ id, index, tile: tileOf(id) }))
    .sort((a, b) => Number(shielded(b.tile)) - Number(shielded(a.tile)) || (a.tile?.strain ?? 0) - (b.tile?.strain ?? 0) || a.index - b.index)
    .map((entry) => entry.id);
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

/** The guided seeding: an Arrival on top, a Boon in the middle, a Burden at the bottom. */
function seedingPlan(state: GameState): { top: string; middle: string; bottom: string } | null {
  const hand = state.encounters.handsByPlayerId[me(state).id] ?? [];
  const of = (type: string, taken: string[]) => hand.find((id) => encounterById[id]?.type === type && !taken.includes(id));
  const top = of("arrival", []) ?? hand[0];
  const middle = of("boon", [top]) ?? hand.find((id) => id !== top);
  const bottom = of("burden", [top, middle ?? ""]) ?? hand.find((id) => id !== top && id !== middle);
  return top && middle && bottom ? { top, middle, bottom } : null;
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
    text: () => "Press Next and the game plays itself, one step at a time. Each card says what is about to happen and lights up where it happens. Back steps backwards.",
    verb: "Start the tour"
  },
  {
    id: "seed",
    title: "Seeding the Season",
    text: () => "Before Round 1 the Vanguard secretly adds three cards from their hand to the Encounter Deck: one near the top, one in the middle and one near the bottom. Where each card goes decides when it comes out.",
    verb: "Seed these three",
    target: () => ({ ui: "seed" }),
    decision: (state) => {
      const plan = seedingPlan(state);
      if (!plan) return [];
      const name = (id: string) => encounterById[id]?.name ?? "A card";
      return [
        { id: "top", label: `On top: ${name(plan.top)}`, chosen: true, lines: ["An Arrival comes out first, while the Warehouse still holds 15 of everything, so it can be paid at once and unlocks a Special tile early."] },
        { id: "middle", label: `In the middle: ${name(plan.middle)}`, chosen: true, lines: ["A Boon for Lumber Yards is worth more once some are built, so it goes in the middle."] },
        { id: "bottom", label: `At the bottom: ${name(plan.bottom)}`, chosen: true, lines: ["A Burden near the bottom strikes late, when the settlement can absorb it."] },
        { id: "not-top", label: `Not on top: ${name(plan.bottom)}`, lines: ["On top it would strike in Round 1, making the very first tiles cost more."] }
      ];
    },
    play: (state) => {
      const plan = seedingPlan(state);
      if (state.phase !== "seeding" || !plan) return null;
      return step(state, (current) => commitSeasonSeeding(current, me(current).id, plan));
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
    id: "quest",
    title: "The Quest Card",
    skip: (state) => !state.questRun,
    text: (state) => {
      const quest = evaluateQuest(state);
      if (!quest) return "";
      return `Every game draws one Quest Card. This one is ${quest.card.theme}: an easier half, ${quest.card.top.name}, and a harder half, ${quest.card.bottom.name}. Complete either half for +20 Renown. A completed card goes into the Steward’s Ledger, and Golden Tiles and Boons unlock as the Ledger fills.`;
    },
    target: () => ({ ui: "quest" })
  },
  {
    id: "score",
    title: "Score now",
    text: (state) => {
      const score = calculateFinalScore(state);
      const renown = score.printedRenown + score.passiveRenown + score.stewardObjectiveRenown + score.goldenRenown + score.questRenown;
      const penalties = score.burdenPenalty + score.failedArrivalPenalty + score.strainPenalty;
      return `The score at the top is the result if the game ended this moment. Right now that is ${score.population} Population + ${renown} Renown − ${penalties} in penalties = ${points(score.finalScore)}.${score.burdenPenalty ? " A Burden still on the table costs 10 until it is resolved." : ""} Twelve rounds make a game.`;
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
  const renown = score.printedRenown + score.passiveRenown + score.stewardObjectiveRenown + score.goldenRenown + score.questRenown;
  const penalties = score.burdenPenalty + score.failedArrivalPenalty + score.strainPenalty;
  return `${score.population} Population + ${renown} Renown − ${penalties} in penalties = ${points(score.finalScore)}`;
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
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
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
    text: (state) => {
      const ids = openTargetOrder(state, state.pendingEffects[0]?.targetCardTargetTileIds ?? []);
      const pick = state.map.placedTiles.find((tile) => tile.instanceId === ids[0]);
      if (!pick) return "This card leaves the choice open, so a player picks a neighbour.";
      if (shielded(pick)) return `This card leaves the choice open, so a player picks. The ${tileName(state, pick.instanceId)} is Supported: its marker stops this Strain, so nothing lands and the chain ends here. That makes it the safe choice.`;
      return `This card leaves the choice open, so a player picks. No neighbour is Supported, so the walkthrough picks the least strained: ${tileName(state, pick.instanceId)}, which stays furthest from Overstrain.`;
    },
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
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

const seasonTour: TourStep[] = [
  {
    id: "season-intro",
    title: "The turning of the Season",
    text: () => "Round 8 is over, and with it Season II. Before Round 9, Season III begins. This walkthrough plays the change for you.",
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
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
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

// Decision scenes: staged positions where one choice matters. The options are
// worked out by the engine each time the card is shown.

const score = (state: GameState) => points(calculateFinalScore(state).finalScore);
const hexTile = (state: GameState, hexId: string) => state.map.placedTiles.find((tile) => tile.hexIds.includes(hexId));

/** Ends every remaining turn and the round itself, settling what it sets off. */
function finishRound(input: GameState): GameState | null {
  let state: GameState | null = input;
  for (let guard = 0; guard < 10 && state && state.phase !== "reveal" && state.phase !== "seeding"; guard++) {
    if (state.phase === "turns") state = step(state, endCurrentTurn);
    else if (state.phase === "endRound") state = step(state, resolveEndRound);
    else break;
  }
  return state;
}

/** One more Strain lands on a tile. If that Overstrains it, it spreads 1 Strain to its most strained neighbour. */
function strainLands(input: GameState, instanceId: string): { state: GameState; result: "blocked" | "overstrained" | "held" } {
  const before = input.map.placedTiles.find((tile) => tile.instanceId === instanceId);
  let state = applyStrainToState(input, instanceId, 1);
  const after = state.map.placedTiles.find((tile) => tile.instanceId === instanceId);
  if (!before || !after) return { state, result: "held" };
  if (after.strain === before.strain) return { state, result: "blocked" };
  if (after.strain >= 3) {
    const near = new Set(after.hexIds.flatMap((hexId) => getHexNeighbors(hexId)));
    const neighbour = state.map.placedTiles.filter((tile) => tile.instanceId !== instanceId && tile.strain < 3 && tile.hexIds.some((hexId) => near.has(hexId))).sort((a, b) => b.strain - a.strain)[0];
    if (neighbour) state = applyStrainToState(state, neighbour.instanceId, 1);
    return { state, result: "overstrained" };
  }
  return { state, result: "held" };
}

// Welcome them, or build?
const arrivalId = (state: GameState) => state.encounters.activeArrivals[0]?.cardId;
const arrivalOptions = (state: GameState) => {
  const id = arrivalId(state);
  return {
    pay: id ? step(state, (current) => completeArrival(current, id)) : null,
    build: place(state, "c18_common_land", spaceBeside(state, "c18_common_land", "H1"))
  };
};
const arrivalTour: TourStep[] = [
  {
    id: "arrival-intro",
    title: "Welcome them, or build?",
    text: (state) => { const card = arrivalId(state) ? encounterById[arrivalId(state)!] : undefined; return `${card?.name ?? "An Arrival"} has one timer left. If no one pays for them by the end of this round, they leave: the settlement loses 10 points and takes 1 Strain.`; },
    verb: "See the options",
    target: () => ({ ui: "arrivals" })
  },
  {
    id: "arrival-decide",
    title: "Two ways to spend an action",
    text: () => "Building looks better this minute, because a new tile scores at once. But the round has to end, and the Arrival with it. The walkthrough pays them.",
    verb: "Pay and welcome them",
    decision: (state) => {
      const { pay, build } = arrivalOptions(state);
      const now = score(state);
      const id = arrivalId(state);
      const card = id ? encounterById[id] : undefined;
      const reward = card && "rewardSpecialTileIds" in card ? card.rewardSpecialTileIds?.[0] : undefined;
      const payEnd = pay && finishRound(pay);
      const buildEnd = build && finishRound(build);
      return [
        { id: "pay", label: `Pay ${card && "requirementText" in card ? card.requirementText.replace(/^Pay /, "").replace(/\.$/, "") : "their cost"}`, chosen: true, lines: [`Score now ${pay ? score(pay) : now}`, `After the round ${payEnd ? score(payEnd) : "?"}`, reward ? `Unlocks ${specialTileById[reward]?.name ?? "a Special tile"}` : "Unlocks a Special tile"] },
        { id: "build", label: "Build a Common Land instead", lines: [`Score now ${build ? score(build) : now}`, `After the round ${buildEnd ? score(buildEnd) : "?"}`, "The Arrival leaves: −10 and 1 Strain"] }
      ];
    },
    play: (state) => arrivalOptions(state).pay
  },
  {
    id: "arrival-reward",
    title: "A Special tile to build",
    text: () => "Every Arrival unlocks a Special tile. This one is ready to build beside the board: once a round it can pay 2 Herbs to stop 1 Strain from landing.",
    target: () => ({ ui: "arrivals" })
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

// Protect the vulnerable
const cabinOf = (state: GameState) => hexTile(state, "H1");
const protectOptions = (state: GameState) => {
  const tavern = tileAt(state, "c09_tavern");
  const yard = tileAt(state, "c01_lumber_yard");
  return {
    clean: tavern ? step(state, (current) => activateTile(current, current.currentPlayerId, tavern.instanceId)) : null,
    shield: place(state, "c18_common_land", spaceBeside(state, "c18_common_land", "H1")),
    wait: yard ? step(state, (current) => activateTile(current, current.currentPlayerId, yard.instanceId)) : null
  };
};
const protectLines = (state: GameState, option: GameState | null) => {
  const cabin = cabinOf(state);
  if (!option || !cabin) return ["Not possible here"];
  const hit = strainLands(option, cabin.instanceId);
  const effect = hit.result === "blocked" ? "Supported blocks it" : hit.result === "overstrained" ? "it is Overstrained and spreads" : "the Cabin holds";
  return [`Score now ${score(option)}`, `If Strain then lands on the Cabin: ${score(hit.state)}, ${effect}`];
};
const protectTour: TourStep[] = [
  {
    id: "protect-intro",
    title: "One Strain from trouble",
    text: () => "This Cabin carries 2 Strain. One more and it is Overstrained: it stops counting towards the score and spreads Strain to a neighbour.",
    verb: "Next",
    target: (state) => { const cabin = cabinOf(state); return cabin ? { hexIds: [cabin.hexIds[0]], label: "2 Strain" } : null; }
  },
  {
    id: "protect-threat",
    title: "Trouble is coming",
    text: () => "Houses, Not Homes is still on the table. When Season II begins next round, it strikes the Housing again. The Cabin is the obvious target.",
    target: () => ({ ui: "encounters" })
  },
  {
    id: "protect-decide",
    title: "Clean it, shield it, or leave it?",
    text: () => "The Tavern removes a Strain today, which helps the score now. But a hit is coming, and Supported stops the next Strain outright, then refreshes every round while the Common Land stands. The walkthrough builds the Common Land.",
    verb: "Build the Common Land",
    decision: (state) => {
      const { clean, shield, wait } = protectOptions(state);
      return [
        { id: "clean", label: "Clean it with the Tavern", lines: protectLines(state, clean) },
        { id: "shield", label: "Shield it with a Common Land beside it", chosen: true, lines: protectLines(state, shield) },
        { id: "wait", label: "Leave it and produce Wood instead", lines: protectLines(state, wait) }
      ];
    },
    play: (state) => protectOptions(state).shield
  },
  {
    id: "protect-test",
    title: "The shield holds",
    text: () => "Now let a Strain land on the Cabin, as the Burden will. Supported takes the hit, and the Cabin stays at 2.",
    verb: "Let a Strain land",
    target: (state) => { const cabin = cabinOf(state); return cabin ? { hexIds: [cabin.hexIds[0]], label: "Supported" } : null; },
    play: (state) => {
      const cabin = cabinOf(state);
      if (!cabin) return null;
      const hit = strainLands(state, cabin.instanceId);
      const message = hit.result === "blocked" ? "Supported prevented 1 Strain on the Cabin." : "1 Strain landed on the Cabin.";
      return { ...hit.state, log: [{ id: `log_tour_${state.log.length + 1}`, round: state.round, message }, ...hit.state.log] };
    }
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

// Make the Boon count
const boonId = (state: GameState) => state.encounters.faceUpBoons[0]?.cardId;
const yard = (state: GameState) => tileAt(state, "c01_lumber_yard");
function produceWithBoon(state: GameState | null): GameState | null {
  const id = state && boonId(state);
  const lumber = state && yard(state);
  if (!state || !id || !lumber) return null;
  const used = step(state, (current) => useFaceUpBoon(current, id));
  return used ? step(used, (current) => activateTile(current, current.currentPlayerId, lumber.instanceId)) : null;
}
const boonOptions = (state: GameState) => ({
  now: produceWithBoon(state),
  later: produceWithBoon(place(state, "c05_cabin", spaceBeside(state, "c05_cabin", "H1")))
});
const woodLine = (state: GameState, option: GameState | null, spent: number) => {
  if (!option) return ["Not possible here"];
  const uncapped = produceWithBoon({ ...state, warehouse: { ...state.warehouse, wood: 0 } });
  const gained = uncapped ? uncapped.warehouse.wood : 0;
  const lost = Math.max(0, state.warehouse.wood - spent + gained - option.warehouse.wood);
  return [`Wood ${state.warehouse.wood}${spent ? `, ${state.warehouse.wood - spent} after building` : ""}, then ${option.warehouse.wood}`, lost ? `${lost} Wood lost to the cap of 15` : "Nothing lost to the cap"];
};
const boonTour: TourStep[] = [
  {
    id: "boon-intro",
    title: "A Boon, ready to use",
    text: (state) => `${boonId(state) ? encounterById[boonId(state)!]?.name : "A Boon"} has one use left: it adds 2 Wood to a Lumber production. Using a Boon costs no action, so the only question is when.`,
    verb: "Next",
    target: () => ({ ui: "encounters" })
  },
  {
    id: "boon-full",
    title: "The Warehouse is nearly full",
    text: (state) => `There are ${state.warehouse.wood} Wood in the Warehouse, and it holds at most 15 of each resource. Anything over the cap is lost.`,
    target: () => ({ ui: "warehouse" })
  },
  {
    id: "boon-decide",
    title: "Use it now, or build first?",
    text: () => "Producing now would overflow the Warehouse, wasting part of the Boon. Building a Cabin first spends Wood, so the same production then fits. The walkthrough builds, then produces with the Boon.",
    verb: "Build, then produce",
    decision: (state) => {
      const { now, later } = boonOptions(state);
      return [
        { id: "now", label: "Use it now with the Lumber Yards", lines: woodLine(state, now, 0) },
        { id: "later", label: "Build a Cabin first, then use it", chosen: true, lines: woodLine(state, later, 2) }
      ];
    },
    play: (state) => boonOptions(state).later
  },
  {
    id: "boon-done",
    title: "Every Wood counted",
    text: (state) => `The Cabin is built, both Lumber Yards produced together, and the Boon added its Wood in full. The Warehouse holds ${state.warehouse.wood} Wood with nothing wasted.`,
    target: (state) => { const hexIds = state.map.placedTiles.filter((tile) => tile.tileId === "c01_lumber_yard").map((tile) => tile.hexIds[0]); return hexIds.length ? { hexIds, label: "Produced" } : null; }
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

// A Special tile's power
const atelier = (state: GameState) => tileAt(state, "special_atelier_workshop");
function useAtelier(state: GameState, hexId: string): GameState | null {
  const workshop = atelier(state);
  const target = hexTile(state, hexId);
  if (!workshop || !target) return null;
  const started = activateTile(state, state.currentPlayerId, workshop.instanceId);
  if (started === state) return null;
  const ready = preparePendingEffectQueueHead(started);
  const head = ready.pendingEffects[0];
  if (!head) return null;
  const done = resolvePendingEffect(ready, { supportTileIds: [target.instanceId], tileStrainDeltas: { [target.instanceId]: -target.strain } });
  if (done.pendingEffects.some((effect) => effect.id === head.id)) return null;
  const settled = settleForTour(done);
  return settled ? trackLedgerTransition(state, settled) : null;
}
const specialTour: TourStep[] = [
  {
    id: "special-intro",
    title: "A Special tile’s power",
    text: () => "The Atelier Workshop was unlocked by welcoming an Arrival. Once a round, for 1 Wood and 1 Metal, it removes all Strain from one tile, and that tile gains Supported.",
    verb: "Next",
    target: (state) => { const workshop = atelier(state); return workshop ? { hexIds: [workshop.hexIds[0]], label: "Atelier" } : null; }
  },
  {
    id: "special-damage",
    title: "Two tiles need help",
    text: () => "The Fine Cabin is Overstrained with 3 Strain: it scores nothing, and its Strain costs 30 points at the end. The Path carries 1 Strain. The power works once a round.",
    target: (state) => { const hexIds = state.map.placedTiles.filter((tile) => tile.strain > 0).map((tile) => tile.hexIds[0]); return hexIds.length ? { hexIds, label: "Strain" } : null; }
  },
  {
    id: "special-decide",
    title: "Which tile is it worth?",
    text: () => "Clearing the Path removes its 1 Strain, worth 10 points. Clearing the Fine Cabin removes all 3 of its Strain, worth 30 points, brings its Population back into the score, and Supported shields it from the next hit. The walkthrough restores the Cabin.",
    verb: "Restore the Fine Cabin",
    decision: (state) => {
      const now = score(state);
      const cabin = useAtelier(state, "H1");
      const path = useAtelier(state, "F1");
      return [
        { id: "cabin", label: "The Overstrained Fine Cabin", chosen: true, lines: [`Score ${now}, then ${cabin ? score(cabin) : "?"}`, "It counts again, and gains Supported"] },
        { id: "path", label: "The Path with 1 Strain", lines: [`Score ${now}, then ${path ? score(path) : "?"}`, "The Cabin stays Overstrained"] }
      ];
    },
    play: (state) => useAtelier(state, "H1")
  },
  {
    id: "special-done",
    title: "Back in the settlement",
    text: (state) => `The Fine Cabin is clear of Strain and Supported. The score is now ${score(state)}.`,
    target: (state) => { const cabin = hexTile(state, "H1"); return cabin ? { hexIds: [cabin.hexIds[0]], label: "Restored" } : null; }
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

// Buy a little time
const timeArrival = (state: GameState) => state.encounters.activeArrivals[0];
const camp = (state: GameState) => tileAt(state, "c20_dig_site");
function buyTime(state: GameState): GameState | null {
  const boon = boonId(state);
  const arrival = timeArrival(state);
  const salvage = camp(state);
  if (!boon || !arrival || !salvage) return null;
  const used = useFaceUpBoon(state, boon);
  if (used === state) return null;
  const ready = preparePendingEffectQueueHead(used);
  const head = ready.pendingEffects[0];
  const kept = head ? resolvePendingEffect(ready, { arrivalTimerDeltas: { [arrival.cardId]: 1 } }) : ready;
  if (head && kept.pendingEffects.some((effect) => effect.id === head.id)) return null;
  const settled = settleForTour(kept);
  return settled ? step(trackLedgerTransition(state, settled), (current) => activateTile(current, current.currentPlayerId, salvage.instanceId)) : null;
}
const letGo = (state: GameState) => { const salvage = camp(state); return salvage ? step(state, (current) => activateTile(current, current.currentPlayerId, salvage.instanceId)) : null; };
const timeTour: TourStep[] = [
  {
    id: "time-intro",
    title: "Buy a little time",
    text: (state) => { const arrival = timeArrival(state); const card = arrival ? encounterById[arrival.cardId] : undefined; return `${card?.name ?? "An Arrival"} is on their last timer and ${costText(state)}. The Warehouse has no Metal, and the Vanguard has one action left this round.`; },
    verb: "Next",
    target: () => ({ ui: "arrivals" })
  },
  {
    id: "time-decide",
    title: "Let them go, or keep them waiting?",
    text: () => "A Boon costs no action. Spending A Little Time now keeps the Arrival for one more round, and the last action produces the Metal they need. The walkthrough uses the Boon.",
    verb: "Use the Boon, then produce",
    decision: (state) => {
      const kept = buyTime(state);
      const gone = letGo(state);
      const keptEnd = kept && finishRound(kept);
      const goneEnd = gone && finishRound(gone);
      const name = timeArrival(state) ? encounterById[timeArrival(state)!.cardId]?.name ?? "The Arrival" : "The Arrival";
      return [
        { id: "keep", label: "Use A Little Time, then produce Metal", chosen: true, lines: [`After the round ${keptEnd ? score(keptEnd) : "?"}`, `${name} stays, with Metal ready to pay`] },
        { id: "go", label: "Produce Metal and let them go", lines: [`After the round ${goneEnd ? score(goneEnd) : "?"}`, `${name} leaves: −10 and 1 Strain`] }
      ];
    },
    play: (state) => buyTime(state)
  },
  {
    id: "time-round",
    title: "Through the end of the round",
    text: (state) => { const arrival = timeArrival(state); return `The Arrival now has ${arrival?.timerTokens ?? 2} timers and the Warehouse holds ${state.warehouse.metal} Metal. When the round ends they lose a timer, but they stay, ready to be welcomed next round.`; },
    verb: "End the round",
    target: () => ({ ui: "arrivals" }),
    play: (state) => finishRound(state)
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

// Set down the right Burden
const guild = (state: GameState) => tileAt(state, "special_adventurers_guild");
const burdenCost = (state: GameState, id: string) => {
  const cost = getBurdenResolutionCost(id, state.season);
  const entry = cost && Object.entries(cost).find(([, amount]) => amount > 0);
  return entry ? { resource: entry[0] as keyof typeof resourceLabels, amount: entry[1] as number } : undefined;
};
const burdenLine = (state: GameState, id: string) => { const cost = burdenCost(state, id); return cost ? `${cost.amount} ${resourceLabels[cost.resource]} to resolve, and the Warehouse has ${state.warehouse[cost.resource]}` : "Its cost to resolve is printed on the card"; };
const affordable = (state: GameState, id: string) => { const cost = burdenCost(state, id); return !!cost && state.warehouse[cost.resource] >= cost.amount; };
function useGuild(state: GameState, burdenId: string): GameState | null {
  const tile = guild(state);
  if (!tile) return null;
  const started = activateTile(state, state.currentPlayerId, tile.instanceId);
  if (started === state) return null;
  const ready = preparePendingEffectQueueHead(started);
  const head = ready.pendingEffects[0];
  if (!head) return null;
  const done = resolvePendingEffect(ready, { resolvedBurdenIds: [burdenId] });
  if (done.pendingEffects.some((effect) => effect.id === head.id)) return null;
  const settled = settleForTour(done);
  return settled ? trackLedgerTransition(state, settled) : null;
}
const guildChoice = (state: GameState) => {
  const [first, second] = state.encounters.activeBurdens;
  // Clear the one the Warehouse cannot pay, and pay the other.
  return first && second && affordable(state, first) && !affordable(state, second) ? { clear: second, pay: first } : { clear: first, pay: second };
};
const guildTour: TourStep[] = [
  {
    id: "guild-intro",
    title: "Set down the right Burden",
    text: () => "The Adventurers' Guild is a Special tile. Once per Season, activating it resolves one active Burden without paying the resources it asks for.",
    verb: "Next",
    target: (state) => { const tile = guild(state); return tile ? { hexIds: [tile.hexIds[0]], label: "Guild" } : null; }
  },
  {
    id: "guild-burdens",
    title: "Two Burdens on the table",
    text: (state) => `Each active Burden costs 10 points at the end, and strikes again when a new Season begins. ${state.encounters.activeBurdens.map((id) => `${encounterById[id]?.name ?? "A Burden"} needs ${burdenCost(state, id) ? `${burdenCost(state, id)!.amount} ${resourceLabels[burdenCost(state, id)!.resource]}` : "its cost"}`).join(", and ")} to resolve.`,
    target: () => ({ ui: "encounters" })
  },
  {
    id: "guild-decide",
    title: "Which one should the Guild take?",
    text: (state) => { const { clear, pay } = guildChoice(state); return `Both are worth the same 10 points. The difference is what is left behind. The Warehouse can pay for ${encounterById[pay ?? ""]?.name ?? "one"}, but not for ${encounterById[clear ?? ""]?.name ?? "the other"}. So the Guild takes the one the Warehouse cannot pay.`; },
    verb: "Activate the Guild",
    decision: (state) => {
      const { clear, pay } = guildChoice(state);
      if (!clear || !pay) return [];
      const name = (id: string) => encounterById[id]?.name ?? "A Burden";
      return [
        { id: "clear", label: `Guild clears ${name(clear)}`, chosen: true, lines: [`Left: ${name(pay)}`, burdenLine(state, pay), "Both can be gone this turn"] },
        { id: "other", label: `Guild clears ${name(pay)}`, lines: [`Left: ${name(clear)}`, burdenLine(state, clear), "It stays, costing 10 at the end"] }
      ];
    },
    play: (state) => { const { clear } = guildChoice(state); return clear ? useGuild(state, clear) : null; }
  },
  {
    id: "guild-pay",
    title: "Pay for the other",
    text: (state) => { const id = state.encounters.activeBurdens[0]; return `${id ? encounterById[id]?.name ?? "The other Burden" : "The other Burden"} is resolved the ordinary way: an Interact action and its cost, paid from the Warehouse.`; },
    verb: "Resolve it",
    target: () => ({ ui: "encounters" }),
    play: (state) => { const id = state.encounters.activeBurdens.find((candidate) => canResolveBurden(state, candidate).ok); return id ? step(state, (current) => resolveBurden(current, id)) : null; }
  },
  {
    id: "guild-done",
    title: "Both Burdens set down",
    text: (state) => `Neither Burden will cost points at the end, or strike again next Season. The score is now ${score(state)}.`,
    target: () => ({ ui: "score" })
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

// A Warden's response
function wardenShield(state: GameState, instanceId: string): GameState | null {
  const cancelled = cancelPendingBurdenWithWarden(state);
  if (cancelled === state) return null;
  const ready = preparePendingEffectQueueHead(cancelled);
  const head = ready.pendingEffects[0];
  if (!head) return null;
  const done = resolvePendingEffect(ready, { supportTileIds: [instanceId] });
  if (done.pendingEffects.some((effect) => effect.id === head.id)) return null;
  const settled = settleForTour(done);
  return settled ? trackLedgerTransition(state, settled) : null;
}
/** The tile the second Burden would strain if both apply as they are. */
function riverTarget(state: GameState) {
  const applied = settleForTour(state);
  if (!applied) return undefined;
  return state.map.placedTiles.find((tile) => (applied.map.placedTiles.find((after) => after.instanceId === tile.instanceId)?.strain ?? 0) > tile.strain);
}
const wardenTour: TourStep[] = [
  {
    id: "warden-intro",
    title: "A Warden’s response",
    text: (state) => `This is a real game. Round ${state.round} reveals two Burdens at once: ${state.pendingEffects.map((effect) => effect.sourceName).filter(Boolean).join(", then ")}. Once per Season, the Warden can cancel a Burden as it is revealed, then remove 1 Strain or place Supported on any tile.`,
    verb: "Next",
    target: () => ({ ui: "encounters" })
  },
  {
    id: "warden-river",
    title: "See where the second one strikes",
    text: (state) => { const tile = riverTarget(state); return `The second Burden puts 1 Strain on a tile beside the river. The Target Card has picked ${tile ? tileName(state, tile.instanceId) : "a riverside tile"}.`; },
    target: (state) => { const tile = riverTarget(state); return tile ? { hexIds: [tile.hexIds[0]], label: "Strain lands here" } : null; }
  },
  {
    id: "warden-decide",
    title: "Use the power, and where?",
    text: () => "The Warden cancels the first Burden either way. The real choice is where Supported goes. Put it where the next Strain will land, and it stops that Strain too. The walkthrough shields the riverside tile.",
    verb: "Use the Warden’s power",
    decision: (state) => {
      const target = riverTarget(state);
      const other = state.map.placedTiles.find((tile) => tile.instanceId !== target?.instanceId && tile.tileId.includes("cabin"));
      const both = settleForTour(state);
      const shielded = target ? wardenShield(state, target.instanceId) : null;
      const elsewhere = other ? wardenShield(state, other.instanceId) : null;
      return [
        { id: "both", label: "Let both Burdens apply", lines: [`Score ${both ? score(both) : "?"}`, "The first is paid, and the river strains the tile"] },
        { id: "shield", label: `Warden, with Supported on ${target ? tileName(state, target.instanceId) : "the riverside tile"}`, chosen: true, lines: [`Score ${shielded ? score(shielded) : "?"}`, "The first is cancelled, and Supported blocks the river"] },
        { id: "elsewhere", label: `Warden, with Supported on ${other ? tileName(state, other.instanceId) : "another tile"}`, lines: [`Score ${elsewhere ? score(elsewhere) : "?"}`, "The first is cancelled, but the river still strains its tile"] }
      ];
    },
    play: (state) => { const target = riverTarget(state); return target ? wardenShield(state, target.instanceId) : null; }
  },
  {
    id: "warden-done",
    title: "One power, two Burdens answered",
    text: (state) => `The first Burden never applied, and the river's Strain was stopped by Supported. The score is ${score(state)}.`,
    target: () => ({ ui: "score" })
  },
  handover("That is the end of this walkthrough. Start a real game of your own, or watch another scene.")
];

export const momentTours: Record<string, TourStep[]> = {
  "decide-time": timeTour,
  "decide-guild": guildTour,
  "decide-warden": wardenTour,
  "decide-arrival": arrivalTour,
  "decide-protect": protectTour,
  "decide-boon": boonTour,
  "decide-special": specialTour,
  guided: tourSteps, "showcase-late": lateTour, "showcase-chain": chainTour, "showcase-season": seasonTour };

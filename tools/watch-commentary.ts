/**
 * Captions and commentary for the "Watch a demo" game. Every number is read
 * from the engine's states, so the words always match the board. The pauses
 * are found by looking at what happened: the first time a rule matters, a
 * decision with a real alternative, an objective reached, a Season turning.
 */
import { calculateFinalScore } from "../src/engine/scoring";
import { evaluateQuest } from "../src/engine/quests";
import { getHexNeighbors } from "../src/engine/hex";
import { getAlternativeEffectRule, preparePendingEffectQueueHead } from "../src/engine/manualEffects";
import { getBurdenResolutionCost } from "../src/data/contentRules";
import { encounterById } from "../src/data/encounters";
import { resourceLabels, resources } from "../src/data/resources";
import { stewardById } from "../src/data/stewards";
import { coreTileById, specialTileById } from "../src/data/tiles";
import type { WatchMove } from "../src/app/watch/watchMoves";
import type { DemoBeat, DemoOption, DemoPause } from "../src/app/watch/watchTypes";
import type { CoachTarget } from "../src/components/table/TableCoach";
import type { EffectAdjustment, GameState, PlacedTile, ResourceType } from "../src/engine/types";

export interface RecordedBeat {
  type: "seed" | "reveal" | "endRound" | "endTurn" | "action" | "effect";
  player: string;
  moves: WatchMove[];
  before: GameState;
  after: GameState;
  hand?: string[];
  options?: { moves: WatchMove[]; value: number; state: GameState }[];
  effectId?: string;
  ruleId?: string;
  source?: string;
  choices?: EffectAdjustment[];
}

// ---------------------------------------------------------------- words

const stewardOf = (state: GameState, playerId: string) => stewardById[state.players.find((player) => player.id === playerId)?.stewardId ?? ""];
const who = (state: GameState, playerId: string) => stewardOf(state, playerId)?.name ?? "A Steward";
const cardName = (id: string) => encounterById[id]?.name ?? "a card";
const seasonName = (season: number) => ["", "I", "II", "III"][season];
const points = (value: number) => value < 0 ? `−${Math.abs(value)}` : `${value}`;
const list = (items: string[]) => items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const counted = ["", "once", "twice", "three times", "four times", "five times"];
const numberWord = ["no", "one", "two", "three", "four", "five", "six"];

function tileName(tile: PlacedTile | undefined): string {
  if (!tile) return "tile";
  const core = coreTileById[tile.tileId];
  if (core) return tile.side === "upgraded" ? core.upgraded.name : core.basic.name;
  return specialTileById[tile.tileId]?.name ?? "Special tile";
}
/** "a Cabin", "an Inn", "The Waystation" */
const aTile = (name: string) => /^The /.test(name) || /[^s]s$/.test(name) ? name : `${/^[AEIOU]/.test(name) ? "an" : "a"} ${name}`;
/** "the Cabin", "The Waystation" */
const theTile = (name: string) => /^The /.test(name) ? name : `the ${name}`;
const tileById = (state: GameState, id: string) => state.map.placedTiles.find((tile) => tile.instanceId === id);

function amounts(change: Partial<Record<ResourceType, number>>, sign: 1 | -1 = 1): string {
  return list(resources.filter((resource) => (change[resource] ?? 0) * sign > 0).map((resource) => `${Math.abs(change[resource]!)} ${resourceLabels[resource]}`));
}
function warehouseChange(before: GameState, after: GameState): Partial<Record<ResourceType, number>> {
  const change: Partial<Record<ResourceType, number>> = {};
  for (const resource of resources) { const delta = after.warehouse[resource] - before.warehouse[resource]; if (delta) change[resource] = delta; }
  return change;
}
const newTiles = (before: GameState, after: GameState) => after.map.placedTiles.filter((tile) => !before.map.placedTiles.some((old) => old.instanceId === tile.instanceId));
const strainChanges = (before: GameState, after: GameState) => after.map.placedTiles.map((tile) => ({ tile, delta: tile.strain - (tileById(before, tile.instanceId)?.strain ?? 0) })).filter((entry) => entry.delta !== 0);
const score = (state: GameState) => calculateFinalScore(state).finalScore;
const revealedIds = (before: GameState, after: GameState) => before.encounters.deck.filter((id) => !after.encounters.deck.includes(id));
const leftArrivals = (before: GameState, after: GameState) => before.encounters.activeArrivals.filter((arrival) => !after.encounters.activeArrivals.some((a) => a.cardId === arrival.cardId) && !after.encounters.completedArrivals.some((c) => c.cardId === arrival.cardId)).map((arrival) => arrival.cardId);

/** "1 Strain on the Cabin and 1 on each of two Paths" */
function strainLine(before: GameState, after: GameState): string {
  const groups = new Map<string, { name: string; delta: number; count: number }>();
  for (const { tile, delta } of strainChanges(before, after)) {
    const key = `${tileName(tile)}:${delta}`;
    const entry = groups.get(key) ?? { name: tileName(tile), delta, count: 0 };
    entry.count++;
    groups.set(key, entry);
  }
  return list([...groups.values()].map(({ name, delta, count }) => {
    const amount = `${Math.abs(delta)} Strain ${delta > 0 ? "on" : "off"}`;
    return count > 1 ? `${amount} each of ${numberWord[count] ?? count} ${name.replace(/^The /, "")}s` : `${amount} ${theTile(name)}`;
  }));
}
function supportLine(before: GameState, after: GameState): string {
  const gained = after.map.placedTiles.filter((tile) => (tile.support.passive || tile.support.singleUse) && !(tileById(before, tile.instanceId)?.support.passive || tileById(before, tile.instanceId)?.support.singleUse));
  return gained.length ? `${list(gained.map((tile) => theTile(tileName(tile))))} ${gained.length === 1 ? "gains" : "gain"} Supported` : "";
}
/** Everything a step changed that a viewer can see, as one clause. */
function changeLine(before: GameState, after: GameState): string {
  const change = warehouseChange(before, after);
  return [amounts(change, 1) && `+${amounts(change, 1)}`, amounts(change, -1) && `−${amounts(change, -1)}`, strainLine(before, after), supportLine(before, after)].filter(Boolean).join(", ");
}

function producedTogether(state: GameState, instanceId: string): boolean {
  const tile = tileById(state, instanceId);
  if (!tile) return false;
  const near = new Set(tile.hexIds.flatMap((hex) => getHexNeighbors(hex)));
  return state.map.placedTiles.some((other) => other.instanceId !== instanceId && other.tileId === tile.tileId && other.hexIds.some((hex) => near.has(hex)));
}
const linkedGroup = (state: GameState, instanceId: string) => {
  const tile = tileById(state, instanceId);
  return tile ? state.map.placedTiles.filter((other) => other.tileId === tile.tileId) : [];
};

// ---------------------------------------------------------------- captions

function caption(beat: RecordedBeat): string {
  const { before, after } = beat;
  const name = who(before, beat.player);
  const first = beat.moves[0];
  switch (beat.type) {
    case "seed": return `${name} secretly seeds three cards into the Encounter Deck.`;
    case "reveal": {
      const ids = revealedIds(before, after);
      const opening = `Round ${after.round}${after.round % 4 === 1 ? `: Season ${seasonName(after.season)} begins` : ""}.`;
      return `${opening} ${ids.length ? `Revealed: ${list(ids.map((id) => `${cardName(id)} (${encounterById[id]?.type ?? "card"})`))}.` : "No new encounters."}`;
    }
    case "endRound": {
      if (after.phase === "gameEnd") return "The twelfth round ends, and with it the game.";
      const gone = leftArrivals(before, after);
      const strain = strainLine(before, after);
      if (gone.length) return `End of round ${before.round}. ${list(gone.map(cardName))} ${gone.length === 1 ? "was" : "were"} not welcomed in time and ${gone.length === 1 ? "leaves" : "leave"}: −10 each${strain ? `, and ${strain}` : ""}.`;
      return `End of round ${before.round}.${before.encounters.activeArrivals.length ? " Waiting Arrivals lose a timer." : ""}${strain ? ` ${strain}.` : ""}`;
    }
    case "endTurn": {
      const next = after.phase === "turns" && after.currentPlayerId !== beat.player ? ` ${who(after, after.currentPlayerId)}’s turn.` : "";
      const order = before.players.map((player) => player.id);
      const finalTurn = before.round === 12 && order.indexOf(beat.player) === order.length - 1;
      if (finalTurn && before.actionsRemaining) return `${name} ends the game’s last turn: nothing left would add a point.`;
      const unused = before.actionsRemaining ? ` with ${numberWord[before.actionsRemaining]} action${before.actionsRemaining === 1 ? "" : "s"} unused` : "";
      return `${name} ends the turn${unused}.${next}`;
    }
    case "effect": {
      const paid = amounts(warehouseChange(before, after), -1);
      const strain = strainLine(before, after);
      const done = [paid && `the table pays ${paid}`, strain].filter(Boolean).join(", and ");
      return `${beat.source}: ${done || "no effect this time"}.`;
    }
    case "action": return actionCaption(beat, name);
  }
}

function actionCaption(beat: RecordedBeat, name: string): string {
  const { before, after } = beat;
  const first = beat.moves[0];
  const change = warehouseChange(before, after);
  const spent = amounts(change, -1);
  const placed = newTiles(before, after);
  const extra = [strainLine(before, after), supportLine(before, after)].filter(Boolean).join(", ");
  const tail = extra ? `. ${extra.charAt(0).toUpperCase()}${extra.slice(1)}.` : ".";
  if (first.k === "power") {
    const tile = placed[0];
    return `${name} uses the ${stewardOf(before, beat.player)?.name}’s Season power: ${aTile(tileName(tile))} for no action${spent ? `, paying ${spent}` : ""}${tail}`;
  }
  if (first.k === "place") return `${name} builds ${aTile(tileName(placed[0]))}${spent ? ` for ${spent}` : ", free"}${tail}`;
  if (first.k === "upgrade") {
    const tile = tileById(after, first.id);
    const core = tile && coreTileById[tile.tileId];
    const makes = core?.upgraded.production ? amounts(core.upgraded.production) : "";
    return `${name} upgrades ${theTile(tileName(tileById(before, first.id)))} to ${aTile(tileName(tile))}${spent ? ` for ${spent}` : ", free"}${makes ? `: it now makes ${makes}` : ""}${tail}`;
  }
  if (first.k === "activate") {
    const times = beat.moves.filter((move) => move.k === "activate").length;
    const linked = producedTogether(before, first.id);
    const what = changeLine(before, after);
    return `${name} activates ${theTile(tileName(tileById(before, first.id)))}${times > 1 ? ` ${counted[times]}` : ""}${linked ? " (Linked)" : ""}: ${what || "no change"}.`;
  }
  if (first.k === "arrival") {
    const reward = after.encounters.completedArrivals.find((c) => c.cardId === first.id)?.specialTileIds[0];
    return `${name} welcomes ${cardName(first.id)} for ${spent || "their cost"}${reward ? `, unlocking ${specialTileById[reward]?.name ?? "a Special tile"}` : ""}.`;
  }
  if (first.k === "burden") return `${name} resolves ${cardName(first.id)} for ${spent || "its cost"}. It is set aside for good.`;
  if (first.k === "boon") {
    const second = beat.moves.find((move, index) => index > 0 && move.k === "activate");
    return `${name} uses ${cardName(first.id)} (no action)${second && second.k === "activate" ? ` and activates ${theTile(tileName(tileById(before, second.id)))}` : ""}: ${changeLine(before, after) || "ready for later"}.`;
  }
  return `${name} takes an action.`;
}

/** Where the board should look for this step. */
function targetOf(beat: RecordedBeat): CoachTarget | undefined {
  const { before, after } = beat;
  const first = beat.moves[0];
  if (!first) return undefined;
  const hexOf = (state: GameState, id: string) => tileById(state, id)?.hexIds[0];
  if (beat.type === "action") {
    if (first.k === "place" || first.k === "power") { const tile = newTiles(before, after)[0]; return tile ? { hexIds: [tile.hexIds[0]], label: tileName(tile) } : undefined; }
    if (first.k === "upgrade") { const hex = hexOf(after, first.id); return hex ? { hexIds: [hex], label: "Upgraded" } : undefined; }
    if (first.k === "activate") { const group = producedTogether(before, first.id) ? linkedGroup(before, first.id).map((tile) => tile.hexIds[0]) : [hexOf(before, first.id)!]; return { hexIds: group.filter(Boolean), label: "Activated" }; }
    if (first.k === "arrival") return { ui: "arrivals" };
    if (first.k === "burden") return { ui: "encounters" };
  }
  const strained = strainChanges(before, after).filter((entry) => entry.delta > 0).map((entry) => entry.tile.hexIds[0]);
  if (strained.length) return { hexIds: strained, label: "Strain" };
  if (beat.type === "reveal") return { ui: "encounters" };
  return undefined;
}

// ---------------------------------------------------------------- options

/** A short name for a candidate action. */
function optionLabel(state: GameState, moves: WatchMove[]): string {
  const first = moves[0];
  const last = moves[moves.length - 1];
  if (first.k === "power" && last.k === "place") return `Use the Season power for ${aTile(coreTileById[last.tile]?.basic.name ?? "tile")}`;
  if (first.k === "place") return `Build ${aTile(coreTileById[first.tile]?.basic.name ?? specialTileById[first.tile]?.name ?? "tile")}`;
  if (first.k === "upgrade") return `Upgrade ${theTile(tileName(tileById(state, first.id)))}`;
  if (first.k === "activate") return `Activate ${theTile(tileName(tileById(state, first.id)))}`;
  if (first.k === "arrival") return `Welcome ${cardName(first.id)}`;
  if (first.k === "burden") return `Resolve ${cardName(first.id)}`;
  if (first.k === "boon") return `Use ${cardName(first.id)}`;
  return "Another action";
}
function optionLines(before: GameState, after: GameState): string[] {
  const change = warehouseChange(before, after);
  const spent = amounts(change, -1);
  const gained = amounts(change, 1);
  return [spent ? `Costs ${spent}` : gained ? `Makes ${gained}` : "Costs nothing", `Score now ${points(score(after))}`];
}
/** The chosen action and the best different alternatives the player weighed. */
function weighed(beat: RecordedBeat, count = 2, include?: (moves: WatchMove[]) => boolean): DemoOption[] {
  const chosen = { label: optionLabel(beat.before, beat.moves), lines: optionLines(beat.before, beat.after), chosen: true };
  const seen = new Set([chosen.label.replace(/^(Build|Activate|Upgrade) .*/, "$1")]);
  const others: DemoOption[] = [];
  for (const option of beat.options ?? []) {
    const label = optionLabel(beat.before, option.moves);
    const kind = label.replace(/^(Build|Activate|Upgrade) .*/, "$1");
    if (label === chosen.label || seen.has(kind) && !include?.(option.moves)) continue;
    seen.add(kind);
    others.push({ label, lines: optionLines(beat.before, option.state) });
    if (others.length >= count) break;
  }
  return [chosen, ...others];
}

// ---------------------------------------------------------------- the demo

interface Context { start: GameState; final: GameState; beats: RecordedBeat[]; seen: Set<string> }

export function authorDemo(start: GameState, recorded: RecordedBeat[], final: GameState): DemoBeat[] {
  const context: Context = { start, final, beats: recorded, seen: new Set() };
  const steps: DemoBeat[] = [{ moves: [], caption: "Two Stewards sit down to build The Quiet Vale together.", player: start.currentPlayerId, round: 1, pause: introPause(start) }];
  for (let index = 0; index < recorded.length; index++) {
    const beat = recorded[index];
    const pause = pauseFor(beat, index, context);
    const step: DemoBeat = { moves: [...beat.moves], caption: caption(beat), player: beat.player, round: beat.after.phase === "gameEnd" ? 12 : beat.before.phase === "endRound" ? beat.before.round : beat.after.round };
    const target = pause?.target ?? targetOf(beat);
    if (target) step.target = target;
    if (pause) step.pause = pause;
    // The same tile activated again straight away plays as one step.
    const previous = steps[steps.length - 1];
    const prior = recorded[index - 1];
    if (!pause && !previous.pause && prior && beat.type === "action" && prior.type === "action" && prior.player === beat.player
      && beat.moves[0].k === "activate" && prior.moves.every((move) => move.k === "activate" || move.k === "effect") && prior.moves[0].k === "activate" && prior.moves[0].id === beat.moves[0].id) {
      const merged: RecordedBeat = { ...beat, before: firstOfRun(recorded, index).before, moves: [...previous.moves, ...beat.moves] };
      previous.moves = merged.moves;
      previous.caption = caption(merged);
      continue;
    }
    steps.push(step);
  }
  steps[steps.length - 1].pause = finalePause(final);
  return steps;
}

/** The first step of a run of repeated activations. */
function firstOfRun(beats: RecordedBeat[], index: number): RecordedBeat {
  let at = index;
  while (at > 0 && beats[at - 1].type === "action" && beats[at - 1].player === beats[index].player && beats[at - 1].moves[0].k === "activate" && beats[at - 1].moves[0].k === beats[index].moves[0].k && (beats[at - 1].moves[0] as { id: string }).id === (beats[index].moves[0] as { id: string }).id) at--;
  return beats[at];
}

function introPause(start: GameState): DemoPause {
  const quest = evaluateQuest(start);
  return {
    at: "before",
    kind: "rule",
    title: "Two Stewards, one settlement",
    text: `The Quiet Vale is co-operative: the Vanguard and the Knight build one settlement and share one Warehouse, which starts with ${start.warehouse.wood} of each resource. Twelve rounds make three Seasons. Each turn a Steward has four actions.${quest ? ` This game’s Quest Card is ${quest.card.theme}: complete either half for +20 Renown.` : ""} The demo plays on by itself and stops when something is worth a closer look.`,
    options: start.players.map((player) => {
      const steward = stewardById[player.stewardId];
      return { label: steward.name, lines: [shortPower(steward.id), `Objective: ${shortObjective(steward.id)} (+${steward.objectiveRenown})`] };
    })
  };
}
const shortPower = (id: string) => ({ vanguard: "Once a Season, a Travel tile for no action", knight: "Once a Season, a Housing tile for no action" } as Record<string, string>)[id] ?? stewardById[id]?.powerText ?? "";
const shortObjective = (id: string) => ({ vanguard: "tiles on both sides of the river, joined by a Bridge", knight: "three Housing tiles together" } as Record<string, string>)[id] ?? stewardById[id]?.objectiveText ?? "";

function pauseFor(beat: RecordedBeat, index: number, context: Context): DemoPause | undefined {
  const { before, after } = beat;
  const once = (key: string) => { if (context.seen.has(key)) return false; context.seen.add(key); return true; };
  const first = beat.moves[0];

  // Seeding, Season I: where each card goes decides when it strikes.
  if (beat.type === "seed" && before.season === 1 && once("seed") && first.k === "seed") {
    const knight = context.beats.find((other) => other.type === "seed" && other.player !== beat.player && other.before.season === 1);
    const knightMove = knight?.moves[0];
    return {
      at: "before",
      kind: "decision",
      title: "Seeding the Season",
      text: `Before Round 1, each Steward secretly slips three cards from their hand into the Encounter Deck: one near the top, one in the middle, one near the bottom. ${who(before, beat.player)} puts the Arrival where it will come out first, while the Warehouse is full, and pushes the Burden as late as possible.${knightMove?.k === "seed" ? ` ${who(before, knight!.player)} does the same with ${cardName(knightMove.top)}, ${cardName(knightMove.middle)} and ${cardName(knightMove.bottom)}.` : ""}`,
      target: { ui: "seed" },
      options: [
        { label: `Top: ${cardName(first.top)}`, chosen: true, lines: ["An Arrival, seen early and paid while resources are plentiful"] },
        { label: `Middle: ${cardName(first.middle)}`, chosen: true, lines: ["A Boon, more useful once there is something to boost"] },
        { label: `Bottom: ${cardName(first.bottom)}`, chosen: true, lines: ["A Burden, kept back until the settlement can absorb it"] },
        { label: `Not on top: ${cardName(first.bottom)}`, lines: ["It would strike in Round 1, before anything is built"] }
      ]
    };
  }

  // The first action of the game: production before anything else.
  if (beat.type === "action" && once("first-action")) {
    const arrivals = before.encounters.activeArrivals;
    return {
      at: "before",
      kind: "decision",
      title: "The first action",
      text: `Round 1 revealed ${list(arrivals.map((arrival) => cardName(arrival.cardId)))}. Arrivals wait beside the board for ${arrivals[0]?.timerTokens ?? 3} rounds: pay their cost to welcome them and unlock a Special tile, or they leave, costing 10 points and a Strain. With time on the clock, ${who(before, beat.player)} starts with production. ${aTile(tileName(newTiles(before, after)[0])).replace(/^./, (c) => c.toUpperCase())} scores nothing by itself, but it is free and refills the shared Warehouse every time it is activated. Tiles that score at once cost resources the Warehouse will need for those Arrivals.`,
      target: targetOf(beat),
      options: weighed(beat, 2)
    };
  }

  // The first Burden set down.
  if (beat.type === "action" && first.k === "burden" && once("burden")) {
    const now = getBurdenResolutionCost(first.id, before.season);
    const later = getBurdenResolutionCost(first.id, Math.min(3, before.season + 1) as 1 | 2 | 3);
    return {
      at: "before",
      kind: "decision",
      title: "Set the Burden down now?",
      text: `${cardName(first.id)} stays on the table after it strikes. Left alone it costs 10 points at the end and strikes again each time a Season begins, and the price to resolve it rises with the Seasons. In Season ${seasonName(before.season)} it is cheap, so ${who(before, beat.player)} spends an action on it now.`,
      target: { ui: "encounters" },
      options: [
        { label: `Resolve it for ${now ? amounts(now) : "its cost"}`, chosen: true, lines: ["+10 at the end, compared with leaving it", "It never strikes again"] },
        { label: "Leave it and build", lines: [`−10 at the end, and it strikes again next Season`, later ? `Costs ${amounts(later)} to resolve later` : "Costs more to resolve later"] }
      ]
    };
  }

  // The first Arrival welcomed.
  if (beat.type === "action" && first.k === "arrival" && once("arrival")) {
    const card = encounterById[first.id];
    const reward = after.encounters.completedArrivals.find((c) => c.cardId === first.id)?.specialTileIds[0];
    const waiting = before.encounters.activeArrivals.find((arrival) => arrival.cardId === first.id);
    const others = before.encounters.activeArrivals.filter((arrival) => arrival.cardId !== first.id).map((arrival) => arrival.cardId);
    return {
      at: "before",
      kind: "decision",
      title: "Welcome them now?",
      text: `${card?.name ?? "The Arrival"} has ${waiting?.timerTokens ?? 2} timer${waiting?.timerTokens === 1 ? "" : "s"} left, and the Warehouse can pay today. Waiting saves nothing: the cost never falls, and the Special tile it unlocks starts scoring as soon as it is built.${reward ? ` ${specialTileById[reward]?.name}: “${specialTileById[reward]?.effectText ?? ""}”` : ""}${others.length ? ` ${list(others.map(cardName))} ${others.length === 1 ? "is" : "are"} waiting too, so clearing this one now leaves room for the next.` : ""}`,
      target: { ui: "arrivals" },
      options: [
        { label: `Welcome them for ${amounts(warehouseChange(before, after), -1)}`, chosen: true, lines: [reward ? `Unlocks ${specialTileById[reward]?.name}: ${specialTileById[reward]?.population ?? 0} Population, ${specialTileById[reward]?.renown ?? 0} Renown` : "Unlocks a Special tile", "One action"] },
        { label: "Keep building and pay later", lines: [`${waiting?.timerTokens ?? 2} rounds left on their timer`, "If they leave: −10 and 1 Strain"] }
      ]
    };
  }

  // A Steward objective reached.
  const objectiveBefore = calculateFinalScore(before).stewardObjectiveRenown;
  const objectiveAfter = calculateFinalScore(after).stewardObjectiveRenown;
  if (objectiveAfter > objectiveBefore) {
    const reached = after.players.find((player) => objectiveMet(after, player.stewardId) && !objectiveMet(before, player.stewardId));
    const steward = reached ? stewardById[reached.stewardId] : undefined;
    const helper = who(before, beat.player);
    return {
      at: "after",
      kind: "moment",
      title: `The ${steward?.name ?? "Steward"}’s objective`,
      text: `${steward ? `${steward.name}: ${shortObjective(steward.id)}.` : ""} ${helper === steward?.name ? `${helper} completes it` : `${helper} completes it for the ${steward?.name}`}, worth +${objectiveAfter - objectiveBefore} Renown at the end as long as those tiles are not Overstrained. In a co-operative game, one Steward’s objective is everybody’s.`,
      target: targetOf(beat)
    };
  }

  // A new Season.
  if (beat.type === "reveal" && after.round % 4 === 1 && after.season > 1 && once(`season-${after.season}`)) {
    const burdens = before.encounters.activeBurdens;
    let from = index;
    while (from > 0 && context.beats[from - 1].type !== "endRound") from--;
    const struck = context.beats.slice(from, index).filter((other) => other.type === "effect").map((other) => other.source ?? "");
    const arrivals = after.encounters.activeArrivals.map((arrival) => cardName(arrival.cardId));
    return {
      at: "after",
      kind: "moment",
      title: `Season ${seasonName(after.season)} begins`,
      text: `Each Steward seeded three more cards. ${struck.length ? `As the Season turned, ${list([...new Set(struck)])} struck again: a Burden left on the table strikes at the start of every Season.` : burdens.length ? "" : "No Burden was left on the table to strike again: setting them down early has paid off."} From now on Burdens use their Season ${seasonName(after.season)} text, which is harsher.${arrivals.length ? ` ${list(arrivals)} ${arrivals.length === 1 ? "is" : "are"} waiting, and the Warehouse holds ${warehouseLine(after)}.` : ""}`,
      target: { ui: "encounters" }
    };
  }

  // Linked production, the first time it fires.
  if (beat.type === "action" && first.k === "activate" && producedTogether(before, first.id) && once("linked")) {
    const group = linkedGroup(before, first.id);
    return {
      at: "after",
      kind: "rule",
      title: "Linked production",
      text: `Matching production tiles that touch form a Linked group. The first time a group is activated in a round, every tile in it produces, for one action: here ${numberWord[group.length]} ${tileName(group[0]).replace(/^The /, "")}s make ${amounts(warehouseChange(before, after), 1)}. Later activations that round produce from one tile only.`,
      target: { hexIds: group.map((tile) => tile.hexIds[0]), label: "Linked" }
    };
  }

  // A Burden's choice the Warehouse could not pay.
  if (beat.type === "effect" && strainChanges(before, after).some((entry) => entry.delta > 0) && (beat.choices ?? []).some((choice) => Object.values(choice.resourceDeltas ?? {}).some((value) => value < 0) && !Object.keys(choice.tileStrainDeltas ?? {}).length) && once("strain-choice")) {
    const prepared = preparePendingEffectQueueHead(before);
    const head = prepared.pendingEffects[0];
    const paying = (beat.choices ?? []).find((choice) => Object.values(choice.resourceDeltas ?? {}).some((value) => value < 0) && !Object.keys(choice.tileStrainDeltas ?? {}).length);
    const short = paying ? amounts(paying.resourceDeltas ?? {}, -1) : "";
    const alternative = getAlternativeEffectRule(prepared, head?.ruleId);
    const payWith = (alternative && "resources" in alternative ? alternative.resources : Object.keys(paying?.resourceDeltas ?? {})) as ResourceType[];
    const payable = alternative && "resources" in alternative && alternative.resources.length > 1 ? `${Math.abs(Object.values(paying?.resourceDeltas ?? {})[0] ?? 0)} ${list(payWith.map((resource) => resourceLabels[resource])).replace(/ and /, " or ")}` : short;
    return {
      at: "before",
      kind: "decision",
      title: `${beat.source} strikes`,
      text: `“${head?.effectText ?? ""}” Paying ${payable} would keep the tiles clean, but the Warehouse is down to ${warehouseLine(before, payWith)}. So the Strain lands. Each Strain costs 10 at the end, and a tile with 3 is Overstrained: it stops working and scores nothing.`,
      target: targetOf(beat),
      options: [
        { label: `Pay ${payable}`, lines: ["Not enough in the Warehouse"] },
        { label: "Take the Strain", chosen: true, lines: [strainLine(before, after), `Score ${points(score(before))} → ${points(score(after))}`] }
      ]
    };
  }

  // Late Burdens: worth resolving even in the last rounds.
  if (beat.type === "action" && first.k === "burden" && before.season === 3 && once("late-burden")) {
    const cost = getBurdenResolutionCost(first.id, before.season);
    const next = context.beats[index + 1];
    const second = next?.type === "action" && next.player === beat.player && next.moves[0].k === "burden" ? next.moves[0].id : undefined;
    const secondCost = second ? getBurdenResolutionCost(second, before.season) : undefined;
    const ids = second ? [first.id, second] : [first.id];
    return {
      at: "before",
      kind: "decision",
      title: "Season III prices",
      text: `Burdens now cost three times their Season I price to resolve. With the game nearly over, they will not get another Season to strike, but each one still costs 10 points at the end. ${who(before, beat.player)} has the resources${second ? " for both" : ""}, and no other action this late adds 10 points.`,
      target: { ui: "encounters" },
      options: [
        { label: second ? "Resolve both" : `Resolve ${cardName(first.id)}`, chosen: true, lines: [`Costs ${list([cost, secondCost].filter(Boolean).map((entry) => amounts(entry!)))}${second ? " and two actions" : ""}`, `+${10 * ids.length} at the end`] },
        { label: second ? "Leave them" : "Leave it", lines: [`−${10 * ids.length} at the end`, "Keeps the resources for building"] }
      ]
    };
  }

  // The last round: the first Steward plays for points now and sets up the next.
  if (beat.type === "action" && before.round === 12 && before.phase === "turns" && once("last-round")) {
    const order = before.players.map((player) => player.id);
    if (order.indexOf(beat.player) === order.length - 1) return undefined;
    const nextId = order[order.indexOf(beat.player) + 1];
    const nextName = who(before, nextId);
    // This Steward's last turn, and what the next Steward did with it.
    let end = index;
    while (end < context.beats.length && !(context.beats[end].type === "endTurn" && context.beats[end].player === beat.player)) end++;
    const turn = context.beats.slice(index, end);
    const turnStart = beat.before;
    const handOver = context.beats[end]?.after ?? after;
    let nextEnd = end + 1;
    while (nextEnd < context.beats.length && !(context.beats[nextEnd].type === "endTurn" && context.beats[nextEnd].player === nextId)) nextEnd++;
    const nextTurn = context.beats.slice(end + 1, nextEnd).filter((other) => other.type === "action");
    const nextDone = context.beats[nextEnd]?.before ?? handOver;
    const welcomedIds = turn.flatMap((other) => other.moves[0].k === "arrival" ? [other.moves[0].id] : []);
    const lastTimer = welcomedIds.filter((id) => (turnStart.encounters.activeArrivals.find((arrival) => arrival.cardId === id)?.timerTokens ?? 9) <= 1);
    const waiting = turnStart.encounters.activeArrivals.filter((arrival) => !welcomedIds.includes(arrival.cardId) && arrival.timerTokens > 1).map((arrival) => arrival.cardId);
    const made: Partial<Record<ResourceType, number>> = {};
    for (const other of turn) if (other.moves[0].k === "activate") for (const [resource, amount] of Object.entries(warehouseChange(other.before, other.after))) if (amount > 0) made[resource as ResourceType] = (made[resource as ResourceType] ?? 0) + amount;
    const madeWhat = amounts(made, 1);
    const nextBuilt = nextTurn.flatMap((other) => newTiles(other.before, other.after)).filter((tile) => !coreTileById[tile.tileId] || coreTileById[tile.tileId].category !== "travel");
    const nextStrain = nextTurn.flatMap((other) => strainChanges(other.before, other.after)).filter((entry) => entry.delta < 0);
    // What the handed-over resources became, not counting a last Path.
    const nextGain = nextTurn.filter((other) => !(other.moves[0].k === "place" && coreTileById[other.moves[0].tile]?.category === "travel")).reduce((total, other) => total + score(other.after) - score(other.before), 0);
    void nextDone;
    const eased = turn.flatMap((other) => strainChanges(other.before, other.after)).filter((entry) => entry.delta < 0);
    const plan = [
      lastTimer.length ? `Welcome ${list(lastTimer.map(cardName))}` : welcomedIds.length ? `Welcome ${list(welcomedIds.map(cardName))}` : "",
      madeWhat ? `make ${madeWhat} for ${nextName}` : ""
    ].filter(Boolean).join(", then ");
    return {
      at: "before",
      kind: "decision",
      title: "The last round",
      text: `Resources left at the end score nothing, so each action now should add points, or give ${nextName} what they need to add points.${lastTimer.length ? ` ${list(lastTimer.map(cardName))} are on their last timer: still waiting when the round ends, they leave for −10 and a Strain, so welcoming them comes first.` : ""}${eased.length ? ` One action lifts a Strain off ${list(eased.map((entry) => theTile(tileName(entry.tile))))}: +10.` : ""}${waiting.length ? ` ${list(waiting.map(cardName))} only came out this round and will still be waiting at the end, which costs nothing, and the Warehouse has Food for one welcome, not two.` : ""}${madeWhat ? ` The rest make ${madeWhat}: ${nextName} ${nextBuilt.length ? `spends them on ${list(nextBuilt.map((tile) => aTile(tileName(tile))))}` : "spends them"}${nextStrain.length ? `, whose activation lifts a Strain off ${list(nextStrain.map((entry) => theTile(tileName(entry.tile))))}` : ""}, worth +${nextGain}.` : ""}`,
      target: { ui: "arrivals" },
      options: [
        { label: plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : "Play for points", chosen: true, lines: [lastTimer.length ? `Saves the −10 and the Strain` : `Score ${points(score(turnStart))} → ${points(score(handOver))}`, madeWhat ? `${nextName} turns it into +${nextGain}` : "Every action used"] },
        ...(waiting.length ? [{ label: `Welcome ${cardName(waiting[0])} instead`, lines: ["Unlocks a Special tile, but uses the only Food", `${list(lastTimer.map(cardName)) || "The other Arrival"} would leave: −10 and a Strain`] }] : []),
        { label: "Stop early", lines: ["Leftover actions and resources score nothing"] }
      ]
    };
  }

  return undefined;
}

const lower = (text: string) => text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
const warehouseLine = (state: GameState, only: ResourceType[] = resources) => list(only.map((resource) => `${state.warehouse[resource]} ${resourceLabels[resource]}`));

function objectiveMet(state: GameState, stewardId: string): boolean {
  const solo: GameState = { ...state, players: state.players.filter((player) => player.stewardId === stewardId) };
  return calculateFinalScore(solo).stewardObjectiveRenown > 0;
}

function finalePause(final: GameState): DemoPause {
  const result = calculateFinalScore(final);
  const quest = evaluateQuest(final);
  const renown = result.printedRenown + result.passiveRenown;
  const penalties = result.burdenPenalty + result.failedArrivalPenalty + result.strainPenalty;
  const breakdown: DemoPause["breakdown"] = [
    { label: "Population", value: `+${result.population}`, tone: "plus" },
    { label: "Renown from tiles", value: `+${renown}`, tone: "plus" },
    { label: "Steward objectives", value: `+${result.stewardObjectiveRenown}`, tone: "plus" },
    { label: "Quest Card", value: `+${result.questRenown}`, tone: "plus" },
    ...(result.burdenPenalty ? [{ label: `Burdens left on the table`, value: `−${result.burdenPenalty}`, tone: "minus" as const }] : []),
    ...(result.failedArrivalPenalty ? [{ label: "Arrivals who left", value: `−${result.failedArrivalPenalty}`, tone: "minus" as const }] : []),
    ...(result.strainPenalty ? [{ label: "Strain on the tiles", value: `−${result.strainPenalty}`, tone: "minus" as const }] : []),
    { label: "Final score", value: points(result.finalScore), tone: "total" }
  ];
  const half = quest?.top.status === "met" ? { name: quest.card.top.name, which: "easier" } : quest?.bottom.status === "met" ? { name: quest.card.bottom.name, which: "harder" } : undefined;
  const strain = final.map.placedTiles.reduce((total, tile) => total + tile.strain, 0);
  const left = final.encounters.activeBurdens.map(cardName);
  const late = final.encounters.activeArrivals.map((arrival) => cardName(arrival.cardId));
  const welcomed = result.failedArrivals ? `${numberWord[result.failedArrivals] ?? result.failedArrivals} Arrival${result.failedArrivals === 1 ? "" : "s"} left unwelcomed` : late.length ? `no Arrival left unwelcomed (${list(late)} ${late.length === 1 ? "was" : "were"} still waiting when the game ended, which costs nothing)` : "every Arrival was welcomed in time";
  const held = [strain && `${numberWord[strain] ?? strain} Strain left on the tiles`, left.length && `${list(left)} still on the table`].filter(Boolean) as string[];
  return {
    at: "after",
    kind: "finale",
    title: `A settlement of ${final.map.placedTiles.length} tiles`,
    text: `${welcomed.replace(/^./, (c) => c.toUpperCase())}, ${result.stewardObjectiveRenown >= 30 ? "both Steward objectives were met" : result.stewardObjectiveRenown ? "one Steward objective was met" : "no Steward objective was met"}${half ? `, and the Quest Card’s ${half.which} half, ${half.name}, was completed` : ""}. ${penalties ? `What held the score back came late: ${list(held)}, ${points(-penalties)} in all. Season III Burdens strike hard, and a Warehouse with no Food or Goods cannot pay them off.` : "Nothing held the score back."} Twelve rounds, one settlement: that is The Quiet Vale.`,
    // The whole settlement in view.
    target: { hexIds: final.map.placedTiles.map((tile) => tile.hexIds[0]) },
    breakdown
  };
}

export type { DemoOption };

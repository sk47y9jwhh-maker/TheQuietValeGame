/**
 * Turns the recorded demo into frames the player can step through. Each beat
 * is replayed through the rules engine once, up front, so moving backwards
 * and forwards is instant.
 */
import type { GameState, Season } from "../../engine/types";
import type { CoachTarget } from "../../components/table/TableCoach";
import { applyWatchMove, type WatchMove } from "./watchMoves";
import { preparePendingEffectQueueHead } from "../../engine/manualEffects";
import { getHexNeighbors } from "../../engine/hex";
import { encounterById } from "../../data/encounters";
import type { DemoPause, WatchDemoData } from "./watchTypes";

/** A close-up of what a step is about: the card or tile whose text matters. */
export type WatchSpotlight =
  | { kind: "seed"; player: string; season: Season; top: string; middle: string; bottom: string }
  | { kind: "card"; cardId: string; verb: string; unlocks?: string; season: Season }
  | { kind: "tile"; tileId: string; side: "basic" | "upgraded"; verb: string; from?: "basic"; linked?: number };

/** A Special tile has one face; the close-up shows it as its basic side. */
const face = (side: string): "basic" | "upgraded" => side === "upgraded" ? "upgraded" : "basic";

export interface WatchFrame {
  /** The position to show. */
  state: GameState;
  caption: string;
  round: number;
  /** The Steward whose step this is. */
  player: string;
  target?: CoachTarget;
  /** A point of interest: playback stops here. */
  pause?: DemoPause;
  /** Encounter cards that came out on this step, for the reveal animation. */
  revealed: string[];
  spotlight?: WatchSpotlight;
}

export function buildFrames(data: WatchDemoData): WatchFrame[] {
  const frames: WatchFrame[] = [];
  let state = data.start.state as GameState;
  for (const beat of data.beats) {
    const before = state;
    for (const move of beat.moves) state = applyWatchMove(state, move);
    const revealed = before.encounters.deck.filter((id) => !state.encounters.deck.includes(id) && beat.moves.some((move) => move.k === "reveal"));
    const spotlight = spotlightOf(beat.moves, before, state);
    const base = { caption: beat.caption, round: beat.round, player: beat.player, target: beat.target, ...(spotlight ? { spotlight } : {}) };
    if (beat.pause?.at === "before") {
      frames.push({ ...base, state: before, pause: beat.pause, revealed: [] });
      // The seeding spread was shown at the stop; the step after it does not play it again.
      if (beat.moves.length) frames.push({ ...base, state, revealed, target: beat.target, ...(spotlight?.kind === "seed" ? { spotlight: undefined } : {}) });
    } else {
      frames.push({ ...base, state, pause: beat.pause, revealed });
    }
  }
  return frames;
}

/** The card or tile a step turns on, read from its first move. */
export function spotlightOf(moves: WatchMove[], before: GameState, after: GameState): WatchSpotlight | undefined {
  const first = moves[0];
  if (!first) return undefined;
  const tile = (state: GameState, id: string) => state.map.placedTiles.find((candidate) => candidate.instanceId === id);
  switch (first.k) {
    case "seed": return { kind: "seed", player: first.p, season: before.season, top: first.top, middle: first.middle, bottom: first.bottom };
    case "arrival": return { kind: "card", cardId: first.id, verb: "Welcomed", season: before.season, unlocks: after.encounters.completedArrivals.find((arrival) => arrival.cardId === first.id)?.specialTileIds[0] };
    case "burden": return { kind: "card", cardId: first.id, verb: "Set down for good", season: before.season };
    case "boon": return { kind: "card", cardId: first.id, verb: "Used", season: before.season };
    case "effect": case "skip": {
      // A Burden or Boon striking: its card is the source of the effect at the head of the queue.
      const source = preparePendingEffectQueueHead(before).pendingEffects[0];
      return source?.sourceId && encounterById[source.sourceId] ? { kind: "card", cardId: source.sourceId, verb: encounterById[source.sourceId].type === "burden" ? "Strikes" : "Takes effect", season: before.season } : undefined;
    }
    case "upgrade": { const placed = tile(after, first.id); return placed ? { kind: "tile", tileId: placed.tileId, side: "upgraded", from: "basic", verb: "Upgraded" } : undefined; }
    case "activate": {
      const placed = tile(before, first.id);
      if (!placed) return undefined;
      const near = new Set(placed.hexIds.flatMap((hex) => getHexNeighbors(hex)));
      const linked = before.map.placedTiles.filter((other) => other.tileId === placed.tileId && other.instanceId !== placed.instanceId && other.hexIds.some((hex) => near.has(hex))).length;
      return { kind: "tile", tileId: placed.tileId, side: face(placed.side), verb: "Activated", ...(linked ? { linked: linked + 1 } : {}) };
    }
    case "place": case "power": {
      const built = after.map.placedTiles.find((candidate) => !before.map.placedTiles.some((old) => old.instanceId === candidate.instanceId));
      return built ? { kind: "tile", tileId: built.tileId, side: face(built.side), verb: first.k === "power" ? "Built with the Season power" : "Built" } : undefined;
    }
    default: return undefined;
  }
}

/**
 * The board shows every frame as a turn in progress, or as the finished game.
 * Seeding, reveals and the end of a round are told by the commentary, and the
 * table is read-only, so nothing on screen waits for a choice.
 */
export function displayState(state: GameState): GameState {
  if ((state.phase === "turns" || state.phase === "gameEnd") && !state.pendingEffects.length && !state.pendingCostChoice && !state.pendingDeckReorder) return state;
  return {
    ...state,
    phase: "turns",
    round: Math.min(12, state.round),
    // Before a round's turns, the first Steward has all four actions to come; after them, none.
    actionsRemaining: state.phase === "turns" ? state.actionsRemaining : state.phase === "seeding" || state.phase === "reveal" ? 4 : 0,
    pendingEffects: [],
    pendingCostChoice: null,
    pendingDeckReorder: null,
    pendingGoldenEffect: null
  };
}

/**
 * How long a frame stays on screen at normal speed, in milliseconds: long
 * enough to read the caption and see the change on the board.
 */
export function frameDuration(frame: WatchFrame): number {
  const words = frame.caption.split(/\s+/).length;
  // Seeding is shown card by card, so it is given time to be seen.
  if (frame.spotlight?.kind === "seed") return 5200;
  return Math.min(5200, 1800 + words * 110);
}

export type WatchSpeed = "slow" | "normal" | "fast";
export const speedFactor: Record<WatchSpeed, number> = { slow: 0.65, normal: 1, fast: 2 };
export const speedLabel: Record<WatchSpeed, string> = { slow: "Slow", normal: "Normal", fast: "Fast" };
export const nextSpeed: Record<WatchSpeed, WatchSpeed> = { normal: "fast", fast: "slow", slow: "normal" };

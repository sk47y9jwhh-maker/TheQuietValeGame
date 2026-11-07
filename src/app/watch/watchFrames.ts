/**
 * Turns the recorded demo into frames the player can step through. Each beat
 * is replayed through the rules engine once, up front, so moving backwards
 * and forwards is instant.
 */
import type { GameState } from "../../engine/types";
import type { CoachTarget } from "../../components/table/TableCoach";
import { applyWatchMove } from "./watchMoves";
import type { DemoPause, WatchDemoData } from "./watchTypes";

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
}

export function buildFrames(data: WatchDemoData): WatchFrame[] {
  const frames: WatchFrame[] = [];
  let state = data.start.state as GameState;
  for (const beat of data.beats) {
    const before = state;
    for (const move of beat.moves) state = applyWatchMove(state, move);
    const revealed = before.encounters.deck.filter((id) => !state.encounters.deck.includes(id) && beat.moves.some((move) => move.k === "reveal"));
    const base = { caption: beat.caption, round: beat.round, player: beat.player, target: beat.target };
    if (beat.pause?.at === "before") {
      frames.push({ ...base, state: before, pause: beat.pause, revealed: [] });
      if (beat.moves.length) frames.push({ ...base, state, revealed, target: beat.target });
    } else {
      frames.push({ ...base, state, pause: beat.pause, revealed });
    }
  }
  return frames;
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
  return Math.min(5200, 1800 + words * 110);
}

export type WatchSpeed = "slow" | "normal" | "fast";
export const speedFactor: Record<WatchSpeed, number> = { slow: 0.65, normal: 1, fast: 2 };
export const speedLabel: Record<WatchSpeed, string> = { slow: "Slow", normal: "Normal", fast: "Fast" };
export const nextSpeed: Record<WatchSpeed, WatchSpeed> = { normal: "fast", fast: "slow", slow: "normal" };

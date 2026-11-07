/**
 * Builds the "Watch a demo" game: a two-player game played through the rules
 * engine, recorded move by move, with a caption for every step and commentary
 * where a decision or a rule is worth stopping for.
 *
 *   npm run preview:watch             play and record the game, then write the commentary
 *   npm run preview:watch -- --reuse  rewrite the commentary for the recorded game
 *
 * The recording (tools/watch-demo.recording.json) keeps the moves and the
 * options the players weighed. The demo (src/app/watch/watchDemo.generated.json)
 * keeps the moves, captions and pauses. The browser replays the moves through
 * the engine; tests check the replay reaches the recorded final score.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createNewGame } from "../src/engine/setup";
import { getAlternativeEffectRule, preparePendingEffectQueueHead } from "../src/engine/manualEffects";
import { calculateFinalScore } from "../src/engine/scoring";
import { encounterById } from "../src/data/encounters";
import { applyWatchMove, type WatchMove } from "../src/app/watch/watchMoves";
import { candidates, effectChoices, planTurn, play, settle } from "./watch-recorder";
import { watchValueOf } from "./watch-recorder";
import { demoQuestCard, seed, snapshot, startStewards } from "./scenario-steps";
import { authorDemo, type RecordedBeat } from "./watch-commentary";
import type { GameState } from "../src/engine/types";

const stewards = ["vanguard", "knight"];

/** Whether the effect at the head of the queue offers the table a real choice. */
function isChoice(state: GameState): boolean {
  const prepared = preparePendingEffectQueueHead(state);
  const head = prepared.pendingEffects[0];
  if (!head) return false;
  const alternative = getAlternativeEffectRule(prepared, head.ruleId);
  if (alternative && /^pay_/.test(alternative.kind)) return true;
  return (head.targetCardTargetTileIds?.length ?? 0) > 1;
}

/** A beat as stored in the recording: its moves, and the options' moves and values. */
type StoredBeat = Omit<RecordedBeat, "before" | "after" | "options"> & { options?: { moves: WatchMove[]; value: number }[] };
const recordingUrl = new URL("./watch-demo.recording.json", import.meta.url);

function recordGame(start: GameState): StoredBeat[] {
  let state = start;
  let plan: WatchMove[][] = [];
  let planOwner = "";
  const beats: RecordedBeat[] = [];
  const record = (beat: Omit<RecordedBeat, "before" | "after">, after: GameState) => { beats.push({ ...beat, before: state, after } as RecordedBeat); state = after; };

  /** Settle the queue. Effects that ask the table to choose become beats of their own. */
  const settleAll = () => {
    for (let guard = 0; guard < 60; guard++) {
      const quiet = settle(state, { stopBefore: isChoice });
      if (quiet.moves.length) {
        const last = beats[beats.length - 1];
        // Automatic follow-ups belong to the step that set them off.
        if (last) { last.moves.push(...quiet.moves); last.after = quiet.state; state = quiet.state; }
      }
      if (!state.pendingEffects.length) return;
      const prepared = preparePendingEffectQueueHead(state);
      const head = prepared.pendingEffects[0];
      const one = settle(state, { stopBefore: (current) => current.pendingEffects[0]?.id !== head.id && current.pendingEffects.length > 0 && isChoice(current) });
      const options = effectChoices(prepared, true);
      record({ type: "effect", player: state.currentPlayerId, moves: one.moves, effectId: head.id, ruleId: head.ruleId, source: head.sourceName ?? "", choices: options.slice(0, 6) }, one.state);
    }
  };

  for (let guard = 0; state.phase !== "gameEnd" && guard < 600; guard++) {
    if (state.phase === "seeding") {
      for (const player of state.players) {
        if (state.phase !== "seeding" || state.seasonSeededPlayerIds.includes(player.id)) continue;
        const hand = state.encounters.handsByPlayerId[player.id];
        const of = (type: string, taken: string[]) => hand.find((id) => encounterById[id]?.type === type && !taken.includes(id));
        // An Arrival on top, paid while the Warehouse is full; a Boon in the middle; a Burden low.
        const top = of("arrival", []) ?? hand[0];
        const middle = of("boon", [top]) ?? hand.find((id) => id !== top)!;
        const bottom = of("burden", [top, middle]) ?? hand.find((id) => id !== top && id !== middle)!;
        const move: WatchMove = { k: "seed", p: player.id, top, middle, bottom };
        record({ type: "seed", player: player.id, moves: [move], hand: [...hand] }, applyWatchMove(state, move));
      }
    } else if (state.phase === "reveal") {
      record({ type: "reveal", player: state.currentPlayerId, moves: [{ k: "reveal" }] }, applyWatchMove(state, { k: "reveal" }));
    } else if (state.phase === "endRound") {
      record({ type: "endRound", player: state.currentPlayerId, moves: [{ k: "endRound" }] }, applyWatchMove(state, { k: "endRound" }));
    } else if (state.phase === "turns") {
      // Each turn is planned as a whole, then played one action at a time.
      const owner = `${state.round}:${state.currentPlayerId}`;
      if (planOwner !== owner) { planOwner = owner; // The last round is searched more widely: every action counts.
        plan = (state.round >= 12 ? planTurn(state, watchValueOf, 6, 24) : planTurn(state, watchValueOf, 1, 1)).actions; }
      const action = plan.shift();
      const scored: { moves: WatchMove[]; value: number; state: GameState }[] = [];
      if (action) for (const option of candidates(state)) {
        const result = play(state, option);
        if (!result || result.state.phase === "gameEnd" && state.round < 12) continue;
        scored.push({ moves: option, value: watchValueOf(result.state), state: result.state });
      }
      scored.sort((a, b) => b.value - a.value);
      if (action) {
        const first = applyWatchMove(state, action[0]);
        record({ type: "action", player: state.currentPlayerId, moves: [action[0]], options: scored.slice(0, 8) }, first);
        settleAll();
        // A two-step action (a power or Boon, then its tile) plays as one step.
        for (const move of action.slice(1)) {
          const last = beats[beats.length - 1];
          const next = applyWatchMove(state, move);
          last.moves.push(move); last.after = next; state = next;
          settleAll();
        }
      } else {
        record({ type: "endTurn", player: state.currentPlayerId, moves: [{ k: "endTurn" }] }, applyWatchMove(state, { k: "endTurn" }));
      }
    } else throw new Error(`Unexpected phase ${state.phase}`);
    settleAll();
  }
  if (state.phase !== "gameEnd") throw new Error("The demo game did not finish.");
  return beats.map(({ before: _before, after: _after, options, ...beat }) => ({ ...beat, ...(options ? { options: options.map((option) => ({ moves: option.moves, value: option.value })) } : {}) }));
}

/** Rebuild every state from the moves, as the browser will. */
function replay(start: GameState, stored: StoredBeat[]): { beats: RecordedBeat[]; final: GameState } {
  let state = start;
  const beats = stored.map((beat) => {
    const before = state;
    for (const move of beat.moves) state = applyWatchMove(state, move);
    const options = beat.options?.map((option) => ({ ...option, state: play(before, option.moves)?.state ?? before }));
    return { ...beat, before, after: state, options } as RecordedBeat;
  });
  return { beats, final: state };
}

const realNow = Date.now;
Date.now = () => Date.parse("2026-11-07T00:00:00.000Z");
try {
  const start = startStewards(createNewGame(2, stewards, { encounterSeed: seed, questCardNumber: demoQuestCard }));
  const reuse = process.argv.includes("--reuse") && existsSync(recordingUrl);
  const stored: StoredBeat[] = reuse ? JSON.parse(readFileSync(recordingUrl, "utf8")).beats : recordGame(start);
  if (!reuse) writeFileSync(recordingUrl, JSON.stringify({ seed, stewards, beats: stored }) + "\n");
  const { beats, final } = replay(start, stored);
  if (final.phase !== "gameEnd") throw new Error("The recorded game does not reach its end.");
  const demo = authorDemo(start, beats, final);
  const output = { version: 1, start: snapshot(start), beats: demo, finalScore: calculateFinalScore(final).finalScore };
  writeFileSync(new URL("../src/app/watch/watchDemo.generated.json", import.meta.url), JSON.stringify(output) + "\n");
  const pauses = demo.filter((beat) => beat.pause).length;
  console.log(`${demo.length} steps, ${pauses} pauses, final score ${output.finalScore}`);
} finally {
  Date.now = realNow;
}

import { createNewGame } from "../src/engine/setup";
import { resolveEndRound, revealEncounters } from "../src/engine/gameActions";
import { trackLedgerTransition } from "../src/engine/ledger";
import { calculateFinalScore } from "../src/engine/scoring";
import { advance, seed, seedSeason, settle, startStewards } from "./scenario-steps";
import { playTurn } from "./showcase-bot";
const chain = "system:overstrain-spread";
let captured: { round: number; tiles: number } | null = null;
const commit = (s: any) => {
  const stopped = settle(s, false, { stopBeforeRuleId: chain });
  if (stopped.pendingEffects[0]?.ruleId === chain && !captured) { captured = { round: stopped.round, tiles: stopped.map.placedTiles.length }; console.log("CHAIN at round", stopped.round, stopped.pendingEffects.map((e: any) => e.title)); }
  return settle(stopped, false, {});
};
const realNow = Date.now; Date.now = () => Date.parse("2026-09-27T00:00:00.000Z");
const stewards = (process.argv[2] ?? "vanguard,knight").split(",");
let state = startStewards(createNewGame(stewards.length, stewards, { encounterSeed: process.argv[3] ?? seed }));
const t0 = realNow();
for (let guard = 0; state.phase !== "gameEnd" && guard < 400; guard++) {
  if (state.phase === "seeding") state = seedSeason(state);
  else if (state.phase === "reveal") state = advance(state, revealEncounters);
  else if (state.phase === "endRound") { state = advance(state, resolveEndRound); console.log(`end of round ${state.round - 1}: score ${calculateFinalScore(state).finalScore}, tiles ${state.map.placedTiles.length}, strain ${state.map.placedTiles.reduce((t, x) => t + x.strain, 0)}, arrivals ${state.encounters.activeArrivals.length}, burdens ${state.encounters.activeBurdens.length}, ${Math.round((realNow() - t0) / 1000)}s`); }
  else if (state.phase === "turns") state = playTurn(state, (s) => settle(s, false, { preferPayments: true }), trackLedgerTransition, commit);
  state = settle(state, false, { stopBeforeRuleId: chain }); if (state.pendingEffects[0]?.ruleId === chain && !captured) { captured = { round: state.round, tiles: 0 }; console.log("CHAIN(reveal) at round", state.round, state.pendingEffects.map((e: any) => e.title)); } state = settle(state, false, {});
}
const score = calculateFinalScore(state);
console.log("FINAL", score.finalScore, JSON.stringify({ population: score.population, renown: score.printedRenown + score.passiveRenown, penalties: score.burdenPenalty + score.failedArrivalPenalty + score.strainPenalty }));

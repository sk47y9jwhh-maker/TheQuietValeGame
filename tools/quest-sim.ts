/**
 * Quest Card calibration. Plays whole games with the showcase bot through
 * ordinary engine actions and records, for every Quest Card half, whether it
 * was met. Moments and Vows are watched after every step of the game.
 *
 * Usage: node quest-sim.js <playerCount> <games> <seedPrefix> [mode]
 *   mode "natural" (default): the bot ignores the card.
 *   mode "vow:<id>": the bot refuses moves that break that Vow.
 * Prints one JSON line per game.
 */
import { createNewGame } from "../src/engine/setup";
import { revealEncounters, resolveEndRound } from "../src/engine/gameActions";
import { trackLedgerTransition, getLedgerRun } from "../src/engine/ledger";
import { mapById, mapCells } from "../src/data/map";
import { coreTileById, goldenTileById, specialTileById } from "../src/data/tiles";
import { stewards } from "../src/data/stewards";
import { getHexNeighbors } from "../src/engine/hex";
import { hasConnectedBridgeCrossing } from "../src/engine/reachability";
import { calculateFinalScore } from "../src/engine/scoring";
import { advance, seedSeason, startStewards } from "./scenario-steps";
import { carefulValueOf, playTurn } from "./showcase-bot";
import { getAlternativeEffectRule, preparePendingEffectQueueHead, resolvePendingEffect, skipPendingEffect } from "../src/engine/manualEffects";
import { skipDeckReorder } from "../src/engine/deckReorder";
import { resources } from "../src/data/resources";
import type { EffectAdjustment, GameState, PlacedTile, PlayerCount, TileCategory } from "../src/engine/types";

type Counts = [number, number, number, number, number];
const by = (counts: Counts, players: number) => counts[players - 1];

function category(tile: PlacedTile): TileCategory {
  if (tile.tileId.startsWith("golden_tile_")) return goldenTileById[tile.tileId]?.category ?? "special";
  return tile.kind === "special" ? specialTileById[tile.tileId]?.category ?? "special" : coreTileById[tile.tileId]?.category ?? "special";
}
const isWater = (hexId: string) => mapById[hexId]?.terrain === "water";
const isEdge = (hexId: string) => { const c = mapById[hexId]; return Boolean(c && (c.col === "A" || c.col === "N" || c.row === 1 || c.row === 9)); };
const besideWater = (tile: PlacedTile) => tile.hexIds.some((h) => getHexNeighbors(h).some(isWater));

// Land on each side of the river: connected non-water hexes.
const bankOf = new Map<string, number>();
{
  let bank = 0;
  for (const cell of mapCells) {
    if (cell.terrain === "water" || bankOf.has(cell.id)) continue;
    const queue = [cell.id]; bankOf.set(cell.id, bank);
    for (let i = 0; i < queue.length; i++) for (const n of getHexNeighbors(queue[i])) if (mapById[n] && !isWater(n) && !bankOf.has(n)) { bankOf.set(n, bank); queue.push(n); }
    bank++;
  }
}

interface Board {
  tiles: PlacedTile[];
  ok: PlacedTile[];
  adj: Map<string, Set<string>>;
  byHex: Map<string, PlacedTile>;
}
function board(state: GameState): Board {
  const tiles = state.map.placedTiles;
  const ok = tiles.filter((t) => t.strain < 3);
  const byHex = new Map<string, PlacedTile>();
  for (const t of ok) for (const h of t.hexIds) byHex.set(h, t);
  const adj = new Map<string, Set<string>>(ok.map((t) => [t.instanceId, new Set<string>()]));
  for (const t of ok) for (const h of t.hexIds) for (const n of getHexNeighbors(h)) { const o = byHex.get(n); if (o && o !== t) adj.get(t.instanceId)!.add(o.instanceId); }
  return { tiles, ok, adj, byHex };
}
const nextTo = (b: Board, t: PlacedTile, cat: TileCategory) => [...b.adj.get(t.instanceId) ?? []].some((id) => category(b.ok.find((o) => o.instanceId === id)!) === cat);
function groups(b: Board, members: PlacedTile[]): PlacedTile[][] {
  const left = new Set(members.map((t) => t.instanceId)); const byId = new Map(members.map((t) => [t.instanceId, t])); const out: PlacedTile[][] = [];
  while (left.size) { const first = left.values().next().value as string; left.delete(first); const q = [first]; const g: PlacedTile[] = [];
    for (let i = 0; i < q.length; i++) { g.push(byId.get(q[i])!); for (const n of b.adj.get(q[i]) ?? []) if (left.has(n)) { left.delete(n); q.push(n); } }
    out.push(g); }
  return out;
}
function ring(b: Board, hexId: string): PlacedTile[] | null {
  const ns = getHexNeighbors(hexId); if (ns.length !== 6) return null;
  const r = ns.map((h) => b.byHex.get(h)); if (r.some((t) => !t)) return null;
  return new Set(r.map((t) => t!.instanceId)).size === 6 ? (r as PlacedTile[]) : null;
}
const housing = (b: Board) => b.ok.filter((t) => category(t) === "housing");
const travel = (b: Board) => b.ok.filter((t) => category(t) === "travel");
const cats = (b: Board) => new Set(b.ok.map(category).filter((c) => c !== "special"));
const terrains = (tiles: PlacedTile[]) => new Set(tiles.flatMap((t) => t.hexIds.map((h) => mapById[h]?.terrain)).filter((x) => x && x !== "water"));
const strainOnMap = (s: GameState) => s.map.placedTiles.reduce((a, t) => a + t.strain, 0);
const overstrained = (s: GameState) => s.map.placedTiles.filter((t) => t.strain >= 3).length;
const resourceIds = ["c01_lumber_yard", "c02_mine_tunnel", "c03_gathering_outpost", "c04_farmstead"];
const copies = (b: Board, id: string, upgraded = false) => b.ok.filter((t) => t.tileId === id && (!upgraded || t.side === "upgraded")).length;
const allHousingPaired = (b: Board) => { const h = housing(b); return h.length > 0 && h.every((t) => nextTo(b, t, "housing")); };
const largestHousing = (b: Board) => Math.max(0, ...groups(b, housing(b)).map((g) => g.length));
const riverbankHexes = (b: Board) => new Set(b.ok.flatMap((t) => t.hexIds).filter((h) => !isWater(h) && getHexNeighbors(h).some(isWater))).size;
function enclosedByTravel(b: Board): boolean {
  const travelHexes = new Set(travel(b).flatMap((t) => t.hexIds));
  const outside = new Set<string>(); const q: string[] = [];
  for (const c of mapCells) if (!travelHexes.has(c.id) && getHexNeighbors(c.id).length < 6) { outside.add(c.id); q.push(c.id); }
  for (let i = 0; i < q.length; i++) for (const n of getHexNeighbors(q[i])) if (mapById[n] && !travelHexes.has(n) && !outside.has(n)) { outside.add(n); q.push(n); }
  return b.ok.some((t) => category(t) !== "travel" && t.hexIds.every((h) => !outside.has(h)));
}
function longRoad(b: Board): boolean {
  return groups(b, travel(b)).some((g) => { const rows = new Set(g.flatMap((t) => t.hexIds.map((h) => mapById[h]?.row))); return rows.has(1) && rows.has(9); });
}

/** Everything a Moment or Vow needs to know, updated after every step. */
interface Watch {
  moments: Record<string, boolean>;
  broken: Record<string, boolean>;
  maxOverstrained: number;
}
function newWatch(): Watch { return { moments: {}, broken: {}, maxOverstrained: 0 }; }

function momentChecks(s: GameState, b: Board, p: number): Record<string, boolean> {
  const run = getLedgerRun(s);
  const strainRounds = Object.values(run.strainRemovedByRoundCategory ?? {});
  return {
    "1T": hasConnectedBridgeCrossing(b.ok),
    "3T": ["A1", "A9", "N1", "N9"].filter((h) => b.byHex.has(h)).length >= 3,
    "4T": cats(b).size >= by([6, 6, 7, 7, 7], p),
    "5T": ["grasslands", "woodland", "mountains", "heaths", "arable", "ruins"].every((t) => terrains(b.ok).has(t as never)),
    "7T": false,
    "8T": b.ok.some((t) => category(t) === "merchant" && nextTo(b, t, "housing") && nextTo(b, t, "social") && nextTo(b, t, "travel")),
    "8B": b.ok.some((c) => c.hexIds.length === 1 && (() => { const r = ring(b, c.hexIds[0]); return Boolean(r && new Set([c, ...r].map(category)).size === 7); })()),
    "10T": b.ok.some((c) => category(c) === "wellbeing" && c.hexIds.length === 1 && (() => { const r = ring(b, c.hexIds[0]); return Boolean(r && r.filter((t) => ["housing", "social", "wellbeing"].includes(category(t))).length >= 4); })()),
    "11T": mapCells.some((c) => !b.byHex.has(c.id) && !isWater(c.id) && (() => { const r = ring(b, c.id); return Boolean(r && new Set(r.map(category)).size >= 4); })()),
    "11B": enclosedByTravel(b),
    "12T": strainRounds.some((byCat) => { const v = Object.values(byCat).map((x) => x ?? 0); return v.filter((x) => x > 0).length >= 2 && v.reduce((a, x) => a + x, 0) >= 3; }),
    "14T": (run.upgradeActions ?? 0) >= by([5, 8, 10, 11, 13], p),
    "17T": travel(b).some((t) => [...b.adj.get(t.instanceId)!].filter((id) => category(b.ok.find((o) => o.instanceId === id)!) === "travel").length >= 3 && nextTo(b, t, "merchant")),
    "17B": longRoad(b)
  };
}

function vowBreaks(s: GameState, b: Board): Record<string, boolean> {
  const all = s.map.placedTiles;
  const allHousing = all.filter((t) => category(t) === "housing");
  const allTravel = all.filter((t) => category(t) === "travel");
  const touches = (a: PlacedTile, c: PlacedTile) => a.hexIds.some((h) => getHexNeighbors(h).some((n) => c.hexIds.includes(n)));
  const housingGroups = (() => { const fake: Board = { ...b, ok: all, adj: new Map(all.map((t) => [t.instanceId, new Set(all.filter((o) => o !== t && touches(t, o)).map((o) => o.instanceId))])) }; return groups(fake, allHousing).length; })();
  return {
    "1B": all.some((t) => t.strain >= 3 && besideWater(t)),
    "2B": all.some((t) => t.strain >= 3 && category(t) === "housing"),
    "3B": all.some((t) => t.hexIds.some(isEdge)),
    "4B": all.some((t) => !["housing", "travel"].includes(category(t)) && all.some((o) => o !== t && category(o) === category(t) && touches(t, o))),
    "13B": all.some((t) => t.strain >= 3),
    "14B": all.some((t) => t.kind === "core" && t.side === "upgraded"),
    "15B": all.some((t) => t.strain >= 2),
    "16B": allTravel.length > 0,
    "19B": housingGroups > 1,
    "20B": allTravel.some((t) => allHousing.some((h) => touches(t, h)))
  };
}

function observe(s: GameState, w: Watch): void {
  const b = board(s);
  const p = s.playerCount;
  for (const [k, v] of Object.entries(momentChecks(s, b, p))) if (v) w.moments[k] = true;
  for (const [k, v] of Object.entries(vowBreaks(s, b))) if (v) w.broken[k] = true;
  w.maxOverstrained = Math.max(w.maxOverstrained, overstrained(s));
}

function finals(s: GameState, w: Watch): Record<string, boolean> {
  const b = board(s); const p = s.playerCount; const m = w.moments; const k = (id: string) => !w.broken[id];
  const h = housing(b);
  return {
    "1T": !!m["1T"], "1B": k("1B") && riverbankHexes(b) >= by([4, 6, 8, 10, 12], p),
    "2T": h.length >= by([4, 5, 7, 8, 10], p) && allHousingPaired(b), "2B": k("2B") && h.length >= by([4, 5, 7, 8, 10], p),
    "3T": !!m["3T"], "3B": k("3B") && overstrained(s) === 0,
    "4T": !!m["4T"], "4B": k("4B") && cats(b).size >= by([6, 6, 7, 7, 7], p),
    "5T": !!m["5T"], "5B": ["A1", "A9", "N1", "N9"].filter((x) => b.byHex.has(x)).length >= 3 && ["grasslands", "woodland", "mountains", "heaths", "arable", "ruins"].every((t) => terrains(b.ok).has(t as never)) && hasConnectedBridgeCrossing(b.ok),
    "6T": b.ok.filter((t) => t.tileId === "c04_farmstead" && nextTo(b, t, "housing")).length >= 2, "6B": resourceIds.every((id) => copies(b, id) >= 2),
    "7T": b.ok.filter((t) => t.tileId === "c02_mine_tunnel" && nextTo(b, t, "travel")).length >= 2, "7B": resourceIds.filter((id) => copies(b, id, true) >= 2).length >= 3,
    "8T": !!m["8T"], "8B": !!m["8B"],
    "9T": groups(b, h).some((g) => g.length >= 4 && b.ok.some((t) => category(t) === "social" && g.some((x) => b.adj.get(t.instanceId)!.has(x.instanceId))) && b.ok.some((t) => category(t) === "wellbeing" && g.some((x) => b.adj.get(t.instanceId)!.has(x.instanceId)))),
    "9B": largestHousing(b) >= by([6, 6, 7, 8, 9], p),
    "10T": !!m["10T"], "10B": b.ok.some((c) => c.tileId === "c18_common_land" && c.hexIds.length === 1 && (() => { const r = ring(b, c.hexIds[0]); return Boolean(r && r.every((t) => category(t) === "housing")); })()),
    "11T": !!m["11T"], "11B": !!m["11B"],
    "12T": !!m["12T"], "12B": w.maxOverstrained >= 2 && overstrained(s) === 0,
    "13T": (() => { const sup = b.ok.filter((t) => t.support.passive || t.support.singleUse); return sup.length >= 6 && new Set(sup.map(category)).size >= 3; })(),
    "13B": k("13B") && strainOnMap(s) <= by([4, 8, 12, 16, 20], p),
    "14T": !!m["14T"], "14B": k("14B") && h.length >= by([4, 5, 7, 8, 10], p) && allHousingPaired(b),
    "15T": b.ok.some((t) => t.tileId === "c11_washhouse" && nextTo(b, t, "crafting") && nextTo(b, t, "merchant") && nextTo(b, t, "social")),
    "15B": k("15B") && cats(b).size >= by([6, 6, 7, 7, 7], p),
    "16T": b.ok.some((tr) => tr.tileId === "c17_track" && b.ok.filter((t) => category(t) === "crafting" && b.adj.get(tr.instanceId)!.has(t.instanceId)).length >= 2 && b.ok.filter((t) => category(t) === "merchant" && b.adj.get(tr.instanceId)!.has(t.instanceId)).length >= 2),
    "16B": k("16B") && largestHousing(b) >= by([4, 4, 5, 6, 7], p),
    "17T": !!m["17T"], "17B": !!m["17B"],
    "18T": ["housing", "merchant", "social", "wellbeing"].every((c) => b.ok.some((t) => category(t) === c && besideWater(t))),
    "18B": hasConnectedBridgeCrossing(b.ok) && new Set(groups(b, h).filter((g) => g.length >= 3 && g.some((x) => nextTo(b, x, "social"))).map((g) => bankOf.get(g[0].hexIds[0]))).size >= 2,
    "19T": terrains(h.filter((t) => t.hexIds.every((x) => mapById[x]?.terrain !== "grasslands"))).size >= 3,
    "19B": k("19B") && largestHousing(b) >= by([5, 5, 6, 7, 8], p),
    "20T": groups(b, travel(b)).some((g) => ["c01_lumber_yard", "c02_mine_tunnel", "c04_farmstead"].every((id) => b.ok.some((t) => t.tileId === id && g.some((tr) => b.adj.get(tr.instanceId)!.has(t.instanceId))))),
    "20B": k("20B") && cats(b).size >= by([6, 6, 7, 7, 7], p),
    "21T": (() => { const br = b.ok.filter((t) => t.tileId === "c19_bridge"); return br.length >= 2 && br.some((t) => t.side === "upgraded"); })(),
    "21B": strainOnMap(s) === 0
  };
}

/**
 * Resolves the effect queue one effect at a time. It tries the engine's own
 * suggested adjustment first, then payments, then the same candidate lists as
 * the fixture resolver, plus Arrival timer choices and Strain cascades.
 */
function robustSettle(input: GameState): GameState {
  let state = input;
  for (let guard = 0; guard < 150; guard++) {
    if (state.pendingDeckReorder) { state = trackLedgerTransition(state, skipDeckReorder(state)); continue; }
    if (!state.pendingEffects.length) return state;
    const prepared = preparePendingEffectQueueHead(state);
    if (prepared !== state) state = trackLedgerTransition(state, prepared);
    const pending = state.pendingEffects[0];
    const tiles = state.map.placedTiles;
    const choices: EffectAdjustment[] = [];
    if (pending.suggestedAdjustment) choices.push(pending.suggestedAdjustment);
    const alternative = getAlternativeEffectRule(state, pending.ruleId);
    if (alternative?.kind === "pay_or_strain" || alternative?.kind === "pay_or_timer") {
      for (const resource of alternative.resources) choices.push({ resourceDeltas: { [resource]: -alternative.resourceStep * alternative.requiredChoices } });
    }
    choices.push({});
    for (const tile of tiles) for (const delta of [-1, 1, -2, 2, -3, 3]) choices.push({ tileStrainDeltas: { [tile.instanceId]: delta } });
    for (const resource of resources) for (let amount = 1; amount <= 6; amount++) choices.push({ resourceDeltas: { [resource]: -amount } });
    for (const first of tiles) for (const second of tiles) if (first !== second) choices.push({ tileStrainDeltas: { [first.instanceId]: 1, [second.instanceId]: 1 } });
    for (let a = 0; a < tiles.length; a++) for (let b = a + 1; b < tiles.length; b++) for (let c = b + 1; c < tiles.length && choices.length < 60000; c++) choices.push({ tileStrainDeltas: { [tiles[a].instanceId]: 1, [tiles[b].instanceId]: 1, [tiles[c].instanceId]: 1 } });
    for (const resource of resources) for (let amount = 1; amount <= 6; amount++) choices.push({ resourceDeltas: { [resource]: amount } });
    const arrivals = state.encounters.activeArrivals.map((a) => a.cardId);
    for (let mask = (1 << arrivals.length) - 1; mask >= 0; mask--) {
      for (let pay = 0; pay <= arrivals.length; pay++) {
        const timers: Record<string, number> = {}; let paid = 0;
        arrivals.forEach((id, i) => { if (mask & (1 << i)) { if (paid < pay) paid++; else timers[id] = -1; } });
        for (const resource of resources) choices.push({ arrivalTimerDeltas: timers, resourceDeltas: paid ? { [resource]: -paid } : {} });
      }
    }
    const touches = (a: PlacedTile, c: PlacedTile) => a.hexIds.some((h) => getHexNeighbors(h).some((n) => c.hexIds.includes(n)));
    for (const anchor of tiles) {
      const near = tiles.filter((t) => t !== anchor && touches(anchor, t));
      choices.push({ strainCascadeAnchorTileId: anchor.instanceId, tileStrainDeltas: {} });
      for (let i = 0; i < near.length; i++) {
        choices.push({ strainCascadeAnchorTileId: anchor.instanceId, tileStrainDeltas: { [near[i].instanceId]: 1 } });
        for (let j = i + 1; j < near.length; j++) choices.push({ strainCascadeAnchorTileId: anchor.instanceId, tileStrainDeltas: { [near[i].instanceId]: 1, [near[j].instanceId]: 1 } });
      }
    }
    const ids = tiles.map((t) => t.instanceId);
    for (let size = 1; size <= 3; size++) {
      const pick = (startAt: number, chosen: string[]) => {
        if (chosen.length === size) { choices.push({ supportTileIds: chosen }); return; }
        for (let index = startAt; index < ids.length && choices.length < 80000; index++) pick(index + 1, [...chosen, ids[index]]);
      };
      pick(0, []);
    }
    let next: GameState | undefined;
    for (const choice of choices) {
      const candidate = resolvePendingEffect(state, choice);
      if (!candidate.pendingEffects.some((effect) => effect.id === pending.id)) { next = candidate; break; }
    }
    if (!next && pending.canSkip) next = skipPendingEffect(state);
    if (!next) throw new Error(`No resolution for ${pending.ruleId}`);
    state = trackLedgerTransition(state, next);
  }
  throw new Error("robustSettle guard");
}

function seededRandom(text: string): () => number {
  let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let r = h; r = Math.imul(r ^ (r >>> 15), r | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

export function playGame(players: PlayerCount, seed: string, vow?: string) {
  const rnd = seededRandom(seed);
  const pool = stewards.map((x) => x.id).sort(() => rnd() - 0.5).slice(0, players);
  const w = newWatch();
  const value = (s: GameState) => {
    if (vow) { const b = board(s); if (vowBreaks(s, b)[vow]) return -1e9; }
    return carefulValueOf(s);
  };
  const track = (before: GameState, after: GameState) => { const n = trackLedgerTransition(before, after); observe(n, w); return n; };
  const resolve = (s: GameState) => robustSettle(s);
  let game = startStewards(createNewGame(players, pool, { encounterSeed: seed }));
  for (let guard = 0; game.phase !== "gameEnd" && guard < 600; guard++) {
    if (game.phase === "seeding") game = seedSeason(game);
    else if (game.phase === "reveal") game = advance(game, revealEncounters);
    else if (game.phase === "endRound") game = advance(game, resolveEndRound);
    else if (game.phase === "turns") game = playTurn(game, resolve, track, resolve, value);
    game = resolve(game);
    observe(game, w);
  }
  if (game.phase !== "gameEnd") throw new Error("game did not finish");
  const b = board(game);
  return {
    players, seed, stewards: pool, vow: vow ?? null,
    score: calculateFinalScore(game).finalScore,
    tiles: game.map.placedTiles.length, housing: housing(b).length, travel: travel(b).length, categories: cats(b).size,
    upgrades: getLedgerRun(game).upgradeActions ?? 0, strain: strainOnMap(game), overstrained: overstrained(game), maxOverstrained: w.maxOverstrained,
    broken: Object.keys(w.broken),
    met: Object.entries(finals(game, w)).filter(([, v]) => v).map(([k]) => k)
  };
}

const [count, games, prefix, mode] = process.argv.slice(2);
for (let i = 0; i < Number(games); i++) {
  const seed = `${prefix}-${count}p-${i}`;
  const vow = mode?.startsWith("vow:") ? mode.slice(4) : undefined;
  const t0 = Date.now();
  try { console.log(JSON.stringify({ ...playGame(Number(count) as PlayerCount, seed, vow), ms: Date.now() - t0 })); }
  catch (e) { console.log(JSON.stringify({ players: Number(count), seed, error: String(e).slice(0, 200), ms: Date.now() - t0 })); }
}

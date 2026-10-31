/**
 * Chronicle Cards: checks the drawn card's two quests against the game.
 *
 * - Moment quests are met the instant the board shows them, and stay met.
 * - Vow quests are watched after every change; a broken Vow stays broken.
 *   Its "Keep it" line is checked at final scoring.
 * - Final quests are checked at final scoring.
 * Shapes and counts use non-Overstrained tiles; Vow breaks look at every tile.
 */
import {
  chronicleCardByNumber,
  keepValue,
  stripValue,
  type ChronicleCard,
  type ChronicleHalfKey
} from "../data/chronicleCards";
import { mapById, mapCells } from "../data/map";
import { coreTileById, goldenTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import { getLedgerRun } from "./ledger";
import type { ChronicleRunState, GameState, PlacedTile, TileCategory } from "./types";

export type ChronicleQuestId = `${number}${"T" | "B"}`;
export type ChronicleHalfStatus = "met" | "open" | "broken";

export interface ChronicleHalfResult {
  id: ChronicleQuestId;
  half: ChronicleHalfKey;
  status: ChronicleHalfStatus;
}

export interface ChronicleResult {
  card: ChronicleCard;
  top: ChronicleHalfResult;
  bottom: ChronicleHalfResult;
  complete: boolean;
}

// ---------------------------------------------------------------- board helpers

function category(tile: PlacedTile): TileCategory {
  if (tile.tileId.startsWith("golden_tile_")) return goldenTileById[tile.tileId]?.category ?? "special";
  return tile.kind === "special"
    ? specialTileById[tile.tileId]?.category ?? "special"
    : coreTileById[tile.tileId]?.category ?? "special";
}

const isWater = (hexId: string) => mapById[hexId]?.terrain === "water";
const isEdge = (hexId: string) => {
  const cell = mapById[hexId];
  return Boolean(cell && (cell.col === "A" || cell.col === "N" || cell.row === 1 || cell.row === 9));
};
const corners = ["A1", "A9", "N1", "N9"];
const besideWater = (tile: PlacedTile) => tile.hexIds.some((h) => getHexNeighbors(h).some(isWater));
const overstrained = (tile: PlacedTile) => tile.strain >= 3;
const touches = (a: PlacedTile, b: PlacedTile) =>
  a !== b && a.hexIds.some((h) => getHexNeighbors(h).some((n) => b.hexIds.includes(n)));

// Each land hex belongs to one bank of the river.
const bankOf = new Map<string, number>();
for (const cell of mapCells) {
  if (cell.terrain === "water" || bankOf.has(cell.id)) continue;
  const bank = bankOf.size === 0 ? 0 : Math.max(...bankOf.values()) + 1;
  const queue = [cell.id];
  bankOf.set(cell.id, bank);
  for (let i = 0; i < queue.length; i += 1) {
    for (const next of getHexNeighbors(queue[i])) {
      if (mapById[next] && !isWater(next) && !bankOf.has(next)) { bankOf.set(next, bank); queue.push(next); }
    }
  }
}

interface Board {
  all: PlacedTile[];
  ok: PlacedTile[];
  byHex: Map<string, PlacedTile>;
  beside: (tile: PlacedTile, cat: TileCategory) => boolean;
  neighbours: (tile: PlacedTile) => PlacedTile[];
}

function board(tiles: PlacedTile[]): Board {
  const ok = tiles.filter((t) => !overstrained(t));
  const byHex = new Map<string, PlacedTile>();
  for (const t of ok) for (const h of t.hexIds) byHex.set(h, t);
  const neighbours = (tile: PlacedTile) => ok.filter((other) => touches(tile, other));
  return { all: tiles, ok, byHex, neighbours, beside: (tile, cat) => neighbours(tile).some((n) => category(n) === cat) };
}

function groups(members: PlacedTile[]): PlacedTile[][] {
  const left = new Set(members);
  const out: PlacedTile[][] = [];
  for (const first of members) {
    if (!left.has(first)) continue;
    left.delete(first);
    const group = [first];
    for (let i = 0; i < group.length; i += 1) {
      for (const other of left) if (touches(group[i], other)) { left.delete(other); group.push(other); }
    }
    out.push(group);
  }
  return out;
}

function ring(b: Board, hexId: string): PlacedTile[] | null {
  const around = getHexNeighbors(hexId);
  if (around.length !== 6) return null;
  const tiles = around.map((h) => b.byHex.get(h));
  if (tiles.some((t) => !t)) return null;
  return new Set(tiles.map((t) => t!.instanceId)).size === 6 ? (tiles as PlacedTile[]) : null;
}

const ofCategory = (tiles: PlacedTile[], cat: TileCategory) => tiles.filter((t) => category(t) === cat);
const categoryCount = (b: Board) => new Set(b.ok.map(category).filter((c) => c !== "special")).size;
const terrainCount = (tiles: PlacedTile[]) =>
  new Set(tiles.flatMap((t) => t.hexIds.map((h) => mapById[h]?.terrain)).filter((t) => t && t !== "water")).size;
const largestCluster = (b: Board) => Math.max(0, ...groups(ofCategory(b.ok, "housing")).map((g) => g.length));
const pairedHousing = (b: Board) => {
  const homes = ofCategory(b.ok, "housing");
  return homes.length > 0 && homes.every((h) => b.beside(h, "housing")) ? homes.length : 0;
};
const strainOnMap = (tiles: PlacedTile[]) => tiles.reduce((sum, t) => sum + t.strain, 0);
const copies = (b: Board, tileId: string, upgraded = false) =>
  b.ok.filter((t) => t.tileId === tileId && (!upgraded || t.side === "upgraded")).length;
const resourceTiles = ["c01_lumber_yard", "c02_mine_tunnel", "c03_gathering_outpost", "c04_farmstead"];

/** Bridges whose land neighbours hold tiles on both banks. */
function crossings(b: Board): number {
  return b.ok.filter((t) => t.tileId === "c19_bridge").filter((bridge) => {
    const banks = new Set<number>();
    for (const h of bridge.hexIds) for (const n of getHexNeighbors(h)) {
      const tile = b.byHex.get(n);
      if (tile && tile !== bridge && !isWater(n)) banks.add(bankOf.get(n)!);
    }
    return banks.size >= 2;
  }).length;
}

/** Non-Travel tiles that a loop of Travel tiles cuts off from the map's edge. */
function enclosedByTravel(b: Board): number {
  const road = new Set(ofCategory(b.ok, "travel").flatMap((t) => t.hexIds));
  const outside = new Set<string>();
  const queue: string[] = [];
  for (const cell of mapCells) if (!road.has(cell.id) && getHexNeighbors(cell.id).length < 6) { outside.add(cell.id); queue.push(cell.id); }
  for (let i = 0; i < queue.length; i += 1) {
    for (const n of getHexNeighbors(queue[i])) if (mapById[n] && !road.has(n) && !outside.has(n)) { outside.add(n); queue.push(n); }
  }
  return b.ok.filter((t) => category(t) !== "travel" && t.hexIds.every((h) => !outside.has(h))).length;
}

function rowSpan(text: string): [number, number] {
  const [from, to] = text.split(/[–-]/).map(Number);
  return [from, to];
}

// ---------------------------------------------------------------- the 42 quests

interface QuestCheck {
  /** Moments: true when the board shows it now. Finals: true at the end. */
  goal?: (s: GameState, b: Board, card: ChronicleCard) => boolean;
  /** Vows: true when this change breaks it. */
  breaks?: (s: GameState, b: Board, card: ChronicleCard) => boolean;
  /** Vows: the Keep it line, checked at the end. */
  keep?: (s: GameState, b: Board, card: ChronicleCard) => boolean;
}

const p = (s: GameState) => s.playerCount;
const T = (card: ChronicleCard, label: string, s: GameState) => Number(stripValue(card.top, label, p(s)));
const B = (card: ChronicleCard, label: string, s: GameState) => stripValue(card.bottom, label, p(s));
const K = (card: ChronicleCard, s: GameState) => keepValue(card.bottom, p(s));
const atOnce = (tiles: PlacedTile[], test: (t: PlacedTile) => boolean, limit: number) => tiles.filter(test).length > limit;

const quests: Record<string, QuestCheck> = {
  "1T": { goal: (s, b, c) => crossings(b) >= T(c, "Crossings", s) },
  "1B": {
    breaks: (s, b, c) => atOnce(b.all, (t) => overstrained(t) && besideWater(t), Number(B(c, "Limit", s))),
    keep: (s, b, c) => new Set(b.ok.flatMap((t) => t.hexIds).filter((h) => !isWater(h) && getHexNeighbors(h).some(isWater))).size >= K(c, s)
  },
  "2T": { goal: (s, b, c) => pairedHousing(b) >= T(c, "Housing", s) },
  "2B": {
    breaks: (s, b, c) => atOnce(b.all, (t) => overstrained(t) && category(t) === "housing", Number(B(c, "Limit", s))),
    keep: (s, b, c) => ofCategory(b.ok, "housing").length >= K(c, s)
  },
  "3T": { goal: (s, b, c) => corners.filter((h) => b.byHex.has(h)).length >= T(c, "Corners", s) },
  "3B": {
    breaks: (s, b, c) => atOnce(b.all, (t) => overstrained(t) && t.hexIds.some(isEdge), Number(B(c, "Limit", s))),
    keep: (s, b, c) => new Set(b.ok.flatMap((t) => t.hexIds).filter(isEdge)).size >= K(c, s)
  },
  "4T": { goal: (s, b, c) => categoryCount(b) >= T(c, "Categories", s) },
  "4B": {
    breaks: (_s, b) => b.all.some((t) => !["housing", "travel", "resource"].includes(category(t)) &&
      b.all.some((o) => category(o) === category(t) && touches(t, o))),
    keep: (s, b, c) => categoryCount(b) >= K(c, s)
  },
  "5T": { goal: (s, b, c) => terrainCount(b.ok) >= T(c, "Terrains", s) },
  "5B": {
    goal: (s, b, c) => corners.filter((h) => b.byHex.has(h)).length >= Number(B(c, "Corners", s)) &&
      terrainCount(b.ok) >= Number(B(c, "Terrains", s)) && crossings(b) >= 1
  },
  "6T": { goal: (s, b, c) => b.ok.filter((t) => t.tileId === "c04_farmstead" && b.beside(t, "housing")).length >= T(c, "Farmsteads", s) },
  "6B": { goal: (s, b, c) => resourceTiles.every((id) => copies(b, id) >= Number(B(c, "Of each", s))) },
  "7T": { goal: (s, b, c) => b.ok.filter((t) => t.tileId === "c02_mine_tunnel" && b.beside(t, "travel")).length >= T(c, "Mine Tunnels", s) },
  "7B": { goal: (s, b, c) => resourceTiles.filter((id) => copies(b, id, true) >= 2).length >= Number(B(c, "Kinds", s)) },
  "8T": {
    goal: (s, b, c) => ofCategory(b.ok, "merchant").filter((t) =>
      b.beside(t, "housing") && b.beside(t, "social") && b.beside(t, "travel")).length >= T(c, "Merchants", s)
  },
  "8B": {
    goal: (s, b, c) => b.ok.some((centre) => {
      if (centre.hexIds.length !== 1) return false;
      const around = ring(b, centre.hexIds[0]);
      if (!around) return false;
      const seven = [centre, ...around];
      if (p(s) >= 4 && seven.some((t) => t.strain > 0)) return false;
      return new Set(seven.map(category)).size >= Number(B(c, "Categories", s));
    })
  },
  "9T": {
    goal: (s, b, c) => groups(ofCategory(b.ok, "housing")).some((g) => g.length >= T(c, "Cluster", s) &&
      g.some((h) => b.beside(h, "social")) && g.some((h) => b.beside(h, "wellbeing")))
  },
  "9B": { goal: (s, b, c) => largestCluster(b) >= Number(B(c, "Cluster", s)) },
  "10T": {
    goal: (s, b, c) => ofCategory(b.ok, "wellbeing").filter((centre) => {
      const around = centre.hexIds.length === 1 ? ring(b, centre.hexIds[0]) : null;
      return Boolean(around && around.filter((t) => ["housing", "social", "wellbeing"].includes(category(t))).length >= 4);
    }).length >= T(c, "Rings", s)
  },
  "10B": {
    goal: (s, b, c) => b.ok.some((centre) => {
      if (centre.tileId !== "c18_common_land" || centre.hexIds.length !== 1) return false;
      const around = ring(b, centre.hexIds[0]);
      if (!around) return false;
      if (p(s) >= 4 && [centre, ...around].some((t) => t.strain > 0)) return false;
      return ofCategory(around, "housing").length >= Number(B(c, "Housing in the ring", s));
    })
  },
  "11T": {
    goal: (s, b, c) => mapCells.filter((cell) => {
      if (isWater(cell.id) || b.byHex.has(cell.id)) return false;
      const around = ring(b, cell.id);
      return Boolean(around && new Set(around.map(category)).size >= 4);
    }).length >= T(c, "Courtyards", s)
  },
  "11B": { goal: (s, b, c) => enclosedByTravel(b) >= Number(B(c, "Tiles inside", s)) },
  "12T": {
    goal: (s, _b, c) => Object.values(getLedgerRun(s).strainRemovedByRoundCategory ?? {}).some((byCategory) => {
      const amounts = Object.values(byCategory).map((x) => x ?? 0);
      const total = amounts.reduce((sum, x) => sum + x, 0);
      return total >= T(c, "Strain removed", s) && (p(s) === 1 || amounts.filter((x) => x > 0).length >= 2);
    })
  },
  "12B": {
    goal: (s, b, c) => (s.chronicleRun?.peakOverstrained ?? 0) >= Number(B(c, "Overstrained at once", s)) &&
      b.all.every((t) => !overstrained(t))
  },
  "13T": {
    goal: (s, b, c) => {
      const sheltered = b.ok.filter((t) => t.support.passive || t.support.singleUse);
      return sheltered.length >= T(c, "Supported", s) && new Set(sheltered.map(category)).size >= (p(s) === 1 ? 2 : 3);
    }
  },
  "13B": {
    breaks: (s, b, c) => atOnce(b.all, overstrained, Number(B(c, "Limit", s))),
    keep: (s, b, c) => strainOnMap(b.all) <= K(c, s)
  },
  "14T": { goal: (s, _b, c) => (getLedgerRun(s).upgradeActions ?? 0) >= T(c, "Upgrades", s) },
  "14B": {
    breaks: (_s, b) => b.all.some((t) => t.kind === "core" && t.side === "upgraded"),
    keep: (s, b, c) => pairedHousing(b) >= K(c, s)
  },
  "15T": {
    goal: (s, b) => b.ok.some((t) => t.tileId === "c11_washhouse" && b.beside(t, "crafting") && b.beside(t, "merchant") &&
      b.beside(t, "social") && (p(s) < 4 || b.beside(t, "housing")))
  },
  "15B": {
    breaks: (s, b, c) => atOnce(b.all, (t) => t.strain >= 2, Number(B(c, "Limit", s))),
    keep: (s, b, c) => categoryCount(b) >= K(c, s)
  },
  "16T": {
    goal: (s, b, c) => b.ok.some((track) => track.tileId === "c17_track" &&
      b.neighbours(track).filter((t) => category(t) === "crafting").length >= T(c, "Of each", s) &&
      b.neighbours(track).filter((t) => category(t) === "merchant").length >= T(c, "Of each", s))
  },
  "16B": {
    breaks: (_s, b) => b.all.some((t) => category(t) === "travel"),
    keep: (s, b, c) => categoryCount(b) >= K(c, s)
  },
  "17T": {
    goal: (_s, b) => ofCategory(b.ok, "travel").some((t) =>
      b.neighbours(t).filter((n) => category(n) === "travel").length >= 3 && b.beside(t, "merchant"))
  },
  "17B": {
    goal: (s, b, c) => {
      const [from, to] = rowSpan(String(B(c, "Rows", s)));
      return groups(ofCategory(b.ok, "travel")).some((g) => {
        const cells = g.flatMap((t) => t.hexIds).map((h) => mapById[h]).filter(Boolean);
        const rows = new Set(cells.map((cell) => cell.row));
        const cols = new Set(cells.map((cell) => cell.col));
        return rows.has(from) && rows.has(to) && (p(s) < 4 || (cols.has("A") && cols.has("N")));
      });
    }
  },
  "18T": {
    goal: (s, b, c) => ["housing", "merchant", "social", "wellbeing"].filter((cat) =>
      b.ok.some((t) => category(t) === cat && besideWater(t))).length >= T(c, "Kinds", s)
  },
  "18B": {
    goal: (s, b, c) => crossings(b) >= 1 && new Set(groups(ofCategory(b.ok, "housing"))
      .filter((g) => g.length >= Number(B(c, "Cluster on each bank", s)) && g.some((h) => b.beside(h, "social")))
      .map((g) => bankOf.get(g[0].hexIds[0]))).size >= 2
  },
  "19T": {
    goal: (s, b, c) => terrainCount(ofCategory(b.ok, "housing").filter((t) =>
      t.hexIds.every((h) => mapById[h]?.terrain !== "grasslands"))) >= T(c, "Terrains", s)
  },
  "19B": {
    breaks: (_s, b) => groups(ofCategory(b.all, "housing")).length > 1,
    keep: (s, b, c) => largestCluster(b) >= K(c, s)
  },
  "20T": {
    goal: (s, b) => {
      const needed = ["c01_lumber_yard", "c02_mine_tunnel", "c04_farmstead", ...(p(s) >= 4 ? ["c03_gathering_outpost"] : [])];
      return groups(ofCategory(b.ok, "travel")).some((g) =>
        needed.every((id) => b.ok.some((t) => t.tileId === id && g.some((road) => touches(t, road)))));
    }
  },
  "20B": {
    breaks: (_s, b) => b.all.some((t) => category(t) === "travel" && b.all.some((h) => category(h) === "housing" && touches(t, h))),
    keep: (s, b, c) => categoryCount(b) >= K(c, s)
  },
  "21T": {
    goal: (s, b, c) => {
      const bridges = b.ok.filter((t) => t.tileId === "c19_bridge");
      return bridges.length >= T(c, "Bridges", s) && bridges.some((t) => t.side === "upgraded");
    }
  },
  "21B": { goal: (s, b, c) => strainOnMap(b.all) <= Number(B(c, "Strain", s)) }
};

// ---------------------------------------------------------------- run tracking

export function createChronicleRun(cardNumber: number): ChronicleRunState {
  if (!chronicleCardByNumber[cardNumber]) throw new Error(`Unknown Chronicle Card ${cardNumber}.`);
  return { cardNumber, moments: [], broken: [], peakOverstrained: 0 };
}

const questId = (card: ChronicleCard, half: ChronicleHalfKey) => `${card.n}${half === "top" ? "T" : "B"}` as ChronicleQuestId;

/** Updates the drawn card's Moments, Vows and peak Overstrain after a change. */
export function trackChronicle(state: GameState): GameState {
  const run = state.chronicleRun;
  if (!run) return state;
  const card = chronicleCardByNumber[run.cardNumber];
  const b = board(state.map.placedTiles);
  const withPeak = { ...state, chronicleRun: { ...run, peakOverstrained: Math.max(run.peakOverstrained, b.all.filter(overstrained).length) } };
  const moments = [...run.moments];
  const broken = [...run.broken];
  for (const half of ["top", "bottom"] as const) {
    const id = questId(card, half);
    const check = quests[id];
    const kind = card[half];
    if (kind.check === "Moment" && !moments.includes(id) && check.goal?.(withPeak, b, card)) moments.push(id);
    if (kind.kind === "Vow" && !broken.includes(id) && check.breaks?.(withPeak, b, card)) broken.push(id);
  }
  const next = { ...withPeak.chronicleRun, moments, broken };
  const same = next.peakOverstrained === run.peakOverstrained && moments.length === run.moments.length && broken.length === run.broken.length;
  return same ? state : { ...state, chronicleRun: next };
}

/**
 * Where each half stands now. Before the game ends, Final quests and Keep it
 * lines read "open"; at game end they are checked.
 */
export function evaluateChronicle(state: GameState): ChronicleResult | null {
  const run = state.chronicleRun;
  if (!run) return null;
  const card = chronicleCardByNumber[run.cardNumber];
  const b = board(state.map.placedTiles);
  const ended = state.phase === "gameEnd";
  const result = (half: ChronicleHalfKey): ChronicleHalfResult => {
    const id = questId(card, half);
    const check = quests[id];
    const kind = card[half];
    let status: ChronicleHalfStatus = "open";
    if (kind.kind === "Vow") {
      if (run.broken.includes(id)) status = "broken";
      else if (ended && check.keep?.(state, b, card)) status = "met";
    } else if (kind.check === "Moment") {
      if (run.moments.includes(id)) status = "met";
    } else if (ended && check.goal?.(state, b, card)) {
      status = "met";
    }
    return { id, half, status };
  };
  const top = result("top");
  const bottom = result("bottom");
  return { card, top, bottom, complete: top.status === "met" || bottom.status === "met" };
}

/** Every quest id has a check; used by the data tests. */
export function chronicleQuestIds(): string[] {
  return Object.keys(quests);
}

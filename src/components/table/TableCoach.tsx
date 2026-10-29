import { useEffect, useState } from "react";
import { ArrowRight, Compass, X } from "lucide-react";
import { stewardById } from "../../data/stewards";
import { getStorageKey } from "../../app/experience";
import { getActivatableTileIds } from "../../engine/gameActions";
import { getLegalPlacementHexes, getTileCategory } from "../../engine/placementRules";
import type { GameState } from "../../engine/types";

/**
 * The guided first game. One short tip at a time, chosen from what is on the
 * table and what the player has already done. Each tip says what to do in one
 * line and lights up where to do it: a beacon on the board, or a glow on the
 * card or control. It never blocks play, and it can be hidden or switched off.
 */
export interface CoachTarget {
  /** Spaces or tiles on the board to light up. */
  hexIds?: string[];
  /** A short label floating over the first lit space, e.g. "Build here". */
  label?: string;
  /** A part of the screen to glow. */
  ui?: "arrivals" | "end-turn" | "score" | "encounters" | "seed";
}

interface Step {
  id: string;
  when: (state: GameState) => boolean;
  /** Steps that finish when something happens, rather than with "Got it". */
  done?: (state: GameState) => boolean;
  title: string;
  /** Why it matters, in a sentence or two. */
  why: (state: GameState) => string;
  /** What to do now, as one short instruction. */
  doThis?: (state: GameState) => string;
  target?: (state: GameState) => CoachTarget | null;
  final?: boolean;
}

const logged = (state: GameState, pattern: RegExp) => state.log.some((entry) => pattern.test(entry.message));
const tiles = (state: GameState) => state.map.placedTiles.length;
const steward = (state: GameState) => {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId) ?? state.players[0];
  return { id: player.id, name: stewardById[player.stewardId]?.name ?? "Your Steward", hex: player.stewardHexId };
};
const producers = (state: GameState) => {
  const ids = new Set(getActivatableTileIds(state, state.currentPlayerId));
  return state.map.placedTiles.filter((tile) => ids.has(tile.instanceId) && getTileCategory(tile) === "resource").flatMap((tile) => tile.hexIds.slice(0, 1));
};

const steps: Step[] = [
  {
    id: "seed",
    when: (state) => state.phase === "seeding" && state.season === 1,
    done: (state) => state.phase !== "seeding",
    title: "Shape the Season ahead",
    why: () => "Each Season starts with seeding: three cards from your hand go secretly into the Encounter Deck. Arrivals are newcomers, Burdens are troubles and Boons help.",
    doThis: () => "Pick a card for Top, Middle and Bottom, then confirm.",
    target: () => ({ ui: "seed" })
  },
  {
    id: "first-tile",
    when: (state) => state.phase === "turns" && tiles(state) === 0,
    done: (state) => tiles(state) > 0,
    title: "Build your first tile",
    why: (state) => `${steward(state).name} stands on the glowing space. Each of the four dots is one action this turn.`,
    doThis: () => "Tap the glowing space and choose a tile.",
    target: (state) => ({ hexIds: [steward(state).hex], label: "Build here" })
  },
  {
    id: "reach",
    when: (state) => state.phase === "turns" && tiles(state) === 1,
    done: (state) => tiles(state) > 1,
    title: "Grow the settlement",
    why: (state) => `New tiles must be within reach: next to ${steward(state).name}, or along connected Travel tiles.`,
    doThis: () => "Tap a glowing space beside your first tile.",
    target: (state) => ({ hexIds: getLegalPlacementHexes(state, state.currentPlayerId, "c15_path").slice(0, 6), label: "In reach" })
  },
  {
    id: "produce",
    when: (state) => state.phase === "turns" && tiles(state) >= 2 && !logged(state, /^Activated /),
    done: (state) => logged(state, /^Activated /),
    title: "Produce resources",
    why: () => "Production fills the shared Warehouse. Matching tiles beside each other produce together.",
    doThis: (state) => producers(state).length ? "Tap a glowing production tile, then Activate." : "Build a production tile, such as a Woodland or Farm, then Activate it.",
    target: (state) => { const hexIds = producers(state); return hexIds.length ? { hexIds, label: "Produce" } : null; }
  },
  {
    id: "end-turn",
    when: (state) => state.phase === "turns" && state.actionsRemaining === 0 && state.round === 1,
    done: (state) => state.round > 1,
    title: "End your turn",
    why: () => "Your four actions are spent. The round ends, Arrival timers tick down and new cards come out.",
    doThis: () => "Press End turn beside the board.",
    target: () => ({ ui: "end-turn" })
  },
  {
    id: "arrivals",
    when: (state) => state.phase === "turns" && state.encounters.activeArrivals.length > 0 && logged(state, /^Activated /),
    done: (state) => logged(state, /^Completed Arrival:/),
    title: "Welcome an Arrival",
    why: () => "Pay what an Arrival asks before its timer tokens run out. It scores Renown and unlocks a Special tile.",
    doThis: () => "Green ticks mean you have enough. Press Complete when you can.",
    target: () => ({ ui: "arrivals" })
  },
  {
    id: "reveal",
    when: (state) => state.phase === "turns" && state.round >= 2,
    title: "New encounters",
    why: () => "Each round reveals new cards. Effects with no choice settle themselves. Anything that needs a decision opens beside the board, with its choices marked on the map.",
    target: () => ({ ui: "encounters" })
  },
  {
    id: "strain",
    when: (state) => state.phase === "turns" && state.map.placedTiles.some((tile) => tile.strain > 0),
    title: "Watch the Strain",
    why: () => "Dots under a tile are Strain, each −10 at the end. At 3 a tile is Overstrained and spreads Strain to a neighbour.",
    doThis: () => "Resolve Burdens and give tiles Supported to keep it down.",
    target: (state) => ({ hexIds: state.map.placedTiles.filter((tile) => tile.strain > 0).flatMap((tile) => tile.hexIds.slice(0, 1)), label: "Strained" })
  },
  {
    id: "score",
    when: (state) => state.phase === "turns" && state.round >= 3,
    title: "Score now",
    why: () => "The score at the top is the result if the game ended now. Twelve rounds make a game.",
    doThis: () => "Tap it to see how it adds up.",
    target: () => ({ ui: "score" })
  },
  {
    id: "finish",
    when: (state) => state.phase === "turns" && state.round >= 4,
    title: "You know the essentials",
    why: () => "Play on to the end of Season I and beyond, or jump into a moment from later in a game.",
    final: true
  }
];

function readDismissed(): string[] {
  try { return JSON.parse(window.localStorage.getItem(getStorageKey("quietVale.guide.v1")) ?? "[]"); } catch { return []; }
}

function writeDismissed(ids: string[]) {
  try { window.localStorage.setItem(getStorageKey("quietVale.guide.v1"), JSON.stringify(ids)); } catch { /* the guide still works for this visit */ }
}

export function TableCoach({ state, onTarget }: { state: GameState; onTarget?: (target: CoachTarget | null) => void }) {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [collapsed, setCollapsed] = useState(false);
  const step = dismissed.includes("off") ? undefined : steps.find((candidate) => !dismissed.includes(candidate.id) && !candidate.done?.(state) && candidate.when(state));
  const target = step && !collapsed ? step.target?.(state) ?? null : null;
  const targetKey = JSON.stringify(target);
  useEffect(() => { onTarget?.(target); }, [targetKey]);
  useEffect(() => () => onTarget?.(null), []);
  if (!step) return null;
  const position = steps.indexOf(step);

  function dismiss(ids: string[]) {
    const next = [...new Set([...dismissed, ...ids])];
    setDismissed(next);
    writeDismissed(next);
  }

  if (collapsed) return <button type="button" className="coach-pill" onClick={() => setCollapsed(false)} aria-label="Show the guide"><Compass size={15} aria-hidden="true" />Guide · {position + 1} of {steps.length}</button>;
  return <aside className="table-coach" aria-label="Guide" aria-live="polite" key={step.id}>
    <div className="coach-head">
      <span className="coach-emblem" aria-hidden="true"><Compass size={18} /></span>
      <ol className="coach-progress" aria-label={`Tip ${position + 1} of ${steps.length}`}>{steps.map((candidate, index) => <li key={candidate.id} className={index < position ? "is-done" : index === position ? "is-now" : ""} />)}</ol>
      <button type="button" className="coach-hide" aria-label="Hide the guide" onClick={() => setCollapsed(true)}><X size={16} /></button>
    </div>
    <h3>{step.title}</h3>
    <p className="coach-why">{step.why(state)}</p>
    {step.doThis && <p className="coach-do"><ArrowRight size={15} aria-hidden="true" />{step.doThis(state)}</p>}
    {step.final ? <nav className="coach-links" aria-label="Where next">
      <a href="?experience=table&scenario=showcase-chain">The Strain spreads</a>
      <a href="?experience=table&scenario=showcase-season">The turning of the Season</a>
      <a href="?experience=table&scenario=showcase-late">A thriving settlement</a>
      <button type="button" onClick={() => dismiss(["finish", "off"])}>Keep playing</button>
    </nav> : <footer>
      <button type="button" className="coach-ok" onClick={() => dismiss([step.id])}>{step.done ? "Skip this tip" : "Got it"}</button>
      <button type="button" className="coach-off" onClick={() => dismiss(["off"])}>Turn off the guide</button>
    </footer>}
  </aside>;
}

import { useState } from "react";
import { X } from "lucide-react";
import { stewardById } from "../../data/stewards";
import { getStorageKey } from "../../app/experience";
import type { GameState } from "../../engine/types";

/**
 * The guided first game. One short note at a time, chosen from what is on the
 * table and what the player has already done. It never blocks play: every
 * action stays available, and the guide can be hidden or switched off.
 */
interface Step {
  id: string;
  when: (state: GameState) => boolean;
  /** Steps that finish when something happens, rather than with "Got it". */
  done?: (state: GameState) => boolean;
  title: string;
  text: (state: GameState) => string;
  final?: boolean;
}

const logged = (state: GameState, pattern: RegExp) => state.log.some((entry) => pattern.test(entry.message));
const tiles = (state: GameState) => state.map.placedTiles.length;
const steward = (state: GameState) => {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId) ?? state.players[0];
  return { name: stewardById[player.stewardId]?.name ?? "Your Steward", hex: player.stewardHexId };
};

const steps: Step[] = [
  {
    id: "seed",
    when: (state) => state.phase === "seeding" && state.season === 1,
    done: (state) => state.phase !== "seeding",
    title: "Shape the Season ahead",
    text: () => "Every Season begins with seeding. Choose three cards from your hand for the Encounter Deck: the top one comes out first. Arrivals are newcomers who join if you meet their needs, Burdens are troubles, and Boons help."
  },
  {
    id: "first-tile",
    when: (state) => state.phase === "turns" && tiles(state) === 0,
    done: (state) => tiles(state) > 0,
    title: "Build your first tile",
    text: (state) => `${steward(state).name} stands at ${steward(state).hex}. Tap that space to see what can be built there, with each tile's cost, then choose one. Each action uses one of your four dots.`
  },
  {
    id: "reach",
    when: (state) => state.phase === "turns" && tiles(state) === 1,
    done: (state) => tiles(state) > 1,
    title: "Build within reach",
    text: (state) => `${steward(state).name} moves to every tile it uses. New tiles must be within reach: next to your Steward, or along connected Travel tiles. Tap a space beside your first tile and build again.`
  },
  {
    id: "produce",
    when: (state) => state.phase === "turns" && tiles(state) >= 2 && !logged(state, /^Activated /),
    done: (state) => logged(state, /^Activated /),
    title: "Produce resources",
    text: () => "Tap a production tile, such as a Lumber Yard or Farmstead, then Activate it. Matching tiles linked to it produce too. The Warehouse at the top shows the result before you commit."
  },
  {
    id: "end-turn",
    when: (state) => state.phase === "turns" && state.actionsRemaining === 0 && state.round === 1,
    done: (state) => state.round > 1,
    title: "End your turn",
    text: () => "You have used your four actions. End your turn: the round ends, Arrival timers tick down and the next cards come out of the deck."
  },
  {
    id: "arrivals",
    when: (state) => state.phase === "turns" && state.encounters.activeArrivals.length > 0 && logged(state, /^Activated /),
    done: (state) => logged(state, /^Completed Arrival:/),
    title: "Welcome an Arrival",
    text: () => "The Arrivals beside the board are newcomers. Pay what one asks before its timer runs out to complete it: that costs 1 action, scores Renown and unlocks a Special tile. A green tick means you already have enough of that resource."
  },
  {
    id: "reveal",
    when: (state) => state.phase === "turns" && state.round >= 2,
    title: "New encounters",
    text: () => "A new round reveals new cards: the note at the bottom of the board lists them. Effects with no choice settle themselves. When a card needs a decision, it opens beside the board and its choices are marked on the map."
  },
  {
    id: "strain",
    when: (state) => state.phase === "turns" && state.map.placedTiles.some((tile) => tile.strain > 0),
    title: "Strain",
    text: () => "The dots under a tile are Strain. Each one costs 10 points at the end of the game. A tile with 3 is Overstrained: it stops scoring and spreads Strain to a neighbour. Resolving Burdens and giving tiles Supported keeps it down."
  },
  {
    id: "score",
    when: (state) => state.phase === "turns" && state.round >= 3,
    title: "Score now",
    text: () => "The score at the top is what you would score if the game ended now: Population and Renown from your tiles and Arrivals, minus penalties for Strain, active Burdens and Arrivals that leave unmet. A game lasts twelve rounds in three Seasons."
  },
  {
    id: "finish",
    when: (state) => state.phase === "turns" && state.round >= 4,
    title: "You know the essentials",
    text: () => "Play on to the end of Season I and beyond, or jump into a moment from later in a game.",
    final: true
  }
];

function readDismissed(): string[] {
  try { return JSON.parse(window.localStorage.getItem(getStorageKey("quietVale.guide.v1")) ?? "[]"); } catch { return []; }
}

function writeDismissed(ids: string[]) {
  try { window.localStorage.setItem(getStorageKey("quietVale.guide.v1"), JSON.stringify(ids)); } catch { /* the guide still works for this visit */ }
}

export function TableCoach({ state }: { state: GameState }) {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [collapsed, setCollapsed] = useState(false);
  const step = steps.find((candidate) => !dismissed.includes(candidate.id) && !candidate.done?.(state) && candidate.when(state));
  if (dismissed.includes("off") || !step) return null;
  const position = steps.indexOf(step) + 1;

  function dismiss(ids: string[]) {
    const next = [...new Set([...dismissed, ...ids])];
    setDismissed(next);
    writeDismissed(next);
  }

  if (collapsed) return <button type="button" className="coach-pill" onClick={() => setCollapsed(false)} aria-label="Show the guide">Guide · {position} of {steps.length}</button>;
  return <aside className="table-coach" aria-label="Guide" aria-live="polite">
    <header>
      <p className="eyebrow">Your first game · {position} of {steps.length}</p>
      <button type="button" className="coach-hide" aria-label="Hide the guide" onClick={() => setCollapsed(true)}><X size={16} /></button>
    </header>
    <h3>{step.title}</h3>
    <p>{step.text(state)}</p>
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

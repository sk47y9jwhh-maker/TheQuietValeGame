import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Play, RotateCcw } from "lucide-react";
import type { TourStep } from "./tourScript";
import type { GameState } from "../../engine/types";

/**
 * Demo walkthroughs. A demo is always a walkthrough: one card with Next and
 * Back, and the table plays each step itself. There is no half-way state.
 * The card cannot be hidden or switched off, the table is locked while it
 * runs, and the last step leads to a real game.
 */
export interface CoachTarget {
  /** Spaces or tiles on the board to light up. */
  hexIds?: string[];
  /** A short label floating over the first lit space, e.g. "Build here". */
  label?: string;
  /** A part of the screen to glow. */
  ui?: "arrivals" | "end-turn" | "score" | "encounters" | "seed" | "warehouse";
}

/** How a walkthrough drives the table: its script, and a way to play, undo or restart a step. */
export interface TourControls {
  /** The script. Its first step is the introduction. */
  steps: TourStep[];
  /** The demo's own name, for the card's eyebrow. */
  kind: "Guided tour" | "Walkthrough";
  commit: (next: GameState) => void;
  undo: () => void;
  /** Put the table back at the walkthrough's opening position. */
  restart: () => void;
  isAtStart: (state: GameState) => boolean;
}

interface TourPlace { index: number; history: { from: number; played: boolean }[]; }
// The place lives for this visit only: every visit to a demo starts its
// walkthrough at the first card, whatever an earlier visit left behind.
const memoryPlaces = new Map<string, TourPlace>();
const freshPlace = (): TourPlace => ({ index: 0, history: [] });

// Earlier versions remembered a switched-off guide in the browser. Clear it.
try { for (const key of Object.keys(window.localStorage)) if (/quietVale\.(guide|tour)\.v1/.test(key)) window.localStorage.removeItem(key); } catch { /* nothing to clear */ }

export function TableCoach({ state, onTarget, tour }: { state: GameState; onTarget?: (target: CoachTarget | null) => void; tour?: TourControls }) {
  const tourId = tour?.steps[0]?.id ?? "";
  const [place, setPlace] = useState<TourPlace>(() => {
    const saved = memoryPlaces.get(tourId) ?? freshPlace();
    // A restarted demo is back at its first moment: so is the walkthrough.
    return tour?.isAtStart(state) && saved.index > 1 ? freshPlace() : saved;
  });
  if (!tour) return null;
  const update = (next: TourPlace) => { setPlace(next); memoryPlaces.set(tourId, next); };
  return <TableTour state={state} tour={tour} place={place} onPlace={update} onTarget={onTarget} />;
}

const demos = [
  { id: "welcome", href: "?experience=table&scenario=guided", name: "Your first game" },
  { id: "arrival-intro", href: "?experience=table&scenario=decide-arrival", name: "Welcome them, or build?" },
  { id: "protect-intro", href: "?experience=table&scenario=decide-protect", name: "Protect the vulnerable" },
  { id: "boon-intro", href: "?experience=table&scenario=decide-boon", name: "Make the Boon count" },
  { id: "special-intro", href: "?experience=table&scenario=decide-special", name: "A Special tile’s power" },
  { id: "chain-intro", href: "?experience=table&scenario=showcase-chain", name: "The Strain spreads" }
];

/** Next, next, next: the table plays itself, explained one step at a time. */
function TableTour({ state, tour, place, onPlace, onTarget }: { state: GameState; tour: TourControls; place: TourPlace; onPlace: (place: TourPlace) => void; onTarget?: (target: CoachTarget | null) => void }) {
  const [stuck, setStuck] = useState(false);
  const tourSteps = tour.steps;
  const step = tourSteps[Math.min(place.index, tourSteps.length - 1)];
  const target = step.target?.(state) ?? null;
  const targetKey = JSON.stringify(target);
  useEffect(() => { onTarget?.(target); }, [targetKey]);
  useEffect(() => () => onTarget?.(null), []);
  useEffect(() => { setStuck(false); }, [place.index]);
  const position = Math.max(0, tourSteps.indexOf(step));
  // A decision's options, each played out by the engine behind the scenes.
  const options = useMemo(() => step.decision?.(state) ?? [], [step, state]);
  const last = place.index >= tourSteps.length - 1;
  const atStart = tour.isAtStart(state);

  function following(from: number, after: GameState): number {
    let index = from + 1;
    while (index < tourSteps.length - 1 && tourSteps[index].skip?.(after)) index++;
    return index;
  }
  // Begin from the opening position, whatever is on the table.
  function begin() {
    setStuck(false);
    onPlace({ index: 1, history: [] });
    if (!atStart) tour.restart();
  }
  function next() {
    if (place.index === 0) { begin(); return; }
    if (!step.play) { onPlace({ index: following(place.index, state), history: [...place.history, { from: place.index, played: false }] }); return; }
    const played = step.play(state);
    if (!played) { setStuck(true); return; }
    // Save the place first: the move can swap the screen, and the next
    // screen's card reads where the walkthrough is.
    onPlace({ index: following(place.index, played), history: [...place.history, { from: place.index, played: played !== state }] });
    if (played !== state) tour.commit(played);
  }
  function back() {
    const previous = place.history[place.history.length - 1];
    if (!previous) return;
    onPlace({ index: previous.from, history: place.history.slice(0, -1) });
    if (previous.played) tour.undo();
  }

  return <aside className={`table-coach is-tour${options.length ? " has-decision" : ""}`} aria-label="Guided tour" aria-live="polite" key={step.id}>
    <div className="coach-head">
      <span className="coach-emblem" aria-hidden="true"><Play size={16} /></span>
      <ol className="coach-progress" aria-label={`Step ${position + 1} of ${tourSteps.length}`}>{tourSteps.map((candidate, index) => <li key={candidate.id} className={index < position ? "is-done" : index === position ? "is-now" : ""} />)}</ol>
      <span className="tour-count" aria-hidden="true">{position + 1}/{tourSteps.length}</span>
    </div>
    <p className="tour-eyebrow">{tour.kind} · press Next</p>
    <h3>{step.title}</h3>
    {options.length > 0 && <ol className="tour-options" aria-label="The options">{options.map((option) => <li key={option.id} className={option.chosen ? "is-chosen" : ""}>
      <p className="tour-option-label">{option.chosen && <Check size={15} aria-hidden="true" />}<strong>{option.label}</strong>{option.chosen && <span className="tour-chosen">The choice</span>}</p>
      <ul>{option.lines.map((line) => <li key={line}>{line}</li>)}</ul>
    </li>)}</ol>}
    <p className="coach-why">{options.length > 0 && <strong className="tour-why">Why: </strong>}{step.text(state)}</p>
    {stuck && <p className="coach-do">This step no longer matches the table. Start again from the beginning.</p>}
    {last ? <>
      <footer className="tour-controls">
        <button type="button" className="tour-back" onClick={back} disabled={!place.history.length} aria-label="Back"><ArrowLeft size={16} aria-hidden="true" /></button>
        <a className="coach-ok tour-next tour-real" href="?experience=table">Play a real game<ArrowRight size={16} aria-hidden="true" /></a>
        <button type="button" className="coach-off" onClick={begin}><RotateCcw size={14} aria-hidden="true" /> Watch again</button>
      </footer>
      <nav className="coach-links" aria-label="Other demos">{demos.filter((demo) => demo.id !== tourSteps[0].id).slice(0, 3).map((demo) => <a key={demo.href} href={demo.href}>{demo.name}</a>)}</nav>
    </> : <footer className="tour-controls">
      <button type="button" className="tour-back" onClick={back} disabled={!place.history.length} aria-label="Back"><ArrowLeft size={16} aria-hidden="true" /></button>
      {stuck
        ? <button type="button" className="coach-ok tour-next" onClick={begin}>Start again<ArrowRight size={16} aria-hidden="true" /></button>
        : <button type="button" className="coach-ok tour-next" onClick={next} aria-label={`Next: ${step.verb ?? "continue"}`}><span className="tour-next-word">Next</span>{step.verb && <small>{step.verb}</small>}<ArrowRight size={16} aria-hidden="true" /></button>}
    </footer>}
  </aside>;
}

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import type { TourStep } from "./tourScript";
import type { GameState } from "../../engine/types";
import { getScenario, comparisonScenarios } from "../../app/scenarioCatalog";
import { demoHref, demoNeighbours } from "../../app/demoCatalog";

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
  const scenario = getScenario();
  const nextScene = scenario ? demoNeighbours(scenario).next : undefined;

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
      <ol className="coach-progress" aria-label={`Step ${position + 1} of ${tourSteps.length}`}>{tourSteps.map((candidate, index) => <li key={candidate.id} className={index < position ? "is-done" : index === position ? "is-now" : ""} />)}</ol>
      <span className="tour-count" aria-hidden="true">{position + 1}/{tourSteps.length}</span>
    </div>
    <h3>{step.title}</h3>
    {options.length > 0 && <ol className="tour-options" aria-label="The options">{options.map((option) => <li key={option.id} className={option.chosen ? "is-chosen" : ""}>
      <p className="tour-option-label">{option.chosen && <Check size={15} aria-hidden="true" />}<strong>{option.label}</strong>{option.chosen && <span className="tour-chosen">Chosen</span>}</p>
      <ul>{option.lines.map((line) => <li key={line}>{line}</li>)}</ul>
    </li>)}</ol>}
    <p className="coach-why">{options.length > 0 && <strong className="tour-why">Why: </strong>}{step.text(state)}</p>
    {stuck && <p className="coach-do">This step no longer matches the table. Start again from the beginning.</p>}
    {last ? <>
      <footer className="tour-controls">
        <button type="button" className="tour-back" onClick={back} disabled={!place.history.length} aria-label="Back"><ArrowLeft size={16} aria-hidden="true" /></button>
        {nextScene
          ? <a className="coach-ok tour-next tour-real" href={demoHref(nextScene)}><span className="tour-next-word">Next scene</span><small>{comparisonScenarios[nextScene].name}</small></a>
          : <a className="coach-ok tour-next tour-real" href="?experience=table">Play a real game</a>}
      </footer>
      <nav className="coach-links tour-after" aria-label="Or">
        {nextScene && <a href="?experience=table">Play a real game</a>}
        <button type="button" onClick={begin}>Watch again</button>
      </nav>
    </> : <footer className="tour-controls">
      <button type="button" className="tour-back" onClick={back} disabled={!place.history.length} aria-label="Back"><ArrowLeft size={16} aria-hidden="true" /></button>
      {stuck
        ? <button type="button" className="coach-ok tour-next" onClick={begin}>Start again</button>
        : <button type="button" className="coach-ok tour-next" onClick={next} aria-label={`Next: ${step.verb ?? "continue"}`}><span className="tour-next-word">Next</span>{step.verb && step.verb !== "Next" && <small>{step.verb}</small>}</button>}
    </footer>}
  </aside>;
}

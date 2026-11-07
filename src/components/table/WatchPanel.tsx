import { useEffect } from "react";
import { ArrowLeft, ArrowRight, Check, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { WatchPlayer } from "../../app/watch/WatchDemo";
import type { CoachTarget } from "./TableCoach";
import { stewardById } from "../../data/stewards";
import { nextSpeed, speedLabel } from "../../app/watch/watchFrames";

const kindLabel = { decision: "Decision", moment: "Moment", rule: "How it works", finale: "Final scoring" } as const;
const seasonOf = (round: number) => ["I", "II", "III"][Math.min(2, Math.floor((round - 1) / 4))];

/**
 * The demo's commentary card. While the game plays it shows what just
 * happened; at a highlight it opens into the options the players had and
 * why they chose as they did, held long enough to read, with a timer.
 */
export function WatchPanel({ player, onTarget }: { player: WatchPlayer; onTarget?: (target: CoachTarget | null) => void }) {
  const { frame, frames, index, playing, highlights, speed, hold } = player;
  const pause = frame.pause;
  const targetKey = JSON.stringify(frame.target ?? null);
  useEffect(() => { onTarget?.(frame.target ?? null); }, [targetKey]);
  useEffect(() => () => onTarget?.(null), []);
  const last = index >= frames.length - 1;
  const steward = stewardById[frame.state.players.find((candidate) => candidate.id === frame.player)?.stewardId ?? ""];
  // The two steps before this one, faded, so the story reads as it passes.
  const recent = frames.slice(Math.max(0, index - 2), index).filter((candidate) => !candidate.pause).map((candidate) => candidate.caption).reverse();
  const progress = frames.length > 1 ? index / (frames.length - 1) : 1;
  const nextStop = highlights.find((at) => at > index);
  const status = last ? "The end" : playing ? "Playing" : "Paused";
  const intro = index === 0 && !playing;

  return <aside className={`table-coach is-tour watch-panel${pause ? " is-highlight" : ""}${pause?.kind === "finale" ? " is-finale" : ""}`} aria-label="Demo commentary">
    <header className="watch-head">
      <span className="watch-where">Round {frame.round} of 12 <span aria-hidden="true">·</span> Season {seasonOf(frame.round)}</span>
      {steward && !pause?.kind?.match(/finale/) && index > 0 && <span className={`watch-who is-${steward.id}`}><i aria-hidden="true">{steward.name.charAt(0)}</i>{steward.name}</span>}
    </header>
    <div className="watch-progress" role="progressbar" aria-label="Progress through the game" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
      <span className="watch-progress-fill" style={{ width: `${progress * 100}%` }} />
      {highlights.map((at) => <span key={at} className={`watch-progress-stop${at <= index ? " is-past" : ""}`} style={{ left: `${(at / Math.max(1, frames.length - 1)) * 100}%` }} />)}
    </div>

    {pause ? <div className="watch-highlight" key={index} aria-live="polite">
      {/* A moment that has just happened says what happened first. */}
      {pause.at === "after" && pause.kind !== "finale" && <p className="watch-lead">{frame.caption}</p>}
      <p className={`watch-kind is-${pause.kind}`}>{kindLabel[pause.kind]}</p>
      <h3>{pause.title}</h3>
      {/* How long until the game moves on; it stops while paused. */}
      {!last && !intro && <span className={`watch-timer${playing ? "" : " is-held"}`} key={`${index}:${speed}`} style={{ animationDuration: `${hold}ms` }} aria-hidden="true" />}
      {pause.options && pause.options.length > 0 && <ol className="tour-options watch-options" aria-label={pause.kind === "decision" ? "The options" : "At the table"}>{pause.options.map((option) => <li key={option.label} className={option.chosen ? "is-chosen" : ""}>
        <p className="tour-option-label">{option.chosen && <Check size={15} aria-hidden="true" />}<strong>{option.label}</strong>{option.chosen && pause.kind === "decision" && <span className="tour-chosen">Chosen</span>}</p>
        <ul>{option.lines.map((line) => <li key={line}>{line}</li>)}</ul>
      </li>)}</ol>}
      {pause.breakdown && <dl className="watch-breakdown">{pause.breakdown.map((line) => <div key={line.label} className={line.tone ? `is-${line.tone}` : undefined}><dt>{line.label}</dt><dd>{line.value}</dd></div>)}</dl>}
      <p className="coach-why">{pause.kind === "decision" && <strong className="tour-why">Why: </strong>}{pause.text}</p>
    </div> : <div className="watch-feed" aria-live={playing && speed === "fast" ? "off" : "polite"}>
      <p className="watch-caption" key={index}>{frame.caption}</p>
      {recent.length > 0 && <ol className="watch-recent" aria-hidden="true">{recent.map((line, at) => <li key={`${index}-${at}`}>{line}</li>)}</ol>}
    </div>}

    <footer className="watch-controls">
      <button type="button" className="watch-icon" onClick={player.back} disabled={index === 0} aria-label="Back one step"><ArrowLeft size={17} aria-hidden="true" /></button>
      {last
        ? <button type="button" className="coach-ok watch-main" onClick={player.restart}><RotateCcw size={16} aria-hidden="true" />Watch again</button>
        : intro
          ? <button type="button" className="coach-ok watch-main is-start" onClick={player.toggle}><Play size={16} aria-hidden="true" />Play the demo</button>
          : <button type="button" className={`coach-ok watch-main${playing ? "" : " is-paused"}`} onClick={player.toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? "Pause" : "Play"}</button>}
      {!last && !intro && <button type="button" className="watch-icon" onClick={player.forward} aria-label="Next step" title="Next step"><ArrowRight size={17} aria-hidden="true" /></button>}
      {!last && !intro && <button type="button" className="watch-icon" onClick={player.nextHighlight} aria-label={nextStop === undefined ? "Skip to the end" : "Skip to the next highlight"} title={nextStop === undefined ? "Skip to the end" : "Skip to the next highlight"}><SkipForward size={17} aria-hidden="true" /></button>}
      {!last && <button type="button" className="watch-speed" onClick={() => player.setSpeed(nextSpeed[speed])} aria-label={`Speed: ${speedLabel[speed]}. Change to ${speedLabel[nextSpeed[speed]]}`} title="Change speed">{speedLabel[speed]}</button>}
      <span className="watch-status" role="status">{status}</span>
    </footer>
    {last && <nav className="coach-links watch-after" aria-label="What next"><a className="coach-ok" href="?experience=table">Play a real game</a></nav>}
  </aside>;
}

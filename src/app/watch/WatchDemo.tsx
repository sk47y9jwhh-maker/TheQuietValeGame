/**
 * "Watch a demo": a recorded two-player game that plays itself on the real
 * table, with a caption for every step. It moves on by itself and stops only
 * where a decision or a rule is worth a closer look.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TableScreen, type TableGameHandlers } from "../../components/table/TableScreen";
import type { TourControls } from "../../components/table/TableCoach";
import { experienceClassName } from "../experience";
import { buildFrames, displayState, frameDuration, type WatchFrame } from "./watchFrames";
import type { WatchDemoData } from "./watchTypes";

export interface WatchPlayer {
  frames: WatchFrame[];
  index: number;
  frame: WatchFrame;
  playing: boolean;
  speed: 1 | 2;
  /** Indexes of the frames that stop for a closer look. */
  highlights: number[];
  /** Play, or pause, or carry on from a highlight. */
  toggle: () => void;
  forward: () => void;
  back: () => void;
  nextHighlight: () => void;
  restart: () => void;
  setSpeed: (speed: 1 | 2) => void;
}

const noop = () => undefined;
const handlers: TableGameHandlers = { activate: noop, upgrade: noop, place: noop, completeArrival: noop, resolveBurden: noop, useBoon: noop, useStewardPower: noop, endTurn: noop, reveal: noop, endRound: noop, inspectPlaced: noop, undo: noop, redo: noop, reset: noop };

export function usePlayer(frames: WatchFrame[]): WatchPlayer {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const frame = frames[Math.min(index, frames.length - 1)];
  const last = frames.length - 1;
  const highlights = useMemo(() => frames.flatMap((candidate, at) => candidate.pause ? [at] : []), [frames]);

  // Move on by itself, except at a highlight or the end.
  useEffect(() => {
    if (!playing || frame.pause || index >= last) return undefined;
    const timer = window.setTimeout(() => setIndex((at) => Math.min(last, at + 1)), frameDuration(frame) / speed);
    return () => window.clearTimeout(timer);
  }, [frame, index, last, playing, speed]);

  const toggle = useCallback(() => {
    if (frame.pause && index < last) { setIndex(index + 1); setPlaying(true); return; }
    if (index >= last) { setIndex(0); setPlaying(true); return; }
    setPlaying((value) => !value);
  }, [frame, index, last]);
  const forward = useCallback(() => setIndex((at) => Math.min(last, at + 1)), [last]);
  const back = useCallback(() => { setPlaying(false); setIndex((at) => Math.max(0, at - 1)); }, []);
  const nextHighlight = useCallback(() => {
    const next = highlights.find((at) => at > index) ?? last;
    setIndex(next);
    setPlaying(true);
  }, [highlights, index, last]);
  const restart = useCallback(() => { setIndex(0); setPlaying(true); }, []);
  return { frames, index, frame, playing, speed, highlights, toggle, forward, back, nextHighlight, restart, setSpeed };
}

/** Space plays and pauses, the arrows step. Keys typed into a control are left alone. */
function useKeys(player: WatchPlayer) {
  const ref = useRef(player);
  ref.current = player;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest("input, select, textarea, [contenteditable]")) return;
      if (event.key === " " && !target?.closest("button, a")) { event.preventDefault(); ref.current.toggle(); }
      else if (event.key === "ArrowRight") { event.preventDefault(); if (ref.current.frame.pause) ref.current.toggle(); else ref.current.forward(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); ref.current.back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export default function WatchDemo() {
  const [data, setData] = useState<WatchDemoData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    import("./watchDemo.generated.json").then((module) => { if (live) setData(module.default as unknown as WatchDemoData); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  const frames = useMemo(() => { try { return data ? buildFrames(data) : null; } catch { return null; } }, [data]);
  return <div className="scenario-preview scenario-preview-table watch-demo" data-demo="watch">
    <header className="watch-bar" aria-label="Demo">
      <a className="watch-home" href="?experience=table"><ArrowLeft size={17} aria-hidden="true" /><span>The Quiet Vale</span></a>
      <p className="watch-title"><strong>Watching a demo game</strong><span>Vanguard and Knight · two players · 12 rounds</span></p>
      <a className="watch-play" href="?experience=table">Play a real game</a>
      <span className="watch-build" title="Demo version">v6 Nov · 2</span>
    </header>
    {frames ? <WatchTable frames={frames} /> : <main className="scenario-error" role={failed || (data && !frames) ? "alert" : "status"}>{failed || (data && !frames) ? <><h1>The demo could not be loaded.</h1><p>Reload the page to try again.</p><a href="?experience=table">Back to the start page</a></> : "Setting out the table…"}</main>}
  </div>;
}

function WatchTable({ frames }: { frames: WatchFrame[] }) {
  const player = usePlayer(frames);
  useKeys(player);
  const state = useMemo(() => displayState(player.frame.state), [player.frame]);
  const newCards = useMemo(() => new Set(player.frame.revealed), [player.frame]);
  const tour = useMemo<TourControls>(() => ({ steps: [], kind: "Walkthrough", commit: noop, undo: noop, restart: player.restart, isAtStart: () => player.index === 0, watch: player }), [player]);
  return <div className={`experience-app ${experienceClassName("table")}`}>
    <div className="app-shell board-table-shell">
      <TableScreen state={state} handlers={handlers} canUndo={false} canRedo={false} newCardIds={newCards} notice={null} onDismissNotice={noop} tray={null} coach tour={tour} />
    </div>
  </div>;
}

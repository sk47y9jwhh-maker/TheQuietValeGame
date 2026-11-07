import type { CoachTarget } from "../../components/table/TableCoach";
import type { PreviewSnapshot } from "../scenarioTypes";
import type { WatchMove } from "./watchMoves";

/** One option the players had, with what the engine says it would lead to. */
export interface DemoOption {
  label: string;
  lines: string[];
  chosen?: boolean;
}

/** A point of interest: the demo stops here until the viewer continues. */
export interface DemoPause {
  /** "before": stop with the choice still to make. "after": stop on its result. */
  at: "before" | "after";
  /** "Decision", "Moment" or "How it works". */
  kind: "decision" | "moment" | "rule" | "finale";
  title: string;
  text: string;
  options?: DemoOption[];
  target?: CoachTarget;
  /** Lines of a score breakdown, for the finale. */
  breakdown?: { label: string; value: string; tone?: "plus" | "minus" | "total" }[];
}

/** One step of the demo: some moves, a caption, and sometimes a pause. */
export interface DemoBeat {
  moves: WatchMove[];
  caption: string;
  player: string;
  round: number;
  target?: CoachTarget;
  pause?: DemoPause;
}

export interface WatchDemoData {
  version: number;
  start: PreviewSnapshot;
  beats: DemoBeat[];
  finalScore: number;
}

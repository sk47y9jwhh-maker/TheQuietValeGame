import { useEffect, useRef } from "react";
import type { GameState } from "../../engine/types";

/** Move focus at a phase/player handoff, never while browsing or spending actions. */
export function usePhaseFocus(state: GameState, enabled = true) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const target = ref.current;
    target?.focus({ preventScroll: true });
    (target?.firstElementChild ?? target)?.scrollIntoView?.({ block: "nearest" });
  }, [enabled, state.phase, state.currentPlayerId, state.round, state.bonusTurnsActive]);
  return ref;
}

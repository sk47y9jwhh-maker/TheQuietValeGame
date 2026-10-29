import type { GameState } from "../../engine/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";

/**
 * A choice that a resolution screen can also offer on the board: a tile to
 * strain, support or relieve, a space to move a Steward to, and so on. The
 * screen keeps its own controls; the board is a second way to make the same
 * choice, so nothing about the rules changes.
 */
export interface BoardChoice {
  key: string;
  hexIds: string[];
  /** Short text for the board and for screen readers, e.g. "+1 Strain". */
  label: string;
  selected: boolean;
  /** Shown on the tile once chosen, e.g. "+1". */
  badge?: string;
  onTap: () => void;
  /** Set by the rules (for example by the Target Card); shown but not changeable. */
  fixed?: boolean;
}

interface BoardChoiceBridge {
  publish: (owner: string, choices: BoardChoice[] | null) => void;
  /** A planned board to draw instead of the current one (for example a Golden Signet plan). */
  preview: (state: GameState | null) => void;
}

const BoardChoiceContext = createContext<BoardChoiceBridge | null>(null);

/** Called by a resolution screen. Does nothing outside the board-first table. */
export function useBoardChoices(owner: string, choices: BoardChoice[]) {
  const bridge = useContext(BoardChoiceContext);
  useEffect(() => { bridge?.publish(owner, choices); });
  useEffect(() => () => bridge?.publish(owner, null), [bridge, owner]);
}

/** Draws a planned board in place of the current one while mounted. */
export function useBoardPreview(state: GameState | null) {
  const bridge = useContext(BoardChoiceContext);
  useEffect(() => { bridge?.preview(state); }, [bridge, state]);
  useEffect(() => () => bridge?.preview(null), [bridge]);
}

export interface BoardChoiceView {
  marks: ReadonlyMap<string, { selected: boolean; badge?: string; label: string }>;
  tap: (hexId: string) => boolean;
  hint: string | null;
  preview: GameState | null;
}

/** Collects the choices published by the screen below it, for the board above it. */
export function useBoardChoiceHost(): [BoardChoiceView, (props: { children: ReactNode }) => ReactElement] {
  const latest = useRef(new Map<string, BoardChoice[]>());
  const [signature, setSignature] = useState("");
  const [previewState, setPreviewState] = useState<GameState | null>(null);

  const publish = useCallback((owner: string, choices: BoardChoice[] | null) => {
    if (choices && choices.length) latest.current.set(owner, choices); else latest.current.delete(owner);
    const next = [...latest.current.entries()].map(([name, list]) => `${name}:${list.map((choice) => `${choice.key}${choice.selected ? "*" : ""}${choice.badge ?? ""}`).join(",")}`).join("|");
    setSignature((current) => current === next ? current : next);
  }, []);

  const bridge = useMemo<BoardChoiceBridge>(() => ({ publish, preview: setPreviewState }), [publish]);
  const Provider = useCallback(({ children }: { children: ReactNode }) => <BoardChoiceContext.Provider value={bridge}>{children}</BoardChoiceContext.Provider>, [bridge]);

  const view = useMemo<BoardChoiceView>(() => {
    void signature;
    // A walkthrough ("focus:" owner) temporarily takes over the board's marks.
    const owners = [...latest.current.entries()];
    const focused = owners.filter(([owner]) => owner.startsWith("focus:"));
    const all = (focused.length ? focused : owners).map(([, list]) => list).flat();
    const marks = new Map<string, { selected: boolean; badge?: string; label: string }>();
    for (const choice of all) {
      choice.hexIds.forEach((hexId, index) => {
        const existing = marks.get(hexId);
        if (existing?.selected && !choice.selected) return;
        marks.set(hexId, { selected: choice.selected, badge: index === 0 ? choice.badge : undefined, label: choice.label });
      });
    }
    return {
      marks,
      preview: previewState,
      hint: !all.length ? null
        : focused.length ? "The marked tiles are still in the running."
        : all.every((choice) => choice.fixed) ? "Marked tiles show what will happen."
        : all.some((choice) => choice.selected) ? "Marked tiles show what will happen. Tap one to change it."
        : "Tap a highlighted tile or space to choose it.",
      tap: (hexId) => {
        const entries = [...latest.current.entries()];
        const focusedNow = entries.filter(([owner]) => owner.startsWith("focus:"));
        const current = (focusedNow.length ? focusedNow : entries).map(([, list]) => list).flat();
        // Prefer a choice that is not yet made, so one tap moves the decision forward.
        const match = current.find((choice) => choice.hexIds.includes(hexId) && !choice.selected) ?? current.find((choice) => choice.hexIds.includes(hexId));
        if (!match) return false;
        match.onTap();
        return true;
      }
    };
  }, [signature, previewState]);

  return [view, Provider];
}

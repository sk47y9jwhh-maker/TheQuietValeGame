import { TurnPriorities } from "./TurnPriorities";
import { getActionPreparationIds } from "../actions/preparedActions";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Hammer, Map, ScrollText } from "lucide-react";
import { usePhaseFocus } from "./usePhaseFocus";
import { getExperience } from "../../app/experience";
import { stewardById } from "../../data/stewards";
import type { GameState } from "../../engine/types";


interface TabletopLayoutProps {
  actions: ReactNode;
  board: ReactNode;
  encounters: ReactNode;
  children?: ReactNode;
  state: GameState;
  selectionKey: string;
  boardSelectionKey: string;
  actionMode: string;
  onModeChange: (mode: string) => void;
  onReviewPreparedPower?: () => void;
}

export function TabletopLayout({ actions, board, encounters, children, state, selectionKey, boardSelectionKey, actionMode }: TabletopLayoutProps) {
  const experience = getExperience();
  if (experience && experience !== "classic" && state.phase === "gameEnd") return <main className="completed-game-layout">
    {actions}
    <details className="completed-board-review"><summary>View your final settlement board</summary><div className="completed-board-map">{board}</div></details>
    {children}
  </main>;
  if (getExperience() !== "tabletop") return <main className="command-table">{actions}{board}{encounters}{children}</main>;
  return <LivingTableLayout actions={actions} board={board} encounters={encounters} state={state} selectionKey={selectionKey} boardSelectionKey={boardSelectionKey} actionMode={actionMode}>{children}</LivingTableLayout>;
}

type TableView = "board" | "actions" | "encounters";
function LivingTableLayout({ actions, board, encounters, children, state, selectionKey, boardSelectionKey, actionMode }: Omit<TabletopLayoutProps, "onModeChange">) {
  const [compact, setCompact] = useState(() => window.matchMedia?.("(max-width: 900px)").matches ?? false);
  const [view, setView] = useState<TableView>("actions");
  const [panel, setPanel] = useState<"actions" | "encounters">("actions");
  const decisionRef = usePhaseFocus(state, !compact);
  const boardRef = useRef<HTMLDivElement>(null);
  const encountersRef = useRef<HTMLDivElement>(null);
  const [arrivalReview, setArrivalReview] = useState<{ id: string } | null>(null);
  useEffect(() => {
    if (!arrivalReview || panel !== "encounters" || (compact && view !== "encounters")) return;
    const frame = requestAnimationFrame(() => {
      const target = [...(encountersRef.current?.querySelectorAll<HTMLElement>("[data-arrival-id]") ?? [])].find((element) => element.dataset.arrivalId === arrivalReview.id);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: "start" });
      setArrivalReview(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [arrivalReview, panel, compact, view]);
  const previousSelection = useRef(boardSelectionKey);
  const previousPreparations = useRef(getActionPreparationIds(state));
  useEffect(() => {
    const prepared = getActionPreparationIds(state);
    if (prepared.some((id) => !previousPreparations.current.includes(id))) { setPanel("actions"); setView("actions"); }
    previousPreparations.current = prepared;
  }, [state]);
  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 900px)");
    if (!query) return;
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setPanel("actions");
    setView((current) => current === "encounters" ? "actions" : current);
  }, [selectionKey, state.phase, state.currentPlayerId]);
  useEffect(() => { setView("actions"); }, [state.phase, state.currentPlayerId, state.round, state.bonusTurnsActive]);
  useEffect(() => {
    if (previousSelection.current !== boardSelectionKey) {
      previousSelection.current = boardSelectionKey;
      setView("actions");
      setPanel("actions");
    }
  }, [boardSelectionKey]);
  useEffect(() => {
    if (!compact) return;
    const target = view === "board" ? boardRef.current : decisionRef.current;
    target?.focus({ preventScroll: true });
    // A short heading/control anchor avoids scrolling to the bottom of a tall panel.
    target?.querySelector("[data-table-focus-anchor], .tabletop-map-toolbar")?.scrollIntoView?.({ block: window.innerHeight <= 600 ? "start" : "nearest" });
  }, [compact, view, state.phase, state.currentPlayerId, state.round, state.bonusTurnsActive, decisionRef]);

  function showView(next: TableView) {
    setView(next);
    if (next !== "board") setPanel(next);
    if (!compact) {
      const target = next === "board" ? boardRef.current : decisionRef.current;
      target?.focus({ preventScroll: true });
      target?.firstElementChild?.scrollIntoView?.({ block: "nearest" });
    }
  }
  const currentPlayer = state.players.find((player) => player.id === state.currentPlayerId)!;
  const encounterCount = state.encounters.activeArrivals.length + state.encounters.activeBurdens.length + state.encounters.faceUpBoons.length;
  const boardNeeded = state.phase === "turns" && ["place", "upgrade", "activate"].includes(actionMode);
  return (
    <main className="tabletop-play" data-compact={compact}>
      <nav className="tabletop-jump-nav" aria-label="Jump around the table">
        <button type="button" aria-pressed={compact ? view === "actions" : undefined} aria-controls="tabletop-actions" onClick={() => showView("actions")}>Your actions</button>
        <button type="button" aria-pressed={compact ? view === "board" : undefined} aria-controls="tabletop-board" onClick={() => showView("board")}>Board</button>
        <button type="button" aria-pressed={compact ? view === "encounters" : undefined} aria-label="Show encounters" aria-controls="tabletop-encounters" onClick={() => showView("encounters")}>Encounters <small>{encounterCount}</small></button>
      </nav>
      <div ref={boardRef} className="tabletop-board" id="tabletop-board" tabIndex={-1} hidden={compact && view !== "board"} aria-label="Settlement board">
        {board}
        {compact && <button className="tabletop-board-return" type="button" onClick={() => showView("actions")}>Return to your actions <ArrowRight size={17} aria-hidden="true" /></button>}
      </div>
      <aside ref={decisionRef} className="tabletop-dock" id="tabletop-tools" tabIndex={-1} aria-label="Table tools" hidden={compact && view === "board"}>
        {compact && <header className="tabletop-mobile-context" data-table-focus-anchor>
          <p>{stewardById[currentPlayer.stewardId].name} · Round {state.round}{state.phase === "turns" && ` · ${state.bonusTurnsActive ? "Bonus turn · " : ""}${state.actionsRemaining} ${state.actionsRemaining === 1 ? "action" : "actions"}`}</p>
          {panel === "actions" && boardNeeded && <button className="tabletop-board-invitation" type="button" onClick={() => showView("board")}><Map size={19} aria-hidden="true" /><span>{actionMode === "place" ? "Choose or change a space" : "View tiles on the board"}</span><ArrowRight size={17} aria-hidden="true" /></button>}
        </header>}
        <nav className="tabletop-dock-nav" aria-label="Table panels" hidden={compact}>
          <button type="button" aria-pressed={panel === "actions"} aria-controls="tabletop-actions" onClick={() => setPanel("actions")}><Hammer size={17} aria-hidden="true" />Actions <span>{state.phase === "turns" ? state.actionsRemaining : "→"}</span></button>
          <button type="button" aria-pressed={panel === "encounters"} aria-controls="tabletop-encounters" onClick={() => setPanel("encounters")}><ScrollText size={17} aria-hidden="true" />Encounters <span>{encounterCount}</span></button>
        </nav>
        <div className="tabletop-dock-pane" id="tabletop-actions" hidden={panel !== "actions"}>
          <TurnPriorities state={state} onReviewArrival={(id) => { setArrivalReview({ id }); setPanel("encounters"); setView("encounters"); }} onReviewBoard={() => showView("board")} />
          {actions}
        </div>
        <div ref={encountersRef} className="tabletop-dock-pane" id="tabletop-encounters" hidden={panel !== "encounters"}>{encounters}</div>
      </aside>
      {children}
    </main>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Eye, Maximize2, Minus, Plus, Redo2, RotateCcw, RotateCw, Undo2, X } from "lucide-react";
import { resourceLabels, resources, warehouseCap } from "../../data/resources";
import { encounterById } from "../../data/encounters";
import { stewardById } from "../../data/stewards";
import { getPlacedTileAtHex } from "../../engine/reachability";
import { getTileFootprintKind, getLegalPlacementHexes } from "../../engine/placementRules";
import { canStartPlaceTile } from "../../engine/gameActions";
import { calculateFinalScore } from "../../engine/scoring";
import type { GameState, HexDirection, ResourceType, TilePlacementDraft } from "../../engine/types";
import type { ActionForecast } from "../actions/actionForecast";
import { previewTileAction } from "../actions/actionForecast";
import { TableBoard, type TableBoardHandle } from "./TableBoard";
import { TableRail } from "./TableRail";
import { categoryColors, categoryNames } from "./boardGeometry";
import { useBoardChoiceHost } from "./boardChoices";
import {
  describeHexOptions,
  describeTileActions,
  footprintFor,
  legalOrientations,
  legalSpacesFor,
  summariseForecast,
  tileName,
  type HexPlaceOption
} from "./tableActions";

export interface TableGameHandlers {
  activate: (placedTileId: string) => void;
  upgrade: (placedTileId: string) => void;
  place: (tileId: string, draft: TilePlacementDraft) => void;
  completeArrival: (cardId: string) => void;
  resolveBurden: (cardId: string) => void;
  useBoon: (cardId: string) => void;
  useStewardPower: () => void;
  endTurn: () => void;
  reveal: () => void;
  endRound: () => void;
  inspectPlaced: (placedTileId: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

interface TableScreenProps {
  state: GameState;
  handlers: TableGameHandlers;
  canUndo: boolean;
  canRedo: boolean;
  newCardIds: ReadonlySet<string>;
  notice: string | null;
  onDismissNotice: () => void;
  /** The reference tray (tiles, hand, specials, Ledger, rules). */
  tray: ReactNode;
  /** A step to settle before play continues: shown beside the board, with its choices on the board. */
  resolution?: TableResolution | null;
}

export interface TableResolution {
  key: string;
  eyebrow: string;
  title: string;
  steps: number;
  content: ReactNode;
  sourceTileId?: string;
  /** One link of an Overstrain chain: the Overstrained tile and the tile it spreads to. */
  link?: { fromTileId: string; toTileId?: string };
}

type Mode =
  | { kind: "idle" }
  | { kind: "selected"; hexId: string }
  | { kind: "placing"; tileId: string; anchorHexId?: string; orientation: HexDirection; secondaryHexId?: string };

function useCompact() {
  const query = "(max-width: 860px)";
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && (window.matchMedia?.(query).matches ?? false));
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return compact;
}

export function TableScreen({ state, handlers, canUndo, canRedo, newCardIds, notice, onDismissNotice, tray, resolution }: TableScreenProps) {
  const compact = useCompact();
  const [choices, ChoiceHost] = useBoardChoiceHost();
  const resolving = Boolean(resolution);
  const [sheetLow, setSheetLow] = useState(false);
  // Earlier links of the current Overstrain chain, so the board shows its path.
  const [chainTrail, setChainTrail] = useState<{ from: string; to: string }[]>([]);
  const lastLink = useRef<{ key: string; from: string; to: string } | null>(null);
  const hexOf = (tileId?: string) => tileId ? state.map.placedTiles.find((tile) => tile.instanceId === tileId)?.hexIds[0] : undefined;
  const linkFrom = hexOf(resolution?.link?.fromTileId);
  const linkTo = hexOf(resolution?.link?.toTileId);
  useEffect(() => {
    const previous = lastLink.current;
    if (!resolution?.link) setChainTrail([]);
    else if (previous && previous.key !== resolution.key) setChainTrail((trail) => [...trail, { from: previous.from, to: previous.to }]);
    lastLink.current = resolution?.link && linkFrom && linkTo ? { key: resolution.key, from: linkFrom, to: linkTo } : null;
  }, [resolution?.key, linkFrom, linkTo]);
  const boardLinks = resolution?.link ? [...chainTrail.map((link) => ({ ...link, current: false })), ...(linkFrom && linkTo ? [{ from: linkFrom, to: linkTo, current: true }] : [])] : undefined;
  const hasChoices = choices.marks.size > 0;
  useEffect(() => { setSheetLow(false); }, [resolution?.key]);
  // Bring the first choice into view when a step with board choices begins.
  useEffect(() => {
    if (!resolution || !hasChoices) return;
    const marks = [...choices.marks.entries()];
    const first = (marks.find(([, mark]) => mark.selected) ?? marks[0])?.[0];
    if (first && compact) requestAnimationFrame(() => boardRef.current?.reveal(first));
  }, [resolution?.key, hasChoices, sheetLow]);
  const boardRef = useRef<TableBoardHandle>(null);
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [railOpen, setRailOpen] = useState(false);
  const isTurn = state.phase === "turns";

  // A new turn, round or phase starts with a clear board.
  useEffect(() => { setMode({ kind: "idle" }); }, [state.currentPlayerId, state.round, state.phase, resolving]);

  const selectedHexId = mode.kind === "selected" ? mode.hexId : mode.kind === "placing" ? mode.anchorHexId ?? null : null;
  const selectedTile = mode.kind === "selected" ? getPlacedTileAtHex(state, mode.hexId) : undefined;
  const tileActions = useMemo(() => selectedTile ? describeTileActions(state, selectedTile) : null, [selectedTile, state]);
  const hexOptions = useMemo(() => mode.kind === "selected" && !selectedTile && isTurn ? describeHexOptions(state, mode.hexId, 3) : null, [isTurn, mode, selectedTile, state]);

  const placing = mode.kind === "placing" ? mode : null;
  const placingKind = placing ? getTileFootprintKind(placing.tileId) : null;
  const placingDraft: TilePlacementDraft | null = placing?.anchorHexId
    ? placingKind === "line" ? { anchorHexId: placing.anchorHexId, orientation: placing.orientation }
      : placingKind === "detached" ? { anchorHexId: placing.anchorHexId, secondaryHexIds: placing.secondaryHexId ? [placing.secondaryHexId] : [] }
      : { anchorHexId: placing.anchorHexId }
    : null;
  const placingLegal = useMemo(() => {
    if (!placing) return undefined;
    if (placingKind === "detached") {
      return new Set(placing.anchorHexId
        ? getLegalPlacementHexes(state, state.currentPlayerId, placing.tileId, { anchorHexId: placing.anchorHexId, secondaryHexIds: [] })
        : getLegalPlacementHexes(state, state.currentPlayerId, placing.tileId, {}));
    }
    return new Set(legalSpacesFor(state, placing.tileId, {}));
  }, [placing, placingKind, state]);
  const placingFootprint = placing && placingDraft ? new Set(footprintFor(placing.tileId, placingDraft)) : undefined;
  const placingReady = placing && placingDraft ? canStartPlaceTile(state, state.currentPlayerId, placing.tileId, placingDraft).ok : false;
  const placingForecast = placing && placingDraft && placingReady ? previewTileAction(state, state.currentPlayerId, { type: "place", tileId: placing.tileId, draft: placingDraft }) : undefined;

  const activeForecast: ActionForecast | undefined = placingForecast ?? tileActions?.options.find((option) => option.available)?.forecast;
  const glow = useMemo(() => resolution?.sourceTileId ? new Set([resolution.sourceTileId]) : tileActions && tileActions.linkedTileIds.length > 0 ? new Set([tileActions.tile.instanceId, ...tileActions.linkedTileIds]) : undefined, [resolution?.sourceTileId, tileActions]);

  function handleHexTap(hexId: string) {
    if (resolving) { choices.tap(hexId); return; }
    if (placing) {
      if (placingKind === "detached") {
        if (!placing.anchorHexId) { if (placingLegal?.has(hexId)) setMode({ ...placing, anchorHexId: hexId }); return; }
        if (hexId === placing.anchorHexId) { setMode({ ...placing, anchorHexId: undefined, secondaryHexId: undefined }); return; }
        if (placingLegal?.has(hexId)) setMode({ ...placing, secondaryHexId: hexId });
        return;
      }
      if (placingLegal?.has(hexId)) {
        const orientations = placingKind === "line" ? legalOrientations(state, placing.tileId, hexId) : [];
        setMode({ ...placing, anchorHexId: hexId, orientation: orientations.includes(placing.orientation) ? placing.orientation : orientations[0] ?? placing.orientation });
        return;
      }
      setMode({ kind: "idle" });
      return;
    }
    if (mode.kind === "selected" && mode.hexId === hexId) { setMode({ kind: "idle" }); return; }
    setMode({ kind: "selected", hexId });
    if (compact) requestAnimationFrame(() => boardRef.current?.reveal(hexId));
  }

  function choosePlacement(option: HexPlaceOption, hexId: string) {
    if (option.needsSecondSpace) { setMode({ kind: "placing", tileId: option.choice.id, anchorHexId: hexId, orientation: 3 }); return; }
    if (option.needsOrientation) {
      const orientations = legalOrientations(state, option.choice.id, hexId);
      setMode({ kind: "placing", tileId: option.choice.id, anchorHexId: hexId, orientation: orientations[0] ?? 3 });
      return;
    }
    if (option.draft) { handlers.place(option.choice.id, option.draft); setMode({ kind: "idle" }); }
  }

  function rotate(step: number) {
    if (!placing?.anchorHexId) return;
    const orientations = legalOrientations(state, placing.tileId, placing.anchorHexId);
    if (orientations.length === 0) return;
    const index = orientations.indexOf(placing.orientation);
    setMode({ ...placing, orientation: orientations[(index + step + orientations.length) % orientations.length] });
  }

  const card = isTurn && !resolving ? cardFor() : null;
  function cardFor(): { hexId: string; content: ReactNode } | null {
    if (placing) {
      const name = tileName(placing.tileId);
      const ready = placingReady && placingDraft;
      const orientations = placing.anchorHexId && placingKind === "line" ? legalOrientations(state, placing.tileId, placing.anchorHexId) : [];
      const instruction = placingKind === "detached"
        ? !placing.anchorHexId ? "Tap a highlighted space for the first Stables." : !placing.secondaryHexId ? "Now tap a highlighted space for the second Stables." : ""
        : !placing.anchorHexId ? "Tap a highlighted space." : "";
      return {
        hexId: placing.anchorHexId ?? placingAnchorHint(state),
        content: <div className="action-card">
          <header><div><h3>{name}</h3><p>{placing.anchorHexId ? `at ${placing.anchorHexId}` : "Choose where it goes"}</p></div><button type="button" className="icon-button" aria-label="Cancel placing" onClick={() => setMode({ kind: "idle" })}><X size={18} /></button></header>
          {instruction && <p className="action-card-hint">{instruction}</p>}
          {orientations.length > 1 && <div className="rotate-row"><button type="button" onClick={() => rotate(-1)}><RotateCcw size={16} aria-hidden="true" />Turn</button><span>{orientations.length} directions fit</span><button type="button" onClick={() => rotate(1)}>Turn<RotateCw size={16} aria-hidden="true" /></button></div>}
          {ready && <button type="button" className="action-primary" onClick={() => { handlers.place(placing.tileId, placingDraft); setMode({ kind: "idle" }); }}>
            <span><strong>Place {name}</strong><small>{placingForecast?.paymentChoice ? "Choose payment next" : placingForecast?.actionCost === 0 ? "No action" : "1 action"}</small></span>
            <span className="action-yield">{summariseForecast(placingForecast) || "Free"}</span>
          </button>}
          {placingForecast?.notes.filter((note) => !/Steward moves/.test(note)).map((note) => <p key={note} className="action-card-note">{note}</p>)}
        </div>
      };
    }
    if (mode.kind !== "selected") return null;
    if (tileActions) {
      const tile = tileActions.tile;
      return {
        hexId: mode.hexId,
        content: <div className="action-card">
          <header>
            <div><h3>{tileActions.name}</h3><p><span className="category-dot" style={{ background: categoryColors[tileActions.category] }} />{mode.hexId} · {categoryNames[tileActions.category]}{tile.side === "upgraded" ? " · upgraded" : ""}{tile.strain ? ` · ${tile.strain} Strain` : ""}{tile.support.passive || tile.support.singleUse ? " · Supported" : ""}</p></div>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => setMode({ kind: "idle" })}><X size={18} /></button>
          </header>
          {tileActions.options.map((option, index) => <button key={option.kind} type="button" className={index === 0 || !tileActions.options[0].available ? "action-primary" : "action-secondary"} disabled={!option.available} onClick={() => {
            setMode({ kind: "idle" });
            if (option.kind === "activate") handlers.activate(tile.instanceId); else handlers.upgrade(tile.instanceId);
          }}>
            <span><strong>{option.title}</strong><small>{option.available ? option.detail : option.reason}</small></span>
            {option.available && <span className="action-yield">{option.kind === "upgrade" && option.forecast && !option.forecast.paymentChoice && !option.forecast.resources.some((change) => change.delta < 0) ? "Free" : summariseForecast(option.forecast)}</span>}
          </button>)}
          {tileActions.options.length === 0 && <p className="action-card-hint">{tileActions.effectText || "No action to take with this tile."}</p>}
          {tileActions.options.some((option) => option.available) && <p className="action-card-note">Each uses 1 action. {stewardName(state)} moves here.</p>}
          <button type="button" className="action-link" onClick={() => handlers.inspectPlaced(tile.instanceId)}><Eye size={16} aria-hidden="true" />Read the full tile</button>
        </div>
      };
    }
    if (hexOptions) {
      return {
        hexId: mode.hexId,
        content: <div className="action-card">
          <header><div><h3>Build here</h3><p>{mode.hexId} · {hexOptions.terrain}</p></div><button type="button" className="icon-button" aria-label="Close" onClick={() => setMode({ kind: "idle" })}><X size={18} /></button></header>
          {hexOptions.placeable.length === 0 && <p className="action-card-hint">{hexOptions.blocked.length ? "Nothing you can afford fits here yet." : "No tile can go here right now. Spaces must be reachable from your Steward, and some tiles need a particular terrain or neighbour."}</p>}
          {hexOptions.placeable.length > 0 && <ul className="place-list">
            {hexOptions.placeable.slice(0, compact ? 8 : 9).map((option) => <li key={option.choice.id}><button type="button" onClick={() => choosePlacement(option, mode.hexId)}>
              <span className="category-dot" style={{ background: categoryColors[option.choice.category] }} aria-hidden="true" />
              <span className="place-name"><strong>{option.choice.name}</strong><small>{option.choice.kind === "special" ? "Special · unlocked" : categoryNames[option.choice.category]}{option.needsOrientation ? " · choose direction" : option.needsSecondSpace ? " · two spaces" : ""}</small></span>
              <span className="place-cost">{option.choice.costLabel === "None" || option.choice.costLabel === "Free" ? "Free" : option.choice.costLabel}</span>
            </button></li>)}
          </ul>}
          {hexOptions.placeable.length > (compact ? 8 : 9) && <p className="action-card-note">{hexOptions.placeable.length - (compact ? 8 : 9)} more in the tile supply.</p>}
          {hexOptions.blocked.length > 0 && <details className="blocked-list"><summary>{hexOptions.blocked.length} more fit but can’t be built now</summary><ul>{hexOptions.blocked.map((option) => <li key={option.choice.id}><strong>{option.choice.name}</strong> <small>{option.blocked}</small></li>)}</ul></details>}
        </div>
      };
    }
    return null;
  }

  const score = calculateFinalScore(state).finalScore;
  const currentPlayer = state.players.find((player) => player.id === state.currentPlayerId);
  const firstPlacementHex = isTurn && currentPlayer && !currentPlayer.hasPlacedFirstTile ? currentPlayer.stewardHexId : null;
  const legal = resolving ? undefined : placing ? placingLegal : firstPlacementHex && mode.kind === "idle" ? new Set([firstPlacementHex]) : undefined;
  const hint = firstPlacementHex
    ? `Start by building on your Steward’s space at ${firstPlacementHex}. Tap it to see what fits.`
    : "Tap a tile to use it, or an empty space to build.";
  const sheetOpen = compact && (Boolean(card) || resolving);
  const resolutionPanel = resolution ? <aside className="table-resolution" aria-labelledby="table-resolution-title" key={resolution.key}>
    <header><p className="eyebrow">{resolution.eyebrow}{resolution.link && chainTrail.length ? ` · link ${chainTrail.length + 1}` : ""}{resolution.steps > 1 ? ` · ${resolution.steps - 1} more to follow` : ""}</p><h2 id="table-resolution-title">{resolution.title}</h2>{choices.hint && <p className="table-resolution-hint">{choices.hint}</p>}
      {compact && hasChoices && <button type="button" className="sheet-toggle" aria-expanded={!sheetLow} onClick={() => setSheetLow((low) => !low)}>{sheetLow ? "Show details" : "Show the board"}</button>}</header>
    <div className="table-resolution-body"><ChoiceHost>{resolution.content}</ChoiceHost></div>
  </aside> : null;

  return <div className={`table-screen${compact ? " is-compact" : ""}`}>
    <TableTopBar state={state} forecast={activeForecast} score={score} canUndo={canUndo} canRedo={canRedo} onUndo={handlers.undo} onRedo={handlers.redo} onReset={handlers.reset} compact={compact} />
    {compact && <EncounterStrip state={state} newCardIds={newCardIds} onOpen={() => setRailOpen(true)} />}
    <main className="table-main">
      <section className="table-board" aria-label="The settlement">
        <TableBoard
          ref={boardRef}
          state={state}
          selectedHexId={selectedHexId}
          legalHexIds={legal}
          glowTileIds={glow}
          footprintHexIds={placingFootprint}
          choiceMarks={resolving ? choices.marks : undefined}
          links={boardLinks}
          coveredBottom={resolving && compact ? (sheetLow ? 150 : Math.round(window.innerHeight * 0.55)) : sheetOpen ? 330 : compact ? 196 : 0}
          onHexTap={handleHexTap}
          onEmptyTap={() => setMode({ kind: "idle" })}
          popover={!compact && card ? { hexId: card.hexId, content: card.content, width: 340 } : null}
        />
        <div className="board-tools" role="group" aria-label="Map zoom">
          <button type="button" aria-label="Zoom in" onClick={() => boardRef.current?.zoomBy(1.3)}><Plus size={18} /></button>
          <button type="button" aria-label="Zoom out" onClick={() => boardRef.current?.zoomBy(1 / 1.3)}><Minus size={18} /></button>
          <button type="button" aria-label="Show the whole board" onClick={() => boardRef.current?.fit()}><Maximize2 size={16} /></button>
        </div>
        {notice && <div className="table-notice" role="status"><p>{notice}</p><button type="button" aria-label="Dismiss" onClick={onDismissNotice}><X size={16} /></button></div>}
        {!compact && !resolving && <div className="table-tray">{tray}</div>}
        {resolving && !compact && choices.hint && !notice && <p className="board-hint">{choices.hint}</p>}
        {isTurn && !resolving && !card && !notice && !compact && state.actionsRemaining > 0 && <p className="board-hint">{hint}</p>}
      </section>
      {!compact && resolutionPanel}
      {!compact && !resolving && <TableRail state={state} newCardIds={newCardIds} onCompleteArrival={handlers.completeArrival} onResolveBurden={handlers.resolveBurden} onUseBoon={handlers.useBoon} onUseStewardPower={handlers.useStewardPower} onPlaceSpecial={(tileId) => setMode({ kind: "placing", tileId, orientation: 3 })} onEndTurn={handlers.endTurn} onReveal={handlers.reveal} onEndRound={handlers.endRound} />}
    </main>
    {compact && <div className={`table-sheet${sheetOpen ? " is-raised" : ""}${resolving ? " is-resolving" : ""}${resolving && sheetLow ? " is-low" : ""}`}>
      <span className="sheet-handle" aria-hidden="true" />
      {resolutionPanel ?? (card ? card.content : <CompactTurn state={state} onOpenRail={() => setRailOpen(true)} onEndTurn={handlers.endTurn} onReveal={handlers.reveal} onEndRound={handlers.endRound} />)}
    </div>}
    {compact && railOpen && <div className="rail-overlay" role="dialog" aria-modal="true" aria-label="Turn and encounters">
      <div className="rail-overlay-head"><button type="button" onClick={() => setRailOpen(false)}><ArrowLeft size={18} aria-hidden="true" />Back to the board</button></div>
      <TableRail state={state} newCardIds={newCardIds} onCompleteArrival={(id) => { setRailOpen(false); handlers.completeArrival(id); }} onResolveBurden={(id) => { setRailOpen(false); handlers.resolveBurden(id); }} onUseBoon={(id) => { setRailOpen(false); handlers.useBoon(id); }} onUseStewardPower={() => { setRailOpen(false); handlers.useStewardPower(); }} onPlaceSpecial={(tileId) => { setRailOpen(false); setMode({ kind: "placing", tileId, orientation: 3 }); }} onEndTurn={() => { setRailOpen(false); handlers.endTurn(); }} onReveal={handlers.reveal} onEndRound={handlers.endRound} />
      <div className="rail-overlay-tray">{tray}</div>
    </div>}
  </div>;
}

/** The table's top bar around a full-screen stage, for steps away from the board such as seeding. */
export function TableChrome({ state, canUndo, canRedo, onUndo, onRedo, onReset, children }: { state: GameState; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onReset: () => void; children: ReactNode }) {
  const compact = useCompact();
  return <div className={`table-screen${compact ? " is-compact" : ""}`}>
    <TableTopBar state={state} score={calculateFinalScore(state).finalScore} canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} onReset={onReset} compact={compact} />
    <div className="table-stage">{children}</div>
  </div>;
}

function stewardName(state: GameState): string {
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  return (player && stewardById[player.stewardId]?.name) ?? "Your Steward";
}

/** Where to show the placing card before a space is chosen: the current Steward. */
function placingAnchorHint(state: GameState): string {
  return state.players.find((player) => player.id === state.currentPlayerId)?.stewardHexId ?? "G5";
}

function TableTopBar({ state, forecast, score, canUndo, canRedo, onUndo, onRedo, onReset, compact }: { state: GameState; forecast?: ActionForecast; score: number; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onReset: () => void; compact: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const deltas = new Map<ResourceType, number>((forecast?.resources ?? []).map((change) => [change.resource, change.after]));
  const seasonNames = ["", "Foundations", "Growth", "Maturity"];
  return <header className="table-topbar">
    <div className="table-brand">The Quiet Vale</div>
    <div className="table-season">
      <span>Season {["", "I", "II", "III"][state.season]}{compact ? "" : ` · ${seasonNames[state.season]}`} · Round {state.round}{compact ? "" : " of 12"}</span>
      {!compact && <span className="round-track" aria-hidden="true">{[0, 1, 2].map((season) => <span key={season}>{[1, 2, 3, 4].map((step) => {
        const round = season * 4 + step;
        return <span key={round} className={round < state.round ? "is-done" : round === state.round ? "is-now" : ""} />;
      })}</span>)}</span>}
    </div>
    {!compact && <ul className="table-warehouse" aria-label="Warehouse">
      {resources.map((resource) => {
        const after = deltas.get(resource);
        const changed = after !== undefined && after !== state.warehouse[resource];
        return <li key={resource} className={`res-${resource}${changed ? " is-changing" : ""}${state.warehouse[resource] === 0 ? " is-empty" : ""}${state.warehouse[resource] >= warehouseCap ? " is-full" : ""}`}>
          <span className="res-swatch" aria-hidden="true" />
          <span className="res-label">{resourceLabels[resource]}</span>
          <strong>{state.warehouse[resource]}</strong>
          {changed && <span className="res-after" aria-label={`becomes ${after}`}>→ {after}</span>}
        </li>;
      })}
    </ul>}
    <span className="table-score" title="The shared score if the game ended now">Score now <strong>{score}</strong></span>
    <button type="button" className="icon-button" aria-label="Undo" disabled={!canUndo} onClick={onUndo}><Undo2 size={19} /></button>
    {!compact && <button type="button" className="icon-button" aria-label="Redo" disabled={!canRedo} onClick={onRedo}><Redo2 size={19} /></button>}
    <button type="button" className="icon-button" aria-label="Reset game" title="Start this settlement over" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); onReset(); }}><RotateCcw size={18} /></button>
    <div className="table-menu">
      <button type="button" className="icon-button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
      {menuOpen && <div className="table-menu-panel" role="menu">
        <a role="menuitem" href="./">Back to the start page</a>
        <a role="menuitem" href="?experience=tabletop">Open the Living Table layout</a>
      </div>}
    </div>
  </header>;
}

function EncounterStrip({ state, newCardIds, onOpen }: { state: GameState; newCardIds: ReadonlySet<string>; onOpen: () => void }) {
  const items = [
    ...state.encounters.activeArrivals.map((arrival) => ({ id: arrival.cardId, kind: "Arrival", urgent: arrival.timerTokens === 1, note: arrival.timerTokens === 1 ? "Last round" : `${arrival.timerTokens} rounds` })),
    ...state.encounters.activeBurdens.map((id) => ({ id, kind: "Burden", urgent: false, note: "Active" })),
    ...state.encounters.faceUpBoons.map((boon) => ({ id: boon.cardId, kind: "Boon", urgent: false, note: `${boon.remainingUses} use${boon.remainingUses === 1 ? "" : "s"}` }))
  ];
  return <nav className="encounter-strip" aria-label="Encounters on the table">
    {items.length === 0 && <span className="strip-empty">No encounters on the table</span>}
    {items.map((item) => <button key={item.id} type="button" className={`strip-card${item.urgent ? " is-urgent" : ""}${newCardIds.has(item.id) ? " is-new" : ""}`} onClick={onOpen}>
      <span>{item.kind} · {item.note}</span><strong>{encounterName(item.id)}</strong>
    </button>)}
  </nav>;
}

function encounterName(cardId: string): string {
  return encounterNames.get(cardId) ?? cardId;
}

const encounterNames = new Map(Object.values(encounterById).map((card) => [card.id, card.name]));

function CompactTurn({ state, onOpenRail, onEndTurn, onReveal, onEndRound }: { state: GameState; onOpenRail: () => void; onEndTurn: () => void; onReveal: () => void; onEndRound: () => void }) {
  const encounterCount = state.encounters.activeArrivals.length + state.encounters.activeBurdens.length + state.encounters.faceUpBoons.length;
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId);
  const steward = player ? stewardById[player.stewardId] : undefined;
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setConfirming(false), [state.currentPlayerId, state.round, state.actionsRemaining]);
  return <div className="compact-turn">
    <ul className="compact-warehouse" aria-label="Warehouse">
      {resources.map((resource) => <li key={resource} className={`res-${resource}${state.warehouse[resource] === 0 ? " is-empty" : ""}`}><span>{resourceLabels[resource]}</span><strong>{state.warehouse[resource]}</strong></li>)}
    </ul>
    {state.phase === "turns" ? <div className="compact-turn-row">
      <div><strong>{state.players.length > 1 ? `${steward?.name}’s turn` : "Your turn"}</strong><small>{player && !player.hasPlacedFirstTile ? `First, build on your Steward’s space at ${player.stewardHexId}` : null}{player && !player.hasPlacedFirstTile ? <br /> : null}{state.actionsRemaining} of 4 actions left · tap a tile or a space</small></div>
      {confirming
        ? <span className="compact-confirm"><button type="button" className="rail-primary" onClick={onEndTurn}>End</button><button type="button" onClick={() => setConfirming(false)}>Keep</button></span>
        : <button type="button" className="rail-secondary" onClick={() => state.actionsRemaining > 0 ? setConfirming(true) : onEndTurn()}>End turn</button>}
    </div> : state.phase === "reveal" ? <button type="button" className="rail-primary" onClick={onReveal}>Reveal encounters</button>
      : state.phase === "endRound" ? <button type="button" className="rail-primary" onClick={onEndRound}>Continue</button> : null}
    <div className="compact-links">
      <button type="button" onClick={onOpenRail}>Encounters · {encounterCount}</button>
      <button type="button" onClick={onOpenRail}>Power, tiles & rules</button>
    </div>
  </div>;
}


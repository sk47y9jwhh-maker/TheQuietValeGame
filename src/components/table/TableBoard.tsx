import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, forwardRef, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from "react";
import { mapLayout, terrainLabels } from "../../data/map";
import { stewardById } from "../../data/stewards";
import { getTileCategory } from "../../engine/placementRules";
import { selectTileName } from "../../engine/selectors";
import type { GameState, PlacedTile } from "../../engine/types";
import { MapArtworkImage } from "../map/MapArtwork";
import { tileArtworkUrl } from "../common/TileArtwork";
import {
  boardBounds,
  boardCellById,
  boardCells,
  categoryColors,
  hexHeight,
  hexPoints,
  hexRadius,
  iconPath,
  seatColors,
  tileIcon,
  tokenLines
} from "./boardGeometry";

export interface TableBoardHandle {
  /** Pan so a hex sits in the visible part of the board (above any covering sheet). */
  reveal: (hexId: string) => void;
  zoomBy: (factor: number) => void;
  fit: () => void;
}

interface TableBoardProps {
  state: GameState;
  selectedHexId: string | null;
  /** Spaces or tiles to emphasise: legal placements, a Linked group, a footprint preview. */
  legalHexIds?: ReadonlySet<string>;
  glowTileIds?: ReadonlySet<string>;
  footprintHexIds?: ReadonlySet<string>;
  /** Choices offered by a resolution step: candidates get a ring, chosen ones a badge. */
  choiceMarks?: ReadonlyMap<string, { selected: boolean; badge?: string; label: string }>;
  /** Arrows between spaces, e.g. the path of an Overstrain chain. */
  links?: { from: string; to: string; current: boolean }[];
  /** Stewards not yet on the board (during setup). */
  hiddenPawnIds?: ReadonlySet<string>;
  /** Pixels at the bottom of the board hidden behind a sheet on small screens. */
  coveredBottom?: number;
  onHexTap: (hexId: string) => void;
  onEmptyTap?: () => void;
  /** A card shown beside a hex, kept next to it as the board pans and zooms. */
  popover?: { hexId: string; content: ReactNode; width?: number } | null;
}

interface View { cx: number; cy: number; upp: number }

const minHexPx = 26;
const maxHexPx = 150;

function tileAt(state: GameState): Map<string, PlacedTile> {
  const byHex = new Map<string, PlacedTile>();
  for (const tile of state.map.placedTiles) for (const hexId of tile.hexIds) byHex.set(hexId, tile);
  return byHex;
}

export const TableBoard = forwardRef<TableBoardHandle, TableBoardProps>(function TableBoard(
  { state, selectedHexId, legalHexIds, glowTileIds, footprintHexIds, choiceMarks, links, hiddenPawnIds, coveredBottom = 0, onHexTap, onEmptyTap, popover },
  handle
) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverHeight, setPopoverHeight] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Tiles that have just arrived on the board settle in with a short animation.
  const knownTiles = useRef<Set<string> | null>(null);
  const [arrivingIds, setArrivingIds] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const ids = new Set(state.map.placedTiles.map((tile) => tile.instanceId));
    const previous = knownTiles.current;
    knownTiles.current = ids;
    if (!previous) return undefined;
    const added = [...ids].filter((id) => !previous.has(id));
    if (!added.length) return undefined;
    setArrivingIds(new Set(added));
    const timer = setTimeout(() => setArrivingIds(new Set()), 700);
    return () => clearTimeout(timer);
  }, [state.map.placedTiles]);
  const [view, setView] = useState<View | null>(null);
  const [cursorHexId, setCursorHexId] = useState<string>(() => state.players.find((player) => player.id === state.currentPlayerId)?.stewardHexId ?? "A1");
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; moved: boolean; view: View; pinchDistance?: number; hexId?: string } | null>(null);

  const placedByHex = useMemo(() => tileAt(state), [state]);

  // Track the frame size; the view keeps its zoom as the frame resizes.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const update = () => setSize({ width: frame.clientWidth, height: frame.clientHeight });
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(frame);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const fitView = useCallback((width: number, height: number): View => {
    const visibleHeight = Math.max(120, height - coveredBottom);
    const upp = Math.max(boardBounds.width / width, boardBounds.height / visibleHeight);
    return { cx: boardBounds.x + boardBounds.width / 2, cy: boardBounds.y + boardBounds.height / 2 + (coveredBottom * upp) / 2, upp };
  }, [coveredBottom]);

  const clampView = useCallback((next: View, width = size.width, height = size.height): View => {
    if (!width || !height) return next;
    const minUpp = (hexRadius * 2) / maxHexPx;
    const maxUpp = Math.max((hexRadius * 2) / minHexPx, fitView(width, height).upp);
    const upp = Math.min(maxUpp, Math.max(minUpp, next.upp));
    const halfW = (width * upp) / 2;
    const halfH = (height * upp) / 2;
    const clampAxis = (value: number, min: number, max: number, half: number) =>
      max - min <= half * 2 ? (min + max) / 2 : Math.min(max - half, Math.max(min + half, value));
    return {
      upp,
      cx: clampAxis(next.cx, boardBounds.x, boardBounds.x + boardBounds.width, halfW),
      cy: clampAxis(next.cy, boardBounds.y, boardBounds.y + boardBounds.height + coveredBottom * upp, halfH)
    };
  }, [coveredBottom, fitView, size.height, size.width]);

  // First view: the whole board on a large screen; on a phone, the current
  // Steward's surroundings at a readable size.
  useEffect(() => {
    if (view || !size.width || !size.height) return;
    const fitted = fitView(size.width, size.height);
    const hexPx = (hexRadius * 2) / fitted.upp;
    if (hexPx >= 56) { setView(fitted); return; }
    const steward = state.players.find((player) => player.id === state.currentPlayerId)?.stewardHexId;
    const anchor = (steward ? boardCellById.get(steward) : undefined) ?? boardCellById.get("G5");
    const upp = (hexRadius * 2) / 72;
    setView(clampView({ cx: anchor?.x ?? 340, cy: (anchor?.y ?? 260) + (coveredBottom * upp) / 2, upp }));
  }, [clampView, coveredBottom, fitView, size.height, size.width, state.currentPlayerId, state.players, view]);

  const current = view ?? (size.width ? fitView(size.width, size.height) : { cx: 340, cy: 260, upp: 1 });
  const viewBox = `${current.cx - (size.width * current.upp) / 2} ${current.cy - (size.height * current.upp) / 2} ${Math.max(1, size.width * current.upp)} ${Math.max(1, size.height * current.upp)}`;

  const toUnits = useCallback((clientX: number, clientY: number, at: View = current) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: at.cx, y: at.cy };
    return {
      x: at.cx + (clientX - rect.left - rect.width / 2) * at.upp,
      y: at.cy + (clientY - rect.top - rect.height / 2) * at.upp
    };
  }, [current]);

  const zoomAround = useCallback((factor: number, clientX?: number, clientY?: number) => {
    setView((previous) => {
      const base = previous ?? current;
      const rect = frameRef.current?.getBoundingClientRect();
      const px = clientX ?? (rect ? rect.left + rect.width / 2 : 0);
      const py = clientY ?? (rect ? rect.top + (rect.height - coveredBottom) / 2 : 0);
      const point = toUnits(px, py, base);
      const upp = base.upp / factor;
      const offsetX = rect ? px - rect.left - rect.width / 2 : 0;
      const offsetY = rect ? py - rect.top - rect.height / 2 : 0;
      return clampView({ upp, cx: point.x - offsetX * upp, cy: point.y - offsetY * upp });
    });
  }, [clampView, coveredBottom, current, toUnits]);

  useImperativeHandle(handle, () => ({
    reveal(hexId: string) {
      const target = boardCellById.get(hexId);
      if (!target || !size.width) return;
      setView((previous) => {
        const base = previous ?? current;
        const halfW = (size.width * base.upp) / 2;
        const top = base.cy - (size.height * base.upp) / 2;
        const visibleBottom = top + (size.height - coveredBottom) * base.upp;
        const margin = hexRadius * 1.6;
        const inX = target.x > base.cx - halfW + margin && target.x < base.cx + halfW - margin;
        const inY = target.y > top + margin && target.y < visibleBottom - margin;
        if (inX && inY) return base;
        const cy = target.y + ((size.height * base.upp) / 2 - ((size.height - coveredBottom) * base.upp) / 2);
        return clampView({ ...base, cx: inX ? base.cx : target.x, cy: inY ? base.cy : cy });
      });
    },
    zoomBy: (factor: number) => zoomAround(factor),
    fit: () => size.width && setView(fitView(size.width, size.height))
  }), [clampView, coveredBottom, current, fitView, size.height, size.width, zoomAround]);

  function hexFromEvent(target: EventTarget | null): string | undefined {
    const element = (target as Element | null)?.closest?.("[data-hex-id]");
    return element?.getAttribute("data-hex-id") ?? undefined;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      suppressClick.current = false;
      gesture.current = { startX: event.clientX, startY: event.clientY, moved: false, view: current, hexId: hexFromEvent(event.target) };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { startX: (a.x + b.x) / 2, startY: (a.y + b.y) / 2, moved: true, view: current, pinchDistance: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = gesture.current;
    if (pointers.current.size >= 2 && start.pinchDistance) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const upp = start.view.upp * (start.pinchDistance / Math.max(1, distance));
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const anchor = toUnits(start.startX, start.startY, start.view);
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect) return;
      setView(clampView({ upp, cx: anchor.x - (midX - rect.left - rect.width / 2) * upp, cy: anchor.y - (midY - rect.top - rect.height / 2) * upp }));
      return;
    }
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (!start.moved && Math.hypot(dx, dy) < 7) return;
    if (!start.moved) {
      start.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setView(clampView({ ...start.view, cx: start.view.cx - dx * start.view.upp, cy: start.view.cy - dy * start.view.upp }));
  }

  // Taps arrive as ordinary clicks (mouse, touch, assistive tech); a click
  // that ends a drag or pinch is ignored.
  const suppressClick = useRef(false);
  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    suppressClick.current = Boolean(start?.moved);
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if ((event.target as Element).closest?.(".board-popover")) return;
    const hexId = hexFromEvent(event.target);
    if (hexId) {
      setCursorHexId(hexId);
      onHexTap(hexId);
    } else onEmptyTap?.();
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.deltaY) return;
    zoomAround(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
  }

  function focusHex(hexId: string) {
    setCursorHexId(hexId);
    const element = frameRef.current?.querySelector<SVGGElement>(`[data-hex-id="${hexId}"]`);
    element?.focus({ preventScroll: true });
    // Keep the keyboard cursor in view.
    const target = boardCellById.get(hexId);
    if (target) setView((previous) => {
      const base = previous ?? current;
      const halfW = (size.width * base.upp) / 2;
      const halfH = ((size.height - coveredBottom) * base.upp) / 2;
      const top = base.cy - (size.height * base.upp) / 2;
      const inside = Math.abs(target.x - base.cx) < halfW - hexRadius && target.y > top + hexRadius && target.y < top + halfH * 2 - hexRadius;
      return inside ? base : clampView({ ...base, cx: target.x, cy: target.y + (coveredBottom * base.upp) / 2 });
    });
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>, hexId: string) {
    const cell = boardCellById.get(hexId)?.cell;
    if (!cell) return;
    const column = cell.col.charCodeAt(0) - 65;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const nextColumn = Math.min(mapLayout.columns - 1, Math.max(0, column + move[0]));
      const nextRow = Math.min(mapLayout.rows, Math.max(1, cell.row + move[1]));
      focusHex(`${String.fromCharCode(65 + nextColumn)}${nextRow}`);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onHexTap(hexId);
      return;
    }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomAround(1.25); }
    if (event.key === "-") { event.preventDefault(); zoomAround(0.8); }
  }

  useLayoutEffect(() => {
    setPopoverHeight(popoverRef.current?.offsetHeight ?? 0);
  });

  let popoverStyle: { left: number; top: number; width: number } | null = null;
  let popoverSide: "left" | "right" = "right";
  if (popover && !size.width) popoverStyle = { left: 12, top: 12, width: popover.width ?? 340 };
  if (popover && size.width) {
    const anchor = boardCellById.get(popover.hexId);
    if (anchor) {
      const width = Math.min(popover.width ?? 340, size.width - 24);
      const px = (anchor.x - current.cx) / current.upp + size.width / 2;
      const py = (anchor.y - current.cy) / current.upp + size.height / 2;
      const gap = hexRadius / current.upp + 12;
      popoverSide = px + gap + width <= size.width - 12 ? "right" : "left";
      const left = popoverSide === "right" ? px + gap : Math.max(12, px - gap - width);
      const top = Math.min(Math.max(12, py - popoverHeight / 2), Math.max(12, size.height - coveredBottom - popoverHeight - 12));
      popoverStyle = { left, top, width };
    }
  }

  const stewardMarks = state.players.map((player, index) => ({ player, index, steward: stewardById[player.stewardId] })).filter((mark) => !hiddenPawnIds?.has(mark.player.id));
  const currentPlayerIndex = state.players.findIndex((player) => player.id === state.currentPlayerId);
  const hexPx = (hexRadius * 2) / current.upp;
  const detail = hexPx >= 52 ? "full" : hexPx >= 34 ? "name" : "icon";

  return <div
    className="board-frame"
    ref={frameRef}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onClick={onClick}
    onPointerCancel={(event) => { pointers.current.delete(event.pointerId); gesture.current = null; }}
    onWheel={onWheel}
  >
    <svg className={`board-svg detail-${detail}${choiceMarks && choiceMarks.size > 36 ? " has-many-choices" : ""}`} viewBox={viewBox} role="group" aria-label="The Quiet Vale map. Use the arrow keys to move between spaces and Enter to choose one.">
      <MapArtworkImage kind="underlay" />
      <g className="board-hexes">
        {boardCells.map(({ cell, x, y }) => {
          const placed = placedByHex.get(cell.id);
          const legal = legalHexIds?.has(cell.id) ?? false;
          const inFootprint = footprintHexIds?.has(cell.id) ?? false;
          const selected = selectedHexId === cell.id || Boolean(placed && selectedHexId && placed.hexIds.includes(selectedHexId));
          const glow = Boolean(placed && glowTileIds?.has(placed.instanceId));
          const choice = choiceMarks?.get(cell.id);
          const name = placed ? selectTileName(placed) : "";
          const label = placed
            ? `${cell.id}, ${name}${placed.side === "upgraded" ? ", upgraded" : ""}, ${placed.strain} Strain${placed.strain >= 3 ? ", Overstrained" : ""}${placed.support.passive || placed.support.singleUse ? ", Supported" : ""}`
            : `${cell.id}, empty ${terrainLabels[cell.terrain]}${legal ? ", legal space" : ""}`;
          const fullLabel = choice ? `${label}. ${choice.selected ? "Chosen" : "Choice"}: ${choice.label}` : label;
          return <g
            key={cell.id}
            data-hex-id={cell.id}
            className={["board-hex", `terrain-${cell.terrain}`, legal ? "is-legal" : "", inFootprint ? "is-footprint" : "", selected ? "is-selected" : "", placed ? "is-placed" : "", choice ? (choice.selected ? "is-chosen" : "is-choice") : ""].join(" ")}
            role="button"
            tabIndex={cursorHexId === cell.id ? 0 : -1}
            aria-label={fullLabel}
            aria-pressed={choice ? choice.selected : selected}
            onKeyDown={(event) => onKeyDown(event, cell.id)}
            onFocus={() => setCursorHexId(cell.id)}
          >
            <polygon className="board-hex-hit" points={hexPoints(x, y)} />
            {glow && <polygon className="board-hex-glow" points={hexPoints(x, y, hexRadius + 1)} />}
            {placed && <TileToken state={state} tile={placed} hexId={cell.id} x={x} y={y} arriving={arrivingIds.has(placed.instanceId)} sharp={hexPx >= 120} />}
            {(legal || inFootprint) && <polygon className="board-hex-legal" points={hexPoints(x, y, hexRadius - 2.5)} />}
            {selected && <polygon className="board-hex-selected" points={hexPoints(x, y, hexRadius - 1)} />}
            {choice && <polygon className="board-hex-choice" points={hexPoints(x, y, hexRadius - 2)} />}
            {choice?.badge && <g className="board-choice-badge" transform={`translate(${x - 15} ${y - 17})`}><circle r={8.5} /><text y={3.4} textAnchor="middle">{choice.badge}</text></g>}
          </g>;
        })}
      </g>
      {links && links.length > 0 && <g className="board-links" aria-hidden="true">
        <defs><marker id="board-link-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" /></marker></defs>
        {links.map((link, index) => {
          const from = boardCellById.get(link.from);
          const to = boardCellById.get(link.to);
          if (!from || !to) return null;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const length = Math.hypot(dx, dy) || 1;
          const inset = 13;
          const x1 = from.x + (dx / length) * inset;
          const y1 = from.y + (dy / length) * inset;
          const x2 = to.x - (dx / length) * inset;
          const y2 = to.y - (dy / length) * inset;
          const bend = 0.18;
          const cx = (x1 + x2) / 2 - dy * bend;
          const cy = (y1 + y2) / 2 + dx * bend;
          return <path key={`${link.from}_${link.to}_${index}`} className={`board-link${link.current ? " is-current" : ""}`} d={`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`} markerEnd="url(#board-link-head)" />;
        })}
      </g>}
      <g className="board-pawns" aria-hidden="true">
        {stewardMarks.map(({ player, index, steward }) => {
          const at = boardCellById.get(player.stewardHexId);
          if (!at) return null;
          const sameHex = stewardMarks.filter((mark) => mark.player.stewardHexId === player.stewardHexId);
          const offset = sameHex.findIndex((mark) => mark.player.id === player.id) * 9;
          const active = index === currentPlayerIndex && state.phase === "turns";
          return <g key={player.id} className={`board-pawn${active ? " is-active" : ""}`} transform={`translate(${at.x + 14 - offset} ${at.y - hexHeight / 2 + 4})`}>
            <circle r={active ? 8.5 : 7.5} fill={seatColors[index % seatColors.length]} />
            <text y={3.2} textAnchor="middle">{(steward?.name ?? player.name).slice(0, 1)}</text>
          </g>;
        })}
      </g>
    </svg>
    {popover && popoverStyle && <div
      ref={popoverRef}
      className={`board-popover side-${popoverSide}`}
      style={popoverStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >{popover.content}</div>}
  </div>;
});

/**
 * A placed tile drawn with its printed artist face. The blank illustration
 * window carries what a player needs at a glance: a large name, a category
 * mark, Upgraded or Special, Strain and Supported. The printed text below the
 * window stays untouched and is readable when zoomed in or inspected.
 */
function TileToken({ state, tile, hexId, x, y, arriving = false, sharp = false }: { state: GameState; tile: PlacedTile; hexId: string; x: number; y: number; arriving?: boolean; sharp?: boolean }) {
  const category = getTileCategory(tile);
  const name = selectTileName(tile);
  const anchor = tile.hexIds[0] === hexId;
  const overstrained = tile.strain >= 3;
  const supported = tile.support.passive || tile.support.singleUse;
  const golden = tile.tileId.startsWith("golden_tile_");
  const accent = golden ? "#b8962e" : categoryColors[category];
  const side = tile.side === "upgraded" ? "upgraded" : "basic";
  // The small face is plenty at normal zoom; close up, the full-size print keeps its text crisp.
  const face = tileArtworkUrl(tile.tileId, side, { thumbnail: !sharp, board: sharp, extension: tile.kind === "core" && !anchor });
  const lines = anchor ? tokenLines(name, 12) : [];
  const clipId = `face_${hexId}`;
  const top = y - hexHeight / 2;
  // The printed illustration window: between 19% and 49% of the face's height.
  const windowTop = top + hexHeight * 0.2;
  const windowBottom = top + hexHeight * 0.48;
  // Fit the longest line inside the window (about 44 units wide).
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const nameSize = Math.min(lines.length > 1 ? 5.6 : 6.6, 44 / (longest * 0.5));
  const nameY = lines.length > 1 ? windowTop + 6.4 : windowTop + 8.6;
  const mark = tile.kind === "special" ? "SPECIAL" : golden ? "GOLDEN" : tile.side === "upgraded" ? "UPGRADED" : "";
  void state;
  return <g className={`tile-token tile-${category}${overstrained ? " is-overstrained" : ""}${tile.side === "upgraded" ? " is-upgraded" : ""}${arriving ? " is-arriving" : ""}`} style={arriving ? { transformOrigin: `${x}px ${y}px` } : undefined} aria-hidden="true">
    <clipPath id={clipId}><polygon points={hexPoints(x, y, hexRadius - 0.6)} /></clipPath>
    <polygon className="tile-token-shadow" points={hexPoints(x, y + 1.2, hexRadius - 0.6)} />
    <image className="tile-token-art" href={face} x={x - hexRadius} y={top} width={hexRadius * 2} height={hexHeight} preserveAspectRatio="none" clipPath={`url(#${clipId})`} />
    {overstrained && <polygon className="tile-token-overstrain" points={hexPoints(x, y, hexRadius - 0.6)} />}
    <polygon className="tile-token-edge" points={hexPoints(x, y, hexRadius - 1.2)} stroke={accent} />
    {anchor && <g className="tile-token-window">
      {lines.length > 0 && <text className="tile-token-name" x={x} y={nameY} textAnchor="middle" fontSize={nameSize}>
        {lines.map((line, index) => <tspan key={line} x={x} dy={index === 0 ? 0 : nameSize * 1.02}>{line}</tspan>)}
      </text>}
      <rect className="tile-token-category" x={x - 7} y={windowBottom - 4.6} width={14} height={1.3} rx={0.65} fill={accent} />
      {mark && !overstrained && <text className="tile-token-mark" x={x} y={windowBottom - 0.9} textAnchor="middle">{mark}</text>}
      {overstrained && <text className="tile-token-over" x={x} y={windowBottom - 0.9} textAnchor="middle">OVERSTRAINED</text>}
    </g>}
    {!anchor && <g className="tile-token-icon" transform={`translate(${x - 5.5} ${windowTop + 1}) scale(0.46)`}><path d={iconPath(tileIcon(tile.tileId, category))} stroke={accent} /></g>}
    {(tile.strain > 0 || overstrained) && <g className="tile-token-strain">
      {[0, 1, 2].map((index) => <circle key={index} cx={x - 7 + index * 7} cy={windowBottom + 2.6} r={2.5} className={index < tile.strain ? "is-filled" : ""} />)}
    </g>}
    {supported && <g className="tile-token-support" transform={`translate(${x - 20} ${windowTop + 4})`}>
      <circle r={4.6} />
      <path d="M0 -2.7 L2.5 -1.7 L2.5 0.35 C2.5 2 1.25 2.85 0 3.2 C-1.25 2.85 -2.5 2 -2.5 0.35 L-2.5 -1.7 Z" />
    </g>}
  </g>;
}

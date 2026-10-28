import { tileArtworkUrl } from "../common/TileArtwork";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { isPlayerExperience } from "../../app/experience";
import {
  mapCells,
  mapLayout,
  terrainLabels
} from "../../data/map";
import {
  getLegalPlacementHexes,
  getTileCategory,
  getTilePlacementHexIds
} from "../../engine/placementRules";
import {
  selectReachablePlacedTileIds
} from "../../engine/reachability";
import { selectCurrentPlayer, selectTileName } from "../../engine/selectors";
import type {
  GameState,
  HexDirection,
  PlacedTile,
  PlayerState,
  Terrain,
  TileCategory,
  TilePlacementDraft
} from "../../engine/types";
import {
  hasMapArtwork,
  MapArtworkCredit,
  MapArtworkImage
} from "./MapArtwork";

interface HexMapProps {
  state: GameState;
  selectedTileId: string;
  actionMode: string;
  selectedHexIds: string[];
  placementOrientation: HexDirection;
  onHexSelect: (hexId: string) => void;
  legalHexIds?: string[];
  mapHint?: string;
  onHexContextMenu?: (hexId: string, point: { x: number; y: number }) => void;
  onTileInspect?: (placedTileId: string) => void;
}

const radius = mapLayout.hexRadius;
const hexHeight = mapLayout.hexHeight;
const mapWidth = mapLayout.width;
const mapHeight = mapLayout.height;
const terrainKey: Terrain[] = [
  "grasslands",
  "woodland",
  "water",
  "mountains",
  "heaths",
  "arable",
  "ruins"
];
const longPressDelayMs = 520;
const longPressMoveTolerance = 12;
const tileLabelMaxChars = 10;

const tileCategoryGlyphs: Record<TileCategory, string> = {
  resource: "R",
  housing: "H",
  crafting: "C",
  merchant: "M",
  social: "S",
  wellbeing: "W",
  travel: "T",
  special: "✦"
};

const tileCategoryLabels: Record<TileCategory, string> = {
  resource: "Resource",
  housing: "Housing",
  crafting: "Crafting",
  merchant: "Merchant",
  social: "Social",
  wellbeing: "Wellbeing",
  travel: "Travel",
  special: "Special"
};

const tileCategoryKey = Object.keys(tileCategoryGlyphs) as TileCategory[];

function polygonPoints(cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index);
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

function getCellCenter(cell: { col: string; row: number }): { x: number; y: number } {
  const colIndex = cell.col.charCodeAt(0) - 65;
  return {
    x: radius + colIndex * radius * 1.5 + mapLayout.originX,
    y: hexHeight / 2 + (cell.row - 1) * hexHeight + (colIndex % 2 ? hexHeight / 2 : 0) + mapLayout.originY
  };
}

const mapGeometry = mapCells.map((cell) => {
  const center = getCellCenter(cell);
  return {
    cell,
    ...center,
    points: polygonPoints(center.x, center.y)
  };
});

const mapGeometryById = new Map(
  mapGeometry.map((geometry) => [geometry.cell.id, geometry])
);

function getTileLabelLines(tileName: string): string[] {
  if (!tileName) return [];
  if (tileName.length <= tileLabelMaxChars) return [tileName];

  const words = tileName.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= tileLabelMaxChars) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) lines.push(currentLine);
    currentLine = word;
    if (lines.length === 1) break;
  }

  if (currentLine && lines.length < 2) lines.push(currentLine);
  if (lines.length === 0) lines.push(tileName.slice(0, tileLabelMaxChars));

  return lines.slice(0, 2).map((line, index) => {
    if (index === 1 && line.length > tileLabelMaxChars) {
      return `${line.slice(0, tileLabelMaxChars - 1)}.`;
    }
    return line;
  });
}

export function HexMap({
  state,
  selectedTileId,
  actionMode,
  selectedHexIds,
  placementOrientation,
  onHexSelect,
  legalHexIds,
  mapHint,
  onHexContextMenu,
  onTileInspect
}: HexMapProps) {
  const tabletop = isPlayerExperience();
  const currentPlayer = selectCurrentPlayer(state);
  const selectionKey = selectedHexIds.join(",");
  const preferredHex = selectedHexIds[selectedHexIds.length - 1] ?? currentPlayer.stewardHexId;
  const [cursorHexId, setCursorHexId] = useState(preferredHex);
  const [coordinateQuery, setCoordinateQuery] = useState("");
  const [coordinateError, setCoordinateError] = useState("");
  const mapRef = useRef<SVGSVGElement>(null);
  const navigationRef = useRef<HTMLDetailsElement>(null);
  const [navigationFit, setNavigationFit] = useState({ height: 380, above: false });
  const fitNavigation = useCallback(() => {
    const navigation = navigationRef.current;
    if (!navigation?.open) return;
    const anchor = navigation.closest(".tabletop-map-toolbar")?.getBoundingClientRect();
    if (!anchor) return;
    const tray = document.querySelector('[aria-label="Game reference tray"]')?.getBoundingClientRect();
    const bottom = tray && tray.height > 0 && tray.top > 0 ? Math.min(window.innerHeight, tray.top) : window.innerHeight;
    const below = bottom - anchor.bottom - 14;
    const aboveSpace = anchor.top - 14;
    const above = below < 240 && aboveSpace > below;
    const height = Math.max(80, Math.min(420, above ? aboveSpace : below));
    setNavigationFit((current) => current.height === height && current.above === above ? current : { height, above });
  }, []);
  useEffect(() => {
    window.addEventListener("resize", fitNavigation);
    window.addEventListener("scroll", fitNavigation, true);
    return () => { window.removeEventListener("resize", fitNavigation); window.removeEventListener("scroll", fitNavigation, true); };
  }, [fitNavigation]);
  const keyboardHelpId = useId();
  const coordinateErrorId = useId();
  useEffect(() => {
    setCursorHexId(preferredHex);
  }, [selectionKey, currentPlayer.id, currentPlayer.stewardHexId, preferredHex]);
  const focusHex = (hexId: string) => {
    const cell = mapRef.current?.querySelector<SVGGElement>(`[data-hex-id="${hexId}"]`);
    if (!cell) return;
    setCursorHexId(hexId);
    cell.focus({ preventScroll: true });
    cell.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const [mapZoom, setMapZoom] = useState(1);
  const longPressRef = useRef<{
    timer: ReturnType<typeof setTimeout>;
    hexId: string;
    x: number;
    y: number;
    activated: boolean;
  } | null>(null);
  const ignoreClickHexRef = useRef<string | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }, []);

  const startLongPress = useCallback(
    (hexId: string, x: number, y: number) => {
      if (!onHexContextMenu) return;
      clearLongPress();

      const press = {
        timer: setTimeout(() => {
          if (!longPressRef.current || longPressRef.current.hexId !== hexId) return;
          longPressRef.current.activated = true;
          ignoreClickHexRef.current = hexId;
          onHexContextMenu(hexId, { x, y });
        }, longPressDelayMs),
        hexId,
        x,
        y,
        activated: false
      };

      longPressRef.current = press;
    },
    [clearLongPress, onHexContextMenu]
  );

  const cancelLongPressIfMoved = useCallback((x: number, y: number) => {
    const press = longPressRef.current;
    if (!press) return;
    const moved = Math.hypot(x - press.x, y - press.y);
    if (moved > longPressMoveTolerance) {
      clearTimeout(press.timer);
      longPressRef.current = null;
    }
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const placementDraft = useMemo<TilePlacementDraft>(
    () => ({
      anchorHexId: selectedHexIds[0],
      orientation: placementOrientation,
      secondaryHexIds: selectedHexIds.slice(1)
    }),
    [placementOrientation, selectedHexIds]
  );
  const legalHexes = useMemo(
    () =>
      legalHexIds ? new Set(legalHexIds) : actionMode === "place"
        ? new Set(
            getLegalPlacementHexes(
              state,
              currentPlayer.id,
              selectedTileId,
              placementDraft
            )
          )
        : new Set<string>(),
    [actionMode, currentPlayer.id, placementDraft, selectedTileId, state, legalHexIds]
  );
  const footprintHexes = useMemo(
    () =>
      (actionMode === "place" || actionMode === "signet")
        ? new Set(getTilePlacementHexIds(selectedTileId, placementDraft))
        : new Set<string>(selectedHexIds),
    [actionMode, placementDraft, selectedHexIds, selectedTileId]
  );
  const reachableTileIds = useMemo(
    () =>
      state.phase === "turns"
        ? selectReachablePlacedTileIds(state, currentPlayer.id)
        : new Set<string>(),
    [currentPlayer.id, state]
  );
  const placedTileByHex = useMemo(() => {
    const byHex = new Map<string, PlacedTile>();
    for (const tile of state.map.placedTiles) {
      for (const hexId of tile.hexIds) byHex.set(hexId, tile);
    }
    return byHex;
  }, [state.map.placedTiles]);
  const selectedPlacedTileIds = useMemo(
    () =>
      new Set(
        selectedHexIds.flatMap((hexId) => {
          const tile = placedTileByHex.get(hexId);
          return tile ? [tile.instanceId] : [];
        })
      ),
    [placedTileByHex, selectedHexIds]
  );
  const stewardsByHex = useMemo(() => {
    const byHex = new Map<string, Array<{ player: PlayerState; playerIndex: number }>>();
    state.players.forEach((player, playerIndex) => {
      const players = byHex.get(player.stewardHexId) ?? [];
      players.push({ player, playerIndex });
      byHex.set(player.stewardHexId, players);
    });
    return byHex;
  }, [state.players]);

  const cursorCell = mapGeometryById.get(cursorHexId)?.cell;
  const cursorTile = placedTileByHex.get(cursorHexId);

  const boardNavigation = <details className="board-navigation-help" ref={navigationRef} onToggle={fitNavigation} onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
  }}>
        <summary>Navigate</summary><div className="board-navigation-popover" style={{ maxHeight: navigationFit.height, top: navigationFit.above ? "auto" : undefined, bottom: navigationFit.above ? "calc(100% + 6px)" : undefined }}>
        <p id={keyboardHelpId}>Arrow keys browse by column or row. Home and End go to the ends of a row. Ctrl or ⌘ with Home or End goes to a board corner. Enter or Space selects. Press I to inspect a tile. Browsing does not spend an action.</p>
        <form onSubmit={(event) => {
          event.preventDefault();
          const hex = coordinateQuery.trim().toUpperCase();
          if (!mapGeometryById.has(hex)) { setCoordinateError("Enter a coordinate from A1 to N9."); return; }
          setCoordinateError("");
          setCoordinateQuery(hex);
          event.currentTarget.closest("details")?.removeAttribute("open");
          focusHex(hex);
        }}>
          <label>Hex coordinate<input value={coordinateQuery} onChange={(event) => { setCoordinateQuery(event.target.value); setCoordinateError(""); }} placeholder="For example, G1" autoComplete="off" spellCheck={false} maxLength={8} aria-invalid={Boolean(coordinateError)} aria-describedby={coordinateError ? coordinateErrorId : undefined} /></label>
          <button type="submit">Find hex</button>
        </form>
        {coordinateError && <p className="board-coordinate-error" role="alert" id={coordinateErrorId}>{coordinateError}</p>}
        {cursorCell && <div className="board-cursor-readout" role="group" aria-label="Board cursor">
          <p><span>Browsing {cursorHexId} · {terrainLabels[cursorCell.terrain]}</span><strong>{cursorTile ? selectTileName(cursorTile) : "Empty space"}</strong>{cursorTile && <span>{cursorTile.strain} Strain · {cursorTile.support.passive || cursorTile.support.singleUse ? "Supported" : "Unsupported"}</span>}</p>
          <div>
            {state.phase !== "gameEnd" && <button type="button" onClick={() => onHexSelect(cursorHexId)}>Select {cursorHexId}</button>}
            {cursorTile && onTileInspect && <button type="button" onClick={() => onTileInspect(cursorTile.instanceId)}>Inspect {selectTileName(cursorTile)} at {cursorHexId}</button>}
          </div>
        </div>}
      </div></details>;

  const legend = <>
        <div className="terrain-key" aria-label="Terrain colour key">
          {terrainKey.map((terrain) => (
            <span className="terrain-key-item" key={terrain}>
              <span className={`terrain-swatch terrain-${terrain}`} />
              {terrainLabels[terrain]}
            </span>
          ))}
        </div>
        <div className="map-symbol-key" aria-label="Tile and marker key">
          {tileCategoryKey.map((category) => (
            <span className="tile-type-key-item" key={category}>
              <svg
                aria-hidden="true"
                className={`tile-key-type tile-category-${category}`}
                viewBox="0 0 16 16"
              >
                <circle cx={8} cy={8} r={6} />
                <text x={8} y={10.5} textAnchor="middle">
                  {tileCategoryGlyphs[category]}
                </text>
              </svg>
              <span>{tileCategoryLabels[category]}</span>
            </span>
          ))}
          <span className="map-marker-key-item" title="The number shows current Strain">
            <svg aria-hidden="true" className="map-key-marker strain-marker" viewBox="0 0 20 20">
              <circle cx={10} cy={10} r={7} />
              <text x={10} y={13} textAnchor="middle">2</text>
            </svg>
            Strain
          </span>
          <span className="map-marker-key-item">
            <svg aria-hidden="true" className="map-key-marker support-marker" viewBox="0 0 20 20">
              <path d="M3,5 L10,2 L17,5 L16,13 L10,17 L4,13 Z" />
              <path className="support-marker-check" d="M6.5,9.5 L9,12 L14,7" />
            </svg>
            Supported
          </span>
          <span className="map-marker-key-item" title="The number identifies the player">
            <svg aria-hidden="true" className="map-key-marker steward-marker" viewBox="0 0 20 20">
              <circle cx={10} cy={10} r={7} />
              <text x={10} y={13} textAnchor="middle">1</text>
            </svg>
            Steward
          </span>
        </div>
  </>;

  return (
    <section className="map-panel" aria-label="Settlement map">
      <div className="map-meta-strip">
        {tabletop ? <>
          <div className="tabletop-map-toolbar">
            <strong>The settlement</strong>
            {boardNavigation}
            <details className="tabletop-map-legend"><summary>Map key</summary><div>{legend}</div></details>
            <div className="tabletop-map-zoom" role="group" aria-label="Map zoom">
              <button type="button" aria-label="Zoom out" disabled={mapZoom <= 1} onClick={() => setMapZoom((zoom) => Math.max(1, zoom - .5))}>−</button>
              <button type="button" aria-label="Fit whole board" onClick={() => setMapZoom(1)}>Fit</button>
              <button type="button" aria-label="Zoom in" disabled={mapZoom >= 3} onClick={() => setMapZoom((zoom) => Math.min(3, zoom + .5))}>+</button>
            </div>
          </div>
          <p className="map-gesture-hint">{mapHint ?? (state.phase === "gameEnd" ? "Final board · Inspect tiles or zoom in to review your settlement."
            : mapZoom === 1 ? "Whole board · Zoom in for detail. Select a hex to begin." : "Scroll to explore · Fit returns to the whole board.")}</p>
        </> : <>{legend}
        <p className="map-gesture-hint">
          <span className="desktop-hint">Right-click a hex for quick actions.</span>
          <span className="touch-hint">Tap a hex to select. Long-press for quick actions.</span>
        </p>
        </>}
      </div>
      <div className="map-artwork-frame">
        <div className="map-canvas" style={tabletop ? { "--map-zoom": mapZoom } as CSSProperties : undefined}>
        <svg
          className={`hex-map zoom-high ${hasMapArtwork ? "has-map-artwork" : ""}`}
          style={{
            width: "100%",
            height: "100%"
          }}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role={tabletop ? "group" : "img"}
          ref={mapRef}
          aria-describedby={tabletop ? keyboardHelpId : undefined}
          aria-label="The Quiet Vale map"
        >
          <MapArtworkImage kind="underlay" />
          <g className="hex-terrain-layer">
            {mapGeometry.map(({ cell, x, y, points }) => {
              const placed = placedTileByHex.get(cell.id);
              const legal = legalHexes.has(cell.id);
              const selected = selectedHexIds.includes(cell.id);
              const inFootprint = footprintHexes.has(cell.id);
              const terrainName = terrainLabels[cell.terrain];
              const tileName = placed ? selectTileName(placed) : "";
              const accessibleName = placed ? `${tileName}, ${terrainName}` : terrainName;
              const supported = Boolean(placed?.support.passive || placed?.support.singleUse);
              const overstrained = Boolean(placed && placed.strain >= 3);
              const reachable = Boolean(placed && reachableTileIds.has(placed.instanceId));
              const tileCategory = placed ? getTileCategory(placed) : null;
              const labelLines = getTileLabelLines(tileName);
              const labelWidth = Math.min(
                56,
                Math.max(32, Math.max(...labelLines.map((line) => line.length), 0) * 5.2 + 12)
              );
              const labelHeight = labelLines.length > 1 ? 25 : 18;

              return (
                <g
                  key={cell.id}
                  className={[
                    "hex-cell",
                    tabletop && cursorHexId === cell.id ? "is-cursor" : "",
                    `terrain-${cell.terrain}`,
                    legal ? "is-legal" : "",
                    selected ? "is-selected" : "",
                    inFootprint ? "is-footprint" : "",
                    placed ? "is-placed" : "",
                    placed?.kind === "special" ? "tile-special" : "",
                    placed?.tileId.startsWith("golden_tile_") ? "tile-golden" : "",
                    tileCategory ? `tile-${tileCategory}` : "",
                    reachable ? "is-reachable" : "",
                    supported ? "is-supported" : "",
                    overstrained ? "is-overstrained" : ""
                  ].join(" ")}
                  onClick={(event) => {
                    if (ignoreClickHexRef.current === cell.id) {
                      ignoreClickHexRef.current = null;
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                    if (tabletop) setCursorHexId(cell.id);
                    onHexSelect(cell.id);
                  }}
                  onFocus={tabletop ? () => setCursorHexId(cell.id) : undefined}
                  data-hex-id={cell.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    clearLongPress();
                    onHexContextMenu?.(cell.id, {
                      x: event.clientX,
                      y: event.clientY
                    });
                  }}
                  onTouchStart={(event) => {
                    if (event.touches.length !== 1) return;
                    const touch = event.touches[0];
                    startLongPress(cell.id, touch.clientX, touch.clientY);
                  }}
                  onTouchMove={(event) => {
                    if (longPressRef.current?.activated) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                    if (event.touches.length !== 1) {
                      clearLongPress();
                      return;
                    }
                    const touch = event.touches[0];
                    cancelLongPressIfMoved(touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={(event) => {
                    const press = longPressRef.current;
                    if (press?.hexId === cell.id && press.activated) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                    clearLongPress();
                  }}
                  onTouchCancel={clearLongPress}
                  onKeyDown={(event) => {
                    if (tabletop) {
                      const column = cell.col.charCodeAt(0) - 65;
                      const lastColumn = mapLayout.columns - 1;
                      const wholeBoard = event.ctrlKey || event.metaKey;
                      const nextColumn = event.key === "Home" ? 0 : event.key === "End" ? lastColumn : event.key === "ArrowLeft" ? Math.max(0, column - 1) : event.key === "ArrowRight" ? Math.min(lastColumn, column + 1) : column;
                      const nextRow = event.key === "Home" && wholeBoard ? 1 : event.key === "End" && wholeBoard ? mapLayout.rows : event.key === "ArrowUp" ? Math.max(1, cell.row - 1) : event.key === "ArrowDown" ? Math.min(mapLayout.rows, cell.row + 1) : cell.row;
                      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                        event.preventDefault();
                        focusHex(`${String.fromCharCode(65 + nextColumn)}${nextRow}`);
                        return;
                      }
                      if (event.key.toLowerCase() === "i" && !event.ctrlKey && !event.metaKey && !event.altKey) {
                        if (placed && onTileInspect) { event.preventDefault(); onTileInspect(placed.instanceId); }
                        return;
                      }
                    }
                    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
                    event.preventDefault();
                    onHexSelect(cell.id);
                  }}
                  role="button"
                  tabIndex={tabletop ? cursorHexId === cell.id ? 0 : -1 : 0}
                  aria-pressed={tabletop ? selected : undefined}
                  aria-description={tabletop && (legalHexIds || (state.phase === "turns" && actionMode === "place")) ? legal ? "Legal placement for the selected tile." : "Placement unavailable for the selected tile. Select to review the reason." : undefined}
                  aria-label={`${cell.id}, ${accessibleName}${
                    placed ? `, Strain ${placed.strain}, ${supported ? "Supported" : "Unsupported"}` : ""
                  }`}
                >
                  <title>
                    {cell.id}: {accessibleName}
                    {placed
                      ? ` | Strain ${placed.strain}/3 | ${
                          supported ? "Supported" : "Not Supported"
                        }`
                      : ""}
                  </title>
                  <polygon points={points} />
                  {placed && <image
                    className="hex-tile-artwork"
                    href={tileArtworkUrl(placed.tileId, placed.side === "upgraded" ? "upgraded" : "basic", { thumbnail: true, extension: placed.kind === "core" && placed.hexIds.indexOf(cell.id) > 0 })}
                    x={x - radius} y={y - hexHeight / 2} width={radius * 2} height={hexHeight}
                    preserveAspectRatio="none" aria-hidden="true"
                  />}
                  {placed && <polygon className="tile-artwork-outline" points={points} />}
                  {placed && tileCategory && (
                    <g
                      aria-hidden="true"
                      className={`tile-category-marker tile-category-${tileCategory}`}
                    >
                      <circle cx={x - 18} cy={y - 18} r={6} />
                      <text x={x - 18} y={y - 15.5} textAnchor="middle">
                        {tileCategoryGlyphs[tileCategory]}
                      </text>
                    </g>
                  )}
                  {placed && (
                    <>
                      <rect
                        className="hex-label-backplate"
                        x={x - labelWidth / 2}
                        y={y - labelHeight / 2}
                        width={labelWidth}
                        height={labelHeight}
                        rx={4}
                      />
                      <text
                        x={x}
                        y={labelLines.length > 1 ? y - 4 : y + 3}
                        textAnchor="middle"
                        className="hex-label"
                      >
                        {labelLines.map((line, index) => (
                          <tspan
                            key={`${line}-${index}`}
                            x={x}
                            dy={index === 0 ? 0 : 9.5}
                          >
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
          <MapArtworkImage kind="overlay" />
          {tabletop && (legalHexIds || (state.phase === "turns" && actionMode === "place")) && <g className="hex-planning-overlay" aria-hidden="true" pointerEvents="none">
            {mapGeometry.filter(({ cell }) => legalHexes.has(cell.id) || footprintHexes.has(cell.id)).map(({ cell, x, y, points }) => footprintHexes.has(cell.id)
              ? <g key={cell.id}><polygon points={points} /><rect x={x - 14} y={y - 9} width={28} height={18} rx={4} /><text x={x} y={y + 4} textAnchor="middle">{cell.id}</text></g>
              : <circle key={cell.id} cx={x} cy={y} r={4} />)}
          </g>}
          {onTileInspect && (
            <g className="hex-inspect-layer">
              {state.map.placedTiles.map((placed) => {
                const points = placed.hexIds
                  .flatMap((hexId) => {
                    const geometry = mapGeometryById.get(hexId);
                    return geometry ? [{ x: geometry.x, y: geometry.y }] : [];
                  });
                if (points.length === 0) return null;

                const x =
                  points.reduce((total, point) => total + point.x, 0) / points.length;
                const y =
                  points.reduce((total, point) => total + point.y, 0) / points.length;
                const tileName = selectTileName(placed);
                const isActive = selectedPlacedTileIds.has(placed.instanceId);

                return (
                  <g
                    aria-label={`Inspect ${tileName}`}
                    className={`tile-inspect-control ${isActive ? "is-active" : ""}`}
                    key={`inspect-${placed.instanceId}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onTileInspect(placed.instanceId);
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "Enter" &&
                        event.key !== " " &&
                        event.key !== "Spacebar"
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      onTileInspect(placed.instanceId);
                    }}
                    role="button"
                    tabIndex={isActive ? 0 : -1}
                    transform={`translate(${x + 18}, ${y - 19})`}
                  >
                    <title>Inspect {tileName}</title>
                    <circle className="tile-inspect-backplate" cx={0} cy={0} r={8.5} />
                    <path className="tile-inspect-eye" d="M-6,0 C-3.5,-4.5 3.5,-4.5 6,0 C3.5,4.5 -3.5,4.5 -6,0 Z" />
                    <circle className="tile-inspect-pupil" cx={0} cy={0} r={2.1} />
                  </g>
                );
              })}
            </g>
          )}
          <g className="hex-marker-layer" aria-hidden="true">
            {mapGeometry.map(({ cell, x, y }) => {
              const placed = placedTileByHex.get(cell.id);
              const stewardsHere = stewardsByHex.get(cell.id) ?? [];
              const supported = Boolean(placed?.support.passive || placed?.support.singleUse);
              const overstrained = Boolean(placed && placed.strain >= 3);

              return (
                <g className="hex-marker-stack" key={`markers-${cell.id}`}>
                  {supported && (
                    <g className="support-marker">
                      <path
                        d={`M${x - 21},${y + 10} L${x - 15},${y + 7} L${x - 9},${y + 10} L${x - 10},${y + 17} L${x - 15},${y + 20} L${x - 20},${y + 17} Z`}
                      />
                      <path
                        className="support-marker-check"
                        d={`M${x - 18},${y + 14} L${x - 16},${y + 16} L${x - 12},${y + 12}`}
                      />
                    </g>
                  )}
                  {placed && placed.strain > 0 && (
                    <g className="strain-marker">
                      <circle cx={x + 15} cy={y + 14} r={7} />
                      <text x={x + 15} y={y + 18} textAnchor="middle">
                        {placed.strain}
                      </text>
                    </g>
                  )}
                  {stewardsHere.map(({ player, playerIndex }, index) => (
                    <g
                      className="steward-marker"
                      key={player.id}
                      transform={`translate(${x - 15 + index * 10}, ${y - 22})`}
                    >
                      <circle cx={0} cy={0} r={6.5} />
                      <text x={0} y={3.5} textAnchor="middle">
                        {playerIndex + 1}
                      </text>
                    </g>
                  ))}
                  {overstrained && (
                    <text
                      x={x}
                      y={y + 25}
                      textAnchor="middle"
                      className="overstrain-label"
                    >
                      OVER
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        </div>
        <MapArtworkCredit />
      </div>
    </section>
  );
}

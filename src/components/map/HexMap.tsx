import { useCallback, useRef } from "react";
import { mapById, mapCells, terrainLabels } from "../../data/map";
import {
  getLegalPlacementHexes,
  getTileCategory,
  getTilePlacementHexIds
} from "../../engine/placementRules";
import {
  getPlacedTileAtHex,
  selectReachablePlacedTileIds
} from "../../engine/reachability";
import { selectCurrentPlayer, selectTileName } from "../../engine/selectors";
import type { GameState, HexDirection, Terrain, TilePlacementDraft } from "../../engine/types";

interface HexMapProps {
  state: GameState;
  selectedTileId: string;
  actionMode: string;
  selectedHexIds: string[];
  placementOrientation: HexDirection;
  onHexSelect: (hexId: string) => void;
  onHexContextMenu?: (hexId: string, point: { x: number; y: number }) => void;
  onTileInspect?: (placedTileId: string) => void;
}

const radius = 30;
const hexHeight = Math.sqrt(3) * radius;
const hexWidth = radius * 2;
const mapWidth = hexWidth + 13 * radius * 1.5 + 30;
const mapHeight = hexHeight * 9 + hexHeight / 2 + 40;
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

function polygonPoints(cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index);
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

function getCellCenter(cell: { col: string; row: number }): { x: number; y: number } {
  const colIndex = cell.col.charCodeAt(0) - 65;
  return {
    x: radius + colIndex * radius * 1.5 + 14,
    y: hexHeight / 2 + (cell.row - 1) * hexHeight + (colIndex % 2 ? hexHeight / 2 : 0) + 18
  };
}

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
  onHexContextMenu,
  onTileInspect
}: HexMapProps) {
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

  const currentPlayer = selectCurrentPlayer(state);
  const placementDraft: TilePlacementDraft = {
    anchorHexId: selectedHexIds[0],
    orientation: placementOrientation,
    secondaryHexIds: selectedHexIds.slice(1)
  };
  const legalHexes =
    actionMode === "place"
      ? new Set(
          getLegalPlacementHexes(
            state,
            currentPlayer.id,
            selectedTileId,
            placementDraft
          )
        )
      : new Set<string>();
  const footprintHexes =
    actionMode === "place"
      ? new Set(getTilePlacementHexIds(selectedTileId, placementDraft))
      : new Set<string>(selectedHexIds);
  const reachableTileIds =
    state.phase === "turns"
      ? selectReachablePlacedTileIds(state, currentPlayer.id)
      : new Set<string>();

  return (
    <section className="map-panel" aria-label="Settlement map">
      <div className="map-meta-strip">
        <div className="terrain-key" aria-label="Terrain colour key">
          {terrainKey.map((terrain) => (
            <span className="terrain-key-item" key={terrain}>
              <span className={`terrain-swatch terrain-${terrain}`} />
              {terrainLabels[terrain]}
            </span>
          ))}
        </div>
        <p className="map-gesture-hint">
          <span className="desktop-hint">Right-click a hex for quick actions.</span>
          <span className="touch-hint">Tap a hex to select. Long-press for quick actions.</span>
        </p>
      </div>
      <div className="map-canvas">
        <svg
          className="hex-map zoom-high"
          style={{
            width: "100%",
            height: "100%"
          }}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="The Quiet Vale map"
        >
          {mapCells.map((cell) => {
            const { x, y } = getCellCenter(cell);
            const placed = getPlacedTileAtHex(state, cell.id);
            const legal = legalHexes.has(cell.id);
            const selected = selectedHexIds.includes(cell.id);
            const inFootprint = footprintHexes.has(cell.id);
            const terrainName = terrainLabels[cell.terrain];
            const tileName = placed ? selectTileName(placed) : "";
            const accessibleName = placed ? `${tileName}, ${terrainName}` : terrainName;
            const stewardsHere = state.players.filter((player) => player.stewardHexId === cell.id);
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
                  `terrain-${cell.terrain}`,
                  legal ? "is-legal" : "",
                  selected ? "is-selected" : "",
                  inFootprint ? "is-footprint" : "",
                  placed ? "is-placed" : "",
                  placed?.kind === "special" ? "tile-special" : "",
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
                  onHexSelect(cell.id);
                }}
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
                  if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
                    return;
                  }
                  event.preventDefault();
                  onHexSelect(cell.id);
                }}
                role="button"
                tabIndex={0}
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
                <polygon points={polygonPoints(x, y)} />
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
          {onTileInspect && (
            <g className="hex-inspect-layer">
              {state.map.placedTiles.map((placed) => {
                const points = placed.hexIds
                  .map((hexId) => mapById[hexId])
                  .filter(Boolean)
                  .map(getCellCenter);
                if (points.length === 0) return null;

                const x =
                  points.reduce((total, point) => total + point.x, 0) / points.length;
                const y =
                  points.reduce((total, point) => total + point.y, 0) / points.length;
                const tileName = selectTileName(placed);

                return (
                  <g
                    aria-label={`Inspect ${tileName}`}
                    className="tile-inspect-control"
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
                    tabIndex={0}
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
            {mapCells.map((cell) => {
              const { x, y } = getCellCenter(cell);
              const placed = getPlacedTileAtHex(state, cell.id);
              const stewardsHere = state.players.filter(
                (player) => player.stewardHexId === cell.id
              );
              const supported = Boolean(placed?.support.passive || placed?.support.singleUse);
              const overstrained = Boolean(placed && placed.strain >= 3);

              return (
                <g className="hex-marker-stack" key={`markers-${cell.id}`}>
                  {supported && (
                    <g className="support-marker">
                      <circle cx={x - 15} cy={y + 14} r={7} />
                      <text x={x - 15} y={y + 18} textAnchor="middle">
                        S
                      </text>
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
                  {stewardsHere.map((player, index) => (
                    <g
                      className="steward-marker"
                      key={player.id}
                      transform={`translate(${x - 15 + index * 10}, ${y - 22})`}
                    >
                      <circle cx={0} cy={0} r={6.5} />
                      <text x={0} y={3.5} textAnchor="middle">
                        {state.players.findIndex((candidate) => candidate.id === player.id) + 1}
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
    </section>
  );
}

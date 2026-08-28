import { useCallback, useMemo, useRef } from "react";
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
      actionMode === "place"
        ? new Set(
            getLegalPlacementHexes(
              state,
              currentPlayer.id,
              selectedTileId,
              placementDraft
            )
          )
        : new Set<string>(),
    [actionMode, currentPlayer.id, placementDraft, selectedTileId, state]
  );
  const footprintHexes = useMemo(
    () =>
      actionMode === "place"
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
        <p className="map-gesture-hint">
          <span className="desktop-hint">Right-click a hex for quick actions.</span>
          <span className="touch-hint">Tap a hex to select. Long-press for quick actions.</span>
        </p>
      </div>
      <div className="map-artwork-frame">
        <div className="map-canvas">
        <svg
          className={`hex-map zoom-high ${hasMapArtwork ? "has-map-artwork" : ""}`}
          style={{
            width: "100%",
            height: "100%"
          }}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
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
                  <polygon points={points} />
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

import { mapCells, terrainLabels } from "../../data/map";
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

function polygonPoints(cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index);
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

export function HexMap({
  state,
  selectedTileId,
  actionMode,
  selectedHexIds,
  placementOrientation,
  onHexSelect,
  onHexContextMenu
}: HexMapProps) {
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
      <div className="terrain-key" aria-label="Terrain colour key">
        {terrainKey.map((terrain) => (
          <span className="terrain-key-item" key={terrain}>
            <span className={`terrain-swatch terrain-${terrain}`} />
            {terrainLabels[terrain]}
          </span>
        ))}
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
            const colIndex = cell.col.charCodeAt(0) - 65;
            const x = radius + colIndex * radius * 1.5 + 14;
            const y = hexHeight / 2 + (cell.row - 1) * hexHeight + (colIndex % 2 ? hexHeight / 2 : 0) + 18;
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
                  tileCategory ? `tile-${tileCategory}` : "",
                  reachable ? "is-reachable" : "",
                  supported ? "is-supported" : "",
                  overstrained ? "is-overstrained" : ""
                ].join(" ")}
                onClick={() => {
                  onHexSelect(cell.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onHexContextMenu?.(cell.id, {
                    x: event.clientX,
                    y: event.clientY
                  });
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
                <text x={x} y={y + 2} textAnchor="middle" className="hex-label">
                  {tileName.length > 17 ? `${tileName.slice(0, 16)}.` : tileName}
                </text>
                {supported && (
                  <g className="support-marker">
                    <circle cx={x - 19} cy={y + 19} r={8} />
                    <text x={x - 19} y={y + 23} textAnchor="middle">
                      S
                    </text>
                  </g>
                )}
                {placed && placed.strain > 0 && (
                  <g className="strain-marker">
                    <circle cx={x + 19} cy={y + 19} r={8} />
                    <text x={x + 19} y={y + 23} textAnchor="middle">
                      {placed.strain}
                    </text>
                  </g>
                )}
                {stewardsHere.map((player, index) => (
                  <g
                    className="steward-marker"
                    key={player.id}
                    transform={`translate(${x - 14 + index * 14}, ${y - 26})`}
                  >
                    <circle cx={0} cy={0} r={7} />
                    <text x={0} y={4} textAnchor="middle">
                      {state.players.findIndex((candidate) => candidate.id === player.id) + 1}
                    </text>
                  </g>
                ))}
                {overstrained && (
                  <text x={x} y={y + 29} textAnchor="middle" className="overstrain-label">
                    OVER
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

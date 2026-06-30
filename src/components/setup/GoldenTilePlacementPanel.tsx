import { Check, Crown, MapPin, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { mapCells, terrainLabels } from "../../data/map";
import { goldenTileById } from "../../data/tiles";
import {
  getGoldenTileSetupLegalHexIds,
  validateGoldenTileSetupPlacement
} from "../../engine/golden";
import type { GameState } from "../../engine/types";

const radius = 17;
const hexHeight = Math.sqrt(3) * radius;
const hexWidth = radius * 2;
const mapWidth = hexWidth + 13 * radius * 1.5 + 28;
const mapHeight = hexHeight * 9 + hexHeight / 2 + 34;

function polygonPoints(cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index);
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

const geometry = mapCells.map((cell) => {
  const colIndex = cell.col.charCodeAt(0) - 65;
  const x = radius + colIndex * radius * 1.5 + 14;
  const y =
    hexHeight / 2 +
    (cell.row - 1) * hexHeight +
    (colIndex % 2 ? hexHeight / 2 : 0) +
    17;
  return { cell, x, y, points: polygonPoints(x, y) };
});

interface GoldenTilePlacementPanelProps {
  state: GameState;
  onConfirm: (hexId: string) => void;
  onSkip: () => void;
}

export function GoldenTilePlacementPanel({
  state,
  onConfirm,
  onSkip
}: GoldenTilePlacementPanelProps) {
  const tileId = state.goldenSetup.selectedTileId;
  const tile = tileId ? goldenTileById[tileId] : undefined;
  const legalHexIds = useMemo(
    () => new Set(getGoldenTileSetupLegalHexIds(state)),
    [state]
  );
  const [selectedHexId, setSelectedHexId] = useState(
    () => [...legalHexIds][0] ?? ""
  );

  useEffect(() => {
    if (!legalHexIds.has(selectedHexId)) {
      setSelectedHexId([...legalHexIds][0] ?? "");
    }
  }, [legalHexIds, selectedHexId]);

  const validation = validateGoldenTileSetupPlacement(state, selectedHexId);
  const selectedCell = mapCells.find((cell) => cell.id === selectedHexId);

  return (
    <main className="command-table setup-flow-table golden-setup-flow">
      <section className="action-console setup-flow-panel golden-setup-panel">
        <div className="turn-summary">
          <div>
            <p className="eyebrow">Golden Legacy</p>
            <h2>Place Golden Tile</h2>
          </div>
          <strong>Setup</strong>
        </div>

        <div className="detail-stack golden-setup-summary">
          <div className="flow-heading">
            <Crown size={18} />
            <h3>{tile?.name ?? "Golden Tile"}</h3>
          </div>
          <p>{tile?.placement?.text}</p>
          <p>{tile?.effectText}</p>
          <small>{tile?.scoringText}</small>
        </div>

        <div className="detail-stack selected-start-summary">
          <div className="flow-heading">
            <MapPin size={18} />
            <h3>Selected Space</h3>
          </div>
          <span>
            {selectedCell
              ? `${selectedCell.id} · ${terrainLabels[selectedCell.terrain]}`
              : "No legal space selected"}
          </span>
        </div>

        {!validation.ok && selectedHexId && (
          <ul className="failure-list setup-placement-failures">
            {validation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        )}

        <button
          className="primary-action"
          disabled={!validation.ok}
          onClick={() => onConfirm(selectedHexId)}
          type="button"
        >
          <Check size={18} />
          Place {tile?.name ?? "Golden Tile"}
        </button>
        <button className="secondary-action" onClick={onSkip} type="button">
          <SkipForward size={17} />
          Play without this Golden Tile
        </button>
      </section>

      <section className="map-panel setup-map-panel" aria-label="Golden Tile setup map">
        <div className="steward-placement-board map-canvas">
          <svg
            className="steward-start-map golden-setup-map"
            role="img"
            aria-label={`${tile?.name ?? "Golden Tile"} placement map`}
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          >
            {geometry.map(({ cell, x, y, points }) => {
              const legal = legalHexIds.has(cell.id);
              const selected = selectedHexId === cell.id;
              return (
                <g
                  aria-disabled={legal ? undefined : true}
                  aria-label={`${cell.id}, ${terrainLabels[cell.terrain]}${legal ? ", legal" : ", unavailable"}`}
                  className={[
                    "steward-start-cell",
                    "golden-setup-cell",
                    `terrain-${cell.terrain}`,
                    legal ? "is-selectable" : "is-unavailable",
                    selected ? "selected" : ""
                  ].join(" ")}
                  key={cell.id}
                  onClick={legal ? () => setSelectedHexId(cell.id) : undefined}
                  onKeyDown={legal ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedHexId(cell.id);
                    }
                  } : undefined}
                  role={legal ? "button" : undefined}
                  tabIndex={legal ? 0 : undefined}
                >
                  <polygon points={points} />
                  {legal && !selected && <circle cx={x} cy={y} r={3.5} />}
                  {selected && (
                    <g transform={`translate(${x}, ${y})`}>
                      <circle className="golden-map-token" cx={0} cy={0} r={8} />
                      <text x={0} y={4} textAnchor="middle">G</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </section>
    </main>
  );
}

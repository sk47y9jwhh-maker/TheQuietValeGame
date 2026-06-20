import { Check, MapPin, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { mapCells, terrainLabels } from "../../data/map";
import { stewardById } from "../../data/stewards";
import { selectCurrentPlayer } from "../../engine/selectors";
import { validateStewardPlacement } from "../../engine/gameActions";
import type { GameState } from "../../engine/types";

const setupRadius = 17;
const setupHexHeight = Math.sqrt(3) * setupRadius;
const setupHexWidth = setupRadius * 2;
const setupMapWidth = setupHexWidth + 13 * setupRadius * 1.5 + 28;
const setupMapHeight = setupHexHeight * 9 + setupHexHeight / 2 + 34;
const setupTerrainKey = [
  "grasslands",
  "woodland",
  "water",
  "mountains",
  "heaths",
  "arable",
  "ruins"
] as const;

function setupPolygonPoints(cx: number, cy: number): string {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index);
    return `${cx + setupRadius * Math.cos(angle)},${cy + setupRadius * Math.sin(angle)}`;
  }).join(" ");
}

interface StewardPlacementPanelProps {
  state: GameState;
  onConfirm: (hexId: string) => void;
}

export function StewardPlacementPanel({
  state,
  onConfirm
}: StewardPlacementPanelProps) {
  const currentPlayer = selectCurrentPlayer(state);
  const steward = stewardById[currentPlayer.stewardId];
  const [selectedHexId, setSelectedHexId] = useState(currentPlayer.stewardHexId);

  useEffect(() => {
    setSelectedHexId(currentPlayer.stewardHexId);
  }, [currentPlayer.id, currentPlayer.stewardHexId]);

  const validation = validateStewardPlacement(state, currentPlayer.id, selectedHexId);
  const selectedCell = mapCells.find((cell) => cell.id === selectedHexId);
  const allowedTerrainText = steward.startingTerrains
    .map((terrain) => terrainLabels[terrain])
    .join(" or ");

  return (
    <main className="command-table setup-flow-table steward-start-flow">
      <section className="action-console setup-flow-panel">
        <div className="turn-summary">
          <div>
            <p className="eyebrow">Setup</p>
            <h2>Place Steward</h2>
          </div>
          <strong>Step 2</strong>
        </div>

        <div className="detail-stack steward-start-summary">
          <div className="flow-heading">
            <Shield size={18} />
            <h3>{steward.name}</h3>
          </div>
          <p>Choose a starting hex on {allowedTerrainText}.</p>
          <p>{steward.startingBenefit}</p>
        </div>

        <div className="detail-stack selected-start-summary">
          <div className="flow-heading">
            <MapPin size={18} />
            <h3>Selected Start</h3>
          </div>
          <span>
            {selectedHexId}
            {selectedCell ? ` | ${terrainLabels[selectedCell.terrain]}` : ""}
          </span>
        </div>

        {!validation.ok && (
          <ul className="failure-list setup-placement-failures">
            {validation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}

        <button
          className="primary-action steward-placement-confirm"
          disabled={!validation.ok}
          onClick={() => onConfirm(selectedHexId)}
          type="button"
        >
          <Check size={18} />
          Confirm {steward.name} Start
        </button>
      </section>

      <section className="map-panel setup-map-panel" aria-label="Steward starting map">
        <div className="terrain-key setup-terrain-key" aria-label="Terrain colour key">
          {setupTerrainKey.map((terrain) => (
            <span className="terrain-key-item" key={terrain}>
              <span className={`terrain-swatch terrain-${terrain}`} />
              {terrainLabels[terrain]}
            </span>
          ))}
        </div>
        <div className="steward-placement-board map-canvas">
          <svg
            className="steward-start-map"
            role="img"
            aria-label={`${steward.name} starting map`}
            viewBox={`0 0 ${setupMapWidth} ${setupMapHeight}`}
          >
            {mapCells.map((cell) => {
              const colIndex = cell.col.charCodeAt(0) - 65;
              const x = setupRadius + colIndex * setupRadius * 1.5 + 14;
              const y =
                setupHexHeight / 2 +
                (cell.row - 1) * setupHexHeight +
                (colIndex % 2 ? setupHexHeight / 2 : 0) +
                17;
              const allowed = steward.startingTerrains.includes(cell.terrain);
              const occupiedByOther = state.players.some(
                (player) =>
                  player.id !== currentPlayer.id && player.stewardHexId === cell.id
              );
              const selected = selectedHexId === cell.id;
              const occupiedPlayerIndex = state.players.findIndex(
                (player) =>
                  player.id !== currentPlayer.id && player.stewardHexId === cell.id
              );

              return (
                <g
                  aria-label={`${cell.id}, ${terrainLabels[cell.terrain]}${
                    allowed ? ", valid start" : ""
                  }${occupiedByOther ? ", occupied" : ""}`}
                  className={[
                    "steward-start-cell",
                    `terrain-${cell.terrain}`,
                    allowed ? "allowed" : "",
                    occupiedByOther ? "occupied" : "",
                    selected ? "selected" : ""
                  ].join(" ")}
                  key={cell.id}
                  onClick={() => setSelectedHexId(cell.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedHexId(cell.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <title>
                    {cell.id}: {terrainLabels[cell.terrain]}
                    {allowed ? " | Valid start" : ""}
                    {occupiedByOther ? " | Occupied" : ""}
                  </title>
                  <polygon points={setupPolygonPoints(x, y)} />
                  <text className="steward-start-id" x={x} y={y + 4} textAnchor="middle">
                    {cell.id}
                  </text>
                  {selected && (
                    <text
                      className="steward-start-selected"
                      x={x}
                      y={y - 9}
                      textAnchor="middle"
                    >
                      S
                    </text>
                  )}
                  {occupiedByOther && (
                    <g className="steward-start-occupied" transform={`translate(${x}, ${y + 12})`}>
                      <circle cx={0} cy={0} r={6} />
                      <text x={0} y={4} textAnchor="middle">
                        {occupiedPlayerIndex + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <aside className="right-panel setup-roster-panel">
        <p className="eyebrow">Stewards Board</p>
        <h2>Starting Tokens</h2>
        <div className="setup-roster-list">
          {state.players.map((player) => {
            const playerSteward = stewardById[player.stewardId];
            const playerCell = mapCells.find((cell) => cell.id === player.stewardHexId);
            const active = player.id === currentPlayer.id;
            return (
              <article className={`mini-card ${active ? "active-setup-card" : ""}`} key={player.id}>
                <div className="mini-card-heading">
                  <strong>{playerSteward.name}</strong>
                  <span>{active ? "Choosing" : player.name}</span>
                </div>
                <p>
                  {active ? selectedHexId : player.stewardHexId}
                  {" | "}
                  {active
                    ? selectedCell
                      ? terrainLabels[selectedCell.terrain]
                      : "Select a hex"
                    : playerCell
                      ? terrainLabels[playerCell.terrain]
                      : "Unplaced"}
                </p>
                <p>{playerSteward.objective}</p>
              </article>
            );
          })}
        </div>
      </aside>
    </main>
  );
}

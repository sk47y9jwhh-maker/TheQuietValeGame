import { isPlayerExperience } from "../../app/experience";
import { Check, MapPin, Shield } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { mapCells, terrainLabels } from "../../data/map";
import { stewardById } from "../../data/stewards";
import { selectCurrentPlayer } from "../../engine/selectors";
import { validateStewardPlacement } from "../../engine/gameActions";
import type { GameState } from "../../engine/types";
import {
  hasMapArtwork,
  MapArtworkCredit,
  MapArtworkImage
} from "../map/MapArtwork";

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

const setupMapGeometry = mapCells.map((cell) => {
  const colIndex = cell.col.charCodeAt(0) - 65;
  const x = setupRadius + colIndex * setupRadius * 1.5 + 14;
  const y =
    setupHexHeight / 2 +
    (cell.row - 1) * setupHexHeight +
    (colIndex % 2 ? setupHexHeight / 2 : 0) +
    17;

  return {
    cell,
    x,
    y,
    points: setupPolygonPoints(x, y)
  };
});

interface StewardPlacementPanelProps {
  state: GameState;
  onConfirm: (hexId: string) => void;
}

export function StewardPlacementPanel({
  state,
  onConfirm
}: StewardPlacementPanelProps) {
  const enhanced = isPlayerExperience();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [zoom, setZoom] = useState(1);
  const currentPlayer = selectCurrentPlayer(state);
  const steward = stewardById[currentPlayer.stewardId];
  const [selectedHexId, setSelectedHexId] = useState(currentPlayer.stewardHexId);

  useEffect(() => {
    setSelectedHexId(currentPlayer.stewardHexId);
  }, [currentPlayer.id, currentPlayer.stewardHexId]);

  useEffect(() => {
    if (enhanced) headingRef.current?.focus();
    setZoom(1);
  }, [currentPlayer.id, enhanced]);
  const validStarts = mapCells.filter((cell) => validateStewardPlacement(state, currentPlayer.id, cell.id).ok);

  const validation = validateStewardPlacement(state, currentPlayer.id, selectedHexId);
  const selectedCell = mapCells.find((cell) => cell.id === selectedHexId);
  const allowedTerrainText = steward.startingTerrains
    .map((terrain) => terrainLabels[terrain])
    .join(" or ");
  const occupiedPlayerIndexByHex = useMemo(() => {
    const byHex = new Map<string, number>();
    state.players.forEach((player, playerIndex) => {
      if (player.id !== currentPlayer.id) {
        byHex.set(player.stewardHexId, playerIndex);
      }
    });
    return byHex;
  }, [currentPlayer.id, state.players]);

  const map = (
<section className="map-panel setup-map-panel" aria-label="Steward starting map">
        <div className="setup-map-meta">
          <div className="terrain-key setup-terrain-key" aria-label="Terrain colour key">
            {setupTerrainKey.map((terrain) => (
              <span className="terrain-key-item" key={terrain}>
                <span className={`terrain-swatch terrain-${terrain}`} />
                {terrainLabels[terrain]}
              </span>
            ))}
          </div>
        </div>
        {enhanced && <div className="starting-map-tools" role="group" aria-label="Starting map zoom"><span>{zoom === 1 ? "Whole board" : "Zoomed · scroll to explore"}</span><button type="button" onClick={() => setZoom(1)} disabled={zoom === 1}>Fit starting map</button><button type="button" onClick={() => setZoom(zoom === 1 ? 2 : 1)}>{zoom === 1 ? "Zoom starting map" : "Zoom out"}</button></div>}
        <div className="map-artwork-frame">
          <div className="starting-map-scroll"><div className="steward-placement-board map-canvas" style={enhanced ? { width: `${zoom * 100}%` } : undefined}>
            <svg
            className={`steward-start-map ${hasMapArtwork ? "has-map-artwork" : ""}`}
            style={enhanced ? { maxHeight: `calc(var(--starting-map-height, 540px) * ${zoom})` } : undefined}
            role={enhanced ? "group" : "img"}
            aria-label={`${steward.name} starting map`}
            viewBox={`0 0 ${setupMapWidth} ${setupMapHeight}`}
          >
            <MapArtworkImage
              hexRadius={setupRadius}
              kind="underlay"
              originX={14}
              originY={17}
            />
            {setupMapGeometry.map(({ cell, x, y, points }) => {
              const allowed = steward.startingTerrains.includes(cell.terrain);
              const occupiedPlayerIndex = occupiedPlayerIndexByHex.get(cell.id);
              const occupiedByOther = occupiedPlayerIndex !== undefined;
              const selectable = allowed && !occupiedByOther;
              const selected = selectedHexId === cell.id;

              return (
                <g
                  aria-disabled={selectable ? undefined : true}
                  aria-label={`${enhanced ? `${cell.id}, ` : ""}${terrainLabels[cell.terrain]}${
                    selectable ? ", valid start" : ", unavailable start"
                  }${occupiedByOther ? ", occupied" : ""}`}
                  aria-pressed={enhanced && selectable ? selected : undefined}
                  data-start-hex={cell.id}
                  className={[
                    "steward-start-cell",
                    `terrain-${cell.terrain}`,
                    selectable ? "is-selectable" : "is-unavailable",
                    occupiedByOther ? "occupied" : "",
                    selected ? "selected" : ""
                  ].join(" ")}
                  key={cell.id}
                  onClick={selectable ? () => setSelectedHexId(cell.id) : undefined}
                  onKeyDown={
                    selectable
                      ? (event) => {
                          if (enhanced && ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) {
                            event.preventDefault();
                            const index = validStarts.findIndex((start) => start.id === cell.id);
                            const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
                            const next = event.key === "Home" ? 0 : event.key === "End" ? validStarts.length - 1 : (index + delta + validStarts.length) % validStarts.length;
                            const id = validStarts[next].id;
                            setSelectedHexId(id);
                            event.currentTarget.parentElement?.querySelector<SVGGElement>(`[data-start-hex="${id}"]`)?.focus();
                          }
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedHexId(cell.id);
                          }
                        }
                      : undefined
                  }
                  role={selectable ? "button" : undefined}
                  tabIndex={selectable ? enhanced ? selected || (!validation.ok && cell.id === validStarts[0]?.id) ? 0 : -1 : 0 : undefined}
                >
                  <title>
                    {terrainLabels[cell.terrain]}
                    {selectable ? " | Valid start" : " | Unavailable start"}
                    {occupiedByOther ? " | Occupied" : ""}
                  </title>
                  <polygon points={points} />
                  {selectable && !selected && (
                    <circle className="steward-start-option-dot" cx={x} cy={y} r={3.5} />
                  )}
                  {selected && (
                    <g className="steward-start-selected-token" transform={`translate(${x}, ${y})`}>
                      <circle cx={0} cy={0} r={8} />
                      <text x={0} y={4} textAnchor="middle">
                        S
                      </text>
                    </g>
                  )}
                  {occupiedByOther && (
                    <g className="steward-start-occupied" transform={`translate(${x}, ${y + 12})`}>
                      <circle cx={0} cy={0} r={6} />
                      <text x={0} y={4} textAnchor="middle">
                        {(occupiedPlayerIndex ?? 0) + 1}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
            <MapArtworkImage
              hexRadius={setupRadius}
              kind="overlay"
              originX={14}
              originY={17}
            />
            </svg>
          </div>
          </div><MapArtworkCredit />
        </div>
      </section>
  );

  if (enhanced) return <main className="starting-experience">
    <header className="starting-heading"><p className="eyebrow">Choose your place in the Vale</p><h1 ref={headingRef} tabIndex={-1}>Place your {steward.name}</h1><p>{currentPlayer.name} · Steward {state.players.findIndex((player) => player.id === currentPlayer.id) + 1} of {state.playerCount}</p></header>
    <section className="starting-choice" aria-label="Choose a starting position">
      <p>Your {steward.name} starts on <strong>{allowedTerrainText}</strong>. Choose on the map or use the list of legal spaces.</p>
      <label>Starting space<select value={selectedHexId} onChange={(event) => setSelectedHexId(event.target.value)}>{!validation.ok && <option value={selectedHexId}>Choose a valid space</option>}{validStarts.map((cell) => <option key={cell.id} value={cell.id}>{cell.id} · {terrainLabels[cell.terrain]}</option>)}</select></label>
      <p className="starting-selection" role="status"><MapPin size={19} aria-hidden="true" /><span>Selected start<strong>{selectedCell ? `${selectedHexId} · ${terrainLabels[selectedCell.terrain]}` : "Choose a space"}</strong></span></p>
      {!validation.ok && <ul className="failure-list">{validation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
      <button className="primary-action" disabled={!validation.ok} onClick={() => onConfirm(selectedHexId)} type="button"><Check size={18} aria-hidden="true" />Confirm {steward.name} Start</button>
      <small>{state.players.findIndex((player) => player.id === currentPlayer.id) + 1 < state.playerCount ? "The next Steward chooses after you confirm." : state.goldenSetup.selectedTileId ? "Next, place your Golden Tile." : "Next, prepare the first season."}</small>
      <details className="starting-steward-help"><summary>Your Steward’s power and objective</summary><h2>{steward.name}</h2><p>{steward.powerText}</p><p>{steward.objectiveText}</p></details>
    </section>
    {map}
    <details className="starting-roster"><summary>Stewards at this table · {state.playerCount}</summary><ul>{state.players.map((player) => <li key={player.id}><strong>{player.name} · {stewardById[player.stewardId].name}</strong><span>{player.id === currentPlayer.id ? `Choosing ${selectedHexId}` : `${state.players.indexOf(player) < state.players.indexOf(currentPlayer) ? "Confirmed" : "Suggested"} · ${player.stewardHexId}`}</span></li>)}</ul></details>
  </main>;

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
          <p>{steward.powerText}</p>
        </div>

        <div className="detail-stack selected-start-summary">
          <div className="flow-heading">
            <MapPin size={18} />
            <h3>Selected Start</h3>
          </div>
          <span>{selectedCell ? terrainLabels[selectedCell.terrain] : "Select a valid start"}</span>
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

      {map}

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
                  {active
                    ? selectedCell
                      ? terrainLabels[selectedCell.terrain]
                      : "Select a valid start"
                    : playerCell
                      ? terrainLabels[playerCell.terrain]
                      : "Unplaced"}
                </p>
                <p>{playerSteward.objectiveText}</p>
              </article>
            );
          })}
        </div>
      </aside>
    </main>
  );
}

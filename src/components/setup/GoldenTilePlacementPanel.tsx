import { isPlayerExperience } from "../../app/experience";
import { stewardById } from "../../data/stewards";
import { TileArtwork } from "../common/TileArtwork";
import { Check, Crown, MapPin, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { mapCells, terrainLabels } from "../../data/map";
import { goldenTileById } from "../../data/tiles";
import {
  getGoldenTileSetupLegalHexIds,
  validateGoldenTileSetupPlacement
} from "../../engine/golden";
import type { GameState } from "../../engine/types";
import {
  hasMapArtwork,
  MapArtworkCredit,
  MapArtworkImage
} from "../map/MapArtwork";

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

function LegacyGoldenTilePlacementPanel({
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
          {tile && <TileArtwork tileId={tile.id} name={tile.name} />}
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
        <div className="map-artwork-frame">
          <div className="steward-placement-board map-canvas">
            <svg
            className={`steward-start-map golden-setup-map ${hasMapArtwork ? "has-map-artwork" : ""}`}
            role="img"
            aria-label={`${tile?.name ?? "Golden Tile"} placement map`}
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          >
            <MapArtworkImage
              hexRadius={radius}
              kind="underlay"
              originX={14}
              originY={17}
            />
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
            <MapArtworkImage
              hexRadius={radius}
              kind="overlay"
              originX={14}
              originY={17}
            />
            </svg>
          </div>
          <MapArtworkCredit />
        </div>
      </section>
    </main>
  );
}


export function GoldenTilePlacementPanel(props: GoldenTilePlacementPanelProps) {
  return isPlayerExperience() ? <GoldenPlacement {...props} /> : <LegacyGoldenTilePlacementPanel {...props} />;
}

function GoldenPlacement({ state, onConfirm, onSkip }: GoldenTilePlacementPanelProps) {
  const tile = state.goldenSetup.selectedTileId ? goldenTileById[state.goldenSetup.selectedTileId] : undefined;
  const legalIds = useMemo(() => getGoldenTileSetupLegalHexIds(state), [state]);
  const [selected, setSelected] = useState(() => legalIds[0] ?? "");
  const [zoom, setZoom] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const mapRef = useRef<SVGSVGElement>(null);
  const validSelection = legalIds.includes(selected) ? selected : legalIds[0] ?? "";
  const selectedCell = mapCells.find((cell) => cell.id === validSelection);
  const validation = validateGoldenTileSetupPlacement(state, validSelection);
  useEffect(() => { heading.current?.focus(); setZoom(1); }, [tile?.id]);

  function focusChoice(id: string) {
    setSelected(id);
    const cell = mapRef.current?.querySelector<SVGGElement>(`[data-golden-hex="${id}"]`);
    cell?.focus({ preventScroll: true });
    cell?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  return <main className="starting-experience golden-placement-experience">
    <header className="starting-heading"><p className="eyebrow">Your shared Golden Legacy</p><h1 ref={heading} tabIndex={-1}>Place {tile?.name ?? "your Golden Tile"}</h1><p>One optional tile for the whole settlement. Your Stewards keep their starting positions.</p></header>
    <section className="starting-choice" aria-label="Choose a Golden Tile position">
      {tile && <div className="golden-placement-preview"><TileArtwork tileId={tile.id} name={tile.name} /><div><span className="golden-free-placement">0 actions · No resources</span><p>{tile.effectText}</p></div></div>}
      <p>{tile?.placement?.text ?? "Select an unlocked Golden Tile during setup."}</p>
      {tile?.scoringText && <details className="starting-steward-help"><summary>Golden scoring</summary><p>{tile.scoringText}</p></details>}
      <label>Golden Tile space<select value={validSelection} disabled={!legalIds.length} onChange={(event) => setSelected(event.target.value)}>{!legalIds.length && <option value="">No legal spaces</option>}{legalIds.map((id) => { const cell = mapCells.find((candidate) => candidate.id === id)!; return <option key={id} value={id}>{id} · {terrainLabels[cell.terrain]}</option>; })}</select></label>
      <p className="starting-selection" role="status"><MapPin size={19} aria-hidden="true" /><span>Selected space<strong>{selectedCell ? `${selectedCell.id} · ${terrainLabels[selectedCell.terrain]}` : "No legal space available"}</strong></span></p>
      {!validation.ok && <ul className="failure-list">{validation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
      <button className="primary-action" type="button" disabled={!validation.ok} onClick={() => onConfirm(validSelection)}><Check size={18} aria-hidden="true" />Place {tile?.name ?? "Golden Tile"}</button>
      <button className="golden-skip" type="button" onClick={onSkip}><SkipForward size={17} aria-hidden="true" />Play without this Golden Tile</button>
      <small>Next, each Steward prepares their Encounter cards. You can Undo this placement or skip.</small>
    </section>
    <section className="map-panel setup-map-panel" aria-label="Golden Tile setup map">
      <div className="starting-map-tools" role="group" aria-label="Golden map zoom"><span>{legalIds.length} legal spaces · {zoom === 1 ? "Whole board" : "Scroll to explore"}</span><button type="button" disabled={zoom === 1} onClick={() => setZoom(1)}>Fit Golden map</button><button type="button" onClick={() => setZoom(zoom === 1 ? 2 : 1)}>{zoom === 1 ? "Zoom Golden map" : "Zoom out"}</button></div>
      <p id="golden-map-help" className="golden-map-help">Select a marked space, or use the list. Arrow keys browse legal spaces. Home/End reach the first/last. Place confirms your choice.</p>
      <div className="map-artwork-frame"><div className="starting-map-scroll"><div className="steward-placement-board map-canvas" style={{ width: `${zoom * 100}%` }}>
        <svg ref={mapRef} className={`steward-start-map golden-setup-map ${hasMapArtwork ? "has-map-artwork" : ""}`} style={{ maxHeight: `calc(var(--starting-map-height, 540px) * ${zoom})` }} viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="group" aria-label={`${tile?.name ?? "Golden Tile"} placement map`} aria-describedby="golden-map-help">
          <MapArtworkImage hexRadius={radius} kind="underlay" originX={14} originY={17} />
          {geometry.map(({ cell, x, y, points }) => {
            const legal = legalIds.includes(cell.id);
            const isSelected = validSelection === cell.id;
            const players = state.players.filter((player) => player.stewardHexId === cell.id);
            return <g key={cell.id} data-golden-hex={cell.id} role={legal ? "button" : undefined} aria-disabled={legal ? undefined : true} aria-pressed={legal ? isSelected : undefined} aria-label={`${cell.id}, ${terrainLabels[cell.terrain]}, ${legal ? "legal" : "unavailable"}${players.map((player) => `, ${stewardById[player.stewardId].name} starts here`).join("")}`} tabIndex={legal ? isSelected ? 0 : -1 : undefined} className={`steward-start-cell golden-setup-cell terrain-${cell.terrain} ${legal ? "is-selectable" : "is-unavailable"} ${isSelected ? "selected" : ""}`} onClick={legal ? () => setSelected(cell.id) : undefined} onKeyDown={legal ? (event) => {
              if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const index = legalIds.indexOf(cell.id);
                const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
                const next = event.key === "Home" ? 0 : event.key === "End" ? legalIds.length - 1 : (index + delta + legalIds.length) % legalIds.length;
                focusChoice(legalIds[next]);
              } else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(cell.id); }
            } : undefined}>
              <polygon points={points} />
              {legal && !isSelected && <circle cx={x} cy={y} r={3.5} />}
              {isSelected && <g transform={`translate(${x}, ${y})`}><circle className="golden-map-token" r={8} /><text y={4} textAnchor="middle">G</text></g>}
              {players.map((player) => <g className="golden-start-token" key={player.id} transform={`translate(${x}, ${y + 11})`}><circle r={6} /><text y={3} textAnchor="middle">{state.players.indexOf(player) + 1}</text></g>)}
            </g>;
          })}
          <MapArtworkImage hexRadius={radius} kind="overlay" originX={14} originY={17} />
        </svg>
      </div></div><MapArtworkCredit /></div>
    </section>
    <aside className="starting-roster golden-starts" aria-label="Confirmed Steward starts"><h2>Stewards at the table</h2><ul>{state.players.map((player, index) => <li key={player.id}><strong>{index + 1} · {stewardById[player.stewardId].name}</strong><span>{player.stewardHexId} · Confirmed start</span></li>)}</ul></aside>
  </main>;
}

import { useEffect, useMemo, useState } from "react";
import { Check, SkipForward } from "lucide-react";
import { mapById, mapCells, terrainLabels } from "../../data/map";
import { stewardById } from "../../data/stewards";
import { goldenTileById } from "../../data/tiles";
import { validateStewardPlacement } from "../../engine/gameActions";
import { getGoldenTileSetupLegalHexIds } from "../../engine/golden";
import { selectCurrentPlayer } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { useBoardChoices } from "./boardChoices";

const placeName = (hexId: string) => `${hexId} · ${mapById[hexId] ? terrainLabels[mapById[hexId].terrain] : "Unknown space"}`;

/** Choosing a Steward's starting space, on the main board. */
export function TableStewardStart({ state, onConfirm }: { state: GameState; onConfirm: (hexId: string) => void }) {
  const player = selectCurrentPlayer(state);
  const steward = stewardById[player.stewardId];
  const index = state.players.findIndex((candidate) => candidate.id === player.id);
  const legal = useMemo(() => mapCells.map((cell) => cell.id).filter((hexId) => validateStewardPlacement(state, player.id, hexId).ok), [player.id, state]);
  const [selected, setSelected] = useState(legal.includes(player.stewardHexId) ? player.stewardHexId : legal[0] ?? "");
  useEffect(() => { setSelected(legal.includes(player.stewardHexId) ? player.stewardHexId : legal[0] ?? ""); }, [player.id]);
  const initial = (steward?.name ?? "S").slice(0, 1);
  useBoardChoices(`start_${player.id}`, legal.map((hexId) => ({ key: hexId, hexIds: [hexId], label: `Start ${steward?.name ?? "your Steward"} here`, selected: hexId === selected, badge: hexId === selected ? initial : undefined, onTap: () => setSelected(hexId) })));
  const next = state.players[index + 1];
  return <section className="table-setup-step" aria-label={`Choose where ${steward?.name ?? "your Steward"} starts`}>
    <p className="table-setup-lead">{state.players.length > 1 ? `Player ${index + 1} of ${state.players.length}. ` : ""}{steward?.name} starts on {steward?.startingTerrains.map((terrain) => terrainLabels[terrain]).join(" or ")}. Tap any highlighted space on the board.</p>
    <div className="table-setup-choice" aria-live="polite"><span>Starting space</span><strong>{selected ? placeName(selected) : "Choose a space"}</strong></div>
    <p className="table-setup-note">Your first tile goes on this space, and your settlement grows out from it, so a start beside different terrains keeps more tiles in reach.</p>
    <details className="table-setup-details"><summary>{steward?.name}’s power and objective</summary><p>{steward?.powerText}</p><p>{steward?.objectiveText}</p></details>
    <div className="table-setup-actions">
      <button type="button" className="primary-action" disabled={!selected} onClick={() => onConfirm(selected)}><Check size={18} aria-hidden="true" />Start at {selected || "…"}</button>
      <small>{next ? `${stewardById[next.stewardId]?.name ?? next.name} chooses next.` : state.goldenSetup.selectedTileId ? "Next: place your Golden Tile." : "Next: seed the Encounter Deck for Season I."}</small>
    </div>
  </section>;
}

/** Placing the optional Golden Tile, on the main board. */
export function TableGoldenStart({ state, onConfirm, onSkip }: { state: GameState; onConfirm: (hexId: string) => void; onSkip: () => void }) {
  const tileId = state.goldenSetup.selectedTileId;
  const tile = tileId ? goldenTileById[tileId] : undefined;
  const legal = useMemo(() => getGoldenTileSetupLegalHexIds(state), [state]);
  const [selected, setSelected] = useState(legal[0] ?? "");
  useBoardChoices("golden_start", legal.map((hexId) => ({ key: hexId, hexIds: [hexId], label: `Place ${tile?.name ?? "the Golden Tile"} here`, selected: hexId === selected, badge: hexId === selected ? "★" : undefined, onTap: () => setSelected(hexId) })));
  return <section className="table-setup-step" aria-label="Place the Golden Tile">
    <p className="table-setup-lead">One optional Golden Tile for the whole settlement. It costs no action and no resources. Tap a highlighted space on the board.</p>
    {tile?.scoringText && <p className="table-setup-note"><strong>Scores:</strong> {tile.scoringText}</p>}
    {tile?.layoutIncentive && <p className="table-setup-note"><strong>Plan for it:</strong> {tile.layoutIncentive}</p>}
    {tile?.placement?.text && <p className="table-setup-note"><strong>Where it can go:</strong> {tile.placement.text}</p>}
    <div className="table-setup-choice" aria-live="polite"><span>Golden Tile space</span><strong>{legal.length === 0 ? "No legal space this game" : selected ? placeName(selected) : "Choose a space"}</strong></div>
    <div className="table-setup-actions">
      <button type="button" className="primary-action" disabled={!selected} onClick={() => onConfirm(selected)}><Check size={18} aria-hidden="true" />Place {tile?.name ?? "Golden Tile"}{selected ? ` at ${selected}` : ""}</button>
      <button type="button" className="secondary-action" onClick={onSkip}><SkipForward size={18} aria-hidden="true" />Play without it</button>
      <small>Next: each Steward seeds the Encounter Deck for Season I.</small>
    </div>
  </section>;
}

import { useMemo, useState } from "react";
import { mapById, mapCells, terrainLabels } from "../../data/map";
import { getTemporaryReachHexIds, getPlacedTileAtHex } from "../../engine/reachability";
import { hasWardenReliefTarget, isPendingEffectAdjustmentValid, resolvePendingEffect } from "../../engine/manualEffects";
import { selectCurrentPlayer, selectTileName } from "../../engine/selectors";
import type { EffectAdjustment, GameState, PendingEffectState, PlacedTile } from "../../engine/types";
import { TileArtwork } from "../common/TileArtwork";
import { HexMap } from "../map/HexMap";
import { TileInspectModal } from "../map/TileInspectModal";
import { isBoardTableExperience } from "../../app/experience";
import { useBoardChoices } from "../table/boardChoices";

interface StewardChoiceProps {
  state: GameState;
  effect: PendingEffectState;
  onApply: (adjustment: EffectAdjustment) => void;
}

function reachLabel(state: GameState, hexId: string) {
  const tile = getPlacedTileAtHex(state, hexId);
  return `${hexId} · ${tile ? selectTileName(tile) : "Empty space"} · ${mapById[hexId] ? terrainLabels[mapById[hexId].terrain] : "Unknown coordinate"}`;
}

export function ActiveRangerReach({ state }: { state: GameState }) {
  const hex = selectCurrentPlayer(state).temporaryReachHexId;
  if (!hex) return null;
  return <section className="active-ranger-reach" aria-label="Ranger's temporary reach">
    <strong>Reach active · {reachLabel(state, hex)}</strong>
    <p>Until the end of your turn. Tile actions still use their normal costs and placement rules.</p>
  </section>;
}

export function RangerReachChoice({ state, effect, onApply }: StewardChoiceProps) {
  const playerId = effect.allowTemporaryReachPlayerId!;
  const player = state.players.find((candidate) => candidate.id === playerId);
  const [selectedHex, setSelectedHex] = useState(effect.suggestedAdjustment?.temporaryReachHexUpdates?.[playerId] ?? "");
  const [inspected, setInspected] = useState<string | null>(null);
  const legalHexIds = useMemo(() => getTemporaryReachHexIds(state), [state.map]);
  const legalSet = new Set(legalHexIds);
  const selectedTile = getPlacedTileAtHex(state, selectedHex);
  const adjustment: EffectAdjustment = selectedHex ? { temporaryReachHexUpdates: { [playerId]: selectedHex } } : {};
  const valid = isPendingEffectAdjustmentValid(state, effect, adjustment);
  const onBoard = isBoardTableExperience();
  useBoardChoices(`reach_${effect.id}`, legalHexIds.map((hexId) => ({ key: hexId, hexIds: [hexId], label: "Reach this space", badge: selectedHex === hexId ? "◆" : undefined, selected: selectedHex === hexId, onTap: () => setSelectedHex(selectedHex === hexId ? "" : hexId) })));
  return <section className="steward-choice ranger-reach-choice" aria-label="Choose Ranger reach">
    <header><p className="eyebrow">Ranger · temporary reach</p><h2>Reach a new part of the Vale.</h2><p>Choose an empty hex or a tile below 3 Strain, anywhere on the board. Your Steward stays at {player?.stewardHexId}.</p></header>
    <div className="steward-reach-layout">
      <div className="steward-reach-controls">
        <label>Reach target<select value={selectedHex} onChange={(event) => setSelectedHex(event.target.value)}>
          <option value="">Choose a hex…</option>
          <optgroup label="Placed tiles">{mapCells.filter((cell) => getPlacedTileAtHex(state, cell.id)).map((cell) => <option key={cell.id} value={cell.id} disabled={!legalSet.has(cell.id)}>{reachLabel(state, cell.id)}{!legalSet.has(cell.id) ? " · Overstrained" : ""}</option>)}</optgroup>
          <optgroup label="Empty spaces">{mapCells.filter((cell) => !getPlacedTileAtHex(state, cell.id)).map((cell) => <option key={cell.id} value={cell.id}>{reachLabel(state, cell.id)}</option>)}</optgroup>
        </select></label>
        <div className="steward-choice-preview" aria-live="polite" aria-atomic="true">
          <strong>{selectedHex ? reachLabel(state, selectedHex) : "Choose on the map or by coordinate."}</strong>
          <p>{selectedHex && !valid ? "This tile is Overstrained. Choose an empty hex or a tile below 3 Strain." : selectedHex ? "This becomes an extra point of reach until the end of your turn." : "Light markers show eligible spaces. Selecting a target does not apply it."}</p>
        </div>
        {selectedTile && <button type="button" onClick={() => setInspected(selectedTile.instanceId)}>Inspect {selectTileName(selectedTile)}</button>}
        <p className="steward-choice-note">Normal action costs, resources, terrain, water and printed tile rules still apply. The once-per-Season power was spent when you opened this choice. Undo returns to that step.</p>
      </div>
      {!onBoard && <div className="signet-map steward-reach-map"><HexMap state={state} selectedTileId="c15_path" actionMode="reach" selectedHexIds={selectedHex ? [selectedHex] : []} placementOrientation={3} onHexSelect={setSelectedHex} legalHexIds={legalHexIds} mapHint="Choose a hex for temporary reach. Browse with arrow keys. Enter selects. Zoom for larger touch targets." onTileInspect={setInspected} /></div>}
    </div>
    <footer className="steward-choice-actions"><span>{legalHexIds.length === 0 ? "No eligible reach target remains." : valid ? `Ready · reach ${selectedHex} until your turn ends` : "Select one eligible target to continue."}</span><button className="primary-action" disabled={!valid} onClick={() => onApply(adjustment)} type="button">{legalHexIds.length === 0 ? "Continue" : selectedHex && valid ? `Set reach at ${selectedHex}` : "Set reach"}</button></footer>
    {inspected && <TileInspectModal state={state} placedTileId={inspected} onClose={() => setInspected(null)} />}
  </section>;
}

const supported = (tile: PlacedTile) => tile.support.passive || tile.support.singleUse;

export function WardenReliefChoice({ state, effect, onApply }: StewardChoiceProps) {
  const [choice, setChoice] = useState<{ tileId: string; kind: "strain" | "support" } | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const adjustment: EffectAdjustment = !choice ? {} : choice.kind === "strain" ? { tileStrainDeltas: { [choice.tileId]: -1 } } : { supportTileIds: [choice.tileId] };
  const valid = isPendingEffectAdjustmentValid(state, effect, adjustment);
  const preview = useMemo(() => valid ? resolvePendingEffect(state, adjustment) : state, [state, choice, valid]);
  const noTargets = !hasWardenReliefTarget(state);
  const changes = preview.map.placedTiles.flatMap((after) => {
    const before = state.map.placedTiles.find((tile) => tile.instanceId === after.instanceId)!;
    const updates = [];
    if (before.strain !== after.strain) updates.push(`Strain ${before.strain} → ${after.strain}`);
    if (supported(before) !== supported(after)) updates.push(supported(after) ? "gains Supported" : "loses Supported");
    return updates.length ? [`${selectTileName(after)} (${after.hexIds.join(", ")}): ${updates.join(" · ")}`] : [];
  });
  function select(tileId: string, kind: "strain" | "support") { setChoice((current) => current?.tileId === tileId && current.kind === kind ? null : { tileId, kind }); }
  useBoardChoices(`relief_${effect.id}`, noTargets ? [] : state.map.placedTiles.filter((tile) => tile.strain > 0 || !supported(tile)).map((tile) => {
    const chosen = choice?.tileId === tile.instanceId ? choice.kind : null;
    const next = chosen === null ? (tile.strain > 0 ? "strain" : "support") : chosen === "strain" && !supported(tile) ? "support" : null;
    return {
      key: tile.instanceId,
      hexIds: tile.hexIds,
      label: chosen === "strain" ? "Remove 1 Strain" : chosen === "support" ? "Give Supported" : tile.strain > 0 ? "Remove 1 Strain or give Supported" : "Give Supported",
      badge: chosen === "strain" ? "−1" : chosen === "support" ? "✚" : undefined,
      selected: chosen !== null,
      onTap: () => setChoice(next ? { tileId: tile.instanceId, kind: next } : null)
    };
  }));
  return <section className="steward-choice warden-relief-choice" aria-label="Warden relief choice">
    <header><p className="eyebrow">Warden · reveal prevented</p><h2>Give one tile some relief.</h2><p>The Burden remains active. Choose either 1 Strain removed or Supported on one tile. The Warden’s power is now used for Season {state.season}.</p></header>
    {noTargets ? <p className="steward-choice-preview">Every placed tile is unstrained and already Supported, or no tiles are placed. There is no relief to apply.</p> : <div className="warden-tile-choices">{state.map.placedTiles.map((tile) => {
      const name = selectTileName(tile);
      const location = `${name} at ${tile.hexIds.join(", ")}`;
      return <article className={choice?.tileId === tile.instanceId ? "is-selected" : ""} key={tile.instanceId}>
        <div className="warden-tile-heading"><TileArtwork tileId={tile.tileId} side={tile.side === "upgraded" ? "upgraded" : "basic"} name={name} thumbnail /><div><h3>{name}</h3><p>{tile.hexIds.join(", ")} · {tile.strain} Strain · {supported(tile) ? "Supported" : "Unsupported"}</p></div></div>
        <div className="warden-tile-actions"><button type="button" aria-label={`Remove 1 Strain from ${location}`} aria-pressed={choice?.tileId === tile.instanceId && choice.kind === "strain"} disabled={tile.strain <= 0} onClick={() => select(tile.instanceId, "strain")}>Remove 1 Strain{tile.strain <= 0 && <small>No Strain to remove</small>}</button><button type="button" aria-label={`Give Supported to ${location}`} aria-pressed={choice?.tileId === tile.instanceId && choice.kind === "support"} disabled={supported(tile)} onClick={() => select(tile.instanceId, "support")}>Give Supported{supported(tile) && <small>Already Supported</small>}</button></div>
        <button className="steward-inspect" type="button" aria-label={`Inspect ${location}`} onClick={() => setInspected(tile.instanceId)}>Inspect tile</button>
      </article>;
    })}</div>}
    <div className="steward-choice-preview" aria-live="polite" aria-atomic="true"><strong>{noTargets ? "Ready to continue" : changes.length ? "After applying" : "Choose one relief option."}</strong>{changes.map((change) => <p key={change}>{change}</p>)}{choice && !valid && <p>This option is no longer eligible. Choose another tile or relief option.</p>}</div>
    <footer className="steward-choice-actions"><span>{noTargets ? "The reveal effect stays prevented." : "You can change your choice before applying. No action or resources spent."}</span><button className="primary-action" type="button" disabled={!valid} onClick={() => onApply(adjustment)}>{noTargets ? "Continue" : "Apply Warden relief"}</button></footer>
    {inspected && <TileInspectModal state={state} placedTileId={inspected} onClose={() => setInspected(null)} />}
  </section>;
}

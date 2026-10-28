import { useMemo } from "react";
import { coreTileById } from "../../data/tiles";
import { canStartUpgradeTile, getLinkedProductionTileIds, hasUsedLinkedProductionThisRound } from "../../engine/gameActions";
import { getPlacedTileEffectText } from "../../engine/placedTiles";
import { selectTileName } from "../../engine/selectors";
import type { GameState } from "../../engine/types";
import { TileArtwork } from "../common/TileArtwork";
import { previewTileAction } from "./actionForecast";
import { ActionConsequences } from "./ActionConsequences";

function TileActionRow({ state, id, mode, selectedHexIds, onAction, onInspect }: { state: GameState; id: string; mode: "activate" | "upgrade"; selectedHexIds: string[]; onAction: (id: string) => void; onInspect: (id: string) => void }) {
  const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === id)!;
  const forecast = useMemo(() => previewTileAction(state, state.currentPlayerId, { type: mode, placedTileId: id }), [state, mode, id]);
  const blockers = mode === "upgrade" ? canStartUpgradeTile(state, state.currentPlayerId, id).reasons : [];
  const linked = mode === "activate" ? getLinkedProductionTileIds(state, id).map((linkedId) => state.map.placedTiles.find((candidate) => candidate.instanceId === linkedId)!).map(selectTileName) : [];
  const name = selectTileName(tile);
  const verb = mode === "activate" ? "Activate" : "Upgrade";
  const effect = mode === "upgrade" ? coreTileById[tile.tileId]?.upgraded.effectText ?? "" : getPlacedTileEffectText(tile);
  const mainEffect = effect.split(" Passive: Linked Production")[0];
  const selected = tile.hexIds.some((hex) => selectedHexIds.includes(hex));
  return <article className={`tile-action-card${selected ? " selected" : ""}`}>
    <div className="tile-action-heading"><TileArtwork tileId={tile.tileId} side={tile.side === "upgraded" ? "upgraded" : "basic"} name={name} thumbnail /><div><h4>{name}</h4><span>{tile.hexIds.join(" + ")} · Strain {tile.strain}{selected ? " · Selected on board" : ""}</span></div></div>
    {mode === "upgrade" && <p className="tile-action-effect">Becomes {coreTileById[tile.tileId]?.upgraded.name}.</p>}
    <p className="tile-action-effect">{mainEffect}</p>
    {linked.length > 0 && <p className="tile-action-linked">Also activates {linked.join(", ")}.</p>}
    {mode === "activate" && hasUsedLinkedProductionThisRound(state, id) && <p className="tile-action-linked">Linked group already produced this round. Chosen tile only.</p>}
    {blockers.length > 0 ? <ul className="upgrade-blockers">{blockers.map((reason) => <li key={reason}>{reason.replace(/^Cannot upgrade:\s*/i, "")}</li>)}</ul> : <ActionConsequences forecast={forecast} />}
    <div className="tile-action-buttons"><button type="button" onClick={() => onInspect(id)}>Inspect {name}</button><button type="button" className="primary-action" disabled={!forecast.available} onClick={() => onAction(id)} aria-label={`${verb} ${name}`}>{forecast.paymentChoice ? "Choose payment" : `${verb} ${name}`}</button></div>
  </article>;
}

export function TileActionList({ state, ids, mode, selectedHexIds, onAction, onInspect }: { state: GameState; ids: string[]; mode: "activate" | "upgrade"; selectedHexIds: string[]; onAction: (id: string) => void; onInspect: (id: string) => void }) {
  return <div className="tile-action-list">{ids.map((id) => <TileActionRow key={id} state={state} id={id} mode={mode} selectedHexIds={selectedHexIds} onAction={onAction} onInspect={onInspect} />)}</div>;
}

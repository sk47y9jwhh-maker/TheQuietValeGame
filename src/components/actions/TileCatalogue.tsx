import { getActionPreparationIds } from "./preparedActions";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getTilePlacementHexIds } from "../../engine/placementRules";
import { Search, X } from "lucide-react";
import { TileArtwork } from "../common/TileArtwork";
import { formatCategory } from "../common/gameText";
import { ActionConsequences } from "./ActionConsequences";
import { previewTileAction } from "./actionForecast";
import type { PlaceTileChoice } from "./placeTileChoices";
import type { GameState, TilePlacementDraft } from "../../engine/types";

interface Props {
  state: GameState;
  choices: PlaceTileChoice[];
  selectedTileId: string;
  draft: TilePlacementDraft | null;
  selectedHexIds: string[];
  onSelect: (id: string) => void;
  onInspect: (id: string) => void;
  onPlace: (draft: TilePlacementDraft, id: string) => void;
}

export function TileCatalogue({ state, choices, selectedTileId, draft, selectedHexIds, onSelect, onInspect, onPlace }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [inSupplyOnly, setInSupplyOnly] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLElement>(null);
  const reviewRequested = useRef(false);
  const preparationKey = getActionPreparationIds(state, "place").join("|");
  useEffect(() => {
    if (!preparationKey) return;
    // The parent first opens the action pane. Focus after that render so the
    // removed Prepare button cannot strand keyboard users in a hidden panel.
    const frame = requestAnimationFrame(() => {
      const target = selectionRef.current;
      if (!target || target.closest("[hidden]")) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [preparationKey]);
  useEffect(() => {
    if (!reviewRequested.current) return;
    reviewRequested.current = false;
    selectionRef.current?.focus({ preventScroll: true });
    selectionRef.current?.scrollIntoView?.({ block: "nearest" });
  });
  function chooseAndReview(id: string) {
    reviewRequested.current = true;
    onSelect(id);
  }
  const selected = choices.find((tile) => tile.id === selectedTileId);
  const categories = [...new Set(choices.map((tile) => tile.category))].sort();
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = choices.filter((tile) => (category === "all" || tile.category === category) && (!inSupplyOnly || tile.hasEnoughSupply) && words.every((word) => `${tile.name} ${tile.meta} ${tile.effectText} ${tile.placement}`.toLocaleLowerCase().includes(word)));
  const hasFilter = Boolean(query || category !== "all" || inSupplyOnly);
  const selectedIsVisible = filtered.some((tile) => tile.id === selectedTileId);
  const forecast = useMemo(() => draft ? previewTileAction(state, state.currentPlayerId, { type: "place", tileId: selectedTileId, draft }) : null, [state, selectedTileId, draft]);
  function clearFilters() { setQuery(""); setCategory("all"); setInSupplyOnly(false); }
  function moveSelection(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % filtered.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + filtered.length) % filtered.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = filtered.length - 1;
    else return;
    event.preventDefault();
    onSelect(filtered[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next]?.focus();
  }
  return <div className="tile-catalogue">
    <button type="button" className="catalogue-browse" onClick={() => searchRef.current?.focus()}><Search size={16} aria-hidden="true" />Search or filter tiles</button>
    {selected && <section className="selected-tile" aria-label="Selected tile" ref={selectionRef} tabIndex={-1}>
      <div className="selected-tile-heading"><TileArtwork tileId={selected.id} name={selected.name} thumbnail /><div><p>Selected tile</p><h4>{selected.name}</h4><span>{selected.meta} · {selected.copiesAvailable} in supply</span></div></div>
      {!forecast && <p className="selected-tile-price"><strong>{selected.actionCost === 0 ? "No action spent" : `${selected.actionCost} action`}</strong> · Resources {selected.costLabel}<small>Before any location or payment choices.</small></p>}
      <details className="selected-tile-rules"><summary>Effect & placement rules</summary><p>{selected.effectText}</p><p>{selected.placement}</p></details>
      <p className="selected-tile-location">{draft?.anchorHexId ? `Destination: ${getTilePlacementHexIds(selected.id, draft).join(" + ")}` : selectedHexIds.length ? `Selected: ${selectedHexIds.join(" + ")}. Choose a valid footprint on the board.` : "Choose a highlighted space on the board."}</p>
      {forecast && <ActionConsequences forecast={forecast} />}
      {!draft && selected.blockedReasons.length > 0 && <p className="selected-tile-blocker">{selected.blockedReasons.join(". ")}. Check placement and any available payment effects.</p>}
      <div className="selected-tile-actions"><button type="button" onClick={() => onInspect(selected.id)}>Inspect {selected.name}</button><button className="primary-action" type="button" disabled={!draft || !forecast?.available} onClick={() => { if (draft) onPlace(draft, selected.id); }} aria-label={`Place ${selected.name}`}>{forecast?.paymentChoice ? "Choose payment" : "Place tile"}</button></div>
      {!selectedIsVisible && <p className="selected-outside-filter">Your selected tile is outside these filters.</p>}
    </section>}
    <div className="tile-catalogue-filters">
      <label className="tile-search"><span>Find a tile</span><span><Search size={17} aria-hidden="true" /><input ref={searchRef} type="search" value={query} placeholder="Name, effect or terrain" onChange={(event) => setQuery(event.target.value)} /></span></label>
      <label className="tile-category">Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((value) => <option value={value} key={value}>{formatCategory(value)}</option>)}</select></label>
      <label className="tile-supply-filter"><input type="checkbox" checked={inSupplyOnly} onChange={(event) => setInSupplyOnly(event.target.checked)} />Only tiles in supply</label>
      <div className="tile-catalogue-count"><span role="status">{filtered.length} of {choices.length} tiles</span>{hasFilter && <button type="button" onClick={clearFilters}><X size={14} aria-hidden="true" />Clear filters</button>}</div>
    </div>
    {filtered.length === 0 ? <p className="tile-catalogue-empty">No tiles match. Try another name, effect or category.</p> : <div role="listbox" aria-label="Choose a tile" className="tile-catalogue-list" ref={listRef}>{filtered.map((tile, index) => <button key={tile.id} type="button" role="option" aria-selected={selectedTileId === tile.id} tabIndex={selectedTileId === tile.id || (!selectedIsVisible && index === 0) ? 0 : -1} onClick={() => chooseAndReview(tile.id)} onKeyDown={(event) => moveSelection(event, index)} className={`catalogue-tile${selectedTileId === tile.id ? " selected" : ""}`}>
      <TileArtwork tileId={tile.id} name={tile.name} thumbnail /><span><strong>{tile.name}</strong><small>{tile.meta}</small><small>Resources {tile.costLabel}</small></span><span className="catalogue-tile-supply">{tile.copiesAvailable} in supply{tile.copiesRequired > 1 ? ` · Uses ${tile.copiesRequired}` : ""}</span>
    </button>)}</div>}
  </div>;
}

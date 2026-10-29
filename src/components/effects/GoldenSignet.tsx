import { useEffect, useMemo, useRef, useState } from "react";
import { encounterById } from "../../data/encounters";
import { mapById, terrainLabels } from "../../data/map";
import { stewardById } from "../../data/stewards";
import { resolveGoldenSignet, validateGoldenSignetPlacements, type GoldenSignetPlacement } from "../../engine/golden";
import { hexDirectionLabels } from "../../engine/hex";
import { getTileFootprintKind, getTileFootprintSize, getTilePlacementHexIds } from "../../engine/placementRules";
import { selectTileName } from "../../engine/selectors";
import type { GameState, HexDirection, PlacedTile, TilePlacementDraft } from "../../engine/types";
import { EncounterCard } from "../common/EncounterCard";
import { TileArtwork } from "../common/TileArtwork";
import { HexMap } from "../map/HexMap";
import { TileInspectModal } from "../map/TileInspectModal";
import { isBoardTableExperience } from "../../app/experience";
import { useBoardChoices, useBoardPreview, type BoardChoice } from "../table/boardChoices";
import { originalSignetDraft, setSignetSpace, signetLegalSpaces, signetPlanningState, type SignetDrafts } from "./signetPlanning";

const supported = (tile: PlacedTile) => tile.support.passive || tile.support.singleUse ? "Supported" : "Unsupported";

export function GoldenSignet({ state, onResolve }: { state: GameState; onResolve: (placements: GoldenSignetPlacement[]) => void }) {
  const [step, setStep] = useState<"choose" | "arrange" | "review">("choose");
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<SignetDrafts>({});
  const [index, setIndex] = useState(0);
  const [slot, setSlot] = useState(0);
  const [inspected, setInspected] = useState<string | null>(null);
  const [reviewHex, setReviewHex] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousFocusStep = useRef({ step, index });
  const tiles = selected.map((id) => state.map.placedTiles.find((tile) => tile.instanceId === id)!).filter(Boolean);
  const tile = tiles[index];
  const draft: TilePlacementDraft = tile ? drafts[tile.instanceId] ?? {} : {};
  const footprint = tile ? getTileFootprintKind(tile.tileId) : "single";
  const size = tile ? getTileFootprintSize(tile.tileId) : 1;
  const placements = useMemo(() => selected.map((placedTileId) => ({ placedTileId, placement: drafts[placedTileId] ?? {} })), [selected, drafts]);
  const validation = useMemo(() => validateGoldenSignetPlacements(state, placements), [state, placements]);
  const planning = useMemo(() => signetPlanningState(state, selected, drafts, selected[index]), [state, selected, drafts, index]);
  const legalBySlot = useMemo(() => tile ? Array.from({ length: footprint === "detached" ? size : 1 }, (_, choice) => signetLegalSpaces(planning, tile, draft, choice)) : [], [planning, tile, draft, footprint, size]);
  const currentValid = tile && validateGoldenSignetPlacements(planning, [{ placedTileId: tile.instanceId, placement: draft }]).ok;
  const preview = useMemo(() => validation.ok ? resolveGoldenSignet(state, placements) : state, [state, placements, validation.ok]);
  const pending = state.pendingGoldenEffect;
  const card = pending ? encounterById[pending.cardId] : undefined;
  useEffect(() => {
    // Leave the initial announcement to the parent. Every later step, including
    // returning to tile selection, needs a focus target when its old control leaves.
    const previous = previousFocusStep.current;
    if (previous.step === step && previous.index === index) return;
    previousFocusStep.current = { step, index };
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView?.({ block: "nearest" });
  }, [step, index]);
  // On the board-first table, the plan is made on the main board: it shows the
  // planned settlement, marks legal destinations and takes taps.
  const onBoard = isBoardTableExperience();
  const planningWithoutTile = useMemo(() => tile ? { ...planning, map: { placedTiles: planning.map.placedTiles.filter((placed) => placed.instanceId !== tile.instanceId) } } : planning, [planning, tile]);
  useBoardPreview(onBoard && pending?.kind === "signet" ? step === "arrange" ? planningWithoutTile : step === "review" ? preview : null : null);
  const boardChoices: BoardChoice[] = !onBoard || pending?.kind !== "signet" ? []
    : step === "choose" ? state.map.placedTiles.map((placed) => {
      const order = selected.indexOf(placed.instanceId);
      return { key: placed.instanceId, hexIds: placed.hexIds, label: order >= 0 ? `Selected to move (${order + 1})` : "Select to move", selected: order >= 0, badge: order >= 0 ? String(order + 1) : undefined, onTap: () => toggle(placed.instanceId) };
    })
    : step === "arrange" && tile ? [
      ...(legalBySlot[slot] ?? []).map((hexId) => ({ key: `to_${hexId}`, hexIds: [hexId], label: `Move ${selectTileName(tile)} here`, selected: false, onTap: () => selectHex(hexId) })),
      ...(currentValid ? [{ key: "planned", hexIds: getTilePlacementHexIds(tile.tileId, draft), label: `${selectTileName(tile)} goes here`, selected: true, badge: String(index + 1), onTap: () => update({}) }] : [])
    ]
    : step === "review" ? tiles.map((before, itemIndex) => {
      const after = preview.map.placedTiles.find((item) => item.instanceId === before.instanceId);
      return { key: `moved_${before.instanceId}`, hexIds: after?.hexIds ?? [], label: `${selectTileName(before)} moved here`, selected: true, fixed: true, badge: String(itemIndex + 1), onTap: () => {} };
    }) : [];
  useBoardChoices(`signet_${pending?.cardId ?? "none"}`, boardChoices);
  if (pending?.kind !== "signet") return null;

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 5 ? [...current, id] : current);
  }
  function edit(next: number) { setIndex(next); setSlot(0); setStep("arrange"); }
  function update(next: TilePlacementDraft) { if (tile) setDrafts((current) => ({ ...current, [tile.instanceId]: next })); }
  function selectHex(id: string) {
    if (!legalBySlot[slot]?.includes(id)) return;
    update(setSignetSpace(draft, slot, id));
    if (footprint === "detached" && slot < size - 1) setSlot(slot + 1);
  }
  const changes = preview.map.placedTiles.filter((after) => {
    const before = state.map.placedTiles.find((original) => original.instanceId === after.instanceId)!;
    return before.hexIds.join(",") !== after.hexIds.join(",") || supported(before) !== supported(after);
  });
  const movedPlayers = preview.players.filter((player) => player.stewardHexId !== state.players.find((before) => before.id === player.id)?.stewardHexId);

  return <section className="golden-decision golden-signet-experience" aria-label="Golden Signet settlement plan">
    <header><p className="eyebrow">The Golden Signet Ring · {step === "choose" ? "1. Choose tiles" : step === "arrange" ? "2. Plan destinations" : "3. Review together"}</p><h2 ref={heading} tabIndex={-1}>{step === "choose" ? "Reshape your settlement." : step === "arrange" ? `Move ${tile ? selectTileName(tile) : "a tile"}` : "Review the new settlement."}</h2><p>{step === "choose" ? "Move up to five tiles together. No actions or resources are spent. Terrain restrictions still apply. Distance and connections do not limit this move." : step === "arrange" ? `Tile ${index + 1} of ${tiles.length}. Nothing moves until the whole plan is confirmed.` : "Check every move and its effects before applying the plan."}</p></header>
    {step === "choose" && <>
      <details className="golden-card-rules"><summary>Read the Golden Signet Ring</summary>{card && <EncounterCard card={card} currentSeason={state.season} />}</details>
      <p className="signet-count" role="status">{selected.length} of 5 selected · Choose the tiles you want to lift.</p>
      {state.map.placedTiles.length ? <div className="signet-tile-choices">{state.map.placedTiles.map((placed) => <label key={placed.instanceId} className={selected.includes(placed.instanceId) ? "is-selected" : ""}>
        <input type="checkbox" checked={selected.includes(placed.instanceId)} disabled={!selected.includes(placed.instanceId) && selected.length === 5} onChange={() => toggle(placed.instanceId)} aria-label={`Move ${selectTileName(placed)} at ${placed.hexIds.join(", ")}`} />
        <TileArtwork tileId={placed.tileId} side={placed.side === "upgraded" ? "upgraded" : "basic"} name={selectTileName(placed)} thumbnail />
        <span><strong>{selectTileName(placed)}</strong><span>{placed.hexIds.join(", ")} · {placed.strain} Strain · {supported(placed)}</span></span>
      </label>)}</div> : <p className="signet-empty">There are no placed tiles to move. Continue to the remaining Encounter effects.</p>}
      <div className="signet-actions"><button className="primary-action" type="button" disabled={!selected.length} onClick={() => edit(0)}>Plan {selected.length || "selected"} {selected.length === 1 ? "tile" : "tiles"}</button><button type="button" onClick={() => onResolve([])}>Keep the settlement as it is</button></div>
    </>}
    {step === "arrange" && tile && <>
      <nav className="signet-plan-tabs" aria-label="Selected tiles">{tiles.map((item, itemIndex) => <button type="button" key={item.instanceId} aria-current={itemIndex === index ? "step" : undefined} onClick={() => edit(itemIndex)}>{itemIndex + 1}. {selectTileName(item)}<small>From {item.hexIds.join(", ")}</small></button>)}</nav>
      <div className="signet-arrangement"><div className="signet-controls">
      <p className="signet-plan-note">All selected tiles are lifted together. You can use a space another selected tile leaves behind. Other planned destinations reserve their spaces.</p>
      <div className="signet-destination-controls">
        {footprint === "line" && <label>Orientation<select value={draft.orientation ?? 0} onChange={(event) => update({ ...draft, orientation: Number(event.target.value) as HexDirection })}>{[0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{{ NW: "North-west", SW: "South-west", N: "North", S: "South", NE: "North-east", SE: "South-east" }[hexDirectionLabels[value as HexDirection]]}</option>)}</select></label>}
        {legalBySlot.map((ids, choice) => {
          const current = choice === 0 ? draft.anchorHexId ?? "" : draft.secondaryHexIds?.[choice - 1] ?? "";
          return <label key={choice}>{footprint === "detached" ? `Space ${choice + 1} of ${size}` : "Destination"}<select value={current} onFocus={() => setSlot(choice)} onChange={(event) => update(setSignetSpace(draft, choice, event.target.value))}>
            <option value="">Choose a legal space</option>{current && !ids.includes(current) && <option value={current}>{current} · Unavailable in this plan</option>}{ids.map((id) => <option key={id} value={id}>{id} · {terrainLabels[mapById[id].terrain]}</option>)}
          </select></label>;
        })}
      </div>
      {footprint === "detached" && <div className="signet-map-target" role="group" aria-label="Space chosen by the map">{Array.from({ length: size }, (_, choice) => <button type="button" key={choice} aria-pressed={slot === choice} onClick={() => setSlot(choice)}>Choose space {choice + 1} on map</button>)}</div>}
      <div className="signet-position-status" role="status"><strong>{currentValid ? `Planned: ${getTilePlacementHexIds(tile.tileId, draft).join(", ")}` : draft.anchorHexId ? "Complete a legal footprint before continuing." : "Choose a destination from the marked spaces or list."}</strong><span>{legalBySlot[slot]?.length ?? 0} legal {footprint === "line" ? "anchors in this orientation" : "spaces"}. {tile.strain} Strain and tile upgrades are retained. Support is recalculated on review.</span></div>
      </div>{!onBoard && <div className="signet-map"><HexMap state={{ ...planning, map: { placedTiles: planning.map.placedTiles.filter((placed) => placed.instanceId !== tile.instanceId) } }} selectedTileId={tile.tileId} actionMode="signet" selectedHexIds={[draft.anchorHexId, ...(draft.secondaryHexIds ?? [])].filter((id): id is string => Boolean(id))} placementOrientation={draft.orientation ?? 0} legalHexIds={legalBySlot[slot]} mapHint="Preview only · Marked spaces are legal destinations. Arrows browse. Enter selects. Confirm the whole plan on review." onHexSelect={selectHex} onTileInspect={setInspected} /></div>}</div>
      <div className="signet-actions"><button type="button" onClick={() => update(originalSignetDraft(tile))}>Use original position</button><button type="button" onClick={() => update({})}>Clear this destination</button><button type="button" onClick={() => { setStep("choose"); setIndex(0); }}>Change selected tiles</button></div>
      <div className="signet-actions">{index < tiles.length - 1 && <button className="primary-action" type="button" disabled={!currentValid} onClick={() => edit(index + 1)}>Next tile</button>}<button className="primary-action" type="button" disabled={!validation.ok} onClick={() => setStep("review")}>Review settlement plan</button></div>
      {!validation.ok && <p className="signet-plan-note">Every selected tile needs a complete destination, with no overlapping tiles. Choose a tile above to edit its position.</p>}
    </>}
    {step === "review" && <>
      <p className="signet-review-summary">{selected.length} {selected.length === 1 ? "tile" : "tiles"} planned · 0 actions · No resource change. Nothing moves until you apply this plan.</p>
      <ul className="signet-review-list">{tiles.map((before, itemIndex) => { const after = preview.map.placedTiles.find((item) => item.instanceId === before.instanceId)!; return <li key={before.instanceId}><div><strong>{selectTileName(before)}</strong><span>{before.hexIds.join(", ")} → {after.hexIds.join(", ")}</span><small>{before.strain} Strain retained · {supported(before)} → {supported(after)}</small></div><button type="button" onClick={() => edit(itemIndex)}>Edit {selectTileName(before)} at {before.hexIds.join(", ")}</button></li>; })}</ul>
      {movedPlayers.length > 0 && <div className="signet-consequences"><h3>Stewards move with their tiles</h3><ul>{movedPlayers.map((player) => <li key={player.id}>{stewardById[player.stewardId]?.name ?? player.name}: {state.players.find((before) => before.id === player.id)?.stewardHexId} → {player.stewardHexId}</li>)}</ul></div>}
      {changes.some((tile) => !selected.includes(tile.instanceId)) && <div className="signet-consequences"><h3>Other support changes</h3><ul>{changes.filter((tile) => !selected.includes(tile.instanceId)).map((after) => <li key={after.instanceId}>{selectTileName(after)} at {after.hexIds.join(", ")}: {supported(after)}</li>)}</ul></div>}
      {!onBoard && <div className="signet-map"><HexMap state={preview} selectedTileId="" actionMode="inspect" selectedHexIds={reviewHex} placementOrientation={0} mapHint="Proposed settlement · Inspect any placed tile with I or Navigate. Apply below to confirm." onHexSelect={(id) => setReviewHex([id])} onTileInspect={setInspected} /></div>}
      <div className="signet-actions"><button className="primary-action" type="button" disabled={!validation.ok} onClick={() => onResolve(placements)}>Apply settlement plan</button><button type="button" onClick={() => edit(0)}>Back to destinations</button></div>
      <p className="signet-plan-note">Then continue the remaining Encounter effects. You can Undo the confirmed move.</p>
    </>}
    <p className="golden-scroll-save-note">Unconfirmed destinations stay in this tab. Reloading restarts the plan and leaves your saved settlement in place.</p>
    {inspected && <TileInspectModal state={step === "review" ? preview : planning} placedTileId={inspected} onClose={() => setInspected(null)} />}
  </section>;
}

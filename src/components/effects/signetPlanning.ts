import { mapCells } from "../../data/map";
import { validateGoldenSignetPlacements } from "../../engine/golden";
import { getTileFootprintKind, getTileFootprintSize, getTilePlacementHexIds } from "../../engine/placementRules";
import type { GameState, HexDirection, PlacedTile, TilePlacementDraft } from "../../engine/types";

export type SignetDrafts = Record<string, TilePlacementDraft>;

export function originalSignetDraft(tile: PlacedTile): TilePlacementDraft {
  if (getTileFootprintKind(tile.tileId) === "detached") return { anchorHexId: tile.hexIds[0], secondaryHexIds: tile.hexIds.slice(1) };
  const orientation = ([0, 1, 2, 3, 4, 5] as HexDirection[]).find((direction) =>
    getTilePlacementHexIds(tile.tileId, { anchorHexId: tile.hexIds[0], orientation: direction }).join(",") === tile.hexIds.join(","));
  return { anchorHexId: tile.hexIds[0], orientation: orientation ?? 0 };
}

/** Selected tiles are lifted together. Only complete destinations reserve space;
 * the active tile is validated by the unchanged Signet engine against that plan. */
export function signetPlanningState(state: GameState, selected: string[], drafts: SignetDrafts, activeId: string): GameState {
  return { ...state, map: { placedTiles: state.map.placedTiles.flatMap((tile) => {
    if (!selected.includes(tile.instanceId) || tile.instanceId === activeId) return [tile];
    const hexIds = getTilePlacementHexIds(tile.tileId, drafts[tile.instanceId] ?? {});
    return hexIds.length === getTileFootprintSize(tile.tileId) && hexIds.every(Boolean) ? [{ ...tile, hexIds }] : [];
  }) } };
}

export function setSignetSpace(draft: TilePlacementDraft, slot: number, hexId: string): TilePlacementDraft {
  if (slot === 0) return { ...draft, anchorHexId: hexId || undefined };
  const secondaryHexIds = [...(draft.secondaryHexIds ?? [])];
  secondaryHexIds[slot - 1] = hexId;
  return { ...draft, secondaryHexIds };
}

export function signetLegalSpaces(state: GameState, tile: PlacedTile, draft: TilePlacementDraft, slot: number): string[] {
  const detached = getTileFootprintKind(tile.tileId) === "detached";
  const size = getTileFootprintSize(tile.tileId);
  // An unfinished detached footprint is offered only if it can be completed.
  // Every complete candidate goes through the real engine, including terrain,
  // footprint size, duplicate coordinates and occupied destinations.
  function canComplete(candidate: TilePlacementDraft): boolean {
    if (detached) {
      const spaces = [candidate.anchorHexId, ...(candidate.secondaryHexIds ?? [])];
      const missing = Array.from({ length: size }, (_, index) => index).find((index) => !spaces[index]);
      if (missing !== undefined) return mapCells.some((cell) => !spaces.includes(cell.id) && canComplete(setSignetSpace(candidate, missing, cell.id)));
    }
    return validateGoldenSignetPlacements(state, [{ placedTileId: tile.instanceId, placement: candidate }]).ok;
  }
  return mapCells.filter((cell) => canComplete(setSignetSpace(draft, slot, cell.id))).map((cell) => cell.id);
}

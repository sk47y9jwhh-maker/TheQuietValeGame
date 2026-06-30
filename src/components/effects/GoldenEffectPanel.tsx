import { Crown, Move, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { encounterById } from "../../data/encounters";
import { mapCells, terrainLabels } from "../../data/map";
import {
  type GoldenSignetPlacement,
  validateGoldenSignetPlacements
} from "../../engine/golden";
import { getTileFootprintKind, getTileFootprintSize } from "../../engine/placementRules";
import { selectTileName } from "../../engine/selectors";
import type { GameState, HexDirection, TilePlacementDraft } from "../../engine/types";

interface GoldenEffectPanelProps {
  state: GameState;
  onResolveBell: (arrivalCardId: string) => void;
  onResolveScroll: (returnedCardByPlayerId: Record<string, string | undefined>) => void;
  onResolveSignet: (placements: GoldenSignetPlacement[]) => void;
}

export function GoldenEffectPanel({
  state,
  onResolveBell,
  onResolveScroll,
  onResolveSignet
}: GoldenEffectPanelProps) {
  const pending = state.pendingGoldenEffect;
  const [scrollChoices, setScrollChoices] = useState<Record<string, string>>({});
  const [selectedTileIds, setSelectedTileIds] = useState<string[]>([]);
  const [draftByTileId, setDraftByTileId] = useState<Record<string, TilePlacementDraft>>({});

  const signetPlacements = useMemo<GoldenSignetPlacement[]>(
    () => selectedTileIds.map((placedTileId) => ({
      placedTileId,
      placement: draftByTileId[placedTileId] ?? {}
    })),
    [draftByTileId, selectedTileIds]
  );
  const signetValidation = useMemo(
    () => validateGoldenSignetPlacements(state, signetPlacements),
    [signetPlacements, state]
  );

  if (!pending) return null;
  const card = encounterById[pending.cardId];

  if (pending.kind === "bell") {
    return (
      <div className="golden-effect-panel">
        <header>
          <Crown size={24} />
          <div><p className="eyebrow">Golden Boon</p><h2>{card?.name}</h2></div>
        </header>
        <p>{card?.type === "goldenBoon" ? card.effectText : ""}</p>
        <div className="golden-choice-grid">
          {pending.arrivalCardIds.map((arrivalCardId) => {
            const arrival = encounterById[arrivalCardId];
            return (
              <article key={arrivalCardId}>
                <span>Arrival</span>
                <strong>{arrival?.name}</strong>
                <p>{arrival?.type === "arrival" ? arrival.requirementText : ""}</p>
                <button onClick={() => onResolveBell(arrivalCardId)} type="button">
                  Complete this Arrival
                </button>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  if (pending.kind === "scroll") {
    return (
      <div className="golden-effect-panel">
        <header>
          <ScrollText size={24} />
          <div><p className="eyebrow">Golden Boon</p><h2>{card?.name}</h2></div>
        </header>
        <p>{card?.type === "goldenBoon" ? card.effectText : ""}</p>
        <div className="golden-scroll-choices">
          {state.players.map((player) => (
            <label key={player.id}>
              {player.name}
              <select
                aria-label={`${player.name} Golden Scroll exchange`}
                value={scrollChoices[player.id] ?? ""}
                onChange={(event) => setScrollChoices((current) => ({
                  ...current,
                  [player.id]: event.target.value
                }))}
              >
                <option value="">Keep current hand</option>
                {(state.encounters.handsByPlayerId[player.id] ?? []).map((cardId) => (
                  <option key={cardId} value={cardId}>{encounterById[cardId]?.name ?? cardId}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button
          className="primary-action"
          onClick={() => onResolveScroll(scrollChoices)}
          type="button"
        >
          Resolve Golden Scroll
        </button>
      </div>
    );
  }

  return (
    <div className="golden-effect-panel golden-signet-panel">
      <header>
        <Move size={24} />
        <div><p className="eyebrow">Golden Boon</p><h2>{card?.name}</h2></div>
      </header>
      <p>{card?.type === "goldenBoon" ? card.effectText : ""}</p>
      <div className="golden-signet-layout">
        <section>
          <strong>1. Choose up to five tiles</strong>
          <div className="golden-signet-tile-list">
            {state.map.placedTiles.map((tile) => {
              const selected = selectedTileIds.includes(tile.instanceId);
              return (
                <label key={tile.instanceId}>
                  <input
                    checked={selected}
                    disabled={!selected && selectedTileIds.length >= 5}
                    onChange={() => setSelectedTileIds((current) =>
                      selected
                        ? current.filter((id) => id !== tile.instanceId)
                        : [...current, tile.instanceId]
                    )}
                    type="checkbox"
                  />
                  <span>{selectTileName(tile)}</span>
                  <small>{tile.hexIds.join(", ")}</small>
                </label>
              );
            })}
          </div>
        </section>
        <section>
          <strong>2. Choose legal new spaces</strong>
          <div className="golden-signet-placement-list">
            {selectedTileIds.map((tileId) => {
              const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === tileId);
              if (!tile) return null;
              const footprint = getTileFootprintKind(tile.tileId);
              const size = getTileFootprintSize(tile.tileId);
              const draft = draftByTileId[tileId] ?? {};
              return (
                <article key={tileId}>
                  <strong>{selectTileName(tile)}</strong>
                  <label>
                    Anchor
                    <select
                      value={draft.anchorHexId ?? ""}
                      onChange={(event) => setDraftByTileId((current) => ({
                        ...current,
                        [tileId]: { ...draft, anchorHexId: event.target.value || undefined }
                      }))}
                    >
                      <option value="">Choose a hex</option>
                      {mapCells.map((cell) => (
                        <option key={cell.id} value={cell.id}>{cell.id} · {terrainLabels[cell.terrain]}</option>
                      ))}
                    </select>
                  </label>
                  {footprint === "line" && (
                    <label>
                      Orientation
                      <select
                        value={draft.orientation ?? 0}
                        onChange={(event) => setDraftByTileId((current) => ({
                          ...current,
                          [tileId]: { ...draft, orientation: Number(event.target.value) as HexDirection }
                        }))}
                      >
                        {[0, 1, 2, 3, 4, 5].map((direction) => (
                          <option key={direction} value={direction}>Direction {direction + 1}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  {footprint === "detached" && Array.from({ length: size - 1 }, (_, index) => (
                    <label key={index}>
                      Additional hex {index + 1}
                      <select
                        value={draft.secondaryHexIds?.[index] ?? ""}
                        onChange={(event) => {
                          const secondary = [...(draft.secondaryHexIds ?? [])];
                          secondary[index] = event.target.value;
                          setDraftByTileId((current) => ({
                            ...current,
                            [tileId]: { ...draft, secondaryHexIds: secondary }
                          }));
                        }}
                      >
                        <option value="">Choose a hex</option>
                        {mapCells.map((cell) => (
                          <option key={cell.id} value={cell.id}>{cell.id} · {terrainLabels[cell.terrain]}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </article>
              );
            })}
            {selectedTileIds.length === 0 && <p className="muted">Moving tiles is optional.</p>}
          </div>
        </section>
      </div>
      {!signetValidation.ok && (
        <ul className="failure-list">
          {signetValidation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
      <button
        className="primary-action"
        disabled={!signetValidation.ok}
        onClick={() => onResolveSignet(signetPlacements)}
        type="button"
      >
        {selectedTileIds.length ? "Reposition selected tiles" : "Resolve without moving tiles"}
      </button>
    </div>
  );
}

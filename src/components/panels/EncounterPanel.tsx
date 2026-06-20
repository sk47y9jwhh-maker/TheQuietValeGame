import { encounterById } from "../../data/encounters";
import { mapById, terrainLabels } from "../../data/map";
import { coreTileById, specialTileById } from "../../data/tiles";
import {
  formatCategory,
  formatCost,
} from "../common/gameText";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { getCurrentSeasonCardEffectText } from "../../engine/manualEffects";
import { getPlacementFailures } from "../../engine/placementRules";
import { getPlacedTileAtHex } from "../../engine/reachability";
import { selectCurrentPlayer, selectTileName } from "../../engine/selectors";
import type {
  EncounterData,
  GameState,
  HexDirection,
  PlacedTile,
  TilePlacementDraft
} from "../../engine/types";

interface EncounterPanelProps {
  state: GameState;
  selectedHexIds: string[];
  selectedTileId: string;
  placementOrientation: HexDirection;
  actionMode: string;
  onUseFaceUpBoon: (boonCardId: string) => void;
}

function getPlacedTileDetail(tile: PlacedTile) {
  if (tile.kind === "special") {
    const data = specialTileById[tile.tileId];
    return {
      category: data.category,
      effectText: data.effectText,
      population: data.population,
      renown: data.renown,
      meta: "Special Tile"
    };
  }

  const data = coreTileById[tile.tileId];
  const side = tile.side === "upgraded" ? data.upgraded : data.basic;
  return {
    category: data.category,
    effectText: side.effectText,
    population: side.population,
    renown: side.renown,
    meta: tile.side === "upgraded" ? "Upgraded Core Tile" : "Basic Core Tile"
  };
}

function getTilePreview(tileId: string) {
  const core = coreTileById[tileId];
  if (core) {
    return {
      name: core.basic.name,
      meta: `${formatCategory(core.category)} Core Tile`,
      cost: formatCost(core.basic.cost),
      placement: core.placement?.text ?? "No placement restriction.",
      effectText: core.basic.effectText,
      population: core.basic.population,
      renown: core.basic.renown
    };
  }

  const special = specialTileById[tileId];
  if (!special) return null;
  return {
    name: special.name,
    meta: `${formatCategory(special.category)} Special Tile`,
    cost: "Free",
    placement: special.placement?.text ?? "No placement restriction.",
    effectText: special.effectText,
    population: special.population,
    renown: special.renown
  };
}

function getEncounterDetail(
  state: GameState,
  cardId: string
): { card?: EncounterData; effectText: string; flavorText?: string; footer?: string } {
  const card = encounterById[cardId];
  if (!card) return { effectText: cardId };

  if (card.type === "arrival") {
    return {
      card,
      effectText: card.requirementText,
      flavorText: card.flavorText,
      footer: `Unlocks ${card.rewardSpecialTileIds
        .map((tileId) => specialTileById[tileId]?.name ?? tileId)
        .join(", ")}`
    };
  }

  if (card.type === "burden") {
    return {
      card,
      effectText: getCurrentSeasonCardEffectText(state, cardId),
      flavorText: card.flavorText,
      footer: card.resolutionText
    };
  }

  if (card.type === "boon") {
    return {
      card,
      effectText: getCurrentSeasonCardEffectText(state, cardId),
      flavorText: card.flavorText,
      footer: card.lifecycle
    };
  }

  return {
    card,
    effectText: card.effectText,
    flavorText: card.flavorText,
    footer: "Disabled in normal online setup."
  };
}

export function EncounterPanel({
  state,
  selectedHexIds,
  selectedTileId,
  placementOrientation,
  actionMode,
  onUseFaceUpBoon
}: EncounterPanelProps) {
  const currentPlayer = selectCurrentPlayer(state);
  const inspectedHexId = selectedHexIds[selectedHexIds.length - 1] ?? null;
  const placementDraft: TilePlacementDraft = {
    anchorHexId: selectedHexIds[0],
    orientation: placementOrientation,
    secondaryHexIds: selectedHexIds.slice(1)
  };
  const selectedCell = inspectedHexId ? mapById[inspectedHexId] : null;
  const placedTile = inspectedHexId ? getPlacedTileAtHex(state, inspectedHexId) : null;
  const placedTileDetail = placedTile ? getPlacedTileDetail(placedTile) : null;
  const selectedTilePreview = getTilePreview(selectedTileId);
  const placementFailures =
    inspectedHexId && actionMode === "place" && !placedTile
      ? getPlacementFailures(state, currentPlayer.id, selectedTileId, placementDraft)
      : [];

  return (
    <aside className="right-panel">
      {selectedCell ? (
        <section className="inspector-card">
          <p className="eyebrow">Inspector</p>
          <h2>{selectedCell.id}</h2>
          <p>{terrainLabels[selectedCell.terrain]}</p>
          {placedTile ? (
            <div className="detail-stack tile-detail">
              <div>
                <strong>{selectTileName(placedTile)}</strong>
                <span>{placedTileDetail?.meta}</span>
              </div>
              <div className="stat-row">
                <span>{formatCategory(placedTileDetail?.category ?? "special")}</span>
                <span>Pop {placedTileDetail?.population ?? 0}</span>
                <span>Renown {placedTileDetail?.renown ?? 0}</span>
              </div>
              <div className="status-row">
                <span className={placedTile.strain >= 3 ? "danger-pill" : "status-pill"}>
                  Strain {placedTile.strain}/3
                </span>
                <span
                  className={
                    placedTile.support.passive || placedTile.support.singleUse
                      ? "support-pill"
                      : "status-pill"
                  }
                >
                  {placedTile.support.passive
                    ? "Passive Supported"
                    : placedTile.support.singleUse
                      ? "Supported"
                      : "Not Supported"}
                </span>
              </div>
              <p>{placedTileDetail?.effectText}</p>
            </div>
          ) : actionMode === "place" && placementFailures.length === 0 ? (
            <div className="detail-stack tile-detail">
              <strong>{selectedTilePreview?.name}</strong>
              <span>{selectedTilePreview?.meta}</span>
              <div className="stat-row">
                <span>Cost {selectedTilePreview?.cost}</span>
                <span>Pop {selectedTilePreview?.population}</span>
                <span>Renown {selectedTilePreview?.renown}</span>
              </div>
              <p>{selectedTilePreview?.placement}</p>
              <p>{selectedTilePreview?.effectText}</p>
              <p className="success-note">Legal placement.</p>
            </div>
          ) : actionMode === "place" ? (
            <>
              {selectedTilePreview && (
                <div className="detail-stack tile-detail">
                  <strong>{selectedTilePreview.name}</strong>
                  <span>{selectedTilePreview.meta}</span>
                  <span>Cost {selectedTilePreview.cost}</span>
                  <p>{selectedTilePreview.placement}</p>
                  <p>{selectedTilePreview.effectText}</p>
                </div>
              )}
              <ul className="failure-list">
                {placementFailures.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted">Empty hex. Choose Place Tile to see legal options.</p>
          )}
        </section>
      ) : (
        <>
          <p className="eyebrow">Stewards Board</p>
          <h2>Encounters</h2>
        </>
      )}

      <section className="encounter-section">
        <h3>Face-up Boons</h3>
        {state.encounters.faceUpBoons.length === 0 ? (
          <p className="muted">No face-up Boons.</p>
        ) : (
          state.encounters.faceUpBoons.map((boon) => (
            <div key={boon.cardId} className="encounter-row boon-row card-row card-boon">
              <div>
                <span>{encounterById[boon.cardId]?.name ?? boon.cardId}</span>
                {getEncounterDetail(state, boon.cardId).flavorText && (
                  <em>{getEncounterDetail(state, boon.cardId).flavorText}</em>
                )}
                <EncounterSeasonEffects
                  card={encounterById[boon.cardId]}
                  currentSeason={state.season}
                />
              </div>
              <strong>{boon.remainingUses} use{boon.remainingUses === 1 ? "" : "s"}</strong>
              <button
                disabled={
                  state.phase !== "turns" ||
                  state.pendingEffects.length > 0 ||
                  Boolean(state.pendingDeckReorder)
                }
                onClick={() => onUseFaceUpBoon(boon.cardId)}
                type="button"
              >
                Use
              </button>
            </div>
          ))
        )}
      </section>

      <section className="encounter-section">
        <h3>Prepared Effects</h3>
        {state.boonModifiers.length === 0 ? (
          <p className="muted">No prepared effects.</p>
        ) : (
          state.boonModifiers.map((modifier) => (
            <div key={modifier.id} className="encounter-row modifier-row card-row">
              <div>
                <span>{modifier.name}</span>
                <small>{modifier.effectText}</small>
              </div>
              <strong>
                {modifier.zeroAction ? "0 Actions" : ""}
                {modifier.amount ? `-${modifier.amount} resources` : ""}
              </strong>
            </div>
          ))
        )}
      </section>

      <section className="encounter-section urgent">
        <h3>Active Arrivals</h3>
        {state.encounters.activeArrivals.length === 0 ? (
          <p className="muted">No active Arrivals.</p>
        ) : (
          state.encounters.activeArrivals.map((arrival) => (
            <article key={arrival.cardId} className="encounter-row card-row card-arrival">
              <div>
                <span>{encounterById[arrival.cardId]?.name ?? arrival.cardId}</span>
                {getEncounterDetail(state, arrival.cardId).flavorText && (
                  <em>{getEncounterDetail(state, arrival.cardId).flavorText}</em>
                )}
                <small>{getEncounterDetail(state, arrival.cardId).effectText}</small>
                <small>{getEncounterDetail(state, arrival.cardId).footer}</small>
              </div>
              <strong>{arrival.timerTokens} timers</strong>
            </article>
          ))
        )}
      </section>

      <section className="encounter-section">
        <h3>Active Burdens</h3>
        {state.encounters.activeBurdens.length === 0 ? (
          <p className="muted">No active Burdens.</p>
        ) : (
          state.encounters.activeBurdens.map((cardId) => (
            <article key={cardId} className="encounter-row card-row burden-card card-burden">
              <div>
                <span>{encounterById[cardId]?.name ?? cardId}</span>
                {getEncounterDetail(state, cardId).flavorText && (
                  <em>{getEncounterDetail(state, cardId).flavorText}</em>
                )}
                <EncounterSeasonEffects
                  card={encounterById[cardId]}
                  currentSeason={state.season}
                />
              </div>
              <strong>
                {state.ignoredBurdenIdsThisRound.includes(cardId)
                  ? "Ignored"
                  : "Active"}
              </strong>
            </article>
          ))
        )}
      </section>

      <section className="encounter-section">
        <h3>Completed Arrivals</h3>
        {state.encounters.completedArrivals.length === 0 ? (
          <p className="muted">No Special Tiles unlocked.</p>
        ) : (
          state.encounters.completedArrivals.map((arrival) => (
            <article key={arrival.cardId} className="encounter-row card-row card-arrival">
              <div>
                <span>{encounterById[arrival.cardId]?.name ?? arrival.cardId}</span>
                {getEncounterDetail(state, arrival.cardId).flavorText && (
                  <em>{getEncounterDetail(state, arrival.cardId).flavorText}</em>
                )}
                <small>
                  {arrival.specialTileIds
                    .map((tileId) => specialTileById[tileId]?.name ?? tileId)
                    .join(", ")}
                </small>
              </div>
              <strong>{arrival.specialTileIds.length} tiles</strong>
            </article>
          ))
        )}
      </section>
    </aside>
  );
}

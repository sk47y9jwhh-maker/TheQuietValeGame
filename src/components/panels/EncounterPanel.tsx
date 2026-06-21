import { encounterById } from "../../data/encounters";
import { mapById, terrainLabels } from "../../data/map";
import { coreTileById, specialTileById } from "../../data/tiles";
import {
  formatCategory,
  formatCost,
  getBurdenResolutionCurrentText,
} from "../common/gameText";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { getCurrentSeasonCardEffectText } from "../../engine/manualEffects";
import {
  canCompleteArrival,
  canResolveBurden,
  getUsableFaceUpBoonIds
} from "../../engine/gameActions";
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
  onCompleteArrival?: (arrivalCardId: string) => void;
  onResolveBurden?: (burdenCardId: string) => void;
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

function formatInteractBlockers(reasons: string[]): string {
  return reasons
    .map((reason) =>
      reason.replace(/^Cannot (?:complete Arrival|resolve Burden):\s*/i, "")
    )
    .join(" ");
}

function getSpecialTileList(tileIds: string[]) {
  return tileIds.map((tileId) => specialTileById[tileId]).filter(Boolean);
}

export function EncounterPanel({
  state,
  selectedHexIds,
  selectedTileId,
  placementOrientation,
  actionMode,
  onUseFaceUpBoon,
  onCompleteArrival,
  onResolveBurden
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
  const usableBoonIds = new Set(getUsableFaceUpBoonIds(state));

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
          state.encounters.faceUpBoons.map((boon) => {
            const card = encounterById[boon.cardId];
            const detail = getEncounterDetail(state, boon.cardId);

            return (
              <article
                key={boon.cardId}
                className="encounter-row encounter-full-card boon-row card-row card-boon"
              >
                <div className="encounter-card-heading">
                  <span>{card?.name ?? boon.cardId}</span>
                  <div className="encounter-card-actions">
                    <strong>
                      {boon.remainingUses} use{boon.remainingUses === 1 ? "" : "s"}
                    </strong>
                    <button
                      disabled={!usableBoonIds.has(boon.cardId)}
                      onClick={() => onUseFaceUpBoon(boon.cardId)}
                      type="button"
                    >
                      Use
                    </button>
                  </div>
                </div>
                {detail.flavorText && <em>{detail.flavorText}</em>}
                <EncounterSeasonEffects
                  card={card}
                  currentSeason={state.season}
                />
              </article>
            );
          })
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
          state.encounters.activeArrivals.map((arrival) => {
            const detail = getEncounterDetail(state, arrival.cardId);
            const card = encounterById[arrival.cardId];
            const validation = canCompleteArrival(state, arrival.cardId);
            const rewardTiles =
              card?.type === "arrival" ? getSpecialTileList(card.rewardSpecialTileIds) : [];

            return (
              <article
                key={arrival.cardId}
                className="encounter-row encounter-full-card card-row card-arrival"
              >
                <div className="encounter-card-heading">
                  <span>{card?.name ?? arrival.cardId}</span>
                  <div className="encounter-card-actions encounter-inline-actions">
                    <strong>{arrival.timerTokens} timers</strong>
                    <button
                      disabled={!validation.ok || !onCompleteArrival}
                      onClick={() => onCompleteArrival?.(arrival.cardId)}
                      type="button"
                    >
                      Complete
                    </button>
                  </div>
                </div>
                {detail.flavorText && <em>{detail.flavorText}</em>}
                <small>{detail.effectText}</small>
                {rewardTiles.length > 0 && (
                  <div className="unlock-preview-list" aria-label="Unlock rewards">
                    {rewardTiles.map((tile) => (
                      <span className="unlock-preview-chip" key={tile.id}>
                        <strong>{tile.name}</strong>
                        <small>{formatCategory(tile.category)} Special</small>
                      </span>
                    ))}
                  </div>
                )}
                {!validation.ok && (
                  <small className="missing-cost encounter-action-note">
                    {formatInteractBlockers(validation.reasons)}
                  </small>
                )}
              </article>
            );
          })
        )}
      </section>

      <section className="encounter-section">
        <h3>Active Burdens</h3>
        {state.encounters.activeBurdens.length === 0 ? (
          <p className="muted">No active Burdens.</p>
        ) : (
          state.encounters.activeBurdens.map((cardId) => {
            const card = encounterById[cardId];
            const detail = getEncounterDetail(state, cardId);
            const validation = canResolveBurden(state, cardId);

            return (
              <article
                key={cardId}
                className="encounter-row encounter-full-card burden-card card-row card-burden"
              >
                <div className="encounter-card-heading">
                  <span>{card?.name ?? cardId}</span>
                  <div className="encounter-card-actions encounter-inline-actions">
                    <strong>
                      {state.ignoredBurdenIdsThisRound.includes(cardId)
                        ? "Ignored"
                        : "Active"}
                    </strong>
                    <button
                      disabled={!validation.ok || !onResolveBurden}
                      onClick={() => onResolveBurden?.(cardId)}
                      type="button"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
                {detail.flavorText && <em>{detail.flavorText}</em>}
                <small>
                  {getBurdenResolutionCurrentText(card, state.season) ??
                    "Resolution cost unavailable."}
                </small>
                <EncounterSeasonEffects card={card} currentSeason={state.season} />
                {!validation.ok && (
                  <small className="missing-cost encounter-action-note">
                    {formatInteractBlockers(validation.reasons)}
                  </small>
                )}
              </article>
            );
          })
        )}
      </section>

      <section className="encounter-section">
        <h3>Completed Arrivals</h3>
        {state.encounters.completedArrivals.length === 0 ? (
          <p className="muted">No Special Tiles unlocked.</p>
        ) : (
          state.encounters.completedArrivals.map((arrival) => {
            const rewardTiles = getSpecialTileList(arrival.specialTileIds);
            return (
              <article
                key={arrival.cardId}
                className="encounter-row encounter-full-card card-row card-arrival completed-arrival-card"
              >
                <div className="encounter-card-heading">
                  <span>{encounterById[arrival.cardId]?.name ?? arrival.cardId}</span>
                  <strong>
                    {arrival.specialTileIds.length} tile
                    {arrival.specialTileIds.length === 1 ? "" : "s"} unlocked
                  </strong>
                </div>
                {getEncounterDetail(state, arrival.cardId).flavorText && (
                  <em>{getEncounterDetail(state, arrival.cardId).flavorText}</em>
                )}
                <div className="unlock-preview-list prominent" aria-label="Unlocked special tiles">
                  {rewardTiles.map((tile) => (
                    <span className="unlock-preview-chip" key={tile.id}>
                      <strong>{tile.name}</strong>
                      <small>{formatCategory(tile.category)} Special Tile</small>
                    </span>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </section>
    </aside>
  );
}

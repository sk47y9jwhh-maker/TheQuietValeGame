import { encounterById } from "../../data/encounters";
import { useState } from "react";
import { specialTileById } from "../../data/tiles";
import { formatCategory } from "../common/gameText";
import { EncounterCard } from "../common/EncounterCard";
import {
  canCompleteArrival,
  canResolveBurden,
  getUsableFaceUpBoonIds
} from "../../engine/gameActions";
import type {
  GameState
} from "../../engine/types";

interface EncounterPanelProps {
  state: GameState;
  onUseFaceUpBoon: (boonCardId: string) => void;
  onCompleteArrival?: (arrivalCardId: string) => void;
  onResolveBurden?: (burdenCardId: string) => void;
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
  onUseFaceUpBoon,
  onCompleteArrival,
  onResolveBurden
}: EncounterPanelProps) {
  const usableBoonIds = new Set(getUsableFaceUpBoonIds(state));
  const [completedArrivalsOpen, setCompletedArrivalsOpen] = useState(
    state.encounters.completedArrivals.length <= 1
  );

  return (
    <aside className="right-panel">
      <header className="encounter-board-header">
        <p className="eyebrow">Stewards Board</p>
        <h2>Encounters</h2>
      </header>

      <section className="encounter-section">
        <h3>Face-up Boons</h3>
        {state.encounters.faceUpBoons.length === 0 ? (
          <p className="muted">No face-up Boons.</p>
        ) : (
          state.encounters.faceUpBoons.map((boon) => {
            const card = encounterById[boon.cardId];
            if (!card) return null;

            return (
              <EncounterCard
                card={card}
                controls={(
                  <button
                    disabled={!usableBoonIds.has(boon.cardId)}
                    aria-label={`Interact with ${card.name}`}
                    onClick={() => onUseFaceUpBoon(boon.cardId)}
                    type="button"
                  >
                    {card.type === "goldenBoon" ? "Prepare Path" : "Interact"}
                  </button>
                )}
                currentSeason={state.season}
                key={boon.cardId}
                status={card.type === "goldenBoon"
                  ? boon.lastUsedRound === state.round
                    ? "Used this round"
                    : "Once per round"
                  : `${boon.remainingUses} use${boon.remainingUses === 1 ? "" : "s"}`}
              />
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
            const card = encounterById[arrival.cardId];
            if (!card || card.type !== "arrival") return null;
            const validation = canCompleteArrival(state, arrival.cardId);
            const rewardTiles = getSpecialTileList(card.rewardSpecialTileIds);

            return (
              <EncounterCard
                card={card}
                controls={(
                  <button
                    disabled={!validation.ok || !onCompleteArrival}
                    aria-label={`Interact with ${card.name}`}
                    onClick={() => onCompleteArrival?.(arrival.cardId)}
                    type="button"
                  >
                    Interact
                  </button>
                )}
                currentSeason={state.season}
                key={arrival.cardId}
                status={`${arrival.timerTokens} timers`}
                supplementary={(
                  <>
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
                  </>
                )}
              />
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
            if (!card || card.type !== "burden") return null;
            const validation = canResolveBurden(state, cardId);

            return (
              <EncounterCard
                card={card}
                controls={(
                  <button
                    disabled={!validation.ok || !onResolveBurden}
                    aria-label={`Interact with ${card.name}`}
                    onClick={() => onResolveBurden?.(cardId)}
                    type="button"
                  >
                    Interact
                  </button>
                )}
                currentSeason={state.season}
                key={cardId}
                status={state.ignoredBurdenIdsThisRound.includes(cardId)
                  ? "Ignored"
                  : "Active"}
                supplementary={!validation.ok ? (
                  <small className="missing-cost encounter-action-note">
                    {formatInteractBlockers(validation.reasons)}
                  </small>
                ) : undefined}
              />
            );
          })
        )}
      </section>

      <details
        className="encounter-section completed-arrivals-section"
        open={completedArrivalsOpen}
        onToggle={(event) => setCompletedArrivalsOpen(event.currentTarget.open)}
      >
        <summary>
          <h3>Completed Arrivals</h3>
          <span>{state.encounters.completedArrivals.length}</span>
        </summary>
        <div className="completed-arrivals-list">
          {state.encounters.completedArrivals.length === 0 ? (
            <p className="muted">No Special Tiles unlocked.</p>
          ) : (
            state.encounters.completedArrivals.map((arrival) => {
              const rewardTiles = getSpecialTileList(arrival.specialTileIds);
              const card = encounterById[arrival.cardId];
              if (!card || card.type !== "arrival") return null;
              return (
                <EncounterCard
                  card={card}
                  currentSeason={state.season}
                  key={arrival.cardId}
                  size="compact"
                  status={`${arrival.specialTileIds.length} tile${
                    arrival.specialTileIds.length === 1 ? "" : "s"
                  } unlocked`}
                  supplementary={(
                    <div className="unlock-preview-list prominent" aria-label="Unlocked special tiles">
                      {rewardTiles.map((tile) => (
                        <span className="unlock-preview-chip" key={tile.id}>
                          <strong>{tile.name}</strong>
                          <small>{formatCategory(tile.category)} Special Tile</small>
                        </span>
                      ))}
                    </div>
                  )}
                />
              );
            })
          )}
        </div>
      </details>
    </aside>
  );
}

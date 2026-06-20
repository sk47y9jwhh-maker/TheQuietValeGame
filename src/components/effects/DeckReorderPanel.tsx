import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { encounterById } from "../../data/encounters";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { getEncounterTypeLabel } from "../common/gameText";
import type {
  PendingDeckReorderState,
  Season
} from "../../engine/types";

interface DeckReorderPanelProps {
  pending: PendingDeckReorderState;
  season: Season;
  onConfirm: (orderedCardIds: string[]) => void;
  onSkip?: () => void;
}

export function DeckReorderPanel({
  pending,
  season,
  onConfirm,
  onSkip
}: DeckReorderPanelProps) {
  const [orderedCardIds, setOrderedCardIds] = useState(pending.cardIds);

  useEffect(() => {
    setOrderedCardIds(pending.cardIds);
  }, [pending.id, pending.cardIds]);

  function moveCard(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= orderedCardIds.length) return;

    setOrderedCardIds((current) => {
      const next = [...current];
      const [cardId] = next.splice(index, 1);
      next.splice(nextIndex, 0, cardId);
      return next;
    });
  }

  return (
    <section className="deck-order-screen">
      <div className="seeding-header">
        <p className="eyebrow">Encounter Deck</p>
        <h1>{pending.title}</h1>
        <p>{pending.effectText}</p>
      </div>

      <div className="deck-order-list">
        {orderedCardIds.map((cardId, index) => {
          const card = encounterById[cardId];
          const cardToneClass = card ? `card-${card.type}` : "";
          return (
            <article key={cardId} className={`deck-order-card ${cardToneClass}`}>
              <div>
                <div className="deck-order-meta">
                  <span className={`encounter-type-banner compact ${cardToneClass}`}>
                    {getEncounterTypeLabel(card)}
                  </span>
                  <span className="position-chip">Position {index + 1}</span>
                </div>
                <strong>{card?.name ?? cardId}</strong>
                {card?.flavorText && <em>{card.flavorText}</em>}
                <EncounterSeasonEffects card={card} currentSeason={season} />
              </div>
              <div className="deck-order-controls">
                <button
                  disabled={index === 0}
                  onClick={() => moveCard(index, -1)}
                  type="button"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  disabled={index === orderedCardIds.length - 1}
                  onClick={() => moveCard(index, 1)}
                  type="button"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="effect-actions">
        {pending.canSkip && onSkip && (
          <button className="secondary-action" onClick={onSkip} type="button">
            <X size={18} />
            {pending.skipLabel ?? "Skip"}
          </button>
        )}
        <button
          className="primary-action"
          onClick={() => onConfirm(orderedCardIds)}
          type="button"
        >
          <Check size={18} />
          Confirm Deck Order
        </button>
      </div>
    </section>
  );
}

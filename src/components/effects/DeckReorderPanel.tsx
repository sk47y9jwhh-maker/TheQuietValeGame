import { ArrowDown, ArrowUp, Check, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { encounterById } from "../../data/encounters";
import { EncounterCard } from "../common/EncounterCard";
import type {
  PendingDeckReorderState,
  Season
} from "../../engine/types";

interface DeckReorderPanelProps {
  pending: PendingDeckReorderState;
  season: Season;
  onConfirm: (orderedCardIds: string[], bottomCardId?: string) => void;
  onSkip?: () => void;
}

export function DeckReorderPanel({
  pending,
  season,
  onConfirm,
  onSkip
}: DeckReorderPanelProps) {
  const [orderedCardIds, setOrderedCardIds] = useState(pending.cardIds);
  const [bottomCardId, setBottomCardId] = useState<string | undefined>();

  useEffect(() => {
    setOrderedCardIds(pending.cardIds);
    setBottomCardId(undefined);
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

  function moveCardToBottom(index: number) {
    setBottomCardId(orderedCardIds[index]);
    setOrderedCardIds((current) => {
      const next = [...current];
      const [cardId] = next.splice(index, 1);
      next.push(cardId);
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
          if (!card) return null;
          return (
            <EncounterCard
              card={card}
              controls={(
                <div className="deck-order-controls">
                  {pending.mode === "moveOneToBottom" ? (
                    <button
                      aria-label={`Move ${card.name} to the bottom of the Encounter Deck`}
                      disabled={bottomCardId === cardId}
                      onClick={() => moveCardToBottom(index)}
                      type="button"
                    >
                      <ArrowDown size={16} />
                      Deck bottom
                    </button>
                  ) : (
                    <>
                      <button
                        aria-label={`Move ${card.name} up`}
                        disabled={index === 0}
                        onClick={() => moveCard(index, -1)}
                        type="button"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        aria-label={`Move ${card.name} down`}
                        disabled={index === orderedCardIds.length - 1}
                        onClick={() => moveCard(index, 1)}
                        type="button"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </>
                  )}
                </div>
              )}
              currentSeason={season}
              key={cardId}
              size="compact"
              status={<span className="position-chip">Position {index + 1}</span>}
            />
          );
        })}
      </div>

      <div className="effect-actions">
        {pending.mode === "moveOneToBottom" && bottomCardId && (
            <button
              className="secondary-action"
              onClick={() => {
                setOrderedCardIds(pending.cardIds);
                setBottomCardId(undefined);
              }}
              type="button"
            >
              <RotateCcw size={18} />
              Keep all five on top
            </button>
          )}
        {pending.canSkip && onSkip && (
          <button className="secondary-action" onClick={onSkip} type="button">
            <X size={18} />
            {pending.skipLabel ?? "Skip"}
          </button>
        )}
        <button
          className="primary-action"
          onClick={() => onConfirm(orderedCardIds, bottomCardId)}
          type="button"
        >
          <Check size={18} />
          Confirm Deck Order
        </button>
      </div>
    </section>
  );
}

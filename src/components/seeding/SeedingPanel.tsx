import { useEffect, useState } from "react";
import { CheckCircle2, ScrollText } from "lucide-react";
import { encounterById } from "../../data/encounters";
import { stewardById } from "../../data/stewards";
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import { getEncounterTypeLabel } from "../common/gameText";
import { selectCurrentPlayer } from "../../engine/selectors";
import { validateSeedingSelection } from "../../engine/gameActions";
import type { GameState } from "../../engine/types";

interface SeedingPanelProps {
  state: GameState;
  onConfirm: (selection: { top: string; middle: string; bottom: string }) => void;
}

type SeedSlotName = "top" | "middle" | "bottom";

export function SeedingPanel({ state, onConfirm }: SeedingPanelProps) {
  const currentPlayer = selectCurrentPlayer(state);
  const steward = stewardById[currentPlayer.stewardId];
  const hand = state.encounters.handsByPlayerId[currentPlayer.id] ?? [];
  const [top, setTop] = useState(hand[0] ?? "");
  const [middle, setMiddle] = useState(hand[1] ?? "");
  const [bottom, setBottom] = useState(hand[2] ?? "");
  const [contextMenu, setContextMenu] = useState<{
    cardId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setTop(hand[0] ?? "");
    setMiddle(hand[1] ?? "");
    setBottom(hand[2] ?? "");
  }, [currentPlayer.id, hand]);

  useEffect(() => {
    if (!contextMenu) return undefined;

    function closeMenu() {
      setContextMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const validation = validateSeedingSelection(state, currentPlayer.id, {
    top,
    middle,
    bottom
  });

  function getAssignedSlot(cardId: string): SeedSlotName | null {
    if (top === cardId) return "top";
    if (middle === cardId) return "middle";
    if (bottom === cardId) return "bottom";
    return null;
  }

  function assignSeedSlot(slot: SeedSlotName, cardId: string) {
    const current = { top, middle, bottom };
    const existingSlot = (Object.entries(current) as Array<[SeedSlotName, string]>).find(
      ([, value]) => value === cardId
    )?.[0];
    const previousSlotValue = current[slot];
    const next = {
      ...current,
      [slot]: cardId
    };

    if (existingSlot && existingSlot !== slot) {
      next[existingSlot] = previousSlotValue;
    }

    setTop(next.top);
    setMiddle(next.middle);
    setBottom(next.bottom);
    setContextMenu(null);
  }

  return (
    <main className="command-table setup-flow-table seeding-flow">
      <section className="action-console seeding-control-panel">
        <div className="turn-summary">
          <div>
            <p className="eyebrow">Season {state.season} Seeding</p>
            <h2>Seed Encounters</h2>
          </div>
          <strong>Step 3</strong>
        </div>

        <div className="detail-stack steward-start-summary">
          <div className="flow-heading">
            <ScrollText size={18} />
            <strong>{steward.name}</strong>
          </div>
          <p>Choose one hidden card for the top, one for the middle, and one for the bottom.</p>
        </div>

        <div className="seed-slots">
          <SeedSlot label="Top" value={top} hand={hand} onChange={setTop} />
          <SeedSlot label="Middle" value={middle} hand={hand} onChange={setMiddle} />
          <SeedSlot label="Bottom" value={bottom} hand={hand} onChange={setBottom} />
        </div>

        <button
          className="primary-action seed-confirm-action"
          disabled={!validation.ok}
          onClick={() => onConfirm({ top, middle, bottom })}
          type="button"
        >
          <CheckCircle2 size={18} />
          Confirm Seeding
        </button>

        {!validation.ok && (
          <ul className="failure-list">
            {validation.reasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="map-panel seeding-card-board">
        <div className="seeding-board-header">
          <div>
            <p className="eyebrow">Season {state.season} Hand</p>
            <h1>{steward.name}</h1>
          </div>
          <div className="seed-summary-row">
            <span>Top</span>
            <strong>{encounterById[top]?.name ?? top}</strong>
            <span>Middle</span>
            <strong>{encounterById[middle]?.name ?? middle}</strong>
            <span>Bottom</span>
            <strong>{encounterById[bottom]?.name ?? bottom}</strong>
          </div>
        </div>

        <div className="hand-grid">
          {hand.map((cardId) => {
            const card = encounterById[cardId];
            const assignedSlot = getAssignedSlot(cardId);
            return (
              <article
                className={[
                  "hand-card",
                  card ? `card-${card.type}` : "",
                  assignedSlot ? `seeded-${assignedSlot}` : ""
                ].join(" ")}
                key={cardId}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({
                    cardId,
                    x: event.clientX,
                    y: event.clientY
                  });
                }}
                title="Right-click to seed this card."
              >
                <span className={`encounter-type-banner compact ${card ? `card-${card.type}` : ""}`}>
                  {getEncounterTypeLabel(card)}
                </span>
                <strong>{card?.name ?? cardId}</strong>
                {assignedSlot && (
                  <small className="slot-chip">Seeded {assignedSlot}</small>
                )}
                {card?.flavorText && <em>{card.flavorText}</em>}
                <EncounterSeasonEffects card={card} currentSeason={state.season} />
                <div
                  className="seed-card-actions"
                  role="group"
                  aria-label={`Seed ${card?.name ?? cardId}`}
                >
                  <button
                    className={assignedSlot === "top" ? "selected" : ""}
                    onClick={() => assignSeedSlot("top", cardId)}
                    type="button"
                  >
                    Top
                  </button>
                  <button
                    className={assignedSlot === "middle" ? "selected" : ""}
                    onClick={() => assignSeedSlot("middle", cardId)}
                    type="button"
                  >
                    Middle
                  </button>
                  <button
                    className={assignedSlot === "bottom" ? "selected" : ""}
                    onClick={() => assignSeedSlot("bottom", cardId)}
                    type="button"
                  >
                    Bottom
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {contextMenu && (
        <div
          className="context-menu seed-context-menu"
          onClick={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <strong>{encounterById[contextMenu.cardId]?.name ?? contextMenu.cardId}</strong>
          <button onClick={() => assignSeedSlot("top", contextMenu.cardId)} type="button">
            Seed Top
          </button>
          <button onClick={() => assignSeedSlot("middle", contextMenu.cardId)} type="button">
            Seed Middle
          </button>
          <button onClick={() => assignSeedSlot("bottom", contextMenu.cardId)} type="button">
            Seed Bottom
          </button>
        </div>
      )}
    </main>
  );
}

interface SeedSlotProps {
  label: string;
  value: string;
  hand: string[];
  onChange: (cardId: string) => void;
}

function SeedSlot({ label, value, hand, onChange }: SeedSlotProps) {
  return (
    <label className="seed-slot">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {hand.map((cardId) => (
          <option key={cardId} value={cardId}>
            {encounterById[cardId]?.name ?? cardId}
          </option>
        ))}
      </select>
    </label>
  );
}

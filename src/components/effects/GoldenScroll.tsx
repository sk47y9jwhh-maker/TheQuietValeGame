import { useEffect, useRef, useState } from "react";
import { encounterById } from "../../data/encounters";
import { stewardById } from "../../data/stewards";
import type { GameState } from "../../engine/types";
import { EncounterCard } from "../common/EncounterCard";
import { PrivateHandGate } from "../common/PrivateHandGate";
import { getEncounterTypeLabel, getSeasonText } from "../common/gameText";

interface GoldenScrollProps {
  state: GameState;
  onResolve: (choices: Record<string, string[]>) => void;
}

/** Collect private choices locally, then apply the existing all-player engine action once. */
export function GoldenScroll({ state, onResolve }: GoldenScrollProps) {
  const [playerIndex, setPlayerIndex] = useState(0);
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const player = state.players[playerIndex];
  const card = encounterById[state.pendingGoldenEffect!.cardId];
  const reviewing = !player;
  useEffect(() => {
    if (reviewing || state.playerCount === 1) heading.current?.focus();
  }, [reviewing, state.playerCount]);
  const hand = player
    ? (state.encounters.handsByPlayerId[player.id] ?? [])
      .map((id) => encounterById[id])
      .filter((card) => card && card.type !== "goldenBoon")
    : [];
  const selected = player ? choices[player.id] ?? [] : [];

  function toggle(id: string) {
    setChoices((current) => {
      const previous = current[player.id] ?? [];
      return {
        ...current,
        [player.id]: previous.includes(id) ? previous.filter((other) => other !== id) : [...previous, id]
      };
    });
  }

  function confirmChoice() {
    setChoices((current) => ({ ...current, [player.id]: selected }));
    const nextUnconfirmed = state.players.findIndex((candidate, index) =>
      index !== playerIndex && !Object.prototype.hasOwnProperty.call(choices, candidate.id)
    );
    setPlayerIndex(nextUnconfirmed < 0 ? state.players.length : nextUnconfirmed);
  }

  return (
    <section className="golden-decision golden-scroll-experience" aria-label="Private Golden Scroll exchange">
      <header>
        <p className="eyebrow">Golden Legacy · Optional hand refresh</p>
        <h2 ref={heading} tabIndex={-1}>{reviewing ? "Ready to exchange?" : "The Golden Scroll"}</h2>
        <p>{reviewing
          ? "Each Steward has made their choice. Card names stay private."
          : `Steward ${playerIndex + 1} of ${state.playerCount}. Choose any standard cards to return, or keep your whole hand.`}</p>
      </header>
      <details className="golden-card-rules">
        <summary>Read the Golden Scroll</summary>
        {card && <EncounterCard card={card} currentSeason={state.season} />}
      </details>
      {player ? (
        <PrivateHandGate key={player.id} state={state} playerId={player.id}>
          <div className="golden-scroll-private">
            <p className="golden-scroll-count" role="status">{selected.length} of {hand.length} cards selected for exchange</p>
            <div className="golden-scroll-overview">
              {hand.map((handCard) => (
                <article key={handCard.id} aria-label={handCard.name} className={selected.includes(handCard.id) ? "is-selected" : ""}>
                  <p className="eyebrow">{getEncounterTypeLabel(handCard)}</p>
                  <h3>{handCard.name}</h3>
                  <p>{handCard.type === "arrival" ? handCard.requirementText : getSeasonText(handCard.effects, state.season)}</p>
                  <details>
                    <summary>Read {handCard.name}</summary>
                    <EncounterCard card={handCard} currentSeason={state.season} />
                  </details>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(handCard.id)}
                      onChange={() => toggle(handCard.id)}
                      aria-label={`Exchange ${handCard.name}`}
                    />
                    Exchange this card
                  </label>
                </article>
              ))}
            </div>
            {!hand.length && <p>No standard cards in this hand. You can continue without an exchange.</p>}
            <button className="primary-action" type="button" onClick={confirmChoice}>
              {selected.length ? `Confirm ${selected.length} for exchange` : "Keep my whole hand"}
            </button>
          </div>
        </PrivateHandGate>
      ) : (
        <div className="golden-scroll-review">
          <ul>{state.players.map((owner, index) => (
            <li key={owner.id}>
              <div>
                <strong>{owner.name} · {stewardById[owner.stewardId].name}</strong>
                <span>{choices[owner.id]?.length ?? 0} card{choices[owner.id]?.length === 1 ? "" : "s"} to exchange</span>
              </div>
              <button type="button" onClick={() => setPlayerIndex(index)}>Review {stewardById[owner.stewardId].name}’s choice</button>
            </li>
          ))}</ul>
          <p>Replacements come from the available reserve. If it runs short, you draw as many cards as remain.</p>
          <button className="primary-action" type="button" onClick={() => onResolve(choices)}>Resolve Golden Scroll</button>
        </div>
      )}
      <p className="golden-scroll-save-note">Choices are applied and saved together when you resolve the Scroll. Reloading before then restarts this handoff.</p>
    </section>
  );
}

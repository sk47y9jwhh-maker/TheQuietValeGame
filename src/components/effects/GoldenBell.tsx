import { encounterById } from "../../data/encounters";
import type { GameState } from "../../engine/types";
import { EncounterCard } from "../common/EncounterCard";
import { getArrivalRewardText } from "../common/gameText";

interface GoldenBellProps {
  state: GameState;
  onResolve: (id: string) => void;
}

export function GoldenBell({ state, onResolve }: GoldenBellProps) {
  const pending = state.pendingGoldenEffect;
  if (pending?.kind !== "bell") return null;
  const bell = encounterById[pending.cardId];

  return (
    <section className="golden-decision golden-bell-experience" aria-label="Golden Bell arrival">
      <header>
        <p className="eyebrow">The Golden Bell, a new Arrival</p>
        <h2>Welcome the revealed Arrival.</h2>
        <p>Add it to the Stewards Board with three timer tokens. This costs no actions or resources.</p>
      </header>
      <details className="golden-card-rules">
        <summary>Read the Golden Bell</summary>
        {bell && <EncounterCard card={bell} currentSeason={state.season} />}
      </details>
      {pending.arrivalCardIds.map((id) => {
        const arrival = encounterById[id];
        if (!arrival || arrival.type !== "arrival") return null;
        return (
          <article className="golden-bell-arrival" key={id} aria-label={`Revealed Arrival: ${arrival.name}`}>
            <p className="golden-arrival-timer">3 timer tokens, added for free</p>
            <h3>{arrival.name}</h3>
            <dl>
              <div><dt>To complete later</dt><dd>{arrival.requirementText}</dd></div>
              <div><dt>Completion reward</dt><dd>{getArrivalRewardText(arrival)}</dd></div>
            </dl>
            <details className="golden-card-rules">
              <summary>Read {arrival.name}</summary>
              <EncounterCard card={arrival} currentSeason={state.season} />
            </details>
            <button className="primary-action" type="button" onClick={() => onResolve(id)}>
              Place this Arrival
            </button>
            <p className="golden-arrival-next">
              Then continue any remaining Encounter effects. Pay the Arrival’s requirements when you choose to complete it.
            </p>
          </article>
        );
      })}
    </section>
  );
}

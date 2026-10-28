import type { EncounterData, PendingEffectState, Season } from "../../engine/types";
import { EncounterCard } from "../common/EncounterCard";
import { getEncounterTypeLabel } from "../common/gameText";

export function EffectSourceSummary({ effect, season, card }: {
  effect: PendingEffectState;
  season: Season;
  card?: EncounterData;
}) {
  return (
    <header className="effect-source-summary">
      <p className="eyebrow">{card ? `${getEncounterTypeLabel(card)} · Season ${["I", "II", "III"][season - 1]}` : "Current effect"}</p>
      <h3>{card?.name ?? effect.title}</h3>
      {!card && effect.sourceName !== effect.title && <p className="effect-source-name">{effect.sourceName}</p>}
      <p className="effect-rule-text">{effect.effectText}</p>
      {effect.detailText && <p className="effect-source-detail">{effect.detailText}</p>}
      {effect.targetCardManualChoice && <p className="effect-open-target">An Open Target Card lets you choose any eligible tile using this effect’s controls.</p>}
      {card && (
        <details className="effect-source-card">
          <summary>Read full card — {card.name}</summary>
          <EncounterCard card={card} currentSeason={season} size="compact" />
        </details>
      )}
    </header>
  );
}

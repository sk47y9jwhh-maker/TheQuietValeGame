import type { EncounterData, Season } from "../../engine/types";
import {
  getBoonLifecycleText,
  getBurdenResolutionCurrentText,
} from "./gameText";

interface EncounterSeasonEffectsProps {
  card?: EncounterData;
  currentSeason?: Season;
}

const seasonLabels: Record<Season, string> = {
  1: "Season I",
  2: "Season II",
  3: "Season III"
};

export function EncounterSeasonEffects({
  card,
  currentSeason
}: EncounterSeasonEffectsProps) {
  if (!card) return null;

  if ("effects" in card) {
    const seasonEffects: Array<{ season: Season; text: string }> = [
      { season: 1, text: card.effects.season1 },
      { season: 2, text: card.effects.season2 },
      { season: 3, text: card.effects.season3 }
    ];
    return (
      <div className="season-effects" aria-label="Season effects">
        {seasonEffects.map(({ season, text }) => {
          const lifecycle = card.type === "boon"
            ? getBoonLifecycleText(card, season)
            : getBurdenResolutionCurrentText(card, season);

          return (
            <div
              className={`season-effect-row ${
                currentSeason === season ? "current" : ""
              }`}
              key={season}
            >
              <strong>{seasonLabels[season]}</strong>
              <span>
                {text}
                {lifecycle && <small>{lifecycle}</small>}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if ("requirementText" in card) {
    return (
      <div className="season-effects" aria-label="Arrival requirement">
        <div className="season-effect-row current">
          <strong>Requirement</strong>
          <span>
            {card.requirementText}
            {card.rewardText && <small>{card.rewardText}</small>}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="season-effects" aria-label="Card effect">
      <div className="season-effect-row current">
        <strong>Effect</strong>
        <span>{card.effectText}</span>
      </div>
    </div>
  );
}

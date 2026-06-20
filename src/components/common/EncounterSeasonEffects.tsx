import type { EncounterData, Season } from "../../engine/types";
import {
  getBurdenResolutionCurrentText,
  getBurdenResolutionFullText
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
    const burdenCurrentResolution = getBurdenResolutionCurrentText(card, currentSeason);
    const burdenFullResolution = getBurdenResolutionFullText(card);

    return (
      <div className="season-effects" aria-label="Season effects">
        {seasonEffects.map(({ season, text }) => (
          <div
            className={`season-effect-row ${
              currentSeason === season ? "current" : ""
            }`}
            key={season}
          >
            <strong>{seasonLabels[season]}</strong>
            <span>{text}</span>
          </div>
        ))}
        {burdenCurrentResolution && (
          <div className="season-effect-row current resolution-cost-row">
            <strong>Current Cost</strong>
            <span>{burdenCurrentResolution}</span>
          </div>
        )}
        {burdenFullResolution && (
          <div className="season-effect-row resolution-cost-row">
            <strong>To Resolve</strong>
            <span>{burdenFullResolution}</span>
          </div>
        )}
      </div>
    );
  }

  if ("requirementText" in card) {
    return (
      <div className="season-effects" aria-label="Arrival requirement">
        <div className="season-effect-row current">
          <strong>Requirement</strong>
          <span>{card.requirementText}</span>
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

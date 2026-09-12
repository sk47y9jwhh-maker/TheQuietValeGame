import type { HTMLAttributes, ReactNode } from "react";
import arrivalArtwork from "../../assets/encounter-cards/arrival.png";
import boonArtwork from "../../assets/encounter-cards/boon.png";
import burdenArtwork from "../../assets/encounter-cards/burden.png";
import goldenBoonArtwork from "../../assets/encounter-cards/golden-boon.png";
import arrivalWebArtwork from "../../assets/encounter-cards/web/arrival.png";
import boonWebArtwork from "../../assets/encounter-cards/web/boon.png";
import burdenWebArtwork from "../../assets/encounter-cards/web/burden.png";
import goldenBoonWebArtwork from "../../assets/encounter-cards/web/golden-boon.png";
import type { EncounterData, Season } from "../../engine/types";
import {
  getArrivalRewardText,
  getBoonLifecycleText,
  getBurdenResolutionCurrentText,
  getEncounterTypeLabel,
  getSeasonText
} from "./gameText";

const artworkByType: Record<EncounterData["type"], string> = {
  arrival: arrivalArtwork,
  boon: boonArtwork,
  burden: burdenArtwork,
  goldenBoon: goldenBoonArtwork
};

const webArtworkByType: Record<EncounterData["type"], string> = {
  arrival: arrivalWebArtwork,
  boon: boonWebArtwork,
  burden: burdenWebArtwork,
  goldenBoon: goldenBoonWebArtwork
};

const seasonNumerals: Record<Season, string> = {
  1: "I",
  2: "II",
  3: "III"
};

type EncounterCardSize = "standard" | "compact" | "mini";

interface EncounterCardProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  card: EncounterData;
  controls?: ReactNode;
  currentSeason?: Season;
  size?: EncounterCardSize;
  outputMode?: "web" | "print";
  status?: ReactNode;
  supplementary?: ReactNode;
}

function densityClass(length: number, medium: number, dense: number): string {
  if (length >= dense) return "copy-dense";
  if (length >= medium) return "copy-medium";
  return "copy-normal";
}

function PhysicalSeasonRows({
  card,
  currentSeason
}: {
  card: Extract<EncounterData, { type: "boon" | "burden" }>;
  currentSeason?: Season;
}) {
  return (
    <div className="physical-card-seasons" aria-label="Season effects">
      {([1, 2, 3] as const).map((season) => {
        const effect = getSeasonText(card.effects, season);
        const lifecycle = card.type === "boon"
          ? getBoonLifecycleText(card, season)
          : getBurdenResolutionCurrentText(card, season);

        return (
          <section
            aria-current={currentSeason === season ? "true" : undefined}
            className={`physical-card-season ${
              currentSeason === season ? "current" : ""
            }`}
            key={season}
          >
            <span aria-hidden="true" className="physical-card-season-number">
              {seasonNumerals[season]}
            </span>
            <p
              className={`physical-card-effect ${densityClass(
                effect.length,
                82,
                101
              )}`}
            >
              {effect}
            </p>
            {lifecycle && (
              <p
                className={`physical-card-lifecycle ${densityClass(
                  lifecycle.length,
                  50,
                  61
                )}`}
              >
                {lifecycle}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PhysicalArrival({ card }: { card: Extract<EncounterData, { type: "arrival" }> }) {
  const rewardText = getArrivalRewardText(card);
  return (
    <>
      <p className="physical-card-section-label physical-card-requirement-label">
        Requirements
      </p>
      <p
        className={`physical-card-arrival-requirement ${densityClass(
          card.requirementText.length,
          48,
          57
        )}`}
      >
        {card.requirementText}
      </p>
      <p className="physical-card-section-label physical-card-reward-label">
        Reward
      </p>
      <p
        className={`physical-card-arrival-reward ${densityClass(
          rewardText.length,
          48,
          58
        )}`}
      >
        {rewardText}
      </p>
    </>
  );
}

function PhysicalGoldenBoon({
  card
}: {
  card: Extract<EncounterData, { type: "goldenBoon" }>;
}) {
  return (
    <>
      <p className="physical-card-section-label physical-card-golden-effect-label">
        Effect
      </p>
      <p
        className={`physical-card-golden-effect ${densityClass(
          card.effectText.length,
          300,
          385
        )}`}
      >
        {card.effectText}
      </p>
      <p className="physical-card-golden-lifecycle">{card.lifecycle}</p>
    </>
  );
}

export function EncounterCard({
  card,
  className = "",
  controls,
  currentSeason,
  size = "standard",
  outputMode = "web",
  status,
  supplementary,
  ...articleProps
}: EncounterCardProps) {
  const flavorText = card.flavorText ?? "";
  const titleDensity = densityClass(card.name.length, 20, 27);
  const flavorDensity = densityClass(
    flavorText.length,
    card.type === "arrival" || card.type === "goldenBoon" ? 190 : 165,
    card.type === "arrival" || card.type === "goldenBoon" ? 220 : 185
  );

  return (
    <article
      {...articleProps}
      className={`encounter-card-shell encounter-card-${size} card-${card.type} ${className}`.trim()}
    >
      <div
        aria-label={`${getEncounterTypeLabel(card)}: ${card.name}`}
        className={`physical-encounter-card physical-card-${card.type}${outputMode === "print" ? " physical-card-with-bleed" : ""}`}
      >
        <img
          alt=""
          aria-hidden="true"
          className="physical-card-artwork"
          draggable="false"
          src={(outputMode === "print" ? artworkByType : webArtworkByType)[card.type]}
        />
        <div className="physical-card-print-canvas">
          <p className="physical-card-type">{getEncounterTypeLabel(card)}</p>
          <h3 className={`physical-card-title ${titleDensity}`}>{card.name}</h3>
          <p className={`physical-card-flavor ${flavorDensity}`}>{flavorText}</p>

          {(card.type === "boon" || card.type === "burden") && (
            <PhysicalSeasonRows card={card} currentSeason={currentSeason} />
          )}
          {card.type === "arrival" && <PhysicalArrival card={card} />}
          {card.type === "goldenBoon" && <PhysicalGoldenBoon card={card} />}
        </div>
      </div>

      {(status || controls || supplementary) && (
        <div className="encounter-card-runtime">
          {(status || controls) && (
            <div className="encounter-card-runtime-bar">
              {status && <div className="encounter-card-status">{status}</div>}
              {controls && <div className="encounter-card-controls">{controls}</div>}
            </div>
          )}
          {supplementary && (
            <div className="encounter-card-supplementary">{supplementary}</div>
          )}
        </div>
      )}
    </article>
  );
}

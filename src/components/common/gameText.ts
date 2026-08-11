import { resourceLabels, resources } from "../../data/resources";
import { burdenResolutionResourceOptions } from "../../data/contentRules";
import type {
  EncounterData,
  ResourceCost,
  Season,
  SeasonEffectText,
  TileCategory
} from "../../engine/types";

const seasonKeys: Record<Season, keyof SeasonEffectText> = {
  1: "season1",
  2: "season2",
  3: "season3"
};

export function getSeasonText(text: SeasonEffectText, season: Season): string {
  return text[seasonKeys[season]];
}

export function formatCost(cost: ResourceCost): string {
  const parts = resources
    .filter((resource) => cost[resource] > 0)
    .map((resource) => `${cost[resource]} ${resourceLabels[resource]}`);

  return parts.length ? parts.join(", ") : "Free";
}

export function formatCategory(category: TileCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function getEncounterTypeLabel(card: EncounterData | undefined): string {
  if (!card) return "Encounter";
  if (card.type === "goldenBoon") return "Golden Boon";
  return card.type.charAt(0).toUpperCase() + card.type.slice(1);
}

export function getBurdenResolutionCurrentText(
  card: EncounterData | undefined,
  season?: Season
): string | null {
  if (!card || card.type !== "burden" || !card.resolutionText || !season) {
    return null;
  }

  if (card.resolutions) return getSeasonText(card.resolutions, season);

  const choices = burdenResolutionResourceOptions[card.id];
  if (!choices?.length) return null;
  const resourceText = choices.length === 1
    ? resourceLabels[choices[0]]
    : choices.map((resource) => resourceLabels[resource]).join(" and/or ");
  return `Spend 1 Action and pay ${season * 2} ${resourceText}. Then discard.`;
}

export function getBurdenResolutionFullText(
  card: EncounterData | undefined
): string | null {
  if (!card || card.type !== "burden") return null;
  if (card.resolutions) {
    return [1, 2, 3]
      .map((season) => `Season ${season}: ${getSeasonText(card.resolutions!, season as Season)}`)
      .join(" ");
  }
  return card.resolutionText ?? null;
}

export function getBoonLifecycleText(
  card: EncounterData | undefined,
  season?: Season
): string | null {
  if (!card || card.type !== "boon") return null;
  if (season && card.lifecycles) return getSeasonText(card.lifecycles, season);
  return card.lifecycle;
}

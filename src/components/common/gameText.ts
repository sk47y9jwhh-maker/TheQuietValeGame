import { resourceLabels, resources } from "../../data/resources";
import { coreTileById, specialTileById } from "../../data/tiles";
import { burdenResolutionResources } from "../../data/contentRules";
import type { EncounterData, ResourceCost, Season, TileCategory } from "../../engine/types";

export function formatCost(cost: ResourceCost): string {
  const parts = resources
    .filter((resource) => cost[resource] > 0)
    .map((resource) => `${cost[resource]} ${resourceLabels[resource]}`);

  return parts.length ? parts.join(", ") : "Free";
}

export function formatCategory(category: TileCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function getTileRuleText(tileId: string, side: "basic" | "upgraded" | "special"): string {
  const coreTile = coreTileById[tileId];
  if (coreTile) {
    return side === "upgraded" ? coreTile.upgraded.effectText : coreTile.basic.effectText;
  }

  return specialTileById[tileId]?.effectText ?? "";
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

  const resource = burdenResolutionResources[card.id];
  if (!resource) return null;
  return `Spend 1 Action and pay ${season * 2} ${resourceLabels[resource]}. Then discard.`;
}

export function getBurdenResolutionFullText(
  card: EncounterData | undefined
): string | null {
  if (!card || card.type !== "burden") return null;
  return card.resolutionText ?? null;
}

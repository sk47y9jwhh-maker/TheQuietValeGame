import { encounterById } from "../data/encounters";
import { resources } from "../data/resources";
import { getCurrentSeasonCardEffectText } from "./manualEffects";
import { applyFlexibleCostReduction, emptyCost } from "./passiveCosts";
import type {
  ActiveBoonModifier,
  BoonModifierAction,
  GameState,
  PassiveCostOption,
  ResourceCost,
  TileCategory
} from "./types";

interface BoonModifierTarget {
  action: BoonModifierAction;
  tileId?: string;
  category?: TileCategory;
  kind?: "core" | "special";
  baseCost: ResourceCost;
}

interface BoonActionPreview {
  cost: ResourceCost;
  actionCost: number;
  appliedModifierIds: string[];
}

function costTotal(cost: ResourceCost): number {
  return resources.reduce((total, resource) => total + cost[resource], 0);
}

function parseAmount(effectText: string): number | undefined {
  const costMatch =
    effectText.match(/costs?\s+(\d+)\s+fewer resource/i) ??
    effectText.match(/reduce[s]?\s+.*cost\s+by\s+(\d+)\s+resource/i);
  return costMatch ? Number(costMatch[1]) : undefined;
}

function parseAllowedCategories(effectText: string): TileCategory[] | undefined {
  const categories: TileCategory[] = [];
  if (/travel tile/i.test(effectText)) categories.push("travel");
  if (/resource tile/i.test(effectText)) categories.push("resource");
  if (/housing tile/i.test(effectText)) categories.push("housing");
  return categories.length ? categories : undefined;
}

function parseModifierActions(effectText: string): BoonModifierAction[] {
  const lower = effectText.toLowerCase();
  if (lower.includes("active burden resolved")) return ["burden"];
  if (lower.includes("arrival completed")) return ["arrival"];
  if (lower.includes("placed or upgraded") || lower.includes("place or upgrade")) {
    return ["place", "upgrade"];
  }
  if (lower.includes("upgraded")) return ["upgrade"];
  if (lower.includes("placed") || lower.includes("place the next")) return ["place"];
  return [];
}

export function createBoonModifierFromCard(
  state: GameState,
  cardId: string
): ActiveBoonModifier | null {
  const card = encounterById[cardId];
  if (!card || card.type !== "boon") return null;

  const effectText = getCurrentSeasonCardEffectText(state, cardId);
  const actions = parseModifierActions(effectText);
  const zeroAction = /0 actions/i.test(effectText);
  const amount = parseAmount(effectText);

  if (!zeroAction && amount === undefined) return null;
  if (actions.length === 0) return null;

  return {
    id: `modifier_${state.boonModifiers.length + state.log.length + 1}_${Date.now()}`,
    sourceCardId: cardId,
    sourceType: "boon",
    name: card.name,
    effectText,
    actions,
    remainingUses: 1,
    amount,
    zeroAction,
    allowedCategories: parseAllowedCategories(effectText),
    coreOnly: /core tile/i.test(effectText)
  };
}

function matchesModifier(
  modifier: ActiveBoonModifier,
  target: BoonModifierTarget
): boolean {
  if (!modifier.actions.includes(target.action)) return false;
  if (modifier.coreOnly && target.kind !== "core") return false;
  if (
    modifier.allowedTileIds &&
    (!target.tileId || !modifier.allowedTileIds.includes(target.tileId))
  ) {
    return false;
  }
  if (
    modifier.allowedCategories &&
    (!target.category || !modifier.allowedCategories.includes(target.category))
  ) {
    return false;
  }
  return true;
}

function selectCostModifierIds(
  modifiers: ActiveBoonModifier[],
  target: BoonModifierTarget
): string[] {
  let remainingCost = costTotal(target.baseCost);
  const selected: string[] = [];

  for (const modifier of modifiers) {
    if (remainingCost <= 0) break;
    if (!matchesModifier(modifier, target) || !modifier.amount) continue;

    selected.push(modifier.id);
    remainingCost = Math.max(0, remainingCost - modifier.amount);
  }

  return selected;
}

export function getBoonActionPreview(
  state: GameState,
  target: BoonModifierTarget
): BoonActionPreview {
  const matchingModifiers = state.boonModifiers.filter((modifier) =>
    matchesModifier(modifier, target)
  );
  const costModifierIds = selectCostModifierIds(matchingModifiers, target);
  const zeroActionModifier = matchingModifiers.find((modifier) => modifier.zeroAction);
  const totalReduction = matchingModifiers
    .filter((modifier) => costModifierIds.includes(modifier.id))
    .reduce((total, modifier) => total + (modifier.amount ?? 0), 0);
  const cost =
    totalReduction > 0
      ? applyFlexibleCostReduction(target.baseCost, state.warehouse, totalReduction)
      : target.baseCost;

  return {
    cost,
    actionCost: zeroActionModifier ? 0 : 1,
    appliedModifierIds: [
      ...costModifierIds,
      ...(zeroActionModifier ? [zeroActionModifier.id] : [])
    ]
  };
}

export function getBoonModifiedCost(
  state: GameState,
  target: BoonModifierTarget
): ResourceCost {
  return getBoonActionPreview(state, target).cost;
}

export function getBoonCostOptions(
  state: GameState,
  target: BoonModifierTarget
): PassiveCostOption[] {
  const matchingModifiers = state.boonModifiers.filter((modifier) =>
    matchesModifier(modifier, target)
  );
  const costModifierIds = selectCostModifierIds(matchingModifiers, target);

  return matchingModifiers
    .filter(
      (modifier) =>
        costModifierIds.includes(modifier.id) &&
        modifier.amount !== undefined &&
        modifier.amount > 0
    )
    .flatMap((modifier) =>
      Array.from({ length: modifier.amount ?? 0 }, (_, index) => ({
        id: `boon:${modifier.id}:${index + 1}`,
        sourceTileId: modifier.id,
        sourceKind: "boon" as const,
        sourceName:
          (modifier.amount ?? 0) > 1
            ? `${modifier.name} (${index + 1}/${modifier.amount})`
            : modifier.name,
        effectText: modifier.effectText,
        kind: "discount" as const,
        cadence: "round" as const,
        amount: 1,
        resourceChoices: resources.filter((resource) => target.baseCost[resource] > 0),
        required: true
      }))
    )
    .filter((option) => option.resourceChoices.length > 0);
}

export function consumeBoonModifiers(
  state: GameState,
  modifierIds: string[]
): GameState {
  if (modifierIds.length === 0) return state;
  const consumedIds = new Set(modifierIds);

  return {
    ...state,
    boonModifiers: state.boonModifiers.flatMap((modifier) => {
      if (!consumedIds.has(modifier.id)) return [modifier];
      const remainingUses = modifier.remainingUses - 1;
      return remainingUses > 0 ? [{ ...modifier, remainingUses }] : [];
    })
  };
}

export function getEmptyBoonPreview(): BoonActionPreview {
  return { cost: emptyCost(), actionCost: 1, appliedModifierIds: [] };
}

import { encounterById } from "../data/encounters";
import { getEffectRule } from "../data/effectRules";
import { resources } from "../data/resources";
import {
  getCurrentSeasonCardEffectRuleId,
  getCurrentSeasonCardEffectText
} from "./manualEffects";
import { applyFlexibleCostReduction, emptyCost } from "./passiveCosts";
import { isPlacedTileAdjacentToCategory } from "./placedTiles";
import type {
  ActiveBoonModifier,
  BoonModifierAction,
  GameState,
  PassiveCostOption,
  PlacedTile,
  ResourceCost,
  TileCategory
} from "./types";

interface BoonModifierTarget {
  action: BoonModifierAction;
  tileId?: string;
  category?: TileCategory;
  kind?: "core" | "special";
  placedTile?: PlacedTile;
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

export function createBoonModifierFromCard(
  state: GameState,
  cardId: string
): ActiveBoonModifier | null {
  const card = encounterById[cardId];
  if (!card || card.type !== "boon") return null;

  const effectText = getCurrentSeasonCardEffectText(state, cardId);
  const modifier = getEffectRule(getCurrentSeasonCardEffectRuleId(state, cardId)).modifier;
  if (!modifier) return null;

  return {
    id: `modifier_${state.boonModifiers.length + state.log.length + 1}_${Date.now()}`,
    sourceCardId: cardId,
    sourceType: "boon",
    name: card.name,
    effectText,
    actions: modifier.actions,
    remainingUses:
      modifier.duration === "round" ? Number.MAX_SAFE_INTEGER : 1,
    amount: modifier.amount,
    zeroAction: modifier.zeroAction,
    zeroResourceCost: modifier.zeroResourceCost,
    allowedCategories: modifier.allowedCategories,
    allowedCategoriesByAction: modifier.allowedCategoriesByAction,
    allowedTileIds: modifier.allowedTileIds,
    requiresAdjacentCategories: modifier.requiresAdjacentCategories,
    coreOnly: modifier.coreOnly,
    expiresAfterRound:
      modifier.duration === "round" ? state.round : undefined,
    productionGain: modifier.productionGain,
    followUpRuleId: modifier.productionGain?.choice
      ? `${getCurrentSeasonCardEffectRuleId(state, cardId)}:production`
      : undefined,
    refreshPassiveUse: modifier.refreshPassiveUse,
    supportActionTile: modifier.supportActionTile,
    postActionRuleId: modifier.postActionRuleId,
    postActionRequiresAdjacentCategories:
      modifier.postActionRequiresAdjacentCategories,
    postActionRequiresAdjacentTerrain: modifier.postActionRequiresAdjacentTerrain
  };
}

function matchesModifier(
  state: GameState,
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
  const actionCategories = modifier.allowedCategoriesByAction?.[target.action];
  if (
    actionCategories &&
    (!target.category || !actionCategories.includes(target.category))
  ) {
    return false;
  }
  if (
    modifier.requiresAdjacentCategories?.length &&
    (!target.placedTile ||
      modifier.requiresAdjacentCategories.some(
        (category) =>
          !isPlacedTileAdjacentToCategory(
            target.placedTile!,
            state.map.placedTiles,
            category,
            { includeOverstrained: true }
          )
      ))
  ) {
    return false;
  }
  return true;
}

function selectCostModifierIds(
  state: GameState,
  modifiers: ActiveBoonModifier[],
  target: BoonModifierTarget
): string[] {
  let remainingCost = costTotal(target.baseCost);
  const selected: string[] = [];

  for (const modifier of modifiers) {
    if (remainingCost <= 0) break;
    if (!matchesModifier(state, modifier, target) || !modifier.amount) continue;

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
    matchesModifier(state, modifier, target)
  );
  const costModifierIds = selectCostModifierIds(state, matchingModifiers, target);
  const zeroActionModifier = matchingModifiers.find((modifier) => modifier.zeroAction);
  const zeroResourceModifier = matchingModifiers.find(
    (modifier) => modifier.zeroResourceCost
  );
  const totalReduction = matchingModifiers
    .filter((modifier) => costModifierIds.includes(modifier.id))
    .reduce((total, modifier) => total + (modifier.amount ?? 0), 0);
  const cost = zeroResourceModifier
    ? emptyCost()
    : totalReduction > 0
      ? applyFlexibleCostReduction(target.baseCost, state.warehouse, totalReduction)
      : target.baseCost;

  const effectOnlyModifierIds = matchingModifiers
    .filter(
      (modifier) =>
        modifier.supportActionTile ||
        modifier.postActionRuleId
    )
    .map((modifier) => modifier.id);

  return {
    cost,
    actionCost: zeroActionModifier ? 0 : 1,
    appliedModifierIds: [
      ...costModifierIds,
      ...(zeroActionModifier ? [zeroActionModifier.id] : []),
      ...(zeroResourceModifier ? [zeroResourceModifier.id] : []),
      ...effectOnlyModifierIds
    ].filter((id, index, ids) => ids.indexOf(id) === index)
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
    matchesModifier(state, modifier, target)
  );
  const costModifierIds = selectCostModifierIds(state, matchingModifiers, target);

  const reductionOptions = matchingModifiers
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

  const zeroOptions: PassiveCostOption[] = matchingModifiers
    .filter((modifier) => modifier.zeroResourceCost)
    .map((modifier) => ({
      id: `boon:${modifier.id}:zero`,
      sourceTileId: modifier.id,
      sourceKind: "boon" as const,
      sourceName: modifier.name,
      effectText: modifier.effectText,
      kind: "zero" as const,
      cadence: "round" as const,
      required: true
    }));

  return [...reductionOptions, ...zeroOptions];
}

export function getMatchingBoonModifiers(
  state: GameState,
  target: BoonModifierTarget
): ActiveBoonModifier[] {
  return state.boonModifiers.filter((modifier) =>
    matchesModifier(state, modifier, target)
  );
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

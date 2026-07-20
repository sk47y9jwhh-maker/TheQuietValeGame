import { effectRulesById, getEffectRule } from "../data/effectRules";
import type { EffectRule, TileTargetRule } from "./effectRuleTypes";
import type { BoonModifierAction, TileCategory } from "./types";

export type EffectSemanticTag =
  | "support"
  | "strain"
  | "strain_relief"
  | "burden_control"
  | "arrival_time"
  | "resource_conversion"
  | "resource_loss"
  | "upgrade_value"
  | "travel_value"
  | "housing_value"
  | "merchant_value"
  | "crafting_value"
  | "action_tempo"
  | "adjacency_punish";

function visit(rule: EffectRule, predicate: (candidate: EffectRule) => boolean): boolean {
  return predicate(rule) || Boolean(rule.fallback && visit(rule.fallback.rule, predicate));
}

function visitTargets(
  target: TileTargetRule | undefined,
  predicate: (candidate: TileTargetRule) => boolean
): boolean {
  if (!target) return false;
  return predicate(target) || Boolean(target.anyOf?.some((candidate) => visitTargets(candidate, predicate)));
}

export function effectRuleMatches(
  ruleOrId: EffectRule | string | undefined,
  predicate: (candidate: EffectRule) => boolean
): boolean {
  const rule = typeof ruleOrId === "object" ? ruleOrId : getEffectRule(ruleOrId);
  return visit(rule, predicate);
}

export function hasStructuredEffectRule(ruleId: string): boolean {
  return Boolean(effectRulesById[ruleId]);
}

export function effectRuleTargetsCategory(
  ruleOrId: EffectRule | string | undefined,
  category: TileCategory
): boolean {
  return effectRuleMatches(ruleOrId, (rule) =>
    visitTargets(rule.target, (target) => Boolean(target.categories?.includes(category))) ||
    visitTargets(rule.strainCascade?.anchorTarget, (target) => Boolean(target.categories?.includes(category))) ||
    visitTargets(rule.strainCascade?.spreadTarget, (target) => Boolean(target.categories?.includes(category))) ||
    (typeof rule.supportTarget === "object" &&
      visitTargets(rule.supportTarget, (target) => Boolean(target.categories?.includes(category)))) ||
    (rule.supportTarget === "housingAdjacentToPrimary" && category === "housing") ||
    Boolean(rule.modifier?.allowedCategories?.includes(category))
  );
}

export function effectRuleUsesAction(
  ruleOrId: EffectRule | string | undefined,
  action: BoonModifierAction
): boolean {
  return effectRuleMatches(ruleOrId, (rule) => Boolean(rule.modifier?.actions.includes(action)));
}

export function getEffectSemanticTags(ruleOrId: EffectRule | string | undefined): EffectSemanticTag[] {
  const rule = typeof ruleOrId === "object" ? ruleOrId : getEffectRule(ruleOrId);
  const tags = new Set<EffectSemanticTag>();
  visit(rule, (candidate) => {
    if (candidate.tileAdjustment?.support) tags.add("support");
    if (candidate.tileAdjustment?.strain?.direction === "place" || candidate.strainCascade) tags.add("strain");
    if (candidate.tileAdjustment?.strain?.direction === "remove" || candidate.helpStands) tags.add("strain_relief");
    if (candidate.resolveBurden) tags.add("burden_control");
    if (candidate.timer) tags.add("arrival_time");
    if (candidate.exchangeLimit !== undefined) tags.add("resource_conversion");
    if (
      Object.values(candidate.fixedResources ?? {}).some((amount) => (amount ?? 0) < 0) ||
      candidate.alternative
    ) tags.add("resource_loss");
    if (candidate.modifier?.actions.includes("upgrade")) tags.add("upgrade_value");
    if (candidate.modifier?.zeroAction) tags.add("action_tempo");
    const targets = [
      candidate.target,
      candidate.strainCascade?.anchorTarget,
      candidate.strainCascade?.spreadTarget,
      typeof candidate.supportTarget === "object" ? candidate.supportTarget : undefined
    ];
    if (targets.some((target) => visitTargets(target, (item) => Boolean(
      item.adjacentToCategories || item.notAdjacentToCategories || item.adjacentToTerrain
    ))) || candidate.strainCascade) tags.add("adjacency_punish");
    return false;
  });
  for (const [category, tag] of [
    ["travel", "travel_value"],
    ["housing", "housing_value"],
    ["merchant", "merchant_value"],
    ["crafting", "crafting_value"]
  ] as const) {
    if (effectRuleTargetsCategory(rule, category)) tags.add(tag);
  }
  return [...tags];
}

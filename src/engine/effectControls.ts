import { resources } from "../data/resources";
import { getEffectRule } from "../data/effectRules";
import type { EffectRule } from "./effectRuleTypes";
import type { EffectControlHints, ResourceType } from "./types";

function collectResources(rule: EffectRule): ResourceType[] {
  const mentioned = new Set<ResourceType>();
  for (const resource of Object.keys(rule.fixedResources ?? {}) as ResourceType[]) mentioned.add(resource);
  for (const resource of rule.resourceGainChoice?.resources ?? []) mentioned.add(resource);
  for (const resource of rule.alternative?.resources ?? []) mentioned.add(resource);
  if (rule.exchangeLimit !== undefined || rule.helpStands) {
    for (const resource of resources) mentioned.add(resource);
  }
  if (rule.fallback) {
    for (const resource of collectResources(rule.fallback.rule)) mentioned.add(resource);
  }
  return [...mentioned];
}

function has(rule: EffectRule, predicate: (candidate: EffectRule) => boolean): boolean {
  return predicate(rule) || Boolean(rule.fallback && has(rule.fallback.rule, predicate));
}

export function describeEffectControls(ruleId: string | undefined): EffectControlHints {
  const rule = getEffectRule(ruleId);
  const broadResourceChoice = has(
    rule,
    (candidate) =>
      candidate.exchangeLimit !== undefined ||
      Boolean(candidate.helpStands) ||
      Boolean(candidate.resourceGainChoice && candidate.resourceGainChoice.resources.length > 1)
  );
  return {
    broadResourceChoice,
    hasResourceAction: broadResourceChoice || has(
      rule,
      (candidate) => Boolean(candidate.fixedResources || candidate.resourceGainChoice || candidate.alternative)
    ),
    hasExplicitResourceAlternative: has(rule, (candidate) => Boolean(candidate.alternative)),
    mentionedResources: collectResources(rule),
    timerChoice: has(rule, (candidate) => Boolean(candidate.timer)),
    tileChoice: has(
      rule,
      (candidate) => Boolean(
        candidate.target ||
        candidate.tileAdjustment ||
        candidate.strainCascade ||
        candidate.supportTarget
      )
    )
  };
}

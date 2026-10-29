import { encounterById } from "../../data/encounters";
import { systemEffectRuleId } from "../../data/effectRules";
import { canCancelPendingBurdenWithWarden } from "../../engine/gameActions";
import { describeEffectControls } from "../../engine/effectControls";
import {
  canResolvePendingEffectWithoutAdjustment,
  getAlternativeEffectRule,
  getHelpStandsRule,
  getResourceGainChoiceRule,
  getStrainCascadeRule,
  getTimerAdjustmentRule,
  getValidEffectStrainTargets,
  hasEffectAdjustment
} from "../../engine/manualEffects";
import type { GameState, PendingEffectState } from "../../engine/types";

/**
 * True only when the existing resolution screen would offer nothing but an
 * "Acknowledge" button: no suggested change, no player choice, no skip, no
 * Warden response. Resolving it with an empty adjustment is exactly what that
 * button does, so no rule changes.
 */
export function isAutomaticEffect(state: GameState, effect: PendingEffectState): boolean {
  return isAcknowledgementOnly(state, effect) || isFixedResourceChange(state, effect);
}

function hasNoPlayerOptions(state: GameState, effect: PendingEffectState): boolean {
  if (effect.requiresManualChoice) return false;
  if (effect.canSkip) return false;
  if (canCancelPendingBurdenWithWarden(state).ok) return false;
  if (effect.allowStewardMovementPlayerId || effect.allowTemporaryReachPlayerId) return false;
  if (effect.resourceExchangeLimit !== undefined || effect.allowRootWeaversPreventionTileId) return false;
  if (effect.allowBurdenIgnore || effect.allowBurdenResolve || effect.allowWardenRelief) return false;
  if (effect.targetCardManualChoice) return false;
  return true;
}

function isAcknowledgementOnly(state: GameState, effect: PendingEffectState): boolean {
  if (!hasNoPlayerOptions(state, effect)) return false;
  if (hasEffectAdjustment(effect.suggestedAdjustment ?? {})) return false;
  // A plain notice, such as "Arrival is now in play with 3 timer tokens".
  if (effect.ruleId === systemEffectRuleId("acknowledge")) return true;
  return canResolvePendingEffectWithoutAdjustment(state, effect);
}

/**
 * A printed, fixed gain or loss of resources with nothing else attached, such
 * as "If none, lose 1 Wood". The resolution screen would show it with only an
 * Apply button; the table applies it and says what happened.
 */
function isFixedResourceChange(state: GameState, effect: PendingEffectState): boolean {
  if (!hasNoPlayerOptions(state, effect)) return false;
  const suggested = effect.suggestedAdjustment;
  if (!suggested?.resourceDeltas || !Object.values(suggested.resourceDeltas).some((delta) => delta)) return false;
  const onlyResources = !hasEffectAdjustment({ ...suggested, resourceDeltas: {} });
  if (!onlyResources) return false;
  const hints = effect.controlHints ?? describeEffectControls(effect.ruleId);
  if (hints.broadResourceChoice || hints.hasExplicitResourceAlternative || hints.timerChoice) return false;
  const sourceTile = effect.sourceType === "tile" && effect.sourceId ? state.map.placedTiles.find((tile) => tile.instanceId === effect.sourceId) : undefined;
  // A printed tile choice only matters when a legal tile exists; otherwise the
  // card's own "If none" fallback is what applies.
  if (hints.tileChoice && getValidEffectStrainTargets(state, effect.ruleId, sourceTile).length > 0) return false;
  return !getAlternativeEffectRule(state, effect.ruleId, sourceTile)
    && !getResourceGainChoiceRule(state, effect.ruleId, sourceTile)
    && !getTimerAdjustmentRule(state, effect.ruleId, sourceTile)
    && !getStrainCascadeRule(state, effect.ruleId, sourceTile)
    && !getHelpStandsRule(state, effect.ruleId);
}

/** One plain sentence for the notice, or nothing for bookkeeping steps. */
export function describeAutomaticStep(effect: PendingEffectState): string | null {
  const card = effect.sourceId ? encounterById[effect.sourceId] : undefined;
  const deltas = Object.entries(effect.suggestedAdjustment?.resourceDeltas ?? {}).filter(([, delta]) => delta);
  if (deltas.length) {
    const change = deltas.map(([resource, delta]) => `${delta! > 0 ? "gain" : "lose"} ${Math.abs(delta!)} ${resource[0].toUpperCase()}${resource.slice(1)}`).join(" and ");
    return `${card?.name ?? effect.sourceName}: ${change}.`;
  }
  if (card?.type === "arrival" && /unlock|complete/i.test(`${effect.title} ${effect.effectText}`)) return `${card.name} welcomed.`;
  if (card?.type === "arrival") return `${card.name} arrives with 3 timers.`;
  if (card?.type === "burden") return `${card.name}: no tile is affected.`;
  if (card?.type === "boon") return `${card.name}: nothing to apply right now.`;
  return effect.resolutionLogMessage ?? null;
}

/** Cards that reached the table during a reveal, in reveal order. */
export function revealedCardIds(before: GameState, after: GameState): { id: string; name: string }[] {
  const seen = new Set([
    ...before.encounters.activeArrivals.map((arrival) => arrival.cardId),
    ...before.encounters.activeBurdens,
    ...before.encounters.faceUpBoons.map((boon) => boon.cardId),
    ...before.encounters.discardPile
  ]);
  const revealed = before.encounters.deck.filter((cardId) => !after.encounters.deck.includes(cardId));
  const fromPending = after.pendingEffects.map((effect) => effect.sourceId).filter((id): id is string => Boolean(id && encounterById[id]));
  const ids = [...new Set([...revealed, ...fromPending])].filter((id) => !seen.has(id));
  return ids.map((id) => ({ id, name: encounterById[id]?.name ?? id }));
}

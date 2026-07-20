import {
  Check,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShieldOff,
  TimerReset,
  X
} from "lucide-react";
import { encounterById } from "../../data/encounters";
import {
  getEffectRule,
  neighbourlySupportEffectRuleId
} from "../../data/effectRules";
import { resourceLabels, resources } from "../../data/resources";
import {
  describeTargetCard,
  targetCardById,
  targetCardFilterLabels,
  targetCardRulesText
} from "../../data/targetCards";
import {
  getBurdenResolutionCurrentText,
  getEncounterTypeLabel
} from "../common/gameText";
import {
  getEffectSupportTargets,
  getAlternativeEffectRule,
  getHelpStandsRule,
  getResourceGainChoiceRule,
  getStrainCascadeAnchorTargets,
  getStrainCascadeRule,
  getStrainCascadeSpreadTargets,
  getTileAdjustmentRule,
  getValidEffectStrainTargets,
  getTimerAdjustmentRule,
  canResolvePendingEffectWithoutAdjustment,
  hasWardenReliefTarget,
  hasEffectAdjustment,
  isResourceExchangeAdjustmentValid,
  isAlternativeEffectAdjustmentValid,
  isResourceGainChoiceAdjustmentValid,
  isPendingEffectAdjustmentValid,
  isTileAdjustmentValid,
  isWardenReliefAdjustmentValid,
  isTimerAdjustmentValid
} from "../../engine/manualEffects";
import { describeEffectControls } from "../../engine/effectControls";
import { getStrainPlacementCapacity } from "../../engine/strainRules";
import { getNeighbourlySupportClusters } from "../../engine/supportRules";
import { mapCells, terrainLabels } from "../../data/map";
import { selectEncounterName, selectTileName } from "../../engine/selectors";
import type {
  EffectAdjustment,
  GameState,
  PendingEffectState,
  ResourceType
} from "../../engine/types";
import { useEffect, useMemo, useState } from "react";

interface EffectPromptProps {
  state: GameState;
  effect: PendingEffectState;
  onApply: (adjustment: EffectAdjustment) => void;
  onSkip?: () => void;
  canCancelWithWarden?: boolean;
  onCancelWithWarden?: () => void;
}

function emptyResourceDeltas(): Record<ResourceType, number> {
  return {
    wood: 0,
    stone: 0,
    metal: 0,
    food: 0,
    herbs: 0,
    goods: 0
  };
}

function normalizeResourceDeltas(
  adjustment: EffectAdjustment | undefined
): Record<ResourceType, number> {
  const next = emptyResourceDeltas();
  for (const resource of resources) {
    next[resource] = adjustment?.resourceDeltas?.[resource] ?? 0;
  }
  return next;
}

const targetDirectionArrows = {
  NE: "↗",
  E: "→",
  SE: "↘",
  SW: "↙",
  W: "←",
  NW: "↖"
} as const;

export function EffectPrompt({
  state,
  effect,
  onApply,
  onSkip,
  canCancelWithWarden,
  onCancelWithWarden
}: EffectPromptProps) {
  const helpStandsRule = getHelpStandsRule(state, effect.ruleId);
  const [resourceDeltas, setResourceDeltas] = useState(
    normalizeResourceDeltas(effect.suggestedAdjustment)
  );
  const [arrivalTimerDeltas, setArrivalTimerDeltas] = useState<Record<string, number>>(
    effect.suggestedAdjustment?.arrivalTimerDeltas ?? {}
  );
  const [tileStrainDeltas, setTileStrainDeltas] = useState<Record<string, number>>(
    helpStandsRule?.tileStrainDeltas ??
      effect.suggestedAdjustment?.tileStrainDeltas ??
      {}
  );
  const [strainCascadeAnchorTileId, setStrainCascadeAnchorTileId] = useState<
    string | undefined
  >(effect.suggestedAdjustment?.strainCascadeAnchorTileId);
  const [supportTileIds, setSupportTileIds] = useState<string[]>(
    effect.suggestedAdjustment?.supportTileIds ?? []
  );
  const [stewardHexUpdates, setStewardHexUpdates] = useState<Record<string, string>>(
    effect.suggestedAdjustment?.stewardHexUpdates ?? {}
  );
  const [temporaryReachHexUpdates, setTemporaryReachHexUpdates] = useState<
    Record<string, string>
  >(effect.suggestedAdjustment?.temporaryReachHexUpdates ?? {});
  const [ignoredBurdenIds, setIgnoredBurdenIds] = useState<string[]>(
    effect.suggestedAdjustment?.ignoredBurdenIds ?? []
  );
  const [resolvedBurdenIds, setResolvedBurdenIds] = useState<string[]>(
    effect.suggestedAdjustment?.resolvedBurdenIds ?? []
  );

  useEffect(() => {
    setResourceDeltas(normalizeResourceDeltas(effect.suggestedAdjustment));
    setArrivalTimerDeltas(effect.suggestedAdjustment?.arrivalTimerDeltas ?? {});
    setTileStrainDeltas(
      getHelpStandsRule(state, effect.ruleId)?.tileStrainDeltas ??
        effect.suggestedAdjustment?.tileStrainDeltas ??
        {}
    );
    setStrainCascadeAnchorTileId(
      effect.suggestedAdjustment?.strainCascadeAnchorTileId
    );
    setSupportTileIds(effect.suggestedAdjustment?.supportTileIds ?? []);
    setStewardHexUpdates(effect.suggestedAdjustment?.stewardHexUpdates ?? {});
    setTemporaryReachHexUpdates(
      effect.suggestedAdjustment?.temporaryReachHexUpdates ?? {}
    );
    setIgnoredBurdenIds(effect.suggestedAdjustment?.ignoredBurdenIds ?? []);
    setResolvedBurdenIds(effect.suggestedAdjustment?.resolvedBurdenIds ?? []);
  }, [effect.id, effect.suggestedAdjustment]);

  const adjustment = useMemo(
    () => ({
        resourceDeltas,
        arrivalTimerDeltas,
        tileStrainDeltas,
        strainCascadeAnchorTileId,
        supportTileIds,
        stewardHexUpdates,
        temporaryReachHexUpdates,
        ignoredBurdenIds,
        resolvedBurdenIds
      }),
    [
      arrivalTimerDeltas,
      effect.suggestedAdjustment,
      ignoredBurdenIds,
      resolvedBurdenIds,
      resourceDeltas,
      strainCascadeAnchorTileId,
      stewardHexUpdates,
      temporaryReachHexUpdates,
      supportTileIds,
      tileStrainDeltas
    ]
  );
  const exchangeInvalid =
    effect.resourceExchangeLimit !== undefined &&
    !isResourceExchangeAdjustmentValid(
      state,
      effect.ruleId,
      { resourceDeltas },
      effect.resourceExchangeLimit,
      effect.resourceExchangeOptional
    );
  const burdenResolveInvalid =
    effect.allowBurdenResolve &&
    state.encounters.activeBurdens.length > 0 &&
    resolvedBurdenIds.length === 0;
  const wardenReliefHasNoTarget =
    Boolean(effect.allowWardenRelief) && !hasWardenReliefTarget(state);
  const wardenReliefInvalid =
    effect.allowWardenRelief && !isWardenReliefAdjustmentValid(state, adjustment);
  const timerInvalid = !isTimerAdjustmentValid(
    state,
    effect.ruleId,
    arrivalTimerDeltas
  );
  const hasChanges = hasEffectAdjustment(adjustment);
  const isNoChoiceAcknowledgement =
    !hasChanges && canResolvePendingEffectWithoutAdjustment(state, effect);
  const sourceCard =
    effect.sourceType === "card" && effect.sourceId
      ? encounterById[effect.sourceId]
      : undefined;
  const sourceCardToneClass = sourceCard ? `card-${sourceCard.type}` : "";
  const flavorText = sourceCard?.flavorText;
  const sourceTile =
    effect.sourceType === "tile" && effect.sourceId
      ? state.map.placedTiles.find((tile) => tile.instanceId === effect.sourceId)
      : undefined;
  const controlHints = effect.controlHints ?? describeEffectControls(effect.ruleId);
  const alternativeEffectRule = getAlternativeEffectRule(
    state,
    effect.ruleId,
    sourceTile
  );
  const resourceGainChoiceRule = getResourceGainChoiceRule(
    state,
    effect.ruleId,
    sourceTile
  );
  const timerRule = getTimerAdjustmentRule(state, effect.ruleId, sourceTile);
  const strainCascadeRule = useMemo(
    () => getStrainCascadeRule(state, effect.ruleId, sourceTile),
    [effect.ruleId, sourceTile, state]
  );
  const strainCascadeAnchorTargets = useMemo(
    () => getStrainCascadeAnchorTargets(state, effect.ruleId, sourceTile),
    [effect.ruleId, sourceTile, state]
  );
  const strainCascadeSpreadTargets = useMemo(
    () => getStrainCascadeSpreadTargets(
      state,
      effect.ruleId,
      strainCascadeAnchorTileId,
      sourceTile
    ),
    [effect.ruleId, sourceTile, state, strainCascadeAnchorTileId]
  );
  const requiredCascadeSpreadTargets = strainCascadeRule
    ? Math.min(
        strainCascadeRule.maxSpreadTargets,
        strainCascadeSpreadTargets.length
      )
    : 0;
  const cascadeSpreadTargetIds = new Set(
    strainCascadeSpreadTargets.map((tile) => tile.instanceId)
  );
  const selectedCascadeSpreadIds = Object.entries(tileStrainDeltas)
    .filter(
      ([tileId, delta]) =>
        cascadeSpreadTargetIds.has(tileId) &&
        delta === strainCascadeRule?.spreadStrain
    )
    .map(([tileId]) => tileId);
  const tileControlData = useMemo(() => {
    const suggestedStrainIds = Object.keys(effect.suggestedAdjustment?.tileStrainDeltas ?? {});
    const suggestedSupportIds = effect.suggestedAdjustment?.supportTileIds ?? [];
    const suggestedTileIds = new Set([...suggestedStrainIds, ...suggestedSupportIds]);
    const lockedTargetIds = effect.targetCardPrepared
      ? new Set(effect.targetCardTargetTileIds ?? [])
      : null;
    const legalTargets = getValidEffectStrainTargets(
      state,
      effect.ruleId,
      sourceTile
    ).filter(
      (tile) => !lockedTargetIds || lockedTargetIds.has(tile.instanceId)
    );
    const supportTargets = getEffectSupportTargets(state, effect.ruleId, sourceTile);
    const legalTargetIds = new Set(legalTargets.map((tile) => tile.instanceId));
    const supportTargetIds = new Set(supportTargets.map((tile) => tile.instanceId));
    for (const tileId of suggestedStrainIds) legalTargetIds.add(tileId);
    for (const tileId of suggestedSupportIds) supportTargetIds.add(tileId);
    const visibleTargetIds = new Set([...legalTargetIds, ...supportTargetIds]);
    const suggestedTargets = state.map.placedTiles.filter(
      (tile) =>
        suggestedTileIds.has(tile.instanceId) && !visibleTargetIds.has(tile.instanceId)
    );

    return {
      targets: [
        ...legalTargets,
        ...supportTargets.filter((tile) => !legalTargetIds.has(tile.instanceId)),
        ...suggestedTargets
      ],
      strainTargetIds: legalTargetIds,
      supportTargetIds
    };
  }, [effect.ruleId, effect.suggestedAdjustment, sourceTile, state]);
  const tileControlTargets = tileControlData.targets;
  const tileAdjustmentRule = useMemo(
    () => getTileAdjustmentRule(state, effect.ruleId, sourceTile),
    [effect.ruleId, sourceTile, state]
  );
  const isNeighbourlySupport = effect.ruleId === neighbourlySupportEffectRuleId;
  const neighbourlySupportClusters = useMemo(
    () => (isNeighbourlySupport ? getNeighbourlySupportClusters(state) : []),
    [isNeighbourlySupport, state]
  );
  const neighbourlyClusterByTileId = useMemo(
    () =>
      new Map(
        neighbourlySupportClusters.flatMap((cluster, index) =>
          cluster.eligibleTileIds.map(
            (tileId) =>
              [
                tileId,
                {
                  number: index + 1,
                  required: cluster.requiredSelectionCount
                }
              ] as const
          )
        )
      ),
    [neighbourlySupportClusters]
  );
  const canAdjustTileStrain = Boolean(tileAdjustmentRule.strain);
  const canToggleTileSupport = Boolean(tileAdjustmentRule.support);
  const selectedStrainEntries = Object.entries(tileStrainDeltas).filter(
    ([, delta]) => delta !== 0
  );
  const selectedStrainTotal = selectedStrainEntries.reduce(
    (total, [, delta]) => total + Math.abs(delta),
    0
  );
  const strainSelectionLabel = tileAdjustmentRule.strain
    ? `${tileAdjustmentRule.strain.direction === "place" ? "Place" : "Remove"} ${
        tileAdjustmentRule.strain.requiredTotal !== undefined
          ? `${tileAdjustmentRule.strain.requiredTotal} Strain where possible`
          : `up to ${tileAdjustmentRule.strain.maxTotal} Strain`
      }: ${selectedStrainTotal} selected`
    : "";
  const hasResourceSuggestion = resources.some(
    (resource) => (effect.suggestedAdjustment?.resourceDeltas?.[resource] ?? 0) !== 0
  );
  const broadResourceChoice =
    effect.resourceExchangeLimit !== undefined || controlHints.broadResourceChoice;
  const visibleResources = alternativeEffectRule
    ? alternativeEffectRule.resources
    : resourceGainChoiceRule
    ? resourceGainChoiceRule.resources
    : broadResourceChoice
    ? resources
    : resources.filter(
        (resource) =>
          controlHints.mentionedResources.includes(resource) ||
          (effect.suggestedAdjustment?.resourceDeltas?.[resource] ?? 0) !== 0
      );
  const hasEditableResourceChoice =
    Boolean(alternativeEffectRule) ||
    Boolean(resourceGainChoiceRule && resourceGainChoiceRule.amount > 0) ||
    effect.resourceExchangeLimit !== undefined ||
    broadResourceChoice ||
    controlHints.hasExplicitResourceAlternative;
  const showResourceControls =
    hasEditableResourceChoice ||
    Boolean(
      effect.requiresManualChoice && controlHints.hasResourceAction && !hasResourceSuggestion
    );
  const hasTimerSuggestion = Object.values(
    effect.suggestedAdjustment?.arrivalTimerDeltas ?? {}
  ).some((delta) => delta !== 0);
  const showTimerControls =
    state.encounters.activeArrivals.length > 0 &&
    (hasTimerSuggestion ||
      Boolean(
        effect.requiresManualChoice && controlHints.timerChoice
      ));
  const hasTileSuggestion =
    Object.values(effect.suggestedAdjustment?.tileStrainDeltas ?? {}).some(
      (delta) => delta !== 0
    ) || Boolean(effect.suggestedAdjustment?.supportTileIds?.length);
  const needsTileChoice = Boolean(effect.requiresManualChoice && controlHints.tileChoice);
  const showTileControls =
    !helpStandsRule &&
    !strainCascadeRule &&
    tileControlTargets.length > 0 &&
    (hasTileSuggestion || needsTileChoice);
  const showStrainCascadeControls = Boolean(
    !helpStandsRule &&
      strainCascadeRule &&
      strainCascadeAnchorTargets.length > 0 &&
      (effect.requiresManualChoice || effect.suggestedAdjustment?.strainCascadeAnchorTileId)
  );
  const tileAdjustmentInvalid =
    !effect.allowWardenRelief &&
    !(effect.targetCardPrepared
      ? isPendingEffectAdjustmentValid(state, effect, adjustment)
      : isTileAdjustmentValid(
          state,
          effect.ruleId,
          adjustment,
          sourceTile
        ));
  const alternativeEffectInvalid = !isAlternativeEffectAdjustmentValid(
    state,
    effect.ruleId,
    adjustment,
    sourceTile
  );
  const resourceGainChoiceInvalid = !isResourceGainChoiceAdjustmentValid(
    state,
    effect.ruleId,
    adjustment,
    sourceTile
  );
  const allowsResourceInsteadOfTile = Boolean(
    alternativeEffectRule?.kind === "pay_or_strain" ||
    alternativeEffectRule?.kind === "warehouse_loss_or_strain" ||
    alternativeEffectRule?.kind === "pay_total_or_strain" ||
    alternativeEffectRule?.kind === "most_stocked_loss_then_strain" ||
    resourceGainChoiceRule?.alternativeToStrainRemoval
  );
  const missingRequiredTileChoice =
    Boolean(effect.requiresManualChoice && needsTileChoice) &&
    Boolean(tileAdjustmentRule.strain || tileAdjustmentRule.support) &&
    tileControlTargets.length > 0 &&
    selectedStrainEntries.length === 0 &&
    supportTileIds.length === 0 &&
    !allowsResourceInsteadOfTile &&
    !helpStandsRule &&
    !wardenReliefHasNoTarget;
  const cannotApply = !isNoChoiceAcknowledgement && (
    Boolean(effect.requiresManualChoice && !hasChanges && !wardenReliefHasNoTarget) ||
    missingRequiredTileChoice ||
    timerInvalid ||
    exchangeInvalid ||
    alternativeEffectInvalid ||
    resourceGainChoiceInvalid ||
    Boolean(burdenResolveInvalid) ||
    Boolean(wardenReliefInvalid) ||
    tileAdjustmentInvalid
  );
  const previewItems = useMemo(() => {
    const items: string[] = [];

    for (const resource of resources) {
      const delta = adjustment.resourceDeltas?.[resource] ?? 0;
      if (delta !== 0) {
        items.push(
          `${delta > 0 ? `Gain ${delta}` : `Lose ${Math.abs(delta)}`} ${resourceLabels[resource]}`
        );
      }
    }

    for (const [cardId, delta] of Object.entries(
      adjustment.arrivalTimerDeltas ?? {}
    )) {
      if (delta !== 0) {
        items.push(
          `${selectEncounterName(cardId)}: ${delta > 0 ? "+" : ""}${delta} timer`
        );
      }
    }

    if (adjustment.strainCascadeAnchorTileId && strainCascadeRule) {
      const anchor = state.map.placedTiles.find(
        (tile) => tile.instanceId === adjustment.strainCascadeAnchorTileId
      );
      const anchorName = anchor
        ? `${selectTileName(anchor)} (${anchor.hexIds.join(", ")})`
        : adjustment.strainCascadeAnchorTileId;
      if (strainCascadeRule.anchorStrain > 0) {
        const supportWillPrevent = Boolean(
          anchor &&
            (anchor.support.passive || anchor.support.singleUse) &&
            !anchor.support.preventedThisRound
        );
        items.push(
          `${anchorName}: +${strainCascadeRule.anchorStrain} Strain${
            supportWillPrevent ? " — Supported prevents 1" : ""
          }`
        );
      } else {
        items.push(`${anchorName}: cascade anchor`);
      }
    }

    for (const [tileId, delta] of Object.entries(adjustment.tileStrainDeltas ?? {})) {
      if (delta === 0) continue;
      const tile = state.map.placedTiles.find(
        (candidate) => candidate.instanceId === tileId
      );
      const tileName = tile ? `${selectTileName(tile)} (${tile.hexIds.join(", ")})` : tileId;
      const supportWillPrevent =
        delta > 0 &&
        Boolean(
          tile &&
            (tile.support.passive || tile.support.singleUse) &&
            !tile.support.preventedThisRound
        );
      items.push(
        `${tileName}: ${delta > 0 ? "+" : ""}${delta} Strain${
          supportWillPrevent ? " — Supported prevents 1" : ""
        }`
      );
    }

    for (const tileId of adjustment.supportTileIds ?? []) {
      const tile = state.map.placedTiles.find(
        (candidate) => candidate.instanceId === tileId
      );
      items.push(
        `${tile ? `${selectTileName(tile)} (${tile.hexIds.join(", ")})` : tileId}: gains Supported`
      );
    }

    for (const cardId of adjustment.resolvedBurdenIds ?? []) {
      items.push(`Resolve ${selectEncounterName(cardId)}`);
    }
    for (const cardId of adjustment.ignoredBurdenIds ?? []) {
      items.push(`Ignore ${selectEncounterName(cardId)} this round`);
    }
    for (const [playerId, hexId] of Object.entries(adjustment.stewardHexUpdates ?? {})) {
      const player = state.players.find((candidate) => candidate.id === playerId);
      items.push(`${player?.name ?? "Steward"} moves to ${hexId}`);
    }
    for (const [playerId, hexId] of Object.entries(
      adjustment.temporaryReachHexUpdates ?? {}
    )) {
      const player = state.players.find((candidate) => candidate.id === playerId);
      items.push(`${player?.name ?? "Steward"} can reach ${hexId}`);
    }

    return items;
  }, [adjustment, state.map.placedTiles, state.players, strainCascadeRule]);
  const isPreparedPreview = !effect.requiresManualChoice && previewItems.length > 0;

  const alternativeResolvedChoices = (() => {
    if (!alternativeEffectRule) return null;
    const spent = alternativeEffectRule.resources.reduce(
      (total, resource) =>
        total + Math.max(0, -(resourceDeltas[resource] ?? 0)),
      0
    );
    if (alternativeEffectRule.kind === "pay_or_strain") {
      return spent / alternativeEffectRule.resourceStep +
        selectedStrainTotal / alternativeEffectRule.strainPerChoice;
    }
    if (alternativeEffectRule.kind === "pay_or_timer") {
      const removed = Object.values(arrivalTimerDeltas).reduce(
        (total, delta) => total + Math.max(0, -delta),
        0
      );
      return spent / alternativeEffectRule.resourceStep +
        removed / alternativeEffectRule.timerPerChoice;
    }
    return isAlternativeEffectAdjustmentValid(
      state,
      effect.ruleId,
      adjustment,
      sourceTile
    ) ? 1 : 0;
  })();
  const selectedResourceGain = resourceGainChoiceRule
    ? resourceGainChoiceRule.resources.reduce(
        (total, resource) => total + Math.max(0, resourceDeltas[resource] ?? 0),
        0
      )
    : null;

  function resourceStepFor(resource: ResourceType): number {
    if (!alternativeEffectRule?.resources.includes(resource)) return 1;
    if (alternativeEffectRule.kind === "most_stocked_loss_then_strain") {
      return state.warehouse[resource] > 0
        ? Math.min(alternativeEffectRule.resourceStep, state.warehouse[resource])
        : alternativeEffectRule.resourceStep;
    }
    return alternativeEffectRule.resourceStep;
  }

  function canAdjustResource(resource: ResourceType, delta: number): boolean {
    if (resourceGainChoiceRule) {
      const current = resourceDeltas[resource] ?? 0;
      if (delta < 0) return current > 0;
      return (selectedResourceGain ?? 0) < resourceGainChoiceRule.amount;
    }
    if (!alternativeEffectRule) return true;
    const current = resourceDeltas[resource] ?? 0;
    if (delta > 0) return current < 0;
    const next = current + delta;
    if (next < -state.warehouse[resource] || next > 0) return false;
    const maxSpend =
      alternativeEffectRule.kind === "warehouse_loss_or_strain" ||
      alternativeEffectRule.kind === "pay_total_or_strain"
        ? alternativeEffectRule.resourceStep
        : alternativeEffectRule.kind === "most_stocked_loss_then_strain"
          ? Math.min(
              alternativeEffectRule.resourceStep,
              state.warehouse[resource]
            )
          : alternativeEffectRule.resourceStep * alternativeEffectRule.requiredChoices;
    const otherSpend = alternativeEffectRule.resources.reduce(
      (total, candidate) =>
        candidate === resource
          ? total
          : total + Math.max(0, -(resourceDeltas[candidate] ?? 0)),
      0
    );
    return otherSpend + Math.max(0, -next) <= maxSpend;
  }

  function adjustResource(resource: ResourceType, delta: number) {
    setResourceDeltas((current) => {
      const exclusiveSpend =
        alternativeEffectRule?.kind === "warehouse_loss_or_strain" ||
        alternativeEffectRule?.kind === "pay_total_or_strain" ||
        alternativeEffectRule?.kind === "most_stocked_loss_then_strain";
      const next = exclusiveSpend && delta < 0
        ? emptyResourceDeltas()
        : { ...current };
      next[resource] = (next[resource] ?? 0) + delta;
      return next;
    });
    if (
      resourceGainChoiceRule?.alternativeToStrainRemoval &&
      delta > 0
    ) {
      setTileStrainDeltas({});
    }
    if (
      (alternativeEffectRule?.kind === "warehouse_loss_or_strain" ||
        alternativeEffectRule?.kind === "pay_total_or_strain") &&
      delta < 0
    ) {
      setTileStrainDeltas({});
    }
    if (
      alternativeEffectRule?.kind === "most_stocked_loss_then_strain" &&
      delta < 0 &&
      Math.abs(delta) >= alternativeEffectRule.resourceStep
    ) {
      setTileStrainDeltas({});
    }
  }

  function adjustTimer(cardId: string, delta: number) {
    setArrivalTimerDeltas((current) => ({
      ...current,
      [cardId]: getNextTimerDelta(cardId, current[cardId] ?? 0, delta, current)
    }));
  }

  function getNextTimerDelta(
    cardId: string,
    currentDelta: number,
    requestedDelta: number,
    currentDeltas: Record<string, number>
  ): number {
    if (timerRule?.direction === "remove") {
      const arrival = state.encounters.activeArrivals.find(
        (candidate) => candidate.cardId === cardId
      );
      if (!arrival) return currentDelta;
      const totalOtherRemoved = Object.entries(currentDeltas).reduce(
        (total, [candidateCardId, candidateDelta]) =>
          candidateCardId === cardId ? total : total + Math.max(0, -candidateDelta),
        0
      );
      const perArrivalLimit = alternativeEffectRule?.kind === "pay_or_timer"
        ? alternativeEffectRule.timerPerChoice
        : arrival.timerTokens;
      const maxForArrival = Math.min(arrival.timerTokens, perArrivalLimit);
      const maxForEffect = Math.max(0, (timerRule?.limit ?? 0) - totalOtherRemoved);
      return Math.min(
        0,
        Math.max(currentDelta + requestedDelta, -maxForArrival, -maxForEffect)
      );
    }
    if (timerRule?.direction !== "add") return currentDelta + requestedDelta;

    const arrival = state.encounters.activeArrivals.find(
      (candidate) => candidate.cardId === cardId
    );
    if (!arrival) return currentDelta;

    const totalOtherAdded = Object.entries(currentDeltas).reduce(
      (total, [candidateCardId, candidateDelta]) =>
        candidateCardId === cardId ? total : total + Math.max(0, candidateDelta),
      0
    );
    const maxForArrival = Math.max(0, 3 - arrival.timerTokens);
    const maxForEffect = Math.max(0, timerRule.limit - totalOtherAdded);
    return Math.max(
      0,
      Math.min(currentDelta + requestedDelta, maxForArrival, maxForEffect)
    );
  }

  function canAdjustTimer(cardId: string, requestedDelta: number): boolean {
    if (timerRule?.direction === "remove") {
      return getNextTimerDelta(
        cardId,
        arrivalTimerDeltas[cardId] ?? 0,
        requestedDelta,
        arrivalTimerDeltas
      ) !== (arrivalTimerDeltas[cardId] ?? 0);
    }
    if (timerRule?.direction !== "add") return true;

    const currentDelta = arrivalTimerDeltas[cardId] ?? 0;
    if (requestedDelta < 0) return currentDelta > 0;

    const arrival = state.encounters.activeArrivals.find(
      (candidate) => candidate.cardId === cardId
    );
    if (!arrival) return false;

    const totalAdded = Object.values(arrivalTimerDeltas).reduce(
      (total, delta) => total + Math.max(0, delta),
      0
    );
    return currentDelta < 3 - arrival.timerTokens && totalAdded < timerRule.limit;
  }

  function getNextStrainDelta(tileId: string, requestedDelta: number): number {
    const rule = tileAdjustmentRule.strain;
    if (!rule) return tileStrainDeltas[tileId] ?? 0;
    const tile = state.map.placedTiles.find(
      (candidate) => candidate.instanceId === tileId
    );
    if (!tile) return tileStrainDeltas[tileId] ?? 0;

    const currentDelta = tileStrainDeltas[tileId] ?? 0;
    const targetCardMaximum = effect.targetCardPrepared
      ? effect.targetCardPlannedStrainByTileId?.[tileId]
      : undefined;
    if (effect.targetCardPrepared && targetCardMaximum === undefined) {
      return currentDelta;
    }
    if (requestedDelta > 0 && alternativeEffectRule) {
      if (
        alternativeEffectRule.kind === "warehouse_loss_or_strain" &&
        !alternativeEffectRule.resources.some(
          (resource) => state.warehouse[resource] < alternativeEffectRule.resourceStep
        )
      ) {
        return currentDelta;
      }
      if (alternativeEffectRule.kind === "most_stocked_loss_then_strain") {
        const stocked = Math.max(
          ...alternativeEffectRule.resources.map(
            (resource) => state.warehouse[resource]
          )
        );
        const strainRequired =
          alternativeEffectRule.strainWhen === "noneLost"
            ? stocked === 0
            : stocked < alternativeEffectRule.resourceStep;
        if (!strainRequired) return currentDelta;
      }
    }
    const nextDelta = currentDelta + requestedDelta;
    if (rule.direction === "place" && nextDelta < 0) return currentDelta;
    if (rule.direction === "remove" && nextDelta > 0) return currentDelta;
    if (
      Math.abs(nextDelta) > rule.maxPerTile ||
      (targetCardMaximum !== undefined && nextDelta > targetCardMaximum)
    ) return currentDelta;
    if (rule.direction === "remove" && Math.abs(nextDelta) > tile.strain) {
      return currentDelta;
    }
    if (
      rule.direction === "place" &&
      targetCardMaximum === undefined &&
      nextDelta > getStrainPlacementCapacity(state, tile, rule.maxPerTile)
    ) {
      return currentDelta;
    }

    const otherEntries = Object.entries(tileStrainDeltas).filter(
      ([candidateId, delta]) => candidateId !== tileId && delta !== 0
    );
    const nextTargetCount = otherEntries.length + (nextDelta === 0 ? 0 : 1);
    const nextTotal =
      otherEntries.reduce((total, [, delta]) => total + Math.abs(delta), 0) +
      Math.abs(nextDelta);
    if (nextTargetCount > rule.maxTargets || nextTotal > rule.maxTotal) {
      return currentDelta;
    }
    return nextDelta;
  }

  function canAdjustStrain(tileId: string, requestedDelta: number): boolean {
    return getNextStrainDelta(tileId, requestedDelta) !== (tileStrainDeltas[tileId] ?? 0);
  }

  function adjustStrain(tileId: string, delta: number) {
    const nextDelta = getNextStrainDelta(tileId, delta);
    setTileStrainDeltas((current) => ({ ...current, [tileId]: nextDelta }));
    if (
      (alternativeEffectRule?.kind === "warehouse_loss_or_strain" ||
        alternativeEffectRule?.kind === "pay_total_or_strain") &&
      nextDelta > 0
    ) {
      setResourceDeltas(emptyResourceDeltas());
    }
    if (
      resourceGainChoiceRule?.alternativeToStrainRemoval &&
      nextDelta < 0
    ) {
      setResourceDeltas(emptyResourceDeltas());
    }
  }

  function chooseStrainCascadeAnchor(tileId: string) {
    if (tileId === strainCascadeAnchorTileId) return;
    setStrainCascadeAnchorTileId(tileId);
    setTileStrainDeltas({});
  }

  function toggleStrainCascadeSpread(tileId: string) {
    if (!strainCascadeRule || !cascadeSpreadTargetIds.has(tileId)) return;
    setTileStrainDeltas((current) => {
      const selected = current[tileId] === strainCascadeRule.spreadStrain;
      if (selected) {
        const next = { ...current };
        delete next[tileId];
        return next;
      }
      const selectedCount = Object.entries(current).filter(
        ([candidateId, delta]) =>
          cascadeSpreadTargetIds.has(candidateId) &&
          delta === strainCascadeRule.spreadStrain
      ).length;
      if (selectedCount >= requiredCascadeSpreadTargets) return current;
      return { ...current, [tileId]: strainCascadeRule.spreadStrain };
    });
  }

  function toggleSupported(tileId: string) {
    setSupportTileIds((current) => {
      if (current.includes(tileId)) {
        return current.filter((candidate) => candidate !== tileId);
      }
      if (current.length >= (tileAdjustmentRule.support?.maxTargets ?? 0)) {
        return current;
      }
      return [...current, tileId];
    });
  }

  function chooseWardenStrainRelief(tileId: string) {
    setTileStrainDeltas((current) =>
      current[tileId] === -1 ? {} : { [tileId]: -1 }
    );
    setSupportTileIds([]);
  }

  function chooseWardenSupportRelief(tileId: string) {
    setSupportTileIds((current) => (current.includes(tileId) ? [] : [tileId]));
    setTileStrainDeltas({});
  }

  function moveSteward(playerId: string, hexId: string) {
    setStewardHexUpdates((current) => ({
      ...current,
      [playerId]: hexId
    }));
  }

  function chooseTemporaryReach(playerId: string, hexId: string) {
    setTemporaryReachHexUpdates((current) => ({
      ...current,
      [playerId]: hexId
    }));
  }

  function toggleIgnoredBurden(cardId: string) {
    setIgnoredBurdenIds((current) =>
      current.includes(cardId)
        ? current.filter((candidate) => candidate !== cardId)
        : [cardId]
    );
  }

  function toggleResolvedBurden(cardId: string) {
    setResolvedBurdenIds((current) =>
      current.includes(cardId)
        ? current.filter((candidate) => candidate !== cardId)
        : [cardId]
    );
  }

  return (
    <section className={`effect-prompt ${sourceCardToneClass}`}>
      <div className="effect-heading">
        {sourceCard && (
          <span className={`encounter-type-banner ${sourceCardToneClass}`}>
            {getEncounterTypeLabel(sourceCard)}
          </span>
        )}
        <p className="eyebrow">Pending Effect</p>
        <h2>{effect.title}</h2>
        <p className="muted">{effect.sourceName}</p>
      </div>

      <div className="effect-copy">
        {flavorText && <em>{flavorText}</em>}
        <strong>{effect.effectText}</strong>
        {effect.detailText && <span>{effect.detailText}</span>}
      </div>

      {effect.targetCardPrepared && (
        <section className="target-card-resolution" aria-label="Automatic Target Card resolution">
          <div className="target-card-resolution-heading">
            <div>
              <p className="eyebrow">Automatic targeting</p>
              <h3>Target Card result</h3>
            </div>
            <span>{effect.targetCardDiagnostics?.length ?? 0} card{effect.targetCardDiagnostics?.length === 1 ? "" : "s"} drawn</span>
          </div>

          {effect.targetCardDiagnostics?.length ? (
            <div className="target-card-diagnostic-list">
              {effect.targetCardDiagnostics.map((diagnostic, index) => {
                const card = targetCardById[diagnostic.cardId];
                const description = card ? describeTargetCard(card) : null;
                const selectedTile = state.map.placedTiles.find(
                  (tile) => tile.instanceId === diagnostic.selectedTileId
                );
                return (
                  <article className="target-card-diagnostic" key={diagnostic.id}>
                    <div className="target-card-diagnostic-heading">
                      <strong>
                        Card {diagnostic.cardId} · {diagnostic.role === "primary"
                          ? "Primary"
                          : diagnostic.role === "spread"
                            ? "Linked target"
                            : `Target ${index + 1}`}
                      </strong>
                      <span className="target-card-arrow" aria-label={`${diagnostic.direction} arrow`}>
                        {targetDirectionArrows[diagnostic.direction]} {diagnostic.direction}
                      </span>
                    </div>
                    {description && (
                      <div className="target-card-preferences" aria-label="Card preferences">
                        <span>{description.tileClass}</span>
                        <span>{description.side}</span>
                        <span>{description.adjacency}</span>
                        <span>{description.strain}</span>
                      </div>
                    )}
                    <ol className="target-card-filter-results">
                      {diagnostic.filters.map((filter) => (
                        <li className={filter.applied ? "applied" : "ignored"} key={filter.filter}>
                          <span>{targetCardFilterLabels[filter.filter]}: {filter.preference}</span>
                          <strong>{filter.applied ? "Applied" : "Ignored"}</strong>
                          <small>{filter.beforeCount} → {filter.afterCount} tiles</small>
                        </li>
                      ))}
                    </ol>
                    <div className="target-card-selection-result">
                      <strong>
                        Selected: {selectedTile ? selectTileName(selectedTile) : diagnostic.selectedTileId}
                      </strong>
                      <span>{diagnostic.selectedHexIds.join(", ")}</span>
                      {diagnostic.plannedStrain !== undefined && diagnostic.plannedStrain > 0 && (
                        <span>Receives {diagnostic.plannedStrain} Strain</span>
                      )}
                      <small>
                        Started with {diagnostic.originalEligibleCount} eligible tile{diagnostic.originalEligibleCount === 1 ? "" : "s"}. {diagnostic.directionRequired
                          ? `Direction was required and left ${diagnostic.directionCandidateCount}.`
                          : "Direction was not required."}
                        {diagnostic.coordinateFallbackUsed ? " Map-coordinate fallback resolved the exact tie." : ""}
                        {diagnostic.printedFallbackUsed ? " The effect’s printed fallback supplied this eligible pool." : ""}
                      </small>
                      {diagnostic.supportedWillPrevent && (
                        <small className="target-card-prevention">Supported will prevent 1 Strain after selection.</small>
                      )}
                      {diagnostic.goldenGardenWillPrevent && (
                        <small className="target-card-prevention">The Golden Garden will prevent 1 Strain after selection.</small>
                      )}
                      {diagnostic.alternatePrimaryWouldComplete && (
                        <small className="target-card-warning">Another primary could have completed every linked target; the card-selected primary is retained.</small>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">No eligible Strain target was available, so no Target Card was drawn.</p>
          )}

          <details className="target-card-rules">
            <summary>How automatic targeting works</summary>
            <p>{targetCardRulesText}</p>
          </details>
        </section>
      )}

      {canCancelWithWarden && onCancelWithWarden && (
        <button
          className="secondary-action"
          onClick={onCancelWithWarden}
          type="button"
        >
          <ShieldOff size={18} />
          Use Warden Power: prevent this effect
        </button>
      )}

      <div className="effect-command-bar">
        <span className={cannotApply ? "effect-choice-waiting" : "effect-choice-ready"}>
          {cannotApply
            ? "Complete a valid choice"
            : wardenReliefHasNoTarget
              ? "No eligible tile — continue"
            : previewItems.length > 0
              ? "Will apply"
              : "Ready to continue"}
        </span>
        {previewItems.length > 0 && (
          <div className="effect-preview-list" aria-label="Effect preview">
            {previewItems.map((item, index) => (
              <span className="effect-preview-item" key={`${item}_${index}`}>
                {item}
              </span>
            ))}
          </div>
        )}
        <div className="effect-actions">
          {effect.canSkip && onSkip && (
            <button className="secondary-action" onClick={onSkip} type="button">
              <X size={18} />
              {effect.skipLabel ?? "Skip"}
            </button>
          )}
          <button
            className="primary-action"
            disabled={cannotApply}
            onClick={() => onApply(adjustment)}
            type="button"
          >
            <Check size={18} />
            {wardenReliefHasNoTarget
              ? "Continue"
              : effect.confirmLabel ?? "Apply Effect"}
          </button>
        </div>
      </div>

      {showResourceControls && !isPreparedPreview && (
      <section className="effect-control-group">
        <div className="effect-control-heading">
          <h3>Resources</h3>
          {alternativeEffectRule && alternativeResolvedChoices !== null && (
            <span>
              {alternativeEffectRule.kind === "warehouse_loss_or_strain" ||
               alternativeEffectRule.kind === "pay_total_or_strain" ||
               alternativeEffectRule.kind === "most_stocked_loss_then_strain"
                ? `${alternativeResolvedChoices}/1 outcome selected`
                : `${alternativeResolvedChoices}/${alternativeEffectRule.requiredChoices} outcomes selected`}
            </span>
          )}
          {resourceGainChoiceRule && selectedResourceGain !== null && (
            <span>
              {resourceGainChoiceRule.alternativeToStrainRemoval && selectedStrainTotal > 0
                ? "Strain removal selected"
                : `${selectedResourceGain}/${resourceGainChoiceRule.amount} resources selected`}
            </span>
          )}
        </div>
        <div className="effect-grid">
          {(visibleResources.length > 0 ? visibleResources : resources).map((resource) => (
            <div className="effect-row" key={resource}>
              <span>
                {resourceLabels[resource]} {state.warehouse[resource]}
              </span>
              <div className="stepper">
                <button
                  aria-label={
                    resourceGainChoiceRule
                      ? `Remove ${resourceStepFor(resource)} ${resourceLabels[resource]} selection`
                      : alternativeEffectRule
                        ? `Spend ${resourceStepFor(resource)} ${resourceLabels[resource]}`
                        : `Decrease ${resourceLabels[resource]} adjustment`
                  }
                  disabled={!canAdjustResource(resource, -resourceStepFor(resource))}
                  onClick={() => adjustResource(resource, -resourceStepFor(resource))}
                  type="button"
                >
                  <Minus size={14} />
                </button>
                <strong>{resourceDeltas[resource] > 0 ? "+" : ""}{resourceDeltas[resource]}</strong>
                <button
                  aria-label={
                    resourceGainChoiceRule
                      ? `Add ${resourceStepFor(resource)} ${resourceLabels[resource]}`
                      : alternativeEffectRule
                        ? `Undo ${resourceStepFor(resource)} ${resourceLabels[resource]}`
                        : `Increase ${resourceLabels[resource]} adjustment`
                  }
                  disabled={!canAdjustResource(resource, resourceStepFor(resource))}
                  onClick={() => adjustResource(resource, resourceStepFor(resource))}
                  type="button"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {showTimerControls && !isPreparedPreview && (
        <section className="effect-control-group">
          <h3>Arrival Timers</h3>
          <div className="effect-list">
            {state.encounters.activeArrivals.map((arrival) => (
              <div className="effect-row" key={arrival.cardId}>
                <span>
                  {selectEncounterName(arrival.cardId)} {arrival.timerTokens}
                </span>
                <div className="stepper">
                  <button
                    aria-label={`Remove timer adjustment from ${selectEncounterName(arrival.cardId)}`}
                    disabled={!canAdjustTimer(arrival.cardId, -1)}
                    onClick={() => adjustTimer(arrival.cardId, -1)}
                    type="button"
                  >
                    <Minus size={14} />
                  </button>
                  <strong>
                    {(arrivalTimerDeltas[arrival.cardId] ?? 0) > 0 ? "+" : ""}
                    {arrivalTimerDeltas[arrival.cardId] ?? 0}
                  </strong>
                  <button
                    aria-label={`Add timer adjustment to ${selectEncounterName(arrival.cardId)}`}
                    disabled={!canAdjustTimer(arrival.cardId, 1)}
                    onClick={() => adjustTimer(arrival.cardId, 1)}
                    type="button"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {showStrainCascadeControls && !isPreparedPreview && strainCascadeRule && (
        <section className="effect-control-group">
          <div className="effect-control-heading">
            <h3>Strain Cascade</h3>
            <span>
              Choose an anchor, then {requiredCascadeSpreadTargets} adjacent tile
              {requiredCascadeSpreadTargets === 1 ? "" : "s"}: {selectedCascadeSpreadIds.length} selected
            </span>
          </div>
          <div className="effect-list tile-effect-list">
            {strainCascadeAnchorTargets.map((tile) => {
              const selected = strainCascadeAnchorTileId === tile.instanceId;
              return (
                <button
                  aria-label={`Choose ${selectTileName(tile)} as cascade anchor`}
                  className={`effect-row tile-effect-row ${selected ? "selected" : ""}`}
                  key={tile.instanceId}
                  onClick={() => chooseStrainCascadeAnchor(tile.instanceId)}
                  type="button"
                >
                  <span>
                    {selectTileName(tile)} {tile.hexIds.join(", ")} | Strain {tile.strain}
                    <small>
                      {strainCascadeRule.anchorStrain > 0
                        ? `Receives ${strainCascadeRule.anchorStrain} Strain before the cascade`
                        : "Overstrained anchor; receives no additional Strain"}
                    </small>
                  </span>
                  <MapPin size={16} />
                </button>
              );
            })}
          </div>

          {strainCascadeAnchorTileId && (
            <div className="effect-list tile-effect-list">
              {strainCascadeSpreadTargets.length === 0 ? (
                <p className="muted">No eligible adjacent tile can receive Strain.</p>
              ) : strainCascadeSpreadTargets.map((tile) => {
                const selected = selectedCascadeSpreadIds.includes(tile.instanceId);
                return (
                  <button
                    aria-label={`Place ${strainCascadeRule.spreadStrain} Strain on adjacent ${selectTileName(tile)}`}
                    className={`effect-row tile-effect-row ${selected ? "selected" : ""}`}
                    disabled={
                      !selected &&
                      selectedCascadeSpreadIds.length >= requiredCascadeSpreadTargets
                    }
                    key={tile.instanceId}
                    onClick={() => toggleStrainCascadeSpread(tile.instanceId)}
                    type="button"
                  >
                    <span>
                      {selectTileName(tile)} {tile.hexIds.join(", ")} | Strain {tile.strain}
                    </span>
                    {selected ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {showTileControls && !isPreparedPreview && (
        <section className="effect-control-group">
          <div className="effect-control-heading">
            <h3>Tiles</h3>
            <span>
              {tileAdjustmentRule.strain &&
                strainSelectionLabel}
              {tileAdjustmentRule.strain && tileAdjustmentRule.support && " | "}
              {tileAdjustmentRule.support &&
                (tileAdjustmentRule.support.requiredTargets !== undefined
                  ? `Supported on exactly ${tileAdjustmentRule.support.requiredTargets} ${
                      tileAdjustmentRule.support.requiredTargets === 1
                        ? "tile"
                        : "tiles"
                    }: ${supportTileIds.length} selected`
                  : `Supported up to ${tileAdjustmentRule.support.maxTargets} tiles: ${supportTileIds.length} selected`)}
            </span>
          </div>
          <div className="effect-list tile-effect-list">
            {tileControlTargets.map((tile) => (
              <div className="effect-row tile-effect-row" key={tile.instanceId}>
                <span>
                  {selectTileName(tile)} {tile.hexIds.join(", ")} | Strain {tile.strain}
                  {(tile.support.passive || tile.support.singleUse) && (
                    <small>Already Supported</small>
                  )}
                  {neighbourlyClusterByTileId.has(tile.instanceId) && (
                    <small>
                      Housing cluster {neighbourlyClusterByTileId.get(tile.instanceId)?.number}:
                      choose {neighbourlyClusterByTileId.get(tile.instanceId)?.required}
                    </small>
                  )}
                </span>
                <div className="stepper">
                  {canAdjustTileStrain && tileControlData.strainTargetIds.has(tile.instanceId) && (
                    effect.allowWardenRelief ? (
                      <button
                        className={tileStrainDeltas[tile.instanceId] === -1 ? "selected" : ""}
                        disabled={tile.strain <= 0}
                        onClick={() => chooseWardenStrainRelief(tile.instanceId)}
                        type="button"
                      >
                        <Minus size={14} />
                      </button>
                    ) : (
                      <>
                        <button
                          aria-label={`Decrease Strain adjustment for ${selectTileName(tile)}`}
                          disabled={!canAdjustStrain(tile.instanceId, -1)}
                          onClick={() => adjustStrain(tile.instanceId, -1)}
                          type="button"
                        >
                          <Minus size={14} />
                        </button>
                        <strong>
                          {(tileStrainDeltas[tile.instanceId] ?? 0) > 0 ? "+" : ""}
                          {tileStrainDeltas[tile.instanceId] ?? 0}
                        </strong>
                        <button
                          aria-label={`Increase Strain adjustment for ${selectTileName(tile)}`}
                          disabled={!canAdjustStrain(tile.instanceId, 1)}
                          onClick={() => adjustStrain(tile.instanceId, 1)}
                          type="button"
                        >
                          <Plus size={14} />
                        </button>
                      </>
                    )
                  )}
                  {canToggleTileSupport && tileControlData.supportTargetIds.has(tile.instanceId) && (
                    <button
                      aria-label={`Place Supported on ${selectTileName(tile)}`}
                      className={supportTileIds.includes(tile.instanceId) ? "selected" : ""}
                      disabled={
                        !supportTileIds.includes(tile.instanceId) &&
                        supportTileIds.length >=
                          (tileAdjustmentRule.support?.maxTargets ?? 0)
                      }
                      onClick={() =>
                        effect.allowWardenRelief
                          ? chooseWardenSupportRelief(tile.instanceId)
                          : toggleSupported(tile.instanceId)
                      }
                      type="button"
                    >
                      <ShieldCheck size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {effect.allowStewardMovementPlayerId && (
        <section className="effect-control-group">
          <h3>Steward Position</h3>
          <div className="effect-list tile-effect-list">
            {state.map.placedTiles
              .filter((tile) => tile.strain < 3)
              .map((tile) => {
                const destinationHexId = tile.hexIds[0];
                const selected =
                  stewardHexUpdates[effect.allowStewardMovementPlayerId ?? ""] ===
                  destinationHexId;
                return (
                  <button
                    className={`effect-row tile-effect-row ${selected ? "selected" : ""}`}
                    key={tile.instanceId}
                    onClick={() =>
                      moveSteward(
                        effect.allowStewardMovementPlayerId ?? "",
                        destinationHexId
                      )
                    }
                    type="button"
                  >
                    <span>
                      {selectTileName(tile)} {tile.hexIds.join(", ")}
                    </span>
                    <MapPin size={16} />
                  </button>
                );
              })}
          </div>
        </section>
      )}

      {effect.allowTemporaryReachPlayerId && (
        <section className="effect-control-group">
          <h3>Reach Target</h3>
          <div className="effect-list tile-effect-list">
            {mapCells.map((cell) => {
              const placedTile = state.map.placedTiles.find((tile) =>
                tile.hexIds.includes(cell.id)
              );
              const selectable = !placedTile || placedTile.strain < 3;
              const selected =
                temporaryReachHexUpdates[effect.allowTemporaryReachPlayerId ?? ""] ===
                cell.id;
              return (
                <button
                  className={`effect-row tile-effect-row ${selected ? "selected" : ""}`}
                  disabled={!selectable}
                  key={cell.id}
                  onClick={() =>
                    chooseTemporaryReach(
                      effect.allowTemporaryReachPlayerId ?? "",
                      cell.id
                    )
                  }
                  type="button"
                >
                  <span>
                    {cell.id} | {terrainLabels[cell.terrain]}
                    {placedTile ? ` | ${selectTileName(placedTile)}` : " | Empty"}
                  </span>
                  <MapPin size={16} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {effect.allowBurdenIgnore && state.encounters.activeBurdens.length > 0 && (
        <section className="effect-control-group">
          <h3>Burden To Ignore</h3>
          <div className="effect-list">
            {state.encounters.activeBurdens.map((cardId) => (
              <button
                className={`effect-row ${ignoredBurdenIds.includes(cardId) ? "selected" : ""}`}
                key={cardId}
                onClick={() => toggleIgnoredBurden(cardId)}
                type="button"
              >
                <span>{selectEncounterName(cardId)}</span>
                <ShieldOff size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      {effect.allowBurdenResolve && state.encounters.activeBurdens.length > 0 && (
        <section className="effect-control-group">
          <h3>Burden To Resolve</h3>
          <div className="effect-list">
            {state.encounters.activeBurdens.map((cardId) => (
              <button
                className={`effect-row ${resolvedBurdenIds.includes(cardId) ? "selected" : ""}`}
                key={cardId}
                onClick={() => toggleResolvedBurden(cardId)}
                type="button"
              >
                <span>
                  {selectEncounterName(cardId)}
                  <small>
                    {getBurdenResolutionCurrentText(encounterById[cardId], state.season) ??
                      "Resolution cost unavailable."}
                  </small>
                </span>
                <ShieldCheck size={16} />
              </button>
            ))}
          </div>
        </section>
      )}

      {effect.requiresManualChoice &&
        !hasChanges &&
        !wardenReliefHasNoTarget &&
        !isNeighbourlySupport && (
        <p className="failure-note">A choice is required before this effect can resolve.</p>
      )}
      {isNeighbourlySupport && tileAdjustmentInvalid && (
        <p className="failure-note">
          Choose the required number of different Housing Tiles in every labelled
          cluster. Already Supported and Overstrained Tiles cannot receive a token.
        </p>
      )}
      {burdenResolveInvalid && (
        <p className="failure-note">Choose one active Burden to resolve.</p>
      )}
      {wardenReliefInvalid && (
        <p className="failure-note">
          Choose exactly one Warden relief: remove 1 Strain from one tile, or place
          Supported on one tile.
        </p>
      )}
      {timerInvalid && (
        <p className="failure-note">Choose timer changes allowed by this effect.</p>
      )}
      {effect.resourceExchangeLimit !== undefined && exchangeInvalid && (
        <p className="failure-note">
          {getEffectRule(effect.ruleId).exchangeGoodsMode
            ? "Exchange up to 5 resources one-for-one into non-Goods, or spend exactly 5 resources to gain 3 Goods."
            : `Exchange the same number of resources in and out, up to ${effect.resourceExchangeLimit}.`}
        </p>
      )}
      <p className="muted effect-footer">
        <TimerReset size={15} />
        Next effect: {state.pendingEffects[1]?.title ?? "None"}
      </p>
    </section>
  );
}

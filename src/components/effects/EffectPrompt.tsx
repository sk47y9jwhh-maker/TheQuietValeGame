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
import { resourceLabels, resources } from "../../data/resources";
import {
  getBurdenResolutionCurrentText,
  getEncounterTypeLabel
} from "../common/gameText";
import {
  getEffectSupportTargets,
  getAlternativeEffectRule,
  getActiveEffectText,
  getHelpStandsRule,
  getResourceGainChoiceRule,
  getTileAdjustmentRule,
  getValidEffectStrainTargets,
  getTimerAdjustmentRule,
  hasWardenReliefTarget,
  hasEffectAdjustment,
  isResourceExchangeAdjustmentValid,
  isAlternativeEffectAdjustmentValid,
  isResourceGainChoiceAdjustmentValid,
  isTileAdjustmentValid,
  isWardenReliefAdjustmentValid,
  isTimerAdjustmentValid,
  mergeEffectAdjustment
} from "../../engine/manualEffects";
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

export function EffectPrompt({
  state,
  effect,
  onApply,
  onSkip,
  canCancelWithWarden,
  onCancelWithWarden
}: EffectPromptProps) {
  const helpStandsRule = getHelpStandsRule(state, effect.effectText);
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
      getHelpStandsRule(state, effect.effectText)?.tileStrainDeltas ??
        effect.suggestedAdjustment?.tileStrainDeltas ??
        {}
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
    () =>
      mergeEffectAdjustment(effect.suggestedAdjustment, {
        resourceDeltas,
        arrivalTimerDeltas,
        tileStrainDeltas,
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
      effect.effectText,
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
    effect.effectText,
    arrivalTimerDeltas
  );
  const hasChanges = hasEffectAdjustment(adjustment);
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
  const activeEffectText = getActiveEffectText(state, effect.effectText, sourceTile);
  const effectText = activeEffectText.toLowerCase();
  const alternativeEffectRule = getAlternativeEffectRule(
    state,
    effect.effectText,
    sourceTile
  );
  const resourceGainChoiceRule = getResourceGainChoiceRule(
    state,
    effect.effectText,
    sourceTile
  );
  const timerRule = getTimerAdjustmentRule(activeEffectText);
  const tileControlData = useMemo(() => {
    const suggestedStrainIds = Object.keys(effect.suggestedAdjustment?.tileStrainDeltas ?? {});
    const suggestedSupportIds = effect.suggestedAdjustment?.supportTileIds ?? [];
    const suggestedTileIds = new Set([...suggestedStrainIds, ...suggestedSupportIds]);
    const legalTargets = getValidEffectStrainTargets(
      state,
      effect.effectText,
      sourceTile
    );
    const supportTargets = getEffectSupportTargets(state, effect.effectText, sourceTile);
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
  }, [effect.effectText, effect.suggestedAdjustment, sourceTile, state]);
  const tileControlTargets = tileControlData.targets;
  const tileAdjustmentRule = useMemo(
    () => getTileAdjustmentRule(activeEffectText),
    [activeEffectText]
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
  const hasResourceSuggestion = resources.some(
    (resource) => (effect.suggestedAdjustment?.resourceDeltas?.[resource] ?? 0) !== 0
  );
  const broadResourceChoice =
    effect.resourceExchangeLimit !== undefined ||
    effectText.includes("exchange") ||
    effectText.includes("any type") ||
    effectText.includes("of any type") ||
    /\bgain\s+\d+\s+resource/.test(effectText) ||
    /\bgain\s+\d+\s+resources/.test(effectText);
  const visibleResources = alternativeEffectRule
    ? alternativeEffectRule.resources
    : resourceGainChoiceRule
    ? resourceGainChoiceRule.resources
    : broadResourceChoice
    ? resources
    : resources.filter(
        (resource) =>
          effectText.includes(resource) ||
          (effect.suggestedAdjustment?.resourceDeltas?.[resource] ?? 0) !== 0
      );
  const hasResourceAction =
    broadResourceChoice ||
    /\b(?:gain|lose|pay)\s+(?:up to\s+)?\d+\s+(?:wood|stone|metal|food|herbs|goods|resource|resources)\b/.test(
      effectText
    );
  const hasExplicitResourceAlternative =
    /\b(?:gain|lose|pay)\s+(?:up to\s+)?\d+\s+(?:wood|stone|metal|food|herbs|goods)[^.]*\b(?:or|and\/or)\b/i.test(
      activeEffectText
    );
  const hasEditableResourceChoice =
    Boolean(alternativeEffectRule) ||
    Boolean(resourceGainChoiceRule && resourceGainChoiceRule.amount > 0) ||
    effect.resourceExchangeLimit !== undefined ||
    broadResourceChoice ||
    hasExplicitResourceAlternative;
  const showResourceControls =
    hasEditableResourceChoice ||
    Boolean(
      effect.requiresManualChoice && hasResourceAction && !hasResourceSuggestion
    );
  const hasTimerSuggestion = Object.values(
    effect.suggestedAdjustment?.arrivalTimerDeltas ?? {}
  ).some((delta) => delta !== 0);
  const showTimerControls =
    state.encounters.activeArrivals.length > 0 &&
    (hasTimerSuggestion ||
      Boolean(
        effect.requiresManualChoice &&
          (effectText.includes("timer") || effectText.includes("active arrival"))
      ));
  const hasTileSuggestion =
    Object.values(effect.suggestedAdjustment?.tileStrainDeltas ?? {}).some(
      (delta) => delta !== 0
    ) || Boolean(effect.suggestedAdjustment?.supportTileIds?.length);
  const needsTileChoice =
    Boolean(effect.requiresManualChoice) &&
    /\b(strain|supported|tile|tiles|housing|resource|crafting|merchant|social|wellbeing|travel|overstrained|adjacent)\b/.test(
      effectText
    );
  const showTileControls =
    !helpStandsRule &&
    tileControlTargets.length > 0 &&
    (hasTileSuggestion || needsTileChoice);
  const tileAdjustmentInvalid =
    !effect.allowWardenRelief &&
    !isTileAdjustmentValid(
      state,
      effect.effectText,
      adjustment,
      sourceTile
    );
  const alternativeEffectInvalid = !isAlternativeEffectAdjustmentValid(
    state,
    effect.effectText,
    adjustment,
    sourceTile
  );
  const resourceGainChoiceInvalid = !isResourceGainChoiceAdjustmentValid(
    state,
    effect.effectText,
    adjustment,
    sourceTile
  );
  const allowsResourceInsteadOfTile = Boolean(
    alternativeEffectRule?.kind === "pay_or_strain" ||
    alternativeEffectRule?.kind === "warehouse_loss_or_strain" ||
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
  const cannotApply =
    Boolean(effect.requiresManualChoice && !hasChanges && !wardenReliefHasNoTarget) ||
    missingRequiredTileChoice ||
    timerInvalid ||
    exchangeInvalid ||
    alternativeEffectInvalid ||
    resourceGainChoiceInvalid ||
    Boolean(burdenResolveInvalid) ||
    Boolean(wardenReliefInvalid) ||
    tileAdjustmentInvalid;
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
  }, [adjustment, state.map.placedTiles, state.players]);
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
      effect.effectText,
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
    return alternativeEffectRule?.resources.includes(resource)
      ? alternativeEffectRule.resourceStep
      : 1;
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
    const maxSpend = alternativeEffectRule.kind === "warehouse_loss_or_strain"
      ? alternativeEffectRule.resourceStep
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
      const next = alternativeEffectRule?.kind === "warehouse_loss_or_strain" && delta < 0
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
    if (alternativeEffectRule?.kind === "warehouse_loss_or_strain" && delta < 0) {
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
    if (
      alternativeEffectRule?.kind === "warehouse_loss_or_strain" &&
      requestedDelta > 0 &&
      !alternativeEffectRule.resources.some(
        (resource) => state.warehouse[resource] < alternativeEffectRule.resourceStep
      )
    ) {
      return currentDelta;
    }
    const nextDelta = currentDelta + requestedDelta;
    if (rule.direction === "place" && nextDelta < 0) return currentDelta;
    if (rule.direction === "remove" && nextDelta > 0) return currentDelta;
    if (Math.abs(nextDelta) > rule.maxPerTile) return currentDelta;
    if (rule.direction === "remove" && Math.abs(nextDelta) > tile.strain) {
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
    if (alternativeEffectRule?.kind === "warehouse_loss_or_strain" && nextDelta > 0) {
      setResourceDeltas(emptyResourceDeltas());
    }
    if (
      resourceGainChoiceRule?.alternativeToStrainRemoval &&
      nextDelta < 0
    ) {
      setResourceDeltas(emptyResourceDeltas());
    }
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
              {alternativeEffectRule.kind === "warehouse_loss_or_strain"
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

      {showTileControls && !isPreparedPreview && (
        <section className="effect-control-group">
          <div className="effect-control-heading">
            <h3>Tiles</h3>
            <span>
              {tileAdjustmentRule.strain &&
                `${tileAdjustmentRule.strain.direction === "place" ? "Place" : "Remove"} up to ${tileAdjustmentRule.strain.maxTotal} Strain: ${selectedStrainTotal} selected`}
              {tileAdjustmentRule.strain && tileAdjustmentRule.support && " | "}
              {tileAdjustmentRule.support &&
                `Supported up to ${tileAdjustmentRule.support.maxTargets} tiles: ${supportTileIds.length} selected`}
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

      {effect.requiresManualChoice && !hasChanges && !wardenReliefHasNoTarget && (
        <p className="failure-note">A choice is required before this effect can resolve.</p>
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
          {/exchange\s+5\s+total\s+resources\s+for\s+3\s+Goods/i.test(
            effect.effectText
          )
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

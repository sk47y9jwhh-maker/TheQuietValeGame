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
import { EncounterSeasonEffects } from "../common/EncounterSeasonEffects";
import {
  getBurdenResolutionCurrentText,
  getEncounterTypeLabel
} from "../common/gameText";
import {
  getEffectSupportTargets,
  getEffectTileTargets,
  getTimerAdjustmentRule,
  hasEffectAdjustment,
  isTimerAdjustmentValid,
  mergeEffectAdjustment
} from "../../engine/manualEffects";
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
  const [resourceDeltas, setResourceDeltas] = useState(
    normalizeResourceDeltas(effect.suggestedAdjustment)
  );
  const [arrivalTimerDeltas, setArrivalTimerDeltas] = useState<Record<string, number>>(
    effect.suggestedAdjustment?.arrivalTimerDeltas ?? {}
  );
  const [tileStrainDeltas, setTileStrainDeltas] = useState<Record<string, number>>(
    effect.suggestedAdjustment?.tileStrainDeltas ?? {}
  );
  const [supportTileIds, setSupportTileIds] = useState<string[]>(
    effect.suggestedAdjustment?.supportTileIds ?? []
  );
  const [stewardHexUpdates, setStewardHexUpdates] = useState<Record<string, string>>(
    effect.suggestedAdjustment?.stewardHexUpdates ?? {}
  );
  const [ignoredBurdenIds, setIgnoredBurdenIds] = useState<string[]>(
    effect.suggestedAdjustment?.ignoredBurdenIds ?? []
  );
  const [resolvedBurdenIds, setResolvedBurdenIds] = useState<string[]>(
    effect.suggestedAdjustment?.resolvedBurdenIds ?? []
  );

  useEffect(() => {
    setResourceDeltas(normalizeResourceDeltas(effect.suggestedAdjustment));
    setArrivalTimerDeltas(effect.suggestedAdjustment?.arrivalTimerDeltas ?? {});
    setTileStrainDeltas(effect.suggestedAdjustment?.tileStrainDeltas ?? {});
    setSupportTileIds(effect.suggestedAdjustment?.supportTileIds ?? []);
    setStewardHexUpdates(effect.suggestedAdjustment?.stewardHexUpdates ?? {});
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
      supportTileIds,
      tileStrainDeltas
    ]
  );
  const exchangeSpent = resources.reduce(
    (total, resource) => total + Math.max(0, -(resourceDeltas[resource] ?? 0)),
    0
  );
  const exchangeGained = resources.reduce(
    (total, resource) => total + Math.max(0, resourceDeltas[resource] ?? 0),
    0
  );
  const exchangeInvalid =
    effect.resourceExchangeLimit !== undefined &&
    (exchangeSpent === 0 ||
      exchangeSpent !== exchangeGained ||
      exchangeSpent > effect.resourceExchangeLimit);
  const burdenResolveInvalid =
    effect.allowBurdenResolve &&
    state.encounters.activeBurdens.length > 0 &&
    resolvedBurdenIds.length === 0;
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
  const effectText = effect.effectText.toLowerCase();
  const timerRule = getTimerAdjustmentRule(effect.effectText);
  const canAdjustTileStrain = effectText.includes("strain");
  const canToggleTileSupport = effectText.includes("supported");
  const sourceTile =
    effect.sourceType === "tile" && effect.sourceId
      ? state.map.placedTiles.find((tile) => tile.instanceId === effect.sourceId)
      : undefined;
  const tileControlData = useMemo(() => {
    const suggestedStrainIds = Object.keys(effect.suggestedAdjustment?.tileStrainDeltas ?? {});
    const suggestedSupportIds = effect.suggestedAdjustment?.supportTileIds ?? [];
    const suggestedTileIds = new Set([...suggestedStrainIds, ...suggestedSupportIds]);
    const legalTargets = getEffectTileTargets(state, effect.effectText, sourceTile);
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
  const visibleResources = broadResourceChoice
    ? resources
    : resources.filter(
        (resource) =>
          effectText.includes(resource) ||
          (effect.suggestedAdjustment?.resourceDeltas?.[resource] ?? 0) !== 0
      );
  const showResourceControls =
    hasResourceSuggestion ||
    effect.resourceExchangeLimit !== undefined ||
    Boolean(
      effect.requiresManualChoice &&
        (broadResourceChoice ||
          visibleResources.length > 0 ||
          /\b(gain|lose|pay)\b/.test(effectText))
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
    tileControlTargets.length > 0 && (hasTileSuggestion || needsTileChoice);
  const cannotApply =
    Boolean(effect.requiresManualChoice && !hasChanges) ||
    timerInvalid ||
    exchangeInvalid ||
    Boolean(burdenResolveInvalid);

  function adjustResource(resource: ResourceType, delta: number) {
    setResourceDeltas((current) => ({
      ...current,
      [resource]: (current[resource] ?? 0) + delta
    }));
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

  function adjustStrain(tileId: string, delta: number) {
    setTileStrainDeltas((current) => ({
      ...current,
      [tileId]: (current[tileId] ?? 0) + delta
    }));
  }

  function toggleSupported(tileId: string) {
    setSupportTileIds((current) =>
      current.includes(tileId)
        ? current.filter((candidate) => candidate !== tileId)
        : [...current, tileId]
    );
  }

  function moveSteward(playerId: string, hexId: string) {
    setStewardHexUpdates((current) => ({
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
        {sourceCard && (
          <EncounterSeasonEffects card={sourceCard} currentSeason={state.season} />
        )}
      </div>

      {canCancelWithWarden && onCancelWithWarden && (
        <button
          className="secondary-action"
          onClick={onCancelWithWarden}
          type="button"
        >
          <ShieldOff size={18} />
          Use Warden Power
        </button>
      )}

      {showResourceControls && (
      <section className="effect-control-group">
        <h3>Resources</h3>
        <div className="effect-grid">
          {(visibleResources.length > 0 ? visibleResources : resources).map((resource) => (
            <div className="effect-row" key={resource}>
              <span>
                {resourceLabels[resource]} {state.warehouse[resource]}
              </span>
              <div className="stepper">
                <button onClick={() => adjustResource(resource, -1)} type="button">
                  <Minus size={14} />
                </button>
                <strong>{resourceDeltas[resource] > 0 ? "+" : ""}{resourceDeltas[resource]}</strong>
                <button onClick={() => adjustResource(resource, 1)} type="button">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {showTimerControls && (
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

      {showTileControls && (
        <section className="effect-control-group">
          <h3>Tiles</h3>
          <div className="effect-list tile-effect-list">
            {tileControlTargets.map((tile) => (
              <div className="effect-row tile-effect-row" key={tile.instanceId}>
                <span>
                  {selectTileName(tile)} {tile.hexIds.join(", ")} | Strain {tile.strain}
                </span>
                <div className="stepper">
                  {canAdjustTileStrain && tileControlData.strainTargetIds.has(tile.instanceId) && (
                    <>
                      <button onClick={() => adjustStrain(tile.instanceId, -1)} type="button">
                        <Minus size={14} />
                      </button>
                      <strong>
                        {(tileStrainDeltas[tile.instanceId] ?? 0) > 0 ? "+" : ""}
                        {tileStrainDeltas[tile.instanceId] ?? 0}
                      </strong>
                      <button onClick={() => adjustStrain(tile.instanceId, 1)} type="button">
                        <Plus size={14} />
                      </button>
                    </>
                  )}
                  {canToggleTileSupport && tileControlData.supportTargetIds.has(tile.instanceId) && (
                    <button
                      className={supportTileIds.includes(tile.instanceId) ? "selected" : ""}
                      onClick={() => toggleSupported(tile.instanceId)}
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

      {effect.requiresManualChoice && !hasChanges && (
        <p className="failure-note">A choice is required before this effect can resolve.</p>
      )}
      {burdenResolveInvalid && (
        <p className="failure-note">Choose one active Burden to resolve.</p>
      )}
      {timerInvalid && (
        <p className="failure-note">Choose timer changes allowed by this effect.</p>
      )}
      {effect.resourceExchangeLimit !== undefined && exchangeInvalid && (
        <p className="failure-note">
          Exchange the same number of resources in and out, up to{" "}
          {effect.resourceExchangeLimit}.
        </p>
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
          {effect.confirmLabel ?? "Apply Effect"}
        </button>
      </div>
      <p className="muted effect-footer">
        <TimerReset size={15} />
        Next effect: {state.pendingEffects[1]?.title ?? "None"}
      </p>
    </section>
  );
}

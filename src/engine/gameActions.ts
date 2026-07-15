import { encounterById } from "../data/encounters";
import { mapById, terrainLabels } from "../data/map";
import { stewardById } from "../data/stewards";
import { coreTileById, specialTileById } from "../data/tiles";
import {
  getEffectRule,
  stewardEffectRuleId,
  systemEffectRuleId,
  tileEffectRuleId
} from "../data/effectRules";
import {
  arrivalRequirementRules,
  getBurdenResolutionCost,
  getBurdenResolutionCostOptions,
  persistentBoonIds,
  productionPassiveRules,
  specialTileBehaviors
} from "../data/contentRules";
import { resources, warehouseCap } from "../data/resources";
import {
  getPlacementFailures,
  getTileFootprintKind,
  getTilePlacementHexIds,
  getTileSupplyCopiesRequired
} from "./placementRules";
import {
  effectHasNoValidChoiceTargets,
  getCurrentSeasonCardEffectRuleId,
  getCurrentSeasonCardEffectText,
  hasWardenReliefTarget,
  queuePendingEffect,
  queuePendingEffectFirst,
  queueRestingHallBurdenPassive,
  resolvePendingEffect,
  suggestEffectAdjustment
} from "./manualEffects";
import { queueDeckReorderFromEffect } from "./deckReorder";
import {
  consumeBoonModifiers,
  createBoonModifierFromCard,
  getBoonActionPreview,
  getBoonCostOptions,
  getBoonModifiedCost,
  getMatchingBoonModifiers
} from "./boonModifiers";
import { canAfford, spendResources } from "./resources";
import { getHexNeighbors } from "./hex";
import {
  arePlacedTilesAdjacent,
  getPlacedTileCategory,
  getPlacedTileEffectText as getTileEffectText,
  getPlacedTileName,
  isPlacedTileAdjacentToCategory as isAdjacentToCategory
} from "./placedTiles";
import { getSeasonForRound, isSeasonStartRound, revealCountForPlayers } from "./season";
import { isTileReachable } from "./reachability";
import { refreshPassiveSupported } from "./strainRules";
import { recalculatePassiveSupported } from "./supportRules";
import { queueGoldenBoonResolution } from "./golden";
import {
  applyCostChoice,
  getPassiveCostOptions,
  findAffordableCostSelection,
  recordPassiveCostChoices,
  validateCostChoiceSelection
} from "./passiveCosts";
import type {
  ActiveArrival,
  ActiveBoonModifier,
  ActiveBoon,
  CostChoiceSelection,
  GameState,
  PassiveCostOption,
  PendingEffectState,
  PendingCostChoiceState,
  PlacedTile,
  PlayerState,
  ResourceCost,
  ResourceType,
  Terrain,
  TileCategory,
  TilePlacementDraft,
  ValidationResult
} from "./types";

function log(state: GameState, message: string): GameState {
  return {
    ...state,
    log: [
      {
        id: `log_${state.log.length + 1}_${Date.now()}`,
        round: state.round,
        message
      },
      ...state.log
    ].slice(0, 80)
  };
}

function emptyCost(): ResourceCost {
  return { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 };
}

function getResourceShortfalls(
  warehouse: GameState["warehouse"],
  cost: ResourceCost
): Partial<Record<ResourceType, number>> {
  return Object.fromEntries(
    resources
      .filter((resource) => warehouse[resource] < cost[resource])
      .map((resource) => [resource, cost[resource] - warehouse[resource]])
  );
}

function hasPendingEffects(state: GameState): boolean {
  return (
    state.pendingEffects.length > 0 ||
    Boolean(state.pendingDeckReorder) ||
    Boolean(state.pendingCostChoice) ||
    Boolean(state.pendingGoldenEffect)
  );
}

function hasNonCostPendingEffects(state: GameState): boolean {
  return (
    state.pendingEffects.length > 0 ||
    Boolean(state.pendingDeckReorder) ||
    Boolean(state.pendingGoldenEffect)
  );
}

function canPayNowOrWithPassiveOptions(
  state: GameState,
  cost: ResourceCost,
  options: PassiveCostOption[]
): boolean {
  return Boolean(findAffordableCostSelection(state, cost, options));
}

function queueCostChoice(
  state: GameState,
  input: Omit<PendingCostChoiceState, "id">
): GameState {
  return {
    ...state,
    pendingCostChoice: {
      ...input,
      id: `cost_choice_${state.log.length + state.pendingEffects.length + 1}_${Date.now()}`
    }
  };
}

function getSelectedCost(
  state: GameState,
  baseCost: ResourceCost,
  options: PassiveCostOption[],
  selection?: CostChoiceSelection
): ResourceCost | null {
  if (!selection) return baseCost;
  if (!validateCostChoiceSelection(options, selection)) return null;
  return applyCostChoice(state, baseCost, options, selection);
}

function getAutomaticCostSelection(
  options: PassiveCostOption[]
): CostChoiceSelection | undefined {
  if (options.length === 0) return undefined;
  if (
    options.some(
      (option) =>
        !option.required ||
        option.kind === "market" ||
        Boolean(option.resourceChoices?.length)
    )
  ) {
    return undefined;
  }

  return { selectedOptionIds: options.map((option) => option.id) };
}

function recordSelectedCostOptions(
  state: GameState,
  options: PassiveCostOption[],
  selection?: CostChoiceSelection
): GameState {
  return selection ? recordPassiveCostChoices(state, options, selection) : state;
}

function getBoonUsesForSeason(state: GameState, cardId: string): number {
  return getEffectRule(getCurrentSeasonCardEffectRuleId(state, cardId)).modifier?.uses ?? 1;
}

function queueBoonEffectPrompt(state: GameState, boon: ActiveBoon): GameState {
  const card = encounterById[boon.cardId];
  if (!card || card.type !== "boon") return state;

  const effectText = getCurrentSeasonCardEffectText(state, boon.cardId);
  const ruleId = getCurrentSeasonCardEffectRuleId(state, boon.cardId);
  const rule = getEffectRule(ruleId);
  if (rule.deckReorder) {
    return queueDeckReorderFromEffect(
      state,
      "card",
      card.name,
      `Use Boon: ${card.name}`,
      effectText,
      rule.deckReorder.count === "all"
        ? state.encounters.deck.length
        : rule.deckReorder.count,
      boon.cardId,
      {
        canSkip: true,
        skipLabel: "Skip Boon",
        mode: rule.deckReorder.mode
      }
    );
  }

  const suggestion = suggestEffectAdjustment(state, ruleId);
  const noValidTarget = effectHasNoValidChoiceTargets(state, ruleId);

  return queuePendingEffect(state, {
    sourceType: "card",
    ruleId,
    sourceId: boon.cardId,
    sourceName: card.name,
    title: `Use Boon: ${card.name}`,
    effectText,
    detailText: [
      `${boon.remainingUses} use${boon.remainingUses === 1 ? "" : "s"} before this use.`,
      noValidTarget ? "No valid target. No effect if applied now." : undefined
    ]
      .filter(Boolean)
      .join(" "),
    suggestedAdjustment: suggestion.adjustment,
    requiresManualChoice: noValidTarget ? false : suggestion.requiresManualChoice,
    canSkip: true,
    skipLabel: "Skip Boon",
    confirmLabel: noValidTarget ? "Acknowledge" : undefined
  });
}

function getPlacedTile(state: GameState, instanceId: string): PlacedTile | undefined {
  return state.map.placedTiles.find((tile) => tile.instanceId === instanceId);
}

function replacePlacedTile(state: GameState, nextTile: PlacedTile): GameState {
  return {
    ...state,
    map: {
      placedTiles: state.map.placedTiles.map((tile) =>
        tile.instanceId === nextTile.instanceId ? nextTile : tile
      )
    }
  };
}

function movePlayerStewardToHex(
  state: GameState,
  playerId: string,
  stewardHexId: string
): GameState {
  return {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, stewardHexId } : candidate
    )
  };
}

function tileEffectTriggersOnPlacement(tile: PlacedTile): boolean {
  return specialTileBehaviors[tile.tileId]?.trigger === "placedOrActivated";
}

function tileEffectTriggersOnUpgrade(_tile: PlacedTile): boolean {
  return false;
}

function getTileProduction(tile: PlacedTile): ResourceCost | undefined {
  if (tile.kind !== "core") return undefined;
  const data = coreTileById[tile.tileId];
  const side = tile.side === "upgraded" ? data.upgraded : data.basic;
  return side.production;
}

function getAdjacentLinkedProductionTileIds(
  state: GameState,
  placedTileId: string
): string[] {
  const tile = getPlacedTile(state, placedTileId);
  if (!tile || tile.strain >= 3 || !getTileProduction(tile)) return [];

  return state.map.placedTiles
    .filter(
      (candidate) =>
        candidate.instanceId !== tile.instanceId &&
        candidate.kind === "core" &&
        candidate.tileId === tile.tileId &&
        candidate.strain < 3 &&
        Boolean(getTileProduction(candidate)) &&
        arePlacedTilesAdjacent(tile, candidate)
    )
    .map((candidate) => candidate.instanceId);
}

export function hasUsedLinkedProductionThisRound(
  state: GameState,
  placedTileId: string
): boolean {
  const linkedTileIds = getAdjacentLinkedProductionTileIds(state, placedTileId);
  if (linkedTileIds.length === 0) return false;

  return [placedTileId, ...linkedTileIds].some(
    (tileId) =>
      state.tileActivationRecords[tileId]?.linkedProductionRound === state.round
  );
}

export function getLinkedProductionTileIds(
  state: GameState,
  placedTileId: string
): string[] {
  if (hasUsedLinkedProductionThisRound(state, placedTileId)) return [];
  return getAdjacentLinkedProductionTileIds(state, placedTileId);
}

export function getLinkedProductionTileId(
  state: GameState,
  placedTileId: string
): string | undefined {
  return getLinkedProductionTileIds(state, placedTileId)[0];
}

function isAdjacentToUpgradedCore(tile: PlacedTile, tiles: PlacedTile[]): boolean {
  return tiles.some(
    (candidate) =>
      candidate.instanceId !== tile.instanceId &&
      candidate.kind === "core" &&
      candidate.side === "upgraded" &&
      candidate.strain < 3 &&
      arePlacedTilesAdjacent(tile, candidate)
  );
}

function isPlacedOnTerrain(tile: PlacedTile, terrain: string): boolean {
  return tile.hexIds.some((hexId) => mapById[hexId]?.terrain === terrain);
}

function withSingleUseSupport(tile: PlacedTile): PlacedTile {
  return {
    ...tile,
    support: {
      ...tile.support,
      singleUse: true,
      preventedThisRound: false
    }
  };
}

function getAppliedStewardPowerIds(
  state: GameState,
  appliedModifierIds: string[]
): Set<string> {
  const appliedIdSet = new Set(appliedModifierIds);
  return new Set(
    state.boonModifiers
      .filter(
        (modifier) =>
          appliedIdSet.has(modifier.id) && modifier.sourceType === "steward"
      )
      .map((modifier) => modifier.sourceCardId)
  );
}

function getProducedResourceTypes(production: ResourceCost): ResourceType[] {
  return resources.filter((resource) => production[resource] > 0);
}

function hasIntrinsicPassiveSupport(tile: PlacedTile): boolean {
  return tile.tileId === "c19_bridge" && tile.side === "upgraded";
}

function withIntrinsicPassiveSupport(tile: PlacedTile): PlacedTile {
  if (!hasIntrinsicPassiveSupport(tile)) return tile;
  return {
    ...tile,
    support: {
      ...tile.support,
      passive: true
    }
  };
}

function getActivationLimit(tile: PlacedTile): "round" | "season" | null {
  return specialTileBehaviors[tile.tileId]?.cadence ?? null;
}

function isExplicitlyActivatedSpecialEffect(tile: PlacedTile): boolean {
  const trigger = specialTileBehaviors[tile.tileId]?.trigger;
  return trigger === "activated" || trigger === "placedOrActivated";
}

function canUseActivationLimit(state: GameState, tile: PlacedTile): boolean {
  const limit = getActivationLimit(tile);
  if (!limit) return true;

  const record = state.tileActivationRecords[tile.instanceId];
  if (limit === "season") return record?.season !== state.season;
  return record?.round !== state.round;
}

function recordTileActivation(state: GameState, tile: PlacedTile): GameState {
  const limit = getActivationLimit(tile);
  if (!limit) return state;

  return {
    ...state,
    tileActivationRecords: {
      ...state.tileActivationRecords,
      [tile.instanceId]: {
        ...state.tileActivationRecords[tile.instanceId],
        ...(limit === "season" ? { season: state.season } : { round: state.round })
      }
    }
  };
}

function recordRoundPassiveUse(state: GameState, tile: PlacedTile): GameState {
  return {
    ...state,
    tileActivationRecords: {
      ...state.tileActivationRecords,
      [tile.instanceId]: {
        ...state.tileActivationRecords[tile.instanceId],
        round: state.round
      }
    }
  };
}

function recordLinkedProductionUse(
  state: GameState,
  participatingTileIds: string[]
): GameState {
  const tileActivationRecords = { ...state.tileActivationRecords };
  for (const tileId of participatingTileIds) {
    tileActivationRecords[tileId] = {
      ...tileActivationRecords[tileId],
      linkedProductionRound: state.round
    };
  }
  return { ...state, tileActivationRecords };
}

function getProductionPassiveSuggestion(
  passiveTile: PlacedTile,
  production: ResourceCost
): Partial<Record<ResourceType, number>> | undefined {
  const rule = productionPassiveRules[passiveTile.tileId];
  if (!rule) return undefined;
  if (rule.gain.kind === "fixed") return rule.gain.resources;
  const producedTypes = getProducedResourceTypes(production);
  return producedTypes.length > 0 ? { [producedTypes[0]]: rule.gain.amount } : undefined;
}

function shouldProductionPassiveTrigger(
  state: GameState,
  passiveTile: PlacedTile,
  activatedTile: PlacedTile
): boolean {
  if (passiveTile.kind !== "special" || passiveTile.strain >= 3) return false;
  if (state.tileActivationRecords[passiveTile.instanceId]?.round === state.round) {
    return false;
  }
  if (!passiveTile.hexIds.some((hexId) => getHexNeighbors(hexId).some((neighborId) => activatedTile.hexIds.includes(neighborId)))) {
    return false;
  }

  return productionPassiveRules[passiveTile.tileId]?.sourceTileId === activatedTile.tileId;
}

function applyResourceGain(
  state: GameState,
  resourceDeltas: Partial<Record<ResourceType, number>>,
  message: string
): GameState {
  const warehouse = { ...state.warehouse };
  for (const resource of resources) {
    warehouse[resource] = Math.min(
      warehouseCap,
      warehouse[resource] + (resourceDeltas[resource] ?? 0)
    );
  }
  return log({ ...state, warehouse }, message);
}

function applyAdjacentProductionPassiveEffects(
  state: GameState,
  activatedTile: PlacedTile,
  production: ResourceCost
): GameState {
  let nextState = state;
  const passiveTiles = state.map.placedTiles.filter((passiveTile) =>
    shouldProductionPassiveTrigger(state, passiveTile, activatedTile)
  );

  for (const passiveTile of passiveTiles) {
    const resourceDeltas = getProductionPassiveSuggestion(passiveTile, production);
    if (!resourceDeltas) continue;
    const gainText = resources
      .filter((resource) => (resourceDeltas[resource] ?? 0) > 0)
      .map((resource) => `${resourceDeltas[resource]} ${resource}`)
      .join(" and ");
    nextState = applyResourceGain(
      nextState,
      resourceDeltas,
      `${getPlacedTileName(passiveTile)} passively added ${gainText} after ${getPlacedTileName(activatedTile)} produced.`
    );
    nextState = recordRoundPassiveUse(nextState, passiveTile);
  }

  return nextState;
}

function applyPreparedProductionBoonEffects(
  state: GameState,
  activatedTile: PlacedTile
): GameState {
  const modifiers = getMatchingBoonModifiers(state, {
    action: "production",
    tileId: activatedTile.tileId,
    category: getPlacedTileCategory(activatedTile),
    kind: activatedTile.kind,
    placedTile: activatedTile,
    baseCost: emptyCost()
  });
  let nextState = state;
  const consumedModifierIds: string[] = [];

  for (const modifier of modifiers) {
    if (modifier.productionGain?.fixed) {
      const gainText = resources
        .filter((resource) => (modifier.productionGain?.fixed?.[resource] ?? 0) > 0)
        .map(
          (resource) =>
            `${modifier.productionGain?.fixed?.[resource]} ${resource}`
        )
        .join(" and ");
      nextState = applyResourceGain(
        nextState,
        modifier.productionGain.fixed,
        `${modifier.name} added ${gainText} after ${getPlacedTileName(activatedTile)} produced.`
      );
    }

    if (modifier.productionGain?.choice && modifier.followUpRuleId) {
      nextState = queuePendingEffect(nextState, {
        sourceType: "card",
        ruleId: modifier.followUpRuleId,
        sourceId: modifier.sourceCardId,
        sourceName: modifier.name,
        title: `${modifier.name}: production bonus`,
        effectText: modifier.effectText,
        detailText: `${getPlacedTileName(activatedTile)} produced. Choose the bonus resource.`,
        requiresManualChoice: true,
        confirmLabel: "Gain Production Bonus"
      });
    }

    if (modifier.expiresAfterRound === undefined) {
      consumedModifierIds.push(modifier.id);
    }
  }

  return consumeBoonModifiers(nextState, consumedModifierIds);
}

function isPlacedTileAdjacentToTerrain(
  tile: PlacedTile,
  terrains: Terrain[]
): boolean {
  return tile.hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => {
      const terrain = mapById[neighborId]?.terrain;
      return terrain !== undefined && terrains.includes(terrain);
    })
  );
}

function applyBoonPostActionEffects(
  state: GameState,
  actionTile: PlacedTile,
  modifierIds: string[]
): GameState {
  const selectedIds = new Set(modifierIds);
  const modifiers = state.boonModifiers.filter((modifier) =>
    selectedIds.has(modifier.id)
  );
  let nextState = state;

  if (modifiers.some((modifier) => modifier.supportActionTile)) {
    nextState = replacePlacedTile(
      nextState,
      withSingleUseSupport(
        nextState.map.placedTiles.find(
          (tile) => tile.instanceId === actionTile.instanceId
        ) ?? actionTile
      )
    );
    nextState = recalculatePassiveSupported(nextState);
  }

  nextState = consumeBoonModifiers(nextState, modifierIds);

  for (const modifier of modifiers) {
    if (!modifier.postActionRuleId) continue;
    const currentActionTile = nextState.map.placedTiles.find(
      (tile) => tile.instanceId === actionTile.instanceId
    );
    if (!currentActionTile) continue;
    const categoryMatch = modifier.postActionRequiresAdjacentCategories?.some(
      (category) =>
        isAdjacentToCategory(
          currentActionTile,
          nextState.map.placedTiles,
          category,
          { includeOverstrained: true }
        )
    );
    const terrainMatch = modifier.postActionRequiresAdjacentTerrain?.length
      ? isPlacedTileAdjacentToTerrain(
          currentActionTile,
          modifier.postActionRequiresAdjacentTerrain
        )
      : false;
    const hasCondition = Boolean(
      modifier.postActionRequiresAdjacentCategories?.length ||
      modifier.postActionRequiresAdjacentTerrain?.length
    );
    if (hasCondition && !categoryMatch && !terrainMatch) continue;
    if (
      effectHasNoValidChoiceTargets(
        nextState,
        modifier.postActionRuleId,
        currentActionTile
      )
    ) {
      continue;
    }

    const suggestion = suggestEffectAdjustment(
      nextState,
      modifier.postActionRuleId,
      currentActionTile
    );
    nextState = queuePendingEffect(nextState, {
      sourceType: "tile",
      ruleId: modifier.postActionRuleId,
      sourceId: currentActionTile.instanceId,
      sourceName: modifier.name,
      title: `${modifier.name}: follow-up`,
      effectText: modifier.effectText,
      suggestedAdjustment: suggestion.adjustment,
      requiresManualChoice: suggestion.requiresManualChoice,
      confirmLabel: "Apply Follow-up"
    });
  }

  return nextState;
}

function queueTileEffectPrompt(
  state: GameState,
  tile: PlacedTile,
  titlePrefix: string,
  suggestedProduction?: ResourceCost
): GameState {
  const effectText = getTileEffectText(tile);
  const ruleId = tileEffectRuleId(tile.tileId, tile.side);
  const rule = getEffectRule(ruleId);
  if (rule.deckReorder) {
    return queueDeckReorderFromEffect(
      state,
      "tile",
      getPlacedTileName(tile),
      `${titlePrefix}: ${getPlacedTileName(tile)}`,
      effectText,
      rule.deckReorder.count === "all"
        ? state.encounters.deck.length
        : rule.deckReorder.count,
      tile.instanceId,
      { mode: rule.deckReorder.mode }
    );
  }

  const allowsBurdenResolve = Boolean(rule.resolveBurden);
  const suggestion = suggestedProduction
    ? { adjustment: { resourceDeltas: suggestedProduction } }
    : suggestEffectAdjustment(state, ruleId, tile);
  const noValidTarget =
    !suggestedProduction && effectHasNoValidChoiceTargets(state, ruleId, tile);
  if (noValidTarget && rule.optional) return state;
  const suggestedAdjustment = allowsBurdenResolve
    ? {
        ...suggestion.adjustment,
        resolvedBurdenIds: undefined
      }
    : suggestion.adjustment;

  const requiresManualChoice =
    suggestion.requiresManualChoice ||
    (allowsBurdenResolve && state.encounters.activeBurdens.length > 0);
  const queued = queuePendingEffect(state, {
    sourceType: "tile",
    ruleId,
    sourceId: tile.instanceId,
    sourceName: getPlacedTileName(tile),
    title: `${titlePrefix}: ${getPlacedTileName(tile)}`,
    effectText,
    detailText: noValidTarget ? "No valid target. No effect if applied now." : undefined,
    suggestedAdjustment,
    requiresManualChoice,
    canSkip: allowsBurdenResolve && state.encounters.activeBurdens.length > 0,
    skipLabel: allowsBurdenResolve ? "Skip Burden Resolve" : undefined,
    confirmLabel: noValidTarget ? "Acknowledge" : undefined,
    allowBurdenResolve: allowsBurdenResolve,
    resourceExchangeLimit: rule.exchangeLimit,
    resourceExchangeOptional: rule.exchangeOptional
  });
  return suggestedAdjustment && !requiresManualChoice && !noValidTarget
    ? resolvePendingEffect(queued)
    : queued;
}

export function validateStewardPlacement(
  state: GameState,
  playerId: string,
  hexId: string
): ValidationResult {
  const reasons: string[] = [];
  const player = state.players.find((candidate) => candidate.id === playerId);
  const steward = player ? stewardById[player.stewardId] : undefined;
  const cell = mapById[hexId];

  if (state.phase !== "setup") {
    reasons.push("Cannot place Steward now: setup placement is already complete.");
  }
  if (state.currentPlayerId !== playerId) {
    reasons.push("Cannot place Steward now: another player is choosing.");
  }
  if (!player || !steward) {
    reasons.push("Cannot place Steward: player or Steward data is missing.");
  }
  if (!cell) {
    reasons.push("Choose a hex on the map.");
  } else if (steward && !steward.startingTerrains.includes(cell.terrain)) {
    reasons.push(
      `${steward.name} must start on ${steward.startingTerrains
        .map((terrain) => terrainLabels[terrain])
        .join(" or ")}.`
    );
  }
  if (
    state.players.some(
      (candidate) => candidate.id !== playerId && candidate.stewardHexId === hexId
    )
  ) {
    reasons.push("Another Steward is already starting there.");
  }

  return { ok: reasons.length === 0, reasons };
}

export function commitStewardPlacement(
  state: GameState,
  playerId: string,
  hexId: string
): GameState {
  const validation = validateStewardPlacement(state, playerId, hexId);
  if (!validation.ok) return state;

  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  const player = state.players[playerIndex];
  const steward = stewardById[player.stewardId];
  const nextPlayer = state.players[playerIndex + 1];
  const placementState: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, stewardHexId: hexId } : candidate
    ),
    currentPlayerId: nextPlayer?.id ?? state.players[0].id,
    phase: nextPlayer
      ? "setup"
      : state.goldenSetup.selectedTileId
        ? "goldenSetup"
        : "seeding"
  };

  return log(
    placementState,
    nextPlayer
      ? `${steward.name} starts at ${hexId}. ${nextPlayer.name} chooses next.`
      : state.goldenSetup.selectedTileId
        ? `${steward.name} starts at ${hexId}. Golden Tile setup placement begins.`
        : `${steward.name} starts at ${hexId}. Season I seeding begins.`
  );
}

export function validateSeedingSelection(
  state: GameState,
  playerId: string,
  selection: { top?: string; middle?: string; bottom?: string }
): ValidationResult {
  const hand = state.encounters.handsByPlayerId[playerId] ?? [];
  const selected = [selection.top, selection.middle, selection.bottom];
  const reasons: string[] = [];

  if (state.phase !== "seeding") {
    reasons.push("Cannot seed now: this is not a Season seeding step.");
  }
  if (hasPendingEffects(state)) {
    reasons.push("Resolve the pending effect before seeding cards.");
  }

  if (!selection.top || !selection.middle || !selection.bottom) {
    reasons.push("Choose exactly one Top, one Middle, and one Bottom card.");
  }

  const selectedCards = selected.filter((cardId): cardId is string => Boolean(cardId));
  if (new Set(selectedCards).size !== selectedCards.length) {
    reasons.push("Each seeding slot must use a different card.");
  }

  for (const cardId of selectedCards) {
    if (!hand.includes(cardId)) {
      reasons.push("Cannot seed a card that is not in this player's hidden hand.");
    }
    if (encounterById[cardId]?.type === "goldenBoon") {
      reasons.push("Golden Boons are not player-seeded.");
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function commitSeasonSeeding(
  state: GameState,
  playerId: string,
  selection: { top: string; middle: string; bottom: string }
): GameState {
  if (hasPendingEffects(state)) return state;
  const validation = validateSeedingSelection(state, playerId, selection);
  if (!validation.ok) return state;

  const hand = state.encounters.handsByPlayerId[playerId] ?? [];
  const selected = [selection.top, selection.middle, selection.bottom];
  const remainingHand = hand.filter((cardId) => !selected.includes(cardId));
  const nextDeck = [...state.encounters.deck];
  nextDeck.unshift(selection.top);
  nextDeck.splice(Math.floor(nextDeck.length / 2), 0, selection.middle);
  nextDeck.push(selection.bottom);

  const seededIds = [...state.seasonSeededPlayerIds, playerId];
  const nextUnseededPlayer = state.players.find((player) => !seededIds.includes(player.id));
  const allSeeded = !nextUnseededPlayer;

  let nextState: GameState = {
    ...state,
    currentPlayerId: nextUnseededPlayer?.id ?? state.players[0].id,
    phase: allSeeded ? "reveal" : "seeding",
    seasonSeededPlayerIds: allSeeded ? [] : seededIds,
    encounters: {
      ...state.encounters,
      handsByPlayerId: {
        ...state.encounters.handsByPlayerId,
        [playerId]: remainingHand
      },
      deck: nextDeck
    }
  };

  nextState = log(
    nextState,
    allSeeded
      ? `Season ${state.season} seeding complete. Ready to reveal Encounters.`
      : `${playerId} seeded three hidden Encounter Cards.`
  );

  return nextState;
}

function getEncounterEffectDetail(card: NonNullable<(typeof encounterById)[string]>): string | undefined {
  if (card.type === "arrival") {
    return `Reward: ${card.rewardSpecialTileIds
      .map((specialTileId) => specialTileById[specialTileId]?.name ?? specialTileId)
      .join(", ")}`;
  }
  if (card.type === "burden") return undefined;
  if (card.type === "boon") return card.lifecycle;
  return undefined;
}

function queueEncounterCardEffectPrompt(
  state: GameState,
  cardId: string,
  title: string,
  options: {
    detailPrefix?: string;
    canCancelWithWardenPower?: boolean;
    canSkipBoon?: boolean;
    noEffectContext?: string;
  } = {}
): GameState {
  const card = encounterById[cardId];
  if (!card) return state;

  if (card.type === "arrival") {
    return queuePendingEffect(state, {
      sourceType: "card",
      ruleId: systemEffectRuleId("acknowledge"),
      sourceId: cardId,
      sourceName: card.name,
      title,
      effectText: "Arrival is now in play with 3 timer tokens.",
      detailText: [
        options.detailPrefix,
        `Requirement: ${card.requirementText}`,
        getEncounterEffectDetail(card)
      ]
        .filter(Boolean)
        .join(" "),
      resolutionLogMessage: `Acknowledged Arrival: ${card.name}.`,
      confirmLabel: "Acknowledge"
    });
  }

  const effectText = getCurrentSeasonCardEffectText(state, cardId);
  const ruleId = getCurrentSeasonCardEffectRuleId(state, cardId);
  const rule = getEffectRule(ruleId);
  if (rule.deckReorder) {
    return queueDeckReorderFromEffect(
      state,
      "card",
      card.name,
      title,
      effectText,
      rule.deckReorder.count === "all"
        ? state.encounters.deck.length
        : rule.deckReorder.count,
      cardId,
      options.canSkipBoon && card.type === "boon"
        ? {
            canSkip: true,
            skipLabel: "Skip Boon",
            mode: rule.deckReorder.mode
          }
        : { mode: rule.deckReorder.mode }
    );
  }

  const detailText = getEncounterEffectDetail(card);
  const noValidTarget = effectHasNoValidChoiceTargets(state, ruleId);
  const noEffectContext = options.noEffectContext ?? "this reveal";
  const acknowledgeOnlyBoon =
    card.type === "boon" &&
    Boolean(options.canSkipBoon) &&
    persistentBoonIds.has(card.id);
  const resolvedDetailText = [
    options.detailPrefix,
    detailText,
    noValidTarget ? `No valid target. No effect ${noEffectContext}.` : undefined
  ]
    .filter(Boolean)
    .join(" ");
  const suggestion = suggestEffectAdjustment(state, ruleId);

  return queuePendingEffect(state, {
    sourceType: "card",
    ruleId,
    sourceId: cardId,
    sourceName: card.name,
    title,
    effectText,
    detailText: resolvedDetailText || undefined,
    resolutionLogMessage: acknowledgeOnlyBoon
      ? `Acknowledged Boon: ${card.name}.`
      : noValidTarget
        ? `No effect ${noEffectContext}: ${card.name}.`
        : undefined,
    suggestedAdjustment: suggestion.adjustment,
    requiresManualChoice:
      acknowledgeOnlyBoon || noValidTarget ? false : suggestion.requiresManualChoice,
    canCancelWithWardenPower:
      card.type === "burden" && Boolean(options.canCancelWithWardenPower),
    canSkip: card.type === "boon" && Boolean(options.canSkipBoon),
    skipLabel: card.type === "boon" && options.canSkipBoon ? "Skip Boon" : undefined,
    confirmLabel: acknowledgeOnlyBoon || noValidTarget ? "Acknowledge" : undefined
  });
}

function queueSeasonStartBurdenEffects(state: GameState): GameState {
  let nextState = state;
  for (const burdenCardId of state.encounters.activeBurdens) {
    const card = encounterById[burdenCardId];
    if (!card || card.type !== "burden") continue;
    nextState = queueEncounterCardEffectPrompt(
      nextState,
      burdenCardId,
      `Season ${state.season} Burden: ${card.name}`,
      {
        detailPrefix: "Still active at the start of a new Season.",
        noEffectContext: "this Season start"
      }
    );
  }
  return nextState;
}

export function revealEncounters(state: GameState): GameState {
  if (hasPendingEffects(state)) return state;
  if (state.phase !== "reveal") return state;

  const revealCount = revealCountForPlayers(state.playerCount);
  const revealed: string[] = [];
  let standardRevealed = 0;
  let cursor = 0;
  while (standardRevealed < revealCount && cursor < state.encounters.deck.length) {
    const cardId = state.encounters.deck[cursor];
    revealed.push(cardId);
    cursor += 1;
    if (encounterById[cardId]?.type !== "goldenBoon") standardRevealed += 1;
  }
  const remainingDeck = state.encounters.deck.slice(cursor);
  const activeArrivals: ActiveArrival[] = [...state.encounters.activeArrivals];
  const activeBurdens = [...state.encounters.activeBurdens];
  const faceUpBoons = [...state.encounters.faceUpBoons];
  const discardPile = [...state.encounters.discardPile];
  const messages: string[] = [];

  for (const cardId of revealed) {
    const card = encounterById[cardId];
    if (!card) continue;
    messages.push(`Revealed ${card.name}.`);

    if (card.type === "arrival") {
      activeArrivals.push({ cardId, timerTokens: 3 });
    } else if (card.type === "burden") {
      activeBurdens.push(cardId);
    } else if (card.type === "boon") {
      if (persistentBoonIds.has(card.id)) {
        const modifier = getEffectRule(
          getCurrentSeasonCardEffectRuleId(state, cardId)
        ).modifier;
        faceUpBoons.push({
          cardId,
          remainingUses: getBoonUsesForSeason(state, cardId),
          ...(modifier?.duration === "round"
            ? { expiresAfterRound: state.round }
            : {})
        });
      } else {
        discardPile.push(cardId);
      }
    } else if (card.type === "goldenBoon") {
      if (cardId === "golden_boon_the_golden_vial") {
        faceUpBoons.push({ cardId, remainingUses: 1 });
      } else {
        discardPile.push(cardId);
      }
    }
  }

  let nextState: GameState = {
    ...state,
    phase: "turns",
    currentPlayerId: state.players[0].id,
    actionsRemaining: 4,
    playersActedThisRound: [],
    encounters: {
      ...state.encounters,
      deck: remainingDeck,
      activeArrivals,
      activeBurdens,
      faceUpBoons,
      discardPile
    }
  };

  for (const message of messages) {
    nextState = log(nextState, message);
  }

  for (const cardId of revealed) {
    const card = encounterById[cardId];
    if (!card) continue;
    if (card.type === "goldenBoon") {
      nextState = queueGoldenBoonResolution(nextState, cardId);
      continue;
    }
    nextState = queueEncounterCardEffectPrompt(
      nextState,
      cardId,
      `Revealed ${card.name}`,
      {
        canCancelWithWardenPower: card.type === "burden",
        canSkipBoon: card.type === "boon"
      }
    );
  }

  return nextState;
}

export function canStartPlaceTile(
  state: GameState,
  playerId: string,
  tileId: string,
  placementInput: string | TilePlacementDraft
): ValidationResult {
  const reasons: string[] = [];
  if (state.phase !== "turns") reasons.push("Cannot place now: it is not a Player Turn.");
  if (hasNonCostPendingEffects(state) || state.pendingCostChoice) {
    reasons.push("Resolve the pending choice before placing a tile.");
  }

  const coreData = coreTileById[tileId];
  const specialData = specialTileById[tileId];
  const data = coreData ?? specialData;
  if (!data) {
    reasons.push("Cannot place here: this tile is not in the current data.");
    return { ok: false, reasons };
  }

  const baseCost = coreData ? coreData.basic.cost : emptyCost();
  const actionPreview = getBoonActionPreview(state, {
    action: "place",
    tileId,
    category: data.category,
    kind: coreData ? "core" : "special",
    baseCost
  });
  if (state.actionsRemaining < actionPreview.actionCost) {
    reasons.push("Cannot place here: no actions remaining.");
  }

  reasons.push(
    ...getPlacementFailures(state, playerId, tileId, placementInput, {
      ignoreCost: true
    })
  );

  const options = getPassiveCostOptions(state, {
    action: "place",
    playerId,
    category: data.category,
    kind: coreData ? "core" : "special",
    placementHexIds: getTilePlacementHexIds(tileId, placementInput),
    cost: actionPreview.cost
  });

  const missingResources = canPayNowOrWithPassiveOptions(state, actionPreview.cost, options)
    ? {}
    : getResourceShortfalls(state.warehouse, actionPreview.cost);
  for (const [resource, amount] of Object.entries(missingResources)) {
    if (amount) {
      reasons.push(`Cannot place here: insufficient ${amount} ${resource}.`);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    missingResources: Object.keys(missingResources).length ? missingResources : undefined
  };
}

export function placeTile(
  state: GameState,
  playerId: string,
  tileId: string,
  placementInput: string | TilePlacementDraft,
  costSelection?: CostChoiceSelection
): GameState {
  if (hasNonCostPendingEffects(state)) return state;
  if (state.pendingCostChoice && !costSelection) return state;
  if (state.phase !== "turns") return state;

  const coreData = coreTileById[tileId];
  const specialData = specialTileById[tileId];
  const data = coreData ?? specialData;
  if (!data) return state;

  const baseCost = coreData ? coreData.basic.cost : emptyCost();
  const boonTarget = {
    action: "place",
    tileId,
    category: data.category,
    kind: coreData ? "core" : "special",
    baseCost
  } as const;
  const actionPreview = getBoonActionPreview(state, boonTarget);
  if (state.actionsRemaining < actionPreview.actionCost) return state;

  const placementFailures = getPlacementFailures(
    state,
    playerId,
    tileId,
    placementInput,
    { ignoreCost: true }
  );
  if (placementFailures.length > 0) return state;

  const placementHexIds = getTilePlacementHexIds(tileId, placementInput);
  const boonCostOptions = getBoonCostOptions(state, boonTarget);
  const passiveCostOptions = getPassiveCostOptions(state, {
    action: "place",
    playerId,
    category: data.category,
    kind: coreData ? "core" : "special",
    placementHexIds,
    cost: baseCost
  });
  const paymentOptions = [...boonCostOptions, ...passiveCostOptions];
  const resolvedCostSelection =
    costSelection ?? getAutomaticCostSelection(paymentOptions);

  if (paymentOptions.length > 0 && !resolvedCostSelection) {
    return queueCostChoice(state, {
      title: `Place ${coreData ? coreData.basic.name : specialData?.name}`,
      action: {
        type: "place",
        playerId,
        tileId,
        placementDraft:
          typeof placementInput === "string"
            ? { anchorHexId: placementInput }
            : placementInput
      },
      baseCost,
      actionCost: actionPreview.actionCost,
      boonModifierIds: actionPreview.appliedModifierIds,
      options: paymentOptions
    });
  }

  const finalCost = getSelectedCost(
    state,
    baseCost,
    paymentOptions,
    resolvedCostSelection
  );
  if (!finalCost || !canAfford(state.warehouse, finalCost)) return state;

  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return state;

  const footprintKind = getTileFootprintKind(tileId);
  const supplyCopiesRequired = getTileSupplyCopiesRequired(tileId);
  let placedTiles: PlacedTile[] =
    footprintKind === "detached"
      ? placementHexIds.map((hexId, index) =>
          withIntrinsicPassiveSupport({
            instanceId: `tile_${state.map.placedTiles.length + index + 1}_${tileId}`,
            tileId,
            kind: coreData ? "core" : "special",
            side: coreData ? "basic" : "special",
            hexIds: [hexId],
            strain: 0,
            support: {
              passive: false,
              singleUse: false,
              preventedThisRound: false
            }
          })
        )
      : [
          withIntrinsicPassiveSupport({
            instanceId: `tile_${state.map.placedTiles.length + 1}_${tileId}`,
            tileId,
            kind: coreData ? "core" : "special",
            side: coreData ? "basic" : "special",
            hexIds: placementHexIds,
            strain: 0,
            support: {
              passive: false,
              singleUse: false,
              preventedThisRound: false
            }
          })
        ];
  const appliedStewardPowerIds = getAppliedStewardPowerIds(
    state,
    actionPreview.appliedModifierIds
  );
  const placementContextTiles = [...state.map.placedTiles, ...placedTiles];
  placedTiles = placedTiles.map((placedTile) => {
    const category = getPlacedTileCategory(placedTile);
    const vanguardSupports =
      appliedStewardPowerIds.has("vanguard") &&
      category === "travel" &&
      (isAdjacentToCategory(placedTile, placementContextTiles, "travel") ||
        isPlacedOnTerrain(placedTile, "water"));
    const knightSupports =
      appliedStewardPowerIds.has("knight") &&
      category === "housing" &&
      isAdjacentToCategory(placedTile, placementContextTiles, "housing");

    return vanguardSupports || knightSupports
      ? withSingleUseSupport(placedTile)
      : placedTile;
  });

  let nextState: GameState = {
    ...state,
    pendingCostChoice: null,
    actionsRemaining: state.actionsRemaining - actionPreview.actionCost,
    warehouse: coreData ? spendResources(state.warehouse, finalCost) : state.warehouse,
    map: { placedTiles: [...state.map.placedTiles, ...placedTiles] },
    tileSupply: {
      ...state.tileSupply,
      core: coreData
        ? {
            ...state.tileSupply.core,
            [tileId]: state.tileSupply.core[tileId] - 1
          }
        : state.tileSupply.core,
      special: specialData
        ? {
            ...state.tileSupply.special,
            [tileId]: state.tileSupply.special[tileId] - supplyCopiesRequired
          }
        : state.tileSupply.special
    },
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            hasPlacedFirstTile: true,
            stewardHexId:
              !candidate.hasPlacedFirstTile && placementHexIds.includes(candidate.stewardHexId)
                ? candidate.stewardHexId
                : placementHexIds[0]
          }
        : candidate
    )
  };

  nextState = recalculatePassiveSupported(nextState);
  nextState = log(
    nextState,
    `${player.name} placed ${coreData ? coreData.basic.name : specialData?.name} at ${placementHexIds.join(
      ", "
    )}.`
  );
  nextState = applyBoonPostActionEffects(
    nextState,
    placedTiles[0],
    actionPreview.appliedModifierIds
  );
  nextState = recordSelectedCostOptions(
    nextState,
    paymentOptions,
    resolvedCostSelection
  );
  return tileEffectTriggersOnPlacement(placedTiles[0])
    ? queueTileEffectPrompt(nextState, placedTiles[0], "Placed effect")
    : nextState;
}

export function getUpgradeableTileIds(state: GameState, playerId: string): string[] {
  return state.map.placedTiles
    .filter((tile) => canStartUpgradeTile(state, playerId, tile.instanceId).ok)
    .map((tile) => tile.instanceId);
}

export function canStartUpgradeTile(
  state: GameState,
  playerId: string,
  placedTileId: string
): ValidationResult {
  const reasons: string[] = [];
  const tile = getPlacedTile(state, placedTileId);

  if (state.phase !== "turns") reasons.push("Cannot upgrade now: it is not a Player Turn.");
  if (hasNonCostPendingEffects(state) || state.pendingCostChoice) {
    reasons.push("Resolve the pending choice before upgrading a tile.");
  }
  if (!tile || tile.kind !== "core" || tile.side !== "basic") {
    reasons.push("Cannot upgrade: choose a basic Core Tile.");
    return { ok: false, reasons };
  }
  if (tile.strain >= 3) reasons.push("Cannot upgrade: this tile is Overstrained.");
  if (!isTileReachable(state, playerId, tile.instanceId)) {
    reasons.push("Cannot upgrade: this tile is not reachable.");
  }

  const data = coreTileById[tile.tileId];
  const actionPreview = getBoonActionPreview(state, {
    action: "upgrade",
    category: data.category,
    kind: "core",
    baseCost: data.upgraded.cost
  });
  if (state.actionsRemaining < actionPreview.actionCost) {
    reasons.push("Cannot upgrade: no actions remaining.");
  }

  const options = getPassiveCostOptions(state, {
    action: "upgrade",
    playerId,
    category: data.category,
    kind: "core",
    targetTile: tile,
    cost: actionPreview.cost
  });
  const missingResources = canPayNowOrWithPassiveOptions(state, actionPreview.cost, options)
    ? {}
    : getResourceShortfalls(state.warehouse, actionPreview.cost);
  for (const [resource, amount] of Object.entries(missingResources)) {
    if (amount) {
      reasons.push(`Cannot upgrade: missing ${amount} ${resource}.`);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    missingResources: Object.keys(missingResources).length ? missingResources : undefined
  };
}

export function upgradeTile(
  state: GameState,
  playerId: string,
  placedTileId: string,
  costSelection?: CostChoiceSelection
): GameState {
  if (hasNonCostPendingEffects(state)) return state;
  if (state.pendingCostChoice && !costSelection) return state;
  if (state.phase !== "turns") return state;

  const tile = getPlacedTile(state, placedTileId);
  if (!tile || tile.kind !== "core") return state;

  const data = coreTileById[tile.tileId];
  const boonTarget = {
    action: "upgrade",
    category: data.category,
    kind: "core",
    baseCost: data.upgraded.cost
  } as const;
  const actionPreview = getBoonActionPreview(state, boonTarget);
  if (state.actionsRemaining < actionPreview.actionCost) return state;

  const boonCostOptions = getBoonCostOptions(state, boonTarget);
  const passiveCostOptions = getPassiveCostOptions(state, {
    action: "upgrade",
    playerId,
    category: data.category,
    kind: "core",
    targetTile: tile,
    cost: data.upgraded.cost
  });
  const paymentOptions = [...boonCostOptions, ...passiveCostOptions];
  const resolvedCostSelection =
    costSelection ?? getAutomaticCostSelection(paymentOptions);

  if (paymentOptions.length > 0 && !resolvedCostSelection) {
    return queueCostChoice(state, {
      title: `Upgrade ${data.basic.name}`,
      action: {
        type: "upgrade",
        playerId,
        placedTileId
      },
      baseCost: data.upgraded.cost,
      actionCost: actionPreview.actionCost,
      boonModifierIds: actionPreview.appliedModifierIds,
      options: paymentOptions
    });
  }

  const finalCost = getSelectedCost(
    state,
    data.upgraded.cost,
    paymentOptions,
    resolvedCostSelection
  );
  if (!finalCost || !canAfford(state.warehouse, finalCost)) return state;
  if (
    tile.side !== "basic" ||
    tile.strain >= 3 ||
    !isTileReachable(state, playerId, tile.instanceId)
  ) {
    return state;
  }

  const appliedStewardPowerIds = getAppliedStewardPowerIds(
    state,
    actionPreview.appliedModifierIds
  );
  const upgradedBaseTile = withIntrinsicPassiveSupport({ ...tile, side: "upgraded" });
  const upgradedContextTiles = state.map.placedTiles.map((candidate) =>
    candidate.instanceId === upgradedBaseTile.instanceId ? upgradedBaseTile : candidate
  );
  const upgradedTile =
    appliedStewardPowerIds.has("sentinel") &&
    isAdjacentToUpgradedCore(upgradedBaseTile, upgradedContextTiles)
      ? withSingleUseSupport(upgradedBaseTile)
      : upgradedBaseTile;
  let nextState = replacePlacedTile(state, upgradedTile);
  nextState = recalculatePassiveSupported(nextState);
  nextState = {
    ...nextState,
    pendingCostChoice: null,
    actionsRemaining: state.actionsRemaining - actionPreview.actionCost,
    warehouse: spendResources(state.warehouse, finalCost)
  };
  nextState = movePlayerStewardToHex(nextState, playerId, upgradedTile.hexIds[0]);
  nextState = applyBoonPostActionEffects(
    nextState,
    upgradedTile,
    actionPreview.appliedModifierIds
  );
  nextState = recordSelectedCostOptions(
    nextState,
    paymentOptions,
    resolvedCostSelection
  );
  nextState = log(nextState, `Upgraded ${data.basic.name} to ${data.upgraded.name}.`);
  return tileEffectTriggersOnUpgrade(upgradedTile)
    ? queueTileEffectPrompt(nextState, upgradedTile, "Upgraded effect")
    : nextState;
}

export function getActivatableTileIds(state: GameState, playerId: string): string[] {
  return state.map.placedTiles
    .filter((tile) => {
      if (tile.strain >= 3 || !isTileReachable(state, playerId, tile.instanceId)) {
        return false;
      }
      if (!canUseActivationLimit(state, tile)) return false;

      if (tile.kind === "special") {
        if (!isExplicitlyActivatedSpecialEffect(tile)) return false;
        const rule = getEffectRule(tileEffectRuleId(tile.tileId, tile.side));
        if (rule.resolveBurden) {
          return state.encounters.activeBurdens.length > 0;
        }
        if (tile.tileId === "special_alchemist_s_workshop") {
          return resources.some((resource) => state.warehouse[resource] > 0);
        }
        if (rule.deckReorder) return state.encounters.deck.length > 0;
        return !effectHasNoValidChoiceTargets(state, rule.id, tile);
      }

      const data = coreTileById[tile.tileId];
      const side = tile.side === "upgraded" ? data.upgraded : data.basic;
      return (
        side.effectType === "production" ||
        (side.effectType === "activated" &&
          !effectHasNoValidChoiceTargets(
            state,
            tileEffectRuleId(tile.tileId, tile.side),
            tile
          ))
      );
    })
    .map((tile) => tile.instanceId);
}

export function activateTile(
  state: GameState,
  playerId: string,
  placedTileId: string
): GameState {
  if (hasPendingEffects(state)) return state;
  if (state.phase !== "turns") return state;
  if (!getActivatableTileIds(state, playerId).includes(placedTileId)) return state;

  const tile = getPlacedTile(state, placedTileId);
  if (!tile) return state;
  const actionPreview = getBoonActionPreview(state, {
    action: "activate",
    tileId: tile.tileId,
    category: getPlacedTileCategory(tile),
    kind: tile.kind,
    placedTile: tile,
    baseCost: emptyCost()
  });
  if (state.actionsRemaining < actionPreview.actionCost) return state;
  const production = getTileProduction(tile);
  const adjacentLinkedTileIds = production
    ? getAdjacentLinkedProductionTileIds(state, tile.instanceId)
    : [];
  const linkedProductionDiminished = production
    ? hasUsedLinkedProductionThisRound(state, tile.instanceId)
    : false;
  const linkedTileIds = linkedProductionDiminished
    ? []
    : adjacentLinkedTileIds;

  let nextState: GameState = {
    ...state,
    actionsRemaining: state.actionsRemaining - actionPreview.actionCost
  };

  nextState = movePlayerStewardToHex(nextState, playerId, tile.hexIds[0]);
  nextState = log(nextState, `Activated ${getPlacedTileName(tile)}.`);
  nextState = recordTileActivation(nextState, tile);
  if (production) {
    nextState = applyResourceGain(
      nextState,
      production,
      `${getPlacedTileName(tile)} produced resources.`
    );
    nextState = applyAdjacentProductionPassiveEffects(nextState, tile, production);
    nextState = applyPreparedProductionBoonEffects(nextState, tile);

    if (linkedProductionDiminished) {
      nextState = log(
        nextState,
        `Linked production already fired for this group in Round ${state.round}; only ${getPlacedTileName(tile)} produced.`
      );
    }
    if (adjacentLinkedTileIds.length > 0) {
      nextState = recordLinkedProductionUse(nextState, [
        tile.instanceId,
        ...adjacentLinkedTileIds
      ]);
    }

    for (const linkedTileId of linkedTileIds) {
      const linkedTile = getPlacedTile(state, linkedTileId);
      const linkedProduction = linkedTile ? getTileProduction(linkedTile) : undefined;
      if (!linkedTile || !linkedProduction) continue;

      nextState = log(
        nextState,
        `Linked production activated ${getPlacedTileName(linkedTile)}.`
      );
      nextState = recordTileActivation(nextState, linkedTile);
      nextState = applyResourceGain(
        nextState,
        linkedProduction,
        `${getPlacedTileName(linkedTile)} produced resources.`
      );
      nextState = applyAdjacentProductionPassiveEffects(
        nextState,
        linkedTile,
        linkedProduction
      );
      nextState = applyPreparedProductionBoonEffects(nextState, linkedTile);
    }
  }
  nextState = consumeBoonModifiers(
    nextState,
    actionPreview.appliedModifierIds
  );
  return production
    ? nextState
    : queueTileEffectPrompt(nextState, tile, "Activated effect");
}

export function canCompleteArrival(
  state: GameState,
  arrivalCardId: string
): ValidationResult {
  const card = encounterById[arrivalCardId];
  const activeArrival = state.encounters.activeArrivals.find(
    (arrival) => arrival.cardId === arrivalCardId
  );
  const reasons: string[] = [];

  if (state.phase !== "turns") {
    reasons.push("Cannot complete Arrival: it is not the Player Turns phase.");
  }
  if (hasPendingEffects(state)) {
    reasons.push("Resolve the pending effect before completing an Arrival.");
  }
  if (!activeArrival) {
    reasons.push("Cannot complete Arrival: this Arrival is not active.");
  }
  if (!card || card.type !== "arrival") {
    reasons.push("Cannot complete Arrival: this card is not an Arrival.");
  }
  if (state.actionsRemaining <= 0) {
    reasons.push("Cannot complete Arrival: no actions remaining.");
  }

  if (!card || card.type !== "arrival") return { ok: reasons.length === 0, reasons };

  const cost = getBoonModifiedCost(state, {
    action: "arrival",
    baseCost: arrivalRequirementRules[card.id].cost
  });
  const options = getPassiveCostOptions(state, {
    action: "arrival",
    playerId: state.currentPlayerId,
    cost
  });
  const missingResources = canPayNowOrWithPassiveOptions(state, cost, options)
    ? {}
    : getResourceShortfalls(state.warehouse, cost);
  for (const [resource, amount] of Object.entries(missingResources)) {
    if (amount) {
      reasons.push(`Cannot complete Arrival: missing ${amount} ${resource}.`);
    }
  }

  if (
    arrivalRequirementRules[card.id].requiresHousing &&
    !state.map.placedTiles.some(
      (tile) =>
        tile.strain < 3 &&
        tile.kind === "core" &&
        coreTileById[tile.tileId].category === "housing"
    )
  ) {
    reasons.push("Cannot complete Arrival: requires at least 1 Housing Tile.");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    missingResources: Object.keys(missingResources).length ? missingResources : undefined
  };
}

export function getCompletableArrivalIds(state: GameState): string[] {
  return state.encounters.activeArrivals
    .filter((arrival) => canCompleteArrival(state, arrival.cardId).ok)
    .map((arrival) => arrival.cardId);
}

export function getUsableFaceUpBoonIds(state: GameState): string[] {
  if (state.phase !== "turns" || hasPendingEffects(state)) return [];
  return state.encounters.faceUpBoons
    .filter((boon) => {
      if (
        encounterById[boon.cardId]?.type === "boon" &&
        state.boonModifiers.some(
          (modifier) => modifier.sourceCardId === boon.cardId
        )
      ) {
        return false;
      }
      if (boon.cardId !== "golden_boon_the_golden_vial") return true;
      return (
        boon.lastUsedRound !== state.round &&
        (state.tileSupply.core.c15_path ?? 0) > 0 &&
        !state.boonModifiers.some(
          (modifier) => modifier.sourceCardId === boon.cardId
        )
      );
    })
    .map((boon) => boon.cardId);
}

function getActiveStableTiles(state: GameState): PlacedTile[] {
  return state.map.placedTiles.filter(
    (tile) => tile.tileId === "special_stables" && tile.strain < 3
  );
}

function isStableNetworkTile(tile: PlacedTile, stableTiles: PlacedTile[]): boolean {
  return (
    stableTiles.some((stable) => stable.instanceId === tile.instanceId) ||
    stableTiles.some((stable) => arePlacedTilesAdjacent(stable, tile))
  );
}

export function getStableMoveDestinationTileIds(
  state: GameState,
  playerId: string
): string[] {
  if (state.phase !== "turns" || hasPendingEffects(state)) return [];
  if (state.currentPlayerId !== playerId) return [];

  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return [];

  const stableTiles = getActiveStableTiles(state);
  if (stableTiles.length === 0) return [];

  const sourceTile = state.map.placedTiles.find((tile) =>
    tile.hexIds.includes(player.stewardHexId)
  );
  if (!sourceTile || !isStableNetworkTile(sourceTile, stableTiles)) return [];

  return state.map.placedTiles
    .filter(
      (tile) =>
        tile.instanceId !== sourceTile.instanceId &&
        tile.strain < 3 &&
        isStableNetworkTile(tile, stableTiles)
    )
    .map((tile) => tile.instanceId);
}

export function canMoveStewardViaStables(
  state: GameState,
  playerId: string,
  destinationTileId: string
): ValidationResult {
  const reasons: string[] = [];

  if (state.phase !== "turns") {
    reasons.push("Cannot move via Stables: it is not the Player Turns phase.");
  }
  if (hasPendingEffects(state)) {
    reasons.push("Resolve the pending choice before moving via Stables.");
  }
  if (state.currentPlayerId !== playerId) {
    reasons.push("Cannot move via Stables: it is not this Steward's turn.");
  }
  if (!state.players.some((player) => player.id === playerId)) {
    reasons.push("Cannot move via Stables: no acting Steward was found.");
  }

  if (!getStableMoveDestinationTileIds(state, playerId).includes(destinationTileId)) {
    reasons.push("Cannot move via Stables: choose a valid Stables destination.");
  }

  return { ok: reasons.length === 0, reasons };
}

export function moveStewardViaStables(
  state: GameState,
  playerId: string,
  destinationTileId: string
): GameState {
  if (!canMoveStewardViaStables(state, playerId, destinationTileId).ok) return state;

  const destinationTile = getPlacedTile(state, destinationTileId);
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!destinationTile || !player) return state;

  const nextState: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? { ...candidate, stewardHexId: destinationTile.hexIds[0] }
        : candidate
    )
  };

  return log(
    nextState,
    `${player.name} moved via Stables to ${getPlacedTileName(destinationTile)}.`
  );
}

export function getStewardPowerUseLimit(
  _state: Pick<GameState, "season">,
  _player: PlayerState
): number {
  return 1;
}

function getAvailableWardenForCancel(state: GameState): PlayerState | undefined {
  return state.players.find((player) => {
    if (player.stewardId !== "warden") return false;
    const uses = player.stewardPowerUsesBySeason[state.season] ?? 0;
    return uses < getStewardPowerUseLimit(state, player);
  });
}

export function canCancelPendingBurdenWithWarden(state: GameState): ValidationResult {
  const reasons: string[] = [];
  const pendingEffect = state.pendingEffects[0];
  const card = pendingEffect?.sourceId ? encounterById[pendingEffect.sourceId] : undefined;

  if (!pendingEffect) {
    reasons.push("Cannot cancel with Warden Power: there is no pending effect.");
  } else if (!pendingEffect.canCancelWithWardenPower) {
    reasons.push("Cannot cancel with Warden Power: this effect is not a Burden reveal.");
  }

  if (card?.type !== "burden") {
    reasons.push("Cannot cancel with Warden Power: the pending card is not a Burden.");
  }

  if (!pendingEffect?.sourceId || !state.encounters.activeBurdens.includes(pendingEffect.sourceId)) {
    reasons.push("Cannot cancel with Warden Power: this Burden is not active.");
  }

  if (!getAvailableWardenForCancel(state)) {
    reasons.push("Cannot cancel with Warden Power: Warden has no uses left this Season.");
  }

  return { ok: reasons.length === 0, reasons };
}

export function cancelPendingBurdenWithWarden(state: GameState): GameState {
  if (!canCancelPendingBurdenWithWarden(state).ok) return state;

  const [pendingEffect, ...remainingEffects] = state.pendingEffects;
  const warden = getAvailableWardenForCancel(state);
  if (!pendingEffect?.sourceId || !warden) return state;

  const burdenName = encounterById[pendingEffect.sourceId]?.name ?? pendingEffect.sourceName;
  const nextState: GameState = {
    ...state,
    pendingEffects: remainingEffects,
    players: state.players.map((player) =>
      player.id === warden.id
        ? {
            ...player,
            stewardPowerUsesBySeason: {
              ...player.stewardPowerUsesBySeason,
              [state.season]: (player.stewardPowerUsesBySeason[state.season] ?? 0) + 1
            }
          }
        : player
    )
  };
  const cancelledState = log(
    nextState,
    `${warden.name} used Warden's Steward Power to cancel ${burdenName}'s reveal effect.`
  );

  if (!hasWardenReliefTarget(cancelledState)) {
    return log(
      cancelledState,
      "Warden Power had no eligible tile for Strain removal or Supported."
    );
  }

  return queuePendingEffectFirst(cancelledState, {
    sourceType: "system",
    ruleId: stewardEffectRuleId("warden"),
    sourceId: "warden",
    sourceName: "Warden",
    title: "Warden Relief",
    effectText:
      "Choose exactly one: remove 1 Strain from any tile, or place Supported on one tile.",
    detailText: "The Burden remains active, but its reveal effect was prevented.",
    requiresManualChoice: true,
    allowWardenRelief: true,
    confirmLabel: "Apply Warden Relief"
  });
}

function createStewardPowerModifier(
  state: GameState,
  player: PlayerState
): ActiveBoonModifier | null {
  const steward = stewardById[player.stewardId];
  if (!steward) return null;

  if (player.stewardId === "vanguard") {
    return {
      id: `modifier_${state.boonModifiers.length + state.log.length + 1}_${Date.now()}`,
      sourceCardId: player.stewardId,
      sourceType: "steward",
      name: `${steward.name} Power`,
      effectText: steward.powerText,
      actions: ["place"],
      remainingUses: 1,
      zeroAction: true,
      allowedCategories: ["travel"]
    };
  }

  if (player.stewardId === "knight") {
    return {
      id: `modifier_${state.boonModifiers.length + state.log.length + 1}_${Date.now()}`,
      sourceCardId: player.stewardId,
      sourceType: "steward",
      name: `${steward.name} Power`,
      effectText: steward.powerText,
      actions: ["place"],
      remainingUses: 1,
      zeroAction: true,
      allowedCategories: ["housing"]
    };
  }

  if (player.stewardId === "sentinel") {
    return {
      id: `modifier_${state.boonModifiers.length + state.log.length + 1}_${Date.now()}`,
      sourceCardId: player.stewardId,
      sourceType: "steward",
      name: `${steward.name} Power`,
      effectText: steward.powerText,
      actions: ["upgrade"],
      remainingUses: 1,
      zeroAction: true,
      coreOnly: true
    };
  }

  return null;
}

export function canUseStewardPower(
  state: GameState,
  playerId: string
): ValidationResult {
  const reasons: string[] = [];
  const player = state.players.find((candidate) => candidate.id === playerId);

  if (state.phase !== "turns") {
    reasons.push("Cannot use Steward Power: it is not the Player Turns phase.");
  }
  if (hasPendingEffects(state)) {
    reasons.push("Resolve the pending effect before using a Steward Power.");
  }
  if (state.currentPlayerId !== playerId) {
    reasons.push("Cannot use Steward Power: it is not this Steward's turn.");
  }
  if (!player) {
    reasons.push("Cannot use Steward Power: no acting Steward was found.");
    return { ok: false, reasons };
  }

  const uses = player.stewardPowerUsesBySeason[state.season] ?? 0;
  const limit = getStewardPowerUseLimit(state, player);
  if (uses >= limit) {
    reasons.push("Cannot use Steward Power: this Season's uses are spent.");
  }

  if (player.stewardId === "warden") {
    reasons.push("Warden Power is used when a Burden is revealed.");
  }

  if (
    player.stewardId === "quartermaster" &&
    resources.every((resource) => state.warehouse[resource] <= 0) &&
    !state.encounters.activeArrivals.some((arrival) => arrival.timerTokens < 3)
  ) {
    reasons.push(
      "Cannot use Quartermaster Power: there are no resources to exchange or Arrival timers to add."
    );
  }

  return { ok: reasons.length === 0, reasons };
}

export function useStewardPower(state: GameState, playerId: string): GameState {
  if (!canUseStewardPower(state, playerId).ok) return state;

  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return state;
  const steward = stewardById[player.stewardId];
  if (!steward) return state;

  let nextState: GameState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId
        ? {
            ...candidate,
            stewardPowerUsesBySeason: {
              ...candidate.stewardPowerUsesBySeason,
              [state.season]: (candidate.stewardPowerUsesBySeason[state.season] ?? 0) + 1
            }
          }
        : candidate
    )
  };

  const modifier = createStewardPowerModifier(state, player);
  if (modifier) {
    nextState = {
      ...nextState,
      boonModifiers: [...nextState.boonModifiers, modifier]
    };
    return log(
      nextState,
      `${player.name} prepared ${steward.name}'s Steward Power for the next matching action.`
    );
  }

  let pendingEffect: Omit<PendingEffectState, "id"> = {
    sourceType: "system" as const,
    ruleId: stewardEffectRuleId(player.stewardId),
    sourceId: player.stewardId,
    sourceName: steward.name,
    title: `Steward Power: ${steward.name}`,
    effectText: steward.powerText,
    detailText: modifier ? "Prepared for the next matching action this Season." : undefined
  };

  if (player.stewardId === "ranger") {
    pendingEffect = {
      ...pendingEffect,
      detailText:
        "Choose an empty hex or placed non-Overstrained tile to treat as reachable until the end of this turn.",
      allowTemporaryReachPlayerId: playerId,
      requiresManualChoice: true,
      confirmLabel: "Set Reach"
    };
  } else if (player.stewardId === "quartermaster") {
    const timerCandidates = state.encounters.activeArrivals.filter(
      (arrival) => arrival.timerTokens < 3
    );
    pendingEffect = {
      ...pendingEffect,
      detailText:
        "Exchange up to 5 Warehouse resources. You may also add 1 timer to an active Arrival below 3 timers.",
      suggestedAdjustment:
        timerCandidates.length === 1
          ? { arrivalTimerDeltas: { [timerCandidates[0].cardId]: 1 } }
          : undefined,
      resourceExchangeLimit: 5,
      resourceExchangeOptional: true,
      requiresManualChoice: true,
      confirmLabel: "Use Quartermaster Power"
    };
  }

  nextState = log(nextState, `${player.name} used ${steward.name}'s Steward Power.`);
  return queuePendingEffect(nextState, pendingEffect);
}

export function useFaceUpBoon(state: GameState, boonCardId: string): GameState {
  if (state.phase !== "turns" || hasPendingEffects(state)) return state;

  const activeBoon = state.encounters.faceUpBoons.find(
    (boon) => boon.cardId === boonCardId
  );
  const card = encounterById[boonCardId];
  if (!activeBoon || !card) return state;

  if (card.type === "goldenBoon") {
    if (
      card.id !== "golden_boon_the_golden_vial" ||
      activeBoon.lastUsedRound === state.round ||
      (state.tileSupply.core.c15_path ?? 0) <= 0
    ) {
      return state;
    }
    const modifier: ActiveBoonModifier = {
      id: `modifier_golden_vial_${state.round}_${Date.now()}`,
      sourceCardId: card.id,
      sourceType: "boon",
      name: card.name,
      effectText: card.effectText,
      actions: ["place"],
      remainingUses: 1,
      zeroAction: true,
      allowedTileIds: ["c15_path"],
      coreOnly: true
    };
    return log(
      {
        ...state,
        boonModifiers: [...state.boonModifiers, modifier],
        encounters: {
          ...state.encounters,
          faceUpBoons: state.encounters.faceUpBoons.map((boon) =>
            boon.cardId === card.id ? { ...boon, lastUsedRound: state.round } : boon
          )
        }
      },
      "The Golden Vial prepared one Path placement for 0 Actions this round."
    );
  }

  if (card.type !== "boon") return state;

  const nextFaceUpBoons =
    activeBoon.remainingUses <= 1
      ? state.encounters.faceUpBoons.filter((boon) => boon.cardId !== boonCardId)
      : state.encounters.faceUpBoons.map((boon) =>
          boon.cardId === boonCardId
            ? { ...boon, remainingUses: boon.remainingUses - 1 }
            : boon
        );

  let nextState: GameState = {
    ...state,
    encounters: {
      ...state.encounters,
      faceUpBoons: nextFaceUpBoons,
      discardPile:
        activeBoon.remainingUses <= 1
          ? [...state.encounters.discardPile, boonCardId]
          : state.encounters.discardPile
    }
  };
  const modifier = createBoonModifierFromCard(state, boonCardId);
  if (modifier) {
    nextState = {
      ...nextState,
      boonModifiers: [...nextState.boonModifiers, modifier]
    };
  }

  nextState = log(
    nextState,
    `${card.name} used. ${
      activeBoon.remainingUses <= 1
        ? "Discarded."
        : `${activeBoon.remainingUses - 1} use(s) remain.`
    }`
  );
  return queueBoonEffectPrompt(nextState, activeBoon);
}

export function completeArrival(
  state: GameState,
  arrivalCardId: string,
  costSelection?: CostChoiceSelection
): GameState {
  if (hasNonCostPendingEffects(state)) return state;
  if (state.pendingCostChoice && !costSelection) return state;
  if (state.phase !== "turns" || state.actionsRemaining <= 0) return state;

  const card = encounterById[arrivalCardId];
  if (!card || card.type !== "arrival") return state;
  const activeArrival = state.encounters.activeArrivals.find(
    (arrival) => arrival.cardId === arrivalCardId
  );
  if (!activeArrival) return state;
  if (
    arrivalRequirementRules[card.id].requiresHousing &&
    !state.map.placedTiles.some(
      (tile) =>
        tile.strain < 3 &&
        tile.kind === "core" &&
        coreTileById[tile.tileId].category === "housing"
    )
  ) {
    return state;
  }

  const baseCost = arrivalRequirementRules[card.id].cost;
  const boonTarget = {
    action: "arrival",
    baseCost
  } as const;
  const actionPreview = getBoonActionPreview(state, boonTarget);
  const boonCostOptions = getBoonCostOptions(state, boonTarget);
  const passiveCostOptions = getPassiveCostOptions(state, {
    action: "arrival",
    playerId: state.currentPlayerId,
    cost: baseCost
  });
  const paymentOptions = [...boonCostOptions, ...passiveCostOptions];

  if (paymentOptions.length > 0 && !costSelection) {
    return queueCostChoice(state, {
      title: `Complete ${card.name}`,
      action: {
        type: "arrival",
        playerId: state.currentPlayerId,
        cardId: arrivalCardId
      },
      baseCost,
      actionCost: 1,
      boonModifierIds: actionPreview.appliedModifierIds,
      options: paymentOptions
    });
  }

  const finalCost = getSelectedCost(
    state,
    baseCost,
    paymentOptions,
    costSelection
  );
  if (!finalCost || !canAfford(state.warehouse, finalCost)) return state;

  const specialTileIds = card.rewardSpecialTileIds;
  const specialTileNames = specialTileIds.map(
    (specialTileId) => specialTileById[specialTileId]?.name ?? specialTileId
  );
  const nextSpecialSupply = { ...state.tileSupply.special };
  for (const specialTileId of specialTileIds) {
    nextSpecialSupply[specialTileId] = (nextSpecialSupply[specialTileId] ?? 0) + 1;
  }

  let nextState: GameState = {
    ...state,
    pendingCostChoice: null,
    actionsRemaining: state.actionsRemaining - 1,
    warehouse: spendResources(state.warehouse, finalCost),
    tileSupply: {
      ...state.tileSupply,
      special: nextSpecialSupply
    },
    encounters: {
      ...state.encounters,
      activeArrivals: state.encounters.activeArrivals.filter(
        (arrival) => arrival.cardId !== arrivalCardId
      ),
      completedArrivals: [
        ...state.encounters.completedArrivals,
        { cardId: arrivalCardId, specialTileIds }
      ]
    }
  };

  nextState = log(
    nextState,
    `Completed Arrival: ${card.name}. Unlocked ${
      specialTileNames.length ? specialTileNames.join(", ") : "no Special Tiles"
    }.`
  );
  nextState = consumeBoonModifiers(nextState, actionPreview.appliedModifierIds);
  nextState = recordSelectedCostOptions(nextState, paymentOptions, costSelection);
  return queuePendingEffect(nextState, {
    sourceType: "card",
    ruleId: systemEffectRuleId("acknowledge"),
    sourceId: arrivalCardId,
    sourceName: card.name,
    title: `Arrival completed: ${card.name}`,
    effectText: `Requirement paid: ${card.requirementText}`,
    detailText: `Unlocked: ${specialTileNames.join(", ")}`,
    confirmLabel: "Acknowledge"
  });
}

export function canResolveBurden(
  state: GameState,
  burdenCardId: string
): ValidationResult {
  const card = encounterById[burdenCardId];
  const reasons: string[] = [];

  if (state.phase !== "turns") {
    reasons.push("Cannot resolve Burden: it is not the Player Turns phase.");
  }
  if (hasPendingEffects(state)) {
    reasons.push("Resolve the pending effect before resolving a Burden.");
  }
  if (!state.encounters.activeBurdens.includes(burdenCardId)) {
    reasons.push("Cannot resolve Burden: this Burden is not active.");
  }
  if (!card || card.type !== "burden") {
    reasons.push("Cannot resolve Burden: this card is not a Burden.");
  }
  if (state.actionsRemaining <= 0) {
    reasons.push("Cannot resolve Burden: no actions remaining.");
  }
  if (!card || card.type !== "burden") return { ok: reasons.length === 0, reasons };

  const baseCost = getBurdenResolutionCost(card.id, state.season);
  if (!baseCost) {
    reasons.push("Cannot resolve Burden: this Burden has no current resolution line.");
    return { ok: false, reasons };
  }
  const cost = getBoonModifiedCost(state, {
    action: "burden",
    baseCost
  });
  const options = getPassiveCostOptions(state, {
    action: "burden",
    playerId: state.currentPlayerId,
    cost
  });
  options.push(...getBurdenResolutionCostOptions(card.id, state.season));

  const missingResources = canPayNowOrWithPassiveOptions(state, cost, options)
    ? {}
    : getResourceShortfalls(state.warehouse, cost);
  for (const [resource, amount] of Object.entries(missingResources)) {
    if (amount) {
      reasons.push(`Cannot resolve Burden: missing ${amount} ${resource}.`);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    missingResources: Object.keys(missingResources).length ? missingResources : undefined
  };
}

export function getResolvableBurdenIds(state: GameState): string[] {
  return state.encounters.activeBurdens.filter((burdenCardId) =>
    canResolveBurden(state, burdenCardId).ok
  );
}

export function resolveBurden(
  state: GameState,
  burdenCardId: string,
  costSelection?: CostChoiceSelection
): GameState {
  if (hasNonCostPendingEffects(state)) return state;
  if (state.pendingCostChoice && !costSelection) return state;

  const card = encounterById[burdenCardId];
  if (!card || card.type !== "burden") return state;
  if (state.phase !== "turns" || state.actionsRemaining <= 0) return state;
  if (!state.encounters.activeBurdens.includes(burdenCardId)) return state;

  const baseCost = getBurdenResolutionCost(card.id, state.season);
  if (!baseCost) return state;
  const boonTarget = {
    action: "burden",
    baseCost
  } as const;
  const actionPreview = getBoonActionPreview(state, boonTarget);
  const boonCostOptions = getBoonCostOptions(state, boonTarget);
  const passiveCostOptions = getPassiveCostOptions(state, {
    action: "burden",
    playerId: state.currentPlayerId,
    cost: baseCost
  });
  const paymentOptions = [
    ...boonCostOptions,
    ...passiveCostOptions,
    ...getBurdenResolutionCostOptions(card.id, state.season)
  ];

  if (!costSelection) {
    return queueCostChoice(state, {
      title: `Resolve ${card.name}`,
      action: {
        type: "burden",
        playerId: state.currentPlayerId,
        cardId: burdenCardId
      },
      baseCost,
      actionCost: 1,
      boonModifierIds: actionPreview.appliedModifierIds,
      options: paymentOptions
    });
  }

  const finalCost = getSelectedCost(
    state,
    baseCost,
    paymentOptions,
    costSelection
  );
  if (!finalCost || !canAfford(state.warehouse, finalCost)) return state;

  let nextState: GameState = {
    ...state,
    pendingCostChoice: null,
    actionsRemaining: state.actionsRemaining - 1,
    warehouse: spendResources(state.warehouse, finalCost),
    encounters: {
      ...state.encounters,
      activeBurdens: state.encounters.activeBurdens.filter(
        (activeBurdenId) => activeBurdenId !== burdenCardId
      ),
      discardPile: [...state.encounters.discardPile, burdenCardId]
    }
  };

  nextState = log(nextState, `Resolved Burden: ${card.name}.`);
  nextState = consumeBoonModifiers(nextState, actionPreview.appliedModifierIds);
  nextState = recordSelectedCostOptions(nextState, paymentOptions, costSelection);
  return queueRestingHallBurdenPassive(nextState);
}

export function confirmCostChoice(
  state: GameState,
  selection: CostChoiceSelection
): GameState {
  const pending = state.pendingCostChoice;
  if (!pending) return state;

  if (pending.action.type === "place") {
    if (!pending.action.tileId || !pending.action.placementDraft) return state;
    return placeTile(
      state,
      pending.action.playerId,
      pending.action.tileId,
      pending.action.placementDraft,
      selection
    );
  }

  if (pending.action.type === "upgrade") {
    if (!pending.action.placedTileId) return state;
    return upgradeTile(
      state,
      pending.action.playerId,
      pending.action.placedTileId,
      selection
    );
  }

  if (pending.action.type === "arrival") {
    if (!pending.action.cardId) return state;
    return completeArrival(state, pending.action.cardId, selection);
  }

  if (pending.action.type === "burden") {
    if (!pending.action.cardId) return state;
    return resolveBurden(state, pending.action.cardId, selection);
  }

  return state;
}

export function cancelCostChoice(state: GameState): GameState {
  return state.pendingCostChoice ? { ...state, pendingCostChoice: null } : state;
}

export function endCurrentTurn(state: GameState): GameState {
  if (hasPendingEffects(state)) return state;
  if (state.phase !== "turns") return state;

  const acted = [...new Set([...state.playersActedThisRound, state.currentPlayerId])];
  const nextPlayer = state.players.find((player) => !acted.includes(player.id));
  const playersWithExpiredReach = state.players.map((player) =>
    player.id === state.currentPlayerId
      ? { ...player, temporaryReachHexId: undefined }
      : player
  );
  if (!nextPlayer) {
    if (state.bonusTurnsPending && !state.bonusTurnsActive) {
      return log(
        {
          ...state,
          players: playersWithExpiredReach,
          currentPlayerId: state.players[0].id,
          playersActedThisRound: [],
          actionsRemaining: 4,
          bonusTurnsPending: false,
          bonusTurnsActive: true
        },
        "Golden bonus turns begin. Every player receives the normal action allowance."
      );
    }
    return log(
      {
        ...state,
        players: playersWithExpiredReach,
        phase: "endRound",
        playersActedThisRound: acted,
        actionsRemaining: 0,
        bonusTurnsActive: false
      },
      state.bonusTurnsActive
        ? "All Golden bonus turns are complete. Ready for End of Round."
        : "All Stewards have acted. Ready for End of Round."
    );
  }

  return log(
    {
      ...state,
      players: playersWithExpiredReach,
      currentPlayerId: nextPlayer.id,
      playersActedThisRound: acted,
      actionsRemaining: 4
    },
    `${nextPlayer.name}'s turn begins.`
  );
}

export function resolveEndRound(state: GameState): GameState {
  if (hasPendingEffects(state)) return state;
  if (state.phase !== "endRound") return state;

  const decrementedArrivals = state.encounters.activeArrivals.map((arrival) => ({
    ...arrival,
    timerTokens: Math.max(0, arrival.timerTokens - 1)
  }));
  const expiredArrivals = decrementedArrivals.filter((arrival) => arrival.timerTokens === 0);
  const activeArrivals = decrementedArrivals.filter((arrival) => arrival.timerTokens > 0);
  const nextRound = state.round + 1;
  const gameEnd = state.round >= 12;
  const nextSeason = gameEnd ? state.season : getSeasonForRound(nextRound);
  const shouldSeed = !gameEnd && isSeasonStartRound(nextRound);
  const expiredRoundBoons = state.encounters.faceUpBoons.filter(
    (boon) =>
      boon.expiresAfterRound !== undefined &&
      boon.expiresAfterRound <= state.round
  );

  let nextState: GameState = {
    ...state,
    round: gameEnd ? state.round : nextRound,
    season: nextSeason,
    phase: gameEnd ? "gameEnd" : shouldSeed ? "seeding" : "reveal",
    currentPlayerId: state.players[0].id,
    players: state.players.map((player) => ({
      ...player,
      temporaryReachHexId: undefined
    })),
    actionsRemaining: 4,
    playersActedThisRound: [],
    seasonSeededPlayerIds: [],
    bonusTurnsPending: false,
    bonusTurnsActive: false,
    boonModifiers: (shouldSeed ? [] : state.boonModifiers).filter(
      (modifier) =>
        modifier.sourceCardId !== "golden_boon_the_golden_vial" &&
        (modifier.expiresAfterRound === undefined ||
          modifier.expiresAfterRound > state.round)
    ),
    ignoredBurdenIdsThisRound: [],
    encounters: {
      ...state.encounters,
      activeArrivals,
      discardPile: [
        ...state.encounters.discardPile,
        ...expiredArrivals.map((arrival) => arrival.cardId),
        ...expiredRoundBoons
          .map((boon) => boon.cardId)
          .filter((cardId) => !state.encounters.discardPile.includes(cardId))
      ],
      faceUpBoons: shouldSeed
        ? state.encounters.faceUpBoons.filter(
            (boon) =>
              encounterById[boon.cardId]?.type === "goldenBoon" &&
              !expiredRoundBoons.some(
                (expired) => expired.cardId === boon.cardId
              )
          )
        : state.encounters.faceUpBoons.filter(
            (boon) =>
              !expiredRoundBoons.some(
                (expired) => expired.cardId === boon.cardId
              )
          )
    }
  };

  for (const expiredArrival of expiredArrivals) {
    const card = encounterById[expiredArrival.cardId];
    const hasValidTarget = nextState.map.placedTiles.some((tile) => tile.strain < 3);
    nextState = log(
      nextState,
      hasValidTarget
        ? `Arrival expired unresolved: ${card?.name ?? expiredArrival.cardId}. Choose a tile to receive 1 Strain.`
        : `Arrival expired unresolved: ${card?.name ?? expiredArrival.cardId}. No valid Strain target was available.`
    );
    nextState = queuePendingEffect(nextState, {
      sourceType: "card",
      ruleId: systemEffectRuleId("arrival-expired"),
      sourceId: expiredArrival.cardId,
      sourceName: card?.name ?? expiredArrival.cardId,
      title: `Arrival expired: ${card?.name ?? expiredArrival.cardId}`,
      effectText:
        "This Arrival expired unresolved. Place 1 Strain on a placed tile with fewer than 3 Strain.",
      detailText: card && card.type === "arrival" ? `Requirement: ${card.requirementText}` : undefined,
      requiresManualChoice: hasValidTarget
    });
  }

  nextState = {
    ...nextState,
    map: {
      placedTiles: nextState.map.placedTiles.map(refreshPassiveSupported)
    }
  };
  nextState = recalculatePassiveSupported(nextState);

  if (shouldSeed && nextState.encounters.activeBurdens.length > 0) {
    nextState = queueSeasonStartBurdenEffects(nextState);
  }

  nextState = log(
    nextState,
    gameEnd
      ? "Round 12 complete. Final scoring is ready."
      : `Round ${nextState.round} begins.`
  );
  return nextState;
}

import { resources, warehouseCap } from "../data/resources";
import { encounterById } from "../data/encounters";
import { mapById } from "../data/map";
import {
  cardEffectRuleId,
  getActiveEffectRule,
  getEffectRule,
  systemEffectRuleId,
  tileEffectRuleId
} from "../data/effectRules";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import { describeEffectControls } from "./effectControls";
import {
  arePlacedTilesAdjacent,
  getPlacedTileCategory,
  getPlacedTileName,
  getPlacedTileRenown,
  isPlacedTileAdjacentToCategory
} from "./placedTiles";
import {
  applyStrainToState,
  getStrainPlacementCapacity,
  getStrainPreventionPreview,
  removeStrainFromTile
} from "./strainRules";
import { recalculatePassiveSupported } from "./supportRules";
import {
  comparePlacedTilesByMapCoordinate,
  drawAndSelectTarget,
  updateTargetCardDiagnostic
} from "./targetCards";
import type {
  AlternativeEffectDefinition,
  EffectRule,
  ResourceGainChoiceDefinition,
  StrainCascadeRule,
  TileAdjustmentRule,
  TileTargetRule,
  TimerAdjustmentRule
} from "./effectRuleTypes";
import type {
  EffectAdjustment,
  GameState,
  PendingEffectState,
  PlacedTile,
  ResourceType,
  TargetCardSelectionDiagnostic,
  Terrain,
  TileCategory
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasResourceChanges(adjustment: EffectAdjustment): boolean {
  return resources.some((resource) => (adjustment.resourceDeltas?.[resource] ?? 0) !== 0);
}

function hasRecordChanges(record: Record<string, number> | undefined): boolean {
  return Object.values(record ?? {}).some((value) => value !== 0);
}

function hasStringRecordChanges(record: Record<string, string> | undefined): boolean {
  return Object.values(record ?? {}).some(Boolean);
}

export function hasWardenReliefTarget(state: GameState): boolean {
  return state.map.placedTiles.some(
    (tile) =>
      tile.strain > 0 || (!tile.support.passive && !tile.support.singleUse)
  );
}

export function isWardenReliefAdjustmentValid(
  state: GameState,
  adjustment: EffectAdjustment
): boolean {
  if (
    hasResourceChanges(adjustment) ||
    hasRecordChanges(adjustment.arrivalTimerDeltas) ||
    hasStringRecordChanges(adjustment.stewardHexUpdates) ||
    hasStringRecordChanges(adjustment.temporaryReachHexUpdates) ||
    Boolean(adjustment.strainCascadeAnchorTileId) ||
    Boolean(adjustment.ignoredBurdenIds?.length) ||
    Boolean(adjustment.resolvedBurdenIds?.length)
  ) {
    return false;
  }

  const strainDeltas = Object.values(adjustment.tileStrainDeltas ?? {});
  const supportIds = [...new Set(adjustment.supportTileIds ?? [])];
  const supportCount = supportIds.length;
  const strainRemovalCount = strainDeltas.reduce(
    (total, delta) => total + (delta < 0 ? Math.abs(delta) : 0),
    0
  );
  const hasInvalidStrainDelta = strainDeltas.some((delta) => delta > 0 || delta < -1);

  if (hasInvalidStrainDelta) return false;
  if (!hasWardenReliefTarget(state)) {
    return supportCount + strainRemovalCount === 0;
  }

  const supportIsLegal = supportIds.every((tileId) => {
    const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === tileId);
    return Boolean(tile && !tile.support.passive && !tile.support.singleUse);
  });
  const strainRemovalIsLegal = Object.entries(
    adjustment.tileStrainDeltas ?? {}
  ).every(([tileId, delta]) => {
    if (delta === 0) return true;
    const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === tileId);
    return Boolean(tile && delta === -1 && tile.strain > 0);
  });

  return supportIsLegal && strainRemovalIsLegal &&
    supportCount + strainRemovalCount === 1;
}

export function isResourceExchangeAdjustmentValid(
  state: Pick<GameState, "warehouse">,
  ruleId: string | undefined,
  adjustment: EffectAdjustment,
  exchangeLimit: number,
  optional = false
): boolean {
  if (
    resources.some(
      (resource) =>
        Math.max(0, -(adjustment.resourceDeltas?.[resource] ?? 0)) >
        state.warehouse[resource]
    )
  ) {
    return false;
  }

  const spent = resources.reduce(
    (total, resource) => total + Math.max(0, -(adjustment.resourceDeltas?.[resource] ?? 0)),
    0
  );
  const gained = resources.reduce(
    (total, resource) => total + Math.max(0, adjustment.resourceDeltas?.[resource] ?? 0),
    0
  );

  if (spent === 0 && gained === 0) return optional;
  const isAlchemistGoodsMode = getEffectRule(ruleId).exchangeGoodsMode === true;
  if (isAlchemistGoodsMode) {
    const goodsGain = Math.max(0, adjustment.resourceDeltas?.goods ?? 0);
    const otherGain = resources
      .filter((resource) => resource !== "goods")
      .reduce(
        (total, resource) =>
          total + Math.max(0, adjustment.resourceDeltas?.[resource] ?? 0),
        0
      );
    if (spent === 5 && goodsGain === 3 && otherGain === 0) return true;
  }

  const gainsGoods = (adjustment.resourceDeltas?.goods ?? 0) > 0;
  return (
    spent > 0 &&
    spent === gained &&
    spent <= exchangeLimit &&
    (!isAlchemistGoodsMode || !gainsGoods)
  );
}

export function hasEffectAdjustment(adjustment: EffectAdjustment): boolean {
  return (
    hasResourceChanges(adjustment) ||
    hasRecordChanges(adjustment.arrivalTimerDeltas) ||
    hasRecordChanges(adjustment.tileStrainDeltas) ||
    Boolean(adjustment.strainCascadeAnchorTileId) ||
    Boolean(adjustment.supportTileIds?.length) ||
    hasStringRecordChanges(adjustment.stewardHexUpdates) ||
    hasStringRecordChanges(adjustment.temporaryReachHexUpdates) ||
    Boolean(adjustment.ignoredBurdenIds?.length) ||
    Boolean(adjustment.resolvedBurdenIds?.length)
  );
}

export function queuePendingEffect(
  state: GameState,
  effect: Omit<PendingEffectState, "id">
): GameState {
  return preparePendingEffectQueueHead({
    ...state,
    pendingEffects: [
      ...state.pendingEffects,
      {
        ...effect,
        controlHints: effect.controlHints ?? describeEffectControls(effect.ruleId),
        id: `effect_${state.pendingEffects.length + state.log.length + 1}_${Date.now()}`
      }
    ]
  });
}

export function queuePendingEffectFirst(
  state: GameState,
  effect: Omit<PendingEffectState, "id">
): GameState {
  return preparePendingEffectQueueHead({
    ...state,
    pendingEffects: [
      {
        ...effect,
        controlHints: effect.controlHints ?? describeEffectControls(effect.ruleId),
        id: `effect_${state.pendingEffects.length + state.log.length + 1}_${Date.now()}`
      },
      ...state.pendingEffects
    ]
  });
}

const overstrainSpreadRuleId = systemEffectRuleId("overstrain-spread");

function queueOverstrainSpreadEffects(
  state: GameState,
  sourceTileIds: string[]
): GameState {
  const sourceTiles = sourceTileIds
    .map((sourceTileId) =>
      state.map.placedTiles.find((tile) => tile.instanceId === sourceTileId)
    )
    .filter((tile): tile is PlacedTile => Boolean(tile))
    .sort(comparePlacedTilesByMapCoordinate);
  const spreadEffects: PendingEffectState[] = [];

  for (const sourceTile of sourceTiles) {
    if (
      sourceTile.strain < 3 ||
      getValidEffectStrainTargets(
        state,
        overstrainSpreadRuleId,
        sourceTile
      ).length === 0
    ) {
      continue;
    }

    const sourceName = getPlacedTileName(sourceTile);
    spreadEffects.push({
      id: `effect_${state.pendingEffects.length + state.log.length + spreadEffects.length + 1}_${Date.now()}`,
      sourceType: "tile",
      ruleId: overstrainSpreadRuleId,
      sourceId: sourceTile.instanceId,
      sourceName,
      title: `Overstrain chain: ${sourceName}`,
      effectText:
        "This tile just became Overstrained. After the triggering effect finishes, it spreads 1 Strain to one adjacent placed tile with fewer than 3 Strain.",
      detailText:
        "The Target Deck chooses the adjacent tile. If it becomes Overstrained, it joins the end of this chain.",
      resolutionLogMessage: `${sourceName} spread 1 Strain after becoming Overstrained.`,
      requiresManualChoice: false,
      confirmLabel: "Spread Strain"
    });
  }

  if (spreadEffects.length === 0) return state;
  const firstNonSpreadIndex = state.pendingEffects.findIndex(
    (effect) => effect.ruleId !== overstrainSpreadRuleId
  );
  const insertionIndex = firstNonSpreadIndex < 0
    ? state.pendingEffects.length
    : firstNonSpreadIndex;
  return preparePendingEffectQueueHead({
    ...state,
    pendingEffects: [
      ...state.pendingEffects.slice(0, insertionIndex),
      ...spreadEffects,
      ...state.pendingEffects.slice(insertionIndex)
    ]
  });
}

function discardBlockedOverstrainSpreadEffects(state: GameState): GameState {
  let nextState = state;

  while (nextState.pendingEffects[0]?.ruleId === overstrainSpreadRuleId) {
    const pendingEffect = nextState.pendingEffects[0];
    const sourceTile = pendingEffect.sourceId
      ? nextState.map.placedTiles.find(
          (tile) => tile.instanceId === pendingEffect.sourceId
        )
      : undefined;
    if (
      sourceTile &&
      sourceTile.strain >= 3 &&
      getValidEffectStrainTargets(
        nextState,
        overstrainSpreadRuleId,
        sourceTile
      ).length > 0
    ) {
      break;
    }
    nextState = {
      ...nextState,
      pendingEffects: nextState.pendingEffects.slice(1)
    };
  }

  return nextState;
}

export function getCurrentSeasonCardEffectText(
  state: Pick<GameState, "season">,
  cardId: string
): string {
  const card = encounterById[cardId];
  if (!card) return cardId;
  if (card.type === "arrival") return `Requirement: ${card.requirementText}`;
  if (card.type === "goldenBoon") return card.effectText;
  const key = state.season === 1 ? "season1" : state.season === 2 ? "season2" : "season3";
  return card.effects[key];
}

export function getCurrentSeasonCardEffectRuleId(
  state: Pick<GameState, "season">,
  cardId: string
): string {
  return cardEffectRuleId(cardId, state.season);
}

function isAdjacentToTerrain(tile: PlacedTile, terrain: Terrain): boolean {
  return tile.hexIds
    .flatMap((hexId) => getHexNeighbors(hexId))
    .some((hexId) => mapById[hexId]?.terrain === terrain);
}

function getStewardOccupiedTileTargets(state: GameState): PlacedTile[] {
  const stewardHexIds = new Set(state.players.map((player) => player.stewardHexId));
  return state.map.placedTiles.filter((tile) =>
    tile.hexIds.some((hexId) => stewardHexIds.has(hexId))
  );
}

function matchesTargetRule(
  state: GameState,
  tile: PlacedTile,
  rule: TileTargetRule,
  sourceTile?: PlacedTile
): boolean {
  if (rule.anyOf && !rule.anyOf.some((candidate) => matchesTargetRule(state, tile, candidate, sourceTile))) {
    return false;
  }
  if (rule.categories && !rule.categories.includes(getPlacedTileCategory(tile))) return false;
  if (rule.tileIds && !rule.tileIds.includes(tile.tileId)) return false;
  if (rule.sourceOnly && sourceTile?.instanceId !== tile.instanceId) return false;
  if (rule.side && tile.side !== rule.side) return false;
  if (rule.excludeSource && sourceTile?.instanceId === tile.instanceId) return false;
  if (rule.adjacentToSource && (!sourceTile || !arePlacedTilesAdjacent(tile, sourceTile))) return false;
  if (rule.adjacentToTerrain && !rule.adjacentToTerrain.some((terrain) => isAdjacentToTerrain(tile, terrain))) return false;
  if (rule.adjacentToCategories?.some((category) =>
    !isPlacedTileAdjacentToCategory(tile, state.map.placedTiles, category, { includeOverstrained: true })
  )) return false;
  if (rule.notAdjacentToCategories?.some((category) =>
    isPlacedTileAdjacentToCategory(tile, state.map.placedTiles, category, { includeOverstrained: true })
  )) return false;
  if (rule.adjacentToCategoryWithPositiveStrain) {
    const category = rule.adjacentToCategoryWithPositiveStrain;
    const hasMatchingNeighbor = state.map.placedTiles.some(
      (candidate) =>
        candidate.instanceId !== tile.instanceId &&
        candidate.strain > 0 &&
        getPlacedTileCategory(candidate) === category &&
        arePlacedTilesAdjacent(tile, candidate)
    );
    if (!hasMatchingNeighbor) return false;
  }
  if (rule.exactAdjacentCategoryCount) {
    const adjacentCount = state.map.placedTiles.filter(
      (candidate) =>
        candidate.instanceId !== tile.instanceId &&
        getPlacedTileCategory(candidate) === rule.exactAdjacentCategoryCount?.category &&
        arePlacedTilesAdjacent(tile, candidate)
    ).length;
    if (adjacentCount !== rule.exactAdjacentCategoryCount.count) return false;
  }
  if (rule.minAdjacentPlaced !== undefined) {
    const adjacentCount = state.map.placedTiles.filter(
      (candidate) =>
        candidate.instanceId !== tile.instanceId &&
        arePlacedTilesAdjacent(tile, candidate)
    ).length;
    if (adjacentCount < rule.minAdjacentPlaced) return false;
  }
  if (rule.hasRenown && getPlacedTileRenown(tile) <= 0) return false;
  if (rule.supported && !tile.support.passive && !tile.support.singleUse) return false;
  if (rule.stewardOccupied && !getStewardOccupiedTileTargets(state).some((candidate) => candidate.instanceId === tile.instanceId)) return false;
  if (
    rule.adjacentToStewardOccupied &&
    !getStewardOccupiedTileTargets(state).some(
      (candidate) =>
        candidate.instanceId !== tile.instanceId &&
        candidate.strain < 3 &&
        arePlacedTilesAdjacent(tile, candidate)
    )
  ) return false;
  if (rule.strain === "below3" && tile.strain >= 3) return false;
  if (rule.strain === "positive" && tile.strain <= 0) return false;
  if (rule.strain === "oneToTwo" && (tile.strain < 1 || tile.strain > 2)) return false;
  if (rule.strain === "zero" && tile.strain !== 0) return false;
  if (rule.strain === "overstrained" && tile.strain < 3) return false;
  return true;
}

function connectedGroupExists(
  state: GameState,
  definition: NonNullable<EffectRule["connectedGroup"]>
): boolean {
  const eligible = state.map.placedTiles.filter((tile) => tile.strain < 3);
  const remaining = new Set(eligible.map((tile) => tile.instanceId));

  while (remaining.size > 0) {
    const firstId = remaining.values().next().value as string;
    const stack = [firstId];
    const component: PlacedTile[] = [];
    remaining.delete(firstId);

    while (stack.length > 0) {
      const currentId = stack.pop();
      const current = eligible.find((tile) => tile.instanceId === currentId);
      if (!current) continue;
      component.push(current);
      for (const candidate of eligible) {
        if (
          remaining.has(candidate.instanceId) &&
          arePlacedTilesAdjacent(current, candidate)
        ) {
          remaining.delete(candidate.instanceId);
          stack.push(candidate.instanceId);
        }
      }
    }

    const categories = new Set(component.map(getPlacedTileCategory));
    const hasRequired = definition.requiredCategories.every((category) =>
      categories.has(category)
    );
    const hasAnyOf =
      !definition.anyOfCategories?.length ||
      definition.anyOfCategories.some((category) => categories.has(category));
    if (hasRequired && hasAnyOf) return true;
  }

  return false;
}

function canAffordRequiredFixedCosts(state: GameState, rule: EffectRule): boolean {
  if (!rule.mustAffordFixedCosts) return true;
  return resources.every((resource) => {
    const delta = rule.fixedResources?.[resource] ?? 0;
    return delta >= 0 || state.warehouse[resource] >= Math.abs(delta);
  });
}

function isEffectRuleAvailable(state: GameState, rule: EffectRule): boolean {
  return canAffordRequiredFixedCosts(state, rule) &&
    (!rule.connectedGroup || connectedGroupExists(state, rule.connectedGroup));
}

function targetsForDefinition(
  state: GameState,
  targetRule: TileTargetRule | undefined,
  sourceTile?: PlacedTile
): PlacedTile[] {
  if (!targetRule) return [];
  return state.map.placedTiles.filter((tile) => matchesTargetRule(state, tile, targetRule, sourceTile));
}

function activeRule(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): EffectRule {
  const rule = getEffectRule(ruleId);
  const primaryTarget = rule.strainCascade?.anchorTarget ?? rule.target;
  const hasTileTargets = !primaryTarget || targetsForDefinition(state, primaryTarget, sourceTile).length > 0;
  return getActiveEffectRule(rule, hasTileTargets, state.encounters.activeArrivals.length > 0);
}

export function getEffectTileTargets(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const rule = activeRule(state, ruleId, sourceTile);
  if (!isEffectRuleAvailable(state, rule)) return [];
  return targetsForDefinition(
    state,
    rule.strainCascade?.anchorTarget ?? rule.target,
    sourceTile
  );
}

export function getStrainCascadeRule(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): StrainCascadeRule | null {
  const rule = activeRule(state, ruleId, sourceTile);
  return isEffectRuleAvailable(state, rule) ? rule.strainCascade ?? null : null;
}

export function getStrainCascadeAnchorTargets(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const cascade = getStrainCascadeRule(state, ruleId, sourceTile);
  return cascade
    ? targetsForDefinition(state, cascade.anchorTarget, sourceTile)
    : [];
}

export function getStrainCascadeSpreadTargets(
  state: GameState,
  ruleId: string | undefined,
  anchorTileId: string | undefined,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const cascade = getStrainCascadeRule(state, ruleId, sourceTile);
  if (!cascade || !anchorTileId) return [];
  const anchor = getStrainCascadeAnchorTargets(state, ruleId, sourceTile).find(
    (tile) => tile.instanceId === anchorTileId
  );
  if (!anchor) return [];
  return state.map.placedTiles.filter(
    (tile) =>
      tile.instanceId !== anchor.instanceId &&
      tile.strain < 3 &&
      arePlacedTilesAdjacent(tile, anchor) &&
      matchesTargetRule(state, tile, cascade.spreadTarget, sourceTile)
  );
}

export function getEffectSupportTargets(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const rule = activeRule(state, ruleId, sourceTile);
  if (!isEffectRuleAvailable(state, rule)) return [];
  let targets: PlacedTile[];
  if (rule.supportTarget === "housingAdjacentToPrimary") {
    const primary = targetsForDefinition(state, rule.target, sourceTile);
    targets = state.map.placedTiles.filter(
      (candidate) =>
        getPlacedTileCategory(candidate) === "housing" &&
        primary.some((tile) => arePlacedTilesAdjacent(candidate, tile))
    );
  } else {
    targets = targetsForDefinition(state, rule.supportTarget ?? rule.target, sourceTile);
  }
  return targets.filter((tile) => !tile.support.passive && !tile.support.singleUse);
}

export type { TileAdjustmentRule, TimerAdjustmentRule } from "./effectRuleTypes";

export function getTileAdjustmentRule(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): TileAdjustmentRule {
  return activeRule(state, ruleId, sourceTile).tileAdjustment ?? {};
}

export function getValidEffectStrainTargets(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const rule = getTileAdjustmentRule(state, ruleId, sourceTile).strain;
  if (!rule) return [];
  return getEffectTileTargets(state, ruleId, sourceTile).filter((tile) =>
    rule.direction === "remove" ? tile.strain > 0 : tile.strain < 3
  );
}

export function isTileAdjustmentValid(
  state: GameState,
  ruleId: string | undefined,
  adjustment: EffectAdjustment,
  sourceTile?: PlacedTile
): boolean {
  const helpStandsRule = getHelpStandsRule(state, ruleId);
  const rule = getTileAdjustmentRule(state, ruleId, sourceTile);
  const cascade = getStrainCascadeRule(state, ruleId, sourceTile);
  const strainEntries = Object.entries(adjustment.tileStrainDeltas ?? {}).filter(([, delta]) => delta !== 0);
  const supportIds = [...new Set(adjustment.supportTileIds ?? [])];

  if (cascade) {
    const anchorTileId = adjustment.strainCascadeAnchorTileId;
    const legalAnchorIds = new Set(
      getStrainCascadeAnchorTargets(state, ruleId, sourceTile).map((tile) => tile.instanceId)
    );
    if (legalAnchorIds.size === 0) {
      return !anchorTileId && strainEntries.length === 0 && supportIds.length === 0;
    }
    if (!anchorTileId || !legalAnchorIds.has(anchorTileId) || supportIds.length > 0) {
      return false;
    }
    const legalSpreadTargets = getStrainCascadeSpreadTargets(
      state,
      ruleId,
      anchorTileId,
      sourceTile
    );
    const legalSpreadIds = new Set(legalSpreadTargets.map((tile) => tile.instanceId));
    const requiredSpreadTargets = Math.min(
      cascade.maxSpreadTargets,
      legalSpreadTargets.length
    );
    return strainEntries.length === requiredSpreadTargets &&
      strainEntries.every(
        ([tileId, delta]) => legalSpreadIds.has(tileId) && delta === cascade.spreadStrain
      );
  }
  if (adjustment.strainCascadeAnchorTileId) return false;

  if (helpStandsRule) {
    const requiredEntries = Object.entries(helpStandsRule.tileStrainDeltas);
    return supportIds.length === 0 && strainEntries.length === requiredEntries.length &&
      requiredEntries.every(([tileId, delta]) => adjustment.tileStrainDeltas?.[tileId] === delta);
  }
  if (strainEntries.length > 0 && !rule.strain) return false;
  if (rule.strain) {
    const strainRule = rule.strain;
    const legalTargets = getValidEffectStrainTargets(state, ruleId, sourceTile);
    const legalIds = new Set(legalTargets.map((tile) => tile.instanceId));
    const total = strainEntries.reduce((sum, [, delta]) => sum + Math.abs(delta), 0);
    if (strainEntries.length > strainRule.maxTargets || total > strainRule.maxTotal) return false;
    for (const [tileId, delta] of strainEntries) {
      if (!legalIds.has(tileId) || Math.abs(delta) > strainRule.maxPerTile) return false;
      if (strainRule.direction === "place" && delta < 0) return false;
      if (strainRule.direction === "remove" && delta > 0) return false;
      const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === tileId);
      if (!tile) return false;
      if (strainRule.direction === "remove" && Math.abs(delta) > tile.strain) return false;
      if (
        strainRule.direction === "place" &&
        delta > getStrainPlacementCapacity(state, tile, strainRule.maxPerTile)
      ) return false;
    }

    const achievableCapacities = legalTargets
      .map((tile) => Math.min(
        strainRule.maxPerTile,
        strainRule.direction === "remove"
          ? tile.strain
          : getStrainPlacementCapacity(state, tile, strainRule.maxPerTile)
      ))
      .sort((a, b) => b - a)
      .slice(0, strainRule.maxTargets);
    const requiredTargets = Math.min(
      strainRule.requiredTargets ?? 0,
      achievableCapacities.length
    );
    const requiredTotal = Math.min(
      strainRule.requiredTotal ?? 0,
      strainRule.maxTotal,
      achievableCapacities.reduce((sum, capacity) => sum + capacity, 0)
    );
    if (strainEntries.length < requiredTargets || total < requiredTotal) return false;

    if (strainRule.categoryLimits) {
      for (const [category, limits] of Object.entries(
        strainRule.categoryLimits
      )) {
        if (!limits) continue;
        const availableInCategory = legalTargets.filter(
          (tile) => getPlacedTileCategory(tile) === category
        ).length;
        const requiredInCategory = Math.min(
          limits.min ?? 0,
          limits.max,
          availableInCategory
        );
        const count = strainEntries.filter(([tileId]) => {
          const tile = state.map.placedTiles.find(
            (candidate) => candidate.instanceId === tileId
          );
          return tile && getPlacedTileCategory(tile) === category;
        }).length;
        if (count > limits.max || count < requiredInCategory) return false;
      }
    }
    if (
      strainRule.maxStewardOccupiedTargets !== undefined ||
      strainRule.maxOtherTargets !== undefined ||
      strainRule.linkedStewardTargets !== undefined
    ) {
      const stewardIds = new Set(
        getStewardOccupiedTileTargets(state).map((tile) => tile.instanceId)
      );
      const stewardCount = strainEntries.filter(([tileId]) =>
        stewardIds.has(tileId)
      ).length;
      const otherCount = strainEntries.length - stewardCount;
      if (
        stewardCount >
          (strainRule.maxStewardOccupiedTargets ?? Number.MAX_SAFE_INTEGER) ||
        otherCount > (strainRule.maxOtherTargets ?? Number.MAX_SAFE_INTEGER)
      ) return false;

      if (strainRule.linkedStewardTargets) {
        const selectedStewardTiles = strainEntries
          .filter(([tileId]) => stewardIds.has(tileId))
          .map(([tileId]) => state.map.placedTiles.find(
            (tile) => tile.instanceId === tileId
          ))
          .filter((tile): tile is PlacedTile => Boolean(tile));
        const selectedOtherEntries = strainEntries.filter(
          ([tileId]) => !stewardIds.has(tileId)
        );
        const everyOtherTargetIsLinked = selectedOtherEntries.every(
          ([tileId]) => {
            const tile = state.map.placedTiles.find(
              (candidate) => candidate.instanceId === tileId
            );
            return Boolean(
              tile && selectedStewardTiles.some(
                (stewardTile) => arePlacedTilesAdjacent(tile, stewardTile)
              )
            );
          }
        );
        if (!everyOtherTargetIsLinked) return false;

        const availableLinkedOtherTargets = legalTargets.filter(
          (tile) =>
            !stewardIds.has(tile.instanceId) &&
            selectedStewardTiles.some(
              (stewardTile) => arePlacedTilesAdjacent(tile, stewardTile)
            )
        ).length;
        const requiredOtherTargets = Math.min(
          strainRule.linkedStewardTargets.requiredOtherTargetsIfAvailable ?? 0,
          strainRule.maxOtherTargets ?? Number.MAX_SAFE_INTEGER,
          availableLinkedOtherTargets
        );
        if (selectedOtherEntries.length < requiredOtherTargets) return false;
      }
    }
  }
  if (supportIds.length > 0) {
    if (!rule.support || supportIds.length > rule.support.maxTargets) return false;
    const legalIds = new Set(getEffectSupportTargets(state, ruleId, sourceTile).map((tile) => tile.instanceId));
    if (supportIds.some((tileId) => !legalIds.has(tileId))) return false;
  }
  if (rule.supportCoversStrainTargets) {
    const supportedIds = new Set(supportIds);
    const everyStrainTargetIsSupported = strainEntries.every(([tileId]) => {
      if (supportedIds.has(tileId)) return true;
      const tile = state.map.placedTiles.find(
        (candidate) => candidate.instanceId === tileId
      );
      return Boolean(tile?.support.passive || tile?.support.singleUse);
    });
    if (!everyStrainTargetIsSupported) return false;
  }
  return true;
}

function fixedResourceDeltas(state: GameState, rule: EffectRule): Partial<Record<ResourceType, number>> {
  if (!isEffectRuleAvailable(state, rule)) return {};
  return Object.fromEntries(
    Object.entries(rule.fixedResources ?? {}).map(([resource, delta]) => [
      resource,
      delta < 0 ? -Math.min(Math.abs(delta), state.warehouse[resource as ResourceType]) : delta
    ])
  );
}

export function isFixedResourceAdjustmentValid(
  state: GameState,
  ruleId: string | undefined,
  adjustment: EffectAdjustment,
  sourceTile?: PlacedTile
): boolean {
  const rule = activeRule(state, ruleId, sourceTile);
  if (!rule.fixedResources) return true;
  const expected = fixedResourceDeltas(state, rule);
  return resources.every(
    (resource) =>
      (adjustment.resourceDeltas?.[resource] ?? 0) ===
      (expected[resource] ?? 0)
  );
}

export function getTimerAdjustmentRule(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): TimerAdjustmentRule | null {
  return activeRule(state, ruleId, sourceTile).timer ?? null;
}

export function isTimerAdjustmentValid(
  state: GameState,
  ruleId: string | undefined,
  timerDeltas: Record<string, number> | undefined,
  sourceTile?: PlacedTile
): boolean {
  const rule = getTimerAdjustmentRule(state, ruleId, sourceTile);
  if (!rule || !timerDeltas) return true;
  const arrivals = new Map(state.encounters.activeArrivals.map((arrival) => [arrival.cardId, arrival]));
  let total = 0;
  let targets = 0;
  for (const [cardId, delta] of Object.entries(timerDeltas)) {
    if (delta === 0) continue;
    const arrival = arrivals.get(cardId);
    if (!arrival) return false;
    targets += 1;
    if (rule.direction === "add") {
      if (delta < 0 || delta > 3 - arrival.timerTokens) return false;
      total += delta;
    } else {
      if (delta > 0 || Math.abs(delta) > arrival.timerTokens) return false;
      total += Math.abs(delta);
    }
  }
  return total <= rule.limit && targets <= (rule.maxTargets ?? rule.limit);
}

export type AlternativeEffectRule = AlternativeEffectDefinition;
export interface ResourceGainChoiceRule extends ResourceGainChoiceDefinition {}
export interface HelpStandsRule {
  resourceAmount: number;
  tileStrainDeltas: Record<string, number>;
}

export function getHelpStandsRule(state: GameState, ruleId: string | undefined): HelpStandsRule | null {
  const definition = activeRule(state, ruleId).helpStands;
  if (!definition) return null;
  const occupiedTiles = getStewardOccupiedTileTargets(state);
  const unstrainedCount = occupiedTiles.filter((tile) => tile.strain === 0).length;
  return {
    resourceAmount: Math.min(definition.cap, unstrainedCount * definition.gainPerUnstrained),
    tileStrainDeltas: Object.fromEntries(
      occupiedTiles.filter((tile) => tile.strain > 0).map((tile) => [tile.instanceId, -1])
    )
  };
}

export function getResourceGainChoiceRule(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): ResourceGainChoiceRule | null {
  const help = getHelpStandsRule(state, ruleId);
  if (help) return { resources: [...resources], amount: help.resourceAmount };
  return activeRule(state, ruleId, sourceTile).resourceGainChoice ?? null;
}

export function isResourceGainChoiceAdjustmentValid(
  state: GameState,
  ruleId: string | undefined,
  adjustment: EffectAdjustment,
  sourceTile?: PlacedTile
): boolean {
  const rule = getResourceGainChoiceRule(state, ruleId, sourceTile);
  if (!rule) return true;
  const strainRemoved = Object.values(adjustment.tileStrainDeltas ?? {}).reduce(
    (total, delta) => total + Math.max(0, -delta), 0
  );
  const gainsAreLegal = resources.every((resource) => {
    const delta = adjustment.resourceDeltas?.[resource] ?? 0;
    return delta >= 0 && (rule.resources.includes(resource) || delta === 0);
  });
  if (!gainsAreLegal) return false;
  const totalGain = rule.resources.reduce(
    (total, resource) => total + Math.max(0, adjustment.resourceDeltas?.[resource] ?? 0), 0
  );
  if (rule.alternativeToStrainRemoval && strainRemoved > 0) return totalGain === 0;
  return rule.upTo ? totalGain <= rule.amount : totalGain === rule.amount;
}

export function getAlternativeEffectRule(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): AlternativeEffectRule | null {
  const rule = activeRule(state, ruleId, sourceTile);
  if (!rule.alternative) return null;
  if (rule.alternative.kind === "pay_or_timer") {
    return { ...rule.alternative, requiredChoices: Math.min(rule.alternative.requiredChoices, state.encounters.activeArrivals.length) };
  }
  if (rule.alternative.kind === "pay_or_strain") {
    return { ...rule.alternative, requiredChoices: Math.min(rule.alternative.requiredChoices, getValidEffectStrainTargets(state, ruleId, sourceTile).length) };
  }
  const alternative =
    rule.alternative.kind === "most_stocked_loss_then_strain"
      ? {
          ...rule.alternative,
          resources: rule.alternative.resources.filter((resource) => {
            const maximum = Math.max(
              ...rule.alternative!.resources.map(
                (candidate) => state.warehouse[candidate]
              )
            );
            return state.warehouse[resource] === maximum;
          })
        }
      : rule.alternative;
  const tileRule = rule.tileAdjustment?.strain;
  const legalTargets = getValidEffectStrainTargets(state, ruleId, sourceTile);
  const requiredStrainTotal = tileRule
    ? legalTargets
        .map((tile) => getStrainPlacementCapacity(state, tile, tileRule.maxPerTile))
        .sort((a, b) => b - a)
        .slice(0, tileRule.maxTargets)
        .reduce((total, capacity) => total + capacity, 0)
    : alternative.requiredStrainTotal;
  return { ...alternative, requiredStrainTotal };
}

function resourceSpend(adjustment: EffectAdjustment, resource: ResourceType): number {
  return Math.max(0, -(adjustment.resourceDeltas?.[resource] ?? 0));
}

function hasOnlyAllowedResourceSpending(
  state: GameState,
  adjustment: EffectAdjustment,
  allowed: ResourceType[]
): boolean {
  return resources.every((resource) => {
    const delta = adjustment.resourceDeltas?.[resource] ?? 0;
    return delta <= 0 && Math.abs(delta) <= state.warehouse[resource] &&
      (allowed.includes(resource) || delta === 0);
  });
}

export function isAlternativeEffectAdjustmentValid(
  state: GameState,
  ruleId: string | undefined,
  adjustment: EffectAdjustment,
  sourceTile?: PlacedTile,
  requiredStrainTotalOverride?: number
): boolean {
  const rule = getAlternativeEffectRule(state, ruleId, sourceTile);
  if (!rule) return true;
  if (!hasOnlyAllowedResourceSpending(state, adjustment, rule.resources)) return false;
  const totalSpent = rule.resources.reduce((total, resource) => total + resourceSpend(adjustment, resource), 0);
  const strainEntries = Object.values(adjustment.tileStrainDeltas ?? {}).filter((delta) => delta !== 0);
  const totalStrain = strainEntries.reduce((total, delta) => total + Math.max(0, delta), 0);
  const totalTimersRemoved = Object.values(adjustment.arrivalTimerDeltas ?? {}).reduce(
    (total, delta) => total + Math.max(0, -delta), 0
  );
  if (rule.kind === "pay_or_strain") {
    if (totalTimersRemoved > 0 || totalSpent % rule.resourceStep !== 0) return false;
    if (strainEntries.some((delta) => delta !== rule.strainPerChoice)) return false;
    return totalSpent / rule.resourceStep + totalStrain / rule.strainPerChoice === rule.requiredChoices;
  }
  if (rule.kind === "pay_or_timer") {
    if (totalStrain > 0 || totalSpent % rule.resourceStep !== 0) return false;
    if (Object.values(adjustment.arrivalTimerDeltas ?? {}).some(
      (delta) => delta !== 0 && delta !== -rule.timerPerChoice
    )) return false;
    return totalSpent / rule.resourceStep + totalTimersRemoved / rule.timerPerChoice === rule.requiredChoices;
  }
  if (rule.kind === "pay_total_or_strain") {
    const paymentBranch =
      totalSpent === rule.resourceStep && totalStrain === 0;
    const strainBranch =
      totalSpent === 0 && totalStrain === (
        requiredStrainTotalOverride ?? rule.requiredStrainTotal
      );
    return totalTimersRemoved === 0 && (paymentBranch || strainBranch);
  }
  if (rule.kind === "most_stocked_loss_then_strain") {
    const expectedLoss = Math.min(
      rule.resourceStep,
      Math.max(...rule.resources.map((resource) => state.warehouse[resource]))
    );
    const losingResources = rule.resources.filter(
      (resource) => resourceSpend(adjustment, resource) > 0
    );
    const lossIsValid =
      totalSpent === expectedLoss &&
      (expectedLoss === 0 ? losingResources.length === 0 : losingResources.length === 1);
    const strainRequired =
      rule.strainWhen === "noneLost"
        ? expectedLoss === 0
        : expectedLoss < rule.resourceStep;
    return totalTimersRemoved === 0 && lossIsValid &&
      totalStrain === (strainRequired
        ? requiredStrainTotalOverride ?? rule.requiredStrainTotal
        : 0);
  }
  const paymentBranch = totalSpent === rule.resourceStep && totalStrain === 0 &&
    rule.resources.filter((resource) => resourceSpend(adjustment, resource) > 0).length === 1;
  const strainBranchAvailable = rule.resources.some((resource) => state.warehouse[resource] < rule.resourceStep);
  const strainBranch = totalSpent === 0 && strainBranchAvailable &&
    totalStrain === (requiredStrainTotalOverride ?? rule.requiredStrainTotal);
  return paymentBranch || strainBranch;
}

function hasAnyAlternativeEffectOutcome(state: GameState, rule: AlternativeEffectRule): boolean {
  if (rule.kind === "pay_or_strain") return rule.requiredChoices > 0;
  if (rule.kind === "pay_or_timer") {
    const payable = Math.floor(state.warehouse[rule.resources[0]] / rule.resourceStep);
    const removable = state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens >= rule.timerPerChoice).length;
    return payable + removable >= rule.requiredChoices;
  }
  if (rule.kind === "pay_total_or_strain") {
    return rule.resources.some(
      (resource) => state.warehouse[resource] >= rule.resourceStep
    ) || rule.requiredStrainTotal > 0;
  }
  if (rule.kind === "most_stocked_loss_then_strain") {
    return rule.resources.some((resource) => state.warehouse[resource] > 0) ||
      rule.requiredStrainTotal > 0;
  }
  return rule.resources.some((resource) => state.warehouse[resource] >= rule.resourceStep) ||
    (rule.requiredStrainTotal > 0 && rule.resources.some((resource) => state.warehouse[resource] < rule.resourceStep));
}

export function effectHasNoValidChoiceTargets(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): boolean {
  const rule = activeRule(state, ruleId, sourceTile);
  if (!isEffectRuleAvailable(state, rule)) return true;
  if (
    rule.noEffectWhenNoTarget &&
    !rule.timer &&
    !rule.tileAdjustment &&
    !rule.strainCascade
  ) return true;
  if (rule.timer?.direction === "add" && !state.encounters.activeArrivals.some((arrival) => arrival.timerTokens < 3)) return true;
  if (rule.timer?.direction === "remove" && state.encounters.activeArrivals.length === 0 && rule.noEffectWhenNoTarget) return true;
  const alternative = getAlternativeEffectRule(state, ruleId, sourceTile);
  if (alternative) return !hasAnyAlternativeEffectOutcome(state, alternative);
  const resourceGain = getResourceGainChoiceRule(state, ruleId, sourceTile);
  if (resourceGain && resourceGain.amount > 0 && !resourceGain.alternativeToStrainRemoval) return false;
  if (rule.resolveBurden && state.encounters.activeBurdens.length === 0) return true;
  if (rule.strainCascade &&
      getStrainCascadeAnchorTargets(state, ruleId, sourceTile).length === 0 &&
      !rule.fixedResources && !rule.resourceGainChoice) return true;
  if ((rule.tileAdjustment?.strain || rule.tileAdjustment?.support) &&
      getValidEffectStrainTargets(state, ruleId, sourceTile).length === 0 &&
      getEffectSupportTargets(state, ruleId, sourceTile).length === 0 &&
      !rule.fixedResources && !rule.resourceGainChoice) return true;
  return false;
}

function timerSuggestion(state: GameState, rule: EffectRule): EffectAdjustment {
  if (!rule.timer || rule.timer.direction !== "add" || state.encounters.activeArrivals.length !== 1) return {};
  const arrival = state.encounters.activeArrivals[0];
  const delta = Math.min(rule.timer.limit, Math.max(0, 3 - arrival.timerTokens));
  return delta > 0 ? { arrivalTimerDeltas: { [arrival.cardId]: delta } } : {};
}

function strainSuggestion(state: GameState, ruleId: string | undefined, sourceTile?: PlacedTile): EffectAdjustment {
  const rule = getTileAdjustmentRule(state, ruleId, sourceTile).strain;
  const targets = getValidEffectStrainTargets(state, ruleId, sourceTile);
  if (!rule || targets.length !== 1) return {};
  const tile = targets[0];
  const capacity = rule.direction === "remove"
    ? tile.strain
    : getStrainPlacementCapacity(state, tile, rule.maxPerTile);
  const amount = Math.min(rule.maxTotal, rule.maxPerTile, capacity);
  return amount > 0 ? { tileStrainDeltas: { [tile.instanceId]: rule.direction === "remove" ? -amount : amount } } : {};
}

function strainCascadeSuggestion(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): EffectAdjustment {
  const cascade = getStrainCascadeRule(state, ruleId, sourceTile);
  const anchors = getStrainCascadeAnchorTargets(state, ruleId, sourceTile);
  if (!cascade || anchors.length !== 1) return {};
  const anchorTileId = anchors[0].instanceId;
  const spreadTargets = getStrainCascadeSpreadTargets(
    state,
    ruleId,
    anchorTileId,
    sourceTile
  );
  return {
    strainCascadeAnchorTileId: anchorTileId,
    tileStrainDeltas: spreadTargets.length <= cascade.maxSpreadTargets
      ? Object.fromEntries(
          spreadTargets.map((tile) => [tile.instanceId, cascade.spreadStrain])
        )
      : undefined
  };
}

function supportSuggestion(state: GameState, ruleId: string | undefined, sourceTile?: PlacedTile): EffectAdjustment {
  const rule = getTileAdjustmentRule(state, ruleId, sourceTile).support;
  const targets = getEffectSupportTargets(state, ruleId, sourceTile);
  return rule && targets.length === 1 ? { supportTileIds: [targets[0].instanceId] } : {};
}

export function suggestEffectAdjustment(
  state: GameState,
  ruleId: string | undefined,
  sourceTile?: PlacedTile
): { adjustment?: EffectAdjustment; requiresManualChoice?: boolean } {
  const rule = activeRule(state, ruleId, sourceTile);
  if (!isEffectRuleAvailable(state, rule)) {
    return { requiresManualChoice: false };
  }
  const help = getHelpStandsRule(state, ruleId);
  if (help) {
    const adjustment = Object.keys(help.tileStrainDeltas).length ? { tileStrainDeltas: help.tileStrainDeltas } : undefined;
    return { adjustment, requiresManualChoice: help.resourceAmount > 0 };
  }
  let adjustment = mergeEffectAdjustment(
    { resourceDeltas: fixedResourceDeltas(state, rule) },
    timerSuggestion(state, rule)
  );
  adjustment = mergeEffectAdjustment(adjustment, strainCascadeSuggestion(state, ruleId, sourceTile));
  adjustment = mergeEffectAdjustment(adjustment, strainSuggestion(state, ruleId, sourceTile));
  adjustment = mergeEffectAdjustment(adjustment, supportSuggestion(state, ruleId, sourceTile));
  if (rule.resolveBurden && state.encounters.activeBurdens.length === 1) {
    adjustment = mergeEffectAdjustment(adjustment, { resolvedBurdenIds: [state.encounters.activeBurdens[0]] });
  }
  if (rule.alternative) {
    adjustment = { ...adjustment, resourceDeltas: {}, arrivalTimerDeltas: {}, tileStrainDeltas: {} };
  }
  const finalAdjustment = hasEffectAdjustment(adjustment) ? adjustment : undefined;
  const strainTargets = getValidEffectStrainTargets(state, ruleId, sourceTile).length;
  const supportTargets = getEffectSupportTargets(state, ruleId, sourceTile).length;
  const timerTargets = state.encounters.activeArrivals.length;
  const cascade = getStrainCascadeRule(state, ruleId, sourceTile);
  const cascadeAnchors = getStrainCascadeAnchorTargets(state, ruleId, sourceTile);
  const cascadeSpreadTargets = finalAdjustment?.strainCascadeAnchorTileId
    ? getStrainCascadeSpreadTargets(
        state,
        ruleId,
        finalAdjustment.strainCascadeAnchorTileId,
        sourceTile
      ).length
    : 0;
  const cascadeNeedsChoice = Boolean(
    cascade &&
      (cascadeAnchors.length > 1 || cascadeSpreadTargets > cascade.maxSpreadTargets)
  );
  const requiresManualChoice = Boolean(rule.manualChoice && (
    rule.exchangeLimit !== undefined || rule.resourceGainChoice || rule.alternative ||
    strainTargets > 1 || supportTargets > 1 || cascadeNeedsChoice ||
    (rule.timer && timerTargets > 1) ||
    (rule.resolveBurden && state.encounters.activeBurdens.length > 1) ||
    (!finalAdjustment && !effectHasNoValidChoiceTargets(state, ruleId, sourceTile))
  ));
  return { adjustment: finalAdjustment, requiresManualChoice };
}

function getPendingEffectSourceTile(
  state: GameState,
  pendingEffect: PendingEffectState
): PlacedTile | undefined {
  return pendingEffect.sourceType === "tile" && pendingEffect.sourceId
    ? state.map.placedTiles.find(
        (tile) => tile.instanceId === pendingEffect.sourceId
      )
    : undefined;
}

function targetCardAlternativeCanPlaceStrain(
  state: GameState,
  alternative: AlternativeEffectRule | null
): boolean {
  if (!alternative) return true;
  if (alternative.kind === "pay_or_strain" || alternative.kind === "pay_total_or_strain") {
    return alternative.requiredChoices > 0;
  }
  if (alternative.kind === "warehouse_loss_or_strain") {
    return alternative.resources.some(
      (resource) => state.warehouse[resource] < alternative.resourceStep
    );
  }
  if (alternative.kind === "most_stocked_loss_then_strain") {
    const stocked = Math.max(
      ...alternative.resources.map((resource) => state.warehouse[resource])
    );
    return alternative.strainWhen === "noneLost"
      ? stocked === 0
      : stocked < alternative.resourceStep;
  }
  return false;
}

function targetCardDesiredStrain(
  strainRule: NonNullable<TileAdjustmentRule["strain"]>,
  alternative: AlternativeEffectRule | null,
  printedAlternative: AlternativeEffectDefinition | undefined
): { total: number; targets: number } {
  if (alternative?.kind === "pay_or_strain") {
    return {
      total: alternative.requiredChoices * alternative.strainPerChoice,
      targets: alternative.requiredChoices
    };
  }
  if (
    alternative?.kind === "warehouse_loss_or_strain" ||
    alternative?.kind === "pay_total_or_strain" ||
    alternative?.kind === "most_stocked_loss_then_strain"
  ) {
    const printedTotal = printedAlternative?.kind === alternative.kind
      ? printedAlternative.requiredStrainTotal
      : alternative.requiredStrainTotal;
    return {
      total: printedTotal,
      targets: Math.min(
        strainRule.maxTargets,
        printedTotal
      )
    };
  }
  return {
    total: strainRule.maxTotal,
    targets: Math.min(strainRule.maxTargets, strainRule.maxTotal)
  };
}

function targetCardEffectStillNeedsPlayerDecision(rule: EffectRule): boolean {
  return Boolean(
    rule.alternative ||
    rule.timer ||
    rule.resourceGainChoice ||
    rule.exchangeLimit !== undefined ||
    rule.resolveBurden ||
    rule.tileAdjustment?.support
  );
}

interface PlannedTargetCardSelection {
  tile: PlacedTile;
  diagnostic: TargetCardSelectionDiagnostic;
}

function planDirectTargetCardStrain(
  state: GameState,
  pendingEffect: PendingEffectState,
  sourceTile: PlacedTile | undefined,
  rule: EffectRule,
  printedFallbackUsed: boolean
): {
  state: GameState;
  adjustment: EffectAdjustment;
  diagnostics: TargetCardSelectionDiagnostic[];
  targetTileIds: string[];
  plannedStrainByTileId: Record<string, number>;
} {
  const strainRule = getTileAdjustmentRule(
    state,
    pendingEffect.ruleId,
    sourceTile
  ).strain;
  const candidates = getValidEffectStrainTargets(
    state,
    pendingEffect.ruleId,
    sourceTile
  );
  const alternative = getAlternativeEffectRule(
    state,
    pendingEffect.ruleId,
    sourceTile
  );
  if (
    !strainRule ||
    strainRule.direction !== "place" ||
    candidates.length === 0 ||
    !targetCardAlternativeCanPlaceStrain(state, alternative)
  ) {
    return {
      state,
      adjustment: {},
      diagnostics: [],
      targetTileIds: [],
      plannedStrainByTileId: {}
    };
  }

  const desired = targetCardDesiredStrain(
    strainRule,
    alternative,
    rule.alternative
  );
  const desiredTargetCount = Math.min(
    desired.targets,
    strainRule.maxTargets,
    candidates.length
  );
  let planningState = state;
  let remainingCandidates = [...candidates];
  const selections: PlannedTargetCardSelection[] = [];

  const drawFrom = (pool: PlacedTile[]): boolean => {
    if (pool.length === 0 || selections.length >= desiredTargetCount) return false;
    const selected = drawAndSelectTarget(planningState, pool, {
      effectId: pendingEffect.id,
      sourceId: pendingEffect.sourceId,
      role: "target",
      printedFallbackUsed
    });
    if (!selected) return false;
    planningState = selected.state;
    selections.push({ tile: selected.tile, diagnostic: selected.diagnostic });
    remainingCandidates = remainingCandidates.filter(
      (candidate) => candidate.instanceId !== selected.tile.instanceId
    );
    return true;
  };

  if (strainRule.linkedStewardTargets) {
    const stewardIds = new Set(
      getStewardOccupiedTileTargets(state).map((tile) => tile.instanceId)
    );
    const maxStewardTargets = Math.min(
      strainRule.maxStewardOccupiedTargets ?? strainRule.maxTargets,
      desiredTargetCount
    );
    while (
      selections.length < maxStewardTargets &&
      drawFrom(
        remainingCandidates.filter((tile) => stewardIds.has(tile.instanceId))
      )
    ) {
      // Draw one card for each distinct Steward-occupied target.
    }

    const selectedStewardTiles = selections
      .map((selection) => selection.tile)
      .filter((tile) => stewardIds.has(tile.instanceId));
    const maxOtherTargets = Math.min(
      strainRule.maxOtherTargets ?? strainRule.maxTargets,
      desiredTargetCount - selections.length
    );
    let selectedOtherTargets = 0;
    while (selectedOtherTargets < maxOtherTargets) {
      const linkedPool = remainingCandidates.filter(
        (tile) =>
          !stewardIds.has(tile.instanceId) &&
          selectedStewardTiles.some((stewardTile) =>
            arePlacedTilesAdjacent(tile, stewardTile)
          )
      );
      if (!drawFrom(linkedPool)) break;
      selectedOtherTargets += 1;
    }
  } else {
    const selectedCategoryCounts = new Map<TileCategory, number>();
    const categoryLimits = strainRule.categoryLimits ?? {};
    for (const [category, limits] of Object.entries(categoryLimits) as Array<
      [TileCategory, { min?: number; max: number }]
    >) {
      const required = Math.min(
        limits.min ?? 0,
        remainingCandidates.filter(
          (tile) => getPlacedTileCategory(tile) === category
        ).length,
        desiredTargetCount - selections.length
      );
      for (let count = 0; count < required; count += 1) {
        if (!drawFrom(
          remainingCandidates.filter(
            (tile) => getPlacedTileCategory(tile) === category
          )
        )) break;
        selectedCategoryCounts.set(
          category,
          (selectedCategoryCounts.get(category) ?? 0) + 1
        );
      }
    }

    while (selections.length < desiredTargetCount) {
      const pool = remainingCandidates.filter((tile) => {
        const category = getPlacedTileCategory(tile);
        const limits = strainRule.categoryLimits?.[category];
        return !limits || (selectedCategoryCounts.get(category) ?? 0) < limits.max;
      });
      const beforeCount = selections.length;
      if (!drawFrom(pool)) break;
      const selectedCategory = getPlacedTileCategory(
        selections[selections.length - 1].tile
      );
      selectedCategoryCounts.set(
        selectedCategory,
        (selectedCategoryCounts.get(selectedCategory) ?? 0) + 1
      );
      if (selections.length === beforeCount) break;
    }
  }

  const plannedStrainByTileId: Record<string, number> = {};
  const diagnostics: TargetCardSelectionDiagnostic[] = [];
  let remainingTotal = desired.total;
  for (let index = 0; index < selections.length; index += 1) {
    const selection = selections[index];
    const remainingSlots = selections.length - index - 1;
    const amount = Math.max(
      0,
      Math.min(
        strainRule.maxPerTile,
        remainingTotal - remainingSlots
      )
    );
    if (amount <= 0) continue;
    remainingTotal -= amount;
    plannedStrainByTileId[selection.tile.instanceId] = amount;
    const diagnostic = { ...selection.diagnostic, plannedStrain: amount };
    diagnostics.push(diagnostic);
    planningState = updateTargetCardDiagnostic(
      planningState,
      diagnostic.id,
      { plannedStrain: amount }
    );
  }

  return {
    state: planningState,
    adjustment: { tileStrainDeltas: plannedStrainByTileId },
    diagnostics,
    targetTileIds: diagnostics.map((diagnostic) => diagnostic.selectedTileId),
    plannedStrainByTileId
  };
}

function planCascadeTargetCards(
  state: GameState,
  pendingEffect: PendingEffectState,
  sourceTile: PlacedTile | undefined,
  cascade: StrainCascadeRule,
  printedFallbackUsed: boolean
): {
  state: GameState;
  adjustment: EffectAdjustment;
  diagnostics: TargetCardSelectionDiagnostic[];
  targetTileIds: string[];
  plannedStrainByTileId: Record<string, number>;
} {
  const anchors = getStrainCascadeAnchorTargets(
    state,
    pendingEffect.ruleId,
    sourceTile
  );
  const primary = drawAndSelectTarget(state, anchors, {
    effectId: pendingEffect.id,
    sourceId: pendingEffect.sourceId,
    role: "primary",
    printedFallbackUsed
  });
  if (!primary) {
    return {
      state,
      adjustment: {},
      diagnostics: [],
      targetTileIds: [],
      plannedStrainByTileId: {}
    };
  }

  let planningState = primary.state;
  const allPrimaryCompletionCounts = anchors.map((anchor) => ({
    anchor,
    count: getStrainCascadeSpreadTargets(
      state,
      pendingEffect.ruleId,
      anchor.instanceId,
      sourceTile
    ).length
  }));
  let remainingSpreadTargets = getStrainCascadeSpreadTargets(
    state,
    pendingEffect.ruleId,
    primary.tile.instanceId,
    sourceTile
  );
  const spreadSelections: PlannedTargetCardSelection[] = [];
  while (
    spreadSelections.length < cascade.maxSpreadTargets &&
    remainingSpreadTargets.length > 0
  ) {
    const selected = drawAndSelectTarget(planningState, remainingSpreadTargets, {
      effectId: pendingEffect.id,
      sourceId: pendingEffect.sourceId,
      role: "spread",
      printedFallbackUsed
    });
    if (!selected) break;
    planningState = selected.state;
    spreadSelections.push({ tile: selected.tile, diagnostic: selected.diagnostic });
    remainingSpreadTargets = remainingSpreadTargets.filter(
      (tile) => tile.instanceId !== selected.tile.instanceId
    );
  }

  const selectedPrimaryCompletionCount = allPrimaryCompletionCounts.find(
    (entry) => entry.anchor.instanceId === primary.tile.instanceId
  )?.count ?? 0;
  const primaryPatch: Partial<TargetCardSelectionDiagnostic> = {
    plannedStrain: cascade.anchorStrain,
    linkedSecondaryAvailable: selectedPrimaryCompletionCount > 0,
    linkedSecondaryCompleted:
      selectedPrimaryCompletionCount >= cascade.maxSpreadTargets,
    alternatePrimaryWouldComplete:
      selectedPrimaryCompletionCount < cascade.maxSpreadTargets &&
      allPrimaryCompletionCounts.some(
        (entry) => entry.count >= cascade.maxSpreadTargets
      )
  };
  const primaryDiagnostic = { ...primary.diagnostic, ...primaryPatch };
  planningState = updateTargetCardDiagnostic(
    planningState,
    primaryDiagnostic.id,
    primaryPatch
  );

  const spreadDiagnostics = spreadSelections.map((selection) => ({
    ...selection.diagnostic,
    plannedStrain: cascade.spreadStrain
  }));
  for (const diagnostic of spreadDiagnostics) {
    planningState = updateTargetCardDiagnostic(
      planningState,
      diagnostic.id,
      { plannedStrain: cascade.spreadStrain }
    );
  }
  const plannedStrainByTileId = {
    ...(cascade.anchorStrain > 0
      ? { [primary.tile.instanceId]: cascade.anchorStrain }
      : {}),
    ...Object.fromEntries(
      spreadSelections.map((selection) => [
        selection.tile.instanceId,
        cascade.spreadStrain
      ])
    )
  };

  return {
    state: planningState,
    adjustment: {
      strainCascadeAnchorTileId: primary.tile.instanceId,
      tileStrainDeltas: Object.fromEntries(
        spreadSelections.map((selection) => [
          selection.tile.instanceId,
          cascade.spreadStrain
        ])
      )
    },
    diagnostics: [primaryDiagnostic, ...spreadDiagnostics],
    targetTileIds: [
      primary.tile.instanceId,
      ...spreadSelections.map((selection) => selection.tile.instanceId)
    ],
    plannedStrainByTileId
  };
}

/**
 * Consumes Target Cards only for the effect currently being shown. Effects
 * waiting behind it are prepared later, after earlier state changes settle.
 */
export function preparePendingEffectQueueHead(state: GameState): GameState {
  const pendingEffect = state.pendingEffects[0];
  if (
    !pendingEffect ||
    pendingEffect.targetCardPrepared
  ) return state;

  const sourceTile = getPendingEffectSourceTile(state, pendingEffect);
  const rule = activeRule(state, pendingEffect.ruleId, sourceTile);
  const cascade = getStrainCascadeRule(state, pendingEffect.ruleId, sourceTile);
  const strainRule = getTileAdjustmentRule(
    state,
    pendingEffect.ruleId,
    sourceTile
  ).strain;
  const sourceCard = pendingEffect.sourceId
    ? encounterById[pendingEffect.sourceId]
    : undefined;
  const isOptionalPlayerBenefit = sourceCard?.type === "boon" || rule.optional;
  if (
    isOptionalPlayerBenefit ||
    (!cascade && (!strainRule || strainRule.direction !== "place"))
  ) return state;

  const printedFallbackUsed = rule.id !== getEffectRule(pendingEffect.ruleId).id;
  const plan = cascade
    ? planCascadeTargetCards(
        state,
        pendingEffect,
        sourceTile,
        cascade,
        printedFallbackUsed
      )
    : planDirectTargetCardStrain(
        state,
        pendingEffect,
        sourceTile,
        rule,
        printedFallbackUsed
      );
  const generatedSuggestion = suggestEffectAdjustment(
    state,
    pendingEffect.ruleId,
    sourceTile
  ).adjustment;
  const baseSuggestion = pendingEffect.suggestedAdjustment ?? generatedSuggestion;
  const baseWithoutSuggestedStrain = baseSuggestion
    ? {
        ...baseSuggestion,
        strainCascadeAnchorTileId: undefined,
        tileStrainDeltas: Object.fromEntries(
          Object.entries(baseSuggestion.tileStrainDeltas ?? {}).filter(
            ([, delta]) => delta < 0
          )
        )
      }
    : undefined;
  const suggestedAdjustment = mergeEffectAdjustment(
    baseWithoutSuggestedStrain,
    plan.adjustment
  );
  const preparedEffect: PendingEffectState = {
    ...pendingEffect,
    targetCardPrepared: true,
    targetCardTargetTileIds: plan.targetTileIds,
    targetCardPlannedStrainByTileId: plan.plannedStrainByTileId,
    targetCardDiagnostics: plan.diagnostics,
    suggestedAdjustment: hasEffectAdjustment(suggestedAdjustment)
      ? suggestedAdjustment
      : undefined,
    requiresManualChoice: !targetCardEffectStillNeedsPlayerDecision(rule)
      ? false
      : pendingEffect.requiresManualChoice
  };

  const coordinateFallbacks = plan.diagnostics.filter(
    (diagnostic) => diagnostic.coordinateFallbackUsed
  );
  const preparedPlanState = coordinateFallbacks.length > 0
    ? {
        ...plan.state,
        log: [
          ...coordinateFallbacks.map((diagnostic, index) => ({
            id: `log_${plan.state.log.length + index + 1}_${Date.now()}`,
            round: plan.state.round,
            message: `Target Card ${diagnostic.cardId} used map-coordinate fallback after its ${diagnostic.direction} arrow remained tied.`
          })),
          ...plan.state.log
        ].slice(0, 80)
      }
    : plan.state;

  return {
    ...preparedPlanState,
    pendingEffects: [
      preparedEffect,
      ...preparedPlanState.pendingEffects.slice(1)
    ]
  };
}

function isTargetCardTileAdjustmentValid(
  state: GameState,
  pendingEffect: PendingEffectState,
  adjustment: EffectAdjustment,
  sourceTile?: PlacedTile
): boolean | null {
  if (!pendingEffect.targetCardPrepared) return null;
  const planned = pendingEffect.targetCardPlannedStrainByTileId ?? {};
  const targetIds = new Set(pendingEffect.targetCardTargetTileIds ?? []);
  if (targetIds.size === 0) return null;
  const entries = Object.entries(adjustment.tileStrainDeltas ?? {}).filter(
    ([, delta]) => delta !== 0
  );
  if (
    entries.some(
      ([tileId, delta]) =>
        !targetIds.has(tileId) ||
        delta < 0 ||
        delta > (planned[tileId] ?? 0)
    ) ||
    Boolean(adjustment.supportTileIds?.length)
  ) return false;

  const cascade = getStrainCascadeRule(
    state,
    pendingEffect.ruleId,
    sourceTile
  );
  if (cascade) {
    const expectedAnchor =
      pendingEffect.suggestedAdjustment?.strainCascadeAnchorTileId;
    if (adjustment.strainCascadeAnchorTileId !== expectedAnchor) return false;
    const expectedSpread = pendingEffect.suggestedAdjustment?.tileStrainDeltas ?? {};
    const actualSpread = adjustment.tileStrainDeltas ?? {};
    return Object.entries(expectedSpread).every(
      ([tileId, delta]) => actualSpread[tileId] === delta
    ) && entries.length === Object.values(expectedSpread).filter(
      (delta) => delta !== 0
    ).length;
  }
  if (adjustment.strainCascadeAnchorTileId) return false;

  const alternative = getAlternativeEffectRule(
    state,
    pendingEffect.ruleId,
    sourceTile
  );
  if (alternative) {
    return entries.every(
      ([tileId, delta]) => delta === planned[tileId]
    );
  }

  const plannedEntries = Object.entries(planned).filter(([, delta]) => delta > 0);
  return entries.length === plannedEntries.length && plannedEntries.every(
    ([tileId, delta]) => adjustment.tileStrainDeltas?.[tileId] === delta
  );
}

function finalizeTargetCardDiagnostics(
  previous: GameState,
  next: GameState,
  pendingEffect: PendingEffectState,
  adjustment: EffectAdjustment,
  cascade: StrainCascadeRule | null,
  outcomes: Map<
    string,
    {
      actualStrainPlaced: number;
      supportedPrevented: boolean;
      goldenGardenPrevented: boolean;
    }
  >
): GameState {
  if (!pendingEffect.targetCardDiagnostics?.length) return next;
  let finalized = next;

  for (const diagnostic of pendingEffect.targetCardDiagnostics) {
    const beforeTile = previous.map.placedTiles.find(
      (tile) => tile.instanceId === diagnostic.selectedTileId
    );
    const afterTile = next.map.placedTiles.find(
      (tile) => tile.instanceId === diagnostic.selectedTileId
    );
    if (!beforeTile || !afterTile) continue;
    const isCascadeAnchor =
      adjustment.strainCascadeAnchorTileId === diagnostic.selectedTileId;
    const attemptedAmount = isCascadeAnchor
      ? cascade?.anchorStrain ?? 0
      : Math.max(
          0,
          adjustment.tileStrainDeltas?.[diagnostic.selectedTileId] ?? 0
        );
    const outcome = outcomes.get(diagnostic.selectedTileId);
    finalized = updateTargetCardDiagnostic(finalized, diagnostic.id, {
      strainApplied: attemptedAmount > 0,
      actualStrainPlaced:
        outcome?.actualStrainPlaced ??
        Math.max(0, afterTile.strain - beforeTile.strain),
      supportedPrevented: outcome?.supportedPrevented ?? false,
      goldenGardenPrevented: outcome?.goldenGardenPrevented ?? false
    });
  }

  return finalized;
}

/**
 * Checks the structured parts of a pending-effect adjustment against the
 * current state. This deliberately does not enforce the UI's "make a choice"
 * guard, so callers can distinguish an invalid stale suggestion from a legal
 * no-target acknowledgement.
 */
export function isPendingEffectAdjustmentValid(
  state: GameState,
  pendingEffect: PendingEffectState,
  adjustment: EffectAdjustment
): boolean {
  if (
    !hasEffectAdjustment(adjustment) &&
    canResolvePendingEffectWithoutAdjustment(state, pendingEffect)
  ) return true;
  const sourceTile = getPendingEffectSourceTile(state, pendingEffect);
  if (
    !isTimerAdjustmentValid(
      state,
      pendingEffect.ruleId,
      adjustment.arrivalTimerDeltas,
      sourceTile
    )
  ) return false;
  if (
    pendingEffect.resourceExchangeLimit !== undefined &&
    !isResourceExchangeAdjustmentValid(
      state,
      pendingEffect.ruleId,
      adjustment,
      pendingEffect.resourceExchangeLimit,
      pendingEffect.resourceExchangeOptional
    )
  ) return false;
  if (
    pendingEffect.allowWardenRelief &&
    !isWardenReliefAdjustmentValid(state, adjustment)
  ) return false;
  if (pendingEffect.allowWardenRelief) return true;
  const targetCardTileValidity = isTargetCardTileAdjustmentValid(
    state,
    pendingEffect,
    adjustment,
    sourceTile
  );
  const targetCardPlannedStrainTotal = targetCardTileValidity === null
    ? undefined
    : Object.values(
        pendingEffect.targetCardPlannedStrainByTileId ?? {}
      ).reduce((total, amount) => total + Math.max(0, amount), 0);
  return isFixedResourceAdjustmentValid(
    state,
    pendingEffect.ruleId,
    adjustment,
    sourceTile
  ) && isAlternativeEffectAdjustmentValid(
    state,
    pendingEffect.ruleId,
    adjustment,
    sourceTile,
    targetCardPlannedStrainTotal
  ) && isResourceGainChoiceAdjustmentValid(
    state,
    pendingEffect.ruleId,
    adjustment,
    sourceTile
  ) && (targetCardTileValidity ?? isTileAdjustmentValid(
      state,
      pendingEffect.ruleId,
      adjustment,
      sourceTile
    ));
}

export function canResolvePendingEffectWithoutAdjustment(
  state: GameState,
  pendingEffect: PendingEffectState
): boolean {
  if (pendingEffect.resourceExchangeOptional) return true;
  if (pendingEffect.allowWardenRelief && !hasWardenReliefTarget(state)) {
    return true;
  }
  if (
    pendingEffect.allowBurdenIgnore &&
    state.encounters.activeBurdens.length === 0
  ) return true;
  if (
    pendingEffect.allowBurdenResolve &&
    state.encounters.activeBurdens.length === 0
  ) return true;
  return effectHasNoValidChoiceTargets(
    state,
    pendingEffect.ruleId,
    getPendingEffectSourceTile(state, pendingEffect)
  );
}

/**
 * Pending effects can wait behind other effects that mutate their targets.
 * Rebase only stale structured suggestions, preserving custom suggestions
 * such as production gains when they are still legal.
 */
export function refreshPendingEffectForCurrentState(
  state: GameState,
  pendingEffect: PendingEffectState
): PendingEffectState {
  const storedSuggestion = pendingEffect.suggestedAdjustment;
  const storedSuggestionIsCurrent = Boolean(
    storedSuggestion &&
      isPendingEffectAdjustmentValid(state, pendingEffect, storedSuggestion)
  );
  const generatedSuggestion = !storedSuggestionIsCurrent &&
    !pendingEffect.allowWardenRelief
    ? suggestEffectAdjustment(
        state,
        pendingEffect.ruleId,
        getPendingEffectSourceTile(state, pendingEffect)
      )
    : undefined;
  const currentSuggestion = storedSuggestionIsCurrent
    ? storedSuggestion
    : pendingEffect.allowWardenRelief
      ? undefined
      : generatedSuggestion?.adjustment;
  const canResolveWithoutChoice = canResolvePendingEffectWithoutAdjustment(
    state,
    pendingEffect
  );
  const requiresManualChoice = canResolveWithoutChoice
    ? false
    : Boolean(
        pendingEffect.requiresManualChoice ||
        generatedSuggestion?.requiresManualChoice
      );

  if (
    currentSuggestion === pendingEffect.suggestedAdjustment &&
    requiresManualChoice === pendingEffect.requiresManualChoice
  ) return pendingEffect;

  return {
    ...pendingEffect,
    suggestedAdjustment: currentSuggestion,
    requiresManualChoice,
    confirmLabel: canResolveWithoutChoice
      ? pendingEffect.confirmLabel ?? "Acknowledge"
      : pendingEffect.confirmLabel
  };
}

function refreshPendingEffectQueueHead(state: GameState): GameState {
  const preparedState = preparePendingEffectQueueHead(state);
  const pendingEffect = preparedState.pendingEffects[0];
  if (!pendingEffect) return preparedState;
  const refreshed = refreshPendingEffectForCurrentState(
    preparedState,
    pendingEffect
  );
  if (refreshed === pendingEffect) return preparedState;
  return {
    ...preparedState,
    pendingEffects: [refreshed, ...preparedState.pendingEffects.slice(1)]
  };
}


export function queueRestingHallBurdenPassive(state: GameState): GameState {
  const restingHall = state.map.placedTiles.find(
    (tile) => tile.tileId === "special_the_resting_hall" && tile.strain < 3
  );
  if (!restingHall) return state;
  if (!state.map.placedTiles.some((tile) => tile.strain > 0)) return state;

  const effectText =
    specialTileById.special_the_resting_hall?.effectText ??
    "Passive: When players resolve an active Burden, remove 1 Strain from 1 placed tile.";
  const ruleId = tileEffectRuleId(restingHall.tileId, restingHall.side);
  const suggestion = suggestEffectAdjustment(state, ruleId, restingHall);

  const queued = queuePendingEffect(state, {
    sourceType: "tile",
    ruleId,
    sourceId: restingHall.instanceId,
    sourceName: getPlacedTileName(restingHall),
    title: `Passive effect: ${getPlacedTileName(restingHall)}`,
    effectText,
    detailText: "Triggered by resolving an active Burden.",
    suggestedAdjustment: suggestion.adjustment,
    requiresManualChoice: suggestion.requiresManualChoice
  });
  return suggestion.adjustment && !suggestion.requiresManualChoice
    ? resolvePendingEffect(queued)
    : queued;
}

export function resolvePendingEffect(
  state: GameState,
  adjustment: EffectAdjustment = {}
): GameState {
  const preparedState = preparePendingEffectQueueHead(state);
  if (preparedState !== state) {
    return resolvePendingEffect(preparedState, adjustment);
  }
  const [queuedPendingEffect, ...remainingEffects] = state.pendingEffects;
  if (!queuedPendingEffect) return state;
  const pendingEffect = refreshPendingEffectForCurrentState(
    state,
    queuedPendingEffect
  );
  let effectiveAdjustment = mergeEffectAdjustment(
    pendingEffect.suggestedAdjustment,
    adjustment
  );
  if (
    pendingEffect.targetCardPrepared &&
    adjustment.tileStrainDeltas !== undefined
  ) {
    effectiveAdjustment = {
      ...effectiveAdjustment,
      tileStrainDeltas: { ...adjustment.tileStrainDeltas }
    };
  }
  if (
    pendingEffect.requiresManualChoice &&
    !hasEffectAdjustment(effectiveAdjustment) &&
    !canResolvePendingEffectWithoutAdjustment(state, pendingEffect)
  ) {
    return state;
  }
  if (!isPendingEffectAdjustmentValid(state, pendingEffect, effectiveAdjustment)) {
    return state;
  }
  const sourceTile = getPendingEffectSourceTile(state, pendingEffect);
  const strainCascade = getStrainCascadeRule(
    state,
    pendingEffect.ruleId,
    sourceTile
  );

  let nextState: GameState = {
    ...state,
    pendingEffects: remainingEffects,
    warehouse: { ...state.warehouse },
    encounters: {
      ...state.encounters,
      activeArrivals: state.encounters.activeArrivals.map((arrival) => ({ ...arrival }))
    },
    players: state.players.map((player) => ({ ...player })),
    ignoredBurdenIdsThisRound: [...state.ignoredBurdenIdsThisRound],
    map: {
      placedTiles: state.map.placedTiles.map((tile) => ({ ...tile }))
    }
  };
  const newlyOverstrainedTileIds: string[] = [];
  const recordedOverstrainTileIds = new Set<string>();
  const targetCardStrainOutcomes = new Map<
    string,
    {
      actualStrainPlaced: number;
      supportedPrevented: boolean;
      goldenGardenPrevented: boolean;
    }
  >();
  const applyStrainAndRecordOverstrain = (tileId: string, amount: number) => {
    const tileBefore = nextState.map.placedTiles.find(
      (tile) => tile.instanceId === tileId
    );
    const strainBefore = tileBefore?.strain;
    const prevention = tileBefore
      ? getStrainPreventionPreview(nextState, tileBefore)
      : undefined;
    const goldenGardenRoundBefore = prevention?.goldenGardenTileId
      ? nextState.tileActivationRecords[prevention.goldenGardenTileId]?.round
      : undefined;
    nextState = applyStrainToState(nextState, tileId, amount);
    const tileAfter = nextState.map.placedTiles.find(
      (tile) => tile.instanceId === tileId
    );
    const strainAfter = tileAfter?.strain;
    if (tileBefore && tileAfter) {
      targetCardStrainOutcomes.set(tileId, {
        actualStrainPlaced: Math.max(0, tileAfter.strain - tileBefore.strain),
        supportedPrevented: Boolean(
          prevention?.supported &&
          !tileBefore.support.preventedThisRound &&
          tileAfter.support.preventedThisRound
        ),
        goldenGardenPrevented: Boolean(
          prevention?.goldenGardenTileId &&
          goldenGardenRoundBefore !== nextState.round &&
          nextState.tileActivationRecords[prevention.goldenGardenTileId]?.round ===
            nextState.round
        )
      });
    }
    if (
      strainBefore !== undefined &&
      strainAfter !== undefined &&
      strainBefore < 3 &&
      strainAfter >= 3 &&
      !recordedOverstrainTileIds.has(tileId)
    ) {
      recordedOverstrainTileIds.add(tileId);
      newlyOverstrainedTileIds.push(tileId);
    }
  };

  for (const resource of resources) {
    const delta = effectiveAdjustment.resourceDeltas?.[resource] ?? 0;
    if (delta !== 0) {
      nextState.warehouse[resource] = clamp(
        nextState.warehouse[resource] + delta,
        0,
        warehouseCap
      );
    }
  }

  if (effectiveAdjustment.arrivalTimerDeltas) {
    nextState = {
      ...nextState,
      encounters: {
        ...nextState.encounters,
        activeArrivals: nextState.encounters.activeArrivals.map((arrival) => {
          const delta = effectiveAdjustment.arrivalTimerDeltas?.[arrival.cardId] ?? 0;
          return {
            ...arrival,
            timerTokens: clamp(arrival.timerTokens + delta, 0, 3)
          };
        })
      }
    };
  }

  if (
    effectiveAdjustment.tileStrainDeltas ||
    effectiveAdjustment.supportTileIds?.length ||
    effectiveAdjustment.strainCascadeAnchorTileId
  ) {
    const supportedIds = new Set(effectiveAdjustment.supportTileIds ?? []);
    if (
      strainCascade &&
      strainCascade.anchorStrain > 0 &&
      effectiveAdjustment.strainCascadeAnchorTileId
    ) {
      applyStrainAndRecordOverstrain(
        effectiveAdjustment.strainCascadeAnchorTileId,
        strainCascade.anchorStrain
      );
    }
    for (const [tileId, strainDelta] of Object.entries(
      effectiveAdjustment.tileStrainDeltas ?? {}
    )) {
      if (strainDelta > 0) {
        applyStrainAndRecordOverstrain(tileId, strainDelta);
      } else if (strainDelta < 0) {
        nextState = {
          ...nextState,
          map: {
            placedTiles: nextState.map.placedTiles.map((tile) =>
              tile.instanceId === tileId
                ? removeStrainFromTile(tile, Math.abs(strainDelta))
                : tile
            )
          }
        };
      }
    }
    nextState = {
      ...nextState,
      map: {
        placedTiles: nextState.map.placedTiles.map((tile) => {
          if (!supportedIds.has(tile.instanceId)) return tile;
          return {
            ...tile,
            support: {
              ...tile.support,
              singleUse: true,
              preventedThisRound: false
            }
          };
        })
      }
    };
    nextState = recalculatePassiveSupported(nextState);
  }

  nextState = finalizeTargetCardDiagnostics(
    state,
    nextState,
    pendingEffect,
    effectiveAdjustment,
    strainCascade,
    targetCardStrainOutcomes
  );

  if (effectiveAdjustment.stewardHexUpdates) {
    nextState = {
      ...nextState,
      players: nextState.players.map((player) => ({
        ...player,
        stewardHexId:
          effectiveAdjustment.stewardHexUpdates?.[player.id] ?? player.stewardHexId
      }))
    };
  }

  if (effectiveAdjustment.temporaryReachHexUpdates) {
    nextState = {
      ...nextState,
      players: nextState.players.map((player) => ({
        ...player,
        temporaryReachHexId:
          effectiveAdjustment.temporaryReachHexUpdates?.[player.id] ??
          player.temporaryReachHexId
      }))
    };
  }

  if (effectiveAdjustment.ignoredBurdenIds?.length) {
    nextState = {
      ...nextState,
      ignoredBurdenIdsThisRound: [
        ...new Set([
          ...nextState.ignoredBurdenIdsThisRound,
          ...effectiveAdjustment.ignoredBurdenIds
        ])
      ]
    };
  }

  if (effectiveAdjustment.resolvedBurdenIds?.length) {
    const activeResolvedIds = effectiveAdjustment.resolvedBurdenIds.filter((cardId) =>
      nextState.encounters.activeBurdens.includes(cardId)
    );

    if (activeResolvedIds.length > 0) {
      const resolvedIdSet = new Set(activeResolvedIds);
      nextState = {
        ...nextState,
        encounters: {
          ...nextState.encounters,
          activeBurdens: nextState.encounters.activeBurdens.filter(
            (cardId) => !resolvedIdSet.has(cardId)
          ),
          discardPile: [
            ...nextState.encounters.discardPile,
            ...activeResolvedIds.filter(
              (cardId) => !nextState.encounters.discardPile.includes(cardId)
            )
          ]
        }
      };
      nextState = queueRestingHallBurdenPassive(nextState);
    }
  }

  nextState = {
    ...nextState,
    log: [
      {
        id: `log_${nextState.log.length + 1}_${Date.now()}`,
        round: nextState.round,
        message: pendingEffect.resolutionLogMessage ?? `Applied effect: ${pendingEffect.title}.`
      },
      ...nextState.log
    ].slice(0, 80)
  };
  nextState = queueOverstrainSpreadEffects(
    nextState,
    newlyOverstrainedTileIds
  );
  return refreshPendingEffectQueueHead(
    discardBlockedOverstrainSpreadEffects(nextState)
  );
}

export function skipPendingEffect(state: GameState): GameState {
  const [pendingEffect, ...remainingEffects] = state.pendingEffects;
  if (!pendingEffect || !pendingEffect.canSkip) return state;

  return {
    ...state,
    pendingEffects: remainingEffects,
    log: [
      {
        id: `log_${state.log.length + 1}_${Date.now()}`,
        round: state.round,
        message: `Skipped effect: ${pendingEffect.title}.`
      },
      ...state.log
    ].slice(0, 80)
  };
}

export function mergeEffectAdjustment(
  base: EffectAdjustment = {},
  next: EffectAdjustment = {}
): EffectAdjustment {
  return {
    resourceDeltas: { ...base.resourceDeltas, ...next.resourceDeltas },
    arrivalTimerDeltas: { ...base.arrivalTimerDeltas, ...next.arrivalTimerDeltas },
    tileStrainDeltas: { ...base.tileStrainDeltas, ...next.tileStrainDeltas },
    strainCascadeAnchorTileId:
      next.strainCascadeAnchorTileId ?? base.strainCascadeAnchorTileId,
    supportTileIds: next.supportTileIds ?? base.supportTileIds,
    stewardHexUpdates: { ...base.stewardHexUpdates, ...next.stewardHexUpdates },
    temporaryReachHexUpdates: {
      ...base.temporaryReachHexUpdates,
      ...next.temporaryReachHexUpdates
    },
    ignoredBurdenIds: next.ignoredBurdenIds ?? base.ignoredBurdenIds,
    resolvedBurdenIds: next.resolvedBurdenIds ?? base.resolvedBurdenIds
  };
}

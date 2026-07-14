import fs from "node:fs/promises";
import path from "node:path";
import { coreTiles, coreTileById, goldenTiles, specialTiles, specialTileById } from "../../src/data/tiles";
import { encounterById, goldenBoons } from "../../src/data/encounters";
import { ledgerEntries, ledgerMilestones } from "../../src/data/ledger";
import { mapById, mapCells, mapColumns } from "../../src/data/map";
import { stewards, stewardById } from "../../src/data/stewards";
import {
  activateTile,
  canCompleteArrival,
  canResolveBurden,
  canStartPlaceTile,
  canStartUpgradeTile,
  commitSeasonSeeding,
  commitStewardPlacement,
  completeArrival,
  endCurrentTurn,
  getActivatableTileIds,
  getCompletableArrivalIds,
  getResolvableBurdenIds,
  getUpgradeableTileIds,
  getUsableFaceUpBoonIds,
  placeTile,
  resolveBurden,
  resolveEndRound,
  revealEncounters,
  upgradeTile,
  useFaceUpBoon,
  useStewardPower,
  canUseStewardPower,
  canCancelPendingBurdenWithWarden,
  cancelPendingBurdenWithWarden,
  cancelCostChoice,
  confirmCostChoice,
} from "../../src/engine/gameActions";
import { confirmDeckReorder } from "../../src/engine/deckReorder";
import { getHexNeighbors } from "../../src/engine/hex";
import {
  getEffectSupportTargets,
  getAlternativeEffectRule,
  getEffectTileTargets,
  getStrainCascadeAnchorTargets,
  getStrainCascadeRule,
  getStrainCascadeSpreadTargets,
  getTileAdjustmentRule,
  getTimerAdjustmentRule,
  getValidEffectStrainTargets,
  hasEffectAdjustment,
  isAlternativeEffectAdjustmentValid,
  isTileAdjustmentValid,
  isTimerAdjustmentValid,
  resolvePendingEffect,
  skipPendingEffect,
} from "../../src/engine/manualEffects";
import { cardEffectRuleId, getEffectRule, tileEffectRuleId } from "../../src/data/effectRules";
import {
  effectRuleTargetsCategory,
  effectRuleUsesAction,
  getEffectSemanticTags,
  hasStructuredEffectRule,
  type EffectSemanticTag,
} from "../../src/engine/effectSemantics";
import {
  getGoldenTileSetupLegalHexIds,
  placeGoldenTileForSetup,
  resolveGoldenBell,
  resolveGoldenScroll,
  resolveGoldenSignet,
} from "../../src/engine/golden";
import {
  getLegalPlacementHexes,
  getTileFootprintKind,
  getTileFootprintSize,
  getTilePlacementHexIds,
} from "../../src/engine/placementRules";
import { applyCostChoice } from "../../src/engine/passiveCosts";
import { arePlacedTilesAdjacent } from "../../src/engine/placedTiles";
import { selectReachablePlacedTileIds } from "../../src/engine/reachability";
import { calculateFinalScore } from "../../src/engine/scoring";
import { createNewGame } from "../../src/engine/setup";
import {
  buildCardIntent,
  buildHumanSeasonPlan,
  cardPlanPriority,
  chooseResourceDemandReason,
  chooseHumanLikeSeed,
  emptyHumanPlanningContext,
  resourceDemandDeficit,
  type HumanSeasonPlan,
} from "../playtest-bot/humanLikePlanner";
import type {
  CostChoiceSelection,
  EffectAdjustment,
  GameState,
  HexDirection,
  PlacedTile,
  PlayerCount,
  ResourceType,
  Terrain,
  TileCategory,
  TilePlacementDraft,
} from "../../src/engine/types";
// The evaluator is deliberately outside the player-facing source tree.
// @ts-expect-error JavaScript analysis module.
import { evaluateLedger } from "./lib/evaluator.mjs";

type Profile = "passive_normal" | "guided_ledger" | "achievement_chaser" | "human_like";
type LedgerSpec = Record<string, any>;
type HumanChoicePolicy = "best" | "near_best";

function tileHasSemantic(
  tileId: string,
  side: PlacedTile["side"],
  ...tags: EffectSemanticTag[]
): boolean {
  const ruleId = tileEffectRuleId(tileId, side);
  if (!hasStructuredEffectRule(ruleId)) return false;
  const semantics = getEffectSemanticTags(ruleId);
  return tags.some((tag) => semantics.includes(tag));
}

function tileHasStrategicProtection(tileId: string, side: PlacedTile["side"]): boolean {
  return tileHasSemantic(tileId, side, "support", "strain_relief", "burden_control");
}

interface HumanBehaviorOptions {
  choicePolicy: HumanChoicePolicy;
}

interface BotStats {
  placeActions: number;
  upgradeActions: number;
  activateActions: number;
  encounterInteractActions: number;
  freePlaceEffectsUsed: number;
  burdensResolved: number;
  resolvedBurdenIds: string[];
  usedBoonIds: string[];
  tileActivationCountsByInstance: Record<string, number>;
  arrivalsExpired: number;
  arrivalsCompletedAtOneTimer: number;
  arrivalCompletionEvents: Array<{ cardId: string; round: number; season: number; specialTileIds: string[] }>;
  strainPrevented: number;
  strainRemoved: number;
  maxOverstrainedTiles: number;
  burdenRevealSeason: Record<string, number>;
  burdenRevealRound: Record<string, number>;
  burdensResolvedSameSeason: number;
  burdensResolvedSameRoundBySeason: Record<number, number>;
  warehousePeak: Record<ResourceType, number>;
  seasonSnapshots: Record<string, any>;
  unusedActions: number;
  earlyEndTurns: number;
  decisionNotes: string[];
  strategyPlans: HumanSeasonPlan[];
  actionReasons: Array<{
    round: number;
    season: number;
    playerId: string;
    actionType: string;
    target: string;
    projectedValue: number;
    actionsSpent: number;
    candidateCount: number;
    bestProjectedValue: number;
    runnerUpProjectedValue?: number;
    bestActionType: string;
    bestTarget: string;
    selectedWasBest: boolean;
    projectedRegret: number;
    choicePolicy: HumanChoicePolicy;
    reasonCode: string;
    reason: string;
    rejectedAlternative?: string;
  }>;
  firstCategoryRound: Partial<Record<TileCategory, number>>;
  firstSupportRound?: number;
  firstSupportedHousingRound?: number;
  firstHousingClusterRound?: number;
  housingPlacedAfterSupport: number;
  resourcesProducedByResource: Record<ResourceType, number>;
  productionActivationsByRound: Record<number, number>;
  craftingPassiveUses: number;
  resourcesSavedByCrafting: number;
  merchantPassiveUses: number;
  goodsConvertedByMerchant: number;
  errors: string[];
}

const emptySelection: CostChoiceSelection = { selectedOptionIds: [] };
const playerCounts: PlayerCount[] = [1, 2, 3, 4];
const profiles: Profile[] = ["passive_normal", "guided_ledger", "achievement_chaser"];
const resourceTypes: ResourceType[] = ["wood", "stone", "metal", "food", "herbs", "goods"];

function hashSeed(text: string): number {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function randomFor(seed: string): () => number {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(random: () => number, values: T[]): T[] {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function warehouseTotal(state: GameState): number {
  return Object.values(state.warehouse).reduce((sum, value) => sum + value, 0);
}

function updatePeak(state: GameState, stats: BotStats): void {
  for (const resource of Object.keys(stats.warehousePeak) as ResourceType[]) {
    stats.warehousePeak[resource] = Math.max(stats.warehousePeak[resource], state.warehouse[resource]);
  }
  stats.maxOverstrainedTiles = Math.max(
    stats.maxOverstrainedTiles,
    state.map.placedTiles.filter((tile) => tile.strain >= 3).length,
  );
}

function supportPreventions(before: GameState, after: GameState): number {
  return after.map.placedTiles.filter((tile) => {
    const prior = before.map.placedTiles.find((candidate) => candidate.instanceId === tile.instanceId);
    return Boolean(prior && !prior.support.preventedThisRound && tile.support.preventedThisRound);
  }).length;
}

function totalStrain(state: GameState): number {
  return state.map.placedTiles.reduce((sum, tile) => sum + tile.strain, 0);
}

function customPendingAdjustment(state: GameState, plan?: HumanSeasonPlan): EffectAdjustment {
  const pending = state.pendingEffects[0];
  if (!pending) return {};
  const sourceTile = pending.sourceType === "tile" && pending.sourceId
    ? state.map.placedTiles.find((tile) => tile.instanceId === pending.sourceId)
    : undefined;
  if (
    pending.suggestedAdjustment &&
    hasEffectAdjustment(pending.suggestedAdjustment) &&
    isTileAdjustmentValid(state, pending.ruleId, pending.suggestedAdjustment, sourceTile)
  ) return {};
  if (pending.allowWardenRelief) {
    const stewardAnchors = new Set(state.players.map((player) => player.stewardHexId));
    const strained = state.map.placedTiles
      .filter((tile) => tile.strain > 0)
      .sort((a, b) =>
        Number(b.hexIds.some((hexId) => stewardAnchors.has(hexId))) -
          Number(a.hexIds.some((hexId) => stewardAnchors.has(hexId))) ||
        b.strain - a.strain
      )[0];
    if (strained) return { tileStrainDeltas: { [strained.instanceId]: -1 } };
    const tile = state.map.placedTiles.find(
      (candidate) => !candidate.support.passive && !candidate.support.singleUse
    );
    return tile ? { supportTileIds: [tile.instanceId] } : {};
  }
  if (pending.allowTemporaryReachPlayerId) {
    const occupied = new Set(state.map.placedTiles.flatMap((tile) => tile.hexIds));
    const resourceTerrain: Partial<Record<ResourceType, string>> = {
      wood: "woodland",
      stone: "mountains",
      metal: "ruins",
      food: "arable",
      herbs: "heaths",
    };
    const preferredTerrains = plan
      ? (Object.keys(plan.expectedResourceDemand) as ResourceType[])
        .sort((a, b) => resourceDemandDeficit(state, plan, b) - resourceDemandDeficit(state, plan, a))
        .map((resource) => resourceTerrain[resource])
        .filter(Boolean)
      : [];
    const empty = mapCells.find((cell) => preferredTerrains.includes(cell.terrain) && !occupied.has(cell.id)) ??
      mapCells.find((cell) => cell.terrain !== "water" && !occupied.has(cell.id));
    return empty
      ? { temporaryReachHexUpdates: { [pending.allowTemporaryReachPlayerId]: empty.id } }
      : {};
  }
  const alternativeRule = getAlternativeEffectRule(
    state,
    pending.ruleId,
    sourceTile
  );
  if (alternativeRule?.kind === "pay_or_strain") {
    const resource = alternativeRule.resources[0];
    const totalCost = alternativeRule.resourceStep * alternativeRule.requiredChoices;
    if (state.warehouse[resource] >= totalCost) {
      return { resourceDeltas: { [resource]: -totalCost } };
    }
  }
  if (alternativeRule?.kind === "pay_or_timer") {
    const resource = alternativeRule.resources[0];
    let remainingChoices = alternativeRule.requiredChoices;
    const arrivalTimerDeltas: Record<string, number> = {};
    for (const arrival of state.encounters.activeArrivals) {
      if (remainingChoices <= 0) break;
      if (arrival.timerTokens < alternativeRule.timerPerChoice) continue;
      arrivalTimerDeltas[arrival.cardId] = -alternativeRule.timerPerChoice;
      remainingChoices -= 1;
    }
    const payment = remainingChoices * alternativeRule.resourceStep;
    if (state.warehouse[resource] >= payment) {
      return {
        resourceDeltas: payment > 0 ? { [resource]: -payment } : undefined,
        arrivalTimerDeltas
      };
    }
  }
  if (alternativeRule?.kind === "warehouse_loss_or_strain") {
    const payable = alternativeRule.resources
      .filter((resource) => state.warehouse[resource] >= alternativeRule.resourceStep)
      .sort((a, b) => state.warehouse[b] - state.warehouse[a])[0];
    if (payable) {
      const payment = { resourceDeltas: { [payable]: -alternativeRule.resourceStep } };
      if (isAlternativeEffectAdjustmentValid(state, pending.ruleId, payment, sourceTile)) {
        return payment;
      }
    }
    const strainRule = getTileAdjustmentRule(state, pending.ruleId, sourceTile).strain;
    const strainBranchAvailable = alternativeRule.resources.some(
      (resource) => state.warehouse[resource] < alternativeRule.resourceStep,
    );
    if (strainBranchAvailable && strainRule && alternativeRule.requiredStrainTotal > 0) {
      const stewardAnchors = new Set(state.players.map((player) => player.stewardHexId));
      const targets = getValidEffectStrainTargets(state, pending.ruleId, sourceTile)
        .sort((a, b) =>
          (3 - b.strain) - (3 - a.strain) ||
          Number(a.hexIds.some((hexId) => stewardAnchors.has(hexId))) -
            Number(b.hexIds.some((hexId) => stewardAnchors.has(hexId)))
        );
      let remaining = alternativeRule.requiredStrainTotal;
      const tileStrainDeltas: Record<string, number> = {};
      for (const target of targets.slice(0, strainRule.maxTargets)) {
        if (remaining <= 0) break;
        const amount = Math.min(strainRule.maxPerTile, 3 - target.strain, remaining);
        if (amount <= 0) continue;
        tileStrainDeltas[target.instanceId] = amount;
        remaining -= amount;
      }
      const strainAdjustment = { tileStrainDeltas };
      if (
        remaining === 0 &&
        isAlternativeEffectAdjustmentValid(
          state,
          pending.ruleId,
          strainAdjustment,
          sourceTile,
        )
      ) {
        return strainAdjustment;
      }
    }
    // This is a recognised all-or-nothing alternative. Returning here keeps
    // it out of the generic Strain handler, which may otherwise submit a
    // partial (and therefore rules-invalid) branch.
    return {};
  }
  if (pending.resourceExchangeLimit !== undefined) {
    const exchangeResources: ResourceType[] = ["wood", "stone", "metal", "food", "herbs", "goods"];
    const entries = (Object.entries(state.warehouse) as Array<[ResourceType, number]>).sort((a, b) => b[1] - a[1]);
    const isAlchemist = getEffectRule(pending.ruleId).exchangeGoodsMode === true;
    let resourceDeltas: Partial<Record<ResourceType, number>> | undefined;
    if (isAlchemist && state.warehouse.goods <= 12) {
      let remaining = 5;
      const goodsMode: Partial<Record<ResourceType, number>> = { goods: 3 };
      for (const [resource, available] of entries.filter(([resource]) => resource !== "goods")) {
        const spent = Math.min(available, remaining);
        if (spent > 0) goodsMode[resource] = -spent;
        remaining -= spent;
        if (remaining === 0) break;
      }
      if (remaining === 0) resourceDeltas = goodsMode;
    }
    if (!resourceDeltas) {
      const deficits = Object.fromEntries(
        exchangeResources.map((resource) => [
          resource,
          plan
            ? resourceDemandDeficit(state, plan, resource)
            : Math.max(0, (resource === "food" ? 18 : 12) - state.warehouse[resource]),
        ]),
      ) as Record<ResourceType, number>;
      const targetResource = exchangeResources
        .filter((resource) => !isAlchemist || resource !== "goods")
        .sort((a, b) => deficits[b] - deficits[a] || state.warehouse[a] - state.warehouse[b])[0];
      const sourceResource = exchangeResources
        .filter((resource) => resource !== targetResource && state.warehouse[resource] > 0)
        .sort((a, b) =>
          (state.warehouse[b] - Math.max(0, deficits[b])) -
          (state.warehouse[a] - Math.max(0, deficits[a]))
        )[0];
      const amount = sourceResource && targetResource
        ? Math.min(
          pending.resourceExchangeLimit,
          state.warehouse[sourceResource],
          Math.max(1, deficits[targetResource]),
        )
        : 0;
      resourceDeltas = sourceResource && targetResource && amount > 0
        ? { [sourceResource]: -amount, [targetResource]: amount }
        : undefined;
    }
    const arrival = getEffectRule(pending.ruleId).timer?.direction === "add"
      ? state.encounters.activeArrivals.find((candidate) => candidate.timerTokens < 3)
      : undefined;
    return {
      resourceDeltas,
      arrivalTimerDeltas: arrival ? { [arrival.cardId]: 1 } : undefined,
    };
  }

  if (pending.allowBurdenResolve && state.encounters.activeBurdens[0]) {
    return { resolvedBurdenIds: [state.encounters.activeBurdens[0]] };
  }
  if (pending.allowBurdenIgnore && state.encounters.activeBurdens[0]) {
    return { ignoredBurdenIds: [state.encounters.activeBurdens[0]] };
  }
  if (pending.allowStewardMovementPlayerId) {
    const destination = state.map.placedTiles.find((tile) => tile.strain < 3)?.hexIds[0];
    if (destination) {
      return { stewardHexUpdates: { [pending.allowStewardMovementPlayerId]: destination } };
    }
  }

  const timerRule = getTimerAdjustmentRule(state, pending.ruleId, sourceTile);
  if (timerRule) {
    const arrival = state.encounters.activeArrivals.find((candidate) =>
      timerRule.direction === "add" ? candidate.timerTokens < 3 : candidate.timerTokens > 0
    );
    if (arrival) {
      const limit = timerRule.direction === "add"
        ? Math.min(timerRule.limit, 3 - arrival.timerTokens)
        : -Math.min(timerRule.limit, arrival.timerTokens);
      return { arrivalTimerDeltas: { [arrival.cardId]: limit } };
    }
  }

  const pendingRule = getEffectRule(pending.ruleId);
  const strainCascadeRule = getStrainCascadeRule(state, pending.ruleId, sourceTile);
  if (strainCascadeRule) {
    const anchor = getStrainCascadeAnchorTargets(state, pending.ruleId, sourceTile)[0];
    if (anchor) {
      const spreadTargets = getStrainCascadeSpreadTargets(
        state,
        pending.ruleId,
        anchor.instanceId,
        sourceTile
      ).slice(0, strainCascadeRule.maxSpreadTargets);
      return {
        strainCascadeAnchorTileId: anchor.instanceId,
        tileStrainDeltas: Object.fromEntries(
          spreadTargets.map((tile) => [tile.instanceId, strainCascadeRule.spreadStrain])
        )
      };
    }
  }
  if (pendingRule.tileAdjustment?.strain) {
    const rule = getTileAdjustmentRule(state, pending.ruleId, sourceTile).strain;
    const targets = getValidEffectStrainTargets(state, pending.ruleId, sourceTile);
    if (rule && targets.length > 0) {
      let remaining = rule.maxTotal;
      const tileStrainDeltas: Record<string, number> = Object.fromEntries(
        Object.keys(pending.suggestedAdjustment?.tileStrainDeltas ?? {}).map((tileId) => [tileId, 0]),
      );
      const stewardAnchors = new Set(state.players.map((player) => player.stewardHexId));
      const strainPriority = (tile: PlacedTile): number => {
        const category = tileCategory(tile);
        const face = tile.kind === "special"
          ? specialTileById[tile.tileId]
          : tile.side === "upgraded"
            ? coreTileById[tile.tileId].upgraded
            : coreTileById[tile.tileId].basic;
        const printedScore = ("population" in face ? face.population : 0) + ("renown" in face ? face.renown : 0);
        const isAnchor = tile.hexIds.some((hexId) => stewardAnchors.has(hexId));
        const valuable =
          (isAnchor ? 140 : 0) +
          (tile.strain >= 2 ? 110 : tile.strain * 28) +
          (category === "housing" ? 80 : 0) +
          (category === "resource" ? 52 : 0) +
          (tile.side === "upgraded" ? 34 : 0) +
          (tile.kind === "special" || tile.tileId.startsWith("golden_tile_") ? 40 : 0) +
          printedScore * 3;
        const protection = tile.support.passive || tile.support.singleUse ? 120 : 0;
        return rule.direction === "remove" ? valuable : valuable - protection;
      };
      const orderedTargets = [...targets].sort((a, b) =>
        rule.direction === "remove"
          ? strainPriority(b) - strainPriority(a)
          : strainPriority(a) - strainPriority(b)
      );
      const stewardOccupiedHexes = new Set(
        state.players.map((player) => player.stewardHexId)
      );
      const selectedTargetIds = new Set<string>();
      const selectedCategoryCounts: Partial<Record<TileCategory, number>> = {};
      let selectedStewardTargets = 0;
      let selectedOtherTargets = 0;
      const isStewardOccupiedTarget = (target: PlacedTile): boolean =>
        target.hexIds.some((hexId) => stewardOccupiedHexes.has(hexId));

      const trySelectTarget = (target: PlacedTile): boolean => {
        if (
          selectedTargetIds.has(target.instanceId) ||
          selectedTargetIds.size >= rule.maxTargets ||
          remaining <= 0
        ) return false;

        const category = tileCategory(target);
        const categoryLimit = rule.categoryLimits?.[category];
        if (
          categoryLimit &&
          (selectedCategoryCounts[category] ?? 0) >= categoryLimit.max
        ) return false;

        const isStewardOccupied = isStewardOccupiedTarget(target);
        if (
          isStewardOccupied &&
          selectedStewardTargets >=
            (rule.maxStewardOccupiedTargets ?? Number.MAX_SAFE_INTEGER)
        ) return false;
        if (
          !isStewardOccupied &&
          selectedOtherTargets >=
            (rule.maxOtherTargets ?? Number.MAX_SAFE_INTEGER)
        ) return false;
        if (
          !isStewardOccupied &&
          rule.linkedStewardTargets &&
          !targets.some(
            (candidate) =>
              selectedTargetIds.has(candidate.instanceId) &&
              isStewardOccupiedTarget(candidate) &&
              arePlacedTilesAdjacent(target, candidate)
          )
        ) return false;

        const capacity = rule.direction === "remove" ? target.strain : 3 - target.strain;
        const amount = Math.min(rule.maxPerTile, capacity, remaining);
        if (amount <= 0) return false;
        tileStrainDeltas[target.instanceId] = rule.direction === "remove" ? -amount : amount;
        remaining -= amount;
        selectedTargetIds.add(target.instanceId);
        selectedCategoryCounts[category] =
          (selectedCategoryCounts[category] ?? 0) + 1;
        if (isStewardOccupied) selectedStewardTargets += 1;
        else selectedOtherTargets += 1;
        return true;
      };

      for (const [category, limits] of Object.entries(
        rule.categoryLimits ?? {}
      ) as Array<[TileCategory, { min?: number; max: number }]>) {
        while ((selectedCategoryCounts[category] ?? 0) < (limits.min ?? 0)) {
          const requiredTarget = orderedTargets.find(
            (target) =>
              tileCategory(target) === category &&
              !selectedTargetIds.has(target.instanceId)
          );
          if (!requiredTarget || !trySelectTarget(requiredTarget)) break;
        }
      }
      if (rule.linkedStewardTargets) {
        for (const target of orderedTargets.filter(isStewardOccupiedTarget)) {
          trySelectTarget(target);
        }
        for (const target of orderedTargets.filter(
          (target) => !isStewardOccupiedTarget(target)
        )) {
          trySelectTarget(target);
        }
      } else {
        for (const target of orderedTargets) {
          trySelectTarget(target);
        }
      }
      const candidate = { tileStrainDeltas };
      if (
        Object.keys(tileStrainDeltas).length > 0 &&
        isTileAdjustmentValid(state, pending.ruleId, candidate, sourceTile)
      ) return candidate;
    }
  }

  if (pendingRule.tileAdjustment?.support) {
    const stewardAnchors = new Set(state.players.map((player) => player.stewardHexId));
    const target = getEffectSupportTargets(state, pending.ruleId, sourceTile)
      .sort((a, b) => {
        const value = (tile: PlacedTile) =>
          (tile.hexIds.some((hexId) => stewardAnchors.has(hexId)) ? 100 : 0) +
          tile.strain * 30 +
          (tileCategory(tile) === "housing" ? 20 : 0) +
          (tile.side === "upgraded" ? 10 : 0);
        return value(b) - value(a);
      })[0];
    if (target) return { supportTileIds: [target.instanceId] };
  }

  return pending.suggestedAdjustment ?? {};
}

function chooseCostSelection(state: GameState): CostChoiceSelection {
  const pending = state.pendingCostChoice;
  if (!pending) return emptySelection;
  const selectedOptions = pending.options.filter(
    (option) => option.required || option.kind === "zero" || option.kind === "discount",
  );
  const discountResourceByOptionId: Record<string, ResourceType> = {};
  const marketResourceByOptionId: Record<string, ResourceType> = {};
  for (const option of selectedOptions) {
    if (option.kind === "discount" && option.resourceChoices?.length) {
      discountResourceByOptionId[option.id] = [...option.resourceChoices].sort(
        (a, b) =>
          Math.max(0, (pending.baseCost[b] ?? 0) - state.warehouse[b]) -
            Math.max(0, (pending.baseCost[a] ?? 0) - state.warehouse[a]) ||
          (pending.baseCost[b] ?? 0) - (pending.baseCost[a] ?? 0),
      )[0];
    }
    if (option.kind === "market" && option.resourceChoices?.length) {
      marketResourceByOptionId[option.id] = [...option.resourceChoices].sort(
        (a, b) => (pending.baseCost[b] ?? 0) - (pending.baseCost[a] ?? 0),
      )[0];
    }
  }
  let provisionalSelection: CostChoiceSelection = {
    selectedOptionIds: selectedOptions.map((option) => option.id),
    discountResourceByOptionId,
    marketResourceByOptionId,
  };
  let provisionalCost = applyCostChoice(
    state,
    pending.baseCost,
    pending.options,
    provisionalSelection,
  );
  for (const option of pending.options.filter((candidate) => candidate.kind === "market")) {
    const resource = option.resourceChoices
      ?.filter((candidate) => candidate !== "goods")
      .sort(
        (a, b) =>
          Math.max(0, provisionalCost[b] - state.warehouse[b]) -
          Math.max(0, provisionalCost[a] - state.warehouse[a]),
      )[0];
    if (!resource || provisionalCost[resource] <= state.warehouse[resource]) continue;
    const goodsAfter = provisionalCost.goods + 1;
    if (goodsAfter > state.warehouse.goods) continue;
    selectedOptions.push(option);
    marketResourceByOptionId[option.id] = resource;
    provisionalSelection = {
      selectedOptionIds: selectedOptions.map((candidate) => candidate.id),
      discountResourceByOptionId,
      marketResourceByOptionId,
    };
    provisionalCost = applyCostChoice(
      state,
      pending.baseCost,
      pending.options,
      provisionalSelection,
    );
  }
  return {
    selectedOptionIds: selectedOptions.map((option) => option.id),
    discountResourceByOptionId,
    marketResourceByOptionId,
  };
}

function drainPending(initial: GameState, stats: BotStats, plan?: HumanSeasonPlan): GameState {
  let state = initial;
  for (let guard = 0; guard < 100; guard += 1) {
    if (state.pendingGoldenEffect?.kind === "bell") {
      state = resolveGoldenBell(state, state.pendingGoldenEffect.arrivalCardIds[0]);
      continue;
    }
    if (state.pendingGoldenEffect?.kind === "scroll") {
      const returned = Object.fromEntries(
        state.players.map((player) => [player.id, state.encounters.handsByPlayerId[player.id]?.find((cardId) => encounterById[cardId]?.type === "burden")]),
      );
      state = resolveGoldenScroll(state, returned);
      continue;
    }
    if (state.pendingGoldenEffect?.kind === "signet") {
      state = resolveGoldenSignet(state, []);
      continue;
    }
    if (state.pendingDeckReorder) {
      state = confirmDeckReorder(state, state.pendingDeckReorder.cardIds);
      continue;
    }
    if (state.pendingCostChoice) {
      const pendingChoice = state.pendingCostChoice;
      const before = state;
      const selection = chooseCostSelection(state);
      const selectedPassiveOptions = selection.selectedOptionIds.flatMap((optionId) => {
        const option = pendingChoice.options.find((candidate) => candidate.id === optionId);
        return option ? [option] : [];
      });
      state = confirmCostChoice(state, selection);
      if (state.pendingCostChoice !== pendingChoice) {
        for (const option of selectedPassiveOptions) {
          const sourceTileId = before.map.placedTiles.find((tile) => tile.instanceId === option.sourceTileId)?.tileId;
          if (sourceTileId === "c13_workshops") {
            stats.craftingPassiveUses += 1;
            stats.resourcesSavedByCrafting += option.amount ?? 1;
          }
          if (sourceTileId === "c14_market_stalls") {
            stats.merchantPassiveUses += 1;
            stats.goodsConvertedByMerchant += 1;
          }
        }
      }
      if (state.pendingCostChoice === pendingChoice) {
        if (stats.decisionNotes.length < 40) {
          stats.decisionNotes.push(
            `Cost choice failed: ${pendingChoice.title}; ` +
            `base ${JSON.stringify(pendingChoice.baseCost)}; ` +
            `warehouse ${JSON.stringify(before.warehouse)}; ` +
            `options ${pendingChoice.options.map((option) => `${option.kind}:${option.id}${option.required ? ":required" : ""}`).join(", ")}; ` +
            `selected ${selection.selectedOptionIds.join(", ") || "none"}.`,
          );
        }
        state = cancelCostChoice(state);
      }
      continue;
    }
    const pending = state.pendingEffects[0];
    if (!pending) return state;
    const wardenCanCancel = canCancelPendingBurdenWithWarden(state).ok;
    const shouldUseWarden = wardenCanCancel || !plan ||
      (pending.sourceId ? plan.highRiskBurdenIds.includes(pending.sourceId) : false) ||
      Boolean(
        getEffectRule(pending.ruleId).tileAdjustment?.strain ||
        getEffectRule(pending.ruleId).strainCascade
      );
    if (pending.canCancelWithWardenPower && shouldUseWarden && wardenCanCancel) {
      state = cancelPendingBurdenWithWarden(state);
      continue;
    }
    const before = state;
    const beforeStrain = totalStrain(before);
    const adjustment = customPendingAdjustment(state, plan);
    state = resolvePendingEffect(state, adjustment);
    if (state === before || state.pendingEffects.includes(pending)) {
      if (pending.canSkip) state = skipPendingEffect(state);
      if (state === before || state.pendingEffects.includes(pending)) {
        const debugSourceTile = pending.sourceType === "tile" && pending.sourceId
          ? before.map.placedTiles.find((tile) => tile.instanceId === pending.sourceId)
          : undefined;
        stats.errors.push(
          `Could not resolve pending effect: ${pending.title}; adjustment ${JSON.stringify(adjustment)}; ` +
          `suggested ${JSON.stringify(pending.suggestedAdjustment)}; rule ${pending.ruleId}; ` +
          `alternative ${JSON.stringify(getAlternativeEffectRule(before, pending.ruleId, debugSourceTile))}; ` +
          `alternativeValid ${isAlternativeEffectAdjustmentValid(before, pending.ruleId, pending.suggestedAdjustment ?? adjustment, debugSourceTile)}; ` +
          `timerRule ${JSON.stringify(getTimerAdjustmentRule(before, pending.ruleId, debugSourceTile))}; ` +
          `timerValid ${isTimerAdjustmentValid(before, pending.ruleId, (pending.suggestedAdjustment ?? adjustment).arrivalTimerDeltas, debugSourceTile)}; ` +
          `tileValid ${isTileAdjustmentValid(before, pending.ruleId, pending.suggestedAdjustment ?? adjustment, debugSourceTile)}; manual ${Boolean(pending.requiresManualChoice)}`,
        );
        return state;
      }
    }
    stats.strainPrevented += supportPreventions(before, state);
    stats.strainRemoved += Math.max(0, beforeStrain - totalStrain(state));
    updatePeak(state, stats);
  }
  stats.errors.push("Pending effect guard exceeded.");
  return state;
}

function boonBreaksDeclaredVow(state: GameState, cardId: string, targets: string[]): boolean {
  const card = encounterById[cardId];
  if (!card || card.type !== "boon") return false;
  const ruleId = cardEffectRuleId(card.id, state.season);
  if (
    (targets.includes("LE-041") || hasV43Target(targets, "LE-041")) &&
    effectRuleUsesAction(ruleId, "place") &&
    effectRuleTargetsCategory(ruleId, "travel")
  ) return true;
  if (
    (targets.includes("LE-042") || hasV43Target(targets, "LE-042")) &&
    effectRuleUsesAction(ruleId, "upgrade")
  ) return true;
  return false;
}

function hasV43Target(targets: string[], ...entryIds: string[]): boolean {
  return entryIds.some((entryId) => targets.includes(`V43-${entryId.replace("LE-", "")}`));
}

function hasTarget(targets: string[], ...entryIds: string[]): boolean {
  return entryIds.some((entryId) => targets.includes(entryId));
}

function placedCategoryCount(state: GameState, category: TileCategory): number {
  return state.map.placedTiles.filter((tile) => tile.strain < 3 && tileCategory(tile) === category).length;
}

function scoreConversionPressure(state: GameState): number {
  if (state.round >= 11) return 1.65;
  if (state.round >= 9) return 1.35;
  if (state.season === 3) return 1.15;
  return 1;
}

function isEdgeHex(hexId: string): boolean {
  const cell = mapById[hexId];
  return Boolean(cell && cell.terrain !== "water" && (cell.col === "A" || cell.col === "N" || cell.row === 1 || cell.row === 9));
}

function isCornerHex(hexId: string): boolean {
  return ["A1", "A9", "N1", "N9"].includes(hexId);
}

function desiredTravelTileCount(targets: string[], plan: HumanSeasonPlan | undefined): number {
  if (targets.includes("LE-041") || hasV43Target(targets, "LE-041")) return 0;
  let desired = plan?.needsTravelAnchor ? 2 : 1;
  if (hasTarget(targets, "LE-015", "LE-044")) desired = Math.max(desired, 3);
  if (hasTarget(targets, "LE-018")) desired = Math.max(desired, 4);
  if (hasTarget(targets, "LE-005", "LE-006")) desired = Math.max(desired, 4);
  if (hasTarget(targets, "LE-032")) desired = Math.max(desired, 2);
  if (hasTarget(targets, "LE-035", "LE-040")) desired = Math.max(desired, 3);
  if (hasTarget(targets, "LE-016", "LE-017")) desired = Math.max(desired, 2);
  if (hasV43Target(targets, "LE-049")) desired = Math.max(desired, 8);
  return desired;
}

function bridgeTileCount(state: GameState): number {
  return state.map.placedTiles.filter((tile) => tile.strain < 3 && tile.tileId === "c19_bridge").length;
}

function targetCategoryWeights(targets: string[]): Partial<Record<TileCategory, number>> {
  const weights: Partial<Record<TileCategory, number>> = {};
  const add = (category: TileCategory, amount: number) => { weights[category] = (weights[category] ?? 0) + amount; };
  const addMany = (categories: TileCategory[], amount: number) => categories.forEach((category) => add(category, amount));
  for (const id of targets) {
    if (id === "LE-001") {
      add("housing", 42);
      add("special", 30);
      addMany(["social", "wellbeing", "merchant", "crafting", "travel"], 16);
    }
    if (id === "LE-002") add("housing", 60);
    if (id === "LE-003") {
      addMany(["social", "wellbeing", "merchant", "crafting", "travel", "special"], 34);
      add("housing", 12);
    }
    if (id === "LE-004") {
      addMany(["wellbeing", "social"], 42);
      add("special", 30);
    }
    if (["LE-005", "LE-006", "LE-007", "LE-016"].includes(id)) {
      add("travel", 18);
      add("resource", 28);
    }
    if (id === "LE-008") {
      add("travel", 52);
      add("housing", 62);
    }
    if (["LE-009", "LE-010"].includes(id)) {
      add("housing", 58);
      addMany(["social", "wellbeing"], 40);
    }
    if (id === "LE-011") add("housing", 76);
    if (id === "LE-012") addMany(["resource", "housing", "crafting", "merchant", "social", "wellbeing", "travel"], 42);
    if (id === "LE-013") addMany(["merchant", "housing", "social", "travel"], 46);
    if (id === "LE-014") addMany(["housing", "social", "wellbeing", "merchant", "crafting", "travel"], 34);
    if (["LE-015", "LE-018", "LE-044"].includes(id)) add("travel", 45);
    if (id === "LE-017") addMany(["housing", "merchant", "social", "wellbeing"], 38);
    if (["LE-019", "LE-022", "LE-023"].includes(id)) {
      add("special", 76);
      add("housing", id === "LE-023" ? 46 : 22);
    }
    if (["LE-020", "LE-021"].includes(id)) {
      add("resource", 28);
      add("housing", 24);
      add("special", 40);
    }
    if (["LE-024", "LE-025", "LE-048"].includes(id)) {
      add("wellbeing", 52);
      add("social", 26);
      add("special", 34);
      add("resource", 22);
    }
    if (["LE-026", "LE-027", "LE-028", "LE-029", "LE-030"].includes(id)) {
      add("wellbeing", 58);
      add("social", 30);
      add("special", 32);
      add("housing", 18);
    }
    if (["LE-031", "LE-046"].includes(id)) {
      add("crafting", 46);
      add("resource", 34);
      add("housing", 32);
    }
    if (id === "LE-032") addMany(["travel", "crafting", "merchant"], 68);
    if (id === "LE-033") addMany(["wellbeing", "crafting", "merchant", "social"], 56);
    if (id === "LE-034") {
      add("resource", 66);
      add("housing", 46);
    }
    if (id === "LE-035") {
      add("resource", 64);
      add("travel", 48);
    }
    if (["LE-036", "LE-037", "LE-038", "LE-047", "LE-049"].includes(id)) {
      add("resource", 70);
      if (id === "LE-049") add("merchant", 36);
      if (id === "LE-047") add("travel", 28);
    }
    if (["LE-039", "LE-041", "LE-042"].includes(id)) {
      add("housing", 58);
      add("special", 42);
      addMany(["social", "wellbeing", "merchant", "crafting"], 24);
      if (id !== "LE-041") add("travel", 14);
    }
    if (id === "LE-040") {
      add("resource", 64);
      add("travel", 56);
    }
    if (id === "LE-045") add("housing", 78);
    if (id === "LE-050") {
      addMany(["housing", "travel", "resource", "crafting", "merchant", "wellbeing"], 28);
      add("special", 24);
    }
    if (["V43-005", "V43-006", "V43-007", "V43-015", "V43-016", "V43-018", "V43-040", "V43-044"].includes(id)) add("travel", 34);
    if (["V43-008", "V43-009", "V43-010", "V43-011", "V43-013", "V43-023", "V43-034", "V43-045"].includes(id)) add("housing", 40);
    if (["V43-009", "V43-010", "V43-013", "V43-017", "V43-033"].includes(id)) {
      add("social", 28);
      add("wellbeing", 28);
    }
    if (["V43-013", "V43-017", "V43-032", "V43-033"].includes(id)) add("merchant", 42);
    if (["V43-032", "V43-033"].includes(id)) add("crafting", 42);
    if (["V43-019", "V43-020", "V43-021", "V43-022", "V43-023"].includes(id)) add("special", 48);
    if (["V43-034", "V43-035", "V43-036", "V43-037", "V43-040"].includes(id)) add("resource", 58);
    if (["V43-003", "V43-041", "V43-042"].includes(id)) {
      add("housing", 38);
      add("social", 24);
      add("wellbeing", 24);
      add("special", 30);
    }
  }
  return weights;
}

function applyHumanPlanCategoryWeights(
  state: GameState,
  weights: Partial<Record<TileCategory, number>>,
  plan: HumanSeasonPlan | undefined,
  targets: string[],
): void {
  if (!plan) return;
  const count = (category: TileCategory) => state.map.placedTiles.filter((tile) => tileCategory(tile) === category).length;
  const add = (category: TileCategory, amount: number) => { weights[category] = (weights[category] ?? 0) + amount; };
  const conversion = scoreConversionPressure(state);
  const resourceCount = count("resource");
  if (resourceCount < Math.max(2, state.playerCount)) add("resource", state.season === 1 ? 60 : 34);
  if (state.season >= 2 && resourceCount >= 3) add("resource", -18 * conversion);
  if (resourceCount >= 3 && !hasTarget(targets, "LE-034", "LE-035", "LE-036", "LE-037", "LE-038", "LE-040", "LE-047", "LE-049")) {
    add("resource", -92 * conversion);
  }
  if (plan.needsTravelAnchor && count("travel") === 0) add("travel", 42);
  if (plan.needsTravelAnchor && count("travel") > 2 && state.round >= 7) add("travel", -22);
  if (plan.needsCrafting && count("crafting") === 0 && state.season <= 2) add("crafting", 52);
  if (plan.needsMerchant && count("merchant") === 0 && state.season <= 2) add("merchant", 48);
  if (plan.needsSupportBeforeHousing && count("wellbeing") === 0) add("wellbeing", 38);
  for (const category of plan.targetTileCategories) {
    if (count(category) === 0) add(category, state.season === 3 ? 36 : 24);
  }
  if (plan.housingPush || state.season >= 2) add("housing", (state.season === 1 ? 18 : state.season === 2 ? 48 : 68) * conversion);
  if (state.round >= 9) {
    add("special", 44);
    add("housing", 42);
    add("social", 18);
    add("wellbeing", 18);
    add("merchant", 16);
    add("crafting", 14);
  }
  if (!plan.housingPush && state.season === 1) add("housing", -10);
}

function placementOptions(tileId: string, cells: typeof mapCells): Array<string | TilePlacementDraft> {
  const footprint = getTileFootprintKind(tileId);
  if (footprint === "detached") return [];
  if (footprint === "line") {
    return cells.flatMap((cell) => [0, 1, 2, 3, 4, 5].map((orientation) => ({ anchorHexId: cell.id, orientation: orientation as HexDirection })));
  }
  return cells.map((cell) => cell.id);
}

function tileCostTotal(tileId: string): number {
  const tile = coreTileById[tileId];
  return tile ? Object.values(tile.basic.cost).reduce((sum, value) => sum + value, 0) : 0;
}

function isScoreFocusedTarget(targets: string[]): boolean {
  return hasTarget(targets, "LE-001", "LE-002", "LE-003", "LE-039", "LE-041", "LE-042");
}

function projectedPlacementScoreDelta(
  state: GameState,
  playerId: string,
  tileId: string,
  placement: string | TilePlacementDraft,
  plan?: HumanSeasonPlan,
): number {
  const beforeScore = calculateFinalScore(state).finalScore;
  const beforeTiles = state.map.placedTiles.length;
  const stats = createStats(state);
  const after = drainPending(placeTile(state, playerId, tileId, placement), stats, plan);
  if (after.map.placedTiles.length <= beforeTiles) return -40;
  return calculateFinalScore(after).finalScore - beforeScore - stats.errors.length * 40;
}

function projectedUpgradeScoreDelta(
  state: GameState,
  playerId: string,
  instanceId: string,
  plan?: HumanSeasonPlan,
): number {
  const beforeScore = calculateFinalScore(state).finalScore;
  const stats = createStats(state);
  const after = drainPending(upgradeTile(state, playerId, instanceId), stats, plan);
  const upgraded = after.map.placedTiles.find((tile) => tile.instanceId === instanceId)?.side === "upgraded";
  if (!upgraded) return -30;
  return calculateFinalScore(after).finalScore - beforeScore - stats.errors.length * 40;
}

function findFirstLegalPlacement(
  state: GameState,
  playerId: string,
  tileId: string,
): string | TilePlacementDraft | null {
  if (getTileFootprintKind(tileId) !== "detached") {
    return placementOptions(tileId, mapCells).find((placement) =>
      canStartPlaceTile(state, playerId, tileId, placement).ok
    ) ?? null;
  }

  const expectedSize = getTileFootprintSize(tileId);
  const search = (draft: TilePlacementDraft): TilePlacementDraft | null => {
    const selected = getTilePlacementHexIds(tileId, draft);
    if (selected.length >= expectedSize) {
      return canStartPlaceTile(state, playerId, tileId, draft).ok ? draft : null;
    }
    const legalNext = getLegalPlacementHexes(state, playerId, tileId, draft);
    for (const hexId of legalNext) {
      const nextDraft: TilePlacementDraft = selected.length === 0
        ? { anchorHexId: hexId }
        : {
            anchorHexId: selected[0],
            secondaryHexIds: [...selected.slice(1), hexId],
          };
      const completed = search(nextDraft);
      if (completed) return completed;
    }
    return null;
  };
  return search({});
}

function findCheapLegalScorePlacement(
  state: GameState,
  playerId: string,
  plan?: HumanSeasonPlan,
): HumanActionCandidate | null {
  const candidates = coreTiles
    .filter((tile) =>
      state.tileSupply.core[tile.id] > 0 &&
      tile.category !== "resource" &&
      tile.category !== "travel" &&
      tile.basic.population + tile.basic.renown > 0
    )
    .sort((a, b) =>
      tileCostTotal(a.id) - tileCostTotal(b.id) ||
      (b.basic.population + b.basic.renown) - (a.basic.population + a.basic.renown)
    );

  const scored: HumanActionCandidate[] = [];
  for (const tile of candidates) {
    const placement = findFirstLegalPlacement(state, playerId, tile.id);
    if (!placement) continue;
    const scoreDelta = projectedPlacementScoreDelta(state, playerId, tile.id, placement, plan);
    if (scoreDelta < 0) continue;
    scored.push({
      kind: "place",
      target: tile.id,
      placement,
      score: scoreDelta,
      reasonCode: "FINAL_SCORE_CONVERSION",
      reason: `Final-round fallback places the affordable ${tile.basic.name} for ${scoreDelta} immediate projected score.`,
    });
  }
  return scored.sort((a, b) => b.score - a.score)[0] ?? null;
}

function findLegalSpecialPlacement(
  state: GameState,
  playerId: string,
  plan?: HumanSeasonPlan,
): HumanActionCandidate | null {
  const candidates = specialTiles
    .filter((tile) => state.tileSupply.special[tile.id] > 0)
    .sort((a, b) => (b.population + b.renown) - (a.population + a.renown));
  const scored: HumanActionCandidate[] = [];
  for (const tile of candidates) {
    const placement = findFirstLegalPlacement(state, playerId, tile.id);
    if (!placement) continue;
    const scoreDelta = projectedPlacementScoreDelta(state, playerId, tile.id, placement, plan);
    if (scoreDelta < 0) continue;
    scored.push({
      kind: "place",
      target: tile.id,
      placement,
      score: scoreDelta,
      reasonCode: "PLACE_UNLOCKED_SPECIAL",
      reason: `Final-round fallback places unlocked ${tile.name} for ${scoreDelta} immediate projected score and its remaining passive value.`,
    });
  }
  return scored.sort((a, b) => b.score - a.score)[0] ?? null;
}

function findPlacement(
  state: GameState,
  playerId: string,
  targets: string[],
  random: () => number,
  plan?: HumanSeasonPlan,
  expanded = false,
): { tileId: string; placement: string | TilePlacementDraft; score: number; reasonCode: string; reason: string } | null {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return null;
  const categoryWeights = targetCategoryWeights(targets);
  const scoreFocused = isScoreFocusedTarget(targets);
  if (plan) {
    for (const category of Object.keys(categoryWeights) as TileCategory[]) {
      categoryWeights[category] = (categoryWeights[category] ?? 0) * 0.35;
    }
  }
  applyHumanPlanCategoryWeights(state, categoryWeights, plan, targets);
  const placedCategoryCounts = new Map<TileCategory, number>();
  for (const tile of state.map.placedTiles.filter((candidate) => candidate.strain < 3)) {
    const category = tileCategory(tile);
    placedCategoryCounts.set(category, (placedCategoryCounts.get(category) ?? 0) + 1);
  }
  if (targets.some((id) => ["LE-008", "LE-009"].includes(id)) || hasV43Target(targets, "LE-007", "LE-012")) {
    for (const category of ["resource", "housing", "crafting", "merchant", "social", "wellbeing", "travel"] as TileCategory[]) {
      if ((placedCategoryCounts.get(category) ?? 0) === 0) {
        categoryWeights[category] = (categoryWeights[category] ?? 0) + 75;
      }
    }
  }
  if (hasTarget(targets, "LE-012", "LE-017")) {
    for (const category of ["resource", "housing", "crafting", "merchant", "social", "wellbeing", "travel"] as TileCategory[]) {
      if ((placedCategoryCounts.get(category) ?? 0) === 0) {
        categoryWeights[category] = (categoryWeights[category] ?? 0) + 62;
      }
    }
  }
  if (hasTarget(targets, "LE-024", "LE-025", "LE-048")) {
    const reliefTiles = placedCategoryCount(state, "wellbeing") + placedCategoryCount(state, "social");
    if (reliefTiles < 2) {
      categoryWeights.wellbeing = (categoryWeights.wellbeing ?? 0) + 58;
      categoryWeights.social = (categoryWeights.social ?? 0) + 28;
    }
  }
  if (targets.some((id) => ["LE-002", "LE-008", "LE-009", "LE-010", "LE-011", "LE-023", "LE-045"].includes(id))) {
    categoryWeights.housing = (categoryWeights.housing ?? 0) + 35;
  }
  if (targets.some((id) => ["LE-005", "LE-006", "LE-015", "LE-016", "LE-018", "LE-032", "LE-035", "LE-040", "LE-044"].includes(id))) {
    categoryWeights.travel = (categoryWeights.travel ?? 0) + 26;
  }
  const noTravel = targets.includes("LE-041") || hasV43Target(targets, "LE-041");
  const noFarmstead = hasV43Target(targets, "LE-027");
  const resourceLineageTarget = hasTarget(targets, "LE-034", "LE-035", "LE-036", "LE-037", "LE-038", "LE-040", "LE-047", "LE-049") ||
    hasV43Target(targets, "LE-034", "LE-035", "LE-036", "LE-037", "LE-040");
  const placedCoreResourceCount = state.map.placedTiles.filter(
    (tile) => tile.kind === "core" && tileCategory(tile) === "resource",
  ).length;
  const missingFoundationTileIds = new Set(
    (plan?.targetFoundationTileIds ?? []).filter(
      (tileId) => !state.map.placedTiles.some((placed) => placed.tileId === tileId),
    ),
  );
  const travelTarget = hasTarget(targets, "LE-005", "LE-006", "LE-015", "LE-016", "LE-018", "LE-032", "LE-035", "LE-040", "LE-044") || hasV43Target(targets, "LE-005", "LE-006", "LE-007", "LE-015", "LE-016", "LE-018", "LE-040", "LE-044");
  const travelCount = placedCategoryCount(state, "travel");
  const desiredTravel = desiredTravelTileCount(targets, plan);
  const currentBridgeCount = bridgeTileCount(state);
  const occupied = new Set(state.map.placedTiles.flatMap((tile) => tile.hexIds));
  const occupiedTerrainTypes = new Set(
    state.map.placedTiles
      .filter((tile) => tile.strain < 3)
      .flatMap((tile) => tile.hexIds)
      .map((hexId) => mapById[hexId]?.terrain)
      .filter((terrain): terrain is Terrain => Boolean(terrain && terrain !== "water")),
  );
  const missingProductionTerrains = new Set<string>();
  if (plan) {
    const produced = new Set<ResourceType>(state.map.placedTiles.flatMap((tile) => {
      if (tile.kind !== "core") return [];
      const side = coreTileById[tile.tileId][tile.side === "upgraded" ? "upgraded" : "basic"];
      return (Object.entries(side.production ?? {}) as Array<[ResourceType, number]>)
        .filter(([, amount]) => amount > 0)
        .map(([resource]) => resource);
    }));
    const terrainByResource: Partial<Record<ResourceType, string>> = {
      wood: "woodland", stone: "mountains", metal: "ruins", food: "arable", herbs: "heaths",
    };
    for (const resource of Object.keys(plan.expectedResourceDemand) as ResourceType[]) {
      if (
        !produced.has(resource) &&
        resourceDemandDeficit(state, plan, resource) >= 4 &&
        terrainByResource[resource]
      ) {
        missingProductionTerrains.add(terrainByResource[resource]!);
      }
    }
  }
  let candidateCells = mapCells.filter((cell) => cell.id === player.stewardHexId);
  if (player.hasPlacedFirstTile) {
    const reachableIds = selectReachablePlacedTileIds(state, playerId);
    const reachableHexes = state.map.placedTiles
      .filter((tile) => reachableIds.has(tile.instanceId))
      .flatMap((tile) => tile.hexIds);
    const candidateIds = new Set(reachableHexes.flatMap(getHexNeighbors));
    if (player.temporaryReachHexId) candidateIds.add(player.temporaryReachHexId);
    const hasDocks = state.map.placedTiles.some((tile) => reachableIds.has(tile.instanceId) && tile.tileId === "special_docks" && tile.strain < 3);
    if (hasDocks) {
      for (const cell of mapCells) {
        if (cell.terrain !== "water" && getHexNeighbors(cell.id).some((id) => mapById[id]?.terrain === "water")) candidateIds.add(cell.id);
      }
    }
    candidateCells = mapCells.filter((cell) => candidateIds.has(cell.id) && !occupied.has(cell.id));
  }
  const cellLimit = expanded ? 24 : 12;
  if (plan && candidateCells.length > cellLimit) {
    candidateCells = candidateCells
      .map((cell) => ({
        cell,
        score:
          getHexNeighbors(cell.id).filter((neighbor) => occupied.has(neighbor)).length * 5 +
          (mapById[cell.id].terrain === "grasslands" ? 2 : 4),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, cellLimit)
      .map(({ cell }) => cell);
  }
  const tiles = [
    ...coreTiles.filter((tile) => state.tileSupply.core[tile.id] > 0).map((tile) => ({ ...tile, kind: "core" as const, name: tile.basic.name })),
    ...specialTiles.filter((tile) => state.tileSupply.special[tile.id] > 0).map((tile) => ({ ...tile, kind: "special" as const, name: tile.name })),
  ].filter((tile) =>
    getTileFootprintKind(tile.id) !== "detached" &&
    !(noTravel && tile.category === "travel") &&
    !(
      tile.kind === "core" &&
      tile.category === "resource" &&
      placedCoreResourceCount >= 3 &&
      !resourceLineageTarget &&
      !missingFoundationTileIds.has(tile.id)
    )
  );
  const scored = tiles.map((tile) => {
    let score = random() * 3 + (categoryWeights[tile.category] ?? 0);
    let reasonCode = "FINAL_SCORE_CONVERSION";
    let reason = `Place ${tile.name} for its immediate settlement value.`;
    if (tile.kind === "core") {
      const isMissingFoundation = missingFoundationTileIds.has(tile.id);
      if (isMissingFoundation) {
        score += 118;
        reasonCode = "SETUP_FOR_SEEDED_ARRIVAL";
        reason = `Place ${tile.name} as the printed foundation for an unlocked or forecast Special Tile.`;
      }
      if (plan?.needsSupportBeforeHousing && tileHasStrategicProtection(tile.id, "basic")) {
        score += state.season === 1 ? 38 : 24;
        reasonCode = "SUPPORT_BEFORE_HOUSING";
        reason = "Establish prevention or Strain relief before forecast Burdens can disable the economy or scoring district.";
      }
      score += tile.basic.population + tile.basic.renown;
      if (targets.includes("LE-003") || hasV43Target(targets, "LE-003")) score += tile.basic.renown * 18;
      if (targets.includes("LE-001") || targets.includes("LE-039") || targets.includes("LE-041") || targets.includes("LE-042") || hasV43Target(targets, "LE-041", "LE-042")) {
        score += (tile.basic.population + tile.basic.renown) * (state.round >= 9 ? 4.5 : 2.5);
      }
      const scarcityCost = (Object.entries(tile.basic.cost) as Array<[ResourceType, number]>).reduce(
        (total, [resource, amount]) =>
          total + amount * (0.4 + Math.max(0, 8 - state.warehouse[resource]) * 0.35),
        0,
      );
      score -= scarcityCost;
      if (tile.category === "resource") {
        const producedResources = (Object.entries(tile.basic.production ?? {}) as Array<[ResourceType, number]>)
          .filter(([, amount]) => amount > 0)
          .map(([resource]) => resource);
        const demandReason = chooseResourceDemandReason(state, plan, producedResources);
        const existingProduction = new Set(
          state.map.placedTiles.flatMap((placed) => {
            if (placed.kind !== "core") return [];
            const side = coreTileById[placed.tileId][placed.side === "upgraded" ? "upgraded" : "basic"];
            return Object.entries(side.production ?? {}).filter(([, amount]) => amount > 0).map(([resource]) => resource);
          }),
        );
        const productionValue = (Object.entries(tile.basic.production ?? {}) as Array<[ResourceType, number]>).reduce(
          (total, [resource, amount]) =>
            total + amount * (plan ? resourceDemandDeficit(state, plan, resource) : Math.max(0, 13 - state.warehouse[resource])),
          0,
        );
        score += 25 + productionValue * 4;
        if (plan && Object.entries(tile.basic.production ?? {}).some(([resource, amount]) => amount > 0 && !existingProduction.has(resource))) score += 20;
        if (state.round >= 8 && !hasTarget(targets, "LE-007", "LE-034", "LE-035", "LE-036", "LE-037", "LE-038", "LE-040", "LE-047", "LE-049")) score -= 28;
        const concreteSpendTarget = plan && state.round > 8 && tile.basic.production
          ? findConcreteProductionSpendTarget(state, playerId, plan, tile.basic.production)
          : null;
        if (isMissingFoundation) {
          // Keep the explicit Special-Tile prerequisite rationale assigned above.
        } else if (state.round > 8 && plan && !concreteSpendTarget) {
          score = Math.min(-12, score - 120);
          reasonCode = "RESOURCE_FLOATING_NO_SPEND_TARGET";
          reason = "Do not place another production tile after Round 8: it has no legal, named spend route before game end.";
        } else if (concreteSpendTarget) {
          score += concreteSpendTarget.priority * 0.12;
          reasonCode = concreteSpendTarget.reasonCode;
          reason = `Add production specifically to ${concreteSpendTarget.label}; it can contribute ${formatResourceShortfall(concreteSpendTarget.contribution)} before game end.`;
        } else {
          reasonCode = demandReason.reasonCode;
          reason = `Build production against forecast Warehouse demand (${Math.round(productionValue)} readiness value). ${demandReason.reason}`;
        }
      }
      if (tile.category === "housing") {
        score += 24 +
          tile.basic.population * (state.season >= 2 ? 2.2 : 0.9) +
          (state.season >= 2 ? 24 : 0) +
          (state.round >= 9 ? 36 : 0);
      }
      if (tile.category === "travel") {
        score += travelTarget ? 18 : 8;
        if (travelCount >= desiredTravel) score -= 82 + travelCount * 7;
        if (state.round >= 8 && travelCount >= Math.max(2, desiredTravel - 1)) score -= 38;
      }
      if (tile.id === "c15_path") score += travelTarget && travelCount < desiredTravel ? 10 : 2;
      if (hasTarget(targets, "LE-008") && tile.id === "c18_common_land") score += 130;
      if (hasTarget(targets, "LE-015", "LE-018", "LE-044") && tile.id === "c19_bridge") {
        score += 160;
        if (hasTarget(targets, "LE-015", "LE-044") && currentBridgeCount >= 1) score -= 180;
        if (hasTarget(targets, "LE-018") && currentBridgeCount >= 2) score -= 180;
      }
      if (hasTarget(targets, "LE-032") && tile.id === "c17_track") score += 170;
      if (hasTarget(targets, "LE-033") && tile.id === "c11_washhouse") score += 140;
      if (hasTarget(targets, "LE-034") && tile.id === "c04_farmstead") score += 135;
      if (hasTarget(targets, "LE-035") && tile.id === "c02_mine_tunnel") score += 135;
      if (hasTarget(targets, "LE-036", "LE-037", "LE-038", "LE-047", "LE-049") && ["c01_lumber_yard", "c02_mine_tunnel", "c03_gathering_outpost", "c04_farmstead", "c20_dig_site"].includes(tile.id)) score += 92;
      if (hasTarget(targets, "LE-040") && ["c01_lumber_yard", "c02_mine_tunnel", "c04_farmstead"].includes(tile.id)) score += 125;
      if (hasTarget(targets, "LE-028") && tileHasSemantic(tile.id, "basic", "support")) score += 90;
      if (hasV43Target(targets, "LE-008") && tile.id === "c18_common_land") score += 120;
      if (hasV43Target(targets, "LE-018", "LE-044") && tile.id === "c19_bridge") score += 130;
      if (hasV43Target(targets, "LE-032") && tile.id === "c17_track") score += 150;
      if (hasV43Target(targets, "LE-033") && tile.id === "c11_washhouse") score += 120;
      if (hasV43Target(targets, "LE-034") && tile.id === "c04_farmstead") score += 120;
      if (hasV43Target(targets, "LE-035") && tile.id === "c02_mine_tunnel") score += 120;
      if (hasV43Target(targets, "LE-036", "LE-037") && ["c01_lumber_yard", "c02_mine_tunnel", "c03_gathering_outpost", "c04_farmstead"].includes(tile.id)) score += 105;
      if (hasV43Target(targets, "LE-040") && ["c01_lumber_yard", "c02_mine_tunnel", "c04_farmstead"].includes(tile.id)) score += 95;
      if (plan && tile.category === "travel") {
        if (!plan.needsTravelAnchor && !travelTarget && travelCount >= 1) score -= 45;
        if (tile.id === "c15_path" && !travelTarget && travelCount >= 2) score -= 55;
        reasonCode = "TRAVEL_ENABLES_PLAN";
        reason = "Create only the Travel anchor needed for reachability, engine adjacency, or scoring.";
      }
      if (plan && tile.category === "crafting") {
        const existing = state.map.placedTiles.filter((placed) => tileCategory(placed) === "crafting").length;
        score += plan.needsCrafting && state.season <= 2 ? 24 - existing * 22 : -28;
        reasonCode = "CRAFTING_DISCOUNT_ENGINE";
        reason = "Invest early so later planned upgrades receive repeated Crafting savings.";
      }
      if (plan && tile.category === "merchant") {
        const existing = state.map.placedTiles.filter((placed) => tileCategory(placed) === "merchant").length;
        score += plan.needsMerchant && state.season <= 2 ? 22 - existing * 22 : -26;
        reasonCode = "MERCHANT_CONVERSION_ENGINE";
        reason = "Add Goods conversion to smooth forecast Arrival and upgrade costs.";
      }
      if (plan && tile.category === "housing") {
        const supportPresent = state.map.placedTiles.some((placed) =>
          placed.support.passive ||
          placed.support.singleUse ||
          tileHasSemantic(placed.tileId, placed.side, "support")
        );
        if (plan.needsSupportBeforeHousing && !supportPresent && state.season < 3) score -= 22;
        reasonCode = "HOUSING_CLUSTER_CONVERSION";
        reason = supportPresent
          ? "Convert the prepared and protected district into clustered Housing score."
          : "Extend the Housing cluster because the conversion window is closing.";
      }
      if (missingFoundationTileIds.has(tile.id)) {
        reasonCode = "SETUP_FOR_SEEDED_ARRIVAL";
        reason = `Place ${tile.name} as the printed foundation for an unlocked or forecast Special Tile.`;
      }
      if (noTravel && tile.category === "travel") score -= 1000;
      if (noFarmstead && tile.id === "c04_farmstead") score -= 1000;
      if (!player.hasPlacedFirstTile && tileCostTotal(tile.id) === 0) {
        score += tile.category === "resource" ? 180 : tile.category === "travel" ? 45 : 80;
      }
    } else {
      score += tile.population + tile.renown + 28;
      if (hasTarget(targets, "LE-019", "LE-022", "LE-023")) score += 72;
      if (targets.includes("LE-003") || hasV43Target(targets, "LE-003")) score += tile.renown * 18;
      if (targets.includes("LE-001") || targets.includes("LE-039") || targets.includes("LE-041") || targets.includes("LE-042") || hasV43Target(targets, "LE-041", "LE-042")) {
        score += (tile.population + tile.renown) * (state.round >= 9 ? 4.5 : 2.5);
      }
      if (plan?.needsSupportBeforeHousing && tileHasStrategicProtection(tile.id, "special")) {
        score += 28;
        reasonCode = "PROTECT_AGAINST_FORECAST_BURDEN";
        reason = "Place a Special Tile that directly answers the forecast Burden and Strain risk.";
      }
      if (plan?.targetSpecialTileIds.includes(tile.id)) score += 38;
      if (
        hasTarget(targets, "LE-023", "LE-050") &&
        (tileHasStrategicProtection(tile.id, "special") || tile.category === "housing")
      ) score += 32;
      if (plan?.targetSpecialTileIds.includes(tile.id)) {
        reasonCode = "SETUP_FOR_SEEDED_ARRIVAL";
        reason = `Place the Special Tile unlocked for this Season's planned Arrival.`;
      }
    }
    if (noTravel && tile.category === "travel") score -= 1000;
    return { tile, score, reasonCode, reason };
  }).sort((a, b) => b.score - a.score);

  const legalPlacements: Array<{
    tileId: string;
    placement: string | TilePlacementDraft;
    score: number;
    reasonCode: string;
    reason: string;
  }> = [];
  const placementTileCandidates = plan ? scored.slice(0, expanded ? 12 : 6) : scored;
  for (const { tile, score: tileScore, reasonCode, reason } of placementTileCandidates) {
    for (const placement of placementOptions(tile.id, candidateCells)) {
      if (!canStartPlaceTile(state, playerId, tile.id, placement).ok) continue;
      const placementHexIds = getTilePlacementHexIds(tile.id, placement);
      const adjacentTiles = state.map.placedTiles.filter((placed) =>
        placed.hexIds.some((hexId) =>
          placementHexIds.some((placedHexId) => getHexNeighbors(placedHexId).includes(hexId)),
        ),
      );
      const adjacentCategories = adjacentTiles.map(tileCategory);
      let geometryScore = adjacentTiles.length * 2;
      if (tile.category === "housing" && adjacentCategories.includes("housing")) geometryScore += 18;
      if (tile.category === "travel" && adjacentCategories.includes("travel")) geometryScore += 14;
      if (tile.category === "travel" && travelCount >= desiredTravel) geometryScore -= 130;
      if (["crafting", "merchant", "social", "wellbeing"].includes(tile.category) && adjacentCategories.includes("housing")) geometryScore += 11;
      if (tile.kind === "special" && adjacentCategories.includes("housing")) geometryScore += 8;
      if (plan?.needsCrafting && tile.category === "crafting" && adjacentCategories.includes("travel")) geometryScore += 18;
      if (plan?.needsMerchant && tile.category === "merchant" && adjacentCategories.includes("travel")) geometryScore += 18;
      if (plan && tile.category === "travel" && missingProductionTerrains.size > 0 && placementHexIds.some((hexId) =>
        getHexNeighbors(hexId).some((neighbor) => missingProductionTerrains.has(mapById[neighbor]?.terrain))
      )) geometryScore += 24;
      const placementSide = tile.kind === "special" ? "special" : "basic";
      if (plan?.needsSupportBeforeHousing && tileHasSemantic(tile.id, placementSide, "support")) {
        geometryScore += adjacentCategories.includes("housing") ? 20 : adjacentTiles.length * 3;
      }
      if (adjacentTiles.some((placed) => placed.tileId.startsWith("golden_tile_"))) geometryScore += 9;
      if (targets.some((id) => ["LE-005", "LE-006"].includes(id))) {
        geometryScore += placementHexIds.reduce(
          (total, hexId) => total + getHexNeighbors(hexId).filter((neighbor) => occupied.has(neighbor)).length * 3,
          0,
        );
      }
      if (hasTarget(targets, "LE-005") && placementHexIds.some(isCornerHex)) geometryScore += 320;
      if (hasTarget(targets, "LE-006") && placementHexIds.some(isEdgeHex)) geometryScore += 95;
      if (hasTarget(targets, "LE-007") && placementHexIds.some((hexId) => {
        const terrain = mapById[hexId]?.terrain;
        return Boolean(terrain && terrain !== "water" && !occupiedTerrainTypes.has(terrain));
      })) geometryScore += 125;
      if (hasTarget(targets, "LE-008") && tile.category === "housing" && adjacentTiles.some((placed) => placed.tileId === "c18_common_land")) geometryScore += 145;
      if (hasTarget(targets, "LE-009", "LE-010") && tile.category === "housing" && adjacentCategories.some((category) => category === "social" || category === "wellbeing")) geometryScore += 70;
      if (hasTarget(targets, "LE-011", "LE-045") && tile.category === "housing" && adjacentCategories.includes("housing")) geometryScore += 82;
      if (hasTarget(targets, "LE-013") && tile.category === "merchant" && adjacentCategories.includes("housing")) geometryScore += 55;
      if (hasTarget(targets, "LE-013") && ["housing", "social", "travel"].includes(tile.category) && adjacentCategories.includes("merchant")) geometryScore += 82;
      if (hasTarget(targets, "LE-014")) geometryScore += placementHexIds.reduce((total, hexId) => total + getHexNeighbors(hexId).filter((neighbor) => occupied.has(neighbor)).length * 8, 0);
      if (hasTarget(targets, "LE-015", "LE-018", "LE-044") && tile.id === "c19_bridge") geometryScore += 125;
      if (hasTarget(targets, "LE-016", "LE-017") && placementHexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => mapById[neighbor]?.terrain === "water"))) geometryScore += 86;
      if (hasTarget(targets, "LE-023", "LE-050") && tile.kind === "special" && adjacentCategories.includes("housing")) geometryScore += 112;
      if (hasTarget(targets, "LE-028") && tileHasSemantic(tile.id, placementSide, "support") && adjacentTiles.length > 0) geometryScore += 70;
      if (hasTarget(targets, "LE-032") && ["crafting", "merchant"].includes(tile.category) && adjacentTiles.some((placed) => placed.tileId === "c17_track")) geometryScore += 170;
      if (hasTarget(targets, "LE-033") && ["crafting", "merchant", "social"].includes(tile.category) && adjacentTiles.some((placed) => placed.tileId === "c11_washhouse")) geometryScore += 130;
      if (hasTarget(targets, "LE-034") && tile.id === "c04_farmstead" && adjacentCategories.includes("housing")) geometryScore += 145;
      if (hasTarget(targets, "LE-035") && tile.id === "c02_mine_tunnel" && adjacentCategories.includes("travel")) geometryScore += 145;
      if (hasTarget(targets, "LE-040") && ["c01_lumber_yard", "c02_mine_tunnel", "c04_farmstead"].includes(tile.id) && adjacentCategories.includes("travel")) geometryScore += 135;
      if (hasV43Target(targets, "LE-005") && placementHexIds.some((hexId) => ["A1", "A9", "N1", "N9"].includes(hexId))) geometryScore += 260;
      if (hasV43Target(targets, "LE-006") && placementHexIds.some((hexId) => {
        const cell = mapById[hexId];
        return cell.terrain !== "water" && (cell.col === "A" || cell.col === "N" || cell.row === 1 || cell.row === 9);
      })) geometryScore += 75;
      if (hasV43Target(targets, "LE-007") && placementHexIds.some((hexId) => mapById[hexId].terrain !== "grasslands" && mapById[hexId].terrain !== "water")) geometryScore += 65;
      if (hasV43Target(targets, "LE-008") && tile.category === "housing" && adjacentTiles.some((placed) => placed.tileId === "c18_common_land")) geometryScore += 125;
      if (hasV43Target(targets, "LE-009") && ["social", "wellbeing"].includes(tile.category) && adjacentCategories.includes("housing")) geometryScore += 80;
      if (hasV43Target(targets, "LE-010") && ["housing", "social", "wellbeing"].includes(tile.category) && adjacentTiles.some((placed) => tileCategory(placed) === "wellbeing")) geometryScore += 72;
      if (hasV43Target(targets, "LE-013") && ["housing", "social", "travel"].includes(tile.category) && adjacentCategories.includes("merchant")) geometryScore += 88;
      if (hasV43Target(targets, "LE-014")) geometryScore += placementHexIds.reduce((total, hexId) => total + getHexNeighbors(hexId).filter((neighbor) => occupied.has(neighbor)).length * 7, 0);
      if (hasV43Target(targets, "LE-016", "LE-017") && placementHexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => mapById[neighbor]?.terrain === "water"))) geometryScore += 66;
      if (hasV43Target(targets, "LE-023") && tile.kind === "special" && adjacentCategories.includes("housing")) geometryScore += 95;
      if (hasV43Target(targets, "LE-032") && ["crafting", "merchant"].includes(tile.category) && adjacentTiles.some((placed) => placed.tileId === "c17_track")) geometryScore += 150;
      if (hasV43Target(targets, "LE-033") && ["crafting", "merchant", "social"].includes(tile.category) && adjacentTiles.some((placed) => placed.tileId === "c11_washhouse")) geometryScore += 110;
      if (hasV43Target(targets, "LE-034") && tile.id === "c04_farmstead" && adjacentCategories.includes("housing")) geometryScore += 120;
      if (hasV43Target(targets, "LE-035") && tile.id === "c02_mine_tunnel" && adjacentCategories.includes("travel")) geometryScore += 120;
      if (hasV43Target(targets, "LE-040") && ["c01_lumber_yard", "c02_mine_tunnel", "c04_farmstead"].includes(tile.id) && adjacentCategories.includes("travel")) geometryScore += 110;
      if (targets.some((id) => ["LE-015", "LE-018", "LE-044"].includes(id)) && tile.id === "c19_bridge") geometryScore += 80;
      if (targets.includes("LE-016") && placementHexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => mapById[neighbor]?.terrain === "water"))) geometryScore += 22;
      legalPlacements.push({
        tileId: tile.id,
        placement,
        score: tileScore + geometryScore + random(),
        reasonCode,
        reason,
      });
    }
  }
  legalPlacements.sort((a, b) => b.score - a.score);
  const best = legalPlacements[0];
  if (!best && plan && !expanded) {
    return findPlacement(state, playerId, targets, random, plan, true);
  }
  if (!best && plan && expanded) {
    return findPlacement(state, playerId, targets, random, undefined, true);
  }
  return best ?? null;
}

function chooseUpgrade(
  state: GameState,
  playerId: string,
  targets: string[],
  plan?: HumanSeasonPlan,
): { instanceId: string; score: number; reasonCode: string; reason: string } | null {
  if (targets.includes("LE-042") || hasV43Target(targets, "LE-042")) return null;
  const targetBoost = targets.some((id) => ["LE-001", "LE-003", "LE-031", "LE-036", "LE-046"].includes(id)) || hasV43Target(targets, "LE-031", "LE-036", "LE-046") ? 34 : 0;
  const conversion = scoreConversionPressure(state);
  const candidates = getUpgradeableTileIds(state, playerId).map((instanceId) => {
    const placed = state.map.placedTiles.find((tile) => tile.instanceId === instanceId)!;
    const tile = coreTileById[placed.tileId];
    const productionGain = (Object.entries(tile.upgraded.production ?? {}) as Array<[ResourceType, number]>).reduce(
      (total, [resource, amount]) => {
        const basicAmount = tile.basic.production?.[resource] ?? 0;
        return total + Math.max(0, amount - basicAmount) * Math.max(0, 12 - state.warehouse[resource]);
      },
      0,
    );
    const scarcityCost = (Object.entries(tile.upgraded.cost) as Array<[ResourceType, number]>).reduce(
      (total, [resource, amount]) =>
        total + amount * (0.5 + Math.max(0, 7 - state.warehouse[resource]) * 0.3),
      0,
    );
    const scoringGain =
      (tile.upgraded.population + tile.upgraded.renown) -
      (tile.basic.population + tile.basic.renown);
    const plannedResourceGain = (Object.entries(tile.upgraded.production ?? {}) as Array<[ResourceType, number]>).reduce(
      (total, [resource, amount]) => total + Math.max(0, amount - (tile.basic.production?.[resource] ?? 0)) * (plan ? resourceDemandDeficit(state, plan, resource) : 0),
      0,
    );
    const isHousing = tile.category === "housing";
    const upgradedResourceCount = state.map.placedTiles.filter(
      (candidate) => candidate.kind === "core" && candidate.side === "upgraded" && tileCategory(candidate) === "resource",
    ).length;
    const resourceLineageBoost = (hasTarget(targets, "LE-036", "LE-037", "LE-038", "LE-040", "LE-047", "LE-049") || hasV43Target(targets, "LE-036")) && ["c01_lumber_yard", "c02_mine_tunnel", "c03_gathering_outpost", "c04_farmstead", "c20_dig_site"].includes(placed.tileId) ? 75 : 0;
    const adjacencyUpgradeBoost = hasTarget(targets, "LE-046") && state.map.placedTiles.some((other) =>
      other.instanceId !== placed.instanceId &&
      other.kind === "core" &&
      other.side === "upgraded" &&
      other.hexIds.some((hexId) => placed.hexIds.some((placedHexId) => getHexNeighbors(placedHexId).includes(hexId)))
    ) ? 70 : 0;
    const engineUpgradeBoost = plan && state.round <= 7
      ? placed.tileId === "c13_workshops" && plan.needsCrafting
        ? 34
        : placed.tileId === "c14_market_stalls" && plan.needsMerchant
          ? 32
          : 0
      : 0;
    const lateProductionDamping = tile.category === "resource" && state.round >= 8 && !hasTarget(targets, "LE-036", "LE-037", "LE-038", "LE-040", "LE-047", "LE-049") ? -18 : 0;
    const excessResourceUpgradePenalty = tile.category === "resource" && upgradedResourceCount >= 2 &&
      !hasTarget(targets, "LE-036", "LE-037", "LE-038", "LE-040", "LE-047", "LE-049")
      ? -68
      : 0;
    const resourceReason = tile.category === "resource"
      ? chooseResourceDemandReason(
        state,
        plan,
        (Object.entries(tile.upgraded.production ?? {}) as Array<[ResourceType, number]>)
          .filter(([, amount]) => amount > 0)
          .map(([resource]) => resource),
      )
      : undefined;
    const incrementalProduction = tile.category === "resource"
      ? Object.fromEntries(
        (Object.entries(tile.upgraded.production ?? {}) as Array<[ResourceType, number]>)
          .map(([resource, amount]) => [
            resource,
            Math.max(0, amount - (tile.basic.production?.[resource] ?? 0)),
          ] as const)
          .filter(([, amount]) => amount > 0),
      ) as Partial<Record<ResourceType, number>>
      : {};
    const lateResourceSpendTarget = tile.category === "resource" && plan && state.round > 8
      ? findConcreteProductionSpendTarget(state, playerId, plan, incrementalProduction)
      : null;
    const lateFloatingProductionPenalty = tile.category === "resource" && plan && state.round > 8 && !lateResourceSpendTarget
      ? -120
      : 0;
    const score =
      targetBoost +
      resourceLineageBoost +
      adjacencyUpgradeBoost +
      engineUpgradeBoost +
      scoringGain * (plan && isHousing && plan.housingPush ? 3.2 * conversion : 1.4 * conversion) +
      productionGain * (state.round <= 6 ? 2.2 : state.round <= 8 ? 1.4 : 0.55) -
      scarcityCost +
      plannedResourceGain * (state.season === 1 ? 2 : 0.8) +
      lateProductionDamping +
      excessResourceUpgradePenalty +
      lateFloatingProductionPenalty +
      (lateResourceSpendTarget?.priority ?? 0) * 0.08;
    return {
      instanceId,
      score,
      reasonCode: placed.tileId === "c13_workshops"
        ? "CRAFTING_DISCOUNT_ENGINE"
        : placed.tileId === "c14_market_stalls"
          ? "MERCHANT_CONVERSION_ENGINE"
          : isHousing
            ? "HIGH_VALUE_UPGRADE"
            : lateResourceSpendTarget?.reasonCode ??
              (lateFloatingProductionPenalty < 0 ? "RESOURCE_FLOATING_NO_SPEND_TARGET" : resourceReason?.reasonCode) ??
              "HIGH_VALUE_UPGRADE",
      reason: placed.tileId === "c13_workshops" && engineUpgradeBoost > 0
        ? "Upgrade Workshops while enough future upgrades remain to repay the stronger discount."
        : placed.tileId === "c14_market_stalls" && engineUpgradeBoost > 0
          ? "Upgrade Market Stalls while future payments can still exploit stronger Goods conversion."
          : isHousing
        ? "Convert an established Housing tile into immediate score during the planned expansion window."
        : tile.category === "resource"
          ? lateResourceSpendTarget
            ? `Upgrade production specifically to ${lateResourceSpendTarget.label}; the added output has a legal spend route before game end.`
            : lateFloatingProductionPenalty < 0
              ? "Do not upgrade production after Round 8 when its added output has no legal, named spend route before game end."
              : `Upgrade production early only where a named spend can repay it over remaining activations. ${resourceReason?.reason ?? ""}`
          : "Take a positive-value upgrade with useful remaining-season payoff.",
    };
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

type ResourceSpendReasonCode =
  | "RESOURCE_FOR_PLANNED_UPGRADE"
  | "RESOURCE_FOR_SEEDED_ARRIVAL"
  | "RESOURCE_FOR_BURDEN_PAYMENT"
  | "RESOURCE_FOR_HOUSING_CLUSTER"
  | "RESOURCE_FOR_FINAL_SCORE_TILE";

interface ResourceSpendTarget {
  label: string;
  missing: Partial<Record<ResourceType, number>>;
  contribution: Partial<Record<ResourceType, number>>;
  reasonCode: ResourceSpendReasonCode;
  priority: number;
}

function spendTargetForShortfall(
  state: GameState,
  production: Partial<Record<ResourceType, number>>,
  label: string,
  missing: Partial<Record<ResourceType, number>> | undefined,
  reasonCode: ResourceSpendReasonCode,
  priority: number,
): ResourceSpendTarget | null {
  if (!missing || Object.keys(missing).length === 0) return null;
  const shortfalls = Object.entries(missing) as Array<[ResourceType, number]>;
  const contribution = Object.fromEntries(
    shortfalls
      .filter(([resource]) => (production[resource] ?? 0) > 0)
      .map(([resource, amount]) => [resource, Math.min(amount, production[resource] ?? 0)]),
  ) as Partial<Record<ResourceType, number>>;
  if (Object.keys(contribution).length === 0) return null;

  const activatableIds = new Set(getActivatableTileIds(state, state.currentPlayerId));
  const bestAvailableOutput = (resource: ResourceType): number => state.map.placedTiles.reduce((best, placed) => {
    if (placed.strain >= 3 || state.round === 12 && !activatableIds.has(placed.instanceId)) return best;
    const side = placed.kind === "special"
      ? specialTileById[placed.tileId]
      : coreTileById[placed.tileId][placed.side === "upgraded" ? "upgraded" : "basic"];
    const output = "production" in side ? side.production?.[resource] ?? 0 : 0;
    return Math.max(best, output);
  }, 0);
  const outputFor = (resource: ResourceType) => Math.max(production[resource] ?? 0, bestAvailableOutput(resource));
  if (shortfalls.some(([resource]) => outputFor(resource) <= 0)) return null;

  const activationsNeeded = Math.max(
    ...shortfalls.map(([resource, amount]) => Math.ceil(amount / outputFor(resource))),
  );
  const productionWindowsLeft = 13 - state.round;
  const actionBudgetLeft = state.actionsRemaining + Math.max(0, 12 - state.round) * 4;
  if (activationsNeeded > productionWindowsLeft || activationsNeeded + 1 > actionBudgetLeft) return null;
  return { label, missing, contribution, reasonCode, priority };
}

function nearNetworkPlacementOptions(
  state: GameState,
  playerId: string,
  tileId: string,
): Array<string | TilePlacementDraft> {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return [];
  if (!player.hasPlacedFirstTile) {
    const start = mapById[player.stewardHexId];
    return start ? placementOptions(tileId, [start]) : [];
  }
  const occupied = new Set(state.map.placedTiles.flatMap((tile) => tile.hexIds));
  const reachableIds = selectReachablePlacedTileIds(state, playerId);
  const frontierIds = new Set(
    state.map.placedTiles
      .filter((tile) => reachableIds.has(tile.instanceId))
      .flatMap((tile) => tile.hexIds)
      .flatMap(getHexNeighbors)
      .filter((hexId) => !occupied.has(hexId)),
  );
  if (player.temporaryReachHexId && !occupied.has(player.temporaryReachHexId)) {
    frontierIds.add(player.temporaryReachHexId);
  }
  return placementOptions(tileId, mapCells.filter((cell) => frontierIds.has(cell.id)));
}

function findConcreteProductionSpendTarget(
  state: GameState,
  playerId: string,
  plan: HumanSeasonPlan | undefined,
  production: Partial<Record<ResourceType, number>>,
): ResourceSpendTarget | null {
  const targets: ResourceSpendTarget[] = [];
  const add = (candidate: ResourceSpendTarget | null) => {
    if (candidate) targets.push(candidate);
  };

  for (const active of state.encounters.activeArrivals) {
    const card = encounterById[active.cardId];
    if (!card || card.type !== "arrival") continue;
    const validation = canCompleteArrival(state, active.cardId);
    add(spendTargetForShortfall(
      state,
      production,
      `complete seeded Arrival ${card.name}`,
      validation.missingResources,
      "RESOURCE_FOR_SEEDED_ARRIVAL",
      90 + cardPlanPriority(plan, active.cardId) + Math.max(0, 3 - active.timerTokens) * 8,
    ));
  }

  for (const cardId of state.encounters.activeBurdens) {
    const card = encounterById[cardId];
    if (!card || card.type !== "burden") continue;
    const validation = canResolveBurden(state, cardId);
    add(spendTargetForShortfall(
      state,
      production,
      `pay off active Burden ${card.name}`,
      validation.missingResources,
      "RESOURCE_FOR_BURDEN_PAYMENT",
      84 + cardPlanPriority(plan, cardId),
    ));
  }

  for (const placed of state.map.placedTiles) {
    if (placed.kind !== "core" || placed.side !== "basic") continue;
    const tile = coreTileById[placed.tileId];
    const scoreGain =
      tile.upgraded.population + tile.upgraded.renown -
      tile.basic.population - tile.basic.renown;
    const valuePriority = tile.category === "housing" ? 76 : scoreGain > 0 ? 66 : 48;
    const validation = canStartUpgradeTile(state, playerId, placed.instanceId);
    add(spendTargetForShortfall(
      state,
      production,
      `upgrade ${tile.basic.name} to ${tile.upgraded.name}`,
      validation.missingResources,
      "RESOURCE_FOR_PLANNED_UPGRADE",
      valuePriority + Math.max(0, scoreGain),
    ));
  }

  const scoringTiles = coreTiles
    .filter((tile) =>
      state.tileSupply.core[tile.id] > 0 &&
      tile.category !== "resource" &&
      tile.category !== "travel" &&
      tile.basic.population + tile.basic.renown > 0
    )
    .sort((a, b) =>
      (b.category === "housing" ? 1 : 0) - (a.category === "housing" ? 1 : 0) ||
      (b.basic.population + b.basic.renown) - (a.basic.population + a.basic.renown)
    );
  for (const tile of scoringTiles) {
    for (const placement of nearNetworkPlacementOptions(state, playerId, tile.id)) {
      const validation = canStartPlaceTile(state, playerId, tile.id, placement);
      const candidate = spendTargetForShortfall(
        state,
        production,
        `place ${tile.basic.name}`,
        validation.missingResources,
        tile.category === "housing" ? "RESOURCE_FOR_HOUSING_CLUSTER" : "RESOURCE_FOR_FINAL_SCORE_TILE",
        (tile.category === "housing" ? 74 : 58) + tile.basic.population + tile.basic.renown,
      );
      if (candidate) {
        targets.push(candidate);
        break;
      }
    }
  }

  return targets.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

function formatResourceShortfall(missing: Partial<Record<ResourceType, number>>): string {
  return (Object.entries(missing) as Array<[ResourceType, number]>)
    .map(([resource, amount]) => `${amount} ${resource}`)
    .join(" and ");
}

function hasKnownFutureStrainThreat(state: GameState, plan?: HumanSeasonPlan): boolean {
  const expiringArrivalThreats = state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens <= 1).length;
  const forecastBurdenThreats = plan?.forecasts.filter((forecast) => {
    const card = encounterById[forecast.cardId];
    if (card?.type !== "burden") return false;
    const alreadyRevealed =
      state.encounters.discardPile.includes(forecast.cardId) ||
      state.encounters.activeBurdens.includes(forecast.cardId);
    return !alreadyRevealed;
  }).length ?? 0;
  const protectedTiles = state.map.placedTiles.filter(
    (tile) => (tile.support.passive || tile.support.singleUse) && !tile.support.preventedThisRound,
  ).length;
  // One expiring Arrival normally threatens one Strain; reserve roughly two
  // protected tiles for each unrevealed Burden whose exact targets are not yet
  // known. Once that buffer exists, further support activations are action
  // waste rather than prudent preparation.
  return expiringArrivalThreats + forecastBurdenThreats * 2 > protectedTiles;
}

function chooseActivation(
  state: GameState,
  playerId: string,
  plan?: HumanSeasonPlan,
): { instanceId: string; score: number; reasonCode: string; reason: string } | null {
  const stockpile = warehouseTotal(state);
  const candidates = getActivatableTileIds(state, playerId).map((instanceId) => {
    const placed = state.map.placedTiles.find((tile) => tile.instanceId === instanceId)!;
    const side = placed.kind === "special"
      ? specialTileById[placed.tileId]
      : placed.side === "upgraded"
        ? coreTileById[placed.tileId].upgraded
        : coreTileById[placed.tileId].basic;
    const ruleId = tileEffectRuleId(placed.tileId, placed.side);
    const rule = getEffectRule(ruleId);
    const semantics = getEffectSemanticTags(rule);
    const production = "production" in side ? side.production : undefined;
    const producedResources = production
      ? (Object.entries(production) as Array<[ResourceType, number]>)
        .filter(([, amount]) => amount > 0)
        .map(([resource]) => resource)
      : [];
    const demandReason = chooseResourceDemandReason(state, plan, producedResources);
    const productionNeed = production
      ? (Object.entries(production) as Array<[ResourceType, number]>).reduce(
          (score, [resource, amount]) => score + amount * (plan ? resourceDemandDeficit(state, plan, resource) : Math.max(0, 15 - state.warehouse[resource])),
          0,
        )
      : 0;
    const productionTiming = state.round <= 5 ? 1.15 : state.round <= 8 ? 0.78 : 0.42;
    const isProduction = "effectType" in side && side.effectType === "production";
    let score = isProduction ? productionNeed * productionTiming : -1;
    let reasonCode: string = demandReason.reasonCode;
    let reason = `Activate production only for a named current or forecast spend. ${demandReason.reason}`;
    if (isProduction) {
      if (state.round >= 8 && stockpile >= 34) score -= 18;
      if (state.round >= 10 && stockpile >= 24) score -= 26;
      if (productionNeed <= 3 && state.round >= 7) score -= 10;
      if (state.round > 8 && production) {
        const spendTarget = findConcreteProductionSpendTarget(state, playerId, plan, production);
        if (spendTarget) {
          const usefulOutput = Object.values(spendTarget.contribution).reduce((total, amount) => total + (amount ?? 0), 0);
          score = Math.max(score - 8, 7 + usefulOutput * 5 + spendTarget.priority * 0.08);
          reasonCode = spendTarget.reasonCode;
          reason = `Produce ${formatResourceShortfall(spendTarget.contribution)} toward the remaining ${formatResourceShortfall(spendTarget.missing)} needed to ${spendTarget.label}.`;
        } else {
          score = Math.min(-2, score - 48);
          reasonCode = "RESOURCE_FLOATING_NO_SPEND_TARGET";
          reason = "Late production has no legal, named spend target before game end, so its expected value is negative.";
        }
      }
    }
    if (semantics.includes("arrival_time")) {
      const timerSpace = state.encounters.activeArrivals.reduce(
        (total, arrival) => total + Math.max(0, 3 - arrival.timerTokens),
        0,
      );
      if (timerSpace > 0 && state.round <= 10) score = Math.max(score, 18 + timerSpace * 2);
      if (state.round >= 11) score = Math.min(score, 4);
      reasonCode = "SETUP_FOR_SEEDED_ARRIVAL";
      reason = "Preserve a valuable active Arrival until its planned requirement can be met.";
    }
    if (semantics.includes("strain_relief")) {
      const targets = getValidEffectStrainTargets(state, ruleId, placed);
      const removable = targets.reduce((total, tile) => total + tile.strain, 0);
      const player = state.players.find((candidate) => candidate.id === playerId);
      const anchorStrain = player
        ? targets
          .filter((tile) => tile.hexIds.includes(player.stewardHexId))
          .reduce((total, tile) => total + tile.strain, 0)
        : 0;
      if (anchorStrain > 0) {
        score = Math.max(score, 72 + anchorStrain * 18);
        reasonCode = "PROTECT_STEWARD_REACH";
        reason = "Remove Strain from the Steward's current tile before Overstrain disconnects every later action.";
      } else if (removable > 0) {
        score = Math.max(score, 16 + removable * 5);
        reasonCode = "PROTECT_AGAINST_FORECAST_BURDEN";
        reason = "Remove Strain before it erases score or disables an engine tile.";
      }
    }
    if (rule.resolveBurden && state.encounters.activeBurdens.length > 0) {
      score = Math.max(score, 35 + state.encounters.activeBurdens.length * 4);
      reasonCode = "BURDEN_CLEAR_BEATS_PENALTY";
      reason = "Use a tile ability because clearing the Burden beats its damage and final penalty.";
    }
    if (rule.exchangeLimit !== undefined) {
      const amounts = Object.values(state.warehouse);
      const imbalance = Math.max(...amounts) - Math.min(...amounts);
      if (imbalance >= 4) score = Math.max(score, 10 + imbalance);
      reasonCode = "MERCHANT_CONVERSION_ENGINE";
      reason = "Convert surplus resources into the forecast deficit rather than merely tidy the Warehouse.";
    }
    if (semantics.includes("support")) {
      const supportTargets = getEffectSupportTargets(state, ruleId, placed);
      const player = state.players.find((candidate) => candidate.id === playerId);
      const anchorTarget = player
        ? supportTargets.find((tile) => tile.hexIds.includes(player.stewardHexId))
        : undefined;
      const anchorNeedsSupport = Boolean(
        anchorTarget && !anchorTarget.support.passive && !anchorTarget.support.singleUse,
      );
      if (supportTargets.length > 0 && hasKnownFutureStrainThreat(state, plan)) {
        if (anchorNeedsSupport) {
          score = Math.max(score, 185);
          reasonCode = "PROTECT_STEWARD_REACH";
          reason = "Reapply Supported to the Steward's tile before a forecast Strain effect can disconnect the whole settlement.";
        } else {
          score = Math.max(score, 12 + supportTargets.length * 3);
          reasonCode = "SUPPORT_BEFORE_HOUSING";
          reason = "Add protection to valuable district tiles before a still-unrevealed Burden or expiring Arrival can add Strain.";
        }
      } else {
        score = Math.min(score, -1);
        reasonCode = "NO_FORECAST_STRAIN_TO_PREVENT";
        reason = "Do not spend an Action on Supported when no known future Strain source remains this Season.";
      }
    }
    return { instanceId, score, reasonCode, reason };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function recordTileActivation(
  before: GameState,
  after: GameState,
  instanceId: string,
  stats: BotStats,
): void {
  const tile = before.map.placedTiles.find((candidate) => candidate.instanceId === instanceId);
  if (tile) {
    stats.tileActivationCountsByInstance[instanceId] =
      (stats.tileActivationCountsByInstance[instanceId] ?? 0) + 1;
  }
  if (!tile) return;
  const face = tile.kind === "special"
    ? specialTileById[tile.tileId]
    : coreTileById[tile.tileId][tile.side === "upgraded" ? "upgraded" : "basic"];
  if (!face) return;
  const production = "production" in face ? face.production : undefined;
  if (!production || !Object.values(production).some((amount) => amount > 0)) return;

  stats.productionActivationsByRound[before.round] =
    (stats.productionActivationsByRound[before.round] ?? 0) + 1;
  for (const resource of resourceTypes) {
    const actualGain = Math.max(0, after.warehouse[resource] - before.warehouse[resource]);
    stats.resourcesProducedByResource[resource] += actualGain;
  }
}

function playLegacyTurn(initial: GameState, targets: string[], profile: Profile, random: () => number, stats: BotStats): GameState {
  let state = initial;
  const playerId = state.currentPlayerId;
  let boonUsed = false;
  let powerPrepared = false;
  for (let guard = 0; guard < 24 && state.phase === "turns" && state.currentPlayerId === playerId; guard += 1) {
    state = drainPending(state, stats);
    if (state.pendingEffects.length || state.pendingDeckReorder || state.pendingCostChoice) break;

    if (!boonUsed) {
      const boonId = getUsableFaceUpBoonIds(state).find((cardId) => !boonBreaksDeclaredVow(state, cardId, targets));
      if (boonId) {
        state = drainPending(useFaceUpBoon(state, boonId), stats);
        stats.usedBoonIds.push(boonId);
        boonUsed = true;
        continue;
      }
      boonUsed = true;
    }

    const player = state.players.find((candidate) => candidate.id === playerId)!;
    const warehouseValues = Object.values(state.warehouse);
    const quartermasterUseful = Math.max(...warehouseValues) > Math.min(...warehouseValues) || state.encounters.activeArrivals.some((arrival) => arrival.timerTokens < 3);
    if (!powerPrepared && ["vanguard", "knight", "sentinel", "ranger", "quartermaster"].includes(player.stewardId) && (player.stewardId !== "quartermaster" || quartermasterUseful) && canUseStewardPower(state, playerId).ok) {
      state = drainPending(useStewardPower(state, playerId), stats);
      powerPrepared = true;
      continue;
    }
    powerPrepared = true;

    const arrivalId = getCompletableArrivalIds(state)[0];
    const wantsArrivals = targets.some((id) => ["LE-013","LE-014","LE-015","LE-016","LE-029","LE-050"].includes(id)) || hasV43Target(targets, "LE-019", "LE-020", "LE-021", "LE-022", "LE-023");
    if (arrivalId && (wantsArrivals || profile !== "passive_normal" || random() < 0.55)) {
      const timerBefore = state.encounters.activeArrivals.find((arrival) => arrival.cardId === arrivalId)?.timerTokens;
      const completionRound = state.round;
      const completionSeason = state.season;
      const beforeActions = state.actionsRemaining;
      state = drainPending(completeArrival(state, arrivalId), stats);
      if (state.actionsRemaining < beforeActions) {
        stats.encounterInteractActions += 1;
        if (timerBefore === 1) stats.arrivalsCompletedAtOneTimer += 1;
        const completed = [...state.encounters.completedArrivals].reverse().find((arrival) => arrival.cardId === arrivalId);
        stats.arrivalCompletionEvents.push({ cardId: arrivalId, round: completionRound, season: completionSeason, specialTileIds: completed?.specialTileIds ?? [] });
        continue;
      }
    }

    const burdenId = getResolvableBurdenIds(state)[0];
    const wantsBurdens = targets.some((id) => ["LE-004","LE-017","LE-036","LE-040","LE-041","LE-043"].includes(id)) || hasV43Target(targets, "LE-024", "LE-025", "LE-026", "LE-027", "LE-029", "LE-030", "LE-048");
    if (burdenId && (wantsBurdens || state.encounters.activeBurdens.length >= state.playerCount || random() < 0.35)) {
      const beforeActions = state.actionsRemaining;
      state = drainPending(resolveBurden(state, burdenId), stats);
      if (state.actionsRemaining < beforeActions) {
        stats.encounterInteractActions += 1;
        stats.burdensResolved += 1;
        stats.resolvedBurdenIds.push(burdenId);
        if (stats.burdenRevealSeason[burdenId] === state.season) stats.burdensResolvedSameSeason += 1;
        if (stats.burdenRevealRound[burdenId] === state.round) {
          stats.burdensResolvedSameRoundBySeason[state.season] = (stats.burdensResolvedSameRoundBySeason[state.season] ?? 0) + 1;
        }
        continue;
      }
    }

    const lowResource = Math.min(...Object.values(state.warehouse)) < 6;
    const earlyActivation = chooseActivation(state, playerId);
    if (lowResource && earlyActivation) {
      const beforeActions = state.actionsRemaining;
      const before = state;
      state = drainPending(activateTile(state, playerId, earlyActivation.instanceId), stats);
      if (state.actionsRemaining < beforeActions) {
        stats.activateActions += 1;
        recordTileActivation(before, state, earlyActivation.instanceId, stats);
        continue;
      }
    }

    const earlyUpgrade = chooseUpgrade(state, playerId, targets);
    if (lowResource && earlyUpgrade) {
      const placed = state.map.placedTiles.find((tile) => tile.instanceId === earlyUpgrade.instanceId);
      if (placed?.kind === "core" && coreTileById[placed.tileId].category === "resource") {
        const beforeActions = state.actionsRemaining;
        state = drainPending(upgradeTile(state, playerId, earlyUpgrade.instanceId), stats);
        if (state.map.placedTiles.find((tile) => tile.instanceId === earlyUpgrade.instanceId)?.side === "upgraded") {
          stats.upgradeActions += beforeActions - state.actionsRemaining;
          continue;
        }
      }
    }

    const placement = findPlacement(state, playerId, targets, random);
    const placementWorthwhile = placement;
    const shouldPlace = placementWorthwhile && (warehouseTotal(state) >= 8 || !state.map.placedTiles.some((tile) => tile.kind === "core" && coreTileById[tile.tileId].category === "resource"));
    if (placement && shouldPlace) {
      const beforeActions = state.actionsRemaining;
      const beforeTileCount = state.map.placedTiles.length;
      state = drainPending(placeTile(state, playerId, placement.tileId, placement.placement), stats);
      if (state.map.placedTiles.length > beforeTileCount) {
        stats.placeActions += beforeActions - state.actionsRemaining;
        if (beforeActions === state.actionsRemaining) stats.freePlaceEffectsUsed += 1;
        continue;
      }
    }

    const activation = chooseActivation(state, playerId);
    if (activation && (warehouseTotal(state) < 35 || !placement)) {
      const beforeActions = state.actionsRemaining;
      const before = state;
      state = drainPending(activateTile(state, playerId, activation.instanceId), stats);
      if (state.actionsRemaining < beforeActions) {
        stats.activateActions += 1;
        recordTileActivation(before, state, activation.instanceId, stats);
        continue;
      }
    }

    const upgrade = chooseUpgrade(state, playerId, targets);
    if (upgrade) {
      const beforeActions = state.actionsRemaining;
      state = drainPending(upgradeTile(state, playerId, upgrade.instanceId), stats);
      if (state.actionsRemaining <= beforeActions && state.map.placedTiles.find((tile) => tile.instanceId === upgrade.instanceId)?.side === "upgraded") {
        stats.upgradeActions += beforeActions - state.actionsRemaining;
        continue;
      }
    }

    if (placementWorthwhile) {
      const beforeActions = state.actionsRemaining;
      const beforeTileCount = state.map.placedTiles.length;
      state = drainPending(placeTile(state, playerId, placement.tileId, placement.placement), stats);
      if (state.map.placedTiles.length > beforeTileCount) {
        stats.placeActions += beforeActions - state.actionsRemaining;
        if (beforeActions === state.actionsRemaining) stats.freePlaceEffectsUsed += 1;
        continue;
      }
    }

    if (activation) {
      const beforeActions = state.actionsRemaining;
      const before = state;
      state = drainPending(activateTile(state, playerId, activation.instanceId), stats);
      if (state.actionsRemaining < beforeActions) {
        stats.activateActions += 1;
        recordTileActivation(before, state, activation.instanceId, stats);
        continue;
      }
    }
    if (state.actionsRemaining > 0) {
      stats.unusedActions += state.actionsRemaining;
      stats.earlyEndTurns += 1;
      if (stats.decisionNotes.length < 40) {
        stats.decisionNotes.push(
          `Round ${state.round} ${playerId} ended with ${state.actionsRemaining} action(s): ` +
          `${placement ? "best placement could not be paid/resolved" : "no legal placement"}; ` +
          `${activation ? "activation available but did not resolve" : "no activation"}; ` +
          `${upgrade ? "upgrade available but did not resolve" : "no upgrade"}; ` +
          `Warehouse ${warehouseTotal(state)}.`,
        );
      }
    }
    break;
  }
  return drainPending(endCurrentTurn(state), stats);
}

type HumanActionCandidate = {
  kind: "boon" | "power" | "arrival" | "burden" | "place" | "activate" | "upgrade";
  target: string;
  score: number;
  reasonCode: string;
  reason: string;
  placement?: string | TilePlacementDraft;
};

interface HumanDecisionContext {
  rankedCandidates: HumanActionCandidate[];
  choicePolicy: HumanChoicePolicy;
}

function recordHumanAction(
  state: GameState,
  candidate: HumanActionCandidate,
  rejected: HumanActionCandidate | undefined,
  stats: BotStats,
  actionsSpent: number,
  decision: HumanDecisionContext,
): void {
  const best = decision.rankedCandidates[0] ?? candidate;
  const runnerUp = decision.rankedCandidates[1];
  stats.actionReasons.push({
    round: state.round,
    season: state.season,
    playerId: state.currentPlayerId,
    actionType: candidate.kind,
    target: candidate.target,
    projectedValue: Number(candidate.score.toFixed(1)),
    actionsSpent,
    candidateCount: decision.rankedCandidates.length,
    bestProjectedValue: Number(best.score.toFixed(1)),
    runnerUpProjectedValue: runnerUp ? Number(runnerUp.score.toFixed(1)) : undefined,
    bestActionType: best.kind,
    bestTarget: best.target,
    selectedWasBest: best.kind === candidate.kind && best.target === candidate.target,
    projectedRegret: Number(Math.max(0, best.score - candidate.score).toFixed(1)),
    choicePolicy: decision.choicePolicy,
    reasonCode: candidate.reasonCode,
    reason: candidate.reason,
    rejectedAlternative: rejected ? `${rejected.kind}:${rejected.target} (${rejected.score.toFixed(1)})` : undefined,
  });
}

function markHumanMilestones(before: GameState, after: GameState, stats: BotStats): void {
  for (const tile of after.map.placedTiles) {
    if (before.map.placedTiles.some((candidate) => candidate.instanceId === tile.instanceId)) continue;
    const category = tileCategory(tile);
    stats.firstCategoryRound[category] ??= after.round;
    if (category === "housing" && before.map.placedTiles.some((candidate) => candidate.support.passive || candidate.support.singleUse)) {
      stats.housingPlacedAfterSupport += 1;
    }
  }
  if (stats.firstSupportRound === undefined && after.map.placedTiles.some((tile) => tile.support.passive || tile.support.singleUse)) {
    stats.firstSupportRound = after.round;
  }
  if (
    stats.firstSupportedHousingRound === undefined &&
    after.map.placedTiles.some(
      (tile) =>
        tileCategory(tile) === "housing" &&
        (tile.support.passive || tile.support.singleUse),
    )
  ) {
    stats.firstSupportedHousingRound = after.round;
  }
  if (stats.firstHousingClusterRound === undefined) {
    const housing = after.map.placedTiles.filter((tile) => tileCategory(tile) === "housing" && tile.strain < 3);
    if (housing.some((tile) => housing.some((other) => other.instanceId !== tile.instanceId && tile.hexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => other.hexIds.includes(neighbor)))))) {
      stats.firstHousingClusterRound = after.round;
    }
  }
}

function humanArrivalCandidate(state: GameState, plan: HumanSeasonPlan): HumanActionCandidate | null {
  const candidates = getCompletableArrivalIds(state).map((cardId) => {
    const intent = buildCardIntent(state, cardId);
    const totalCost = Object.values(intent.requiredResources).reduce((sum, value) => sum + (value ?? 0), 0);
    const remainingRounds = 13 - state.round;
    const rewardValue = intent.rewardTileIds.reduce((sum, tileId) => {
      const tile = specialTileById[tileId];
      return sum + (tile
        ? tile.population + tile.renown + (tileHasStrategicProtection(tile.id, "special") ? 5 : 2)
        : 0);
    }, 0);
    const planBoost = cardPlanPriority(plan, cardId);
    const active = state.encounters.activeArrivals.find((arrival) => arrival.cardId === cardId);
    const urgency = active ? Math.max(0, 4 - active.timerTokens) * 4 : 0;
    const latePenalty =
      state.season === 3
        ? Math.max(0, 4 - remainingRounds) * 4 + (state.round >= 11 ? 24 : state.round >= 10 ? 10 : 0)
        : 0;
    const score = 8 + rewardValue + planBoost + urgency - totalCost * 0.8 - latePenalty;
    return {
      kind: "arrival" as const,
      target: cardId,
      score,
      reasonCode: planBoost > 0 ? "SETUP_FOR_SEEDED_ARRIVAL" : "FINAL_SCORE_CONVERSION",
      reason: planBoost > 0
        ? `Complete the forecast Arrival while its ${intent.cardName} reward still has time to be placed and used.`
        : `Complete an efficient Arrival whose reward value exceeds its action and resource opportunity cost.`,
    };
  }).filter((candidate) => candidate.score >= 8).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function humanBurdenCandidate(state: GameState, plan: HumanSeasonPlan): HumanActionCandidate | null {
  const hasRestingHall = state.map.placedTiles.some((tile) => tile.tileId === "special_the_resting_hall" && tile.strain < 3);
  const ledgerPressure = plan.highRiskBurdenIds.length > 0;
  const burdenRecordTarget = plan.targetEntryIds.includes("LE-024");
  const wardenVigilTarget = plan.targetEntryIds.includes("LE-048");
  const candidates = getResolvableBurdenIds(state).map((cardId) => {
    const intent = buildCardIntent(state, cardId);
    const cost = Object.values(intent.requiredResources).reduce((sum, value) => sum + (value ?? 0), 0);
    const planBoost = cardPlanPriority(plan, cardId);
    const endgame = state.round >= 10 ? 12 : 0;
    const crowding = Math.max(0, state.encounters.activeBurdens.length - 1) * 5;
    const synergy = hasRestingHall ? 8 : 0;
    const targetBoost = burdenRecordTarget
      ? 84
      : wardenVigilTarget && (state.encounters.activeBurdens.length > 1 || state.round >= 10)
        ? 38
        : 0;
    const score = 7 + planBoost + endgame + crowding + synergy + targetBoost + (ledgerPressure ? 3 : 0) - cost * 0.7;
    return {
      kind: "burden" as const,
      target: cardId,
      score,
      reasonCode: burdenRecordTarget || wardenVigilTarget ? "STEWARD_OBJECTIVE_PROGRESS" : "BURDEN_CLEAR_BEATS_PENALTY",
      reason: burdenRecordTarget
        ? "Resolve this Burden while affordable because Burdens Set Down requires two resolutions and no active Burden at game end."
        : wardenVigilTarget
          ? "Clear excess active Burdens so the Warden's Vigil can finish with at most one and no Overstrained tiles."
          : hasRestingHall
        ? "Resolve the Burden because its final penalty and Resting Hall Strain relief outweigh the payment."
        : "Resolve the Burden because its final penalty and district risk now outweigh the payment.",
    };
  }).filter((candidate) => candidate.score >= 10).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function humanBoonCandidate(state: GameState, plan: HumanSeasonPlan): HumanActionCandidate | null {
  const candidates = getUsableFaceUpBoonIds(state).map((cardId) => {
    const intent = buildCardIntent(state, cardId);
    let useful = intent.seasonValue + cardPlanPriority(plan, cardId);
    const ruleId = cardEffectRuleId(cardId, state.season);
    const semantics = getEffectSemanticTags(ruleId);
    if (semantics.includes("arrival_time") && !state.encounters.activeArrivals.some((arrival) => arrival.timerTokens < 3)) useful -= 20;
    if (effectRuleUsesAction(ruleId, "arrival") && getCompletableArrivalIds(state).length === 0) useful -= 10;
    if (effectRuleUsesAction(ruleId, "burden") && getResolvableBurdenIds(state).length === 0) useful -= 10;
    if (effectRuleUsesAction(ruleId, "upgrade") && getUpgradeableTileIds(state, state.currentPlayerId).length === 0) useful -= 8;
    return {
      kind: "boon" as const,
      target: cardId,
      score: useful,
      reasonCode: "SETUP_FOR_SEEDED_BOON",
      reason: `Use ${intent.cardName} now because the board has a worthwhile matching target.`,
    };
  }).filter((candidate) => candidate.score >= 9).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function humanPowerCandidate(state: GameState, playerId: string, plan: HumanSeasonPlan): HumanActionCandidate | null {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player || !canUseStewardPower(state, playerId).ok || player.stewardId === "warden") return null;
  let score = 0;
  let reasonCode = "STEWARD_OBJECTIVE_PROGRESS";
  let reason = "Use the Steward power where it advances the Season plan.";
  if (player.stewardId === "vanguard" && plan.needsTravelAnchor) {
    score = 22;
    reasonCode = "TRAVEL_ENABLES_PLAN";
    reason = "Use Vanguard to create the planned Travel anchor without spending an Action.";
  } else if (player.stewardId === "knight" && plan.housingPush) {
    score = 24;
    reasonCode = "HOUSING_CLUSTER_CONVERSION";
    reason = "Use Knight during the protected Housing conversion window.";
  } else if (player.stewardId === "sentinel" && state.season >= 2 && getUpgradeableTileIds(state, playerId).length > 0) {
    score = 23;
    reasonCode = "HIGH_VALUE_UPGRADE";
    reason = "Use Sentinel on an upgrade that converts established infrastructure into score or output.";
  } else if (player.stewardId === "ranger") {
    const produced = new Set<ResourceType>(state.map.placedTiles.flatMap((tile) => {
      if (tile.kind !== "core") return [];
      const side = coreTileById[tile.tileId][tile.side === "upgraded" ? "upgraded" : "basic"];
      return (Object.entries(side.production ?? {}) as Array<[ResourceType, number]>)
        .filter(([, amount]) => amount > 0)
        .map(([resource]) => resource);
    }));
    const missingForecastResources = (Object.keys(plan.expectedResourceDemand) as ResourceType[]).filter(
      (resource) => resourceDemandDeficit(state, plan, resource) >= 4 && !produced.has(resource),
    );
    const missingForecastProduction = missingForecastResources.length > 0;
    if (plan.targetSpecialTileIds.length > 0 || missingForecastProduction) {
      score = missingForecastProduction ? 23 : 17;
      const demandReason = chooseResourceDemandReason(state, plan, missingForecastResources);
      reasonCode = missingForecastProduction ? demandReason.reasonCode : "STEWARD_OBJECTIVE_PROGRESS";
      reason = missingForecastProduction
        ? `Use Ranger to reach terrain for a missing forecast production type. ${demandReason.reason}`
        : "Use Ranger to open reach for a planned Special Tile or district.";
    }
  } else if (player.stewardId === "quartermaster") {
    const demandGap = (Object.keys(plan.expectedResourceDemand) as ResourceType[]).reduce(
      (sum, resource) => sum + resourceDemandDeficit(state, plan, resource),
      0,
    );
    if (demandGap > 5) {
      score = 20;
      reasonCode = "MERCHANT_CONVERSION_ENGINE";
      reason = "Use Quartermaster to meet forecast card costs, not simply to balance the Warehouse.";
    }
  }
  return score > 0 ? { kind: "power", target: player.stewardId, score, reasonCode, reason } : null;
}

function lateGameScoringUpgradeCandidate(
  state: GameState,
  playerId: string,
  plan: HumanSeasonPlan,
): HumanActionCandidate | null {
  const candidates = getUpgradeableTileIds(state, playerId).flatMap((instanceId) => {
    const placed = state.map.placedTiles.find((tile) => tile.instanceId === instanceId);
    if (!placed || placed.kind !== "core") return [];
    const data = coreTileById[placed.tileId];
    if (data.category === "resource" || data.category === "travel") return [];
    const scoreDelta = projectedUpgradeScoreDelta(state, playerId, instanceId, plan);
    if (scoreDelta < 0) return [];
    return [{
      kind: "upgrade" as const,
      target: instanceId,
      score: scoreDelta,
      reasonCode: "FINAL_SCORE_UPGRADE",
      reason: `Final-round fallback upgrades ${data.basic.name} to ${data.upgraded.name} for ${scoreDelta} projected score.`,
    }];
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function lateGameBurdenCandidate(state: GameState, plan: HumanSeasonPlan): HumanActionCandidate | null {
  const candidates = getResolvableBurdenIds(state).map((cardId) => {
    const card = encounterById[cardId];
    return {
      kind: "burden" as const,
      target: cardId,
      score: Math.max(0, 8 + cardPlanPriority(plan, cardId)),
      reasonCode: "BURDEN_CLEAR_BEATS_PENALTY",
      reason: `Final-round fallback clears ${card?.name ?? cardId} instead of carrying its penalty into final scoring.`,
    };
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function lateGameProtectionCandidate(state: GameState, playerId: string, plan: HumanSeasonPlan): HumanActionCandidate | null {
  const candidates = getActivatableTileIds(state, playerId).flatMap((instanceId) => {
    const placed = state.map.placedTiles.find((tile) => tile.instanceId === instanceId);
    if (!placed) return [];
    const ruleId = tileEffectRuleId(placed.tileId, placed.side);
    const semantics = getEffectSemanticTags(ruleId);
    if (semantics.includes("strain_relief")) {
      const removable = getValidEffectStrainTargets(state, ruleId, placed)
        .reduce((total, tile) => total + tile.strain, 0);
      if (removable > 0) {
        return [{
          kind: "activate" as const,
          target: instanceId,
          score: removable * 3,
          reasonCode: "FINAL_STRAIN_RELIEF",
          reason: `Final-round fallback removes ${removable} available Strain before final penalties are scored.`,
        }];
      }
    }
    if (semantics.includes("support") && hasKnownFutureStrainThreat(state, plan)) {
      const supportTargets = getEffectSupportTargets(state, ruleId, placed);
      if (supportTargets.length > 0) {
        return [{
          kind: "activate" as const,
          target: instanceId,
          score: 0,
          reasonCode: "FINAL_STRAIN_PREVENTION",
          reason: `Final-round fallback protects ${supportTargets.length} legal target${supportTargets.length === 1 ? "" : "s"} from remaining Strain risk.`,
        }];
      }
    }
    return [];
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function lateGameArrivalCandidate(state: GameState, plan: HumanSeasonPlan): HumanActionCandidate | null {
  const candidates = getCompletableArrivalIds(state).map((cardId) => {
    const card = encounterById[cardId];
    const active = state.encounters.activeArrivals.find((arrival) => arrival.cardId === cardId);
    const rewardValue = card?.type === "arrival"
      ? card.rewardSpecialTileIds.reduce((total, tileId) => {
          const tile = specialTileById[tileId];
          return total + (tile?.population ?? 0) + (tile?.renown ?? 0);
        }, 0)
      : 0;
    return {
      kind: "arrival" as const,
      target: cardId,
      score: Math.max(0, rewardValue + cardPlanPriority(plan, cardId) + (active?.timerTokens === 1 ? 4 : 0)),
      reasonCode: "COMPLETE_FINAL_ARRIVAL",
      reason: `Final-round fallback completes ${card?.name ?? cardId}, preserving its unlocked Special Tile opportunity.`,
    };
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function lateGameConcreteProductionCandidate(
  state: GameState,
  playerId: string,
  plan: HumanSeasonPlan,
): HumanActionCandidate | null {
  const candidates = getActivatableTileIds(state, playerId).flatMap((instanceId) => {
    const placed = state.map.placedTiles.find((tile) => tile.instanceId === instanceId);
    if (!placed) return [];
    const side = placed.kind === "special"
      ? specialTileById[placed.tileId]
      : coreTileById[placed.tileId][placed.side === "upgraded" ? "upgraded" : "basic"];
    const production = "production" in side ? side.production : undefined;
    if (!production || !("effectType" in side) || side.effectType !== "production") return [];
    const spendTarget = findConcreteProductionSpendTarget(state, playerId, plan, production);
    if (!spendTarget) return [];
    const usefulOutput = Object.values(spendTarget.contribution)
      .reduce((total, amount) => total + (amount ?? 0), 0);
    return [{
      kind: "activate" as const,
      target: instanceId,
      score: usefulOutput,
      reasonCode: spendTarget.reasonCode,
      reason: `Final-round fallback produces ${formatResourceShortfall(spendTarget.contribution)} toward ${spendTarget.label}; this is the remaining route to an affordable scoring or cleanup action.`,
    }];
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function lateGameFallbackCandidates(
  state: GameState,
  playerId: string,
  plan: HumanSeasonPlan,
): HumanActionCandidate[] {
  if (state.round < 10 || state.actionsRemaining <= 0) return [];
  return [
    findCheapLegalScorePlacement(state, playerId, plan),
    lateGameScoringUpgradeCandidate(state, playerId, plan),
    lateGameBurdenCandidate(state, plan),
    lateGameProtectionCandidate(state, playerId, plan),
    lateGameArrivalCandidate(state, plan),
    findLegalSpecialPlacement(state, playerId, plan),
    lateGameConcreteProductionCandidate(state, playerId, plan),
  ]
    .filter((candidate): candidate is HumanActionCandidate => Boolean(candidate && candidate.score >= 0))
    .sort((a, b) => b.score - a.score);
}

function playHumanLikeTurn(
  initial: GameState,
  targets: string[],
  random: () => number,
  stats: BotStats,
  plan: HumanSeasonPlan,
  behavior: HumanBehaviorOptions,
): GameState {
  let state = initial;
  const playerId = state.currentPlayerId;
  let boonUsed = false;
  let powerUsed = false;
  const failed = new Set<string>();
  for (let guard = 0; guard < 28 && state.phase === "turns" && state.currentPlayerId === playerId; guard += 1) {
    state = drainPending(state, stats, plan);
    if (state.pendingEffects.length || state.pendingDeckReorder || state.pendingCostChoice) break;

    const candidates: HumanActionCandidate[] = [];
    const scoreFocused = isScoreFocusedTarget(targets);
    const valueCategories: TileCategory[] = ["housing", "special", "crafting", "merchant", "social", "wellbeing"];
    const valueTileCount = state.map.placedTiles.filter((tile) => valueCategories.includes(tileCategory(tile))).length;
    const expectedValueTiles = scoreFocused
      ? state.round <= 4
        ? 4
        : state.round <= 8
          ? 9
          : 15
      : 0;
    const valueTileDeficit = Math.max(0, expectedValueTiles - valueTileCount);
    const arrival = humanArrivalCandidate(state, plan);
    const burden = humanBurdenCandidate(state, plan);
    const boon = !boonUsed ? humanBoonCandidate(state, plan) : null;
    const power = !powerUsed ? humanPowerCandidate(state, playerId, plan) : null;
    const unlockedSpecial = specialTiles.some((tile) => state.tileSupply.special[tile.id] > 0)
      ? findLegalSpecialPlacement(state, playerId, plan)
      : null;
    const freeChoice = [boon, power].filter(Boolean).sort((a, b) => b!.score - a!.score)[0];
    if (freeChoice) {
      candidates.push(freeChoice);
    } else {
      if (arrival) candidates.push(arrival);
      if (burden) candidates.push(burden);
      if (unlockedSpecial) {
        const plannedReward = plan.targetSpecialTileIds.includes(unlockedSpecial.target);
        candidates.push({
          ...unlockedSpecial,
          score: unlockedSpecial.score + (plannedReward ? 62 : 44) + (state.round >= 9 ? 20 : 0),
          reason: `${unlockedSpecial.reason} ${plannedReward ? "It is a named reward in this Season Plan." : "Placing it now converts a completed Arrival into board value."}`,
        });
      }
      const urgentEncounter = [arrival, burden].filter(Boolean).some((candidate) => candidate!.score >= 34);
      if (!urgentEncounter) {
        const placement = findPlacement(state, playerId, targets, random, plan, state.round >= 8);
        const activation = chooseActivation(state, playerId, plan);
        const upgrade = chooseUpgrade(state, playerId, targets, plan);
        if (placement && placement.score > 4) {
          let lookahead = 0;
          const category = coreTileById[placement.tileId]?.category ?? specialTileById[placement.tileId]?.category;
          if (category === "resource") lookahead += 8;
          if (category === "travel" && (plan.needsCrafting || plan.needsMerchant)) lookahead += 7;
          if (category === "crafting" || category === "merchant") lookahead += state.season <= 2 ? 8 : 1;
          const placementSide = specialTileById[placement.tileId] ? "special" : "basic";
          if (tileHasSemantic(placement.tileId, placementSide, "support") && plan.housingPush) lookahead += 7;
          if (category === "housing" && state.season >= 2) lookahead += 12;
          if (category !== "resource" && state.round >= 9) lookahead += 14;
          if (specialTileById[placement.tileId] && state.round <= 10) lookahead += 10;
          if (scoreFocused && category && valueCategories.includes(category)) lookahead += 12 + valueTileDeficit * (state.round >= 9 ? 8 : 5);
          if (scoreFocused && category === "resource" && state.round >= 6 && valueTileDeficit > 0) lookahead -= 12 + valueTileDeficit * 3;
          const placementWeight = state.round >= 9 ? 0.82 : state.round >= 6 ? 0.72 : 0.62;
          candidates.push({
            kind: "place",
            target: placement.tileId,
            placement: placement.placement,
            score: placement.score * placementWeight + lookahead,
            reasonCode: placement.reasonCode,
            reason: `${placement.reason} Short lookahead adds ${lookahead} for the likely follow-up action.`,
          });
        }
        if (activation) {
          const activatedTile = state.map.placedTiles.find((tile) => tile.instanceId === activation.instanceId);
          const activatedCategory = activatedTile ? tileCategory(activatedTile) : undefined;
          const productionPenalty = scoreFocused &&
            state.round >= 5 &&
            valueTileDeficit > 0 &&
            activatedCategory === "resource"
            ? Math.min(42, 10 + valueTileDeficit * 6)
            : 0;
          candidates.push({
            kind: "activate",
            target: activation.instanceId,
            score: activation.score - productionPenalty,
            reasonCode: activation.reasonCode,
            reason: productionPenalty > 0
              ? `${activation.reason} Score plan is behind on value tiles, so production is discounted by ${productionPenalty}.`
              : activation.reason,
          });
        }
        if (upgrade && upgrade.score > 2) {
          const upgradeTileCandidate = state.map.placedTiles.find((tile) => tile.instanceId === upgrade.instanceId);
          const upgradeCategory = upgradeTileCandidate ? tileCategory(upgradeTileCandidate) : undefined;
          const valueUpgradeBoost = scoreFocused && upgradeCategory && valueCategories.includes(upgradeCategory)
            ? 10 + valueTileDeficit * (state.round >= 9 ? 4 : 2)
            : 0;
          const resourceUpgradePenalty = scoreFocused && upgradeCategory === "resource" && state.round >= 7 && valueTileDeficit > 0
            ? 8 + valueTileDeficit * 2
            : 0;
          const upgradeWeight = state.round >= 9 ? 1.45 : state.round >= 6 ? 1.28 : 1.12;
          candidates.push({
            kind: "upgrade",
            target: upgrade.instanceId,
            score: upgrade.score * upgradeWeight + valueUpgradeBoost - resourceUpgradePenalty,
            reasonCode: upgrade.reasonCode,
            reason: upgrade.reason,
          });
        }
      }
    }

    const ranked = candidates
      .filter((candidate) => candidate.score >= 0 && !failed.has(`${candidate.kind}:${candidate.target}`))
      .sort((a, b) => b.score - a.score);
    let rankedDecision = ranked;
    let selected = ranked[0];
    let rejected = ranked[1];
    if (!selected && state.round >= 10) {
      const fallbacks = lateGameFallbackCandidates(state, playerId, plan)
        .filter((candidate) => !failed.has(`${candidate.kind}:${candidate.target}`));
      rankedDecision = fallbacks;
      selected = fallbacks[0];
      rejected = fallbacks[1];
    }
    if (!selected && scoreFocused && state.round >= 8 && state.round < 10) {
      const fallbackPlacement = findPlacement(state, playerId, targets, random, undefined, true);
      if (fallbackPlacement) {
        selected = {
          kind: "place",
          target: fallbackPlacement.tileId,
          placement: fallbackPlacement.placement,
          score: 18,
          reasonCode: fallbackPlacement.reasonCode,
          reason: `Late score fallback: ${fallbackPlacement.reason}`,
        };
        rankedDecision = [selected];
      }
    }
    if (selected && behavior.choicePolicy === "near_best" && rankedDecision.length > 1) {
      const best = rankedDecision[0];
      const tolerance = Math.max(6, Math.abs(best.score) * 0.12);
      const nearBestAlternatives = rankedDecision.slice(1).filter(
        (candidate) => best.score - candidate.score <= tolerance,
      );
      const alternative = nearBestAlternatives.find((candidate) => candidate.kind !== best.kind) ??
        nearBestAlternatives[0];
      if (alternative) {
        selected = alternative;
        rejected = best;
      }
    }
    if (!selected) {
      if (state.actionsRemaining > 0 && stats.decisionNotes.length < 80) {
        const upgradeDiagnostics = state.map.placedTiles
          .filter((tile) => tile.kind === "core" && tile.side === "basic")
          .slice(0, 6)
          .map((tile) => {
            const validation = canStartUpgradeTile(state, playerId, tile.instanceId);
            return `${tileName(tile)}: ${validation.ok ? "legal" : validation.reasons.join(" / ")}`;
          })
          .join("; ");
        stats.decisionNotes.push(
          state.round >= 10
            ? `R${state.round} ${playerId}: no non-negative legal action remained with ${state.actionsRemaining} Action(s) after checking scoring placement, scoring upgrade, Burden clearance, Strain protection, Arrival completion, and unlocked Special placement. Considered: ${candidates.map((candidate) => `${candidate.kind}:${candidate.target}=${candidate.score.toFixed(1)}${failed.has(`${candidate.kind}:${candidate.target}`) ? " failed" : ""}`).join(", ") || "none"}. Upgrade checks: ${upgradeDiagnostics || "no basic Core Tiles"}.`
            : `R${state.round} ${playerId}: the current Season plan found no positive-value legal action.`,
        );
      }
      break;
    }
    const before = state;
    const beforeActions = state.actionsRemaining;
    const beforeTiles = state.map.placedTiles.length;
    const beforePowerUses = state.players.find((player) => player.id === playerId)
      ? Object.values(state.players.find((player) => player.id === playerId)!.stewardPowerUsesBySeason).reduce((a, b) => a + b, 0)
      : 0;

    if (selected.kind === "boon") {
      state = drainPending(useFaceUpBoon(state, selected.target), stats, plan);
      boonUsed = true;
      if (state !== before) stats.usedBoonIds.push(selected.target);
    } else if (selected.kind === "power") {
      state = drainPending(useStewardPower(state, playerId), stats, plan);
      powerUsed = true;
    } else if (selected.kind === "arrival") {
      const timerBefore = state.encounters.activeArrivals.find((arrival) => arrival.cardId === selected.target)?.timerTokens;
      const completionRound = state.round;
      const completionSeason = state.season;
      state = drainPending(completeArrival(state, selected.target), stats, plan);
      if (state.actionsRemaining < beforeActions) {
        stats.encounterInteractActions += 1;
        if (timerBefore === 1) stats.arrivalsCompletedAtOneTimer += 1;
        const completed = [...state.encounters.completedArrivals].reverse().find((arrival) => arrival.cardId === selected.target);
        stats.arrivalCompletionEvents.push({ cardId: selected.target, round: completionRound, season: completionSeason, specialTileIds: completed?.specialTileIds ?? [] });
      }
    } else if (selected.kind === "burden") {
      state = drainPending(resolveBurden(state, selected.target), stats, plan);
      if (state.actionsRemaining < beforeActions) {
        stats.encounterInteractActions += 1;
        stats.burdensResolved += 1;
        stats.resolvedBurdenIds.push(selected.target);
        if (stats.burdenRevealSeason[selected.target] === state.season) stats.burdensResolvedSameSeason += 1;
        if (stats.burdenRevealRound[selected.target] === state.round) {
          stats.burdensResolvedSameRoundBySeason[state.season] = (stats.burdensResolvedSameRoundBySeason[state.season] ?? 0) + 1;
        }
      }
    } else if (selected.kind === "place" && selected.placement !== undefined) {
      state = drainPending(placeTile(state, playerId, selected.target, selected.placement), stats, plan);
      if (state.map.placedTiles.length > beforeTiles) {
        stats.placeActions += beforeActions - state.actionsRemaining;
        if (beforeActions === state.actionsRemaining) stats.freePlaceEffectsUsed += 1;
      }
    } else if (selected.kind === "activate") {
      state = drainPending(activateTile(state, playerId, selected.target), stats, plan);
      if (state.actionsRemaining < beforeActions) {
        stats.activateActions += 1;
        recordTileActivation(before, state, selected.target, stats);
      }
    } else if (selected.kind === "upgrade") {
      state = drainPending(upgradeTile(state, playerId, selected.target), stats, plan);
      if (state.map.placedTiles.find((tile) => tile.instanceId === selected.target)?.side === "upgraded") {
        stats.upgradeActions += beforeActions - state.actionsRemaining;
      }
    }

    const afterPowerUses = state.players.find((player) => player.id === playerId)
      ? Object.values(state.players.find((player) => player.id === playerId)!.stewardPowerUsesBySeason).reduce((a, b) => a + b, 0)
      : 0;
    const succeeded = state !== before && (
      state.actionsRemaining < beforeActions ||
      state.map.placedTiles.length > beforeTiles ||
      afterPowerUses > beforePowerUses ||
      selected.kind === "boon"
    );
    if (succeeded) {
      recordHumanAction(
        before,
        selected,
        rejected,
        stats,
        Math.max(0, beforeActions - state.actionsRemaining),
        {
          rankedCandidates: rankedDecision,
          choicePolicy: behavior.choicePolicy,
        },
      );
      markHumanMilestones(before, state, stats);
      failed.clear();
      continue;
    }
    failed.add(`${selected.kind}:${selected.target}`);
  }
  if (state.actionsRemaining > 0) {
    stats.unusedActions += state.actionsRemaining;
    stats.earlyEndTurns += 1;
  }
  return drainPending(endCurrentTurn(state), stats, plan);
}

function playTurn(
  initial: GameState,
  targets: string[],
  profile: Profile,
  random: () => number,
  stats: BotStats,
  plan?: HumanSeasonPlan,
  behavior: HumanBehaviorOptions = { choicePolicy: "best" },
): GameState {
  if (profile === "human_like" && plan) {
    return playHumanLikeTurn(initial, targets, random, stats, plan, behavior);
  }
  return playLegacyTurn(initial, targets, profile, random, stats);
}

function chooseSeed(state: GameState, playerId: string, profile: Profile, random: () => number) {
  const hand = state.encounters.handsByPlayerId[playerId] ?? [];
  const ordered = shuffled(random, hand).sort((a, b) => {
    const typeScore = (id: string) => {
      const type = encounterById[id]?.type;
      if (profile === "achievement_chaser") return type === "arrival" ? 3 : type === "boon" ? 2 : 1;
      return type === "boon" ? 3 : type === "arrival" ? 2 : 1;
    };
    return typeScore(b) - typeScore(a);
  });
  return { top: ordered[0], middle: ordered[1], bottom: ordered[2] };
}

function tileCategory(tile: PlacedTile): TileCategory {
  return tile.kind === "special" ? specialTileById[tile.tileId].category : coreTileById[tile.tileId].category;
}

function tileName(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId].name;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.name : data.basic.name;
}

function connectedHexGroups(hexIds: string[]): string[][] {
  const remaining = new Set(hexIds);
  const groups: string[][] = [];
  while (remaining.size) {
    const start = remaining.values().next().value as string;
    const group: string[] = [];
    const queue = [start];
    remaining.delete(start);
    while (queue.length) {
      const current = queue.shift()!;
      group.push(current);
      for (const neighbor of getHexNeighbors(current)) {
        if (remaining.delete(neighbor)) queue.push(neighbor);
      }
    }
    groups.push(group);
  }
  return groups;
}

function deriveBoard(state: GameState) {
  const eligible = state.map.placedTiles.filter((tile) => tile.strain < 3);
  const byHex = new Map(eligible.flatMap((tile) => tile.hexIds.map((hexId) => [hexId, tile] as const)));
  const housing = eligible.filter((tile) => tileCategory(tile) === "housing");
  const rings: string[][] = [];
  const mixedRings: string[][] = [];
  for (const cell of mapCells) {
    const neighbors = getHexNeighbors(cell.id);
    if (neighbors.length !== 6 || !neighbors.every((hexId) => byHex.has(hexId))) continue;
    rings.push(neighbors);
    if (neighbors.filter((hexId) => ["housing","social","wellbeing"].includes(tileCategory(byHex.get(hexId)!))).length >= 3) mixedRings.push(neighbors);
  }
  const travelHexes = eligible.filter((tile) => tileCategory(tile) === "travel").flatMap((tile) => tile.hexIds);
  const travelGroups = connectedHexGroups(travelHexes);
  const bridges = eligible.filter((tile) => tileName(tile).includes("Bridge"));
  const bridgeConnected = bridges.some((bridge) => {
    const bridgeColumn = mapColumns.indexOf(mapById[bridge.hexIds[0]].col);
    const west = eligible.some((tile) => tile.hexIds.some((hexId) => mapColumns.indexOf(mapById[hexId].col) < bridgeColumn));
    const east = eligible.some((tile) => tile.hexIds.some((hexId) => mapColumns.indexOf(mapById[hexId].col) > bridgeColumn));
    return west && east;
  });
  const categoriesAdjacentToHousing = [...new Set(eligible.filter((tile) => tileCategory(tile) !== "housing" && tile.hexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => byHex.get(neighbor) && tileCategory(byHex.get(neighbor)!) === "housing"))).map(tileCategory))];
  const housingGroups = connectedHexGroups(housing.flatMap((tile) => tile.hexIds));
  return {
    rings,
    mixedRings,
    housingGroups,
    travelGroups,
    bridgeConnected,
    categoriesAdjacentToHousing,
    specialAdjacentToHousing: eligible.filter((tile) => tile.kind === "special" && tile.hexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => byHex.get(neighbor) && tileCategory(byHex.get(neighbor)!) === "housing"))).length,
    travelAdjacentRiver: travelHexes.filter((hexId) => getHexNeighbors(hexId).some((neighbor) => mapById[neighbor]?.terrain === "water")).length,
    terrainSpread: new Set(eligible.flatMap((tile) => tile.hexIds).map((hexId) => mapById[hexId].terrain).filter((terrain) => !["grasslands","water"].includes(terrain))).size,
    allHousingAdjacent: housing.length > 0 && housing.every((tile) => tile.hexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => byHex.get(neighbor) && byHex.get(neighbor) !== tile && tileCategory(byHex.get(neighbor)!) === "housing"))),
  };
}

function stewardObjectives(state: GameState, board: ReturnType<typeof deriveBoard>): string[] {
  const eligible = state.map.placedTiles.filter((tile) => tile.strain < 3);
  return state.players.filter((player) => {
    if (player.stewardId === "vanguard") return board.bridgeConnected;
    if (player.stewardId === "knight") return board.housingGroups.some((group) => group.length >= 3);
    if (player.stewardId === "sentinel") return eligible.filter((tile) => tile.kind === "core" && tile.side === "upgraded").length >= 5;
    if (player.stewardId === "ranger") return board.terrainSpread >= 3;
    if (player.stewardId === "warden") return state.encounters.activeBurdens.length === 0;
    if (player.stewardId === "quartermaster") return Object.values(state.warehouse).filter((value) => value >= 5).length >= 3;
    return false;
  }).map((player) => stewardById[player.stewardId].name);
}

function buildGameLog(state: GameState, stats: BotStats, input: any) {
  const score = calculateFinalScore(state);
  const board = deriveBoard(state);
  const eligible = state.map.placedTiles.filter((tile) => tile.strain < 3);
  const categories = Object.fromEntries(["resource","housing","crafting","merchant","social","wellbeing","travel"].map((category) => [category, eligible.filter((tile) => tileCategory(tile) === category).length]));
  const specialCount = eligible.filter((tile) => tile.kind === "special").length;
  const housingTiles = eligible.filter((tile) => tileCategory(tile) === "housing");
  const completedSpecials = state.encounters.completedArrivals.flatMap((arrival) => arrival.specialTileIds);
  const placedSpecialIds = state.map.placedTiles.filter((tile) => tile.kind === "special").map((tile) => tile.tileId);
  const remainingPlacedSpecials = new Map<string, number>();
  for (const tileId of placedSpecialIds) {
    remainingPlacedSpecials.set(tileId, (remainingPlacedSpecials.get(tileId) ?? 0) + 1);
  }
  let unlockedSpecialsPlaced = 0;
  for (const tileId of completedSpecials) {
    const remaining = remainingPlacedSpecials.get(tileId) ?? 0;
    if (remaining <= 0) continue;
    unlockedSpecialsPlaced += 1;
    remainingPlacedSpecials.set(tileId, remaining - 1);
  }
  const seededCardIds = [
    ...new Set(stats.strategyPlans.flatMap((plan) => plan.forecasts.map((forecast) => forecast.cardId))),
  ];
  const seenCardIds = new Set([
    ...state.encounters.discardPile,
    ...state.encounters.activeBurdens,
    ...state.encounters.activeArrivals.map((arrival) => arrival.cardId),
    ...state.encounters.faceUpBoons.map((boon) => boon.cardId),
    ...state.encounters.completedArrivals.map((arrival) => arrival.cardId),
  ]);
  const exploitedCardIds = new Set([
    ...state.encounters.completedArrivals.map((arrival) => arrival.cardId),
    ...stats.usedBoonIds,
    ...stats.resolvedBurdenIds,
  ]);
  const seededCardsSeen = seededCardIds.filter((cardId) => seenCardIds.has(cardId));
  const seededCardsExploited = seededCardIds.filter((cardId) => exploitedCardIds.has(cardId));
  const seededCardsIgnoredOrExpired = seededCardsSeen.filter((cardId) => !exploitedCardIds.has(cardId));
  const resourcesProducedButUnspent = Object.fromEntries(
    resourceTypes.map((resource) => [
      resource,
      Math.min(stats.resourcesProducedByResource[resource], state.warehouse[resource]),
    ]),
  );
  const objectives = stewardObjectives(state, board);
  const declaredVows = input.targets.filter((id: string) =>
    input.specs
      ? input.specs.some((spec: LedgerSpec) => spec.entry_id === id && spec.gates.declared_vow_required)
      : ledgerEntries.some((entry) => entry.id === id && entry.declaredVow),
  );
  if (declaredVows.length > 1) stats.errors.push("Only one Steward's Ledger Vow may be declared per game.");
  return {
    campaign_id: input.campaignId,
    game_index: input.gameIndex,
    seed: input.seed,
    player_count: state.playerCount,
    strategy_profile: input.profile,
    experiment: {
      choice_policy: input.choicePolicy === "near_best" ? "near_best" : "best",
      banned_tile_ids: [...(input.bannedTileIds ?? [])],
    },
    chosen_stewards: state.players.map((player) => stewardById[player.stewardId].name),
    declared_vows: declaredVows.slice(0, 1),
    targeted_ledger_entries: input.targets,
    target_attempts: [],
    golden_tile_used: state.goldenSetup.selectedTileId ?? null,
    golden_boon_used: state.encounters.selectedGoldenBoonId ?? null,
    golden_boons_revealed: state.encounters.discardPile.filter((cardId) => encounterById[cardId]?.type === "goldenBoon"),
    golden_content_enabled: state.encounters.goldenEnabled,
    unlock_count_start: input.unlockCountStart,
    unlock_count_end: input.unlockCountStart,
    warehouse_peak_by_resource: Object.fromEntries(Object.entries(stats.warehousePeak).map(([key, value]) => [key[0].toUpperCase() + key.slice(1), value])),
    final: {
      score: score.finalScore,
      population: score.population,
      renown: score.finalScore - score.population,
      active_burdens: state.encounters.activeBurdens.length,
      strain_tokens: totalStrain(state),
      overstrained_tiles: state.map.placedTiles.filter((tile) => tile.strain >= 3).length,
      warehouse_total: warehouseTotal(state),
      warehouse_by_resource: Object.fromEntries(Object.entries(state.warehouse).map(([key, value]) => [key[0].toUpperCase() + key.slice(1), value])),
    },
    encounters: {
      boons_revealed: state.playerCount * 4,
      burdens_revealed: state.playerCount * 4,
      burdens_resolved_or_removed: stats.burdensResolved,
      arrivals_revealed: state.playerCount * 4,
      arrivals_completed: state.encounters.completedArrivals.length,
      arrivals_completed_at_one_timer: stats.arrivalsCompletedAtOneTimer,
      arrival_completion_events: stats.arrivalCompletionEvents,
      arrivals_expired: stats.arrivalsExpired,
      special_tiles_unlocked: completedSpecials.length,
      special_tiles_placed: specialCount,
      unlocked_special_tiles_placed: unlockedSpecialsPlaced,
      unlocked_special_tiles_unplaced: completedSpecials.length - unlockedSpecialsPlaced,
      standard_reveals: state.playerCount * 12,
      golden_bonus_reveals: 0,
      total_reveals: state.playerCount * 12,
      card_ids_seen: [...new Set([
        ...state.encounters.discardPile,
        ...state.encounters.activeBurdens,
        ...state.encounters.activeArrivals.map((arrival) => arrival.cardId),
        ...state.encounters.faceUpBoons.map((boon) => boon.cardId),
        ...state.encounters.completedArrivals.map((arrival) => arrival.cardId),
      ])],
      completed_arrival_ids: state.encounters.completedArrivals.map((arrival) => arrival.cardId),
      resolved_burden_ids: [...stats.resolvedBurdenIds],
      used_boon_ids: [...new Set(stats.usedBoonIds)],
      player_hands: Object.fromEntries(state.players.map((player) => [player.id, []])),
    },
    actions: {
      place_actions: stats.placeActions,
      upgrade_actions: stats.upgradeActions,
      activate_actions: stats.activateActions,
      encounter_interact_actions: stats.encounterInteractActions,
      steward_power_uses: state.players.reduce((sum, player) => sum + Object.values(player.stewardPowerUsesBySeason).reduce((a, b) => a + b, 0), 0),
      free_place_effects_used: stats.freePlaceEffectsUsed,
      unused_actions: stats.unusedActions,
      early_end_turns: stats.earlyEndTurns,
      tile_activation_counts_by_instance: { ...stats.tileActivationCountsByInstance },
    },
    decision_notes: stats.decisionNotes,
    strategy_plan_log: stats.strategyPlans,
    action_reason_log: stats.actionReasons,
    engine_metrics: {
      first_resource_round: stats.firstCategoryRound.resource ?? null,
      first_travel_round: stats.firstCategoryRound.travel ?? null,
      first_crafting_round: stats.firstCategoryRound.crafting ?? null,
      first_merchant_round: stats.firstCategoryRound.merchant ?? null,
      first_support_round: stats.firstSupportRound ?? null,
      first_supported_housing_round: stats.firstSupportedHousingRound ?? null,
      first_housing_round: stats.firstCategoryRound.housing ?? null,
      first_housing_cluster_round: stats.firstHousingClusterRound ?? null,
      support_tokens_present: state.map.placedTiles.filter((tile) => tile.support.passive || tile.support.singleUse).length,
      strain_prevented_by_support: stats.strainPrevented,
      housing_placed_after_support: stats.housingPlacedAfterSupport,
      crafting_passive_uses: stats.craftingPassiveUses,
      resources_saved_by_crafting: stats.resourcesSavedByCrafting,
      merchant_passive_uses: stats.merchantPassiveUses,
      goods_converted_by_merchant: stats.goodsConvertedByMerchant,
      arrivals_completed: state.encounters.completedArrivals.length,
      arrivals_abandoned: stats.arrivalsExpired + state.encounters.activeArrivals.length,
      burdens_resolved: stats.burdensResolved,
      burdens_resolved_same_season: stats.burdensResolvedSameSeason,
      burdens_resolved_same_round_by_season: stats.burdensResolvedSameRoundBySeason,
      burdens_left_active: state.encounters.activeBurdens.length,
      max_overstrained_tiles: stats.maxOverstrainedTiles,
      resources_produced_by_resource: { ...stats.resourcesProducedByResource },
      resources_produced_but_unspent: resourcesProducedButUnspent,
      resources_produced_but_unspent_definition: "Actual production gains still represented in the final Warehouse, capped by output produced per resource.",
      production_activations_by_round: { ...stats.productionActivationsByRound },
      production_activations_after_round_8: Object.entries(stats.productionActivationsByRound)
        .filter(([round]) => Number(round) > 8)
        .reduce((total, [, count]) => total + count, 0),
      seeded_cards_seen: seededCardsSeen.length,
      seeded_card_ids_seen: seededCardsSeen,
      seeded_cards_exploited: seededCardsExploited.length,
      seeded_card_ids_exploited: seededCardsExploited,
      seeded_cards_ignored_or_expired: seededCardsIgnoredOrExpired.length,
      seeded_card_ids_ignored_or_expired: seededCardsIgnoredOrExpired,
    },
    stewards: { objectives_completed: objectives, powers_used_by_steward: Object.fromEntries(state.players.map((player) => [stewardById[player.stewardId].name, Object.values(player.stewardPowerUsesBySeason).reduce((a, b) => a + b, 0)])) },
    tile_counts: {
      placed_total: state.map.placedTiles.length,
      placed_by_category: { Resource: categories.resource, Housing: categories.housing, Crafting: categories.crafting, Merchant: categories.merchant, Social: categories.social, Wellbeing: categories.wellbeing, Travel: categories.travel, Special: specialCount, Golden: 0 },
      placed_housing_tiles: categories.housing,
      placed_travel_tiles: categories.travel,
      placed_path_tiles: eligible.filter((tile) => tile.tileId === "c15_path").length,
      placed_street_tiles: eligible.filter((tile) => tile.tileId === "c16_street").length,
      placed_track_tiles: eligible.filter((tile) => tile.tileId === "c17_track").length,
      placed_special_tiles: specialCount,
      upgraded_core_tiles: state.map.placedTiles.filter((tile) => tile.kind === "core" && tile.side === "upgraded").length,
      upgraded_non_overstrained_core_tiles: eligible.filter((tile) => tile.kind === "core" && tile.side === "upgraded").length,
      non_overstrained_categories: Object.values({ ...categories, special: specialCount }).filter((value) => value > 0).length,
      farmstead_tiles: state.map.placedTiles.filter((tile) => tile.tileId === "c04_farmstead").length,
    },
    support_and_strain: {
      strain_prevented_by_supported: stats.strainPrevented,
      strain_removed: stats.strainRemoved,
      max_strain_on_housing: Math.max(0, ...housingTiles.map((tile) => tile.strain)),
      housing_overstrained_count: state.map.placedTiles.filter((tile) => tileCategory(tile) === "housing" && tile.strain >= 3).length,
    },
    season_snapshots: stats.seasonSnapshots,
    board: {
      tiles: state.map.placedTiles.flatMap((tile) => tile.hexIds.map((coord) => ({ coord, tile_id: tile.tileId, name: tileName(tile), category: tileCategory(tile)[0].toUpperCase() + tileCategory(tile).slice(1), terrain: mapById[coord].terrain, is_upgraded: tile.side === "upgraded", is_overstrained: tile.strain >= 3, strain: tile.strain, supported: tile.support.passive || tile.support.singleUse, is_special: tile.kind === "special", is_golden: false, adjacent_coords: getHexNeighbors(coord), adjacent_to_river_water: getHexNeighbors(coord).some((id) => mapById[id]?.terrain === "water"), river_side: mapColumns.indexOf(mapById[coord].col) < 6 ? "west" : "east" }))),
      bridges: eligible.filter((tile) => tileName(tile).includes("Bridge")).map((tile) => ({ coord: tile.hexIds[0], connects_river_sides: board.bridgeConnected, bridge_type: tileName(tile) })),
      derived_features: {
        housing_clusters: board.housingGroups,
        travel_groups: board.travelGroups,
        complete_six_tile_rings: board.rings,
        qualifying_mixed_six_tile_rings: board.mixedRings,
        river_connected_sides: board.bridgeConnected,
        housing_on_both_river_sides_connected: board.bridgeConnected && housingTiles.some((tile) => tile.hexIds.some((id) => mapColumns.indexOf(mapById[id].col) < 6)) && housingTiles.some((tile) => tile.hexIds.some((id) => mapColumns.indexOf(mapById[id].col) > 6)),
        all_non_overstrained_housing_has_housing_neighbor: board.allHousingAdjacent,
        non_overstrained_travel_hexes_adjacent_to_river: board.travelAdjacentRiver,
        occupied_non_grasslands_non_river_terrain_types: board.terrainSpread,
        categories_adjacent_to_housing: board.categoriesAdjacentToHousing.map((category) => category[0].toUpperCase() + category.slice(1)),
        special_tiles_adjacent_to_housing: board.specialAdjacentToHousing,
        largest_connected_travel_group: Math.max(0, ...board.travelGroups.map((group) => group.length)),
      },
    },
    simulation_errors: stats.errors,
  };
}

function chooseStewardIds(playerCount: PlayerCount, targets: string[], campaignState: any, random: () => number): string[] {
  const requiredByEntry: Record<string, string> = {
    "LE-044": "vanguard", "LE-045": "knight", "LE-046": "sentinel", "LE-047": "ranger", "LE-048": "warden", "LE-049": "quartermaster",
    "V43-044": "vanguard", "V43-045": "knight", "V43-046": "sentinel", "V43-047": "ranger", "V43-048": "warden", "V43-049": "quartermaster",
  };
  const required = targets.map((id) => requiredByEntry[id]).filter(Boolean);
  const usedNames = new Set(campaignState.chosen_stewards ?? []);
  const rotate = targets.some((id) => ["LE-050", "V43-050"].includes(id));
  const breaksVow = (stewardId: string) =>
    ((targets.includes("LE-041") || hasV43Target(targets, "LE-041")) && stewardId === "vanguard") ||
    ((targets.includes("LE-042") || hasV43Target(targets, "LE-042")) && stewardId === "sentinel");
  const availableStewards = stewards.filter((steward) => !breaksVow(steward.id));
  const defaultPriority = ["knight", "quartermaster", "sentinel", "vanguard", "ranger", "warden"];
  const targetPriority = [
    ...(hasTarget(targets, "LE-001", "LE-003", "LE-039") ? ["knight", "quartermaster"] : []),
    ...(hasTarget(targets, "LE-038", "LE-049") ? ["quartermaster"] : []),
    ...(hasTarget(targets, "LE-031", "LE-036", "LE-046") ? ["sentinel"] : []),
    ...(hasTarget(targets, "LE-015", "LE-018", "LE-044") ? ["vanguard"] : []),
    ...(hasTarget(targets, "LE-048") ? ["warden"] : []),
    "knight",
    "quartermaster",
    "sentinel",
    "vanguard",
    "ranger",
    "warden",
  ];
  const ordered = [...availableStewards].sort((a, b) => {
    const priority = rotate ? defaultPriority : targetPriority;
    return priority.indexOf(a.id) - priority.indexOf(b.id) || random() - 0.5;
  });
  const pool = rotate
    ? [...ordered.filter((steward) => !usedNames.has(steward.name)), ...ordered.filter((steward) => usedNames.has(steward.name))]
    : ordered;
  return [...new Set([...required, ...pool.map((steward) => steward.id)])].slice(0, playerCount);
}

function chooseTargets(specs: LedgerSpec[], profile: Profile, gameIndex: number, campaignState: any, previousEvaluation: any, random: () => number): LedgerSpec[] {
  if (profile === "passive_normal") return [];
  const completed = new Set(campaignState.completed_named_entries ?? []);
  const attemptedVows = new Set(campaignState.attempted_vows ?? []);
  const near = new Set((previousEvaluation?.near_misses ?? []).map((item: any) => item.entry_id));
  const candidates = specs.filter((spec) => !completed.has(spec.entry_id) && completed.size >= (spec.unlock_gate ?? 0)).map((spec) => {
    let score = 5 + random();
    score += spec.tuning?.target_weight ?? 0;
    if (near.has(spec.entry_id)) score += spec.gates.declared_vow_required ? 1 : 4;
    if (spec.gates.declared_vow_required) score += attemptedVows.has(spec.entry_id) ? -6 : 4;
    if (spec.pacing_band === "Foundation" && gameIndex <= 5) score += 1.5;
    if (spec.pacing_band === "Directed" && gameIndex >= 4) score += 1;
    if (spec.pacing_band === "Capstone" && gameIndex < 7) score -= 3;
    if (profile === "achievement_chaser") score += ({ Foundation: 4, Standard: 3, Directed: 1, Capstone: 0 } as any)[spec.pacing_band] ?? 0;
    return { spec, score };
  }).sort((a, b) => b.score - a.score);
  const shouldDeclareVow = profile === "achievement_chaser"
    || (profile === "guided_ledger" && gameIndex >= 3 && gameIndex % 2 === 1);
  const limit = profile === "achievement_chaser" ? 3 : 2;
  const selected: LedgerSpec[] = [];
  if (shouldDeclareVow) {
    const vow = candidates.find((candidate) => candidate.spec.gates.declared_vow_required);
    if (vow) selected.push(vow.spec);
  }
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (selected.some((spec) => spec.entry_id === candidate.spec.entry_id)) continue;
    if (candidate.spec.gates.declared_vow_required && !shouldDeclareVow) continue;
    if (candidate.spec.gates.declared_vow_required && selected.some((spec) => spec.gates.declared_vow_required)) continue;
    selected.push(candidate.spec);
  }
  return selected;
}

function createStats(state: GameState): BotStats {
  return {
    placeActions: 0,
    upgradeActions: 0,
    activateActions: 0,
    encounterInteractActions: 0,
    freePlaceEffectsUsed: 0,
    burdensResolved: 0,
    resolvedBurdenIds: [],
    usedBoonIds: [],
    tileActivationCountsByInstance: {},
    arrivalsExpired: 0,
    arrivalsCompletedAtOneTimer: 0,
    arrivalCompletionEvents: [],
    strainPrevented: 0,
    strainRemoved: 0,
    maxOverstrainedTiles: 0,
    burdenRevealSeason: {},
    burdenRevealRound: {},
    burdensResolvedSameSeason: 0,
    burdensResolvedSameRoundBySeason: {},
    warehousePeak: { ...state.warehouse },
    seasonSnapshots: {
      end_season_1: { active_burdens: 0, overstrained_tiles: 0, arrivals_completed_this_season: 0, burdens_resolved_this_season: 0 },
      end_season_2: { active_burdens: 0, overstrained_tiles: 0, arrivals_completed_this_season: 0, burdens_resolved_this_season: 0 },
      end_season_3: { active_burdens: 0, overstrained_tiles: 0 },
    },
    unusedActions: 0,
    earlyEndTurns: 0,
    decisionNotes: [],
    strategyPlans: [],
    actionReasons: [],
    firstCategoryRound: {},
    housingPlacedAfterSupport: 0,
    resourcesProducedByResource: { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 },
    productionActivationsByRound: {},
    craftingPassiveUses: 0,
    resourcesSavedByCrafting: 0,
    merchantPassiveUses: 0,
    goodsConvertedByMerchant: 0,
    errors: [],
  };
}

function chooseGoldenContent(
  unlockCount: number,
  targets: string[],
  profile: Profile,
  random: () => number,
): { selectedGoldenTileId?: string; selectedGoldenBoonId?: string } {
  const unlockedIndexes = ledgerMilestones
    .map((milestone, index) => ({ milestone, index }))
    .filter(({ milestone }) => unlockCount >= milestone.threshold)
    .map(({ index }) => index);
  if (unlockedIndexes.length === 0 || (profile === "passive_normal" && random() < 0.35)) {
    return {};
  }

  const preferredTileIndex = targets.some((id) => ["LE-010", "LE-011", "LE-012", "LE-032"].includes(id))
    ? 2
    : targets.some((id) => ["LE-004", "LE-017", "LE-018", "LE-042"].includes(id))
      ? 4
      : targets.some((id) => ["LE-035"].includes(id))
        ? 3
        : targets.some((id) => ["LE-005", "LE-006", "LE-007", "LE-020"].includes(id))
          ? 1
          : 0;
  const tileIndex = unlockedIndexes.includes(preferredTileIndex)
    ? preferredTileIndex
    : unlockedIndexes.at(-1)!;
  const boonIndex = profile === "achievement_chaser"
    ? unlockedIndexes.at(-1)!
    : unlockedIndexes[Math.floor(random() * unlockedIndexes.length)];
  return {
    selectedGoldenTileId: goldenTiles[tileIndex]?.id,
    selectedGoldenBoonId: goldenBoons[boonIndex]?.id,
  };
}

function chooseGoldenSetupHex(state: GameState): string | undefined {
  const legal = getGoldenTileSetupLegalHexIds(state);
  return legal.sort((a, b) => {
    const score = (hexId: string) => {
      const cell = mapById[hexId];
      const centrality = 20 - Math.abs(mapColumns.indexOf(cell.col) - 7) - Math.abs(cell.row - 5);
      const usableNeighbors = getHexNeighbors(hexId).filter((neighbor) => mapById[neighbor]?.terrain !== "water").length;
      return centrality + usableNeighbors * 2;
    };
    return score(b) - score(a);
  })[0];
}

export function simulateCurrentGame(input: any): any {
  const random = randomFor(input.seed);
  const behavior: HumanBehaviorOptions = {
    choicePolicy: input.choicePolicy === "near_best" ? "near_best" : "best",
  };
  const stewardIds = input.stewardIds?.length
    ? input.stewardIds.slice(0, input.playerCount)
    : chooseStewardIds(input.playerCount, input.targets, input.campaignState, random);
  const declaredVowId = input.declaredVowId ?? input.targets.find(
    (entryId: string) => ledgerEntries.find((entry) => entry.id === entryId)?.declaredVow,
  );
  const golden = chooseGoldenContent(
    input.unlockCountStart ?? 0,
    input.targets,
    input.profile,
    random,
  );
  let state = createNewGame(input.playerCount, stewardIds, {
    encounterSeed: input.seed,
    declaredVowId,
    ...golden,
  });
  const bannedTileIds = new Set<string>(input.bannedTileIds ?? []);
  if (bannedTileIds.size > 0) {
    state = {
      ...state,
      tileSupply: {
        core: Object.fromEntries(
          Object.entries(state.tileSupply.core).map(([tileId, count]) => [
            tileId,
            bannedTileIds.has(tileId) ? 0 : count,
          ]),
        ),
        special: Object.fromEntries(
          Object.entries(state.tileSupply.special).map(([tileId, count]) => [
            tileId,
            bannedTileIds.has(tileId) ? 0 : count,
          ]),
        ),
      },
    };
  }
  const stats = createStats(state);
  const humanPlanning = emptyHumanPlanningContext();
  for (const player of state.players) state = commitStewardPlacement(state, state.currentPlayerId, state.players.find((candidate) => candidate.id === state.currentPlayerId)!.stewardHexId);
  if (state.phase === "goldenSetup") {
    const goldenHex = chooseGoldenSetupHex(state);
    if (goldenHex) state = placeGoldenTileForSetup(state, goldenHex);
  }

  let seasonStartCompleted = 0;
  let seasonStartResolved = 0;
  for (let guard = 0; guard < 1000 && state.phase !== "gameEnd"; guard += 1) {
    state = drainPending(state, stats);
    updatePeak(state, stats);
    if (stats.errors.length) break;
    if (state.phase === "seeding") {
      const playerId = state.currentPlayerId;
      if (input.profile === "human_like") {
        const seasonHands = humanPlanning.handsBySeason[state.season] ?? {};
        seasonHands[playerId] = [...(state.encounters.handsByPlayerId[playerId] ?? [])];
        humanPlanning.handsBySeason[state.season] = seasonHands;
        const burdenLedgerTarget = input.targets.some(
          (entryId: string) => entryId === "LE-024" || entryId === "LE-048",
        );
        const plannedSeed = chooseHumanLikeSeed(
          state,
          playerId,
          burdenLedgerTarget
              ? {
                minimumBurdens: 1,
                maximumBurdens: input.targets.includes("LE-048") ? 1 : 3,
                preferredBurdenWindow: input.targets.includes("LE-048") ? "middle" : "early",
                burdenReason: input.targets.includes("LE-048")
                  ? "Seeded after the opening build so the Warden's Vigil can trigger Warden Power in this Season."
                  : "Seeded early to leave enough rounds and resources to resolve two Burdens for Burdens Set Down.",
              }
            : {},
        );
        const existingForecasts = humanPlanning.forecastsBySeason[state.season] ?? [];
        const forecasts = [...existingForecasts, ...plannedSeed.forecasts];
        humanPlanning.forecastsBySeason[state.season] = forecasts;
        state = commitSeasonSeeding(state, playerId, plannedSeed.selection);
        const plan = buildHumanSeasonPlan(state, forecasts, seasonHands, input.targets);
        humanPlanning.plansBySeason[state.season] = plan;
        stats.strategyPlans = [...stats.strategyPlans.filter((candidate) => candidate.season !== state.season), plan];
      } else {
        const selection = chooseSeed(state, playerId, input.profile, random);
        state = commitSeasonSeeding(state, playerId, selection);
      }
      continue;
    }
    if (state.phase === "reveal") {
      const burdensBefore = new Set(state.encounters.activeBurdens);
      const plan = input.profile === "human_like" ? humanPlanning.plansBySeason[state.season] : undefined;
      state = drainPending(revealEncounters(state), stats, plan);
      for (const burdenId of state.encounters.activeBurdens) {
        if (!burdensBefore.has(burdenId)) {
          stats.burdenRevealSeason[burdenId] = state.season;
          stats.burdenRevealRound[burdenId] = state.round;
        }
      }
      continue;
    }
    if (state.phase === "turns") {
      const plan = input.profile === "human_like"
        ? humanPlanning.plansBySeason[state.season] ?? buildHumanSeasonPlan(
          state,
          humanPlanning.forecastsBySeason[state.season] ?? [],
          humanPlanning.handsBySeason[state.season] ?? {},
          input.targets,
        )
        : undefined;
      state = playTurn(state, input.targets, input.profile, random, stats, plan, behavior);
      updatePeak(state, stats);
      continue;
    }
    if (state.phase === "endRound") {
      const oldRound = state.round;
      const expiredBefore = state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens === 1).length;
      const completedBefore = state.encounters.completedArrivals.length;
      const resolvedBefore = stats.burdensResolved;
      state = resolveEndRound(state);
      while (state.pendingEffects[0]?.title.startsWith("Arrival expired:")) {
        const before = state;
        const beforeStrain = totalStrain(before);
        const pending = before.pendingEffects[0];
        state = resolvePendingEffect(state, customPendingAdjustment(state));
        if (state.pendingEffects.includes(pending)) {
          stats.errors.push(`Could not resolve pending effect: ${pending.title}`);
          break;
        }
        stats.strainPrevented += supportPreventions(before, state);
        stats.strainRemoved += Math.max(0, beforeStrain - totalStrain(state));
      }
      stats.arrivalsExpired += expiredBefore;
      if (oldRound === 4 || oldRound === 8) {
        const key = oldRound === 4 ? "end_season_1" : "end_season_2";
        stats.seasonSnapshots[key] = {
          active_burdens: state.encounters.activeBurdens.length,
          overstrained_tiles: state.map.placedTiles.filter((tile) => tile.strain >= 3).length,
          arrivals_completed_this_season: completedBefore - seasonStartCompleted,
          burdens_resolved_this_season: resolvedBefore - seasonStartResolved,
        };
        seasonStartCompleted = completedBefore;
        seasonStartResolved = resolvedBefore;
      }
      state = drainPending(state, stats);
      continue;
    }
  }
  stats.seasonSnapshots.end_season_3 = { active_burdens: state.encounters.activeBurdens.length, overstrained_tiles: state.map.placedTiles.filter((tile) => tile.strain >= 3).length };
  const placedTravel = state.map.placedTiles.filter((tile) => tileCategory(tile) === "travel").length;
  const placedFarmsteads = state.map.placedTiles.filter((tile) => tile.tileId === "c04_farmstead").length;
  const upgradedCore = state.map.placedTiles.filter(
    (tile) => tile.kind === "core" && tile.side === "upgraded",
  ).length;
  const peak = Math.max(...Object.values(stats.warehousePeak));
  const violations: string[] = [];
  if (declaredVowId === "LE-026" && placedTravel > 0) violations.push("A Travel Tile was placed.");
  if (declaredVowId === "LE-027" && placedFarmsteads > 0) violations.push("A Farmstead was placed.");
  if (declaredVowId === "LE-028" && upgradedCore > 0) violations.push("A Core Tile was upgraded.");
  if (declaredVowId === "LE-029" && stats.arrivalsExpired > 0) violations.push("An Arrival expired.");
  if (declaredVowId === "LE-030" && peak > 8) violations.push("The Warehouse exceeded 8 of a resource.");
  const seasonOne = stats.seasonSnapshots.end_season_1;
  const seasonTwo = stats.seasonSnapshots.end_season_2;
  state = {
    ...state,
    ledgerRun: {
      ...state.ledgerRun!,
      gameId: input.seed,
      declaredVowId,
      arrivalsRevealed: input.playerCount * 4,
      arrivalsCompleted: state.encounters.completedArrivals.length,
      arrivalsExpired: stats.arrivalsExpired,
      burdensRevealed: input.playerCount * 4,
      burdensResolved: stats.burdensResolved,
      arrivalsCompletedBySeason: {
        1: seasonOne.arrivals_completed_this_season,
        2: seasonTwo.arrivals_completed_this_season,
        3: Math.max(
          0,
          state.encounters.completedArrivals.length -
            seasonOne.arrivals_completed_this_season -
            seasonTwo.arrivals_completed_this_season,
        ),
      },
      burdensResolvedBySeason: {
        1: seasonOne.burdens_resolved_this_season,
        2: seasonTwo.burdens_resolved_this_season,
        3: Math.max(
          0,
          stats.burdensResolved -
            seasonOne.burdens_resolved_this_season -
            seasonTwo.burdens_resolved_this_season,
        ),
      },
      strainPreventedBySupported: stats.strainPrevented,
      warehousePeakByResource: { ...stats.warehousePeak },
      seasonSnapshots: {
        1: {
          activeBurdens: seasonOne.active_burdens,
          overstrainedTiles: seasonOne.overstrained_tiles,
          arrivalsCompleted: seasonOne.arrivals_completed_this_season,
          burdensResolved: seasonOne.burdens_resolved_this_season,
        },
        2: {
          activeBurdens: seasonTwo.active_burdens,
          overstrainedTiles: seasonTwo.overstrained_tiles,
          arrivalsCompleted: seasonTwo.arrivals_completed_this_season,
          burdensResolved: seasonTwo.burdens_resolved_this_season,
        },
      },
      violatedVowReasons: violations,
    },
  };
  const log = buildGameLog(state, stats, input);
  return input.returnState ? { state, log, stats } : log;
}

async function main() {
  const [specPath, outputPath] = process.argv.slice(2).filter((argument) => argument !== "--");
  if (!specPath || !outputPath) throw new Error("Usage: vite-node current-prototype-simulation.ts <ledger_entry_specs.json> <output.json>");
  const specs: LedgerSpec[] = JSON.parse(await fs.readFile(specPath, "utf8"));
  const focusedRerun = process.env.QVALE_FOCUSED_RERUN === "1";
  const v314Validation = process.env.QVALE_V314_VALIDATION === "1";
  const stage1: any[] = [];
  if (!focusedRerun) {
    const smokeProfiles: Profile[] = v314Validation ? ["guided_ledger"] : profiles;
    const smokeRuns = v314Validation ? 4 : 2;
    for (const playerCount of playerCounts) for (const profile of smokeProfiles) for (let run = 1; run <= smokeRuns; run += 1) {
      const campaignState = { completed_named_entries: [], completed_prestige_boxes: [], chosen_stewards: [], completed_steward_objectives: [], attempted_vows: [] as string[] };
      const targets = chooseTargets(specs, profile, 1, campaignState, null, randomFor(`stage1-target:${playerCount}:${profile}:${run}`));
      const log = simulateCurrentGame({ specs, playerCount, profile, campaignId: `S1-${playerCount}P-${profile}-${run}`, gameIndex: 1, seed: `current-stage1:${playerCount}:${profile}:${run}`, campaignState, targets: targets.map((spec) => spec.entry_id), unlockCountStart: 0 });
      const evaluation = evaluateLedger(specs, log, campaignState);
      log.unlock_count_end = evaluation.new_named_entries.length;
      stage1.push({ log, evaluation, validationErrors: log.simulation_errors, sourceGameId: "current-prototype" });
      console.log(`Stage 1 ${playerCount}p ${profile} ${run}/2 complete`);
    }
  }

  const campaigns: any[] = [];
  if (process.env.QVALE_STAGE1_ONLY === "1") {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), source: "current prototype engine", stage1, campaigns, continuationCampaigns: [], goldenDisabledPairs: [] }));
    console.log(JSON.stringify({ stage1Games: stage1.length, simulationErrors: stage1.filter((result) => result.validationErrors.length).length }, null, 2));
    return;
  }
  const campaignPlans = v314Validation
    ? [
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 4 }, (_, index) => ({ playerCount, profile: "guided_ledger" as Profile, games: 16, run: index + 1, id: `G-${playerCount}P-${index + 1}` }))),
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 2 }, (_, index) => ({ playerCount, profile: "passive_normal" as Profile, games: 8, run: index + 1, id: `P-${playerCount}P-${index + 1}` }))),
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 2 }, (_, index) => ({ playerCount, profile: "achievement_chaser" as Profile, games: 8, run: index + 1, id: `C-${playerCount}P-${index + 1}` }))),
      ]
    : focusedRerun
    ? [
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 4 }, (_, index) => ({ playerCount, profile: "guided_ledger" as Profile, games: 4, run: index + 1, id: `G-${playerCount}P-${index + 1}` }))),
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 4 }, (_, index) => ({ playerCount, profile: "passive_normal" as Profile, games: 3, run: index + 1, id: `P-${playerCount}P-${index + 1}` }))),
      ]
    : [
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 4 }, (_, index) => ({ playerCount, profile: "guided_ledger" as Profile, games: 12, run: index + 1, id: `G-${playerCount}P-${index + 1}` }))),
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 4 }, (_, index) => ({ playerCount, profile: "passive_normal" as Profile, games: 3, run: index + 1, id: `P-${playerCount}P-${index + 1}` }))),
        ...playerCounts.flatMap((playerCount) => Array.from({ length: 2 }, (_, index) => ({ playerCount, profile: "achievement_chaser" as Profile, games: 6, run: index + 1, id: `C-${playerCount}P-${index + 1}` }))),
      ];
  for (const plan of campaignPlans) {
    const state = { completed_named_entries: [] as string[], completed_prestige_boxes: [] as string[], chosen_stewards: [] as string[], completed_steward_objectives: [] as string[], attempted_vows: [] as string[] };
    const results: any[] = [];
    let previousEvaluation: any = null;
    for (let gameIndex = 1; gameIndex <= plan.games; gameIndex += 1) {
      const targets = chooseTargets(specs, plan.profile, gameIndex, state, previousEvaluation, randomFor(`target:${plan.id}:${gameIndex}`));
      const log = simulateCurrentGame({ specs, playerCount: plan.playerCount, profile: plan.profile, campaignId: plan.id, gameIndex, seed: `current-stage2:${plan.id}:${gameIndex}`, campaignState: state, targets: targets.map((spec) => spec.entry_id), unlockCountStart: state.completed_named_entries.length });
      const evaluation = evaluateLedger(specs, log, state);
      log.unlock_count_end = state.completed_named_entries.length + evaluation.new_named_entries.length;
      log.target_attempts = targets.map((spec) => ({ entry_id: spec.entry_id, result: evaluation.entry_results[spec.entry_id].complete ? "completed" : evaluation.entry_results[spec.entry_id].margin !== null ? "near_miss" : "failed", reason: evaluation.entry_results[spec.entry_id].reason ?? evaluation.entry_results[spec.entry_id].blocked ?? "condition not met" }));
      results.push({ log, evaluation, validationErrors: log.simulation_errors, sourceGameId: "current-prototype" });
      state.completed_named_entries = [...new Set([...state.completed_named_entries, ...evaluation.new_named_entries])];
      state.completed_prestige_boxes = [...new Set([...state.completed_prestige_boxes, ...evaluation.prestige_boxes_completed.map((box: any) => `${box.entry_id}:${box.player_count}`)])];
      state.chosen_stewards = [...new Set([...state.chosen_stewards, ...log.chosen_stewards])];
      state.completed_steward_objectives = [...new Set([...state.completed_steward_objectives, ...log.stewards.objectives_completed])];
      state.attempted_vows = [...new Set([...state.attempted_vows, ...log.declared_vows])];
      previousEvaluation = evaluation;
    }
    campaigns.push({ campaignId: plan.id, playerCount: plan.playerCount, profile: plan.profile, state, results });
    console.log(`Stage 2 campaign ${plan.id} complete (${campaigns.length}/${campaignPlans.length})`);
  }
  const continuationCampaigns: any[] = [];
  if (!focusedRerun && !v314Validation) {
    const guided = campaigns.filter((campaign) => campaign.profile === "guided_ledger");
    const reachedThirty = guided.filter((campaign) => campaign.state.completed_named_entries.length >= 30).length;
    if (reachedThirty / guided.length < 0.5) {
      for (const source of guided) {
        const state = {
          completed_named_entries: [...source.state.completed_named_entries],
          completed_prestige_boxes: [...source.state.completed_prestige_boxes],
          chosen_stewards: [...source.state.chosen_stewards],
          completed_steward_objectives: [...source.state.completed_steward_objectives],
          attempted_vows: [...source.state.attempted_vows],
        };
        const results = [...source.results];
        let previousEvaluation = results.at(-1)?.evaluation ?? null;
        for (let gameIndex = 13; gameIndex <= 16; gameIndex += 1) {
          const targets = chooseTargets(specs, "guided_ledger", gameIndex, state, previousEvaluation, randomFor(`target:${source.campaignId}:${gameIndex}`));
          const log = simulateCurrentGame({ specs, playerCount: source.playerCount, profile: "guided_ledger", campaignId: source.campaignId, gameIndex, seed: `current-stage2:${source.campaignId}:${gameIndex}`, campaignState: state, targets: targets.map((spec) => spec.entry_id), unlockCountStart: state.completed_named_entries.length });
          const evaluation = evaluateLedger(specs, log, state);
          log.unlock_count_end = state.completed_named_entries.length + evaluation.new_named_entries.length;
          log.target_attempts = targets.map((spec) => ({ entry_id: spec.entry_id, result: evaluation.entry_results[spec.entry_id].complete ? "completed" : evaluation.entry_results[spec.entry_id].margin !== null ? "near_miss" : "failed", reason: evaluation.entry_results[spec.entry_id].reason ?? evaluation.entry_results[spec.entry_id].blocked ?? "condition not met" }));
          results.push({ log, evaluation, validationErrors: log.simulation_errors, sourceGameId: "current-prototype" });
          state.completed_named_entries = [...new Set([...state.completed_named_entries, ...evaluation.new_named_entries])];
          state.completed_prestige_boxes = [...new Set([...state.completed_prestige_boxes, ...evaluation.prestige_boxes_completed.map((box: any) => `${box.entry_id}:${box.player_count}`)])];
          state.chosen_stewards = [...new Set([...state.chosen_stewards, ...log.chosen_stewards])];
          state.completed_steward_objectives = [...new Set([...state.completed_steward_objectives, ...log.stewards.objectives_completed])];
          state.attempted_vows = [...new Set([...state.attempted_vows, ...log.declared_vows])];
          previousEvaluation = evaluation;
        }
        continuationCampaigns.push({ campaignId: source.campaignId, playerCount: source.playerCount, profile: source.profile, state, results });
        console.log(`Stage 2D campaign ${source.campaignId} continued to game 16 (${continuationCampaigns.length}/${guided.length})`);
      }
    }
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), source: "current prototype engine", mode: v314Validation ? "v3_14_validation" : focusedRerun ? "focused_post_adjustment" : "full_stage_2", stage1, campaigns, continuationCampaigns, goldenDisabledPairs: [] }));
  const continuationResults = continuationCampaigns.flatMap((campaign) => campaign.results.slice(12));
  console.log(JSON.stringify({ stage1Games: stage1.length, stage2Games: campaigns.flatMap((campaign) => campaign.results).length, stage2DGames: continuationResults.length, campaigns: campaigns.length, simulationErrors: [...stage1, ...campaigns.flatMap((campaign) => campaign.results), ...continuationResults].filter((result) => result.validationErrors.length).length }, null, 2));
}

if (process.argv.some((argument) => argument.endsWith("current-prototype-simulation.ts"))) {
  await main();
}

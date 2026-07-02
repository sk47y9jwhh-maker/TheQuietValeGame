import fs from "node:fs/promises";
import path from "node:path";
import { coreTiles, coreTileById, goldenTiles, specialTiles, specialTileById } from "../../src/data/tiles";
import { encounterById, goldenBoons } from "../../src/data/encounters";
import { ledgerEntries, ledgerMilestones } from "../../src/data/ledger";
import { mapById, mapCells, mapColumns } from "../../src/data/map";
import { stewards, stewardById } from "../../src/data/stewards";
import {
  activateTile,
  canStartPlaceTile,
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
  getActiveEffectText,
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
import {
  getGoldenTileSetupLegalHexIds,
  placeGoldenTileForSetup,
  resolveGoldenBell,
  resolveGoldenScroll,
  resolveGoldenSignet,
} from "../../src/engine/golden";
import { getTileFootprintKind, getTilePlacementHexIds } from "../../src/engine/placementRules";
import { applyCostChoice } from "../../src/engine/passiveCosts";
import { selectReachablePlacedTileIds } from "../../src/engine/reachability";
import { calculateFinalScore } from "../../src/engine/scoring";
import { createNewGame } from "../../src/engine/setup";
import {
  buildCardIntent,
  buildHumanSeasonPlan,
  cardPlanPriority,
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
  TileCategory,
  TilePlacementDraft,
} from "../../src/engine/types";
// The evaluator is deliberately outside the player-facing source tree.
// @ts-expect-error JavaScript analysis module.
import { evaluateLedger } from "./lib/evaluator.mjs";

type Profile = "passive_normal" | "guided_ledger" | "achievement_chaser" | "human_like";
type LedgerSpec = Record<string, any>;

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
  strainPrevented: number;
  strainRemoved: number;
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
    reasonCode: string;
    reason: string;
    rejectedAlternative?: string;
  }>;
  firstCategoryRound: Partial<Record<TileCategory, number>>;
  firstSupportRound?: number;
  firstHousingClusterRound?: number;
  housingPlacedAfterSupport: number;
  craftingPassiveUses: number;
  resourcesSavedByCrafting: number;
  merchantPassiveUses: number;
  goodsConvertedByMerchant: number;
  errors: string[];
}

const emptySelection: CostChoiceSelection = { selectedOptionIds: [] };
const playerCounts: PlayerCount[] = [1, 2, 3, 4];
const profiles: Profile[] = ["passive_normal", "guided_ledger", "achievement_chaser"];

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
    isTileAdjustmentValid(state, pending.effectText, pending.suggestedAdjustment, sourceTile)
  ) return {};
  if (pending.allowWardenRelief) {
    const strained = state.map.placedTiles.find((tile) => tile.strain > 0);
    if (strained) return { tileStrainDeltas: { [strained.instanceId]: -1 } };
    const tile = state.map.placedTiles[0];
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
    pending.effectText,
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
    const payable = alternativeRule.resources.find(
      (resource) => state.warehouse[resource] >= alternativeRule.resourceStep
    );
    if (payable) {
      return { resourceDeltas: { [payable]: -alternativeRule.resourceStep } };
    }
  }
  if (pending.resourceExchangeLimit !== undefined) {
    const entries = (Object.entries(state.warehouse) as Array<[ResourceType, number]>).sort((a, b) => b[1] - a[1]);
    const isAlchemist = /exchange\s+5\s+total\s+resources\s+for\s+3\s+Goods/i.test(pending.effectText);
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
      const source = entries[0];
      const target = entries
        .filter(([resource]) => resource !== source[0] && (!isAlchemist || resource !== "goods"))
        .sort((a, b) => a[1] - b[1])[0];
      const amount = target
        ? Math.min(
          pending.resourceExchangeLimit,
          source[1],
          Math.max(0, 15 - target[1]),
          Math.max(1, 8 - target[1]),
        )
        : 0;
      resourceDeltas = target && amount > 0
        ? { [source[0]]: -amount, [target[0]]: amount }
        : undefined;
    }
    const arrival = /add\s+1\s+timer/i.test(pending.effectText)
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

  const timerRule = getTimerAdjustmentRule(pending.effectText);
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

  const payMatch = alternativeRule
    ? null
    : pending.effectText.match(/pay\s+(\d+)\s+(Wood|Stone|Metal|Food|Herbs|Goods)/i);
  if (payMatch) {
    const resource = payMatch[2].toLowerCase() as ResourceType;
    const amount = Number(payMatch[1]);
    if (state.warehouse[resource] >= amount) return { resourceDeltas: { [resource]: -amount } };
  }

  const lower = pending.effectText.toLowerCase();
  if (lower.includes("strain")) {
    const activeEffectText = getActiveEffectText(state, pending.effectText, sourceTile);
    const rule = getTileAdjustmentRule(activeEffectText).strain;
    const targets = getValidEffectStrainTargets(state, pending.effectText, sourceTile);
    if (rule && targets.length > 0) {
      let remaining = rule.maxTotal;
      const tileStrainDeltas: Record<string, number> = Object.fromEntries(
        Object.keys(pending.suggestedAdjustment?.tileStrainDeltas ?? {}).map((tileId) => [tileId, 0]),
      );
      for (const target of targets.slice(0, rule.maxTargets)) {
        if (remaining <= 0) break;
        const capacity = rule.direction === "remove" ? target.strain : 3 - target.strain;
        const amount = Math.min(rule.maxPerTile, capacity, remaining);
        if (amount <= 0) continue;
        tileStrainDeltas[target.instanceId] = rule.direction === "remove" ? -amount : amount;
        remaining -= amount;
      }
      if (Object.keys(tileStrainDeltas).length > 0) return { tileStrainDeltas };
    }
  }

  if (lower.includes("supported")) {
    const target = getEffectSupportTargets(state, pending.effectText, sourceTile)[0];
    if (target) return { supportTileIds: [target.instanceId] };
  }

  if (lower.includes("additional resources of types that tile can produce") || lower.includes("+2 resources of types that tile can produce")) {
    const choices: ResourceType[] = pending.sourceName.includes("Ancestors")
      ? ["metal", "goods"]
      : pending.sourceName.includes("Depths")
        ? ["stone", "metal"]
        : ["wood", "food"];
    const resource = choices.sort((a, b) => state.warehouse[a] - state.warehouse[b])[0];
    return { resourceDeltas: { [resource]: 2 } };
  }

  const gainMatch = pending.effectText.match(/gain\s+(\d+)\s+(Wood|Stone|Metal|Food|Herbs|Goods)/i);
  if (gainMatch) {
    const resource = gainMatch[2].toLowerCase() as ResourceType;
    return { resourceDeltas: { [resource]: Number(gainMatch[1]) } };
  }
  const loseMatch = pending.effectText.match(/lose\s+(\d+)\s+(Wood|Stone|Metal|Food|Herbs|Goods)/i);
  if (loseMatch) {
    const resource = loseMatch[2].toLowerCase() as ResourceType;
    return { resourceDeltas: { [resource]: -Number(loseMatch[1]) } };
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
        (a, b) => (pending.baseCost[b] ?? 0) - (pending.baseCost[a] ?? 0),
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
    const shouldUseWarden = !plan ||
      (pending.sourceId ? plan.highRiskBurdenIds.includes(pending.sourceId) : false) ||
      /housing|each of|overstrained/i.test(pending.effectText);
    if (pending.canCancelWithWardenPower && shouldUseWarden && canCancelPendingBurdenWithWarden(state).ok) {
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
          `suggested ${JSON.stringify(pending.suggestedAdjustment)}; active ${getActiveEffectText(before, pending.effectText, debugSourceTile)}; ` +
          `alternative ${JSON.stringify(getAlternativeEffectRule(before, pending.effectText, debugSourceTile))}; ` +
          `alternativeValid ${isAlternativeEffectAdjustmentValid(before, pending.effectText, pending.suggestedAdjustment ?? adjustment, debugSourceTile)}; ` +
          `timerRule ${JSON.stringify(getTimerAdjustmentRule(pending.effectText))}; ` +
          `timerValid ${isTimerAdjustmentValid(before, pending.effectText, (pending.suggestedAdjustment ?? adjustment).arrivalTimerDeltas)}; ` +
          `tileValid ${isTileAdjustmentValid(before, pending.effectText, pending.suggestedAdjustment ?? adjustment, debugSourceTile)}; manual ${Boolean(pending.requiresManualChoice)}`,
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

function targetCategoryWeights(targets: string[]): Partial<Record<TileCategory, number>> {
  const weights: Partial<Record<TileCategory, number>> = {};
  const add = (category: TileCategory, amount: number) => { weights[category] = (weights[category] ?? 0) + amount; };
  for (const id of targets) {
    if (id === "LE-001") {
      add("housing", 5);
      for (const category of ["crafting","merchant","social","wellbeing","travel"] as TileCategory[]) add(category, 2);
    }
    if (id === "LE-002") add("housing", 15);
    if (id === "LE-003") {
      for (const category of ["crafting","merchant","social","wellbeing","travel"] as TileCategory[]) add(category, 5);
    }
    if (["LE-007","LE-020","LE-033","LE-048","LE-050"].includes(id)) add("housing", 35);
    if (id === "LE-024") {
      add("crafting", 35);
      add("merchant", 35);
    }
    if (["LE-010","LE-011","LE-012","LE-025","LE-032","LE-049"].includes(id)) add("travel", 35);
    if (["LE-013","LE-014","LE-015","LE-050"].includes(id)) add("special", 45);
    if (["LE-008","LE-009","LE-048"].includes(id)) {
      for (const category of ["crafting","merchant","social","wellbeing"] as TileCategory[]) add(category, 20);
    }
  }
  return weights;
}

function applyHumanPlanCategoryWeights(
  state: GameState,
  weights: Partial<Record<TileCategory, number>>,
  plan: HumanSeasonPlan | undefined,
): void {
  if (!plan) return;
  const count = (category: TileCategory) => state.map.placedTiles.filter((tile) => tileCategory(tile) === category).length;
  const add = (category: TileCategory, amount: number) => { weights[category] = (weights[category] ?? 0) + amount; };
  if (count("resource") < Math.max(2, state.playerCount)) add("resource", 45);
  if (plan.needsTravelAnchor && count("travel") === 0) add("travel", 28);
  if (plan.needsCrafting && count("crafting") === 0 && state.season <= 2) add("crafting", 42);
  if (plan.needsMerchant && count("merchant") === 0 && state.season <= 2) add("merchant", 38);
  if (plan.needsSupportBeforeHousing && count("wellbeing") === 0) add("wellbeing", 28);
  if (plan.housingPush) add("housing", state.season === 2 ? 30 : 22);
  if (!plan.housingPush && state.season === 1) add("housing", -12);
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
  if (plan) {
    for (const category of Object.keys(categoryWeights) as TileCategory[]) {
      categoryWeights[category] = (categoryWeights[category] ?? 0) * 0.35;
    }
  }
  applyHumanPlanCategoryWeights(state, categoryWeights, plan);
  const placedCategoryCounts = new Map<TileCategory, number>();
  for (const tile of state.map.placedTiles.filter((candidate) => candidate.strain < 3)) {
    const category = tileCategory(tile);
    placedCategoryCounts.set(category, (placedCategoryCounts.get(category) ?? 0) + 1);
  }
  if (targets.some((id) => ["LE-008", "LE-009"].includes(id))) {
    for (const category of ["resource", "housing", "crafting", "merchant", "social", "wellbeing", "travel"] as TileCategory[]) {
      if ((placedCategoryCounts.get(category) ?? 0) === 0) {
        categoryWeights[category] = (categoryWeights[category] ?? 0) + 75;
      }
    }
  }
  if (targets.includes("LE-024")) {
    const target = state.playerCount >= 3 ? 2 : 1;
    for (const category of ["crafting", "merchant"] as TileCategory[]) {
      const deficit = Math.max(0, target - (placedCategoryCounts.get(category) ?? 0));
      categoryWeights[category] = (categoryWeights[category] ?? 0) + deficit * 65;
    }
  }
  if (targets.some((id) => ["LE-007", "LE-020", "LE-033"].includes(id))) {
    categoryWeights.housing = (categoryWeights.housing ?? 0) + 35;
  }
  if (targets.some((id) => ["LE-012", "LE-025", "LE-049"].includes(id))) {
    categoryWeights.travel = (categoryWeights.travel ?? 0) + 45;
  }
  const noTravel = targets.includes("LE-026");
  const noFarmstead = targets.includes("LE-027");
  const occupied = new Set(state.map.placedTiles.flatMap((tile) => tile.hexIds));
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
      if (!produced.has(resource) && resourceDemandDeficit(state, plan, resource) >= 4 && terrainByResource[resource]) {
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
  ].filter((tile) => getTileFootprintKind(tile.id) !== "detached");
  const scored = tiles.map((tile) => {
    let score = random() * 3 + (categoryWeights[tile.category] ?? 0);
    let reasonCode = "FINAL_SCORE_CONVERSION";
    let reason = `Place ${tile.name} for its immediate settlement value.`;
    if (tile.kind === "core") {
      if (plan?.needsSupportBeforeHousing && /supported|remove .*strain/i.test(tile.basic.effectText)) {
        score += state.season === 1 ? 38 : 24;
        reasonCode = "SUPPORT_BEFORE_HOUSING";
        reason = "Establish prevention or Strain relief before forecast Burdens can disable the economy or scoring district.";
      }
      score += tile.basic.population + tile.basic.renown;
      const scarcityCost = (Object.entries(tile.basic.cost) as Array<[ResourceType, number]>).reduce(
        (total, [resource, amount]) =>
          total + amount * (0.4 + Math.max(0, 8 - state.warehouse[resource]) * 0.35),
        0,
      );
      score -= scarcityCost;
      if (tile.category === "resource") {
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
        reasonCode = "EARLY_RESOURCE_DEFICIT";
        reason = `Build production against forecast Warehouse demand (${Math.round(productionValue)} readiness value).`;
      }
      if (tile.category === "housing") score += 24;
      if (tile.category === "travel") score += 8;
      if (tile.id === "c15_path") score += 8;
      if (plan && tile.category === "travel") {
        const travelCount = state.map.placedTiles.filter((placed) => tileCategory(placed) === "travel").length;
        if (!plan.needsTravelAnchor && travelCount >= 1) score -= 45;
        if (tile.id === "c15_path" && travelCount >= 2) score -= 55;
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
        const supportPresent = state.map.placedTiles.some((placed) => placed.support.passive || placed.support.singleUse || /supported/i.test(placed.kind === "special" ? specialTileById[placed.tileId].effectText : coreTileById[placed.tileId][placed.side === "upgraded" ? "upgraded" : "basic"].effectText));
        if (plan.needsSupportBeforeHousing && !supportPresent && state.season < 3) score -= 22;
        reasonCode = "HOUSING_CLUSTER_CONVERSION";
        reason = supportPresent
          ? "Convert the prepared and protected district into clustered Housing score."
          : "Extend the Housing cluster because the conversion window is closing.";
      }
      if (noTravel && tile.category === "travel") score -= 1000;
      if (noFarmstead && tile.id === "c04_farmstead") score -= 1000;
      if (!player.hasPlacedFirstTile && tileCostTotal(tile.id) === 0) score += 80;
    } else {
      score += tile.population + tile.renown + 28;
      if (plan?.needsSupportBeforeHousing && /supported|remove .*strain|resolve 1 active burden/i.test(tile.effectText)) {
        score += 28;
        reasonCode = "PROTECT_AGAINST_FORECAST_BURDEN";
        reason = "Place a Special Tile that directly answers the forecast Burden and Strain risk.";
      }
      if (plan?.targetSpecialTileIds.includes(tile.id)) score += 38;
      if (plan?.targetSpecialTileIds.includes(tile.id)) {
        reasonCode = "SETUP_FOR_SEEDED_ARRIVAL";
        reason = `Place the Special Tile unlocked for this Season's planned Arrival.`;
      }
    }
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
      if (["crafting", "merchant", "social", "wellbeing"].includes(tile.category) && adjacentCategories.includes("housing")) geometryScore += 11;
      if (tile.kind === "special" && adjacentCategories.includes("housing")) geometryScore += 8;
      if (plan?.needsCrafting && tile.category === "crafting" && adjacentCategories.includes("travel")) geometryScore += 18;
      if (plan?.needsMerchant && tile.category === "merchant" && adjacentCategories.includes("travel")) geometryScore += 18;
      if (plan && tile.category === "travel" && missingProductionTerrains.size > 0 && placementHexIds.some((hexId) =>
        getHexNeighbors(hexId).some((neighbor) => missingProductionTerrains.has(mapById[neighbor]?.terrain))
      )) geometryScore += 24;
      if (plan?.needsSupportBeforeHousing && /supported/i.test(tile.kind === "special" ? tile.effectText : tile.basic.effectText)) {
        geometryScore += adjacentCategories.includes("housing") ? 20 : adjacentTiles.length * 3;
      }
      if (adjacentTiles.some((placed) => placed.tileId.startsWith("golden_tile_"))) geometryScore += 9;
      if (targets.some((id) => ["LE-005", "LE-006"].includes(id))) {
        geometryScore += placementHexIds.reduce(
          (total, hexId) => total + getHexNeighbors(hexId).filter((neighbor) => occupied.has(neighbor)).length * 3,
          0,
        );
      }
      if (targets.some((id) => ["LE-010", "LE-011", "LE-032"].includes(id)) && tile.id === "c19_bridge") geometryScore += 80;
      if (targets.includes("LE-012") && placementHexIds.some((hexId) => getHexNeighbors(hexId).some((neighbor) => mapById[neighbor]?.terrain === "water"))) geometryScore += 22;
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
  return best ?? null;
}

function chooseUpgrade(
  state: GameState,
  playerId: string,
  targets: string[],
  plan?: HumanSeasonPlan,
): { instanceId: string; score: number; reasonCode: string; reason: string } | null {
  if (targets.includes("LE-028")) return null;
  const targetBoost = targets.some((id) => ["LE-021","LE-022","LE-034"].includes(id)) ? 30 : 0;
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
    const score =
      targetBoost +
      scoringGain * (plan && isHousing && plan.housingPush ? 2.5 : 1) +
      productionGain * 2 -
      scarcityCost +
      plannedResourceGain * (state.season === 1 ? 2 : 0.8);
    return {
      instanceId,
      score,
      reasonCode: isHousing ? "HIGH_VALUE_UPGRADE" : tile.category === "resource" ? "EARLY_RESOURCE_DEFICIT" : "HIGH_VALUE_UPGRADE",
      reason: isHousing
        ? "Convert an established Housing tile into immediate score during the planned expansion window."
        : tile.category === "resource"
          ? "Upgrade production early because forecast demand will repay it over remaining activations."
          : "Take a positive-value upgrade with useful remaining-season payoff.",
    };
  }).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function chooseActivation(
  state: GameState,
  playerId: string,
  plan?: HumanSeasonPlan,
): { instanceId: string; score: number; reasonCode: string; reason: string } | null {
  const candidates = getActivatableTileIds(state, playerId).map((instanceId) => {
    const placed = state.map.placedTiles.find((tile) => tile.instanceId === instanceId)!;
    const side = placed.kind === "special"
      ? specialTileById[placed.tileId]
      : placed.side === "upgraded"
        ? coreTileById[placed.tileId].upgraded
        : coreTileById[placed.tileId].basic;
    const effectText = side.effectText;
    const lower = effectText.toLowerCase();
    const production = "production" in side ? side.production : undefined;
    const productionNeed = production
      ? (Object.entries(production) as Array<[ResourceType, number]>).reduce(
          (score, [resource, amount]) => score + amount * (plan ? resourceDemandDeficit(state, plan, resource) : Math.max(0, 15 - state.warehouse[resource])),
          0,
        )
      : 0;
    let score = "effectType" in side && side.effectType === "production" ? productionNeed : -1;
    let reasonCode = "EARLY_RESOURCE_DEFICIT";
    let reason = "Activate production that fills a current or forecast resource deficit.";
    if (/timer token/.test(lower)) {
      const timerSpace = state.encounters.activeArrivals.reduce(
        (total, arrival) => total + Math.max(0, 3 - arrival.timerTokens),
        0,
      );
      if (timerSpace > 0) score = Math.max(score, 18 + timerSpace * 2);
      reasonCode = "SETUP_FOR_SEEDED_ARRIVAL";
      reason = "Preserve a valuable active Arrival until its planned requirement can be met.";
    }
    if (/remove .*strain/.test(lower)) {
      const targets = getValidEffectStrainTargets(state, effectText, placed);
      const removable = targets.reduce((total, tile) => total + tile.strain, 0);
      if (removable > 0) score = Math.max(score, 16 + removable * 5);
      reasonCode = "PROTECT_AGAINST_FORECAST_BURDEN";
      reason = "Remove Strain before it erases score or disables an engine tile.";
    }
    if (/resolve 1 active burden/.test(lower) && state.encounters.activeBurdens.length > 0) {
      score = Math.max(score, 35 + state.encounters.activeBurdens.length * 4);
      reasonCode = "BURDEN_CLEAR_BEATS_PENALTY";
      reason = "Use a tile ability because clearing the Burden beats its damage and final penalty.";
    }
    if (/exchange up to/.test(lower)) {
      const amounts = Object.values(state.warehouse);
      const imbalance = Math.max(...amounts) - Math.min(...amounts);
      if (imbalance >= 4) score = Math.max(score, 10 + imbalance);
      reasonCode = "MERCHANT_CONVERSION_ENGINE";
      reason = "Convert surplus resources into the forecast deficit rather than merely tidy the Warehouse.";
    }
    if (/gain supported|gains supported/.test(lower)) {
      const supportTargets = getEffectSupportTargets(state, effectText, placed);
      if (supportTargets.length > 0) score = Math.max(score, 12 + supportTargets.length * 3);
      reasonCode = "SUPPORT_BEFORE_HOUSING";
      reason = "Add protection to valuable district tiles before forecast Strain arrives.";
    }
    return { instanceId, score, reasonCode, reason };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

function recordTileActivation(state: GameState, instanceId: string, stats: BotStats): void {
  if (state.map.placedTiles.some((tile) => tile.instanceId === instanceId)) {
    stats.tileActivationCountsByInstance[instanceId] =
      (stats.tileActivationCountsByInstance[instanceId] ?? 0) + 1;
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
      const boonId = getUsableFaceUpBoonIds(state)[0];
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
    const wantsArrivals = targets.some((id) => ["LE-013","LE-014","LE-015","LE-016","LE-029","LE-050"].includes(id));
    if (arrivalId && (wantsArrivals || profile !== "passive_normal" || random() < 0.55)) {
      const beforeActions = state.actionsRemaining;
      state = drainPending(completeArrival(state, arrivalId, emptySelection), stats);
      if (state.actionsRemaining < beforeActions) {
        stats.encounterInteractActions += 1;
        continue;
      }
    }

    const burdenId = getResolvableBurdenIds(state)[0];
    const wantsBurdens = targets.some((id) => ["LE-004","LE-017","LE-036","LE-040","LE-041","LE-043"].includes(id));
    if (burdenId && (wantsBurdens || state.encounters.activeBurdens.length >= state.playerCount || random() < 0.35)) {
      const beforeActions = state.actionsRemaining;
      state = drainPending(resolveBurden(state, burdenId, emptySelection), stats);
      if (state.actionsRemaining < beforeActions) {
        stats.encounterInteractActions += 1;
        stats.burdensResolved += 1;
        stats.resolvedBurdenIds.push(burdenId);
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
        recordTileActivation(before, earlyActivation.instanceId, stats);
        continue;
      }
    }

    const earlyUpgrade = chooseUpgrade(state, playerId, targets);
    if (lowResource && earlyUpgrade) {
      const placed = state.map.placedTiles.find((tile) => tile.instanceId === earlyUpgrade.instanceId);
      if (placed?.kind === "core" && coreTileById[placed.tileId].category === "resource") {
        const beforeActions = state.actionsRemaining;
        state = drainPending(upgradeTile(state, playerId, earlyUpgrade.instanceId, emptySelection), stats);
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
      state = drainPending(placeTile(state, playerId, placement.tileId, placement.placement, emptySelection), stats);
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
        recordTileActivation(before, activation.instanceId, stats);
        continue;
      }
    }

    const upgrade = chooseUpgrade(state, playerId, targets);
    if (upgrade) {
      const beforeActions = state.actionsRemaining;
      state = drainPending(upgradeTile(state, playerId, upgrade.instanceId, emptySelection), stats);
      if (state.actionsRemaining <= beforeActions && state.map.placedTiles.find((tile) => tile.instanceId === upgrade.instanceId)?.side === "upgraded") {
        stats.upgradeActions += beforeActions - state.actionsRemaining;
        continue;
      }
    }

    if (placementWorthwhile) {
      const beforeActions = state.actionsRemaining;
      const beforeTileCount = state.map.placedTiles.length;
      state = drainPending(placeTile(state, playerId, placement.tileId, placement.placement, emptySelection), stats);
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
        recordTileActivation(before, activation.instanceId, stats);
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

function recordHumanAction(
  state: GameState,
  candidate: HumanActionCandidate,
  rejected: HumanActionCandidate | undefined,
  stats: BotStats,
): void {
  stats.actionReasons.push({
    round: state.round,
    season: state.season,
    playerId: state.currentPlayerId,
    actionType: candidate.kind,
    target: candidate.target,
    projectedValue: Number(candidate.score.toFixed(1)),
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
      return sum + (tile ? tile.population + tile.renown + (/burden|strain|supported/i.test(tile.effectText) ? 5 : 2) : 0);
    }, 0);
    const planBoost = cardPlanPriority(plan, cardId);
    const active = state.encounters.activeArrivals.find((arrival) => arrival.cardId === cardId);
    const urgency = active ? Math.max(0, 4 - active.timerTokens) * 4 : 0;
    const latePenalty = state.season === 3 ? Math.max(0, 4 - remainingRounds) * 4 : 0;
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
  const candidates = getResolvableBurdenIds(state).map((cardId) => {
    const intent = buildCardIntent(state, cardId);
    const cost = Object.values(intent.requiredResources).reduce((sum, value) => sum + (value ?? 0), 0);
    const planBoost = cardPlanPriority(plan, cardId);
    const endgame = state.round >= 10 ? 12 : 0;
    const crowding = Math.max(0, state.encounters.activeBurdens.length - 1) * 5;
    const synergy = hasRestingHall ? 8 : 0;
    const score = 7 + planBoost + endgame + crowding + synergy + (ledgerPressure ? 3 : 0) - cost * 0.7;
    return {
      kind: "burden" as const,
      target: cardId,
      score,
      reasonCode: "BURDEN_CLEAR_BEATS_PENALTY",
      reason: hasRestingHall
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
    const lower = encounterById[cardId] && encounterById[cardId].type === "boon"
      ? encounterById[cardId].effects[state.season === 1 ? "season1" : state.season === 2 ? "season2" : "season3"].toLowerCase()
      : "";
    if (lower.includes("timer token") && !state.encounters.activeArrivals.some((arrival) => arrival.timerTokens < 3)) useful -= 20;
    if (lower.includes("arrival completed") && getCompletableArrivalIds(state).length === 0) useful -= 10;
    if (lower.includes("burden resolved") && getResolvableBurdenIds(state).length === 0) useful -= 10;
    if (lower.includes("upgrade") && getUpgradeableTileIds(state, state.currentPlayerId).length === 0) useful -= 8;
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
    const missingForecastProduction = (Object.keys(plan.expectedResourceDemand) as ResourceType[]).some(
      (resource) => resourceDemandDeficit(state, plan, resource) >= 4 && !produced.has(resource),
    );
    if (plan.targetSpecialTileIds.length > 0 || missingForecastProduction) {
      score = missingForecastProduction ? 23 : 17;
      reasonCode = missingForecastProduction ? "EARLY_RESOURCE_DEFICIT" : "STEWARD_OBJECTIVE_PROGRESS";
      reason = missingForecastProduction
        ? "Use Ranger to reach terrain for a missing forecast production type."
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

function playHumanLikeTurn(
  initial: GameState,
  targets: string[],
  random: () => number,
  stats: BotStats,
  plan: HumanSeasonPlan,
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
    const arrival = humanArrivalCandidate(state, plan);
    const burden = humanBurdenCandidate(state, plan);
    const boon = !boonUsed ? humanBoonCandidate(state, plan) : null;
    const power = !powerUsed ? humanPowerCandidate(state, playerId, plan) : null;
    const freeChoice = [boon, power].filter(Boolean).sort((a, b) => b!.score - a!.score)[0];
    if (freeChoice) {
      candidates.push(freeChoice);
    } else {
      if (arrival) candidates.push(arrival);
      if (burden) candidates.push(burden);
      const urgentEncounter = [arrival, burden].filter(Boolean).some((candidate) => candidate!.score >= 34);
      if (!urgentEncounter) {
        const placement = findPlacement(state, playerId, targets, random, plan);
        const activation = chooseActivation(state, playerId, plan);
        const upgrade = chooseUpgrade(state, playerId, targets, plan);
        if (placement && placement.score > 4) {
          let lookahead = 0;
          const category = coreTileById[placement.tileId]?.category ?? specialTileById[placement.tileId]?.category;
          if (category === "resource") lookahead += 8;
          if (category === "travel" && (plan.needsCrafting || plan.needsMerchant)) lookahead += 7;
          if (category === "crafting" || category === "merchant") lookahead += state.season <= 2 ? 8 : 1;
          if (/supported/i.test(coreTileById[placement.tileId]?.basic.effectText ?? specialTileById[placement.tileId]?.effectText ?? "") && plan.housingPush) lookahead += 7;
          candidates.push({
            kind: "place",
            target: placement.tileId,
            placement: placement.placement,
            score: placement.score * 0.55 + lookahead,
            reasonCode: placement.reasonCode,
            reason: `${placement.reason} Short lookahead adds ${lookahead} for the likely follow-up action.`,
          });
        }
        if (activation) candidates.push({ kind: "activate", target: activation.instanceId, score: activation.score, reasonCode: activation.reasonCode, reason: activation.reason });
        if (upgrade && upgrade.score > 2) candidates.push({ kind: "upgrade", target: upgrade.instanceId, score: upgrade.score * 1.15, reasonCode: upgrade.reasonCode, reason: upgrade.reason });
      }
    }

    const ranked = candidates
      .filter((candidate) => !failed.has(`${candidate.kind}:${candidate.target}`))
      .sort((a, b) => b.score - a.score);
    let selected = ranked[0];
    let rejected = ranked[1];
    if (!selected) break;
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
      state = drainPending(completeArrival(state, selected.target, emptySelection), stats, plan);
      if (state.actionsRemaining < beforeActions) stats.encounterInteractActions += 1;
    } else if (selected.kind === "burden") {
      state = drainPending(resolveBurden(state, selected.target, emptySelection), stats, plan);
      if (state.actionsRemaining < beforeActions) {
        stats.encounterInteractActions += 1;
        stats.burdensResolved += 1;
        stats.resolvedBurdenIds.push(selected.target);
      }
    } else if (selected.kind === "place" && selected.placement !== undefined) {
      state = drainPending(placeTile(state, playerId, selected.target, selected.placement, emptySelection), stats, plan);
      if (state.map.placedTiles.length > beforeTiles) {
        stats.placeActions += beforeActions - state.actionsRemaining;
        if (beforeActions === state.actionsRemaining) stats.freePlaceEffectsUsed += 1;
      }
    } else if (selected.kind === "activate") {
      state = drainPending(activateTile(state, playerId, selected.target), stats, plan);
      if (state.actionsRemaining < beforeActions) {
        stats.activateActions += 1;
        recordTileActivation(before, selected.target, stats);
      }
    } else if (selected.kind === "upgrade") {
      state = drainPending(upgradeTile(state, playerId, selected.target, emptySelection), stats, plan);
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
      recordHumanAction(before, selected, rejected, stats);
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
): GameState {
  if (profile === "human_like" && plan) return playHumanLikeTurn(initial, targets, random, stats, plan);
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
      arrivals_expired: stats.arrivalsExpired,
      special_tiles_unlocked: completedSpecials.length,
      special_tiles_placed: specialCount,
      unlocked_special_tiles_unplaced: completedSpecials.filter((id) => !placedSpecialIds.includes(id)).length,
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
      burdens_left_active: state.encounters.activeBurdens.length,
      seeded_cards_seen: stats.strategyPlans.flatMap((plan) => plan.forecasts).filter((forecast) =>
        state.encounters.discardPile.includes(forecast.cardId) ||
        state.encounters.activeBurdens.includes(forecast.cardId) ||
        state.encounters.activeArrivals.some((arrival) => arrival.cardId === forecast.cardId) ||
        state.encounters.completedArrivals.some((arrival) => arrival.cardId === forecast.cardId)
      ).length,
      seeded_cards_exploited: stats.strategyPlans.flatMap((plan) => plan.forecasts).filter((forecast) =>
        state.encounters.completedArrivals.some((arrival) => arrival.cardId === forecast.cardId) ||
        stats.usedBoonIds.includes(forecast.cardId) ||
        stats.resolvedBurdenIds.includes(forecast.cardId)
      ).length,
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
  const requiredByEntry: Record<string, string> = { "LE-032": "vanguard", "LE-033": "knight", "LE-034": "sentinel", "LE-035": "ranger", "LE-036": "warden", "LE-037": "quartermaster" };
  const required = targets.map((id) => requiredByEntry[id]).filter(Boolean);
  const usedNames = new Set(campaignState.chosen_stewards ?? []);
  const rotate = targets.some((id) => ["LE-031","LE-038"].includes(id));
  const pool = rotate
    ? [...stewards.filter((steward) => !usedNames.has(steward.name)), ...stewards.filter((steward) => usedNames.has(steward.name))]
    : shuffled(random, stewards);
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
    strainPrevented: 0,
    strainRemoved: 0,
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
  const stewardIds = chooseStewardIds(input.playerCount, input.targets, input.campaignState, random);
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
    if (stats.errors.length) break;
    if (state.phase === "seeding") {
      const playerId = state.currentPlayerId;
      if (input.profile === "human_like") {
        const seasonHands = humanPlanning.handsBySeason[state.season] ?? {};
        seasonHands[playerId] = [...(state.encounters.handsByPlayerId[playerId] ?? [])];
        humanPlanning.handsBySeason[state.season] = seasonHands;
        const plannedSeed = chooseHumanLikeSeed(state, playerId);
        const existingForecasts = humanPlanning.forecastsBySeason[state.season] ?? [];
        const forecasts = [...existingForecasts, ...plannedSeed.forecasts];
        humanPlanning.forecastsBySeason[state.season] = forecasts;
        state = commitSeasonSeeding(state, playerId, plannedSeed.selection);
        const plan = buildHumanSeasonPlan(state, forecasts, seasonHands);
        humanPlanning.plansBySeason[state.season] = plan;
        stats.strategyPlans = [...stats.strategyPlans.filter((candidate) => candidate.season !== state.season), plan];
      } else {
        const selection = chooseSeed(state, playerId, input.profile, random);
        state = commitSeasonSeeding(state, playerId, selection);
      }
      continue;
    }
    if (state.phase === "reveal") {
      const plan = input.profile === "human_like" ? humanPlanning.plansBySeason[state.season] : undefined;
      state = drainPending(revealEncounters(state), stats, plan);
      continue;
    }
    if (state.phase === "turns") {
      const plan = input.profile === "human_like"
        ? humanPlanning.plansBySeason[state.season] ?? buildHumanSeasonPlan(
          state,
          humanPlanning.forecastsBySeason[state.season] ?? [],
          humanPlanning.handsBySeason[state.season] ?? {},
        )
        : undefined;
      state = playTurn(state, input.targets, input.profile, random, stats, plan);
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

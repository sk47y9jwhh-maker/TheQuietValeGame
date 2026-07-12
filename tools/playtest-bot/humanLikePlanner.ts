import { encounterById } from "../../src/data/encounters";
import {
  cardEffectRuleId,
  tileEffectRuleId,
} from "../../src/data/effectRules";
import {
  arrivalRequirementRules,
  getBurdenResolutionCost,
} from "../../src/data/contentRules";
import { coreTileById, coreTiles, specialTileById, specialTiles } from "../../src/data/tiles";
import {
  effectRuleTargetsCategory,
  getEffectSemanticTags,
  hasStructuredEffectRule,
  type EffectSemanticTag,
} from "../../src/engine/effectSemantics";
import type {
  EncounterData,
  GameState,
  ResourceType,
  Season,
  TileCategory,
} from "../../src/engine/types";

export type PlanningWindow = "early" | "middle" | "late";

export interface CardIntent {
  cardId: string;
  cardName: string;
  type: EncounterData["type"];
  seasonValue: number;
  urgency: number;
  requiredResources: Partial<Record<ResourceType, number>>;
  requiredTileCategories: TileCategory[];
  rewardTileIds: string[];
  rewardTags: string[];
  threatTags: string[];
  opportunityTags: string[];
  bestRevealWindow: PlanningWindow;
  readiness: number;
  setupNeed: number;
  reason: string;
}

export interface ForecastCard {
  playerId: string;
  cardId: string;
  cardName: string;
  expectedWindow: PlanningWindow;
  confidence: number;
  reasonSeeded: string;
}

export interface HumanSeedPriorities {
  minimumBurdens?: number;
  maximumBurdens?: number;
  preferEarlyBurden?: boolean;
  preferredBurdenWindow?: PlanningWindow;
  burdenReason?: string;
}

export type ResourceDemandReasonCode =
  | "RESOURCE_FOR_PLANNED_UPGRADE"
  | "RESOURCE_FOR_SEEDED_ARRIVAL"
  | "RESOURCE_FOR_BURDEN_PAYMENT"
  | "RESOURCE_FOR_HOUSING_CLUSTER"
  | "RESOURCE_FOR_FINAL_SCORE_TILE"
  | "RESOURCE_FLOATING_NO_SPEND_TARGET";

export interface SeasonPlanCardSummary {
  cardId: string;
  cardName: string;
  type: EncounterData["type"];
}

export interface SeasonPlanHandSummary {
  playerId: string;
  totalCards: number;
  cards: SeasonPlanCardSummary[];
  countsByType: Partial<Record<EncounterData["type"], number>>;
}

export interface SeasonPlanSeededCards {
  playerId: string;
  top?: SeasonPlanCardSummary & { reason: string };
  middle?: SeasonPlanCardSummary & { reason: string };
  bottom?: SeasonPlanCardSummary & { reason: string };
}

export interface SeasonPlanExpectation {
  cardId: string;
  cardName: string;
  type: EncounterData["type"];
  expectedWindow: PlanningWindow;
  tags: string[];
  response: string;
}

export interface SeasonPlanResourceNeed {
  resource: ResourceType;
  current: number;
  planned: number;
  shortfall: number;
  drivers: string[];
}

export interface SeasonPlanFoundationStep {
  category: TileCategory;
  reason: string;
}

export interface ResourceDemandDecision {
  reasonCode: ResourceDemandReasonCode;
  targetId?: string;
  targetName?: string;
  resourceGaps: Partial<Record<ResourceType, number>>;
  reason: string;
}

export interface HumanSeasonPlan {
  season: Season;
  createdAtRound: number;
  targetEntryIds: string[];
  strategicThesis: string;
  hiddenHandSummary: SeasonPlanHandSummary[];
  seededCards: SeasonPlanSeededCards[];
  expectedThreats: SeasonPlanExpectation[];
  expectedOpportunities: SeasonPlanExpectation[];
  resourceNeeds: SeasonPlanResourceNeed[];
  intendedTileFoundation: SeasonPlanFoundationStep[];
  openingLineReason: string;
  logLines: string[];
  forecasts: ForecastCard[];
  handCardsByPlayer: Record<string, string[]>;
  expectedResourceDemand: Partial<Record<ResourceType, number>>;
  targetTileCategories: TileCategory[];
  targetSpecialTileIds: string[];
  targetFoundationTileIds: string[];
  highPriorityArrivalIds: string[];
  highPriorityBoonIds: string[];
  highRiskBurdenIds: string[];
  needsTravelAnchor: boolean;
  needsCrafting: boolean;
  needsMerchant: boolean;
  needsSupportBeforeHousing: boolean;
  housingPush: boolean;
  actionPriorities: string[];
  abandonRules: string[];
}

export interface HumanPlanningContext {
  forecastsBySeason: Partial<Record<Season, ForecastCard[]>>;
  plansBySeason: Partial<Record<Season, HumanSeasonPlan>>;
  handsBySeason: Partial<Record<Season, Record<string, string[]>>>;
}

const resources: ResourceType[] = ["wood", "stone", "metal", "food", "herbs", "goods"];

function cardRuleId(card: EncounterData, season: Season): string | undefined {
  return card.type === "boon" || card.type === "burden"
    ? cardEffectRuleId(card.id, season)
    : undefined;
}

function resourceReadiness(state: GameState, demand: Partial<Record<ResourceType, number>>): number {
  const total = resources.reduce((sum, resource) => sum + (demand[resource] ?? 0), 0);
  if (total === 0) return 1;
  const ready = resources.reduce(
    (sum, resource) => sum + Math.min(demand[resource] ?? 0, state.warehouse[resource]),
    0,
  );
  return ready / total;
}

function boardCategories(state: GameState): Set<TileCategory> {
  return new Set(state.map.placedTiles.map((tile) =>
    tile.kind === "special" ? specialTileById[tile.tileId].category : coreTileById[tile.tileId].category
  ));
}

function boardCategoryCount(state: GameState, category: TileCategory): number {
  return state.map.placedTiles.filter((tile) =>
    tile.kind === "special"
      ? specialTileById[tile.tileId].category === category
      : coreTileById[tile.tileId].category === category
  ).length;
}

function threatTags(ruleId: string | undefined): string[] {
  if (!ruleId) return [];
  const semantics = getEffectSemanticTags(ruleId);
  const tags: string[] = [];
  if (semantics.includes("strain")) tags.push("strain");
  if (effectRuleTargetsCategory(ruleId, "housing")) tags.push("strain_housing");
  if (effectRuleTargetsCategory(ruleId, "resource")) tags.push("strain_resource");
  if (semantics.includes("arrival_time")) tags.push("arrival_pressure");
  if (semantics.includes("resource_loss")) tags.push("resource_loss");
  if (semantics.includes("adjacency_punish")) tags.push("adjacency_punish");
  return tags;
}

function requiredCategories(card: EncounterData, season: Season): TileCategory[] {
  const categories = new Set<TileCategory>();
  if (card.type === "arrival") {
    if (arrivalRequirementRules[card.id]?.requiresHousing) categories.add("housing");
    for (const tileId of card.rewardSpecialTileIds) {
      for (const category of specialTileById[tileId]?.placement?.adjacentToCategory ?? []) {
        categories.add(category);
      }
    }
  } else {
    const ruleId = cardRuleId(card, season);
    if (ruleId) {
      for (const category of ["resource", "housing", "crafting", "merchant", "social", "wellbeing", "travel"] as TileCategory[]) {
        if (effectRuleTargetsCategory(ruleId, category)) categories.add(category);
      }
    }
  }
  return [...categories];
}

function rewardValue(card: EncounterData): { tileIds: string[]; tags: string[]; value: number } {
  if (card.type !== "arrival") return { tileIds: [], tags: [], value: 0 };
  const tileIds = card.rewardSpecialTileIds;
  const tiles = tileIds.map((id) => specialTileById[id]).filter(Boolean);
  return {
    tileIds,
    tags: [...new Set(tiles.flatMap((tile) => {
      const ruleId = tileEffectRuleId(tile.id, "special");
      return hasStructuredEffectRule(ruleId) ? getEffectSemanticTags(ruleId) : [];
    }))],
    value: tiles.reduce((sum, tile) => sum + tile.population + tile.renown, 0),
  };
}

export function buildCardIntent(state: GameState, cardId: string): CardIntent {
  const card = encounterById[cardId];
  if (!card) throw new Error(`Unknown Encounter card ${cardId}`);
  const ruleId = cardRuleId(card, state.season);
  const demand: Partial<Record<ResourceType, number>> = card.type === "arrival"
    ? arrivalRequirementRules[card.id]?.cost ?? {}
    : card.type === "burden"
      ? Object.fromEntries(
          Object.entries(getBurdenResolutionCost(card.id, state.season) ?? {})
            .filter(([, amount]) => amount > 0)
        )
      : {};
  const readiness = resourceReadiness(state, demand);
  const reward = rewardValue(card);
  const categories = boardCategories(state);
  const neededCategories = requiredCategories(card, state.season);
  const missingCategories = neededCategories.filter((category) => !categories.has(category)).length;
  const totalDemand = resources.reduce((sum, resource) => sum + (demand[resource] ?? 0), 0);
  const opportunities: EffectSemanticTag[] = ruleId ? getEffectSemanticTags(ruleId) : [];
  const threats = card.type === "burden" ? threatTags(ruleId) : [];
  const boardReadyForOpportunity = opportunities.some((tag) => {
    if (tag === "housing_value") return categories.has("housing");
    if (tag === "travel_value") return categories.has("travel");
    if (tag === "merchant_value") return categories.has("merchant");
    if (tag === "crafting_value" || tag === "upgrade_value") return categories.has("crafting");
    return false;
  });

  let seasonValue = 5;
  let urgency = 3;
  let window: PlanningWindow = "middle";
  let reason = "Needs some preparation before it is most useful.";
  if (card.type === "arrival") {
    const engineBonus = reward.tags.length * 2;
    seasonValue = reward.value + engineBonus - totalDemand * 0.45;
    urgency = state.season === 3 ? 8 : reward.tags.includes("burden_control") || reward.tags.includes("support") ? 7 : 5;
    if (readiness >= 0.8 && missingCategories === 0) {
      window = "early";
      reason = "The settlement is already close to its requirement and can use the reward tile.";
    } else if (readiness < 0.45 || missingCategories > 0 || state.season === 3 && seasonValue < 8) {
      window = "late";
      reason = "Its requirement or reward placement needs substantial setup.";
    }
  } else if (card.type === "boon" || card.type === "goldenBoon") {
    seasonValue = 6 + opportunities.length * 2 + (boardReadyForOpportunity ? 4 : 0);
    urgency = boardReadyForOpportunity ? 7 : 3;
    window = boardReadyForOpportunity ? "early" : opportunities.includes("housing_value") && state.season < 3 ? "late" : "middle";
    reason = boardReadyForOpportunity
      ? "The current board can exploit this Boon immediately."
      : "Delay until its matching district or action is ready.";
  } else {
    const risk = threats.length * 2 + (threats.includes("strain_housing") && categories.has("housing") ? 4 : 0);
    const manageable = readiness >= 0.8 || state.players.some((player) => player.stewardId === "warden");
    seasonValue = -risk;
    urgency = risk + (state.season === 3 ? 3 : 0);
    window = manageable ? "early" : "late";
    reason = manageable
      ? "Reveal while its resolution is affordable or Warden protection is available."
      : "Delay until the settlement has protection or spare resolution resources.";
  }

  return {
    cardId,
    cardName: card.name,
    type: card.type,
    seasonValue,
    urgency,
    requiredResources: demand,
    requiredTileCategories: neededCategories,
    rewardTileIds: reward.tileIds,
    rewardTags: reward.tags,
    threatTags: threats,
    opportunityTags: opportunities,
    bestRevealWindow: window,
    readiness,
    setupNeed: (1 - readiness) * Math.max(1, totalDemand) + missingCategories * 3,
    reason,
  };
}

const windowConfidence: Record<PlanningWindow, number> = { early: 0.95, middle: 0.72, late: 0.55 };

function placementFit(intent: CardIntent, window: PlanningWindow): number {
  const distance = Math.abs(["early", "middle", "late"].indexOf(intent.bestRevealWindow) - ["early", "middle", "late"].indexOf(window));
  let score = -distance * 5;
  if (intent.type === "arrival") {
    score += intent.seasonValue * (window === "late" ? 0.35 : 0.6);
    score -= intent.setupNeed * (window === "early" ? 1.4 : window === "middle" ? 0.6 : 0.2);
  } else if (intent.type === "burden") {
    score += intent.bestRevealWindow === window ? 8 : 0;
    score += window === "late" ? intent.urgency * 0.25 : -intent.urgency * 0.25;
  } else {
    score += intent.seasonValue * (window === "early" ? 0.8 : window === "middle" ? 0.55 : 0.35);
  }
  return score;
}

export function chooseHumanLikeSeed(
  state: GameState,
  playerId: string,
  priorities: HumanSeedPriorities = {},
): { selection: { top: string; middle: string; bottom: string }; forecasts: ForecastCard[] } {
  const hand = state.encounters.handsByPlayerId[playerId] ?? [];
  if (hand.length < 3) throw new Error(`Expected at least 3 Encounter cards for ${playerId}, found ${hand.length}`);
  const intents = hand.map((cardId) => buildCardIntent(state, cardId));
  const permutations: number[][] = [];
  for (let top = 0; top < intents.length; top += 1) {
    for (let middle = 0; middle < intents.length; middle += 1) {
      if (middle === top) continue;
      for (let bottom = 0; bottom < intents.length; bottom += 1) {
        if (bottom === top || bottom === middle) continue;
        permutations.push([top, middle, bottom]);
      }
    }
  }
  const windows: PlanningWindow[] = ["early", "middle", "late"];
  const minimumBurdens = Math.max(0, Math.min(3, priorities.minimumBurdens ?? 0));
  const maximumBurdens = Math.max(
    minimumBurdens,
    Math.min(3, priorities.maximumBurdens ?? 3),
  );
  const targetAwarePermutations = permutations.filter((order) => {
    const burdenCount = order.filter(
      (intentIndex) => intents[intentIndex].type === "burden",
    ).length;
    return burdenCount >= minimumBurdens && burdenCount <= maximumBurdens;
  });
  const candidatePermutations = targetAwarePermutations.length > 0
    ? targetAwarePermutations
    : permutations;
  const preferredBurdenWindow = priorities.preferredBurdenWindow ??
    (priorities.preferEarlyBurden ? "early" : undefined);
  const best = candidatePermutations.map((order) => ({
    order,
    score: order.reduce(
      (sum, intentIndex, windowIndex) =>
        sum +
        placementFit(intents[intentIndex], windows[windowIndex]) +
        (preferredBurdenWindow === windows[windowIndex] && intents[intentIndex].type === "burden" ? 30 : 0),
      0,
    ),
  })).sort((a, b) => b.score - a.score)[0];
  const ordered = best.order.map((index) => intents[index]);
  return {
    selection: { top: ordered[0].cardId, middle: ordered[1].cardId, bottom: ordered[2].cardId },
    forecasts: ordered.map((intent, index) => ({
      playerId,
      cardId: intent.cardId,
      cardName: intent.cardName,
      expectedWindow: windows[index],
      confidence: windowConfidence[windows[index]],
      reasonSeeded: intent.type === "burden" && priorities.burdenReason
        ? priorities.burdenReason
        : intent.reason,
    })),
  };
}

function addDemand(
  target: Partial<Record<ResourceType, number>>,
  demand: Partial<Record<ResourceType, number>>,
  weight: number,
): void {
  for (const resource of resources) {
    target[resource] = (target[resource] ?? 0) + (demand[resource] ?? 0) * weight;
  }
}

function cardSummary(cardId: string): SeasonPlanCardSummary | undefined {
  const card = encounterById[cardId];
  return card ? { cardId, cardName: card.name, type: card.type } : undefined;
}

function humanPlanLogFields(
  state: GameState,
  forecasts: ForecastCard[],
  handCardsByPlayer: Record<string, string[]>,
  intents: Array<{ forecast: ForecastCard; intent: CardIntent }>,
  demand: Partial<Record<ResourceType, number>>,
  baselineDemand: Partial<Record<ResourceType, number>>,
  housingDemand: Partial<Record<ResourceType, number>>,
  foundation: SeasonPlanFoundationStep[],
  openingLineReason: string,
): Pick<HumanSeasonPlan,
  | "hiddenHandSummary"
  | "seededCards"
  | "expectedThreats"
  | "expectedOpportunities"
  | "resourceNeeds"
  | "intendedTileFoundation"
  | "openingLineReason"
  | "logLines"
> {
  const hiddenHandSummary = Object.entries(handCardsByPlayer).map(([playerId, cardIds]) => {
    const cards = cardIds.flatMap((cardId) => {
      const summary = cardSummary(cardId);
      return summary ? [summary] : [];
    });
    const countsByType = cards.reduce<SeasonPlanHandSummary["countsByType"]>((counts, card) => {
      counts[card.type] = (counts[card.type] ?? 0) + 1;
      return counts;
    }, {});
    return { playerId, totalCards: cards.length, cards, countsByType };
  });
  const seededCards = [...new Set(forecasts.map((forecast) => forecast.playerId))].map((playerId) => {
    const byWindow = new Map(
      forecasts
        .filter((forecast) => forecast.playerId === playerId)
        .map((forecast) => [forecast.expectedWindow, forecast] as const),
    );
    const seeded = (window: PlanningWindow) => {
      const forecast = byWindow.get(window);
      if (!forecast) return undefined;
      const summary = cardSummary(forecast.cardId);
      return summary ? { ...summary, reason: forecast.reasonSeeded } : undefined;
    };
    return {
      playerId,
      top: seeded("early"),
      middle: seeded("middle"),
      bottom: seeded("late"),
    };
  });
  const expectedThreats = intents
    .filter(({ intent }) => intent.type === "burden")
    .map(({ forecast, intent }) => ({
      cardId: intent.cardId,
      cardName: intent.cardName,
      type: intent.type,
      expectedWindow: forecast.expectedWindow,
      tags: intent.threatTags,
      response: intent.reason,
    }));
  const expectedOpportunities = intents
    .filter(({ intent }) => intent.type !== "burden")
    .map(({ forecast, intent }) => ({
      cardId: intent.cardId,
      cardName: intent.cardName,
      type: intent.type,
      expectedWindow: forecast.expectedWindow,
      tags: [...new Set([...intent.opportunityTags, ...intent.rewardTags])],
      response: intent.reason,
    }));
  const resourceNeeds = resources.map((resource) => {
    const drivers = intents.flatMap(({ intent }) => {
      const amount = intent.requiredResources[resource] ?? 0;
      if (amount <= 0) return [];
      return [`${intent.type === "arrival" ? "Seeded Arrival" : "Burden payment"}: ${intent.cardName} (${amount})`];
    });
    if ((housingDemand[resource] ?? 0) > 0) drivers.push(`Housing-cluster reserve (${housingDemand[resource]})`);
    if ((baselineDemand[resource] ?? 0) > 0) drivers.push(`Tile and upgrade reserve (${baselineDemand[resource]})`);
    const planned = Math.ceil(demand[resource] ?? 0);
    return {
      resource,
      current: state.warehouse[resource],
      planned,
      shortfall: Math.max(0, planned - state.warehouse[resource]),
      drivers,
    };
  });
  const typeLabel = (type: EncounterData["type"]) => type === "goldenBoon" ? "Golden Boon" : `${type[0].toUpperCase()}${type.slice(1)}`;
  const handLine = hiddenHandSummary.map((hand) => {
    const counts = Object.entries(hand.countsByType)
      .map(([type, count]) => `${count} ${typeLabel(type as EncounterData["type"])}${count === 1 ? "" : "s"}`)
      .join(", ");
    return `${hand.playerId}: ${hand.totalCards} cards (${counts || "empty"})`;
  }).join("; ");
  const seedLine = seededCards.flatMap((seed) => [
    seed.top ? `${seed.playerId} top ${seed.top.cardName}` : "",
    seed.middle ? `${seed.playerId} middle ${seed.middle.cardName}` : "",
    seed.bottom ? `${seed.playerId} bottom ${seed.bottom.cardName}` : "",
  ]).filter(Boolean).join("; ");
  const needLine = resourceNeeds
    .filter((need) => need.shortfall > 0)
    .map((need) => `${need.resource} ${need.current}/${need.planned}`)
    .join(", ") || "current Warehouse covers the forecast";
  return {
    hiddenHandSummary,
    seededCards,
    expectedThreats,
    expectedOpportunities,
    resourceNeeds,
    intendedTileFoundation: foundation,
    openingLineReason,
    logLines: [
      `Hidden hand summary — ${handLine || "no recorded hands"}.`,
      `Seeded top/middle/bottom — ${seedLine || "no cards seeded"}.`,
      `Expected threats — ${expectedThreats.map((item) => `${item.cardName} (${item.expectedWindow})`).join(", ") || "none"}.`,
      `Expected opportunities — ${expectedOpportunities.map((item) => `${item.cardName} (${item.expectedWindow})`).join(", ") || "none"}.`,
      `Resource needs — ${needLine}.`,
      `Intended tile foundation — ${foundation.map((step) => step.category).join(" → ") || "use the existing settlement"}.`,
      `Opening line — ${openingLineReason}`,
    ],
  };
}

export function buildHumanSeasonPlan(
  state: GameState,
  forecasts: ForecastCard[],
  handCardsByPlayer: Record<string, string[]> = {},
  targetEntryIds: string[] = [],
): HumanSeasonPlan {
  const intents = forecasts.map((forecast) => ({ forecast, intent: buildCardIntent(state, forecast.cardId) }));
  const demand: Partial<Record<ResourceType, number>> = {};
  for (const { forecast, intent } of intents) {
    if (intent.type === "arrival" || intent.type === "burden") addDemand(demand, intent.requiredResources, forecast.confidence);
  }
  const baselineDemand: Partial<Record<ResourceType, number>> = state.season === 1
    ? { wood: 2, stone: 2, metal: 2, food: 5, herbs: 1, goods: 2 }
    : state.season === 2
      ? { wood: 2, stone: 2, metal: 2, food: 4, herbs: 1, goods: 2 }
      : { wood: 1, stone: 1, metal: 1, food: 3, herbs: 1, goods: 2 };
  addDemand(demand, baselineDemand, 1);
  const arrivalIntents = intents.filter(({ intent }) => intent.type === "arrival");
  const boonIntents = intents.filter(({ intent }) => intent.type === "boon" || intent.type === "goldenBoon");
  const burdenIntents = intents.filter(({ intent }) => intent.type === "burden");
  const diverseDemand = resources.filter((resource) => (demand[resource] ?? 0) >= 1.5).length;
  const tags = new Set(intents.flatMap(({ intent }) => [...intent.rewardTags, ...intent.opportunityTags]));
  const highRisk = burdenIntents
    .filter(({ intent }) => intent.urgency >= 7 || intent.threatTags.includes("strain_housing"))
    .map(({ intent }) => intent.cardId);
  const needsSupport = highRisk.length > 0 || burdenIntents.some(({ intent }) => intent.threatTags.includes("strain"));
  const existingResourceTiles = boardCategoryCount(state, "resource");
  const existingHousingTiles = boardCategoryCount(state, "housing");
  const existingTravelTiles = boardCategoryCount(state, "travel");
  const existingCraftingTiles = boardCategoryCount(state, "crafting");
  const existingMerchantTiles = boardCategoryCount(state, "merchant");
  const targetSpecials = [...new Set([
    ...arrivalIntents.flatMap(({ intent }) => intent.rewardTileIds),
    ...specialTiles
      .filter((tile) => state.tileSupply.special[tile.id] > 0)
      .map((tile) => tile.id),
  ])];
  const targetFoundationTileIds = [...new Set(targetSpecials.flatMap((tileId) =>
    specialTileById[tileId]?.placement?.adjacentToTileIds ?? []
  ))];
  const rewardFoundationCategories = new Set<TileCategory>([
    ...arrivalIntents.flatMap(({ intent }) => intent.requiredTileCategories),
    ...targetFoundationTileIds.flatMap((tileId) => {
      const tile = coreTileById[tileId];
      return tile ? [tile.category] : [];
    }),
  ]);
  const needsCrafting = state.season < 3 && (
    tags.has("upgrade_value") ||
    rewardFoundationCategories.has("crafting") ||
    arrivalIntents.length >= 2 ||
    existingCraftingTiles === 0 && state.round <= 6
  );
  const needsMerchant = state.season < 3 && (
    diverseDemand >= 5 ||
    tags.has("merchant_value") ||
    rewardFoundationCategories.has("merchant") ||
    (demand.goods ?? 0) >= 5
  );
  const needsTravel =
    needsCrafting ||
    needsMerchant ||
    tags.has("travel_value") ||
    rewardFoundationCategories.has("travel") ||
    existingTravelTiles === 0 && state.round <= 5;
  const housingPush = state.season >= 2 || state.round >= 5 || existingHousingTiles >= 2 || arrivalIntents.some(({ intent }) => intent.requiredTileCategories.includes("housing"));
  const housingDemand: Partial<Record<ResourceType, number>> = housingPush
    ? state.season === 1
      ? { wood: 4, stone: 2, metal: 3, food: 12, goods: 1 }
      : state.season === 2
        ? { wood: 4, stone: 4, metal: 6, food: 20, goods: 2 }
        : { wood: 2, stone: 4, metal: 5, food: 18, goods: 2 }
    : {};
  if (housingPush) {
    addDemand(demand, housingDemand, 1);
  }
  const totalDemandGap = resources.reduce((sum, resource) => sum + Math.max(0, 5 + Math.ceil(demand[resource] ?? 0) - state.warehouse[resource]), 0);
  const targets = new Set<TileCategory>();
  if (state.season <= 2 || existingResourceTiles < 3 || totalDemandGap >= 18) targets.add("resource");
  if (needsTravel) targets.add("travel");
  if (needsCrafting) targets.add("crafting");
  if (needsMerchant) targets.add("merchant");
  if (needsSupport) targets.add("wellbeing");
  if (housingPush) targets.add("housing");
  // An Arrival only becomes score when its reward can enter the settlement.
  // Carry the reward's printed placement prerequisite into the Season
  // foundation instead of discovering it after the Arrival is completed.
  for (const category of rewardFoundationCategories) targets.add(category);
  if (state.round >= 8) {
    targets.add("housing");
    if (existingMerchantTiles === 0 && state.season < 3) targets.add("merchant");
    if (needsSupport) targets.add("wellbeing");
  }
  const priorityArrivals = arrivalIntents
    .filter(({ intent, forecast }) => intent.seasonValue >= 6 && (intent.readiness >= 0.45 || forecast.expectedWindow !== "early"))
    .sort((a, b) => b.intent.seasonValue - a.intent.seasonValue)
    .map(({ intent }) => intent.cardId);
  const priorityBoons = boonIntents
    .sort((a, b) => b.intent.seasonValue - a.intent.seasonValue)
    .map(({ intent }) => intent.cardId);
  const thesisParts = [
    `prepare ${resources.filter((resource) => (demand[resource] ?? 0) >= 1).join("/") || "a balanced Warehouse"}`,
    needsCrafting || needsMerchant ? `establish ${[needsCrafting ? "Crafting" : "", needsMerchant ? "Merchant" : ""].filter(Boolean).join(" and ")} infrastructure` : "avoid unnecessary infrastructure",
    needsSupport ? "protect the scoring district before major expansion" : "keep protection proportional to actual risk",
    housingPush ? "convert the prepared engine into clustered Housing" : "delay the main Housing conversion",
    state.round >= 8 ? "spend stockpiles into final score rather than further production" : "keep action tempo ahead of future card costs",
  ];
  const foundation: SeasonPlanFoundationStep[] = [...targets].map((category) => ({
    category,
    reason: category === "resource"
      ? "Cover named card, upgrade, and scoring-tile costs before adding more production."
      : category === "travel"
        ? "Keep the settlement reachable and connect the planned engine and scoring districts."
        : category === "crafting"
          ? "Reduce the repeated cost of the planned upgrade line."
          : category === "merchant"
            ? "Turn Goods and surpluses into the varied resources demanded by the seed."
            : category === "wellbeing"
              ? "Put Supported and Strain relief in place ahead of forecast Burdens."
              : category === "housing"
                ? "Convert the prepared economy into the main Population and final-score cluster."
                : "Add immediate settlement value where the seeded cards reward it.",
  }));
  const openingLineReason = state.round >= 9
    ? "Open with a legal score conversion or unresolved Encounter cleanup; production is justified only by a named remaining spend."
    : needsSupport
      ? "Open with protection or its enabling connection because the seeded Burden can damage the planned scoring district."
      : needsCrafting || needsMerchant
        ? `Open the shortest Resource → Travel → ${[needsCrafting ? "Crafting" : "", needsMerchant ? "Merchant" : ""].filter(Boolean).join("/")} line so later placements and card payments become cheaper.`
        : housingPush
          ? "Open by securing the nearest Housing cost, then place into a connected cluster while the scoring window remains long enough."
          : "Open with the cheapest production or connection that pays a named seeded-card cost this Season.";
  const logFields = humanPlanLogFields(
    state,
    forecasts,
    handCardsByPlayer,
    intents,
    demand,
    baselineDemand,
    housingDemand,
    foundation,
    openingLineReason,
  );
  const resourcePriorities = [
    ...(priorityArrivals.length > 0 ? ["RESOURCE_FOR_SEEDED_ARRIVAL"] : []),
    ...(burdenIntents.length > 0 ? ["RESOURCE_FOR_BURDEN_PAYMENT"] : []),
    ...(needsCrafting || existingCraftingTiles > 0 ? ["RESOURCE_FOR_PLANNED_UPGRADE"] : []),
    ...(housingPush ? ["RESOURCE_FOR_HOUSING_CLUSTER"] : []),
    ...(state.round >= 8 ? ["RESOURCE_FOR_FINAL_SCORE_TILE"] : []),
  ];
  return {
    season: state.season,
    createdAtRound: state.round,
    targetEntryIds: [...targetEntryIds],
    strategicThesis: thesisParts.join("; ") + ".",
    ...logFields,
    forecasts,
    handCardsByPlayer,
    expectedResourceDemand: demand,
    targetTileCategories: [...targets],
    targetSpecialTileIds: targetSpecials,
    targetFoundationTileIds,
    highPriorityArrivalIds: priorityArrivals,
    highPriorityBoonIds: priorityBoons,
    highRiskBurdenIds: highRisk,
    needsTravelAnchor: needsTravel,
    needsCrafting,
    needsMerchant,
    needsSupportBeforeHousing: needsSupport,
    housingPush,
    actionPriorities: [
      ...resourcePriorities,
      ...(needsTravel ? ["TRAVEL_ENABLES_PLAN"] : []),
      ...(needsCrafting ? ["CRAFTING_DISCOUNT_ENGINE"] : []),
      ...(needsMerchant ? ["MERCHANT_CONVERSION_ENGINE"] : []),
      ...(needsSupport ? ["SUPPORT_BEFORE_HOUSING"] : []),
      ...(housingPush ? ["HOUSING_CLUSTER_CONVERSION", "HIGH_VALUE_UPGRADE"] : []),
    ],
    abandonRules: [
      "Do not complete an Arrival if its reward cannot be placed or matter before game end.",
      "Do not add Travel unless it enables the plan, reachability, or scoring adjacency.",
      "Do not resolve a narrow Burden when its expected damage is cheaper than the resolution.",
    ],
  };
}

export function emptyHumanPlanningContext(): HumanPlanningContext {
  return { forecastsBySeason: {}, plansBySeason: {}, handsBySeason: {} };
}

export function resourceDemandDeficit(state: GameState, plan: HumanSeasonPlan | undefined, resource: ResourceType): number {
  if (!plan) return Math.max(0, 10 - state.warehouse[resource]);
  const cap = resource === "food" ? 24 : resource === "metal" ? 18 : 15;
  const desired = Math.min(cap, 5 + Math.ceil(plan.expectedResourceDemand[resource] ?? 0));
  return Math.max(0, desired - state.warehouse[resource]);
}

function costShortfall(
  state: GameState,
  cost: Partial<Record<ResourceType, number>>,
  multiplier = 1,
): Partial<Record<ResourceType, number>> {
  return Object.fromEntries(resources.flatMap((resource) => {
    const gap = Math.max(0, Math.ceil((cost[resource] ?? 0) * multiplier) - state.warehouse[resource]);
    return gap > 0 ? [[resource, gap]] : [];
  }));
}

function relevantShortfall(
  gaps: Partial<Record<ResourceType, number>>,
  producedResources: ResourceType[],
): number {
  const relevant = producedResources.length > 0 ? new Set(producedResources) : new Set(resources);
  return resources.reduce((total, resource) => total + (relevant.has(resource) ? gaps[resource] ?? 0 : 0), 0);
}

/**
 * Names the concrete spend that makes a production placement, production
 * upgrade, or production activation worthwhile. A floating result is
 * deliberately diagnostic: callers may still consider the action, but must
 * not describe generic stockpiling as a plan.
 */
export function chooseResourceDemandReason(
  state: GameState,
  plan: HumanSeasonPlan | undefined,
  producedResources: ResourceType[] = [],
): ResourceDemandDecision {
  const candidates: Array<ResourceDemandDecision & { score: number }> = [];
  const addCandidate = (
    reasonCode: Exclude<ResourceDemandReasonCode, "RESOURCE_FLOATING_NO_SPEND_TARGET">,
    targetId: string,
    targetName: string,
    gaps: Partial<Record<ResourceType, number>>,
    score: number,
    reason: string,
  ) => {
    const relevantGap = relevantShortfall(gaps, producedResources);
    if (relevantGap <= 0) return;
    candidates.push({
      reasonCode,
      targetId,
      targetName,
      resourceGaps: gaps,
      score: score + relevantGap * 3,
      reason,
    });
  };
  const completedArrivalIds = new Set(state.encounters.completedArrivals.map((arrival) => arrival.cardId));
  const inactiveCardIds = new Set(state.encounters.discardPile);
  const activeArrivalById = new Map(state.encounters.activeArrivals.map((arrival) => [arrival.cardId, arrival]));
  const activeBurdenIds = new Set(state.encounters.activeBurdens);
  const forecastById = new Map((plan?.forecasts ?? []).map((forecast) => [forecast.cardId, forecast]));
  const plannedCardIds = new Set([
    ...state.encounters.activeArrivals.map((arrival) => arrival.cardId),
    ...state.encounters.activeBurdens,
    ...(plan?.forecasts.map((forecast) => forecast.cardId) ?? []),
  ]);
  for (const cardId of plannedCardIds) {
    const intent = buildCardIntent(state, cardId);
    if (intent.type === "arrival") {
      if (completedArrivalIds.has(cardId) || inactiveCardIds.has(cardId)) continue;
      const active = activeArrivalById.get(cardId);
      const forecast = forecastById.get(cardId);
      addCandidate(
        "RESOURCE_FOR_SEEDED_ARRIVAL",
        cardId,
        intent.cardName,
        costShortfall(state, intent.requiredResources),
        active ? 118 + Math.max(0, 4 - active.timerTokens) * 9 : 72 + (forecast?.confidence ?? 0) * 16,
        `Produce for the ${intent.cardName} Arrival requirement before its ${active ? `${active.timerTokens}-timer window` : `${forecast?.expectedWindow ?? "forecast"} reveal window`} closes.`,
      );
    } else if (intent.type === "burden") {
      if (!activeBurdenIds.has(cardId) && inactiveCardIds.has(cardId)) continue;
      const forecast = forecastById.get(cardId);
      addCandidate(
        "RESOURCE_FOR_BURDEN_PAYMENT",
        cardId,
        intent.cardName,
        costShortfall(state, intent.requiredResources),
        activeBurdenIds.has(cardId) ? 124 : 70 + (forecast?.confidence ?? 0) * 14,
        `Produce the missing payment for ${intent.cardName} so its ongoing damage and final penalty can be removed.`,
      );
    }
  }

  for (const placed of state.map.placedTiles) {
    if (placed.kind !== "core" || placed.side === "upgraded") continue;
    const tile = coreTileById[placed.tileId];
    const scoreGain = tile.upgraded.population + tile.upgraded.renown - tile.basic.population - tile.basic.renown;
    addCandidate(
      "RESOURCE_FOR_PLANNED_UPGRADE",
      placed.instanceId,
      tile.upgraded.name,
      costShortfall(state, tile.upgraded.cost),
      58 + scoreGain * 4 + (tile.category === "crafting" || tile.category === "merchant" ? 12 : 0),
      `Produce for the planned ${tile.upgraded.name} upgrade, which converts an existing tile into score or a stronger engine.`,
    );
  }

  const existingHousing = boardCategoryCount(state, "housing");
  if (plan?.housingPush || state.season >= 2) {
    const housingMultiplier = Math.max(1, Math.min(2, 3 - existingHousing));
    for (const tile of coreTiles.filter((candidate) => candidate.category === "housing" && state.tileSupply.core[candidate.id] > 0)) {
      addCandidate(
        "RESOURCE_FOR_HOUSING_CLUSTER",
        tile.id,
        tile.basic.name,
        costShortfall(state, tile.basic.cost, housingMultiplier),
        68 + state.round * 2 + tile.basic.population * 2,
        `Produce for ${housingMultiplier > 1 ? `${housingMultiplier} ${tile.basic.name} placements` : tile.basic.name} to extend the connected Housing scoring cluster.`,
      );
    }
  }

  if (state.round >= 8 || state.season === 3) {
    for (const tile of coreTiles.filter((candidate) =>
      candidate.category !== "resource" &&
      state.tileSupply.core[candidate.id] > 0 &&
      candidate.basic.population + candidate.basic.renown > 0
    )) {
      addCandidate(
        "RESOURCE_FOR_FINAL_SCORE_TILE",
        tile.id,
        tile.basic.name,
        costShortfall(state, tile.basic.cost),
        55 + state.round * 3 + (tile.basic.population + tile.basic.renown) * 3,
        `Produce the remaining cost of ${tile.basic.name}, a placeable Population/Renown conversion before game end.`,
      );
    }
  }

  const selected = candidates.sort((a, b) => b.score - a.score)[0];
  if (selected) {
    const { score: _score, ...decision } = selected;
    return decision;
  }
  return {
    reasonCode: "RESOURCE_FLOATING_NO_SPEND_TARGET",
    resourceGaps: {},
    reason: producedResources.length > 0
      ? `No planned card, upgrade, Housing cluster, or final-score tile currently needs ${producedResources.join("/")}; this production would float without a spend target.`
      : "No planned card, upgrade, Housing cluster, or final-score tile currently has an unmet resource cost; further production would float without a spend target.",
  };
}

export function cardPlanPriority(plan: HumanSeasonPlan | undefined, cardId: string): number {
  if (!plan) return 0;
  if (plan.highPriorityArrivalIds.includes(cardId)) return 18;
  if (plan.highPriorityBoonIds.includes(cardId)) return 12;
  if (plan.highRiskBurdenIds.includes(cardId)) return 20;
  return plan.forecasts.some((forecast) => forecast.cardId === cardId) ? 5 : 0;
}

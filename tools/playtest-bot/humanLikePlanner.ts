import { encounterById } from "../../src/data/encounters";
import { coreTileById, specialTileById } from "../../src/data/tiles";
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

export interface HumanSeasonPlan {
  season: Season;
  strategicThesis: string;
  forecasts: ForecastCard[];
  handCardsByPlayer: Record<string, string[]>;
  expectedResourceDemand: Partial<Record<ResourceType, number>>;
  targetTileCategories: TileCategory[];
  targetSpecialTileIds: string[];
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

function currentText(card: EncounterData, season: Season): string {
  if (card.type === "arrival") return card.requirementText;
  if (card.type === "goldenBoon") return card.effectText;
  return card.effects[season === 1 ? "season1" : season === 2 ? "season2" : "season3"];
}

function parseResourceAmounts(text: string): Partial<Record<ResourceType, number>> {
  const result: Partial<Record<ResourceType, number>> = {};
  for (const resource of resources) {
    const match = text.match(new RegExp(`(\\d+)\\s+${resource}`, "i"));
    if (match) result[resource] = Number(match[1]);
  }
  return result;
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

function tagsForText(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (lower.includes("supported")) tags.push("support");
  if (lower.includes("strain")) tags.push("strain_relief");
  if (lower.includes("burden")) tags.push("burden_control");
  if (lower.includes("timer token")) tags.push("arrival_time");
  if (lower.includes("exchange") || lower.includes("goods as")) tags.push("resource_conversion");
  if (lower.includes("upgrade") || lower.includes("upgrading")) tags.push("upgrade_value");
  if (lower.includes("travel")) tags.push("travel_value");
  if (lower.includes("housing")) tags.push("housing_value");
  if (lower.includes("merchant")) tags.push("merchant_value");
  if (lower.includes("crafting")) tags.push("crafting_value");
  if (lower.includes("0 actions") || lower.includes("without spending an action")) tags.push("action_tempo");
  return [...new Set(tags)];
}

function threatTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (lower.includes("strain")) tags.push("strain");
  if (lower.includes("housing")) tags.push("strain_housing");
  if (lower.includes("resource tile")) tags.push("strain_resource");
  if (lower.includes("arrival") || lower.includes("timer")) tags.push("arrival_pressure");
  if (/lose|pay/.test(lower)) tags.push("resource_loss");
  if (lower.includes("adjacent")) tags.push("adjacency_punish");
  return tags;
}

function requiredCategories(text: string): TileCategory[] {
  const lower = text.toLowerCase();
  return (["resource", "housing", "crafting", "merchant", "social", "wellbeing", "travel"] as TileCategory[])
    .filter((category) => lower.includes(category));
}

function rewardValue(card: EncounterData): { tileIds: string[]; tags: string[]; value: number } {
  if (card.type !== "arrival") return { tileIds: [], tags: [], value: 0 };
  const tileIds = card.rewardSpecialTileIds;
  const tiles = tileIds.map((id) => specialTileById[id]).filter(Boolean);
  return {
    tileIds,
    tags: [...new Set(tiles.flatMap((tile) => tagsForText(tile.effectText)))],
    value: tiles.reduce((sum, tile) => sum + tile.population + tile.renown, 0),
  };
}

export function buildCardIntent(state: GameState, cardId: string): CardIntent {
  const card = encounterById[cardId];
  if (!card) throw new Error(`Unknown Encounter card ${cardId}`);
  const text = currentText(card, state.season);
  const demand = card.type === "arrival"
    ? parseResourceAmounts(card.requirementText)
    : card.type === "burden"
      ? parseResourceAmounts(card.resolutionText ?? "")
      : {};
  const readiness = resourceReadiness(state, demand);
  const reward = rewardValue(card);
  const categories = boardCategories(state);
  const neededCategories = requiredCategories(`${text} ${card.type === "arrival" ? reward.tileIds.map((id) => specialTileById[id]?.placement?.text ?? "").join(" ") : ""}`);
  const missingCategories = neededCategories.filter((category) => !categories.has(category)).length;
  const totalDemand = resources.reduce((sum, resource) => sum + (demand[resource] ?? 0), 0);
  const opportunities = tagsForText(text);
  const threats = card.type === "burden" ? threatTags(text) : [];
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
  const best = permutations.map((order) => ({
    order,
    score: order.reduce((sum, intentIndex, windowIndex) => sum + placementFit(intents[intentIndex], windows[windowIndex]), 0),
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
      reasonSeeded: intent.reason,
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

export function buildHumanSeasonPlan(
  state: GameState,
  forecasts: ForecastCard[],
  handCardsByPlayer: Record<string, string[]> = {},
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
  const needsCrafting = state.season < 3 && (tags.has("upgrade_value") || arrivalIntents.length >= 2);
  const needsMerchant = state.season < 3 && (diverseDemand >= 5 || tags.has("merchant_value") || (demand.goods ?? 0) >= 5);
  const needsTravel = needsCrafting || needsMerchant || tags.has("travel_value");
  const housingPush = state.season >= 2 || arrivalIntents.some(({ intent }) => intent.requiredTileCategories.includes("housing"));
  const targets = new Set<TileCategory>(["resource"]);
  if (needsTravel) targets.add("travel");
  if (needsCrafting) targets.add("crafting");
  if (needsMerchant) targets.add("merchant");
  if (needsSupport) targets.add("wellbeing");
  if (housingPush) targets.add("housing");
  const priorityArrivals = arrivalIntents
    .filter(({ intent, forecast }) => intent.seasonValue >= 6 && (intent.readiness >= 0.45 || forecast.expectedWindow !== "early"))
    .sort((a, b) => b.intent.seasonValue - a.intent.seasonValue)
    .map(({ intent }) => intent.cardId);
  const priorityBoons = boonIntents
    .sort((a, b) => b.intent.seasonValue - a.intent.seasonValue)
    .map(({ intent }) => intent.cardId);
  const targetSpecials = arrivalIntents.flatMap(({ intent }) => intent.rewardTileIds);
  const thesisParts = [
    `prepare ${resources.filter((resource) => (demand[resource] ?? 0) >= 1).join("/") || "a balanced Warehouse"}`,
    needsCrafting || needsMerchant ? `establish ${[needsCrafting ? "Crafting" : "", needsMerchant ? "Merchant" : ""].filter(Boolean).join(" and ")} infrastructure` : "avoid unnecessary infrastructure",
    needsSupport ? "protect the scoring district before major expansion" : "keep protection proportional to actual risk",
    housingPush ? "convert the prepared engine into clustered Housing" : "delay the main Housing conversion",
  ];
  return {
    season: state.season,
    strategicThesis: thesisParts.join("; ") + ".",
    forecasts,
    handCardsByPlayer,
    expectedResourceDemand: demand,
    targetTileCategories: [...targets],
    targetSpecialTileIds: targetSpecials,
    highPriorityArrivalIds: priorityArrivals,
    highPriorityBoonIds: priorityBoons,
    highRiskBurdenIds: highRisk,
    needsTravelAnchor: needsTravel,
    needsCrafting,
    needsMerchant,
    needsSupportBeforeHousing: needsSupport,
    housingPush,
    actionPriorities: [
      "EARLY_RESOURCE_DEFICIT",
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
  const desired = Math.min(15, 5 + Math.ceil(plan.expectedResourceDemand[resource] ?? 0));
  return Math.max(0, desired - state.warehouse[resource]);
}

export function cardPlanPriority(plan: HumanSeasonPlan | undefined, cardId: string): number {
  if (!plan) return 0;
  if (plan.highPriorityArrivalIds.includes(cardId)) return 18;
  if (plan.highPriorityBoonIds.includes(cardId)) return 12;
  if (plan.highRiskBurdenIds.includes(cardId)) return 20;
  return plan.forecasts.some((forecast) => forecast.cardId === cardId) ? 5 : 0;
}

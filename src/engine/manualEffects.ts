import { resources, warehouseCap } from "../data/resources";
import { encounterById } from "../data/encounters";
import { mapById } from "../data/map";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import { applyStrainToState, removeStrainFromTile } from "./strainRules";
import { recalculatePassiveSupported } from "./supportRules";
import type {
  EffectAdjustment,
  GameState,
  PendingEffectState,
  PlacedTile,
  ResourceType,
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

export function isWardenReliefAdjustmentValid(adjustment: EffectAdjustment): boolean {
  const strainDeltas = Object.values(adjustment.tileStrainDeltas ?? {});
  const supportCount = adjustment.supportTileIds?.length ?? 0;
  const strainRemovalCount = strainDeltas.reduce(
    (total, delta) => total + (delta < 0 ? Math.abs(delta) : 0),
    0
  );
  const hasInvalidStrainDelta = strainDeltas.some((delta) => delta > 0 || delta < -1);

  return !hasInvalidStrainDelta && supportCount + strainRemovalCount === 1;
}

export function isResourceExchangeAdjustmentValid(
  state: Pick<GameState, "warehouse">,
  effectText: string,
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
  const isAlchemistGoodsMode = /exchange\s+5\s+total\s+resources\s+for\s+3\s+Goods/i.test(
    effectText
  );
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
  return {
    ...state,
    pendingEffects: [
      ...state.pendingEffects,
      {
        ...effect,
        id: `effect_${state.pendingEffects.length + state.log.length + 1}_${Date.now()}`
      }
    ]
  };
}

export function queuePendingEffectFirst(
  state: GameState,
  effect: Omit<PendingEffectState, "id">
): GameState {
  return {
    ...state,
    pendingEffects: [
      {
        ...effect,
        id: `effect_${state.pendingEffects.length + state.log.length + 1}_${Date.now()}`
      },
      ...state.pendingEffects
    ]
  };
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

function isAdjacentToTile(candidate: PlacedTile, sourceTile: PlacedTile): boolean {
  const sourceNeighbors = new Set(sourceTile.hexIds.flatMap((hexId) => getHexNeighbors(hexId)));
  return candidate.hexIds.some((hexId) => sourceNeighbors.has(hexId));
}

function getPlacedTileName(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.name ?? tile.tileId;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.name : data.basic.name;
}

function getPlacedTileCategory(tile: PlacedTile): TileCategory {
  return tile.kind === "special"
    ? specialTileById[tile.tileId].category
    : coreTileById[tile.tileId].category;
}

function getPlacedTileRenown(tile: PlacedTile): number {
  if (tile.kind === "special") return specialTileById[tile.tileId].renown;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.renown : data.basic.renown;
}

function isAdjacentToCategory(
  state: GameState,
  tile: PlacedTile,
  category: TileCategory
): boolean {
  const neighbors = new Set(tile.hexIds.flatMap((hexId) => getHexNeighbors(hexId)));
  return state.map.placedTiles.some(
    (candidate) =>
      candidate.instanceId !== tile.instanceId &&
      getPlacedTileCategory(candidate) === category &&
      candidate.hexIds.some((hexId) => neighbors.has(hexId))
  );
}

function isAdjacentToTerrain(tile: PlacedTile, terrain: Terrain): boolean {
  return tile.hexIds
    .flatMap((hexId) => getHexNeighbors(hexId))
    .some((hexId) => mapById[hexId]?.terrain === terrain);
}

const categoryText: Record<Exclude<TileCategory, "special">, string> = {
  resource: "resource",
  housing: "housing",
  crafting: "crafting",
  merchant: "merchant",
  social: "social",
  wellbeing: "wellbeing",
  travel: "travel"
};

const namedTargetTileIds: Array<{ tileId: string; patterns: string[] }> = [
  {
    tileId: "c01_lumber_yard",
    patterns: ["lumber yard", "sustainable lumber yard"]
  },
  {
    tileId: "c02_mine_tunnel",
    patterns: ["mine tunnel", "mine shaft"]
  },
  {
    tileId: "c03_gathering_outpost",
    patterns: ["gathering outpost", "gathering lodge"]
  },
  {
    tileId: "c04_farmstead",
    patterns: ["farmstead", "artisan farm"]
  },
  {
    tileId: "c20_dig_site",
    patterns: ["dig site", "excavation site"]
  }
];

function getMentionedCategories(text: string): TileCategory[] {
  return Object.entries(categoryText)
    .filter(([, label]) => {
      const negatedTilePattern = new RegExp(`\\bnon-${label}\\s+tiles?\\b`);
      const patterns = [
        new RegExp(`\\b${label}\\s+tiles?\\b`),
        new RegExp(`\\b${label}\\s*,`),
        new RegExp(`\\b${label}\\s+(?:or|and)\\b`),
        new RegExp(`\\b(?:or|and|and/or)\\s+${label}\\b`)
      ];

      return !negatedTilePattern.test(text) && patterns.some((pattern) => pattern.test(text));
    })
    .map(([category]) => category as TileCategory);
}

function getMentionedNamedTileIds(text: string): string[] {
  return namedTargetTileIds
    .filter((entry) => entry.patterns.some((pattern) => text.includes(pattern)))
    .map((entry) => entry.tileId);
}

function getCandidateText(effectText: string): string {
  const lower = effectText.toLowerCase();
  const beforeAdjacentTo = lower.split("adjacent to")[0] ?? lower;
  return beforeAdjacentTo.split(/\bif (?:one|an) adjacent tile\b/)[0] ?? beforeAdjacentTo;
}

function getAdjacentCategoryRequirements(effectText: string): TileCategory[] {
  const lower = effectText.toLowerCase();
  const adjacentTexts = [...lower.matchAll(/adjacent to/g)]
    .filter((match) => {
      const before = lower.slice(Math.max(0, (match.index ?? 0) - 16), match.index);
      return !/\bnot\s+$/.test(before) && !/\bnot\s+be\s+$/.test(before);
    })
    .map((match) => lower.slice((match.index ?? 0) + "adjacent to".length))
    .filter((text) => !/^\s*(?:it|this tile|that tile|them)\b/.test(text));
  return adjacentTexts.flatMap((text) => getMentionedCategories(text));
}

function getFallbackSplit(effectText: string): {
  primaryText: string;
  fallbackText?: string;
} {
  const match = effectText.match(
    /\b(?:if none(?: are valid| is valid)?|if there are none|if there is no active arrival)\s*,/i
  );
  if (!match || match.index === undefined) return { primaryText: effectText };

  return {
    primaryText: effectText.slice(0, match.index).trim(),
    fallbackText: effectText.slice(match.index + match[0].length).trim()
  };
}

function hasAdjustmentAction(effectText: string): boolean {
  return /\b(?:gain|lose|pay|exchange|place|remove|add)\b/i.test(effectText);
}

function getInheritedFallbackAction(primaryText: string): string | undefined {
  const sentences = primaryText.match(/[^.]+\.?/g) ?? [];
  return sentences
    .map((sentence) => sentence.trim())
    .reverse()
    .find((sentence) =>
      /\b(?:gain|lose|pay|exchange|place|remove|add)\b/i.test(sentence)
    );
}

/**
 * Returns the instruction branch that is live in the current board state. Some
 * cards print a target-only fallback ("choose 1 Merchant Tile instead"), so the
 * primary branch's action is inherited when the fallback does not repeat it.
 */
export function getActiveEffectText(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): string {
  const { primaryText, fallbackText } = getFallbackSplit(effectText);
  if (!fallbackText) return effectText;

  const primary = getTileTargetsForText(state, primaryText, sourceTile);
  const primaryMentionsArrivals = primaryText.toLowerCase().includes("active arrival");
  const shouldUseFallback =
    (primary.hasTileTarget && primary.targets.length === 0) ||
    (primaryMentionsArrivals && state.encounters.activeArrivals.length === 0);
  if (!shouldUseFallback) return primaryText;

  if (/\bno effect\b/i.test(fallbackText) || hasAdjustmentAction(fallbackText)) {
    return fallbackText;
  }
  const inheritedAction = getInheritedFallbackAction(primaryText);
  return inheritedAction ? `${fallbackText} ${inheritedAction}` : fallbackText;
}

function hasTileTargetLanguage(effectText: string): boolean {
  const lower = effectText.toLowerCase();
  return (
    lower.includes("tile") ||
    lower.includes("tiles") ||
    lower.includes("overstrained") ||
    getMentionedNamedTileIds(lower).length > 0 ||
    getMentionedCategories(lower).length > 0
  );
}

function getTileTargetsForText(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): { targets: PlacedTile[]; hasTileTarget: boolean } {
  const lower = effectText.toLowerCase();
  const candidateText = getCandidateText(effectText);
  const namedTileIds = getMentionedNamedTileIds(lower);
  const candidateCategories = getMentionedCategories(candidateText);
  const adjacentCategories = getAdjacentCategoryRequirements(effectText);
  const hasTileTarget = hasTileTargetLanguage(effectText);
  const usesNamedOrRuinsAlternative =
    namedTileIds.length > 0 &&
    lower.includes("adjacent to ruins terrain") &&
    (lower.includes(" or ") || lower.includes("and/or"));
  let candidates = state.map.placedTiles;

  if (!hasTileTarget) return { targets: [], hasTileTarget };

  if (usesNamedOrRuinsAlternative) {
    candidates = candidates.filter(
      (tile) => namedTileIds.includes(tile.tileId) || isAdjacentToTerrain(tile, "ruins")
    );
  } else if (namedTileIds.length > 0) {
    candidates = candidates.filter((tile) => namedTileIds.includes(tile.tileId));
  } else if (candidateCategories.length > 0) {
    candidates = candidates.filter((tile) =>
      candidateCategories.includes(getPlacedTileCategory(tile))
    );
  }

  if (lower.includes("with fewer than 3 strain")) {
    candidates = candidates.filter((tile) => tile.strain < 3);
  }
  if (lower.includes("with 1-2 strain")) {
    candidates = candidates.filter((tile) => tile.strain >= 1 && tile.strain <= 2);
  }
  if (lower.includes("with 0 strain")) {
    candidates = candidates.filter((tile) => tile.strain === 0);
  }
  if (
    lower.includes("non-overstrained") ||
    lower.includes("not overstrained") ||
    lower.includes("must not be overstrained")
  ) {
    candidates = candidates.filter((tile) => tile.strain < 3);
  } else if (lower.includes("overstrained")) {
    candidates = candidates.filter((tile) => tile.strain >= 3);
  }
  if (lower.includes("with renown")) {
    candidates = candidates.filter((tile) => getPlacedTileRenown(tile) > 0);
  }
  if (lower.includes("supported tile") || lower.includes("supported tiles")) {
    candidates = candidates.filter((tile) => tile.support.passive || tile.support.singleUse);
  }
  if (lower.includes("not adjacent to social or wellbeing")) {
    candidates = candidates.filter(
      (tile) =>
        !isAdjacentToCategory(state, tile, "social") &&
        !isAdjacentToCategory(state, tile, "wellbeing")
    );
  }
  if (/steward-occupied\s+tiles?/.test(lower)) {
    const stewardHexIds = new Set(state.players.map((player) => player.stewardHexId));
    candidates = candidates.filter((tile) =>
      tile.hexIds.some((hexId) => stewardHexIds.has(hexId))
    );
  }

  for (const category of adjacentCategories) {
    candidates = candidates.filter((tile) => isAdjacentToCategory(state, tile, category));
  }

  if (
    sourceTile &&
    lower.includes("adjacent") &&
    adjacentCategories.length === 0
  ) {
    candidates = candidates.filter(
      (tile) =>
        tile.instanceId !== sourceTile.instanceId && isAdjacentToTile(tile, sourceTile)
    );
  }

  if (lower.includes("adjacent to ruins terrain") && !usesNamedOrRuinsAlternative) {
    candidates = candidates.filter((tile) => isAdjacentToTerrain(tile, "ruins"));
  }

  return { targets: candidates, hasTileTarget };
}

function getStewardOccupiedTileTargets(state: GameState): PlacedTile[] {
  const stewardHexIds = new Set(state.players.map((player) => player.stewardHexId));
  return state.map.placedTiles.filter((tile) =>
    tile.hexIds.some((hexId) => stewardHexIds.has(hexId))
  );
}

export function getEffectTileTargets(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const activeText = getActiveEffectText(state, effectText, sourceTile);
  if (/steward-occupied\s+tiles?/i.test(activeText)) {
    return getStewardOccupiedTileTargets(state);
  }
  return getTileTargetsForText(state, activeText, sourceTile).targets;
}

function uniqueTiles(tiles: PlacedTile[]): PlacedTile[] {
  return tiles.filter(
    (tile, index, list) =>
      list.findIndex((candidate) => candidate.instanceId === tile.instanceId) === index
  );
}

export function getEffectSupportTargets(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const lower = effectText.toLowerCase();
  if (!lower.includes("supported")) return [];

  const primaryTargets = getEffectTileTargets(state, effectText, sourceTile);
  if (
    lower.includes("that housing tile gains supported") ||
    lower.includes("housing tile gains supported")
  ) {
    return uniqueTiles(
      primaryTargets.flatMap((tile) => {
        const neighbors = new Set(tile.hexIds.flatMap((hexId) => getHexNeighbors(hexId)));
        return state.map.placedTiles.filter(
          (candidate) =>
            candidate.instanceId !== tile.instanceId &&
            getPlacedTileCategory(candidate) === "housing" &&
            candidate.hexIds.some((hexId) => neighbors.has(hexId))
        );
      })
    ).filter((tile) => !tile.support.passive && !tile.support.singleUse);
  }

  return primaryTargets.filter(
    (tile) => !tile.support.passive && !tile.support.singleUse
  );
}

const effectNumberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6
};

function parseEffectNumber(value: string | undefined, fallback = 1): number {
  if (!value) return fallback;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return effectNumberWords[value.toLowerCase()] ?? fallback;
}

export interface TileAdjustmentRule {
  strain?: {
    direction: "place" | "remove";
    maxTotal: number;
    maxPerTile: number;
    maxTargets: number;
  };
  support?: {
    maxTargets: number;
  };
}

function parseTargetCount(effectText: string, actionIndex: number): number {
  const lower = effectText.toLowerCase();
  const before = lower.slice(Math.max(0, actionIndex - 180), actionIndex);
  const after = lower.slice(actionIndex, actionIndex + 180);
  const patterns = [
    /choose\s+up to\s+(\d+|one|two|three|four|five|six)\b/g,
    /choose\s+(\d+|one|two|three|four|five|six)\b/g,
    /each of\s+up to\s+(\d+|one|two|three|four|five|six)\b/g,
    /from\s+up to\s+(\d+|one|two|three|four|five|six)\b/g,
    /on\s+each\s+of\s+(\d+|one|two|three|four|five|six)\b/g,
    /from\s+(\d+|one|two|three|four|five|six)\b/g
  ];

  for (const scope of [after, before]) {
    for (const pattern of patterns) {
      const matches = [...scope.matchAll(pattern)];
      const match = matches.at(-1);
      if (match) return parseEffectNumber(match[1]);
    }
  }
  return 1;
}

function parseChosenTargetCountBefore(effectText: string, actionIndex: number): number {
  const before = effectText.slice(0, actionIndex);
  const matches = [
    ...before.matchAll(/choose\s+(?:up to\s+)?(\d+|one|two|three|four|five|six)\b/gi)
  ];
  return parseEffectNumber(matches.at(-1)?.[1]);
}

export function getTileAdjustmentRule(effectText: string): TileAdjustmentRule {
  const lower = effectText.toLowerCase();
  const rule: TileAdjustmentRule = {};
  const supportAction = lower.search(/\b(?:gain|gains)\s+supported\b/);

  if (supportAction >= 0) {
    rule.support = { maxTargets: parseTargetCount(effectText, supportAction) };
  }

  const strainActions = [
    ...effectText.matchAll(/\b(place|remove)\s+(up to\s+)?(\d+|one|two|three|four|five|six)\s+strain\b/gi)
  ];
  if (strainActions.length > 0) {
    const direction = strainActions.some((match) => match[1].toLowerCase() === "place")
      ? "place"
      : "remove";
    const matchingActions = strainActions.filter(
      (match) => match[1].toLowerCase() === direction
    );
    let maxTotal = 0;
    let maxPerTile = 1;
    let maxTargets = 0;

    for (const match of matchingActions) {
      const amount = parseEffectNumber(match[3]);
      const actionIndex = match.index ?? 0;
      let targetCount = parseTargetCount(effectText, actionIndex);
      const actionText = lower.slice(actionIndex, actionIndex + 180);
      if (
        match[2] &&
        targetCount === 1 &&
        (/\bamong\b/.test(actionText) || /\btiles\b/.test(actionText))
      ) {
        targetCount = amount;
      }
      const distributesAmount =
        /\bamong\b/.test(actionText) ||
        (/up to\s+\d+\s+strain/.test(match[0].toLowerCase()) && targetCount > 1);
      const actionTotal = distributesAmount ? amount : amount * targetCount;
      maxTotal += actionTotal;
      maxPerTile = Math.max(maxPerTile, distributesAmount ? amount : amount);
      maxTargets += targetCount;
    }

    rule.strain = {
      direction,
      maxTotal: Math.max(1, maxTotal),
      maxPerTile: Math.max(1, maxPerTile),
      maxTargets: Math.max(1, maxTargets)
    };
  }

  return rule;
}

export function getValidEffectStrainTargets(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): PlacedTile[] {
  const activeText = getActiveEffectText(state, effectText, sourceTile);
  const rule = getTileAdjustmentRule(activeText).strain;
  const targets = getEffectTileTargets(state, effectText, sourceTile);
  if (!rule) return [];
  return targets.filter((tile) =>
    rule.direction === "remove" ? tile.strain > 0 : tile.strain < 3
  );
}

export function isTileAdjustmentValid(
  state: GameState,
  effectText: string,
  adjustment: EffectAdjustment,
  sourceTile?: PlacedTile
): boolean {
  const activeText = getActiveEffectText(state, effectText, sourceTile);
  const rule = getTileAdjustmentRule(activeText);
  const strainEntries = Object.entries(adjustment.tileStrainDeltas ?? {}).filter(
    ([, delta]) => delta !== 0
  );
  const supportIds = [...new Set(adjustment.supportTileIds ?? [])];

  if (strainEntries.length > 0) {
    if (!rule.strain) return false;
    const legalIds = new Set(
      getValidEffectStrainTargets(state, effectText, sourceTile).map(
        (tile) => tile.instanceId
      )
    );
    const total = strainEntries.reduce((sum, [, delta]) => sum + Math.abs(delta), 0);
    if (strainEntries.length > rule.strain.maxTargets || total > rule.strain.maxTotal) {
      return false;
    }
    for (const [tileId, delta] of strainEntries) {
      if (!legalIds.has(tileId) || Math.abs(delta) > rule.strain.maxPerTile) return false;
      if (rule.strain.direction === "place" && delta < 0) return false;
      if (rule.strain.direction === "remove" && delta > 0) return false;
      const tile = state.map.placedTiles.find((candidate) => candidate.instanceId === tileId);
      if (!tile) return false;
      if (rule.strain.direction === "remove" && Math.abs(delta) > tile.strain) return false;
    }
  }

  if (supportIds.length > 0) {
    if (!rule.support || supportIds.length > rule.support.maxTargets) return false;
    const legalIds = new Set(
      getEffectSupportTargets(state, effectText, sourceTile).map(
        (tile) => tile.instanceId
      )
    );
    if (supportIds.some((tileId) => !legalIds.has(tileId))) return false;
  }

  return true;
}

function isResolveActiveBurdenEffect(effectText: string): boolean {
  return /resolve\s+1\s+active\s+burden/i.test(effectText);
}

function parseExactResourceDeltas(
  state: GameState,
  effectText: string
): Partial<Record<ResourceType, number>> {
  const lower = effectText.toLowerCase();
  if (
    (!lower.includes("gain") && !lower.includes("lose")) ||
    lower.includes("for each") ||
    lower.includes("same number") ||
    lower.includes("any type") ||
    lower.includes("max")
  ) {
    return {};
  }

  const deltas: Partial<Record<ResourceType, number>> = {};
  const ambiguousResourceChoice = new RegExp(
    `\\b(?:${resources.join("|")})\\s+(?:or|and/or)\\s+(?:${resources.join("|")})\\b`,
    "i"
  );
  if (ambiguousResourceChoice.test(effectText)) return {};

  const actionMatches = [...effectText.matchAll(/\b(gain|lose)\b/gi)];
  for (const [index, actionMatch] of actionMatches.entries()) {
    const start = actionMatch.index ?? 0;
    const nextActionIndex = actionMatches[index + 1]?.index ?? effectText.length;
    const sentenceEnd = effectText.indexOf(".", start);
    const end = Math.min(
      nextActionIndex,
      sentenceEnd >= 0 ? sentenceEnd : effectText.length
    );
    const actionText = effectText.slice(start, end);
    const direction = actionMatch[1].toLowerCase() === "gain" ? 1 : -1;
    const resourceMatches = actionText.matchAll(
      /(\d+)\s+(Wood|Stone|Metal|Food|Herbs|Goods)\b/gi
    );
    for (const match of resourceMatches) {
      const amount = Number(match[1]);
      const resource = match[2].toLowerCase() as ResourceType;
      const delta =
        direction > 0 ? amount : -Math.min(amount, state.warehouse[resource]);
      deltas[resource] = (deltas[resource] ?? 0) + delta;
    }
  }

  return deltas;
}

function parseTimerSuggestion(
  state: GameState,
  effectText: string
): Pick<EffectAdjustment, "arrivalTimerDeltas"> {
  const rule = getTimerAdjustmentRule(effectText);
  if (
    !rule ||
    rule.direction !== "add" ||
    state.encounters.activeArrivals.length !== 1
  ) {
    return {};
  }

  const arrival = state.encounters.activeArrivals[0];
  const delta = Math.min(rule.limit, Math.max(0, 3 - arrival.timerTokens));
  if (delta <= 0) return {};
  return {
    arrivalTimerDeltas: {
      [arrival.cardId]: delta
    }
  };
}

export interface TimerAdjustmentRule {
  direction: "add" | "remove";
  limit: number;
}

export function getTimerAdjustmentRule(effectText: string): TimerAdjustmentRule | null {
  const addMatch = effectText.match(/\badd\s+(?:up to\s+)?(\d+)\s+timer/i);
  if (addMatch) {
    return { direction: "add", limit: Number(addMatch[1]) };
  }

  const removeMatch = effectText.match(/\bremove\s+(?:up to\s+)?(\d+)\s+timer/i);
  if (removeMatch) {
    const perTarget = Number(removeMatch[1]);
    const targetCount = /\bfor each\b/i.test(effectText)
      ? parseChosenTargetCountBefore(effectText, removeMatch.index ?? 0)
      : 1;
    return { direction: "remove", limit: perTarget * targetCount };
  }

  return null;
}

export function isTimerAdjustmentValid(
  state: GameState,
  effectText: string,
  timerDeltas: Record<string, number> | undefined
): boolean {
  const rule = getTimerAdjustmentRule(effectText);
  if (!rule || !timerDeltas) return true;

  const activeArrivalById = new Map(
    state.encounters.activeArrivals.map((arrival) => [arrival.cardId, arrival])
  );
  let total = 0;

  for (const [cardId, delta] of Object.entries(timerDeltas)) {
    if (delta === 0) continue;

    const arrival = activeArrivalById.get(cardId);
    if (!arrival) return false;

    if (rule.direction === "add") {
      if (delta < 0 || delta > 3 - arrival.timerTokens) return false;
      total += delta;
    } else {
      if (delta > 0 || Math.abs(delta) > arrival.timerTokens) return false;
      total += Math.abs(delta);
    }
  }

  return total <= rule.limit;
}

function parseStrainSuggestion(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): Pick<EffectAdjustment, "tileStrainDeltas"> {
  const removeMatch = effectText.match(/remove\s+(?:up to\s+)?(\d+)\s+strain/i);
  if (removeMatch) {
    const amount = Number(removeMatch[1]);
    const candidates = getValidEffectStrainTargets(state, effectText, sourceTile).filter((tile) => {
      return sourceTile && effectText.toLowerCase().includes("adjacent")
        ? isAdjacentToTile(tile, sourceTile)
        : true;
    });

    if (candidates.length === 1) {
      return {
        tileStrainDeltas: {
          [candidates[0].instanceId]: -Math.min(amount, candidates[0].strain)
        }
      };
    }
  }

  const placeMatch = effectText.match(/place\s+(\d+)\s+strain/i);
  if (placeMatch) {
    const amount = Number(placeMatch[1]);
    const candidates = getValidEffectStrainTargets(state, effectText, sourceTile);
    if (candidates.length === 1) {
      return {
        tileStrainDeltas: {
          [candidates[0].instanceId]: amount
        }
      };
    }
  }

  return {};
}

function parseSupportedSuggestion(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): Pick<EffectAdjustment, "supportTileIds"> {
  if (!/gain[s]? supported/i.test(effectText)) return {};

  const lower = effectText.toLowerCase();
  if (lower.includes("for each different tile category")) return {};

  const candidates = getEffectSupportTargets(state, effectText, sourceTile);

  return candidates.length === 1
    ? { supportTileIds: [candidates[0].instanceId] }
    : {};
}

function parseResolvedBurdenSuggestion(
  state: GameState,
  effectText: string
): Pick<EffectAdjustment, "resolvedBurdenIds"> {
  if (!isResolveActiveBurdenEffect(effectText)) return {};
  return state.encounters.activeBurdens.length === 1
    ? { resolvedBurdenIds: [state.encounters.activeBurdens[0]] }
    : {};
}

function effectTextNeedsManualChoice(effectText: string): boolean {
  const lower = effectText.toLowerCase();
  if (lower.includes("the next ")) return false;
  return (
    lower.includes("choose") ||
    lower.includes("exchange") ||
    lower.includes(" or ") ||
    lower.includes("and/or") ||
    lower.includes("up to")
  );
}

function effectHasPaymentOrStrainChoice(effectText: string): boolean {
  return (
    /\bpay\s+\d+\s+(?:wood|stone|metal|food|herbs|goods)\b/i.test(effectText) &&
    /\bor\s+place\s+\d+\s+strain\b/i.test(effectText)
  );
}

export type AlternativeEffectRule =
  | {
      kind: "pay_or_strain";
      resources: ResourceType[];
      resourceStep: number;
      requiredChoices: number;
      strainPerChoice: number;
    }
  | {
      kind: "pay_or_timer";
      resources: ResourceType[];
      resourceStep: number;
      requiredChoices: number;
      timerPerChoice: number;
    }
  | {
      kind: "warehouse_loss_or_strain";
      resources: ResourceType[];
      resourceStep: number;
      requiredChoices: 1;
      requiredStrainTotal: number;
    };

function resourcesMentionedBefore(text: string, end: number): ResourceType[] {
  const prefix = text.slice(0, end).toLowerCase();
  if (prefix.includes("any non-goods resource")) {
    return resources.filter((resource) => resource !== "goods");
  }
  return resources.filter((resource) =>
    new RegExp(`\\b${resource}\\b`, "i").test(prefix)
  );
}

export function getAlternativeEffectRule(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): AlternativeEffectRule | null {
  const activeText = getActiveEffectText(state, effectText, sourceTile);
  const payOrStrain = activeText.match(
    /pay\s+(\d+)\s+(Wood|Stone|Metal|Food|Herbs|Goods)\s*,?\s+or\s+place\s+(\d+)\s+Strain/i
  );
  if (payOrStrain) {
    const strainRule = getTileAdjustmentRule(activeText).strain;
    const targetCount = getValidEffectStrainTargets(state, activeText, sourceTile).length;
    const requiredChoices = Math.min(strainRule?.maxTargets ?? 1, targetCount);
    if (requiredChoices > 0) {
      return {
        kind: "pay_or_strain",
        resources: [payOrStrain[2].toLowerCase() as ResourceType],
        resourceStep: Number(payOrStrain[1]),
        requiredChoices,
        strainPerChoice: Number(payOrStrain[3])
      };
    }
  }

  const payOrTimer = activeText.match(
    /pay\s+(\d+)\s+(Wood|Stone|Metal|Food|Herbs|Goods)\s+or\s+remove\s+(\d+)\s+timer/i
  );
  if (payOrTimer) {
    const requested = parseTargetCount(activeText, payOrTimer.index ?? 0);
    const requiredChoices = Math.min(requested, state.encounters.activeArrivals.length);
    if (requiredChoices > 0) {
      return {
        kind: "pay_or_timer",
        resources: [payOrTimer[2].toLowerCase() as ResourceType],
        resourceStep: Number(payOrTimer[1]),
        requiredChoices,
        timerPerChoice: Number(payOrTimer[3])
      };
    }
  }

  const warehouseChoice = activeText.match(
    /If the Warehouse has at least\s+(\d+)\s+of it,\s*lose\s+(\d+)\.\s*Otherwise,\s*place\s+(\d+)\s+Strain/i
  );
  if (warehouseChoice) {
    const strainRule = getTileAdjustmentRule(activeText).strain;
    const legalTargets = getValidEffectStrainTargets(state, activeText, sourceTile);
    const requiredStrainTotal = strainRule
      ? legalTargets
          .slice(0, strainRule.maxTargets)
          .reduce(
            (total, tile) =>
              total + Math.min(strainRule.maxPerTile, Math.max(0, 3 - tile.strain)),
            0
          )
      : Number(warehouseChoice[3]);
    return {
      kind: "warehouse_loss_or_strain",
      resources: resourcesMentionedBefore(activeText, warehouseChoice.index ?? 0),
      resourceStep: Number(warehouseChoice[2]),
      requiredChoices: 1,
      requiredStrainTotal
    };
  }

  return null;
}

function resourceSpend(
  adjustment: EffectAdjustment,
  resource: ResourceType
): number {
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
  effectText: string,
  adjustment: EffectAdjustment,
  sourceTile?: PlacedTile
): boolean {
  const rule = getAlternativeEffectRule(state, effectText, sourceTile);
  if (!rule) return true;
  if (!hasOnlyAllowedResourceSpending(state, adjustment, rule.resources)) return false;

  const totalSpent = rule.resources.reduce(
    (total, resource) => total + resourceSpend(adjustment, resource),
    0
  );
  const strainEntries = Object.values(adjustment.tileStrainDeltas ?? {}).filter(
    (delta) => delta !== 0
  );
  const totalStrain = strainEntries.reduce(
    (total, delta) => total + Math.max(0, delta),
    0
  );
  const totalTimersRemoved = Object.values(adjustment.arrivalTimerDeltas ?? {}).reduce(
    (total, delta) => total + Math.max(0, -delta),
    0
  );

  if (rule.kind === "pay_or_strain") {
    if (totalTimersRemoved > 0 || totalSpent % rule.resourceStep !== 0) return false;
    if (strainEntries.some((delta) => delta !== rule.strainPerChoice)) return false;
    return totalSpent / rule.resourceStep + totalStrain / rule.strainPerChoice ===
      rule.requiredChoices;
  }

  if (rule.kind === "pay_or_timer") {
    if (totalStrain > 0 || totalSpent % rule.resourceStep !== 0) return false;
    if (
      Object.values(adjustment.arrivalTimerDeltas ?? {}).some(
        (delta) => delta !== 0 && delta !== -rule.timerPerChoice
      )
    ) return false;
    return totalSpent / rule.resourceStep + totalTimersRemoved / rule.timerPerChoice ===
      rule.requiredChoices;
  }

  const paymentBranch = totalSpent === rule.resourceStep && totalStrain === 0 &&
    rule.resources.filter((resource) => resourceSpend(adjustment, resource) > 0).length === 1;
  const strainBranchAvailable = rule.resources.some(
    (resource) => state.warehouse[resource] < rule.resourceStep
  );
  const strainBranch = totalSpent === 0 && strainBranchAvailable &&
    totalStrain === rule.requiredStrainTotal;
  return paymentBranch || strainBranch;
}

function hasAnyAlternativeEffectOutcome(
  state: GameState,
  rule: AlternativeEffectRule
): boolean {
  if (rule.kind === "pay_or_strain") return rule.requiredChoices > 0;
  if (rule.kind === "pay_or_timer") {
    const resource = rule.resources[0];
    const payable = Math.floor(state.warehouse[resource] / rule.resourceStep);
    const removable = state.encounters.activeArrivals.filter(
      (arrival) => arrival.timerTokens >= rule.timerPerChoice
    ).length;
    return payable + removable >= rule.requiredChoices;
  }
  return rule.resources.some((resource) => state.warehouse[resource] >= rule.resourceStep) ||
    (rule.requiredStrainTotal > 0 &&
      rule.resources.some((resource) => state.warehouse[resource] < rule.resourceStep));
}

function omitTileStrainDeltas(adjustment: EffectAdjustment): EffectAdjustment {
  const next = { ...adjustment };
  delete next.tileStrainDeltas;
  return next;
}

export function effectHasNoValidChoiceTargets(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): boolean {
  const alternativeRule = getAlternativeEffectRule(state, effectText, sourceTile);
  if (alternativeRule) {
    return !hasAnyAlternativeEffectOutcome(state, alternativeRule);
  }
  const lower = effectText.toLowerCase();
  const timerRule = getTimerAdjustmentRule(effectText);
  const { fallbackText } = getFallbackSplit(effectText);
  const hasResourceFallback = Boolean(
    fallbackText && /\b(gain|lose|pay|exchange)\b/i.test(fallbackText)
  );
  const tileRule = getTileAdjustmentRule(effectText);
  const hasValidStrainTarget = tileRule.strain
    ? getValidEffectStrainTargets(state, effectText, sourceTile).length > 0
    : false;
  const hasValidSupportTarget = tileRule.support
    ? getEffectSupportTargets(state, effectText, sourceTile).length > 0
    : false;

  if (
    timerRule?.direction === "add" &&
    lower.includes("active arrival") &&
    !state.encounters.activeArrivals.some((arrival) => arrival.timerTokens < 3)
  ) {
    return true;
  }

  if (
    state.encounters.activeArrivals.length === 0 &&
    lower.includes("active arrival") &&
    (lower.includes("if there is no active arrival, no effect") ||
      lower.includes("if there are none, no effect"))
  ) {
    return true;
  }

  if (
    state.encounters.activeArrivals.length === 0 &&
    lower.includes("active arrival") &&
    lower.includes("if there are none") &&
    lower.includes("placed tiles with fewer than 3 strain") &&
    !state.map.placedTiles.some((tile) => tile.strain < 3)
  ) {
    return true;
  }

  if (
    state.map.placedTiles.length === 0 &&
    lower.includes("choose") &&
    (lower.includes("tile") || getMentionedNamedTileIds(lower).length > 0) &&
    lower.includes("strain") &&
    !lower.includes("warehouse") &&
    !lower.includes("lose ")
  ) {
    return true;
  }

  if (
    (tileRule.strain || tileRule.support) &&
    !hasValidStrainTarget &&
    !hasValidSupportTarget &&
    !hasResourceFallback
  ) {
    return true;
  }

  if (
    lower.includes("choose") &&
    hasTileTargetLanguage(lower) &&
    !hasResourceFallback &&
    getEffectTileTargets(state, effectText, sourceTile).length === 0
  ) {
    return true;
  }

  return false;
}

export function suggestEffectAdjustment(
  state: GameState,
  effectText: string,
  sourceTile?: PlacedTile
): { adjustment?: EffectAdjustment; requiresManualChoice?: boolean } {
  const activeText = getActiveEffectText(state, effectText, sourceTile);
  const adjustment = mergeEffectAdjustment(
    { resourceDeltas: parseExactResourceDeltas(state, activeText) },
    parseTimerSuggestion(state, activeText)
  );
  const withStrain = mergeEffectAdjustment(
    adjustment,
    parseStrainSuggestion(state, activeText, sourceTile)
  );
  const withSupported = mergeEffectAdjustment(
    withStrain,
    parseSupportedSuggestion(state, activeText, sourceTile)
  );
  const withResolvedBurden = mergeEffectAdjustment(
    withSupported,
    parseResolvedBurdenSuggestion(state, activeText)
  );
  const lower = activeText.toLowerCase();
  const timerRule = getTimerAdjustmentRule(activeText);
  const timerTargetCount =
    timerRule?.direction === "add"
      ? state.encounters.activeArrivals.filter((arrival) => arrival.timerTokens < 3).length
      : state.encounters.activeArrivals.length;
  const hasMultipleTimerTargets =
    Boolean(timerRule) && lower.includes("timer") && timerTargetCount > 1;
  const hasMultipleStrainTargets =
    lower.includes("strain") &&
    getValidEffectStrainTargets(state, activeText, sourceTile).length > 1;
  const hasMultipleSupportedTargets =
    lower.includes("supported") &&
    getEffectSupportTargets(state, activeText, sourceTile).length > 1;
  const hasMultipleResolvedBurdenTargets =
    isResolveActiveBurdenEffect(activeText) && state.encounters.activeBurdens.length > 1;
  const hasPaymentOrStrainChoice = effectHasPaymentOrStrainChoice(activeText);
  const hasAlternativeChoice = Boolean(
    getAlternativeEffectRule(state, activeText, sourceTile)
  );
  const finalAdjustment = hasPaymentOrStrainChoice || hasAlternativeChoice
    ? omitTileStrainDeltas({
        ...withResolvedBurden,
        resourceDeltas: {},
        arrivalTimerDeltas: {}
      })
    : withResolvedBurden;

  return {
    adjustment: hasEffectAdjustment(finalAdjustment) ? finalAdjustment : undefined,
    requiresManualChoice:
      !effectHasNoValidChoiceTargets(state, activeText, sourceTile) &&
      (hasMultipleTimerTargets ||
        hasMultipleStrainTargets ||
        hasMultipleSupportedTargets ||
        hasMultipleResolvedBurdenTargets ||
        (effectTextNeedsManualChoice(activeText) &&
          (!hasEffectAdjustment(finalAdjustment) || hasPaymentOrStrainChoice || hasAlternativeChoice)))
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
  const suggestion = suggestEffectAdjustment(state, effectText, restingHall);

  const queued = queuePendingEffect(state, {
    sourceType: "tile",
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
  const [pendingEffect, ...remainingEffects] = state.pendingEffects;
  if (!pendingEffect) return state;
  const effectiveAdjustment = mergeEffectAdjustment(
    pendingEffect.suggestedAdjustment,
    adjustment
  );
  if (
    pendingEffect.requiresManualChoice &&
    !hasEffectAdjustment(effectiveAdjustment)
  ) {
    return state;
  }
  if (
    !isTimerAdjustmentValid(
      state,
      pendingEffect.effectText,
      effectiveAdjustment.arrivalTimerDeltas
    )
  ) {
    return state;
  }
  if (
    pendingEffect.resourceExchangeLimit !== undefined &&
    !isResourceExchangeAdjustmentValid(
      state,
      pendingEffect.effectText,
      effectiveAdjustment,
      pendingEffect.resourceExchangeLimit,
      pendingEffect.resourceExchangeOptional
    )
  ) {
    return state;
  }
  if (
    pendingEffect.allowWardenRelief &&
    !isWardenReliefAdjustmentValid(effectiveAdjustment)
  ) {
    return state;
  }
  const sourceTile =
    pendingEffect.sourceType === "tile" && pendingEffect.sourceId
      ? state.map.placedTiles.find(
          (tile) => tile.instanceId === pendingEffect.sourceId
        )
      : undefined;
  if (
    !pendingEffect.allowWardenRelief &&
    !isAlternativeEffectAdjustmentValid(
      state,
      pendingEffect.effectText,
      effectiveAdjustment,
      sourceTile
    )
  ) {
    return state;
  }
  if (
    !pendingEffect.allowWardenRelief &&
    !isTileAdjustmentValid(
      state,
      pendingEffect.effectText,
      effectiveAdjustment,
      sourceTile
    )
  ) {
    return state;
  }

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

  if (effectiveAdjustment.tileStrainDeltas || effectiveAdjustment.supportTileIds?.length) {
    const supportedIds = new Set(effectiveAdjustment.supportTileIds ?? []);
    for (const [tileId, strainDelta] of Object.entries(
      effectiveAdjustment.tileStrainDeltas ?? {}
    )) {
      if (strainDelta > 0) {
        nextState = applyStrainToState(nextState, tileId, strainDelta);
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

  return {
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

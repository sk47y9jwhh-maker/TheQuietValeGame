import { arrivals, boons, burdens, encounterById, goldenBoons } from "../data/encounters";
import {
  ledgerChronicles,
  ledgerEntries,
  ledgerEntryById,
  ledgerMilestones,
  ledgerUnlockGates
} from "../data/ledger";
import {
  mapArtworkLayers,
  mapById,
  mapCells,
  mapColumns,
  mapLayout,
  ruinsHexIds,
  terrainLabels,
  waterHexIds
} from "../data/map";
import { resources } from "../data/resources";
import { stewards } from "../data/stewards";
import {
  cardEffectRuleId,
  effectRulesById,
  stewardEffectRuleId,
  systemEffectRuleId,
  tileEffectRuleId
} from "../data/effectRules";
import { specialTileBehaviors } from "../data/contentRules";
import {
  coreTileById,
  coreTiles,
  goldenTileById,
  goldenTiles,
  specialTileById,
  specialTiles
} from "../data/tiles";
import type {
  BoonData,
  BurdenData,
  EncounterData,
  GoldenTileData,
  ResourceCost,
  ResourceType,
  SpecialTileData,
  Terrain,
  TileCategory,
  TilePlacementRequirement
} from "./types";

const tileCategories: TileCategory[] = [
  "resource",
  "housing",
  "crafting",
  "merchant",
  "social",
  "wellbeing",
  "travel",
  "special"
];

const terrainTypes = Object.keys(terrainLabels) as Terrain[];
const standardSpecialTileIds = new Set(specialTiles.map((tile) => tile.id));
const allTileIds = new Set([
  ...coreTiles.map((tile) => tile.id),
  ...specialTiles.map((tile) => tile.id),
  ...goldenTiles.map((tile) => tile.id)
]);
const goldenBoonIds = new Set(goldenBoons.map((boon) => boon.id));
const stewardIds = new Set(stewards.map((steward) => steward.id));

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function validateUniqueIds(
  label: string,
  items: Array<{ id: string }>,
  issues: string[]
): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id.trim()) {
      issues.push(`${label} has a blank id.`);
      continue;
    }
    if (seen.has(item.id)) issues.push(`${label} has duplicate id: ${item.id}.`);
    seen.add(item.id);
  }
}

function validatePositiveInteger(label: string, value: unknown, issues: string[]): void {
  if (!isWholeNumber(value) || value < 1) {
    issues.push(`${label} must be a positive whole number.`);
  }
}

function validateNonNegativeInteger(label: string, value: unknown, issues: string[]): void {
  if (!isWholeNumber(value) || value < 0) {
    issues.push(`${label} must be a non-negative whole number.`);
  }
}

function validateResourceCost(label: string, cost: ResourceCost, issues: string[]): void {
  const costRecord = cost as Partial<Record<ResourceType, unknown>>;
  for (const resource of resources) {
    validateNonNegativeInteger(`${label} ${resource}`, costRecord[resource], issues);
  }

  for (const key of Object.keys(cost)) {
    if (!(resources as string[]).includes(key)) {
      issues.push(`${label} contains unknown resource key: ${key}.`);
    }
  }
}

function validateTerrainList(
  label: string,
  terrains: Terrain[] | undefined,
  issues: string[]
): void {
  if (!terrains) return;
  if (terrains.length === 0) issues.push(`${label} must name at least one terrain.`);
  for (const terrain of terrains) {
    if (!terrainTypes.includes(terrain)) {
      issues.push(`${label} contains unknown terrain: ${terrain}.`);
    }
  }
}

function validatePlacementRequirement(
  label: string,
  placement: TilePlacementRequirement | undefined,
  issues: string[]
): void {
  if (!placement) return;

  validateTerrainList(`${label} terrain restriction`, placement.terrain, issues);
  validateTerrainList(`${label} adjacent terrain restriction`, placement.adjacentToTerrain, issues);
  validateTerrainList(
    `${label} forbidden adjacent terrain restriction`,
    placement.notAdjacentToTerrain,
    issues
  );

  for (const category of placement.adjacentToCategory ?? []) {
    if (!tileCategories.includes(category)) {
      issues.push(`${label} references unknown adjacent category: ${category}.`);
    }
  }

  for (const tileId of placement.adjacentToTileIds ?? []) {
    if (!allTileIds.has(tileId)) {
      issues.push(`${label} references unknown adjacent tile id: ${tileId}.`);
    }
  }

}

function validateSpecialLikeTile(
  label: string,
  tile: SpecialTileData | GoldenTileData,
  issues: string[]
): void {
  if (!tile.name.trim()) issues.push(`${label} has a blank name.`);
  if (!tile.effectText.trim()) issues.push(`${label} has blank effect text.`);
  validatePositiveInteger(`${label} count`, tile.count, issues);
  validatePositiveInteger(`${label} size`, tile.size ?? 1, issues);
  validateNonNegativeInteger(`${label} population`, tile.population, issues);
  validateNonNegativeInteger(`${label} renown`, tile.renown, issues);
  if (!tileCategories.includes(tile.category)) {
    issues.push(`${label} has unknown category: ${tile.category}.`);
  }
  if (tile.footprint && !["single", "line", "detached"].includes(tile.footprint)) {
    issues.push(`${label} has unknown footprint: ${tile.footprint}.`);
  }
  if ((tile.footprint === "line" || tile.footprint === "detached") && (tile.size ?? 1) < 2) {
    issues.push(`${label} uses a multi-hex footprint but has size below 2.`);
  }
  validatePlacementRequirement(`${label} placement`, tile.placement, issues);
}

function validateTiles(issues: string[]): void {
  validateUniqueIds("Core Tiles", coreTiles, issues);
  validateUniqueIds("Special Tiles", specialTiles, issues);
  validateUniqueIds("Golden Tiles", goldenTiles, issues);
  validateUniqueIds(
    "All Tiles",
    [...coreTiles, ...specialTiles, ...goldenTiles].map((tile) => ({ id: tile.id })),
    issues
  );

  for (const tile of coreTiles) {
    const label = `Core Tile ${tile.id}`;
    if (coreTileById[tile.id] !== tile) issues.push(`${label} is not correctly indexed.`);
    validatePositiveInteger(`${label} count`, tile.count, issues);
    validatePositiveInteger(`${label} size`, tile.size, issues);
    const category = tile.category as TileCategory;
    if (!tileCategories.includes(category)) {
      issues.push(`${label} has unknown category: ${category}.`);
    }
    if (category === "special") issues.push(`${label} cannot use the special category.`);
    if ((tile.footprint === "line" || tile.footprint === "detached") && tile.size < 2) {
      issues.push(`${label} uses a multi-hex footprint but has size below 2.`);
    }
    validatePlacementRequirement(`${label} placement`, tile.placement, issues);

    for (const [sideName, side] of [
      ["basic", tile.basic],
      ["upgraded", tile.upgraded]
    ] as const) {
      if (!side.name.trim()) issues.push(`${label} ${sideName} side has a blank name.`);
      if (!side.effectText.trim()) issues.push(`${label} ${sideName} side has blank effect text.`);
      validateResourceCost(`${label} ${sideName} cost`, side.cost, issues);
      if (side.production) validateResourceCost(`${label} ${sideName} production`, side.production, issues);
      validateNonNegativeInteger(`${label} ${sideName} population`, side.population, issues);
      validateNonNegativeInteger(`${label} ${sideName} renown`, side.renown, issues);
    }
  }

  for (const tile of specialTiles) {
    const label = `Special Tile ${tile.id}`;
    if (specialTileById[tile.id] !== tile) issues.push(`${label} is not correctly indexed.`);
    validateSpecialLikeTile(label, tile, issues);
  }

  for (const tile of goldenTiles) {
    const label = `Golden Tile ${tile.id}`;
    if (goldenTileById[tile.id] !== tile) issues.push(`${label} is not correctly indexed.`);
    if (specialTileById[tile.id] !== tile) issues.push(`${label} is not available through special tile lookup.`);
    validateSpecialLikeTile(label, tile, issues);
    if (!goldenBoonIds.has(tile.linkedGoldenBoonId)) {
      issues.push(`${label} links to unknown Golden Boon: ${tile.linkedGoldenBoonId}.`);
    }
    validateNonNegativeInteger(`${label} unlockAt`, tile.unlockAt, issues);
    if (!tile.scoringText.trim()) issues.push(`${label} has blank scoring text.`);
    if (!tile.layoutIncentive.trim()) issues.push(`${label} has blank layout incentive.`);
  }
}

function validateEncounterSeasonText(
  label: string,
  card: BoonData | BurdenData,
  issues: string[]
): void {
  for (const season of ["season1", "season2", "season3"] as const) {
    if (!card.effects[season].trim()) issues.push(`${label} has blank ${season} text.`);
  }
}

function validateEncounters(issues: string[]): void {
  const allEncounters: EncounterData[] = [...boons, ...burdens, ...arrivals, ...goldenBoons];
  validateUniqueIds("Encounters", allEncounters, issues);

  for (const card of allEncounters) {
    const label = `Encounter ${card.id}`;
    if (encounterById[card.id] !== card) issues.push(`${label} is not correctly indexed.`);
    if (!card.name.trim()) issues.push(`${label} has a blank name.`);
    if (!card.flavorText?.trim()) issues.push(`${label} has blank flavour text.`);

    if (card.type === "boon" || card.type === "burden") {
      validateEncounterSeasonText(label, card, issues);
    }
    if (card.type === "boon" && !card.lifecycle.trim()) {
      issues.push(`${label} has blank lifecycle text.`);
    }
    if (card.type === "burden" && !card.resolutionText?.trim()) {
      issues.push(`${label} has blank resolution text.`);
    }
    if (card.type === "arrival") {
      if (!card.requirementText.trim()) issues.push(`${label} has blank requirement text.`);
      if (card.rewardSpecialTileIds.length === 0) issues.push(`${label} has no Special Tile reward.`);
      for (const tileId of card.rewardSpecialTileIds) {
        if (!standardSpecialTileIds.has(tileId)) {
          issues.push(`${label} rewards unknown non-Golden Special Tile: ${tileId}.`);
        }
      }
    }
    if (card.type === "goldenBoon") {
      if (card.enabledInOnlinePrototype !== true) {
        issues.push(`${label} is not enabled for the online prototype.`);
      }
      validateNonNegativeInteger(`${label} unlockAt`, card.unlockAt, issues);
      if (!card.effectText.trim()) issues.push(`${label} has blank effect text.`);
      if (!card.lifecycle.trim()) issues.push(`${label} has blank lifecycle text.`);
    }
  }
}

function validateLedger(issues: string[]): void {
  validateUniqueIds("Ledger Entries", ledgerEntries, issues);
  if (ledgerEntries.length !== 50) {
    issues.push(`Ledger should contain 50 entries; found ${ledgerEntries.length}.`);
  }

  const ledgerChronicleSet = new Set<string>(ledgerChronicles);
  const entryIds = new Set(ledgerEntries.map((entry) => entry.id));
  for (let index = 1; index <= ledgerEntries.length; index += 1) {
    const expectedId = `LE-${String(index).padStart(3, "0")}`;
    if (!entryIds.has(expectedId)) issues.push(`Ledger is missing sequential entry ${expectedId}.`);
  }

  for (const entry of ledgerEntries) {
    const label = `Ledger Entry ${entry.id}`;
    if (ledgerEntryById[entry.id] !== entry) issues.push(`${label} is not correctly indexed.`);
    if (!ledgerChronicleSet.has(entry.chronicle)) {
      issues.push(`${label} references unknown chronicle: ${entry.chronicle}.`);
    }
    validateNonNegativeInteger(`${label} unlockAt`, entry.unlockAt, issues);
    if (ledgerUnlockGates[entry.id] !== entry.unlockAt) {
      issues.push(`${label} unlock gate does not match ledgerUnlockGates.`);
    }
    if (!entry.requirement.trim()) issues.push(`${label} has blank requirement text.`);
    if (entry.unlockAt > 0 && !entry.requirement.includes("Available after")) {
      issues.push(`${label} is gated but requirement text does not mention availability.`);
    }
    if (entry.declaredVow && !entry.requirement.includes("Declare before setup")) {
      issues.push(`${label} is a Vow but does not tell players to declare before setup.`);
    }
    if (entry.requiredSteward && !stewardIds.has(entry.requiredSteward)) {
      issues.push(`${label} references unknown Steward: ${entry.requiredSteward}.`);
    }
    if (entry.thresholdsByPlayerCount) {
      for (const [playerCount, threshold] of Object.entries(entry.thresholdsByPlayerCount)) {
        if (!["1", "2", "3", "4"].includes(playerCount)) {
          issues.push(`${label} has unknown player-count threshold key: ${playerCount}.`);
        }
        validateNonNegativeInteger(`${label} ${playerCount}p threshold`, threshold, issues);
      }
    }
  }

  for (const entryId of Object.keys(ledgerUnlockGates)) {
    if (!entryIds.has(entryId)) issues.push(`ledgerUnlockGates references unknown entry: ${entryId}.`);
  }

  validateUniqueIds(
    "Ledger Milestones",
    ledgerMilestones.map((milestone) => ({ id: String(milestone.threshold) })),
    issues
  );
  let previousThreshold = -1;
  for (const milestone of ledgerMilestones) {
    validatePositiveInteger(`Ledger milestone ${milestone.threshold}`, milestone.threshold, issues);
    if (milestone.threshold <= previousThreshold) {
      issues.push(`Ledger milestone thresholds must be strictly increasing at ${milestone.threshold}.`);
    }
    previousThreshold = milestone.threshold;

    const tile = goldenTileById[milestone.goldenTileId];
    const boon = goldenBoons.find((candidate) => candidate.id === milestone.goldenBoonId);
    if (!tile) issues.push(`Ledger milestone ${milestone.threshold} references unknown Golden Tile.`);
    if (!boon) issues.push(`Ledger milestone ${milestone.threshold} references unknown Golden Boon.`);
    if (tile && tile.unlockAt !== milestone.threshold) {
      issues.push(`Ledger milestone ${milestone.threshold} does not match ${tile.id} unlockAt.`);
    }
    if (tile && tile.linkedGoldenBoonId !== milestone.goldenBoonId) {
      issues.push(`Ledger milestone ${milestone.threshold} does not match ${tile.id}'s linked Golden Boon.`);
    }
    if (boon && boon.unlockAt !== milestone.threshold) {
      issues.push(`Ledger milestone ${milestone.threshold} does not match ${boon.id} unlockAt.`);
    }
  }
}

function validateMapData(issues: string[]): void {
  validateUniqueIds("Map Cells", mapCells, issues);
  validatePositiveInteger("Map layout columns", mapLayout.columns, issues);
  validatePositiveInteger("Map layout rows", mapLayout.rows, issues);
  validatePositiveInteger("Map layout hex radius", mapLayout.hexRadius, issues);
  if (mapLayout.columns !== mapColumns.length) {
    issues.push("Map layout column count does not match map columns.");
  }
  if (mapCells.length !== mapLayout.columns * mapLayout.rows) {
    issues.push("Map cell count does not match map layout dimensions.");
  }
  if (mapLayout.hexWidth !== mapLayout.hexRadius * 2) {
    issues.push("Map layout hex width should be twice the radius.");
  }
  if (mapLayout.width <= 0 || mapLayout.height <= 0) {
    issues.push("Map layout needs positive artwork/viewBox dimensions.");
  }

  for (const cell of mapCells) {
    const label = `Map cell ${cell.id}`;
    if (mapById[cell.id] !== cell) issues.push(`${label} is not correctly indexed.`);
    if (!mapColumns.includes(cell.col)) issues.push(`${label} uses unknown column ${cell.col}.`);
    if (cell.row < 1 || cell.row > mapLayout.rows) issues.push(`${label} has row outside map bounds.`);
    if (cell.id !== `${cell.col}${cell.row}`) {
      issues.push(`${label} id does not match its column and row.`);
    }
    if (!terrainTypes.includes(cell.terrain)) {
      issues.push(`${label} uses unknown terrain ${cell.terrain}.`);
    }
  }

  for (const terrain of terrainTypes) {
    if (!mapCells.some((cell) => cell.terrain === terrain)) {
      issues.push(`Map has no ${terrainLabels[terrain]} terrain cells.`);
    }
  }

  const expectedWaterHexIds = mapCells.filter((cell) => cell.terrain === "water").map((cell) => cell.id);
  const expectedRuinsHexIds = mapCells.filter((cell) => cell.terrain === "ruins").map((cell) => cell.id);
  if (waterHexIds.join(",") !== expectedWaterHexIds.join(",")) {
    issues.push("waterHexIds does not match map terrain data.");
  }
  if (ruinsHexIds.join(",") !== expectedRuinsHexIds.join(",")) {
    issues.push("ruinsHexIds does not match map terrain data.");
  }

  validateUniqueIds("Map Artwork Layers", mapArtworkLayers, issues);
  for (const layer of mapArtworkLayers) {
    if (!["underlay", "overlay"].includes(layer.kind)) {
      issues.push(`Map artwork layer ${layer.id} has unknown kind ${layer.kind}.`);
    }
    if (layer.placement !== "svg-view-box") {
      issues.push(`Map artwork layer ${layer.id} must be aligned to the SVG viewBox.`);
    }
    if (layer.opacity < 0 || layer.opacity > 1) {
      issues.push(`Map artwork layer ${layer.id} opacity must be between 0 and 1.`);
    }
    if (!layer.label.trim()) issues.push(`Map artwork layer ${layer.id} has a blank label.`);
  }
}

function validateStructuredRules(issues: string[]): void {
  const requireRule = (ruleId: string, source: string) => {
    if (!effectRulesById[ruleId]) {
      issues.push(`${source} is missing structured rule ${ruleId}.`);
    }
  };

  for (const card of [...boons, ...burdens]) {
    for (const season of [1, 2, 3] as const) {
      requireRule(cardEffectRuleId(card.id, season), `${card.name} Season ${season}`);
    }
    if (card.type === "burden") {
      requireRule(`${card.id}:resolution`, `${card.name} resolution`);
    }
  }

  for (const tile of coreTiles) {
    for (const side of ["basic", "upgraded"] as const) {
      if (tile[side].effectType === "activated" || tile[side].effectType === "production") {
        requireRule(tileEffectRuleId(tile.id, side), `${tile[side].name} ${side} effect`);
      }
    }
  }

  for (const tile of specialTiles) {
    if (!specialTileBehaviors[tile.id]) {
      issues.push(`${tile.name} is missing a structured Special Tile behavior.`);
    }
  }
  for (const [tileId, behavior] of Object.entries(specialTileBehaviors)) {
    if (behavior.trigger !== "passive") {
      requireRule(tileEffectRuleId(tileId, "special"), `${specialTileById[tileId]?.name ?? tileId} effect`);
    }
  }

  for (const steward of stewards) {
    requireRule(stewardEffectRuleId(steward.id), `${steward.name} power`);
  }
  requireRule(systemEffectRuleId("acknowledge"), "System acknowledgement");
  requireRule(systemEffectRuleId("arrival-expired"), "Expired Arrival");
}

function validateStewards(issues: string[]): void {
  validateUniqueIds("Stewards", stewards, issues);
  for (const steward of stewards) {
    const label = `Steward ${steward.id}`;
    if (!steward.name.trim()) issues.push(`${label} has a blank name.`);
    if (!steward.powerText.trim()) issues.push(`${label} has blank power text.`);
    if (!steward.objectiveText.trim()) issues.push(`${label} has blank objective text.`);
    validatePositiveInteger(`${label} objective renown`, steward.objectiveRenown, issues);
    validateTerrainList(`${label} starting terrain`, steward.startingTerrains, issues);
    for (const terrain of steward.startingTerrains) {
      if (!mapCells.some((cell) => cell.terrain === terrain)) {
        issues.push(`${label} can start on ${terrain}, but the map has no matching hex.`);
      }
    }
  }
}

export function validateAllGameData(): string[] {
  const issues: string[] = [];
  validateMapData(issues);
  validateTiles(issues);
  validateEncounters(issues);
  validateLedger(issues);
  validateStewards(issues);
  validateStructuredRules(issues);
  return issues;
}

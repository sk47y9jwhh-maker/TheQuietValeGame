import { resources } from "../data/resources";
import { mapById } from "../data/map";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import { getPlacedTileCategory, getPlacedTileName } from "./placedTiles";
import { isTileReachable } from "./reachability";
import { canAfford } from "./resources";
import type {
  CostActionType,
  CostChoiceSelection,
  GameState,
  PassiveCostOption,
  PlacedTile,
  ResourceCost,
  ResourceType,
  TileCategory
} from "./types";

export interface PassiveCostContext {
  action: CostActionType;
  playerId: string;
  category?: TileCategory;
  kind?: "core" | "special";
  placementHexIds?: string[];
  targetTile?: PlacedTile;
  cost: ResourceCost;
}

export function emptyCost(): ResourceCost {
  return { wood: 0, stone: 0, metal: 0, food: 0, herbs: 0, goods: 0 };
}

export function costTotal(cost: ResourceCost): number {
  return resources.reduce((total, resource) => total + cost[resource], 0);
}

export function applyFlexibleCostReduction(
  cost: ResourceCost,
  warehouse: GameState["warehouse"],
  amount: number
): ResourceCost {
  const next = { ...cost };
  let remaining = amount;

  for (const resource of resources) {
    if (remaining <= 0) break;
    const shortage = Math.max(0, next[resource] - warehouse[resource]);
    const reduction = Math.min(shortage, next[resource], remaining);
    next[resource] -= reduction;
    remaining -= reduction;
  }

  const byCostDescending = [...resources].sort((a, b) => next[b] - next[a]);
  for (const resource of byCostDescending) {
    if (remaining <= 0) break;
    const reduction = Math.min(next[resource], remaining);
    next[resource] -= reduction;
    remaining -= reduction;
  }

  return next;
}

function areHexSetsAdjacent(aHexIds: string[], bHexIds: string[]): boolean {
  return aHexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => bHexIds.includes(neighborId))
  );
}

function isPassiveUsed(
  state: GameState,
  tile: PlacedTile,
  cadence: PassiveCostOption["cadence"]
): boolean {
  const record = state.tileActivationRecords[tile.instanceId];
  return cadence === "season"
    ? record?.season === state.season
    : record?.round === state.round;
}

function getPassiveRefreshModifier(
  state: GameState,
  tile: PlacedTile
) {
  const category = getPlacedTileCategory(tile);
  return state.boonModifiers.find((modifier) => {
    if (!modifier.actions.includes("passive") || !modifier.refreshPassiveUse) {
      return false;
    }
    if (modifier.allowedCategories && !modifier.allowedCategories.includes(category)) {
      return false;
    }
    if (modifier.allowedTileIds && !modifier.allowedTileIds.includes(tile.tileId)) {
      return false;
    }
    return !modifier.requiresAdjacentCategories?.length ||
      modifier.requiresAdjacentCategories.every((requiredCategory) =>
        state.map.placedTiles.some(
          (candidate) =>
            candidate.instanceId !== tile.instanceId &&
            getPlacedTileCategory(candidate) === requiredCategory &&
            areHexSetsAdjacent(tile.hexIds, candidate.hexIds)
        )
      );
  });
}

function makeOption(
  source: PlacedTile,
  input: Omit<PassiveCostOption, "id" | "sourceTileId" | "sourceName" | "effectText">
): PassiveCostOption {
  const data =
    source.kind === "special"
      ? specialTileById[source.tileId]
      : source.side === "upgraded"
        ? coreTileById[source.tileId].upgraded
        : coreTileById[source.tileId].basic;

  return {
    id: `${source.instanceId}:${input.kind}`,
    sourceTileId: source.instanceId,
    sourceName: getPlacedTileName(source),
    effectText: data.effectText,
    ...input
  };
}

function getMarketResourceChoices(cost: ResourceCost): ResourceType[] {
  return resources.filter((resource) => resource !== "goods" && cost[resource] > 0);
}

function getCostResourceChoices(cost: ResourceCost): ResourceType[] {
  return resources.filter((resource) => cost[resource] > 0);
}

function placementTouchesWater(hexIds: string[]): boolean {
  return hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => mapById[neighborId]?.terrain === "water")
  );
}

export function getPassiveCostOptions(
  state: GameState,
  context: PassiveCostContext
): PassiveCostOption[] {
  if (costTotal(context.cost) <= 0) return [];
  const options: PassiveCostOption[] = [];

  for (const tile of state.map.placedTiles) {
    if (tile.strain >= 3) continue;

    if (
      context.action === "place" &&
      context.placementHexIds?.length &&
      !isPassiveUsed(state, tile, "round")
    ) {
      const isCharter =
        tile.tileId === "golden_tile_the_golden_charter" &&
        areHexSetsAdjacent(tile.hexIds, context.placementHexIds);
      const isRiverGate =
        tile.tileId === "golden_tile_the_golden_river_gate" &&
        placementTouchesWater(context.placementHexIds);
      const isCairn =
        tile.tileId === "golden_tile_the_golden_cairn" &&
        context.placementHexIds.some((hexId) => {
          const terrain = mapById[hexId]?.terrain;
          return terrain !== undefined && terrain !== "grasslands" && terrain !== "water";
        });
      if (isCharter || isRiverGate || isCairn) {
        options.push(
          makeOption(tile, {
            kind: "discount",
            cadence: "round",
            amount: 1,
            resourceChoices: getCostResourceChoices(context.cost),
            required: true
          })
        );
      }
    }

    if (
      context.action === "place" &&
      context.category === "housing" &&
      context.placementHexIds?.length &&
      tile.tileId === "special_brewery_of_legends" &&
      !isPassiveUsed(state, tile, "season") &&
      areHexSetsAdjacent(tile.hexIds, context.placementHexIds)
    ) {
      options.push(
        makeOption(tile, {
          kind: "zero",
          cadence: "season",
          required: true
        })
      );
    }

    if (
      context.action === "place" &&
      context.placementHexIds?.length &&
      tile.tileId === "special_labourers_yard" &&
      !isPassiveUsed(state, tile, "round") &&
      areHexSetsAdjacent(tile.hexIds, context.placementHexIds)
    ) {
      options.push(
        makeOption(tile, {
          kind: "discount",
          cadence: "round",
          amount: 2,
          required: true
        })
      );
    }

    const workshopPassiveUsed =
      tile.kind === "core" &&
      tile.tileId === "c13_workshops" &&
      isPassiveUsed(state, tile, "round");
    const workshopRefreshModifier = workshopPassiveUsed
      ? getPassiveRefreshModifier(state, tile)
      : undefined;
    if (
      context.action === "upgrade" &&
      context.targetTile?.kind === "core" &&
      tile.kind === "core" &&
      tile.tileId === "c13_workshops" &&
      (!workshopPassiveUsed || Boolean(workshopRefreshModifier))
    ) {
      const isBasicWorkshop = tile.side === "basic";
      const applies = isBasicWorkshop
        ? areHexSetsAdjacent(tile.hexIds, context.targetTile.hexIds)
        : isTileReachable(state, context.playerId, context.targetTile.instanceId);
      if (applies) {
        options.push(
          makeOption(tile, {
            kind: "discount",
            cadence: "round",
            amount: isBasicWorkshop ? 1 : 2,
            boonModifierId: workshopRefreshModifier?.id,
            required: !workshopPassiveUsed
          })
        );
      }
    }

    const marketPassiveUsed =
      tile.kind === "core" &&
      tile.tileId === "c14_market_stalls" &&
      isPassiveUsed(state, tile, "round");
    const marketRefreshModifier = marketPassiveUsed
      ? getPassiveRefreshModifier(state, tile)
      : undefined;
    if (
      tile.kind === "core" &&
      tile.tileId === "c14_market_stalls" &&
      (!marketPassiveUsed || Boolean(marketRefreshModifier)) &&
      state.warehouse.goods > 0
    ) {
      const resourceChoices = getMarketResourceChoices(context.cost);
      if (resourceChoices.length > 0) {
        options.push(
          makeOption(tile, {
            kind: "market",
            cadence: "round",
            marketRate: tile.side === "upgraded" ? 2 : 1,
            boonModifierId: marketRefreshModifier?.id,
            resourceChoices
          })
        );
      }
    }
  }

  return options;
}

function getEffectiveSelectedOptions(
  options: PassiveCostOption[],
  selection: CostChoiceSelection
): PassiveCostOption[] {
  const selectedIds = new Set(selection.selectedOptionIds);
  const spentRefreshModifierIds = new Set<string>();

  return options.filter((option) => {
    if (!selectedIds.has(option.id)) return false;
    if (!option.boonModifierId) return true;
    if (spentRefreshModifierIds.has(option.boonModifierId)) return false;
    spentRefreshModifierIds.add(option.boonModifierId);
    return true;
  });
}

export function applyCostChoice(
  state: GameState,
  baseCost: ResourceCost,
  options: PassiveCostOption[],
  selection: CostChoiceSelection = { selectedOptionIds: [] }
): ResourceCost {
  let next = { ...baseCost };

  for (const option of getEffectiveSelectedOptions(options, selection)) {

    if (option.kind === "zero") {
      next = emptyCost();
    } else if (option.kind === "discount") {
      const selectedResource = selection.discountResourceByOptionId?.[option.id];
      if (selectedResource && option.resourceChoices?.includes(selectedResource)) {
        next = {
          ...next,
          [selectedResource]: Math.max(
            0,
            next[selectedResource] - (option.amount ?? 0)
          )
        };
      } else {
        next = applyFlexibleCostReduction(next, state.warehouse, option.amount ?? 0);
      }
    } else if (option.kind === "market") {
      const resource = selection.marketResourceByOptionId?.[option.id];
      if (!resource || resource === "goods") continue;
      const reduction = Math.min(next[resource], option.marketRate ?? 1);
      if (reduction <= 0) continue;
      next = {
        ...next,
        [resource]: next[resource] - reduction,
        goods: next.goods + 1
      };
    } else if (option.kind === "substitute") {
      const from = option.substituteFrom;
      const to = option.resourceChoices?.[0];
      if (!from || !to || next[from] <= 0) continue;
      next = {
        ...next,
        [from]: next[from] - 1,
        [to]: next[to] + 1
      };
    }
  }

  return next;
}

export function findAffordableCostSelection(
  state: GameState,
  baseCost: ResourceCost,
  options: PassiveCostOption[]
): CostChoiceSelection | null {
  if (canAfford(state.warehouse, baseCost) && !options.some((option) => option.required)) {
    return { selectedOptionIds: [] };
  }

  let visits = 0;
  const search = (
    index: number,
    selection: CostChoiceSelection
  ): CostChoiceSelection | null => {
    visits += 1;
    if (visits > 50_000) return null;
    if (index >= options.length) {
      if (!validateCostChoiceSelection(options, selection)) return null;
      const cost = applyCostChoice(state, baseCost, options, selection);
      return canAfford(state.warehouse, cost) ? selection : null;
    }

    const option = options[index];
    if (!option.required) {
      const skipped = search(index + 1, selection);
      if (skipped) return skipped;
    }

    const selectedOptionIds = [...selection.selectedOptionIds, option.id];
    if (option.kind === "market") {
      for (const resource of option.resourceChoices ?? []) {
        const found = search(index + 1, {
          ...selection,
          selectedOptionIds,
          marketResourceByOptionId: {
            ...selection.marketResourceByOptionId,
            [option.id]: resource
          }
        });
        if (found) return found;
      }
      return null;
    }

    if (option.kind === "discount" && option.resourceChoices?.length) {
      for (const resource of option.resourceChoices) {
        const found = search(index + 1, {
          ...selection,
          selectedOptionIds,
          discountResourceByOptionId: {
            ...selection.discountResourceByOptionId,
            [option.id]: resource
          }
        });
        if (found) return found;
      }
      return null;
    }

    return search(index + 1, { ...selection, selectedOptionIds });
  };

  return search(0, { selectedOptionIds: [] });
}

export function validateCostChoiceSelection(
  options: PassiveCostOption[],
  selection: CostChoiceSelection = { selectedOptionIds: [] }
): boolean {
  const optionsById = new Map(options.map((option) => [option.id, option]));
  const selectedIds = new Set(selection.selectedOptionIds);
  const spentRefreshModifierIds = new Set<string>();

  if (selectedIds.size !== selection.selectedOptionIds.length) return false;

  if (options.some((option) => option.required && !selectedIds.has(option.id))) {
    return false;
  }

  for (const optionId of selection.selectedOptionIds) {
    const option = optionsById.get(optionId);
    if (!option) return false;

    if (option.boonModifierId) {
      if (spentRefreshModifierIds.has(option.boonModifierId)) return false;
      spentRefreshModifierIds.add(option.boonModifierId);
    }

    if (option.kind === "market") {
      const resource = selection.marketResourceByOptionId?.[option.id];
      if (!resource || !option.resourceChoices?.includes(resource)) return false;
    }

    if (option.kind === "discount" && option.resourceChoices?.length) {
      const resource = selection.discountResourceByOptionId?.[option.id];
      if (!resource || !option.resourceChoices.includes(resource)) return false;
    }
  }

  return true;
}

export function recordPassiveCostChoices(
  state: GameState,
  options: PassiveCostOption[],
  selection: CostChoiceSelection = { selectedOptionIds: [] }
): GameState {
  if (selection.selectedOptionIds.length === 0) return state;
  const selectedOptions = getEffectiveSelectedOptions(options, selection).filter(
    (option) => (option.sourceKind ?? "tile") === "tile"
  );
  if (selectedOptions.length === 0) return state;

  const consumedBoonModifierIds = new Set(
    selectedOptions.flatMap((option) =>
      option.boonModifierId ? [option.boonModifierId] : []
    )
  );

  return {
    ...state,
    boonModifiers: state.boonModifiers.flatMap((modifier) => {
      if (!consumedBoonModifierIds.has(modifier.id)) return [modifier];
      const remainingUses = modifier.remainingUses - 1;
      return remainingUses > 0 ? [{ ...modifier, remainingUses }] : [];
    }),
    tileActivationRecords: {
      ...state.tileActivationRecords,
      ...Object.fromEntries(
        selectedOptions.map((option) => [
          option.sourceTileId,
          {
            ...state.tileActivationRecords[option.sourceTileId],
            ...(option.cadence === "season"
              ? { season: state.season }
              : { round: state.round })
          }
        ])
      )
    }
  };
}

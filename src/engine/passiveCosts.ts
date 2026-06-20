import { resources } from "../data/resources";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import { isTileReachable } from "./reachability";
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

function getPlacedTileName(tile: PlacedTile): string {
  if (tile.kind === "special") return specialTileById[tile.tileId]?.name ?? tile.tileId;
  const data = coreTileById[tile.tileId];
  return tile.side === "upgraded" ? data.upgraded.name : data.basic.name;
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
      context.category === "housing" &&
      context.placementHexIds?.length &&
      tile.tileId === "special_brewery_of_legends" &&
      !isPassiveUsed(state, tile, "season") &&
      areHexSetsAdjacent(tile.hexIds, context.placementHexIds)
    ) {
      options.push(makeOption(tile, { kind: "zero", cadence: "season" }));
    }

    if (
      context.action === "place" &&
      context.placementHexIds?.length &&
      tile.tileId === "special_labourers_yard" &&
      !isPassiveUsed(state, tile, "round") &&
      areHexSetsAdjacent(tile.hexIds, context.placementHexIds)
    ) {
      options.push(makeOption(tile, { kind: "discount", cadence: "round", amount: 2 }));
    }

    if (
      context.action === "upgrade" &&
      context.targetTile?.kind === "core" &&
      tile.kind === "core" &&
      tile.tileId === "c13_workshops" &&
      !isPassiveUsed(state, tile, "round")
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
            amount: isBasicWorkshop ? 1 : 2
          })
        );
      }
    }

    if (
      tile.kind === "core" &&
      tile.tileId === "c14_market_stalls" &&
      !isPassiveUsed(state, tile, "round") &&
      state.warehouse.goods > 0
    ) {
      const resourceChoices = getMarketResourceChoices(context.cost);
      if (resourceChoices.length > 0) {
        options.push(
          makeOption(tile, {
            kind: "market",
            cadence: "round",
            marketRate: tile.side === "upgraded" ? 2 : 1,
            resourceChoices
          })
        );
      }
    }
  }

  return options;
}

export function applyCostChoice(
  state: GameState,
  baseCost: ResourceCost,
  options: PassiveCostOption[],
  selection: CostChoiceSelection = { selectedOptionIds: [] }
): ResourceCost {
  let next = { ...baseCost };
  const selectedIds = new Set(selection.selectedOptionIds);

  for (const option of options) {
    if (!selectedIds.has(option.id)) continue;

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
    }
  }

  return next;
}

export function validateCostChoiceSelection(
  options: PassiveCostOption[],
  selection: CostChoiceSelection = { selectedOptionIds: [] }
): boolean {
  const optionsById = new Map(options.map((option) => [option.id, option]));
  const selectedIds = new Set(selection.selectedOptionIds);

  if (options.some((option) => option.required && !selectedIds.has(option.id))) {
    return false;
  }

  for (const optionId of selection.selectedOptionIds) {
    const option = optionsById.get(optionId);
    if (!option) return false;

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
  const selectedIds = new Set(selection.selectedOptionIds);
  const selectedOptions = options.filter(
    (option) => selectedIds.has(option.id) && (option.sourceKind ?? "tile") === "tile"
  );
  if (selectedOptions.length === 0) return state;

  return {
    ...state,
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

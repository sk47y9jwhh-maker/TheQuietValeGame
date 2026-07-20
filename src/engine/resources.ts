import { resources } from "../data/resources";
import type { ResourceCost, WarehouseState } from "./types";

export function canAfford(warehouse: WarehouseState, cost: ResourceCost): boolean {
  return resources.every((resource) => warehouse[resource] >= cost[resource]);
}

export function getMissingResources(
  warehouse: WarehouseState,
  cost: ResourceCost
): string[] {
  return resources
    .filter((resource) => warehouse[resource] < cost[resource])
    .map((resource) => {
      const missing = cost[resource] - warehouse[resource];
      return `${missing} ${resource}`;
    });
}

export function spendResources(
  warehouse: WarehouseState,
  cost: ResourceCost
): WarehouseState {
  const next = { ...warehouse };
  for (const resource of resources) {
    next[resource] -= cost[resource];
  }
  return next;
}

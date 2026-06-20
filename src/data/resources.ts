import type { ResourceType, WarehouseState } from "../engine/types";

export const resources: ResourceType[] = [
  "wood",
  "stone",
  "metal",
  "food",
  "herbs",
  "goods"
];

export const resourceLabels: Record<ResourceType, string> = {
  wood: "Wood",
  stone: "Stone",
  metal: "Metal",
  food: "Food",
  herbs: "Herbs",
  goods: "Goods"
};

export const warehouseCap = 15;

export function createWarehouse(amount: number): WarehouseState {
  return {
    wood: amount,
    stone: amount,
    metal: amount,
    food: amount,
    herbs: amount,
    goods: amount
  };
}


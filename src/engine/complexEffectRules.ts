import { encounterById } from "../data/encounters";
import { resources } from "../data/resources";
import { coreTileById, specialTileById } from "../data/tiles";
import { getHexNeighbors } from "./hex";
import type {
  EffectAdjustment,
  GameState,
  PlacedTile,
  ResourceType,
  TileCategory
} from "./types";

export type ComplexBoonRule =
  | {
      kind: "tradeFestival";
      maxGoods: number;
      supportsHousing: boolean;
    }
  | {
      kind: "settlementOfPlenty";
      minimumGroupSize: number;
      maxStrainRemoval: number;
      resourceGain: number;
    }
  | {
      kind: "hearthsSoftenFeuds";
      maxHousingTargets: number;
      maxStrainRemoval: number;
      requiresSingleCluster: boolean;
    };

export interface TradeFestivalOption {
  tile: PlacedTile;
  goodsGain: number;
  supportTargetIds: string[];
}

const selfOrAdjacentStrainReliefTileIds = new Set([
  "c09_tavern",
  "c10_eatery",
  "c11_washhouse",
  "c12_apothecary",
  "c21_the_vaults"
]);

function getPlacedTileCategory(tile: PlacedTile): TileCategory {
  return tile.kind === "special"
    ? specialTileById[tile.tileId]?.category ?? "special"
    : coreTileById[tile.tileId]?.category ?? "special";
}

function areTilesAdjacent(left: PlacedTile, right: PlacedTile): boolean {
  return left.hexIds.some((hexId) =>
    getHexNeighbors(hexId).some((neighborId) => right.hexIds.includes(neighborId))
  );
}

function getAdjacentTiles(state: Pick<GameState, "map">, tile: PlacedTile): PlacedTile[] {
  return state.map.placedTiles.filter(
    (candidate) =>
      candidate.instanceId !== tile.instanceId && areTilesAdjacent(tile, candidate)
  );
}

function getConnectedGroups(tiles: readonly PlacedTile[]): PlacedTile[][] {
  const remaining = new Map(tiles.map((tile) => [tile.instanceId, tile]));
  const groups: PlacedTile[][] = [];

  while (remaining.size > 0) {
    const first = remaining.values().next().value as PlacedTile;
    remaining.delete(first.instanceId);
    const queue = [first];
    const group: PlacedTile[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      group.push(current);

      for (const candidate of [...remaining.values()]) {
        if (!areTilesAdjacent(current, candidate)) continue;
        remaining.delete(candidate.instanceId);
        queue.push(candidate);
      }
    }

    groups.push(group);
  }

  return groups;
}

function getBoonSeasonIndex(effectText: string, cardId: string): number {
  const card = encounterById[cardId];
  if (!card || card.type !== "boon") return -1;
  return [card.effects.season1, card.effects.season2, card.effects.season3].indexOf(
    effectText
  );
}

export function getComplexBoonRule(effectText: string): ComplexBoonRule | null {
  const tradeFestivalSeason = getBoonSeasonIndex(
    effectText,
    "boon_festival_of_trade"
  );
  if (tradeFestivalSeason >= 0) {
    return {
      kind: "tradeFestival",
      maxGoods: [2, 4, 6][tradeFestivalSeason],
      supportsHousing: tradeFestivalSeason > 0
    };
  }

  const settlementSeason = getBoonSeasonIndex(
    effectText,
    "boon_the_settlement_of_plenty"
  );
  if (settlementSeason >= 0) {
    return {
      kind: "settlementOfPlenty",
      minimumGroupSize: [3, 4, 5][settlementSeason],
      maxStrainRemoval: [1, 2, 3][settlementSeason],
      resourceGain: [2, 3, 5][settlementSeason]
    };
  }

  const hearthsSeason = getBoonSeasonIndex(
    effectText,
    "boon_hearths_soften_feuds"
  );
  if (hearthsSeason >= 0) {
    return {
      kind: "hearthsSoftenFeuds",
      maxHousingTargets: [1, 2, 3][hearthsSeason],
      maxStrainRemoval: [1, 2, 2][hearthsSeason],
      requiresSingleCluster: hearthsSeason === 2
    };
  }

  return null;
}

export function isSelfOrAdjacentStrainReliefEffect(
  sourceTile: PlacedTile | undefined,
  effectText: string
): boolean {
  if (
    !sourceTile ||
    sourceTile.kind !== "core" ||
    !selfOrAdjacentStrainReliefTileIds.has(sourceTile.tileId)
  ) {
    return false;
  }

  const data = coreTileById[sourceTile.tileId];
  const side = sourceTile.side === "upgraded" ? data?.upgraded : data?.basic;
  return side?.effectText === effectText;
}

export function getTradeFestivalOptions(
  state: GameState,
  effectText: string
): TradeFestivalOption[] {
  const rule = getComplexBoonRule(effectText);
  if (rule?.kind !== "tradeFestival") return [];

  return state.map.placedTiles
    .filter((tile) => getPlacedTileCategory(tile) === "merchant")
    .map((tile) => {
      const adjacentTiles = getAdjacentTiles(state, tile);
      const goodsGain = Math.min(
        rule.maxGoods,
        new Set(adjacentTiles.map(getPlacedTileCategory)).size
      );
      const supportTargetIds = rule.supportsHousing
        ? adjacentTiles
            .filter(
              (candidate) =>
                getPlacedTileCategory(candidate) === "housing" &&
                !candidate.support.passive &&
                !candidate.support.singleUse
            )
            .map((candidate) => candidate.instanceId)
        : [];

      return { tile, goodsGain, supportTargetIds };
    });
}

export function getSettlementOfPlentyGroups(
  state: GameState,
  effectText: string
): PlacedTile[][] {
  const rule = getComplexBoonRule(effectText);
  if (rule?.kind !== "settlementOfPlenty") return [];

  return getConnectedGroups(state.map.placedTiles.filter((tile) => tile.strain < 3))
    .filter((group) => group.length >= rule.minimumGroupSize);
}

export function getSettlementOfPlentyTargetIds(
  state: GameState,
  effectText: string
): Set<string> {
  return new Set(
    getSettlementOfPlentyGroups(state, effectText).flatMap((group) =>
      group.map((tile) => tile.instanceId)
    )
  );
}

function getHousingGroups(state: GameState): PlacedTile[][] {
  return getConnectedGroups(
    state.map.placedTiles.filter(
      (tile) => tile.strain < 3 && getPlacedTileCategory(tile) === "housing"
    )
  );
}

export function getClusteredHousingIds(state: GameState): Set<string> {
  return new Set(
    getHousingGroups(state)
      .filter((group) => group.length >= 2)
      .flatMap((group) => group.map((tile) => tile.instanceId))
  );
}

function hasOnlyResourceDelta(
  adjustment: EffectAdjustment,
  resource: ResourceType,
  amount: number
): boolean {
  return resources.every(
    (candidate) =>
      (adjustment.resourceDeltas?.[candidate] ?? 0) ===
      (candidate === resource ? amount : 0)
  );
}

function isTradeFestivalAdjustmentValid(
  state: GameState,
  effectText: string,
  adjustment: EffectAdjustment
): boolean {
  const selectedIds = [...new Set(adjustment.selectedTileIds ?? [])];
  if (selectedIds.length !== 1) return false;

  const option = getTradeFestivalOptions(state, effectText).find(
    (candidate) => candidate.tile.instanceId === selectedIds[0]
  );
  if (!option || !hasOnlyResourceDelta(adjustment, "goods", option.goodsGain)) {
    return false;
  }

  const supportIds = [...new Set(adjustment.supportTileIds ?? [])];
  if (option.supportTargetIds.length === 0) return supportIds.length === 0;
  return supportIds.length === 1 && option.supportTargetIds.includes(supportIds[0]);
}

function isSettlementOfPlentyAdjustmentValid(
  state: GameState,
  effectText: string,
  adjustment: EffectAdjustment,
  rule: Extract<ComplexBoonRule, { kind: "settlementOfPlenty" }>
): boolean {
  const groups = getSettlementOfPlentyGroups(state, effectText);
  if (groups.length === 0 || (adjustment.supportTileIds?.length ?? 0) > 0) {
    return false;
  }

  const strainEntries = Object.entries(adjustment.tileStrainDeltas ?? {}).filter(
    ([, delta]) => delta !== 0
  );
  const strainRemoved = strainEntries.reduce(
    (total, [, delta]) => total + Math.max(0, -delta),
    0
  );
  const resourceGain = resources.reduce(
    (total, resource) =>
      total + Math.max(0, adjustment.resourceDeltas?.[resource] ?? 0),
    0
  );

  if (strainRemoved > 0) {
    if (
      resourceGain !== 0 ||
      strainRemoved > rule.maxStrainRemoval ||
      strainEntries.some(([, delta]) => delta >= 0)
    ) {
      return false;
    }
    const selectedIds = new Set(strainEntries.map(([tileId]) => tileId));
    return groups.some((group) => {
      const groupIds = new Set(group.map((tile) => tile.instanceId));
      return [...selectedIds].every((tileId) => groupIds.has(tileId));
    });
  }

  return (
    resourceGain === rule.resourceGain &&
    resources.every((resource) => {
      const delta = adjustment.resourceDeltas?.[resource] ?? 0;
      return delta >= 0 && (resource === "food" || resource === "goods" || delta === 0);
    })
  );
}

function isHearthsSoftenFeudsAdjustmentValid(
  state: GameState,
  adjustment: EffectAdjustment,
  rule: Extract<ComplexBoonRule, { kind: "hearthsSoftenFeuds" }>
): boolean {
  const supportIds = [...new Set(adjustment.supportTileIds ?? [])];
  if (supportIds.length === 0 || supportIds.length > rule.maxHousingTargets) {
    return false;
  }

  const supportCandidates = new Set(
    state.map.placedTiles
      .filter(
        (tile) =>
          tile.strain < 3 &&
          getPlacedTileCategory(tile) === "housing" &&
          !tile.support.passive &&
          !tile.support.singleUse
      )
      .map((tile) => tile.instanceId)
  );
  if (supportIds.some((tileId) => !supportCandidates.has(tileId))) return false;

  const housingGroups = getHousingGroups(state);
  if (
    rule.requiresSingleCluster &&
    !housingGroups.some((group) => {
      const groupIds = new Set(group.map((tile) => tile.instanceId));
      return supportIds.every((tileId) => groupIds.has(tileId));
    })
  ) {
    return false;
  }

  const strainEntries = Object.entries(adjustment.tileStrainDeltas ?? {}).filter(
    ([, delta]) => delta !== 0
  );
  const clusteredHousingIds = getClusteredHousingIds(state);
  const totalRemoved = strainEntries.reduce(
    (total, [, delta]) => total + Math.max(0, -delta),
    0
  );

  return (
    totalRemoved <= rule.maxStrainRemoval &&
    strainEntries.every(
      ([tileId, delta]) =>
        delta < 0 &&
        supportIds.includes(tileId) &&
        clusteredHousingIds.has(tileId)
    ) &&
    !resources.some((resource) => (adjustment.resourceDeltas?.[resource] ?? 0) !== 0)
  );
}

export function isComplexBoonAdjustmentValid(
  state: GameState,
  effectText: string,
  adjustment: EffectAdjustment
): boolean {
  const rule = getComplexBoonRule(effectText);
  if (!rule) return true;

  if (rule.kind === "tradeFestival") {
    return isTradeFestivalAdjustmentValid(state, effectText, adjustment);
  }
  if (rule.kind === "settlementOfPlenty") {
    return isSettlementOfPlentyAdjustmentValid(state, effectText, adjustment, rule);
  }
  return isHearthsSoftenFeudsAdjustmentValid(state, adjustment, rule);
}

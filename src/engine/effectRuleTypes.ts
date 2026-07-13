import type {
  BoonModifierAction,
  ResourceType,
  Terrain,
  TileCategory
} from "./types";

export interface TileTargetRule {
  anyOf?: TileTargetRule[];
  categories?: TileCategory[];
  tileIds?: string[];
  adjacentToCategories?: TileCategory[];
  notAdjacentToCategories?: TileCategory[];
  adjacentToTerrain?: Terrain[];
  adjacentToSource?: boolean;
  excludeSource?: boolean;
  strain?: "any" | "below3" | "positive" | "oneToTwo" | "zero" | "overstrained";
  supported?: boolean;
  hasRenown?: boolean;
  stewardOccupied?: boolean;
}

export interface TileAdjustmentRule {
  strain?: {
    direction: "place" | "remove";
    maxTotal: number;
    maxPerTile: number;
    maxTargets: number;
  };
  support?: { maxTargets: number };
}

export interface StrainCascadeRule {
  anchorTarget: TileTargetRule;
  anchorStrain: number;
  spreadTarget: TileTargetRule;
  spreadStrain: number;
  maxSpreadTargets: number;
}

export interface TimerAdjustmentRule {
  direction: "add" | "remove";
  limit: number;
  maxTargets?: number;
}

export type AlternativeEffectDefinition =
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

export interface ResourceGainChoiceDefinition {
  resources: ResourceType[];
  amount: number;
  alternativeToStrainRemoval?: boolean;
  upTo?: boolean;
}

export interface ModifierRule {
  actions: BoonModifierAction[];
  amount?: number;
  zeroAction?: boolean;
  allowedCategories?: TileCategory[];
  coreOnly?: boolean;
  uses: number;
}

export interface EffectRule {
  id: string;
  target?: TileTargetRule;
  supportTarget?: TileTargetRule | "housingAdjacentToPrimary";
  tileAdjustment?: TileAdjustmentRule;
  strainCascade?: StrainCascadeRule;
  timer?: TimerAdjustmentRule;
  fixedResources?: Partial<Record<ResourceType, number>>;
  resourceGainChoice?: ResourceGainChoiceDefinition;
  alternative?: AlternativeEffectDefinition;
  exchangeLimit?: number;
  exchangeOptional?: boolean;
  exchangeGoodsMode?: boolean;
  resolveBurden?: { maxTargets: number };
  deckReorder?: { count: number };
  modifier?: ModifierRule;
  helpStands?: { gainPerUnstrained: number; cap: number };
  manualChoice?: boolean;
  optional?: boolean;
  skipWhenNoTarget?: boolean;
  noEffectWhenNoTarget?: boolean;
  fallback?: {
    when: "noTileTarget" | "noArrival";
    rule: EffectRule;
  };
}

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
  sourceOnly?: boolean;
  excludeSource?: boolean;
  side?: "basic" | "upgraded" | "special";
  adjacentToCategoryWithPositiveStrain?: TileCategory;
  exactAdjacentCategoryCount?: { category: TileCategory; count: number };
  minAdjacentPlaced?: number;
  strain?: "any" | "below3" | "positive" | "oneToTwo" | "zero" | "overstrained";
  supported?: boolean;
  hasRenown?: boolean;
  stewardOccupied?: boolean;
  adjacentToStewardOccupied?: boolean;
}

export interface TileAdjustmentRule {
  strain?: {
    direction: "place" | "remove";
    maxTotal: number;
    maxPerTile: number;
    maxTargets: number;
    /** Resolve this much Strain when legal capacity permits. */
    requiredTotal?: number;
    /** Select this many distinct targets when enough legal targets exist. */
    requiredTargets?: number;
    categoryLimits?: Partial<
      Record<TileCategory, { min?: number; max: number }>
    >;
    maxStewardOccupiedTargets?: number;
    maxOtherTargets?: number;
    /**
     * Treat non-Steward targets as a second, linked group. Every such target
     * must be adjacent to a selected Steward-occupied target.
     */
    linkedStewardTargets?: {
      requiredOtherTargetsIfAvailable?: number;
    };
  };
  support?: {
    maxTargets: number;
    /** Require this many different Supported targets when enough are legal. */
    requiredTargets?: number;
  };
  supportCoversStrainTargets?: boolean;
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
    }
  | {
      kind: "pay_total_or_strain";
      resources: ResourceType[];
      resourceStep: number;
      requiredChoices: 1;
      requiredStrainTotal: number;
    }
  | {
      kind: "most_stocked_loss_then_strain";
      resources: ResourceType[];
      resourceStep: number;
      requiredChoices: 1;
      requiredStrainTotal: number;
      strainWhen: "noneLost" | "lessThanRequired";
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
  zeroResourceCost?: boolean;
  allowedCategories?: TileCategory[];
  allowedCategoriesByAction?: Partial<
    Record<BoonModifierAction, TileCategory[]>
  >;
  allowedTileIds?: string[];
  requiresAdjacentCategories?: TileCategory[];
  coreOnly?: boolean;
  uses: number;
  duration?: "once" | "round";
  productionGain?: {
    fixed?: Partial<Record<ResourceType, number>>;
    choice?: { resources: ResourceType[]; amount: number };
  };
  refreshPassiveUse?: boolean;
  supportActionTile?: boolean;
  postActionRuleId?: string;
  postActionRequiresAdjacentCategories?: TileCategory[];
  postActionRequiresAdjacentTerrain?: Terrain[];
}

export interface EffectRule {
  id: string;
  target?: TileTargetRule;
  supportTarget?: TileTargetRule | "housingAdjacentToPrimary";
  tileAdjustment?: TileAdjustmentRule;
  strainCascade?: StrainCascadeRule;
  timer?: TimerAdjustmentRule;
  fixedResources?: Partial<Record<ResourceType, number>>;
  mustAffordFixedCosts?: boolean;
  resourceGainChoice?: ResourceGainChoiceDefinition;
  alternative?: AlternativeEffectDefinition;
  exchangeLimit?: number;
  exchangeOptional?: boolean;
  exchangeGoodsMode?: boolean;
  resolveBurden?: { maxTargets: number };
  deckReorder?: {
    count: number | "all";
    mode?: "reorder" | "moveOneToBottom";
  };
  modifier?: ModifierRule;
  connectedGroup?: {
    requiredCategories: TileCategory[];
    anyOfCategories?: TileCategory[];
  };
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

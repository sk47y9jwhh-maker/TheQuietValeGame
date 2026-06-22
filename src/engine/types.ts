export type PlayerCount = 1 | 2 | 3 | 4;
export type Season = 1 | 2 | 3;
export type GamePhase = "setup" | "seeding" | "reveal" | "turns" | "endRound" | "gameEnd";
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;
export type TileFootprintKind = "single" | "line" | "detached";

export type ResourceType = "wood" | "stone" | "metal" | "food" | "herbs" | "goods";
export type WarehouseState = Record<ResourceType, number>;

export type Terrain =
  | "grasslands"
  | "water"
  | "woodland"
  | "mountains"
  | "heaths"
  | "arable"
  | "ruins";

export type TileCategory =
  | "resource"
  | "housing"
  | "crafting"
  | "merchant"
  | "social"
  | "wellbeing"
  | "travel"
  | "special";

export interface HexData {
  id: string;
  col: string;
  row: number;
  terrain: Terrain;
}

export interface ResourceCost {
  wood: number;
  stone: number;
  metal: number;
  food: number;
  herbs: number;
  goods: number;
}

export interface TilePlacementRequirement {
  terrain?: Terrain[];
  adjacentToCategory?: TileCategory[];
  adjacentToTileIds?: string[];
  adjacentToTerrain?: Terrain[];
  text?: string;
}

export interface TileSideData {
  name: string;
  cost: ResourceCost;
  alternateCostText?: string;
  effectText: string;
  effectType?: "production" | "activated" | "passive" | "other";
  production?: ResourceCost;
  population: number;
  renown: number;
}

export interface CoreTileData {
  id: string;
  category: Exclude<TileCategory, "special">;
  count: number;
  size: number;
  footprint?: TileFootprintKind;
  placement?: TilePlacementRequirement;
  basic: TileSideData;
  upgraded: TileSideData;
}

export interface SpecialTileData {
  id: string;
  name: string;
  category: Exclude<TileCategory, "special">;
  count: number;
  size?: number;
  footprint?: TileFootprintKind;
  unlockSource: string;
  placement?: TilePlacementRequirement;
  effectText: string;
  population: number;
  renown: number;
}

export interface TilePlacementDraft {
  anchorHexId?: string;
  orientation?: HexDirection;
  secondaryHexIds?: string[];
}

export interface TilePlacementSelection extends TilePlacementDraft {
  anchorHexId: string;
}

export interface StewardData {
  id: string;
  name: string;
  startingTerrains: Terrain[];
  powerText: string;
  objectiveText: string;
  objectiveRenown: number;
}

export interface PlayerState {
  id: string;
  name: string;
  stewardId: string;
  stewardHexId: string;
  hasPlacedFirstTile: boolean;
  stewardPowerUsesBySeason: Record<Season, number>;
  temporaryReachHexId?: string;
}

export interface SupportState {
  passive: boolean;
  singleUse: boolean;
  preventedThisRound: boolean;
}

export interface PlacedTile {
  instanceId: string;
  tileId: string;
  kind: "core" | "special";
  side: "basic" | "upgraded" | "special";
  hexIds: string[];
  strain: number;
  support: SupportState;
}

export interface MapState {
  placedTiles: PlacedTile[];
}

export interface TileSupplyState {
  core: Record<string, number>;
  special: Record<string, number>;
}

export interface SeasonEffectText {
  season1: string;
  season2: string;
  season3: string;
}

export interface BoonData {
  id: string;
  type: "boon";
  name: string;
  flavorText?: string;
  effects: SeasonEffectText;
  lifecycle: string;
}

export interface BurdenData {
  id: string;
  type: "burden";
  name: string;
  flavorText?: string;
  effects: SeasonEffectText;
  resolutionText?: string;
  manageable?: boolean;
}

export interface ArrivalData {
  id: string;
  type: "arrival";
  name: string;
  flavorText?: string;
  requirementText: string;
  rewardSpecialTileIds: string[];
}

export interface GoldenBoonData {
  id: string;
  type: "goldenBoon";
  name: string;
  flavorText?: string;
  effectText: string;
  enabledInOnlinePrototype: false;
}

export type EncounterData = BoonData | BurdenData | ArrivalData | GoldenBoonData;

export interface ActiveArrival {
  cardId: string;
  timerTokens: number;
}

export interface CompletedArrival {
  cardId: string;
  specialTileIds: string[];
}

export interface ActiveBoon {
  cardId: string;
  remainingUses: number;
}

export type BoonModifierAction = "place" | "upgrade" | "arrival" | "burden";

export interface ActiveBoonModifier {
  id: string;
  sourceCardId: string;
  sourceType?: "boon" | "steward";
  name: string;
  effectText: string;
  actions: BoonModifierAction[];
  remainingUses: number;
  amount?: number;
  zeroAction?: boolean;
  allowedCategories?: TileCategory[];
  coreOnly?: boolean;
}

export type PendingEffectSourceType = "card" | "tile" | "system";

export interface EffectAdjustment {
  resourceDeltas?: Partial<Record<ResourceType, number>>;
  arrivalTimerDeltas?: Record<string, number>;
  tileStrainDeltas?: Record<string, number>;
  supportTileIds?: string[];
  stewardHexUpdates?: Record<string, string>;
  temporaryReachHexUpdates?: Record<string, string>;
  ignoredBurdenIds?: string[];
  resolvedBurdenIds?: string[];
}

export interface PendingEffectState {
  id: string;
  sourceType: PendingEffectSourceType;
  sourceId?: string;
  sourceName: string;
  title: string;
  effectText: string;
  detailText?: string;
  resolutionLogMessage?: string;
  suggestedAdjustment?: EffectAdjustment;
  requiresManualChoice?: boolean;
  canCancelWithWardenPower?: boolean;
  canSkip?: boolean;
  skipLabel?: string;
  confirmLabel?: string;
  allowStewardMovementPlayerId?: string;
  allowTemporaryReachPlayerId?: string;
  allowBurdenIgnore?: boolean;
  allowBurdenResolve?: boolean;
  allowWardenRelief?: boolean;
  resourceExchangeLimit?: number;
  resourceExchangeOptional?: boolean;
}

export interface PendingDeckReorderState {
  id: string;
  sourceType: PendingEffectSourceType;
  sourceId?: string;
  sourceName: string;
  title: string;
  effectText: string;
  cardIds: string[];
  canSkip?: boolean;
  skipLabel?: string;
}

export type CostActionType = "place" | "upgrade" | "arrival" | "burden";

export interface PendingCostAction {
  type: CostActionType;
  playerId: string;
  tileId?: string;
  placedTileId?: string;
  cardId?: string;
  placementDraft?: TilePlacementDraft;
}

export interface PassiveCostOption {
  id: string;
  sourceTileId: string;
  sourceKind?: "tile" | "boon";
  sourceName: string;
  effectText: string;
  kind: "discount" | "zero" | "market";
  cadence: "round" | "season";
  amount?: number;
  marketRate?: 1 | 2;
  resourceChoices?: ResourceType[];
  required?: boolean;
}

export interface CostChoiceSelection {
  selectedOptionIds: string[];
  marketResourceByOptionId?: Record<string, ResourceType>;
  discountResourceByOptionId?: Record<string, ResourceType>;
}

export interface PendingCostChoiceState {
  id: string;
  title: string;
  action: PendingCostAction;
  baseCost: ResourceCost;
  actionCost: number;
  boonModifierIds: string[];
  options: PassiveCostOption[];
}

export interface EncounterState {
  handsByPlayerId: Record<string, string[]>;
  deck: string[];
  discardPile: string[];
  activeArrivals: ActiveArrival[];
  activeBurdens: string[];
  faceUpBoons: ActiveBoon[];
  completedArrivals: CompletedArrival[];
  goldenEnabled: false;
}

export interface LogEntry {
  id: string;
  round: number;
  message: string;
}

export interface TileActivationRecord {
  round?: number;
  season?: Season;
}

export interface GameState {
  playerCount: PlayerCount;
  players: PlayerState[];
  currentPlayerId: string;
  season: Season;
  round: number;
  phase: GamePhase;
  actionsRemaining: number;
  playersActedThisRound: string[];
  seasonSeededPlayerIds: string[];
  warehouse: WarehouseState;
  map: MapState;
  tileSupply: TileSupplyState;
  encounters: EncounterState;
  boonModifiers: ActiveBoonModifier[];
  ignoredBurdenIdsThisRound: string[];
  tileActivationRecords: Record<string, TileActivationRecord>;
  pendingEffects: PendingEffectState[];
  pendingDeckReorder: PendingDeckReorderState | null;
  pendingCostChoice: PendingCostChoiceState | null;
  log: LogEntry[];
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

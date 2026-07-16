export type PlayerCount = 1 | 2 | 3 | 4;
export type Season = 1 | 2 | 3;
export type GamePhase =
  | "setup"
  | "goldenSetup"
  | "seeding"
  | "reveal"
  | "turns"
  | "endRound"
  | "gameEnd";
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
  notAdjacentToTerrain?: Terrain[];
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

export interface GoldenTileData extends Omit<SpecialTileData, "category"> {
  golden: true;
  category: TileCategory;
  unlockAt: number;
  linkedGoldenBoonId: string;
  scoringText: string;
  layoutIncentive: string;
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
  lifecycle: string;
  unlockAt: number;
  enabledInOnlinePrototype: true;
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
  lastUsedRound?: number;
  expiresAfterRound?: number;
}

export type BoonModifierAction =
  | "place"
  | "upgrade"
  | "arrival"
  | "burden"
  | "activate"
  | "production"
  | "passive";

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
  zeroResourceCost?: boolean;
  allowedCategories?: TileCategory[];
  allowedCategoriesByAction?: Partial<
    Record<BoonModifierAction, TileCategory[]>
  >;
  allowedTileIds?: string[];
  requiresAdjacentCategories?: TileCategory[];
  coreOnly?: boolean;
  expiresAfterRound?: number;
  productionGain?: {
    fixed?: Partial<Record<ResourceType, number>>;
    choice?: { resources: ResourceType[]; amount: number };
  };
  followUpRuleId?: string;
  refreshPassiveUse?: boolean;
  supportActionTile?: boolean;
  postActionRuleId?: string;
  postActionRequiresAdjacentCategories?: TileCategory[];
  postActionRequiresAdjacentTerrain?: Terrain[];
}

export type PendingEffectSourceType = "card" | "tile" | "system";

export interface EffectAdjustment {
  resourceDeltas?: Partial<Record<ResourceType, number>>;
  arrivalTimerDeltas?: Record<string, number>;
  tileStrainDeltas?: Record<string, number>;
  strainCascadeAnchorTileId?: string;
  supportTileIds?: string[];
  stewardHexUpdates?: Record<string, string>;
  temporaryReachHexUpdates?: Record<string, string>;
  ignoredBurdenIds?: string[];
  resolvedBurdenIds?: string[];
}

export interface EffectControlHints {
  broadResourceChoice: boolean;
  hasResourceAction: boolean;
  hasExplicitResourceAlternative: boolean;
  mentionedResources: ResourceType[];
  timerChoice: boolean;
  tileChoice: boolean;
}

export type TargetCardTileClass = "core" | "specialOrGolden";
export type TargetCardSidePreference = "basic" | "upgraded" | "either";
export type TargetCardAdjacencyPreference = "threePlus" | "zeroToTwo";
export type TargetCardStrainPreference = "strained" | "unstrained";
export type TargetCardDirection = "NE" | "E" | "SE" | "SW" | "W" | "NW";
export type TargetCardFilterName = "class" | "side" | "adjacency" | "strain";

export interface TargetCardDefinition {
  id: number;
  tileClass: TargetCardTileClass;
  side: TargetCardSidePreference;
  adjacency: TargetCardAdjacencyPreference;
  strain: TargetCardStrainPreference;
  direction: TargetCardDirection;
}

export interface TargetCardFilterDiagnostic {
  filter: TargetCardFilterName;
  preference: string;
  applied: boolean;
  beforeCount: number;
  afterCount: number;
}

export interface TargetCardSelectionDiagnostic {
  id: string;
  effectId: string;
  sourceId?: string;
  role: "primary" | "target" | "spread";
  cardId: number;
  originalEligibleCount: number;
  filters: TargetCardFilterDiagnostic[];
  direction: TargetCardDirection;
  directionRequired: boolean;
  directionCandidateCount: number;
  coordinateFallbackUsed: boolean;
  selectedTileId: string;
  selectedHexIds: string[];
  plannedStrain?: number;
  supportedWillPrevent: boolean;
  goldenGardenWillPrevent: boolean;
  strainApplied?: boolean;
  actualStrainPlaced?: number;
  supportedPrevented?: boolean;
  goldenGardenPrevented?: boolean;
  printedFallbackUsed?: boolean;
  linkedSecondaryAvailable?: boolean;
  linkedSecondaryCompleted?: boolean;
  alternatePrimaryWouldComplete?: boolean;
}

export interface TargetCardDeckState {
  enabled: boolean;
  seed: string;
  drawPile: number[];
  discardPile: number[];
  drawCount: number;
  reshuffleCount: number;
  history: TargetCardSelectionDiagnostic[];
}

export interface PendingEffectState {
  id: string;
  ruleId: string;
  sourceType: PendingEffectSourceType;
  sourceId?: string;
  sourceName: string;
  title: string;
  effectText: string;
  detailText?: string;
  resolutionLogMessage?: string;
  suggestedAdjustment?: EffectAdjustment;
  controlHints?: EffectControlHints;
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
  /** Set once the opt-in Target Card system has considered this effect. */
  targetCardPrepared?: boolean;
  /** The only tiles the automatic draw selected for positive Strain. */
  targetCardTargetTileIds?: string[];
  targetCardPlannedStrainByTileId?: Record<string, number>;
  targetCardDiagnostics?: TargetCardSelectionDiagnostic[];
}

export interface PendingDeckReorderState {
  id: string;
  sourceType: PendingEffectSourceType;
  sourceId?: string;
  sourceName: string;
  title: string;
  effectText: string;
  cardIds: string[];
  mode?: "reorder" | "moveOneToBottom";
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
  kind: "discount" | "zero" | "market" | "substitute";
  cadence: "round" | "season";
  amount?: number;
  marketRate?: 1 | 2;
  substituteFrom?: ResourceType;
  boonModifierId?: string;
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
  reserveBoonIds: string[];
  reserveArrivalIds: string[];
  selectedGoldenBoonId?: string;
  goldenEnabled: boolean;
}

export interface GoldenSetupState {
  selectedTileId?: string;
  selectedBoonId?: string;
  tilePlaced: boolean;
  tileSkipped: boolean;
}

export interface PendingGoldenBellState {
  kind: "bell";
  cardId: string;
  arrivalCardIds: string[];
}

export interface PendingGoldenScrollState {
  kind: "scroll";
  cardId: string;
}

export interface PendingGoldenSignetState {
  kind: "signet";
  cardId: string;
}

export type PendingGoldenEffectState =
  | PendingGoldenBellState
  | PendingGoldenScrollState
  | PendingGoldenSignetState;

export interface LogEntry {
  id: string;
  round: number;
  message: string;
}

export interface TileActivationRecord {
  round?: number;
  season?: Season;
  linkedProductionRound?: number;
}

export interface LedgerSeasonSnapshot {
  activeBurdens: number;
  overstrainedTiles: number;
  arrivalsCompleted: number;
  burdensResolved: number;
}

export interface LedgerArrivalCompletionEvent {
  cardId: string;
  round: number;
  season: Season;
  specialTileIds: string[];
  timerTokens?: number;
}

export interface LedgerBurdenEvent {
  cardId: string;
  round: number;
  season: Season;
}

export interface LedgerRunState {
  gameId: string;
  declaredVowId?: string;
  recorded: boolean;
  arrivalsRevealed: number;
  arrivalsCompleted: number;
  arrivalsExpired: number;
  burdensRevealed: number;
  burdensResolved: number;
  arrivalsCompletedBySeason: Record<Season, number>;
  burdensResolvedBySeason: Record<Season, number>;
  burdensRevealedBySeason: Record<Season, number>;
  arrivalCompletionEvents: LedgerArrivalCompletionEvent[];
  burdenRevealEvents: LedgerBurdenEvent[];
  burdenResolutionEvents: LedgerBurdenEvent[];
  strainPreventedBySupported: number;
  strainRemovedByRoundCategory: Record<string, Partial<Record<TileCategory, number>>>;
  maxOverstrainedTiles: number;
  rangerPowerTerrainTypes: Terrain[];
  upgradeActions: number;
  warehousePeakByResource: WarehouseState;
  seasonSnapshots: Partial<Record<Season, LedgerSeasonSnapshot>>;
  violatedVowReasons: string[];
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
  goldenSetup: GoldenSetupState;
  pendingGoldenEffect: PendingGoldenEffectState | null;
  bonusTurnsPending: boolean;
  bonusTurnsActive: boolean;
  boonModifiers: ActiveBoonModifier[];
  ignoredBurdenIdsThisRound: string[];
  tileActivationRecords: Record<string, TileActivationRecord>;
  pendingEffects: PendingEffectState[];
  pendingDeckReorder: PendingDeckReorderState | null;
  pendingCostChoice: PendingCostChoiceState | null;
  /** Optional for backwards-compatible saves; new games always initialise it. */
  targetCards?: TargetCardDeckState;
  ledgerRun?: LedgerRunState;
  log: LogEntry[];
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
  missingResources?: Partial<Record<ResourceType, number>>;
}

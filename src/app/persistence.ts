import { resources, warehouseCap } from "../data/resources";
import { stewardById } from "../data/stewards";
import { coreTiles } from "../data/tiles";
import type { GamePhase, GameState, PlayerCount, Season } from "../engine/types";
import {
  createTargetCardDeckState,
  normalizeTargetCardDeckState
} from "../engine/targetCards";
import { readStoredJson, removeStoredItems, writeStoredJson } from "./browserStorage";

const saveVersion = 4;
const gameSaveKey = "quietVale.activeGame.v1";
const setupSaveKey = "quietVale.setup.v1";
const resourceTileIds = new Set(
  coreTiles.filter((tile) => tile.category === "resource").map((tile) => tile.id)
);

export interface SavedSetup {
  version: number;
  savedAt: string;
  playerCount: PlayerCount;
  stewardIds: string[];
  encounterSeed: string;
  declaredVowId?: string;
  selectedGoldenTileId?: string;
  selectedGoldenBoonId?: string;
}

export interface SavedGame extends SavedSetup {
  state: GameState;
}

function isPlayerCount(value: unknown): value is PlayerCount {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isSeason(value: unknown): value is Season {
  return value === 1 || value === 2 || value === 3;
}

function isGamePhase(value: unknown): value is GamePhase {
  return (
    value === "setup" ||
    value === "goldenSetup" ||
    value === "seeding" ||
    value === "reveal" ||
    value === "turns" ||
    value === "endRound" ||
    value === "gameEnd"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonNegativeIntegerRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isNonNegativeInteger);
}

function isWarehouseShape(value: unknown): value is GameState["warehouse"] {
  return (
    isRecord(value) &&
    resources.every(
      (resource) =>
        isNonNegativeInteger(value[resource]) && value[resource] <= warehouseCap
    )
  );
}

function isPlayerShape(value: unknown): value is GameState["players"][number] {
  if (!isRecord(value)) return false;
  const stewardPowerUsesBySeason = value.stewardPowerUsesBySeason;
  if (!isRecord(stewardPowerUsesBySeason)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.stewardId === "string" &&
    Boolean(stewardById[value.stewardId]) &&
    typeof value.stewardHexId === "string" &&
    typeof value.hasPlacedFirstTile === "boolean" &&
    [1, 2, 3].every((season) =>
      isNonNegativeInteger(stewardPowerUsesBySeason[season])
    ) &&
    (value.temporaryReachHexId === undefined ||
      typeof value.temporaryReachHexId === "string")
  );
}

function isPlacedTileShape(value: unknown): value is GameState["map"]["placedTiles"][number] {
  if (!isRecord(value) || !isRecord(value.support)) return false;
  return (
    typeof value.instanceId === "string" &&
    typeof value.tileId === "string" &&
    (value.kind === "core" || value.kind === "special") &&
    (value.side === "basic" || value.side === "upgraded" || value.side === "special") &&
    isStringArray(value.hexIds) &&
    value.hexIds.length > 0 &&
    isNonNegativeInteger(value.strain) &&
    value.strain <= 3 &&
    typeof value.support.passive === "boolean" &&
    typeof value.support.singleUse === "boolean" &&
    typeof value.support.preventedThisRound === "boolean"
  );
}

function isHandsByPlayerShape(value: unknown): value is Record<string, string[]> {
  return isRecord(value) && Object.values(value).every(isStringArray);
}

function isActiveArrivalShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.cardId === "string" &&
    isNonNegativeInteger(value.timerTokens)
  );
}

function isActiveBoonShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.cardId === "string" &&
    isNonNegativeInteger(value.remainingUses) &&
    (value.lastUsedRound === undefined || isNonNegativeInteger(value.lastUsedRound)) &&
    (value.expiresAfterRound === undefined || isNonNegativeInteger(value.expiresAfterRound))
  );
}

function isCompletedArrivalShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.cardId === "string" &&
    isStringArray(value.specialTileIds)
  );
}

function isBoonModifierShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sourceCardId === "string" &&
    typeof value.name === "string" &&
    typeof value.effectText === "string" &&
    isStringArray(value.actions) &&
    isNonNegativeInteger(value.remainingUses)
  );
}

function isLogEntryShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isNonNegativeInteger(value.round) &&
    typeof value.message === "string"
  );
}

function isOptionalRecord(value: unknown): boolean {
  return value === undefined || value === null || isRecord(value);
}

function isSavedGameStateShape(value: unknown): value is GameState {
  if (!isRecord(value)) return false;

  const players = value.players;
  const map = value.map;
  const tileSupply = value.tileSupply;
  const encounters = value.encounters;

  return (
    isPlayerCount(value.playerCount) &&
    Array.isArray(players) &&
    players.length === value.playerCount &&
    players.every(isPlayerShape) &&
    new Set(players.map((player) => player.id)).size === players.length &&
    typeof value.currentPlayerId === "string" &&
    players.some((player) => player.id === value.currentPlayerId) &&
    isSeason(value.season) &&
    isNonNegativeInteger(value.round) &&
    value.round >= 1 &&
    value.round <= 12 &&
    isGamePhase(value.phase) &&
    isNonNegativeInteger(value.actionsRemaining) &&
    isStringArray(value.playersActedThisRound) &&
    isStringArray(value.seasonSeededPlayerIds) &&
    isWarehouseShape(value.warehouse) &&
    isRecord(map) &&
    Array.isArray(map.placedTiles) &&
    map.placedTiles.every(isPlacedTileShape) &&
    isRecord(tileSupply) &&
    isNonNegativeIntegerRecord(tileSupply.core) &&
    isNonNegativeIntegerRecord(tileSupply.special) &&
    isRecord(encounters) &&
    isHandsByPlayerShape(encounters.handsByPlayerId) &&
    isStringArray(encounters.deck) &&
    isStringArray(encounters.discardPile) &&
    Array.isArray(encounters.activeArrivals) &&
    encounters.activeArrivals.every(isActiveArrivalShape) &&
    isStringArray(encounters.activeBurdens) &&
    Array.isArray(encounters.faceUpBoons) &&
    encounters.faceUpBoons.every(isActiveBoonShape) &&
    Array.isArray(encounters.completedArrivals) &&
    encounters.completedArrivals.every(isCompletedArrivalShape) &&
    (encounters.reserveBoonIds === undefined || isStringArray(encounters.reserveBoonIds)) &&
    (encounters.reserveArrivalIds === undefined || isStringArray(encounters.reserveArrivalIds)) &&
    Array.isArray(value.boonModifiers) &&
    value.boonModifiers.every(isBoonModifierShape) &&
    isStringArray(value.ignoredBurdenIdsThisRound) &&
    (value.tileActivationRecords === undefined || isRecord(value.tileActivationRecords)) &&
    Array.isArray(value.pendingEffects) &&
    value.pendingEffects.every(isRecord) &&
    isOptionalRecord(value.pendingDeckReorder) &&
    isOptionalRecord(value.pendingCostChoice) &&
    isOptionalRecord(value.pendingGoldenEffect) &&
    (value.bonusTurnsPending === undefined || typeof value.bonusTurnsPending === "boolean") &&
    (value.bonusTurnsActive === undefined || typeof value.bonusTurnsActive === "boolean") &&
    Array.isArray(value.log) &&
    value.log.every(isLogEntryShape)
  );
}

function isSavedSetup(value: unknown): value is SavedSetup {
  if (!isRecord(value)) return false;
  return (
    (value.version === 1 || value.version === 2 || value.version === 3 || value.version === saveVersion) &&
    typeof value.savedAt === "string" &&
    isPlayerCount(value.playerCount) &&
    isStringArray(value.stewardIds) &&
    value.stewardIds.length === value.playerCount &&
    new Set(value.stewardIds).size === value.stewardIds.length &&
    value.stewardIds.every((id) => Boolean(stewardById[id])) &&
    typeof value.encounterSeed === "string" &&
    (value.declaredVowId === undefined || typeof value.declaredVowId === "string") &&
    (value.selectedGoldenTileId === undefined || typeof value.selectedGoldenTileId === "string") &&
    (value.selectedGoldenBoonId === undefined || typeof value.selectedGoldenBoonId === "string")
  );
}

function isSavedGame(value: unknown): value is SavedGame {
  if (!isRecord(value) || !isSavedSetup(value)) return false;
  if (!isSavedGameStateShape(value.state)) return false;
  return (
    value.state.playerCount === value.playerCount &&
    value.state.players.every(
      (player, index) => player.stewardId === value.stewardIds[index]
    )
  );
}

export function readSavedSetup(): SavedSetup | null {
  const saved = readStoredJson(setupSaveKey);
  return isSavedSetup(saved)
    ? {
        ...saved,
        version: saveVersion
      }
    : null;
}

export function readSavedGame(): SavedGame | null {
  const saved = readStoredJson(gameSaveKey);
  if (!isSavedGame(saved)) return null;
  const tileSupply = saved.version < 3
    ? {
        ...saved.state.tileSupply,
        core: Object.fromEntries(
          Object.entries(saved.state.tileSupply.core).map(([tileId, remaining]) => [
            tileId,
            resourceTileIds.has(tileId) ? remaining + 1 : remaining
          ])
        )
      }
    : saved.state.tileSupply;
  return {
    ...saved,
    version: saveVersion,
    state: {
      ...saved.state,
      tileSupply,
      goldenSetup: saved.state.goldenSetup ?? {
        selectedTileId: saved.selectedGoldenTileId,
        selectedBoonId: saved.selectedGoldenBoonId,
        tilePlaced: false,
        tileSkipped: false
      },
      pendingGoldenEffect: saved.state.pendingGoldenEffect ?? null,
      bonusTurnsPending: saved.state.bonusTurnsPending ?? false,
      bonusTurnsActive: saved.state.bonusTurnsActive ?? false,
      tileActivationRecords: saved.state.tileActivationRecords ?? {},
      encounters: {
        ...saved.state.encounters,
        reserveBoonIds: saved.state.encounters.reserveBoonIds ?? [],
        reserveArrivalIds: saved.state.encounters.reserveArrivalIds ?? [],
        selectedGoldenBoonId:
          saved.state.encounters.selectedGoldenBoonId ?? saved.selectedGoldenBoonId,
        goldenEnabled: saved.state.encounters.goldenEnabled ?? false
      },
      targetCards: saved.state.targetCards
        ? normalizeTargetCardDeckState(
            saved.state.targetCards,
            `${saved.encounterSeed}:targets`
          )
        : createTargetCardDeckState(`${saved.encounterSeed}:targets`)
    }
  };
}

export function writeSavedSetup(input: Omit<SavedSetup, "version" | "savedAt">) {
  writeStoredJson(setupSaveKey, {
    ...input,
    version: saveVersion,
    savedAt: new Date().toISOString()
  });
}

export function writeSavedGame(input: Omit<SavedGame, "version" | "savedAt">) {
  writeStoredJson(gameSaveKey, {
    ...input,
    version: saveVersion,
    savedAt: new Date().toISOString()
  });
}

export function clearSavedGame() {
  removeStoredItems(gameSaveKey);
}

export function clearAllSaves() {
  removeStoredItems(gameSaveKey, setupSaveKey);
}

export function resetBrowserHistoryAnchor(): number {
  if (typeof window === "undefined") return 0;

  try {
    window.history.replaceState(
      { ...(window.history.state ?? {}), quietValeHistory: true, quietValeIndex: 0 },
      "",
      window.location.href
    );
  } catch {
    // History integration is a convenience; normal in-app Undo still works.
  }

  return 0;
}

export function pushBrowserUndoMarker(index: number) {
  if (typeof window === "undefined") return;

  try {
    window.history.pushState(
      { quietValeHistory: true, quietValeIndex: index },
      "",
      window.location.href
    );
  } catch {
    // History integration is a convenience; normal in-app Undo still works.
  }
}

export function getBrowserHistoryIndex(event: PopStateEvent): number | null {
  const state = event.state as { quietValeHistory?: boolean; quietValeIndex?: unknown } | null;
  if (!state?.quietValeHistory || typeof state.quietValeIndex !== "number") {
    return null;
  }

  return state.quietValeIndex;
}

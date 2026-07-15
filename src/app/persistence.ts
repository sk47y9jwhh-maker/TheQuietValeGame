import { resources } from "../data/resources";
import { coreTiles } from "../data/tiles";
import type { GamePhase, GameState, PlayerCount, Season } from "../engine/types";
import { readStoredJson, removeStoredItems, writeStoredJson } from "./browserStorage";

const saveVersion = 3;
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

function isWarehouseShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    resources.every((resource) => typeof value[resource] === "number")
  );
}

function isSavedGameStateShape(value: unknown): value is GameState {
  if (!isRecord(value)) return false;

  const map = value.map;
  const tileSupply = value.tileSupply;
  const encounters = value.encounters;

  return (
    isPlayerCount(value.playerCount) &&
    Array.isArray(value.players) &&
    typeof value.currentPlayerId === "string" &&
    isSeason(value.season) &&
    typeof value.round === "number" &&
    isGamePhase(value.phase) &&
    typeof value.actionsRemaining === "number" &&
    Array.isArray(value.playersActedThisRound) &&
    Array.isArray(value.seasonSeededPlayerIds) &&
    isWarehouseShape(value.warehouse) &&
    isRecord(map) &&
    Array.isArray(map.placedTiles) &&
    isRecord(tileSupply) &&
    isRecord(tileSupply.core) &&
    isRecord(tileSupply.special) &&
    isRecord(encounters) &&
    isRecord(encounters.handsByPlayerId) &&
    Array.isArray(encounters.deck) &&
    Array.isArray(encounters.discardPile) &&
    Array.isArray(encounters.activeArrivals) &&
    Array.isArray(encounters.activeBurdens) &&
    Array.isArray(encounters.faceUpBoons) &&
    Array.isArray(encounters.completedArrivals) &&
    Array.isArray(value.pendingEffects) &&
    Array.isArray(value.log)
  );
}

function isSavedSetup(value: unknown): value is SavedSetup {
  if (!isRecord(value)) return false;
  return (
    (value.version === 1 || value.version === 2 || value.version === saveVersion) &&
    isPlayerCount(value.playerCount) &&
    Array.isArray(value.stewardIds) &&
    value.stewardIds.every((id) => typeof id === "string") &&
    typeof value.encounterSeed === "string" &&
    (value.declaredVowId === undefined || typeof value.declaredVowId === "string") &&
    (value.selectedGoldenTileId === undefined || typeof value.selectedGoldenTileId === "string") &&
    (value.selectedGoldenBoonId === undefined || typeof value.selectedGoldenBoonId === "string")
  );
}

function isSavedGame(value: unknown): value is SavedGame {
  if (!isRecord(value) || !isSavedSetup(value)) return false;
  return isSavedGameStateShape(value.state);
}

export function readSavedSetup(): SavedSetup | null {
  const saved = readStoredJson(setupSaveKey);
  return isSavedSetup(saved) ? { ...saved, version: saveVersion } : null;
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
      }
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

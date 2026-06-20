import type { GameState, PlayerCount } from "../engine/types";

const saveVersion = 1;
const gameSaveKey = "quietVale.activeGame.v1";
const setupSaveKey = "quietVale.setup.v1";

export interface SavedSetup {
  version: number;
  savedAt: string;
  playerCount: PlayerCount;
  stewardIds: string[];
  encounterSeed: string;
}

export interface SavedGame extends SavedSetup {
  state: GameState;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson<T>(key: string): T | null {
  if (!canUseStorage()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private browsing or quota edge cases; the game remains playable.
  }
}

function isPlayerCount(value: unknown): value is PlayerCount {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isSavedSetup(value: SavedSetup | null): value is SavedSetup {
  return (
    Boolean(value) &&
    value?.version === saveVersion &&
    isPlayerCount(value.playerCount) &&
    Array.isArray(value.stewardIds) &&
    typeof value.encounterSeed === "string"
  );
}

function isSavedGame(value: SavedGame | null): value is SavedGame {
  return isSavedSetup(value) && Boolean(value.state);
}

export function readSavedSetup(): SavedSetup | null {
  const saved = readJson<SavedSetup>(setupSaveKey);
  return isSavedSetup(saved) ? saved : null;
}

export function readSavedGame(): SavedGame | null {
  const saved = readJson<SavedGame>(gameSaveKey);
  return isSavedGame(saved) ? saved : null;
}

export function writeSavedSetup(input: Omit<SavedSetup, "version" | "savedAt">) {
  writeJson(setupSaveKey, {
    ...input,
    version: saveVersion,
    savedAt: new Date().toISOString()
  });
}

export function writeSavedGame(input: Omit<SavedGame, "version" | "savedAt">) {
  writeJson(gameSaveKey, {
    ...input,
    version: saveVersion,
    savedAt: new Date().toISOString()
  });
}

export function clearSavedGame() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(gameSaveKey);
}

export function clearAllSaves() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(gameSaveKey);
  window.localStorage.removeItem(setupSaveKey);
}

export function pushBrowserUndoMarker() {
  if (typeof window === "undefined") return;

  try {
    window.history.pushState({ quietValeUndo: true }, "", window.location.href);
  } catch {
    // History integration is a convenience; normal in-app Undo still works.
  }
}

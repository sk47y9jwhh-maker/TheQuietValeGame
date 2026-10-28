import { getStorageKey } from "./experience";

export type StorageProblem = "unavailable" | "full" | "unreadable";
export type StorageResult = { ok: true } | { ok: false; problem: StorageProblem };
export type StoredRead<T> = { ok: true; value: T | null } | { ok: false; problem: StorageProblem };

function storageProblem(error: unknown): StorageProblem {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ? "full"
    : "unavailable";
}

export function readStoredJsonResult(key: string): StoredRead<unknown> {
  let raw: string | null;
  try {
    if (typeof window === "undefined") return { ok: false, problem: "unavailable" };
    raw = window.localStorage.getItem(getStorageKey(key));
  } catch (error) {
    return { ok: false, problem: storageProblem(error) };
  }
  if (raw === null) return { ok: true, value: null };
  try {
    const value: unknown = JSON.parse(raw);
    // Null is the missing-key marker; a stored null is not a valid save.
    return value === null ? { ok: false, problem: "unreadable" } : { ok: true, value };
  } catch {
    return { ok: false, problem: "unreadable" };
  }
}

export function readStoredJson(key: string): unknown | null {
  const result = readStoredJsonResult(key);
  return result.ok ? result.value : null;
}

export function writeStoredJson(key: string, value: unknown): StorageResult {
  try {
    if (typeof window === "undefined") return { ok: false, problem: "unavailable" };
    window.localStorage.setItem(getStorageKey(key), JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    // Play can continue in memory, but the caller must not report a saved change.
    return { ok: false, problem: storageProblem(error) };
  }
}

export function removeStoredItems(...keys: string[]): StorageResult {
  try {
    if (typeof window === "undefined") return { ok: false, problem: "unavailable" };
    const storage = window.localStorage;
    for (const key of keys) storage.removeItem(getStorageKey(key));
    return { ok: true };
  } catch (error) {
    return { ok: false, problem: storageProblem(error) };
  }
}

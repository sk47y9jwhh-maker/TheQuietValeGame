function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredJson(key: string): unknown | null {
  try {
    const raw = getBrowserStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown): void {
  try {
    getBrowserStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is optional: private browsing and quota limits must not stop play.
  }
}

export function removeStoredItems(...keys: string[]): void {
  const storage = getBrowserStorage();
  if (!storage) return;

  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      // A failed cleanup is harmless; a later valid write can replace the value.
    }
  }
}

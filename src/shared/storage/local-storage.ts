import { STORAGE_KEYS } from "./keys";

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function isBrowser() {
  return typeof window !== "undefined";
}

export const storage = {
  get<T>(key: StorageKey): T | null {
    if (!isBrowser()) return null;

    const value = localStorage.getItem(key);

    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  },

  set<T>(key: StorageKey, value: T) {
    if (!isBrowser()) return;

    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: StorageKey) {
    if (!isBrowser()) return;

    localStorage.removeItem(key);
  },

  clear() {
    if (!isBrowser()) return;

    localStorage.clear();
  },
};

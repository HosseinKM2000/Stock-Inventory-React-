function isBrowser() {
  return typeof window !== "undefined";
}

export const storage = {
  get<T>(key: string): T | null {
    if (!isBrowser()) return null;

    const value = localStorage.getItem(key);

    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  },

  set<T>(key: string, value: T) {
    if (!isBrowser()) return;

    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key: string) {
    if (!isBrowser()) return;

    localStorage.removeItem(key);
  },

  clear() {
    if (!isBrowser()) return;

    localStorage.clear();
  },
};

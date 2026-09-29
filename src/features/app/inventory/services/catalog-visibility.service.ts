import { accessState } from "@/shared/access/access-state";

function storageKey() {
  const userId = accessState.user()?.id ?? "anonymous";
  return `inventory:${userId}:hide-catalog-products`;
}

export const catalogVisibilityService = {
  isHidden() {
    try {
      return localStorage.getItem(storageKey()) === "true";
    } catch {
      return false;
    }
  },

  setHidden(hidden: boolean) {
    try {
      localStorage.setItem(storageKey(), String(hidden));
    } catch {
      // The in-memory UI state still works when storage is unavailable.
    }
  },
};

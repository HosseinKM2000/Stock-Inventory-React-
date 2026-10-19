import type { ProductSort } from "../types";

export type ProductViewMode = "comfortable" | "compact" | "grid";

export type InventoryListContext = {
  search: string;
  sort: ProductSort;
  categoryId: number | null;
  viewMode: ProductViewMode;
  scrollOffset: number;
  anchorProductId: number | null;
};

const VIEW_MODE_KEY = "tanzim-inventory-view-mode-v1";

const context: InventoryListContext = {
  search: "",
  sort: "newest",
  categoryId: null,
  viewMode: readViewMode(),
  scrollOffset: 0,
  anchorProductId: null,
};

function readViewMode(): ProductViewMode {
  try {
    const value = localStorage.getItem(VIEW_MODE_KEY);
    if (value === "comfortable" || value === "compact" || value === "grid") {
      return value;
    }
  } catch {
    // Storage is optional in private browsing contexts.
  }
  return "comfortable";
}

export const inventoryListPreferences = {
  read(): InventoryListContext {
    return { ...context };
  },

  update(value: Partial<InventoryListContext>) {
    Object.assign(context, value);
    if (value.viewMode) {
      try {
        localStorage.setItem(VIEW_MODE_KEY, value.viewMode);
      } catch {
        // Keep the in-memory preference when persistent storage is unavailable.
      }
    }
  },

  rememberEdit(productId: number, scrollOffset: number) {
    context.anchorProductId = productId;
    context.scrollOffset = scrollOffset;
  },

  clearAnchor() {
    context.anchorProductId = null;
  },
};

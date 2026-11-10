import { beforeEach, describe, expect, it, vi } from "vitest";

describe("inventory list preferences", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("persists the display mode while retaining route context in memory", async () => {
    const { inventoryListPreferences } = await import(
      "@/features/app/inventory/services/inventory-list-preferences"
    );
    inventoryListPreferences.update({
      search: "milk",
      categoryId: 12,
      viewMode: "compact",
      scrollOffset: 430,
    });
    inventoryListPreferences.rememberEdit(81, 460);

    expect(inventoryListPreferences.read()).toMatchObject({
      search: "milk",
      categoryId: 12,
      viewMode: "compact",
      scrollOffset: 460,
      anchorProductId: 81,
    });
    expect(localStorage.getItem("tanzim-inventory-view-mode-v1")).toBe("compact");
  });
});

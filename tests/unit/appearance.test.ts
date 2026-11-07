import { describe, expect, it, vi } from "vitest";
import { getAppearance, setAppearance } from "@/shared/theme/appearance";
import { getDisplaySize, setDisplaySize } from "@/shared/theme/display-size";

describe("appearance persistence", () => {
  it("defaults invalid or missing values to system", () => {
    expect(getAppearance()).toBe("system");
    localStorage.setItem("inventory-appearance", "invalid");
    expect(getAppearance()).toBe("system");
  });

  it.each(["light", "dark", "system"] as const)("persists and broadcasts %s", (appearance) => {
    const listener = vi.fn();
    window.addEventListener("appearance-change", listener);
    setAppearance(appearance);
    expect(getAppearance()).toBe(appearance);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("appearance-change", listener);
  });
});

describe("display size persistence", () => {
  it("uses normal for missing or invalid values", () => {
    expect(getDisplaySize()).toBe("normal");
    localStorage.setItem("inventory-display-size", "zoomed");
    expect(getDisplaySize()).toBe("normal");
  });

  it.each(["compact", "normal", "large"] as const)("persists %s without browser zoom", (size) => {
    setDisplaySize(size);
    expect(getDisplaySize()).toBe(size);
    expect(document.documentElement.dataset.displaySize).toBe(size);
    expect(document.documentElement.style.zoom).toBe("");
  });
});

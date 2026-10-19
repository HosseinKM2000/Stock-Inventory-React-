import { describe, expect, it, vi } from "vitest";
import { getAppearance, setAppearance } from "@/shared/theme/appearance";

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

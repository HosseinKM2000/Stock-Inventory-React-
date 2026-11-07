import { afterEach, describe, expect, it, vi } from "vitest";
import { copyPlainText, productClipboardText } from "@/features/app/inventory/services/clipboard.service";

describe("product clipboard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the browser clipboard from the user action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await copyPlainText("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("uses the DOM copy fallback when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    await copyPlainText("fallback");
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("uses the DOM fallback when Clipboard API permission is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    await copyPlainText("permission fallback");
    expect(writeText).toHaveBeenCalledWith("permission fallback");
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("rejects when neither automatic copy mechanism succeeds", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn().mockReturnValue(false) });
    await expect(copyPlainText("nope")).rejects.toThrow("COPY_UNAVAILABLE");
  });

  it("formats only the display name and toman price", () => {
    expect(productClipboardText("چای", 12500)).toBe(`چای\n${(12500).toLocaleString("fa-IR")} تومان`);
  });
});

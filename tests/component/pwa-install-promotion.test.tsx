import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PwaInstallPromotion } from "@/shared/lib/infrastructure/pwa/pwa-install-button";

function installableEvent(prompt = vi.fn(), outcome: "accepted" | "dismissed" = "dismissed") {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: typeof prompt;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe("PWA install promotion", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Chrome" });
  });

  it("offers the browser prompt only after an explicit install action", async () => {
    render(<PwaInstallPromotion />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    fireEvent(window, installableEvent(prompt));
    const install = await screen.findByRole("button", { name: "نصب برنامه" });
    expect(prompt).not.toHaveBeenCalled();
    fireEvent.click(install);
    await vi.waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  });

  it("persists dismissal so it is not shown on later entries", async () => {
    const first = render(<PwaInstallPromotion />);
    fireEvent(window, installableEvent());
    fireEvent.click(await screen.findByRole("button", { name: "بعداً" }));
    expect(localStorage.getItem("tanzim-pwa-install-promotion-dismissed-v1")).toBe("1");
    first.unmount();
    render(<PwaInstallPromotion />);
    fireEvent(window, installableEvent());
    expect(screen.queryByRole("button", { name: "نصب برنامه" })).not.toBeInTheDocument();
  });
});

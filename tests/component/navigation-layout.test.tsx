import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNavigationLayout } from "@/features/app/layout/use-navigation-layout";

class TestResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

function NavigationLayoutHarness() {
  const { navigationRef, keyboardOpen } = useNavigationLayout();
  return (
    <>
      <input aria-label="موجودی جدید" inputMode="numeric" />
      <nav ref={navigationRef} data-keyboard-open={keyboardOpen} />
    </>
  );
}

describe("bottom navigation keyboard layout", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  });

  it("detects keyboards in browsers that resize both layout and visual viewports", () => {
    const visualViewport = new EventTarget() as VisualViewport;
    Object.defineProperties(visualViewport, {
      height: { configurable: true, value: 800 },
      offsetTop: { configurable: true, value: 0 },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });
    render(<NavigationLayoutHarness />);

    screen.getByRole("textbox", { name: "موجودی جدید" }).focus();
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
    Object.defineProperty(visualViewport, "height", { configurable: true, value: 500 });
    act(() => window.dispatchEvent(new Event("resize")));

    expect(screen.getByRole("navigation")).toHaveAttribute("data-keyboard-open", "true");
  });
});

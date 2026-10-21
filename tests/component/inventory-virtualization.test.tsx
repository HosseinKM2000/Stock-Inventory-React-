import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DISPLAY_SIZE_EVENT } from "@/shared/theme/display-size";

const measure = vi.hoisted(() => vi.fn());
const measureElement = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: () => ({ measure, measureElement }),
}));

import { useInventoryVirtual } from "@/features/app/inventory/mutations/useInventoryVirtual";

describe("inventory virtual list measurement", () => {
  beforeEach(() => {
    measure.mockReset();
    measureElement.mockReset();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  it("keeps measured row heights when only the mobile viewport height changes", () => {
    const { unmount } = renderHook(() => useInventoryVirtual(10, 86));

    act(() => window.dispatchEvent(new Event("resize")));
    expect(measure).not.toHaveBeenCalled();

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 430 });
    act(() => window.dispatchEvent(new Event("resize")));
    expect(measure).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new Event(DISPLAY_SIZE_EVENT)));
    expect(measure).toHaveBeenCalledTimes(2);
    unmount();
  });

  it("remeasures mounted rows after invalidating the size cache", () => {
    const { result, unmount } = renderHook(() => useInventoryVirtual(2, 86));
    const scrollElement = document.createElement("div");
    const firstRow = document.createElement("div");
    const secondRow = document.createElement("div");
    firstRow.dataset.index = "0";
    secondRow.dataset.index = "1";
    scrollElement.append(firstRow, secondRow);
    Object.defineProperty(scrollElement, "clientWidth", { configurable: true, value: 390 });
    Object.defineProperty(result.current.parentRef, "current", { configurable: true, value: scrollElement });

    act(() => window.dispatchEvent(new Event(DISPLAY_SIZE_EVENT)));

    expect(measure).toHaveBeenCalledTimes(1);
    expect(measureElement).toHaveBeenCalledTimes(2);
    expect(measureElement).toHaveBeenNthCalledWith(1, firstRow);
    expect(measureElement).toHaveBeenNthCalledWith(2, secondRow);
    unmount();
  });
});

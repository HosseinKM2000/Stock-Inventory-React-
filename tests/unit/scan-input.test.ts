import { describe, expect, it, vi } from "vitest";

import { CameraDuplicateGate } from "@/features/barcode/input/camera-duplicate-gate";
import { completedHardwareScan } from "@/features/barcode/input/hardware-input";

describe("scanner input safety", () => {
  it("suppresses duplicate camera frames until the code leaves view or is rearmed", () => {
    const gate = new CameraDuplicateGate(2);
    expect(gate.observe("ABC")).toBe(true);
    expect(gate.observe("ABC")).toBe(false);
    gate.absent();
    expect(gate.observe("ABC")).toBe(false);
    gate.absent();
    gate.absent();
    expect(gate.observe("ABC")).toBe(true);
    gate.rearm();
    expect(gate.observe("ABC")).toBe(true);
  });

  it("accepts configured HID terminators without intercepting ordinary typing", () => {
    const preventDefault = vi.fn();
    expect(completedHardwareScan({ key: "a", preventDefault } as unknown as KeyboardEvent, "00123")).toBeNull();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(completedHardwareScan({ key: "Enter", preventDefault } as unknown as KeyboardEvent, "00123")).toBe("00123");
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

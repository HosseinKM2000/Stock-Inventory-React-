import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const camera = vi.hoisted(() => ({ stop: vi.fn(), start: vi.fn() }));
vi.mock("@/features/barcode/input/camera-scanner", () => ({
  startCameraScanner: camera.start.mockImplementation(async () => ({ stop: camera.stop })),
}));

import { BarcodeCaptureField } from "@/features/barcode/components/barcode-capture-field";

describe("invoice barcode capture lifecycle", () => {
  beforeEach(() => { camera.stop.mockClear(); camera.start.mockClear(); camera.start.mockImplementation(async () => ({ stop: camera.stop })); });

  it("submits hardware scans once and closes an active camera when account context changes", async () => {
    const onScan = vi.fn();
    const view = render(<BarcodeCaptureField key="1:1" value="6261" onValueChange={() => undefined} onScan={onScan} />);
    fireEvent.keyDown(screen.getByLabelText("کد بارکد"), { key: "Enter" });
    expect(onScan).toHaveBeenCalledWith("6261", "hardware");
    fireEvent.click(screen.getByLabelText("اسکن بارکد با دوربین"));
    fireEvent.click(await screen.findByRole("button", { name: "فعال‌کردن دوربین" }));
    await waitFor(() => expect(camera.start).toHaveBeenCalledOnce());
    const staleResult = camera.start.mock.calls[0][1] as (value: string) => void;
    view.rerender(<BarcodeCaptureField key="2:2" value="6261" onValueChange={() => undefined} onScan={onScan} />);
    await waitFor(() => expect(camera.stop).toHaveBeenCalled());
    staleResult("9999");
    expect(onScan).not.toHaveBeenCalledWith("9999", "camera");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLongPress } from "@/features/app/inventory/hooks/use-long-press";

function PressTarget({ onLongPress }: { onLongPress: () => void }) {
  return <button {...useLongPress(onLongPress)}>image</button>;
}

describe("product image long press", () => {
  it("opens after the hold delay but not on a normal short press", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<PressTarget onLongPress={onLongPress} />);
    const target = screen.getByRole("button", { name: "image" });

    fireEvent.pointerDown(target, { pointerType: "touch", clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(400);
    fireEvent.pointerUp(target);
    expect(onLongPress).not.toHaveBeenCalled();

    fireEvent.pointerDown(target, { pointerType: "touch", clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(850);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("cancels when pointer movement indicates scrolling", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    render(<PressTarget onLongPress={onLongPress} />);
    const target = screen.getByRole("button", { name: "image" });

    fireEvent.pointerDown(target, { pointerType: "touch", clientX: 10, clientY: 10 });
    fireEvent.pointerMove(target, { pointerType: "touch", clientX: 40, clientY: 10 });
    vi.advanceTimersByTime(1_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

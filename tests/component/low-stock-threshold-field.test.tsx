import { fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";
import { LowStockThresholdField } from "@/features/app/inventory/components/low-stock-threshold-field";

describe("shared low-stock threshold field", () => {
  it("preserves the single-product label and normalizes localized integer input", () => {
    const onValueChange = vi.fn();
    render(<Theme><LowStockThresholdField value={3} onValueChange={onValueChange} /></Theme>);
    const input = screen.getByRole("textbox", { name: "حد نصاب هشدار" });
    expect(input).toHaveValue("3");
    fireEvent.change(input, { target: { value: "۱۲" } });
    expect(onValueChange).toHaveBeenCalledWith("12");
  });

  it("represents no change with an empty value in bulk context", () => {
    render(<Theme><LowStockThresholdField id="bulk-threshold" value="" optional onValueChange={vi.fn()} /></Theme>);
    expect(screen.getByRole("textbox", { name: "حد نصاب هشدار" })).toHaveValue("");
    expect(screen.getByText("برای بدون تغییر ماندن، این فیلد را خالی بگذارید.")).toBeInTheDocument();
  });
});

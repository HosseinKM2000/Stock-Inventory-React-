import { fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";
import { LabelFilter } from "@/features/app/inventory/components/label-filter";

const labels = [
  { id: 7, name: "برند آ", normalized_name: "برند آ", created_at: "", updated_at: "" },
  { id: 8, name: "مدل ب", normalized_name: "مدل ب", created_at: "", updated_at: "" },
];

describe("multi-label product filter", () => {
  it("shows selected labels and removes each one accessibly", () => {
    const onRemove = vi.fn();
    const view = render(<Theme><LabelFilter labels={labels} selectedIds={[7]} onToggle={vi.fn()} onRemove={onRemove} onClear={vi.fn()} /></Theme>);
    fireEvent.click(screen.getByRole("button", { name: "حذف برچسب برند آ از فیلتر" }));
    expect(onRemove).toHaveBeenCalledWith(7);

    view.rerender(<Theme><LabelFilter labels={[{ ...labels[0], name: "برند تازه" }]} selectedIds={[7]} onToggle={vi.fn()} onRemove={onRemove} onClear={vi.fn()} /></Theme>);
    expect(screen.getByRole("button", { name: "حذف برچسب برند تازه از فیلتر" })).toBeVisible();
  });

  it("searches local labels and toggles multiple choices", async () => {
    const onToggle = vi.fn();
    render(<Theme><LabelFilter labels={labels} selectedIds={[]} onToggle={onToggle} onRemove={vi.fn()} onClear={vi.fn()} /></Theme>);
    fireEvent.click(screen.getByRole("button", { name: "فیلتر محصولات بر اساس برچسب" }));
    const search = await screen.findByRole("textbox", { name: "جستجوی برچسب" });
    fireEvent.change(search, { target: { value: "مدل" } });
    expect(screen.queryByText("برند آ")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("مدل ب"));
    expect(onToggle).toHaveBeenCalledWith(8);
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock("@/features/setting/mutations/use-categories", () => ({
  useCategories: () => ({ data: [{ id: 4, name: "نوشیدنی" }] }),
}));
vi.mock("@/features/app/inventory/mutations/use-products", () => ({
  useBulkUpdateProducts: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: mocks.isPending,
  }),
}));

import { BulkEditDialog } from "@/features/app/inventory/components/bulk-edit-dialog";

describe("bulk-edit dialog", () => {
  it("starts with no effective changes and uses immediately available controls", () => {
    render(<Theme><BulkEditDialog open selectedIds={[1]} onOpenChange={vi.fn()} onComplete={vi.fn()} /></Theme>);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اعمال تغییرات" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "افزایش قیمت" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "حد نصاب هشدار" })).toBeEnabled();
  });

  it("submits an additive price intent once and clears completed selection ids", async () => {
    let resolveMutation: (value: ReturnType<typeof product>[]) => void = () => undefined;
    mocks.mutateAsync.mockReturnValue(new Promise((resolve) => { resolveMutation = resolve; }));
    const onComplete = vi.fn();
    const onOpenChange = vi.fn();
    render(<Theme><BulkEditDialog open selectedIds={[1, 2]} onOpenChange={onOpenChange} onComplete={onComplete} /></Theme>);
    fireEvent.change(screen.getByRole("textbox", { name: "افزایش قیمت" }), { target: { value: "۲۵" } });
    const submit = screen.getByRole("button", { name: "اعمال تغییرات" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync).toHaveBeenCalledWith({ ids: [1, 2], intent: { priceIncrease: 25 } });

    await act(async () => resolveMutation([product({ id: 1 }), product({ id: 2 })]));
    expect(onComplete).toHaveBeenCalledWith([1, 2]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

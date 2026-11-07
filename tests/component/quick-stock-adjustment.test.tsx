import { act, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { product } from "../helpers/product";

const mutate = vi.fn();

vi.mock("@/shared/access/use-entitlement", () => ({
  useEntitlementAccess: vi.fn(),
}));

vi.mock("@/shared/access/access-state", () => ({
  accessState: {
    canAccess: () => true,
    canWrite: () => true,
  },
}));

vi.mock("@/features/app/inventory/mutations/use-products", () => ({
  useAdjustProductQuantity: () => ({ mutate, isPending: false }),
}));

import { QuickStockAdjustment } from "@/features/app/inventory/components/quick-stock-adjustment";

describe("QuickStockAdjustment confirmation", () => {
  beforeEach(() => {
    mutate.mockReset();
    vi.useFakeTimers();
  });

  it("shows the current and next stock in a modal before applying the change", () => {
    render(
      <Theme>
        <QuickStockAdjustment product={product({ id: 41, quantity: 6 })} />
      </Theme>,
    );

    const increase = screen.getByRole("button", { name: "افزایش یک واحد" });
    fireEvent.keyDown(increase, { key: "Enter" });
    fireEvent.keyUp(increase, { key: "Enter" });
    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("موجودی فعلی");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("موجودی جدید");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("۶");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("۷");

    fireEvent.click(screen.getByRole("button", { name: "تأیید" }));
    expect(mutate).toHaveBeenCalledWith(
      { id: 41, delta: 1 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

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
    const decrease = screen.getByRole("button", { name: "کاهش یک واحد" });
    expect(increase).toHaveAttribute("data-stock-action", "increase");
    expect(decrease).toHaveAttribute("data-stock-action", "decrease");
    expect(increase).toHaveClass("rt-variant-outline");
    expect(decrease).toHaveClass("rt-variant-outline");
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

  it("accepts a direct keyboard quantity from the count control", () => {
    render(
      <Theme>
        <QuickStockAdjustment product={product({ id: 41, quantity: 6 })} />
      </Theme>,
    );

    fireEvent.click(screen.getByRole("button", { name: /ویرایش مستقیم موجودی/ }));
    const input = screen.getByRole("spinbutton", { name: "موجودی جدید" });
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("alertdialog")).toHaveTextContent("۱۲");
    fireEvent.click(screen.getByRole("button", { name: "تأیید" }));
    expect(mutate).toHaveBeenCalledWith(
      { id: 41, delta: 6 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("clears zero while editing and restores it when left empty", () => {
    render(
      <Theme>
        <QuickStockAdjustment product={product({ id: 41, quantity: 0 })} />
      </Theme>,
    );

    fireEvent.click(screen.getByRole("button", { name: /ویرایش مستقیم موجودی/ }));
    const input = screen.getByRole("spinbutton", { name: "موجودی جدید" });
    fireEvent.focus(input);
    expect(input).toHaveValue(null);
    fireEvent.blur(input);
    expect(screen.getByRole("button", { name: /ویرایش مستقیم موجودی صفر/ })).toBeVisible();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("marks four-digit quantities for the wider responsive layout", () => {
    const { container } = render(
      <Theme>
        <QuickStockAdjustment product={product({ id: 41, quantity: 999 })} />
      </Theme>,
    );

    const control = container.querySelector(".quick-stock-control");
    expect(control).toHaveAttribute("data-quantity-layout", "standard");

    fireEvent.click(screen.getByRole("button", { name: /ویرایش مستقیم موجودی/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "موجودی جدید" }), {
      target: { value: "1010" },
    });

    expect(control).toHaveAttribute("data-quantity-layout", "wide");
  });

  it("keeps direct quantity edits within the product stock ceiling", () => {
    const errorToast = vi.spyOn(toast, "error").mockImplementation(() => "quantity-limit-toast");
    render(
      <Theme>
        <QuickStockAdjustment product={product({ id: 41, quantity: 6 })} />
      </Theme>,
    );

    fireEvent.click(screen.getByRole("button", { name: /ویرایش مستقیم موجودی/ }));
    const input = screen.getByRole("spinbutton", { name: "موجودی جدید" });
    expect(input).toHaveAttribute("max", "1000000000");
    fireEvent.change(input, { target: { value: "1000000001" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(input).toBeVisible();
    expect(input).toHaveValue(6);
    expect(errorToast).toHaveBeenCalledWith("موجودی هر محصول نمی‌تواند بیشتر از ۱٬۰۰۰٬۰۰۰٬۰۰۰ عدد باشد");
    expect(mutate).not.toHaveBeenCalled();
    errorToast.mockRestore();
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/shared/lib/infrastructure/media/useImage", () => ({
  useResolvedImage: (path?: string | null) => ({
    src: path ? "blob:product-image" : undefined,
    loading: false,
    error: undefined,
  }),
}));
vi.mock("@/shared/access/use-entitlement", () => ({ useEntitlementAccess: vi.fn() }));
vi.mock("@/shared/access/access-state", () => ({ accessState: { canWrite: () => true } }));
vi.mock("@/features/app/inventory/components/quick-stock-adjustment", () => ({ QuickStockAdjustment: () => null }));

import { ProductCard } from "@/features/app/inventory/components/inventory-card";

const renderCard = (props: Partial<React.ComponentProps<typeof ProductCard>> = {}) => render(
  <Theme><ProductCard product={product({ id: 41, custom_label: "چای" })} onEnterSelection={vi.fn()} {...props} /></Theme>,
);

describe("product-card selection interaction", () => {
  it.each(["grid", "comfortable", "compact"] as const)("renders the %s view without losing product facts", (viewMode) => {
    const { container } = renderCard({ viewMode, product: product({ custom_label: "چای", quantity: 6, sale_price: 295_000, purchase_price: 200_000 }) });
    expect(screen.getByText("چای")).toBeInTheDocument();
    expect(screen.getAllByText(/۶/).length).toBeGreaterThan(0);
    expect(container.querySelector(viewMode === "comfortable" ? ".inventory-card-layout" : `.inventory-card--${viewMode}`)).toBeTruthy();
  });

  it("exposes the complete comfortable-card structure used by narrow layouts", () => {
    const item = product({
      id: 10,
      custom_label: "لامپ LED 12W",
      image_url: "opfs://products/lamp.webp",
      quantity: 6,
      sale_price: 350_000,
      status: "low_stock",
    });
    item.catalog_product = { ...item.catalog_product!, brand: "Tanzim Demo" };

    const { container } = renderCard({ product: item, viewMode: "comfortable" });

    expect(container.querySelector(".inventory-card-media .inventory-card-image-status")).toHaveTextContent("کم موجود");
    expect(container.querySelector(".inventory-card-identity")).toHaveTextContent("لامپ LED 12W");
    expect(container.querySelector(".inventory-card-mobile-meta")).toHaveTextContent("Tanzim Demo");
    expect(container.querySelector(".inventory-card-code")).toHaveTextContent("TZ-010");
    expect(container.querySelector(".inventory-card-price strong")).toHaveTextContent("۳۵۰٬۰۰۰");
    const actions = within(container.querySelector(".inventory-card-mobile-actions")!);
    expect(actions.getByRole("button", { name: "کپی نام و قیمت لامپ LED 12W" })).toBeInTheDocument();
    expect(actions.getByRole("button", { name: "ویرایش لامپ LED 12W" })).toBeInTheDocument();
    expect(actions.getByRole("button", { name: "حذف لامپ LED 12W" })).toBeInTheDocument();
    expect(container.querySelector(".inventory-card-controls")).toBeTruthy();
  });

  it("enters selection on long press and suppresses the following click", () => {
    vi.useFakeTimers();
    const enter = vi.fn();
    const toggle = vi.fn();
    renderCard({ onEnterSelection: enter, onToggleSelection: toggle });
    const card = screen.getByRole("button", { name: /انتخاب چای با نگه‌داشتن/ });
    fireEvent.pointerDown(card, { pointerType: "touch", clientX: 10, clientY: 10 });
    vi.advanceTimersByTime(550);
    fireEvent.click(card);
    expect(enter).toHaveBeenCalledOnce();
    expect(toggle).not.toHaveBeenCalled();
  });

  it("offers a keyboard alternative and toggles cards only in selection mode", () => {
    const enter = vi.fn();
    const toggle = vi.fn();
    const view = renderCard({ onEnterSelection: enter, onToggleSelection: toggle });
    fireEvent.keyDown(screen.getByRole("button", { name: /انتخاب چای با نگه‌داشتن/ }), { key: "Enter" });
    expect(enter).toHaveBeenCalledOnce();
    view.rerender(<Theme><ProductCard product={product({ id: 41, custom_label: "چای" })} selectionMode selected onEnterSelection={enter} onToggleSelection={toggle} /></Theme>);
    fireEvent.click(screen.getByRole("button", { name: /لغو انتخاب چای/ }));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it("opens an available image from the image itself with mouse or keyboard", () => {
    const open = vi.fn();
    renderCard({
      product: product({ id: 41, custom_label: "چای", image_url: "opfs://products/tea.webp" }),
      onImageOpen: open,
    });
    const imageButton = screen.getByRole("button", { name: "نمایش تصویر چای" });
    fireEvent.click(imageButton);
    expect(open).toHaveBeenCalledOnce();
    fireEvent.keyDown(imageButton, { key: "Enter" });
    fireEvent.click(imageButton);
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("does not expose a viewer for a missing image and keeps selection mode on the image", () => {
    const open = vi.fn();
    const toggle = vi.fn();
    const view = renderCard({ onImageOpen: open });
    expect(screen.queryByRole("button", { name: /نمایش تصویر/ })).not.toBeInTheDocument();

    view.rerender(
      <Theme>
        <ProductCard
          product={product({ id: 41, custom_label: "چای", image_url: "opfs://products/tea.webp" })}
          selectionMode
          onImageOpen={open}
          onToggleSelection={toggle}
        />
      </Theme>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "انتخاب چای" })[1]);
    expect(toggle).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });
});

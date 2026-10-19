import { fireEvent, render, screen } from "@testing-library/react";
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

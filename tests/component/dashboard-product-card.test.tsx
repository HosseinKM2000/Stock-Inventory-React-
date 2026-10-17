import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="#product">{children}</a> }));
vi.mock("@/shared/lib/infrastructure/media/useImage", () => ({ useResolvedImage: () => ({ src: undefined, loading: false }) }));

import { DashboardProductCard } from "@/features/app/dashboard/components/dashboard-product-card";

describe("dashboard product card variants", () => {
  it("keeps total-products detail minimal", () => {
    render(<Theme><DashboardProductCard product={product({ custom_label: "لامپ", quantity: 6 })} variant="total" /></Theme>);
    expect(screen.getByText("لامپ")).toBeInTheDocument();
    expect(screen.getByText(/۶/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows only sale valuation in the inventory-value variant", () => {
    render(<Theme><DashboardProductCard product={product({ custom_label: "لامپ", quantity: 2, sale_price: 300, purchase_price: 100 })} variant="inventory-value" /></Theme>);
    expect(screen.getByText(/۶۰۰/)).toBeInTheDocument();
    expect(screen.queryByText(/قیمت خرید/)).not.toBeInTheDocument();
  });
});

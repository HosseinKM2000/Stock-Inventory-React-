import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.ComponentProps<"a"> & { to: string }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/features/app/dashboard/mutations/use-dashboard", () => ({
  useDashboardProducts: () => ({
    data: {
      title: "مجموع کالاها",
      products: [product({ id: 41, custom_label: "چای سبز", quantity: 24, price: 500 })],
    },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@/features/app/inventory/mutations/use-products", () => ({
  useDeleteProduct: () => ({ mutate: vi.fn(), isPending: false }),
}));

import DashboardProducts from "@/features/app/dashboard/components/dashboard-products";
import { DashboardFilters } from "@/features/app/dashboard/types";

describe("total products dashboard rows", () => {
  it("shows only product name and quantity in an opening link", () => {
    render(<Theme><DashboardProducts filter={DashboardFilters.ALL} /></Theme>);
    const link = screen.getByRole("link", { name: /چای سبز/ });
    expect(link).toHaveTextContent("چای سبز");
    expect(link).toHaveTextContent("۲۴ عدد");
    expect(link).not.toHaveTextContent("۵۰۰");
    expect(link).not.toHaveTextContent("تومان");
  });
});

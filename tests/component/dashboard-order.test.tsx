import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/app/dashboard/mutations/use-dashboard", () => ({
  useDashboardStats: () => ({
    data: {
      totalProducts: 1, inventoryValue: 1, lowStockCount: 1,
      outOfStockCount: 1, hiddenCount: 1, noImageCount: 1,
      noPriceCount: 1, urgentPurchaseCount: 1, addedTodayCount: 1,
      missingClassificationCount: 1, valuedProductsCount: 1,
      todayActionCount: 1,
    },
    isLoading: false,
    isError: false,
  }),
}));

import DashboardComponent from "@/features/app/dashboard/components";

describe("dashboard section order", () => {
  it("keeps visual, DOM, and keyboard order aligned with operational priority", () => {
    render(<Theme><DashboardComponent /></Theme>);
    const expected = [
      "مجموع کالاها",
      "عدم موجودی",
      "کمبود موجودی",
      "نیاز به خرید",
      "بدون قیمت",
      "اقدام‌های امروز",
      "محصولات بدون دسته یا برچسب",
      "بدون تصویر",
      "ارزشمندترین‌ها",
      "ارزش موجودی",
      "محصولات افزوده‌شده امروز",
      "محصولات مخفی",
    ];
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(expected.length);
    expected.forEach((label, index) => expect(buttons[index]).toHaveTextContent(label));
  });
});

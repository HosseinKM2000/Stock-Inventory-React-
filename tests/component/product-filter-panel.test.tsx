import { fireEvent, render, screen, within } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

import FilterPanel from "@/features/app/inventory/components/filter-panel";

describe("product filter panel", () => {
  it("keeps the required control order and updates the shared filter callbacks", () => {
    const setSearch = vi.fn();
    const setCatalogHidden = vi.fn();
    const setViewMode = vi.fn();
    const setSort = vi.fn();
    const setCategoryId = vi.fn();
    const clearLabels = vi.fn();

    render(
      <Theme>
        <FilterPanel
          search=""
          setSearch={setSearch}
          sort="newest"
          setSort={setSort}
          categories={[]}
          categoryId={null}
          setCategoryId={setCategoryId}
          labels={[]}
          selectedLabelIds={[]}
          onToggleLabel={vi.fn()}
          onRemoveLabel={vi.fn()}
          onClearLabels={clearLabels}
          catalogProductsHidden={false}
          onCatalogVisibilityChange={setCatalogHidden}
          viewMode="grid"
          onViewModeChange={setViewMode}
        />
      </Theme>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "جستجوی محصول" }), { target: { value: "چای" } });
    fireEvent.click(screen.getByRole("button", { name: "نمای فشرده" }));
    fireEvent.click(screen.getByRole("button", { name: "فیلترها" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("دسته‌بندی")).toBeVisible();
    expect(within(dialog).getByText("مرتب‌سازی")).toBeVisible();
    expect(within(dialog).getByText("برچسب‌ها")).toBeVisible();
    const showResults = within(dialog).getByRole("button", { name: "مشاهده نتایج" });
    expect(showResults).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("switch", { name: "مخفی کردن محصولات کاتالوگ در پنجره فیلترها" }));
    expect(setCatalogHidden).not.toHaveBeenCalled();
    expect(showResults).toBeEnabled();
    fireEvent.click(showResults);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setSearch).toHaveBeenCalledWith("چای");
    expect(setViewMode).toHaveBeenCalledWith("compact");
    expect(setCatalogHidden).toHaveBeenCalledWith(true);
    expect(setCategoryId).not.toHaveBeenCalled();
    expect(setSort).not.toHaveBeenCalled();
    expect(clearLabels).not.toHaveBeenCalled();
  });
});

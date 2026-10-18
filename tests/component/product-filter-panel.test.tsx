import { fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

import FilterPanel from "@/features/app/inventory/components/filter-panel";

describe("product filter panel", () => {
  it("keeps the required control order and updates the shared filter callbacks", () => {
    const setSearch = vi.fn();
    const setCatalogHidden = vi.fn();
    const setViewMode = vi.fn();

    render(
      <Theme>
        <FilterPanel
          search=""
          setSearch={setSearch}
          sort="newest"
          setSort={vi.fn()}
          categories={[]}
          categoryId={null}
          setCategoryId={vi.fn()}
          labels={[]}
          selectedLabelIds={[]}
          onToggleLabel={vi.fn()}
          onRemoveLabel={vi.fn()}
          onClearLabels={vi.fn()}
          catalogProductsHidden={false}
          onCatalogVisibilityChange={setCatalogHidden}
          viewMode="grid"
          onViewModeChange={setViewMode}
        />
      </Theme>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "جستجوی محصول" }), { target: { value: "چای" } });
    fireEvent.click(screen.getByRole("button", { name: "نمای فشرده" }));
    fireEvent.click(screen.getByRole("switch", { name: "مخفی کردن محصولات کاتالوگ" }));
    expect(setSearch).toHaveBeenCalledWith("چای");
    expect(setViewMode).toHaveBeenCalledWith("compact");
    expect(setCatalogHidden).toHaveBeenCalledWith(true);
  });
});

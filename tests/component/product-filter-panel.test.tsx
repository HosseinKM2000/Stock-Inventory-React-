import { fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

import FilterPanel from "@/features/app/inventory/components/filter-panel";

describe("product filter panel", () => {
  it("keeps the required control order and updates the shared filter callbacks", () => {
    const setSearch = vi.fn();
    const setCatalogHidden = vi.fn();

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
        />
      </Theme>,
    );

    const labels = ["جستجو", "دسته‌بندی‌ها", "مرتب‌سازی", "برچسب‌ها", "مخفی کردن کاتالوگ"]
      .map((name) => screen.getAllByText(name)[0]);
    for (let index = 1; index < labels.length; index += 1) {
      expect(labels[index - 1].compareDocumentPosition(labels[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    fireEvent.change(screen.getByRole("textbox", { name: "جستجوی محصول" }), { target: { value: "چای" } });
    fireEvent.click(screen.getByRole("switch", { name: "مخفی کردن محصولات کاتالوگ" }));
    expect(setSearch).toHaveBeenCalledWith("چای");
    expect(setCatalogHidden).toHaveBeenCalledWith(true);
  });
});

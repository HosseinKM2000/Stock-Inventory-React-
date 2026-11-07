import { fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

import { BulkSelectionActions } from "@/features/app/inventory/components/bulk-selection-actions";

describe("bulk selection actions", () => {
  it("places delete alongside edit and exposes the selected count accessibly", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <Theme>
        <BulkSelectionActions
          selectedCount={3}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </Theme>,
    );

    fireEvent.click(screen.getByRole("button", { name: "حذف گروهی ۳ محصول" }));
    fireEvent.click(screen.getByRole("button", { name: "ویرایش گروهی ۳ محصول" }));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("عملیات گروهی محصولات")).toHaveClass("z-60");
  });
});

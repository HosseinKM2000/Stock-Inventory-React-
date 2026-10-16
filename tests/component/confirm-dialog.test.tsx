import { fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders a compact visual summary and keeps both actions accessible", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <Theme>
        <ConfirmDialog
          open
          onOpenChange={onOpenChange}
          title="تغییر موجودی تأیید شود؟"
          description="آیا از تغییر سریع این کالا اطمینان دارید؟"
          icon={<span data-testid="stock-icon">کالا</span>}
          details={<div>۶ ← ۷</div>}
          confirmLabel="تأیید"
          onConfirm={onConfirm}
        />
      </Theme>,
    );

    expect(screen.getByRole("alertdialog")).toHaveClass("action-confirm-dialog");
    expect(screen.getByTestId("stock-icon")).toBeInTheDocument();
    expect(screen.getByText("۶ ← ۷")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "تأیید" });
    expect(confirm).toHaveAttribute("data-intent", "positive");
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "انصراف" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

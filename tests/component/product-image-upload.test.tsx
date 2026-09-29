import { Theme } from "@radix-ui/themes";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductImageUpload } from "@/features/app/inventory/components/upload-file";

function renderUpload(props: React.ComponentProps<typeof ProductImageUpload>) {
  return render(<Theme><ProductImageUpload {...props} /></Theme>);
}

describe("product image upload", () => {
  it("opens the picker and reports a selected supported image", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = renderUpload({ onChange });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const picker = vi.spyOn(input, "click");
    await user.click(screen.getByText(/انتخاب تصویر|ط§ظ†طھط®ط§ط¨/));
    expect(picker).toHaveBeenCalled();

    const file = new File(["image"], "stock.webp", { type: "image/webp" });
    await user.upload(input, file);
    expect(onChange).toHaveBeenCalledWith(file);
    expect(input.accept).toContain("image/webp");
  });

  it("shows an existing preview and supports replacement and removal", () => {
    const onChange = vi.fn();
    const view = renderUpload({ value: "blob:preview", onChange });
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:preview");
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const replacement = new File(["new"], "new.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [replacement] } });
    expect(onChange).toHaveBeenCalledWith(replacement);

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("blocks picker, replacement, and removal controls when disabled", () => {
    const onChange = vi.fn();
    const view = renderUpload({ value: "blob:preview", disabled: true, onChange });
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

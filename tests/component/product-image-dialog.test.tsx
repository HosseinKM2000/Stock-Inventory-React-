import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { describe, expect, it, vi } from "vitest";

import { ProductImageDialog } from "@/features/app/inventory/components/product-image-dialog";
import { product } from "../helpers/product";

vi.mock("@/shared/lib/infrastructure/media/useImage", () => ({
  useImage: () => "blob:product-image",
}));

describe("product image dialog", () => {
  it("maximizes only the image without rendering product details", () => {
    render(
      <Theme>
        <ProductImageDialog
          product={product({ custom_label: "چای سبز", quantity: 17, price: 250000 })}
          onOpenChange={vi.fn()}
        />
      </Theme>,
    );

    expect(screen.getByRole("img", { name: "چای سبز" })).toHaveAttribute(
      "src",
      "blob:product-image",
    );
    expect(screen.getByRole("button", { name: "بستن تصویر" })).toBeVisible();
    expect(screen.queryByText("۱۷")).not.toBeInTheDocument();
    expect(screen.queryByText(/۲۵۰٬۰۰۰/)).not.toBeInTheDocument();
  });
});

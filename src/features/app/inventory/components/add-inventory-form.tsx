import { barcodeService } from "@/features/barcode/services/barcode-service";
import { ApiError } from "@/shared/api/api-error";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { useCreateProduct } from "../mutations/use-products";
import type { Product } from "../types";
import { ProductForm } from "./inventory-form";

const AddProductForm = () => {
  const navigate = useNavigate();
  const createProduct = useCreateProduct();

  return (
    <ProductForm
      mode="create"
      submitting={createProduct.isPending}
      errorMessage={createProduct.error instanceof ApiError ? createProduct.error.message : null}
      onSubmit={(input, pendingBarcodes) => createProduct.mutate(input as Product, {
        onSuccess: async (created) => {
          try {
            for (const barcode of pendingBarcodes) {
              await barcodeService.create({ productId: created.id, ...barcode });
            }
            toast.success("محصول و بارکدهای آن ایجاد شد");
            void navigate({ to: "/inventory/list" });
          } catch (error) {
            toast.error(error instanceof Error ? `محصول ذخیره شد؛ بارکد نیاز به بررسی دارد: ${error.message}` : "محصول ذخیره شد؛ بارکد نیاز به بررسی دارد");
            void navigate({ to: "/inventory/edit", search: { id: created.id } });
          }
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : "ایجاد محصول ناموفق بود"),
      })}
    />
  );
};

export default AddProductForm;

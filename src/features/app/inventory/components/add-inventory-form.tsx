import { ApiError } from "@/shared/api/api-error";
import { useNavigate } from "@tanstack/react-router";
import { useCreateProduct } from "../mutations/use-products";
import { ProductForm } from "./inventory-form";
import type { Product } from "../types";
import { toast } from "sonner";

const AddProductForm = () => {
  const navigate = useNavigate();
  const createProduct = useCreateProduct();

  return (
    <ProductForm
      mode="create"
      submitting={createProduct.isPending}
      errorMessage={
        createProduct.error instanceof ApiError
          ? createProduct.error.message
          : null
      }
      onSubmit={(input) =>
        createProduct.mutate(input as Product, {
          onSuccess: () => {
            toast.success("محصول ایجاد شد");
            void navigate({ to: "/inventory/list" });
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "ایجاد محصول ناموفق بود");
          },
        })
      }
    />
  );
};

export default AddProductForm;

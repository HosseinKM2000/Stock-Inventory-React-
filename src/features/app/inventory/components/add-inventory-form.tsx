import { ApiError } from "@/shared/api/api-error";
import { useNavigate } from "@tanstack/react-router";
import { useCreateProduct } from "../mutations/use-products";
import { ProductForm } from "./inventory-form";
import type { Product } from "../types";

const AddProductForm = () => {
  const navigate = useNavigate();
  const createProduct = useCreateProduct();

  return (
    <ProductForm
      mode="create"
      submitting={createProduct.isPending}
      errorMessage={
        createProduct.error && createProduct.error instanceof ApiError
          ? createProduct.error.message
          : null
      }
      onSubmit={(input) =>
        createProduct.mutate(input as Product, {
          onSuccess: () => navigate({ to: "/inventory/list" }),
        })
      }
    />
  );
};

export default AddProductForm;

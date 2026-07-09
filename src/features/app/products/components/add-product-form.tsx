
import { useNavigate } from "@tanstack/react-router";
import { useCreateProduct } from "../hooks/use-products";
import { ProductForm } from "./product-form";
import { ApiError } from "@/shared/api/api-error";

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
        createProduct.mutate(input, {
          onSuccess: () => navigate({ to: "/product/list" }),
        })
      }
    />
  );
};

export default AddProductForm;

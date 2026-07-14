
import { Callout, Flex, Spinner } from "@radix-ui/themes";
import { useNavigate } from "@tanstack/react-router";
import {
  useDeleteProduct,
  useProduct,
  useUpdateProduct,
} from "../hooks/use-products";
import { ProductForm } from "./product-form";
import { ApiError } from "@/shared/api/api-error";

type EditProductFormProps = {
  id: number;
};

const EditProductForm = ({ id }: EditProductFormProps) => {
  const navigate = useNavigate();
  const { data: product, isLoading, isError } = useProduct(id);
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  if (isLoading) {
    return (
      <Flex justify="center" align="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  if (isError || !product) {
    return (
      <Callout.Root color="red" dir="rtl" mt="6">
        <Callout.Text>محصول یافت نشد</Callout.Text>
      </Callout.Root>
    );
  }

  return (
    <ProductForm
      mode="edit"
      initial={product}
      submitting={updateProduct.isPending}
      deleting={deleteProduct.isPending}
      errorMessage={
        updateProduct.error && updateProduct.error instanceof ApiError
          ? updateProduct.error.message
          : null
      }
      onSubmit={(input) =>
        updateProduct.mutate(
          { id, input },
          { onSuccess: () => navigate({ to: "/product/list" }) },
        )
      }
      onDelete={() =>
        deleteProduct.mutate(id, {
          onSuccess: () => navigate({ to: "/product/list" }),
        })
      }
    />
  );
};

export default EditProductForm;

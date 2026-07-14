import { ApiError } from "@/shared/api/api-error";
import { Callout, Flex, Spinner } from "@radix-ui/themes";
import { useNavigate } from "@tanstack/react-router";
import {
  useDeleteProduct,
  useProduct,
  useUpdateProduct,
} from "../mutations/use-products";
import { ProductForm } from "./inventory-form";

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
          { onSuccess: () => navigate({ to: "/inventory/list" }) },
        )
      }
      onDelete={() =>
        deleteProduct.mutate(id, {
          onSuccess: () => navigate({ to: "/inventory/list" }),
        })
      }
    />
  );
};

export default EditProductForm;

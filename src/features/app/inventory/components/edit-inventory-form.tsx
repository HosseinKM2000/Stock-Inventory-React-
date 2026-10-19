import { ApiError } from "@/shared/api/api-error";
import { Callout, Flex, Spinner } from "@radix-ui/themes";
import { useNavigate } from "@tanstack/react-router";
import {
  useDeleteProduct,
  useProduct,
  useUpdateProduct,
} from "../mutations/use-products";
import { ProductForm } from "./inventory-form";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/shared/ui/dialog/confirm-dialog";

type EditProductFormProps = {
  id: number;
};

const EditProductForm = ({ id }: EditProductFormProps) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  const name = product.custom_label ?? product.catalog_product?.name ?? "محصول";

  return (
    <>
      <ProductForm
        mode="edit"
        initial={product}
        submitting={updateProduct.isPending}
        deleting={deleteProduct.isPending}
        errorMessage={
          updateProduct.error instanceof ApiError
            ? updateProduct.error.message
            : null
        }
        onSubmit={(input) =>
          updateProduct.mutate(
            { id, input },
            {
              onSuccess: () => {
                toast.success(`«${name}» ویرایش شد`);
                void navigate({ to: "/inventory/list" });
              },
              onError: (error) => {
                toast.error(error instanceof Error ? error.message : "ویرایش محصول ناموفق بود");
              },
            },
          )
        }
        onDelete={() => setConfirmingDelete(true)}
      />
      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="محصول حذف شود؟"
        description={`«${name}» از موجودی حذف می‌شود.`}
        confirmLabel="حذف محصول"
        cancelLabel="لغو"
        variant="danger"
        loading={deleteProduct.isPending}
        onConfirm={() =>
          deleteProduct.mutate(id, {
            onSuccess: () => {
              toast.success(`«${name}» حذف شد.`);
              void navigate({ to: "/inventory/list" });
            },
            onError: (error) => {
              toast.error(error instanceof Error ? error.message : "حذف محصول ناموفق بود");
            },
          })
        }
      />
    </>
  );
};

export default EditProductForm;

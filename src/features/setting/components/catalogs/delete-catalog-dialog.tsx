import { useEffect, useState } from "react";

import { Dialog, Flex, Callout } from "@radix-ui/themes";
import { TrashIcon } from "@radix-ui/react-icons";

import { Button } from "@/shared/ui/button/button";

import { ApiError } from "@/shared/api/api-error";

import { useDeleteCatalog } from "../../mutations/use-catalog";

import type { CatalogProduct } from "../../types";

type Props = {
  catalog: CatalogProduct;
};

export default function DeleteCatalogDialog({
  catalog,
}: Props) {
  const [open, setOpen] = useState(false);

  const deleteMutation = useDeleteCatalog();

  useEffect(() => {
    if (!open) return;

    deleteMutation.reset();
  }, [open, deleteMutation]);

  function handleDelete() {
    deleteMutation.mutate(catalog.id, {
      onSuccess() {
        setOpen(false);
      },
    });
  }

  const errorMessage =
    deleteMutation.error instanceof ApiError
      ? deleteMutation.error.message
      : deleteMutation.isError
        ? "خطا در حذف محصول کاتالوگ"
        : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={setOpen}
    >
      <Dialog.Trigger>
        <Button
          color="red"
          size="2"
        >
          <TrashIcon />
        </Button>
      </Dialog.Trigger>

      <Dialog.Content maxWidth="420px">
        <Dialog.Title color="red">
          حذف محصول کاتالوگ
        </Dialog.Title>

        <Dialog.Description mt="3">
          آیا از حذف
          <strong>
            {" "}
            {catalog.name}
            {" "}
          </strong>
          اطمینان دارید؟
        </Dialog.Description>

        {errorMessage && (
          <Callout.Root
            color="red"
            mt="4"
          >
            <Callout.Text>
              {errorMessage}
            </Callout.Text>
          </Callout.Root>
        )}

        <Flex
          justify="end"
          gap="3"
          mt="6"
        >
          <Dialog.Close>
            <Button
              variant="soft"
              color="gray"
            >
              لغو
            </Button>
          </Dialog.Close>

          <Button
            color="red"
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            حذف
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
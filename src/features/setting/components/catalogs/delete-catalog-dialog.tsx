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
      ? deleteMutation.error.message === "CATALOG_PRODUCT_NOT_FOUND"
          ? "این محصول قبلاً حذف شده یا دیگر وجود ندارد."
          : deleteMutation.error.message === "CATALOG_PERMANENT_DELETE_CONFLICT"
            ? "به‌دلیل وجود وابستگی ناسازگار، حذف انجام نشد و هیچ داده‌ای تغییر نکرد."
            : "حذف دائمی محصول کاتالوگ ناموفق بود."
      : deleteMutation.isError
        ? "خطا در حذف دائمی محصول کاتالوگ"
        : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={setOpen}
    >
      <Dialog.Trigger>
        <Button
          color="red"
          size={{ initial: "2", lg: "1" }}
          aria-label={`حذف دائمی ${catalog.name}`}
        >
          <TrashIcon />
        </Button>
      </Dialog.Trigger>

      <Dialog.Content dir="rtl" maxWidth="420px">
        <Dialog.Title color="red">
          حذف دائمی محصول کاتالوگ
        </Dialog.Title>

        <Dialog.Description mt="3">
          با حذف دائمی محصول <strong>«{catalog.name}»</strong>، این محصول از
          کاتالوگ حذف شده و تمام نسخه‌های آن در لیست محصولات کاربران نیز حذف
          خواهد شد. این عملیات قابل بازگشت نیست.
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
            حذف دائمی
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

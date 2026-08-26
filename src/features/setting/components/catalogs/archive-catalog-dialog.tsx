import { useState } from "react";

import { ArchiveIcon } from "@radix-ui/react-icons";
import { Callout, Dialog, Flex } from "@radix-ui/themes";

import { Button } from "@/shared/ui/button/button";

import { useArchiveCatalog } from "../../mutations/use-catalog";
import type { CatalogProduct } from "../../types";

type Props = {
  catalog: CatalogProduct;
};

export default function ArchiveCatalogDialog({ catalog }: Props) {
  const [open, setOpen] = useState(false);
  const mutation = useArchiveCatalog();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) mutation.reset();
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>
        <Button
          color="amber"
          variant="soft"
          size={{ initial: "2", lg: "1" }}
          aria-label={`بایگانی ${catalog.name}`}
        >
          <ArchiveIcon />
        </Button>
      </Dialog.Trigger>

      <Dialog.Content dir="rtl" maxWidth="440px">
        <Dialog.Title>بایگانی محصول کاتالوگ</Dialog.Title>
        <Dialog.Description mt="3">
          محصول <strong>«{catalog.name}»</strong> از کاتالوگ فعال خارج می‌شود و
          برای کاربران جدید ارائه نخواهد شد. محصولات موجود کاربران حذف نخواهند
          شد.
        </Dialog.Description>

        {mutation.isError && (
          <Callout.Root color="red" mt="4">
            <Callout.Text>بایگانی محصول کاتالوگ ناموفق بود.</Callout.Text>
          </Callout.Root>
        )}

        <Flex justify="end" gap="3" mt="6">
          <Dialog.Close>
            <Button variant="soft" color="gray">لغو</Button>
          </Dialog.Close>
          <Button
            color="amber"
            loading={mutation.isPending}
            onClick={() => mutation.mutate(catalog.id, { onSuccess: () => setOpen(false) })}
          >
            بایگانی
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

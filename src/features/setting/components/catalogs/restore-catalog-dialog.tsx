import { useState } from "react";

import { ReloadIcon } from "@radix-ui/react-icons";
import { Callout, Dialog, Flex } from "@radix-ui/themes";

import { Button } from "@/shared/ui/button/button";

import { useRestoreCatalog } from "../../mutations/use-catalog";
import type { CatalogProduct } from "../../types";

type Props = {
  catalog: CatalogProduct;
};

export default function RestoreCatalogDialog({ catalog }: Props) {
  const [open, setOpen] = useState(false);
  const mutation = useRestoreCatalog();

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) mutation.reset();
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger>
        <Button
          color="green"
          variant="soft"
          size={{ initial: "2", lg: "1" }}
          aria-label={`بازگردانی ${catalog.name}`}
        >
          <ReloadIcon />
          بازگردانی
        </Button>
      </Dialog.Trigger>

      <Dialog.Content dir="rtl" maxWidth="440px">
        <Dialog.Title>بازگردانی محصول کاتالوگ</Dialog.Title>
        <Dialog.Description mt="3">
          محصول <strong>«{catalog.name}»</strong> دوباره در کاتالوگ فعال قرار
          می‌گیرد و می‌تواند برای کاربران جدید ارائه شود.
        </Dialog.Description>

        {mutation.isError && (
          <Callout.Root color="red" mt="4">
            <Callout.Text>بازگردانی محصول کاتالوگ ناموفق بود.</Callout.Text>
          </Callout.Root>
        )}

        <Flex justify="end" gap="3" mt="6">
          <Dialog.Close>
            <Button variant="soft" color="gray">لغو</Button>
          </Dialog.Close>
          <Button
            color="green"
            loading={mutation.isPending}
            onClick={() => mutation.mutate(catalog.id, { onSuccess: () => setOpen(false) })}
          >
            بازگردانی
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

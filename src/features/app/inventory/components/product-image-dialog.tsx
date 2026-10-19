import { Cross1Icon } from "@radix-ui/react-icons";
import { Dialog, IconButton } from "@radix-ui/themes";

import productPlaceholder from "@/assets/product-placeholder.svg";
import { useImage } from "@/shared/lib/infrastructure/media/useImage";
import type { Product } from "../types";

type Props = {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
};

export function ProductImageDialog({ product, onOpenChange }: Props) {
  const image = useImage(
    product?.image_url ?? product?.catalog_product?.image_url,
  ) ?? productPlaceholder;
  const name = product?.custom_label ?? product?.catalog_product?.name ?? "محصول";

  return (
    <Dialog.Root open={product !== null} onOpenChange={onOpenChange}>
      <Dialog.Content
        aria-describedby={undefined}
        className="h-[calc(100dvh-2rem)]! w-[calc(100vw-2rem)]! max-w-[72rem]! overflow-hidden bg-black/95! p-0!"
      >
        <Dialog.Title className="sr-only">تصویر {name}</Dialog.Title>
        <Dialog.Close>
          <IconButton
            type="button"
            aria-label="بستن تصویر"
            color="gray"
            variant="solid"
            size="3"
            className="absolute left-3 top-3 z-10 shadow-lg"
          >
            <Cross1Icon width="20" height="20" />
          </IconButton>
        </Dialog.Close>
        <div className="flex h-full w-full items-center justify-center p-3 sm:p-6">
          <img
            src={image}
            alt={name}
            className="max-h-full max-w-full select-none object-contain"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = productPlaceholder;
            }}
          />
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}

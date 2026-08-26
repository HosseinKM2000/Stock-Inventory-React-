import { resolveAssetUrl } from "@/shared/api/client";
import { Button } from "@/shared/ui/button/button";
import {
  CalendarIcon,
  CubeIcon,
  EyeOpenIcon,
  ImageIcon,
} from "@radix-ui/react-icons";
import {
  Box,
  Callout,
  Dialog,
  Flex,
  Grid,
  Spinner,
  Text,
} from "@radix-ui/themes";
import { useState, type ReactNode } from "react";

import { useCatalogProduct } from "../../mutations/use-catalog";

type Props = {
  catalogId: number;
  fallbackIndustryName?: string;
  trigger?: ReactNode;
};

const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function CatalogDetailsDialog({
  catalogId,
  fallbackIndustryName,
  trigger,
}: Props) {
  const [open, setOpen] = useState(false);
  const { data: product, isLoading, isError, error } = useCatalogProduct(
    catalogId,
    open,
  );

  const imageUrl = resolveAssetUrl(product?.image_url);
  const createdAt = product
    ? dateFormatter.format(new Date(product.created_at))
    : "—";
  const industryName =
    product?.industry?.name ?? fallbackIndustryName ?? "حوزه نامشخص";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        {trigger ?? (
          <Button size="2" variant="soft">
            <EyeOpenIcon />
            مشاهده
          </Button>
        )}
      </Dialog.Trigger>

      <Dialog.Content
        dir="rtl"
        maxWidth="680px"
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto"
      >
        <Dialog.Title>جزئیات محصول کاتالوگ</Dialog.Title>
        <Dialog.Description color="gray">
          اطلاعات کامل محصول مشترک و حوزه کاری آن
        </Dialog.Description>

        {isLoading && (
          <Flex justify="center" align="center" height="240px">
            <Spinner size="3" />
          </Flex>
        )}

        {isError && (
          <Callout.Root color="red" mt="4">
            <Callout.Text>
              {error instanceof Error
                ? error.message
                : "دریافت جزئیات محصول ناموفق بود."}
            </Callout.Text>
          </Callout.Root>
        )}

        {product && (
          <Flex direction="column" gap="5" mt="5">
            <Box className="aspect-[16/7] overflow-hidden rounded-xl bg-[var(--gray-a3)]">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <Flex height="100%" align="center" justify="center" direction="column" gap="2">
                  <ImageIcon width="28" height="28" />
                  <Text size="2" color="gray">بدون تصویر</Text>
                </Flex>
              )}
            </Box>

            <Box>
              <Text as="div" size="5" weight="bold">{product.name}</Text>
              <Text as="div" size="2" color="gray" mt="2" className="whitespace-pre-wrap">
                {product.description || "بدون توضیحات"}
              </Text>
            </Box>

            <Grid columns={{ initial: "1", sm: "2" }} gap="3">
              <Flex gap="3" align="center" className="rounded-xl border border-[var(--gray-a5)] p-3">
                <Box className="card-metric-icon"><CubeIcon /></Box>
                <Box>
                  <Text as="div" size="1" color="gray">حوزه کاری</Text>
                  <Text as="div" size="2" weight="medium">{industryName}</Text>
                </Box>
              </Flex>
              <Flex gap="3" align="center" className="rounded-xl border border-[var(--gray-a5)] p-3">
                <Box className="card-metric-icon"><CalendarIcon /></Box>
                <Box>
                  <Text as="div" size="1" color="gray">تاریخ ایجاد</Text>
                  <Text as="div" size="2" weight="medium">{createdAt}</Text>
                </Box>
              </Flex>
            </Grid>

            <Box>
              <Text as="div" size="1" color="gray">برند</Text>
              <Text as="div" size="2" weight="medium" mt="1">
                {product.brand || "ثبت نشده"}
              </Text>
            </Box>
          </Flex>
        )}

        <Flex justify="end" mt="6">
          <Dialog.Close>
            <Button variant="soft" color="gray">بستن</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

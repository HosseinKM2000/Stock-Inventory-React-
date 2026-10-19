import { Callout, Card, Flex, Select, Spinner, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { resolvedProductName } from "@/features/app/inventory/domain/product-eligibility";
import { useDashboardAnalysis } from "../mutations/use-dashboard";
import { formatProductQuantity } from "../services/dashboard-format";

type Mode = "category" | "label";

export function DashboardClassification() {
  const [mode, setMode] = useState<Mode>("category");
  const { data, isLoading, isError } = useDashboardAnalysis();
  const products = mode === "category"
    ? data?.classification.withoutCategory ?? []
    : data?.classification.withoutLabel ?? [];

  return (
    <Flex direction="column" gap="4" className="app-responsive-page p-4" dir="rtl">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <div>
          <Text as="div" role="heading" aria-level={1} size="6" weight="bold">محصولات بدون دسته یا برچسب</Text>
          <Text as="p" size="2" color="gray" mt="1">برای تکمیل اطلاعات، محصول را باز و ویرایش کنید.</Text>
        </div>
        <Select.Root value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <Select.Trigger aria-label="نوع اطلاعات ناقص" />
          <Select.Content>
            <Select.Item value="category">بدون دسته‌بندی</Select.Item>
            <Select.Item value="label">بدون برچسب</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {!isLoading && !isError && (
        <Text size="2" color="gray">{products.length.toLocaleString("fa-IR")} محصول در این حالت</Text>
      )}
      {isLoading && <Flex justify="center" py="9"><Spinner /></Flex>}
      {isError && <Callout.Root color="red"><Callout.Text>خواندن اطلاعات محلی ممکن نبود.</Callout.Text></Callout.Root>}
      {!isLoading && !isError && products.length === 0 && (
        <Flex justify="center" py="9"><Text color="gray">همه محصولات این اطلاعات را دارند.</Text></Flex>
      )}
      {products.map((product) => (
        <Link key={product.id} to="/inventory/edit" search={{ id: product.id }} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2">
          <Card className="transition-colors hover:bg-[var(--accent-a2)]">
            <Flex justify="between" align="center" gap="4">
              <Text weight="medium" className="min-w-0 break-words">{resolvedProductName(product)}</Text>
              <Text size="2" color="gray" className="shrink-0">{formatProductQuantity(product)}</Text>
            </Flex>
          </Card>
        </Link>
      ))}
    </Flex>
  );
}

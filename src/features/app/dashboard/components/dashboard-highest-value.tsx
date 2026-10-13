import { Callout, Card, Flex, Select, Spinner, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { resolvedProductName } from "@/features/app/inventory/domain/product-eligibility";
import { useDashboardAnalysis } from "../mutations/use-dashboard";
import { formatProductQuantity } from "../services/dashboard-format";

type Mode = "products" | "categories";

export function DashboardHighestValue() {
  const [mode, setMode] = useState<Mode>("products");
  const { data, isLoading, isError } = useDashboardAnalysis();
  const empty = mode === "products"
    ? data?.productValues.length === 0
    : data?.categoryValues.length === 0;

  return (
    <Flex direction="column" gap="4" className="app-responsive-page p-4" dir="rtl">
      <Flex justify="between" align="center" gap="3" wrap="wrap">
        <div>
          <Text as="div" role="heading" aria-level={1} size="6" weight="bold">ارزشمندترین‌ها</Text>
          <Text as="p" size="2" color="gray" mt="1">رتبه‌بندی بر اساس تعداد واقعی واحد × قیمت هر واحد</Text>
        </div>
        <Select.Root value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <Select.Trigger aria-label="نوع رتبه‌بندی ارزش موجودی" />
          <Select.Content>
            <Select.Item value="products">محصولات</Select.Item>
            <Select.Item value="categories">دسته‌بندی‌ها</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      {isLoading && <Flex justify="center" py="9"><Spinner /></Flex>}
      {isError && <Callout.Root color="red"><Callout.Text>خواندن اطلاعات محلی ممکن نبود.</Callout.Text></Callout.Root>}
      {data && data.missingPriceCount > 0 && (
        <Callout.Root color="amber"><Callout.Text>
          ارزش‌ها ناقص‌اند؛ قیمت {data.missingPriceCount.toLocaleString("fa-IR")} محصول ثبت نشده است.
        </Callout.Text></Callout.Root>
      )}
      {data && mode === "categories" && data.excludedUncategorizedValue > 0 && (
        <Text size="2" color="gray">
          ارزش محصولات بدون دسته‌بندی: {data.excludedUncategorizedValue.toLocaleString("fa-IR")} تومان (در جمع دسته‌ها لحاظ نشده)
        </Text>
      )}
      {!isLoading && !isError && empty && (
        <Flex justify="center" py="9"><Text color="gray">موردی با ارزش موجودی مثبت یافت نشد.</Text></Flex>
      )}

      {data && mode === "products" && data.productValues.map(({ product, value }) => (
        <Link key={product.id} to="/inventory/edit" search={{ id: product.id }} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2">
          <Card className="transition-colors hover:bg-[var(--accent-a2)]">
            <Flex justify="between" gap="4" align="center" wrap="wrap">
              <div className="min-w-0">
                <Text as="div" weight="bold" className="break-words">{resolvedProductName(product)}</Text>
                <Text as="div" size="2" color="gray">{formatProductQuantity(product)} · قیمت واحد {product.price.toLocaleString("fa-IR")} تومان</Text>
              </div>
              <Text weight="bold" color="green" className="shrink-0">{value.toLocaleString("fa-IR")} تومان</Text>
            </Flex>
          </Card>
        </Link>
      ))}

      {data && mode === "categories" && data.categoryValues.map((category) => (
        <Card key={category.categoryId}>
          <Flex justify="between" gap="4" align="center" wrap="wrap">
            <div>
              <Text as="div" weight="bold">{category.name}</Text>
              <Text as="div" size="2" color="gray">{category.productCount.toLocaleString("fa-IR")} محصول</Text>
            </div>
            <Text weight="bold" color="green">{category.value.toLocaleString("fa-IR")} تومان</Text>
          </Flex>
        </Card>
      ))}
    </Flex>
  );
}

import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import { accessState } from "@/shared/access/access-state";
import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { useQuery } from "@tanstack/react-query";
import { Callout, Card, Flex, Grid, Select, Spinner, Text } from "@radix-ui/themes";
import { useState } from "react";
import { BanknoteArrowDown, BanknoteArrowUp, ChartNoAxesCombined, CircleAlert, PackageSearch } from "lucide-react";
import { calculateFinancialInsights, formatToman } from "../services/financial-insights";
import { DashboardProductCard } from "./dashboard-product-card";

type DetailMode = "profit" | "below" | "missing" | "categories";

export function FinancialDashboard() {
  const allowed = accessState.hasStorePermission("finance.view");
  const [mode, setMode] = useState<DetailMode>("profit");
  const query = useQuery({
    queryKey: ["dashboard", "financial-insights"],
    enabled: allowed,
    queryFn: async () => {
      const [products, categories] = await Promise.all([inventoryService.getAll({ include_hidden: false }), categoryStorage.getAll()]);
      return calculateFinancialInsights(products, categories);
    },
  });
  if (!allowed) return <Callout.Root color="red" m="4"><Callout.Text>مجوز مشاهده تحلیل مالی برای این حساب فعال نیست.</Callout.Text></Callout.Root>;
  if (query.isLoading) return <Flex justify="center" py="9"><Spinner size="3" /></Flex>;
  if (!query.data) return <Callout.Root color="red" m="4"><Callout.Text>محاسبه اطلاعات مالی محلی ممکن نبود.</Callout.Text></Callout.Root>;
  const data = query.data;
  const metricCards = [
    { label: "ارزش موجودی با قیمت خرید", value: formatToman(data.purchaseInventoryValue), icon: BanknoteArrowDown, tone: "financial-metric--purchase" },
    { label: "ارزش موجودی با قیمت فروش", value: formatToman(data.saleInventoryValue), icon: BanknoteArrowUp, tone: "financial-metric--sale" },
    { label: "سود ناخالص بالقوه", value: formatToman(data.potentialGrossProfit), icon: ChartNoAxesCombined, tone: "financial-metric--profit" },
    { label: "حاشیه سود بالقوه", value: data.grossMarginPercent == null ? "نامشخص" : `${data.grossMarginPercent.toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪`, icon: CircleAlert, tone: "financial-metric--margin" },
  ];
  const missingRows = data.products.filter((row) => row.purchaseValue == null || row.saleValue == null);

  return <main className="financial-dashboard app-responsive-page p-4 md:p-6" dir="rtl">
    <Flex justify="between" align="start" gap="4" wrap="wrap">
      <div><h1 className="text-2xl font-bold">مالی</h1><Text as="p" color="gray" mt="1">ارزش موجودی و سود بالقوه بر پایه قیمت‌های فعلی</Text></div>
      <Select.Root value={mode} onValueChange={(value) => setMode(value as DetailMode)}><Select.Trigger aria-label="نمای جزئیات مالی" /><Select.Content><Select.Item value="profit">بیشترین سود بالقوه</Select.Item><Select.Item value="below">فروش زیر قیمت خرید</Select.Item><Select.Item value="missing">قیمت‌های ناقص</Select.Item><Select.Item value="categories">سهم دسته‌بندی‌ها</Select.Item></Select.Content></Select.Root>
    </Flex>
    <Grid columns={{ initial: "1", sm: "2", lg: "4" }} gap="3" mt="5">{metricCards.map((metric) => <Card key={metric.label} className={`financial-metric ${metric.tone}`}><metric.icon aria-hidden="true" size={22} /><Text as="div" size="2" color="gray" mt="3">{metric.label}</Text><Text as="div" size="5" weight="bold" mt="1">{metric.value}</Text></Card>)}</Grid>
    <Card mt="4" className="financial-coverage"><Flex gap="4" wrap="wrap" justify="between"><Text>بدون قیمت خرید: <b>{data.missingPurchaseCount.toLocaleString("fa-IR")}</b></Text><Text>بدون قیمت فروش: <b>{data.missingSaleCount.toLocaleString("fa-IR")}</b></Text><Text>فاقد یکی از قیمت‌ها: <b>{data.missingEitherCount.toLocaleString("fa-IR")}</b></Text><Text>کامل: <b>{data.fullyPricedCount.toLocaleString("fa-IR")}</b></Text></Flex></Card>
    <Callout.Root color="gray" mt="4"><Callout.Text>سود بالقوه فقط برای کالاهای دارای هر دو قیمت محاسبه می‌شود و تخفیف، مالیات، هزینه عملیاتی و فروش تحقق‌یافته را نشان نمی‌دهد.</Callout.Text></Callout.Root>
    <Flex direction="column" gap="2" mt="5">
      {mode === "profit" ? data.highestPotentialProfit.slice(0, 50).map((row) => <FinancialRow key={row.product.id} row={row} detail={`سود بالقوه موجودی: ${formatToman(row.potentialProfit!)}`} />) : null}
      {mode === "below" ? data.belowCost.map((row) => <FinancialRow key={row.product.id} row={row} detail={`اختلاف هر واحد: ${row.unitDifference!.toLocaleString("fa-IR")} تومان`} danger />) : null}
      {mode === "missing" ? missingRows.map((row) => <FinancialRow key={row.product.id} row={row} detail={`${row.purchaseValue == null ? "قیمت خرید نامشخص" : ""}${row.purchaseValue == null && row.saleValue == null ? "، " : ""}${row.saleValue == null ? "قیمت فروش نامشخص" : ""}`} />) : null}
      {mode === "categories" ? data.categoryContribution.map((category) => <Card key={category.categoryId ?? "none"}><Flex justify="between" gap="3"><div><Text weight="bold">{category.name}</Text><Text as="div" size="1" color="gray">{category.productCount.toLocaleString("fa-IR")} کالای واجد هر دو قیمت</Text></div><Text weight="bold">{formatToman(category.potentialProfit)}</Text></Flex></Card>) : null}
      {((mode === "profit" && data.highestPotentialProfit.length === 0) || (mode === "below" && data.belowCost.length === 0) || (mode === "missing" && missingRows.length === 0) || (mode === "categories" && data.categoryContribution.length === 0)) ? <Card className="py-8 text-center"><PackageSearch className="mx-auto mb-2" aria-hidden="true" /><Text color="gray">موردی برای نمایش وجود ندارد.</Text></Card> : null}
    </Flex>
  </main>;
}

function FinancialRow({ row, detail, danger = false }: { row: ReturnType<typeof calculateFinancialInsights>["products"][number]; detail: string; danger?: boolean }) {
  return <DashboardProductCard product={row.product} variant={danger ? "low" : "standard"} secondaryLabel={detail} valueLabel={`${row.product.quantity.toLocaleString("fa-IR")} عدد`} />;
}

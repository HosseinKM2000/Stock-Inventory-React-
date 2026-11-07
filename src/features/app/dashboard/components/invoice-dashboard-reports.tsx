import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { useQuery } from "@tanstack/react-query";
import { Callout, Card, Flex, Grid, Spinner, Text } from "@radix-ui/themes";
import type { InvoiceReportMetric, UnconfirmedInvoiceWindow } from "../services/invoice-dashboard-report";
import { invoiceReportService } from "../services/invoice-report.service";

const periods = [
  ["today", "امروز"], ["sevenDays", "۷ روز اخیر"], ["thirtyDays", "۳۰ روز اخیر"],
] as const;

function Metric({ label, metric, partial }: { label: string; metric: InvoiceReportMetric; partial: boolean }) {
  if (metric.kind === "restricted") return <Card><Text as="div" size="2" color="gray">{label}</Text><Text as="div" mt="2" weight="bold">دسترسی محدود</Text><Text as="p" size="1" color="gray" mt="1">مبلغ و تعداد برای این حساب نمایش داده نمی‌شود.</Text></Card>;
  const noData = metric.count === 0;
  return <Card>
    <Text as="div" size="2" color="gray">{label}</Text>
    <Text as="div" mt="2" size="5" weight="bold">{noData ? "داده‌ای ثبت نشده" : `${metric.total.toLocaleString("fa-IR")} تومان`}</Text>
    <Text as="div" mt="1" size="2" color="gray">{metric.count.toLocaleString("fa-IR")} فاکتور{partial && !noData ? " · جمع قابل مشاهده" : ""}</Text>
    {metric.incompleteCount > 0 ? <Text as="p" size="1" color="amber" mt="1">{metric.incompleteCount.toLocaleString("fa-IR")} فاکتور مبلغ قابل مشاهده ندارد؛ جمع کامل نیست.</Text> : null}
    {metric.pendingCancellationCount > 0 ? <Text as="p" size="1" color="amber" mt="1">لغو {metric.pendingCancellationCount.toLocaleString("fa-IR")} فاکتور هنوز قطعی نشده؛ آخرین وضعیت تأییدشده در جمع مانده است.</Text> : null}
  </Card>;
}

function Unconfirmed({ value }: { value: UnconfirmedInvoiceWindow }) {
  const purchase = value.purchase.kind === "value" && value.purchase.count > 0 ? value.purchase : null;
  const sale = value.sale.kind === "value" && value.sale.count > 0 ? value.sale : null;
  if (!purchase && !sale) return null;
  return <Card mt="3" variant="surface">
    <Text weight="bold">ثبت محلی تأییدنشده</Text>
    <Text as="p" size="2" color="gray" mt="1">
      {purchase ? `خرید: ${purchase.count.toLocaleString("fa-IR")} فاکتور، ${purchase.total.toLocaleString("fa-IR")} تومان` : ""}
      {purchase && sale ? " · " : ""}
      {sale ? `فروش: ${sale.count.toLocaleString("fa-IR")} فاکتور، ${sale.total.toLocaleString("fa-IR")} تومان` : ""}
    </Text>
  </Card>;
}

export function InvoiceDashboardReports() {
  const query = useQuery({ queryKey: ["dashboard", "invoice-report"], queryFn: () => invoiceReportService.get(), staleTime: 30_000 });
  if (query.isLoading) return <Flex justify="center" py="9"><Spinner size="3" /></Flex>;
  if (!query.data) return <Callout.Root color="red" m="4"><Callout.Text>خواندن گزارش فاکتورها ممکن نبود.</Callout.Text></Callout.Root>;
  const data = query.data;
  return <main className="app-responsive-page p-4 md:p-6" dir="rtl">
    <div><h1 className="text-2xl font-bold">گزارش خرید و فروش</h1><Text as="p" color="gray" mt="1">بر پایه مبلغ ثابت فاکتورهای تأییدشده؛ نه گردش موجودی یا قیمت فعلی کالا</Text></div>
    {!data.completeHistory ? <Callout.Root color="amber" mt="4"><Callout.Text>پوشش تاریخچه کامل تأیید نشده است؛ مبالغ زیر فقط داده‌های قابل مشاهده روی این دستگاه‌اند.</Callout.Text></Callout.Root> : <Text as="p" size="2" color="gray" mt="3">پوشش کامل آخرین بار در {formatJalaliDateTime(data.completeAt!)} دریافت شده است.</Text>}
    {periods.map(([key, title]) => <section key={key} className="mt-6" aria-labelledby={`invoice-report-${key}`}>
      <Text id={`invoice-report-${key}`} as="div" role="heading" aria-level={2} size="4" weight="bold" mb="3">{title}</Text>
      <Grid columns={{ initial: "1", sm: "2" }} gap="3"><Metric label="خرید قطعی" metric={data.windows[key].purchase} partial={!data.completeHistory} /><Metric label="فروش قطعی" metric={data.windows[key].sale} partial={!data.completeHistory} /></Grid>
      <Unconfirmed value={data.unconfirmedSolo[key]} />
    </section>)}
    <Callout.Root color="gray" mt="6"><Callout.Text>مبلغ فروش به معنی وجه وصول‌شده نیست و اختلاف خرید و فروش نیز سود تحقق‌یافته محسوب نمی‌شود.</Callout.Text></Callout.Root>
  </main>;
}

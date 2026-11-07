import type { Invoice } from "@/features/invoices/types";

export type InvoiceReportMetric =
  | { kind: "restricted" }
  | { kind: "value"; count: number; total: number; incompleteCount: number; pendingCancellationCount: number };

export type InvoiceReportWindow = { purchase: InvoiceReportMetric; sale: InvoiceReportMetric };
export type UnconfirmedInvoiceMetric = { kind: "restricted" } | { kind: "value"; count: number; total: number };
export type UnconfirmedInvoiceWindow = { purchase: UnconfirmedInvoiceMetric; sale: UnconfirmedInvoiceMetric };
export type InvoiceReportOptions = {
  now: Date;
  completeHistory: boolean;
  canViewPurchase: boolean;
  canViewSale: boolean;
  solo: boolean;
};

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
});

function tehranDay(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(dayFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return Math.floor(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86_400_000);
}

function emptyMetric(): Extract<InvoiceReportMetric, { kind: "value" }> {
  return { kind: "value", count: 0, total: 0, incompleteCount: 0, pendingCancellationCount: 0 };
}

export function calculateInvoiceDashboardReport(invoices: readonly Invoice[], options: InvoiceReportOptions) {
  const today = tehranDay(options.now)!;
  const unique = new Map<number, Invoice>();
  for (const invoice of invoices) unique.set(invoice.id, invoice);
  const ranges = { today: 1, sevenDays: 7, thirtyDays: 30 } as const;
  const windows = Object.fromEntries(Object.keys(ranges).map((key) => [key, { purchase: emptyMetric(), sale: emptyMetric() }])) as Record<keyof typeof ranges, InvoiceReportWindow>;
  const unconfirmedSolo = Object.fromEntries(Object.keys(ranges).map((key) => [key, {
    purchase: { kind: "value", count: 0, total: 0 },
    sale: { kind: "value", count: 0, total: 0 },
  }])) as Record<keyof typeof ranges, UnconfirmedInvoiceWindow>;

  for (const invoice of unique.values()) {
    const day = tehranDay(invoice.posted_at);
    if (day == null) continue;
    const age = today - day;
    if (age < 0 || age >= 30) continue;
    for (const [key, days] of Object.entries(ranges) as Array<[keyof typeof ranges, number]>) {
      if (age >= days) continue;
      if (invoice.status === "pending" && options.solo && invoice.total_amount != null) {
        const metric = unconfirmedSolo[key][invoice.invoice_type];
        if (metric.kind === "value") { metric.count += 1; metric.total += invoice.total_amount; }
        continue;
      }
      if (invoice.status !== "accepted" && invoice.status !== "cancel_pending") continue;
      const metric = windows[key][invoice.invoice_type];
      if (metric.kind !== "value") continue;
      metric.count += 1;
      if (invoice.total_amount == null) metric.incompleteCount += 1;
      else metric.total += invoice.total_amount;
      if (invoice.status === "cancel_pending") metric.pendingCancellationCount += 1;
    }
  }

  if (!options.canViewPurchase) {
    for (const value of Object.values(windows)) value.purchase = { kind: "restricted" };
    for (const value of Object.values(unconfirmedSolo)) value.purchase = { kind: "restricted" };
  }
  if (!options.canViewSale) {
    for (const value of Object.values(windows)) value.sale = { kind: "restricted" };
    for (const value of Object.values(unconfirmedSolo)) value.sale = { kind: "restricted" };
  }
  return { windows, unconfirmedSolo, completeHistory: options.completeHistory };
}

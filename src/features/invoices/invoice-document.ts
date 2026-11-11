import { accessState } from "@/shared/access/access-state";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { captureSyncAccountContext } from "@/shared/lib/infrastructure/sync/sync-account-context";
import type { Invoice } from "./types";

export type InvoiceDocument = {
  id: number;
  storeName: string;
  typeLabel: string;
  reference: string;
  postedAt: string;
  title: string;
  counterparty: string | null;
  cancelled: boolean;
  localOnly: boolean;
  total: number;
  lines: Array<{ product: string; quantity: number; unit: string; unitPrice: number; total: number }>;
  account: ReturnType<typeof captureSyncAccountContext>;
};

export function buildInvoiceDocument(invoice: Invoice): InvoiceDocument {
  accessState.requireCapability(invoice.invoice_type === "purchase" ? "invoices.purchase" : "invoices.sale");
  accessState.requireStorePermission("invoices.view");
  accessState.requireStorePermission(invoice.invoice_type === "purchase" ? "products.purchase_price.view" : "products.sale_price.view");
  const account = captureSyncAccountContext();
  const storeName = accessState.user()?.store_name?.trim() || accessState.user()?.username || "تنظیم";
  if (invoice.local_user_id !== account.actorUserId || invoice.local_store_id !== account.storeId) throw new Error("INVOICE_SCOPE_MISMATCH");
  const localOnly = invoice.status === "pending" && accessState.user()?.store_operating_mode === "solo";
  if (invoice.status !== "accepted" && invoice.status !== "cancelled" && !localOnly) throw new Error("این فاکتور هنوز سند نهایی قابل ارائه ندارد.");
  if (invoice.total_amount == null || invoice.lines.some((line) => line.unit_price == null || line.line_total == null)) {
    throw new Error("قیمت‌های این فاکتور برای شما قابل مشاهده نیست.");
  }
  return {
    id: invoice.id,
    storeName,
    typeLabel: invoice.invoice_type === "purchase" ? "فاکتور خرید" : "فاکتور فروش",
    reference: invoice.post_operation_id || String(invoice.id),
    postedAt: formatJalaliDateTime(invoice.posted_at),
    title: invoice.title,
    counterparty: invoice.counterparty,
    cancelled: invoice.status === "cancelled",
    localOnly,
    total: invoice.total_amount,
    lines: invoice.lines.map((line) => ({ product: line.product_name, quantity: line.quantity, unit: line.unit, unitPrice: line.unit_price!, total: line.line_total! })),
    account,
  };
}

export function invoiceFileName(document: InvoiceDocument) {
  return `invoice-${document.id}.pdf`;
}

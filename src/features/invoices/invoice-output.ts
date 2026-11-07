import { assertSyncAccountCurrent } from "@/shared/lib/infrastructure/sync/sync-account-context";
import { buildInvoiceDocument, invoiceFileName } from "./invoice-document";
import type { Invoice } from "./types";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const number = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

async function pdf(invoice: Invoice) {
  const document = buildInvoiceDocument(invoice);
  const file = await import("./invoice-pdf").then((module) => module.createInvoicePdf(document));
  assertSyncAccountCurrent(document.account);
  return { document, file };
}

export const invoiceOutput = {
  async download(invoice: Invoice) {
    const { document, file } = await pdf(invoice);
    const url = URL.createObjectURL(file); const anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = invoiceFileName(document); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  },
  async share(invoice: Invoice) {
    const { document, file } = await pdf(invoice);
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) throw new Error("اشتراک‌گذاری فایل در این دستگاه پشتیبانی نمی‌شود؛ PDF را دریافت کنید.");
    try { await navigator.share({ files: [file], title: document.title }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) throw error; }
  },
  print(invoice: Invoice) {
    const document = buildInvoiceDocument(invoice);
    const frame = window.document.createElement("iframe"); frame.hidden = true; window.document.body.append(frame);
    const watermark = document.cancelled ? '<div class="watermark">باطل‌شده</div>' : "";
    const rows = document.lines.map((line) => `<tr><td>${escape(line.product)}</td><td>${number(line.quantity)} ${escape(line.unit)}</td><td>${number(line.unitPrice)}</td><td>${number(line.total)}</td></tr>`).join("");
    frame.contentDocument!.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@font-face{font-family:Vazirmatn;src:url('/fonts/vazirmatn/Vazirmatn-Variable.woff2')}@page{size:A4;margin:16mm}body{font-family:Vazirmatn;color:#172b38}table{width:100%;border-collapse:collapse}thead{display:table-header-group}th,td{padding:8px;border:1px solid #ccd7de;text-align:right;overflow-wrap:anywhere}.total{font-weight:700;margin-top:18px}.watermark{position:fixed;inset:40% 0;text-align:center;transform:rotate(-32deg);font-size:72px;color:#b4231830;font-weight:800}.local{color:#9a5a00}</style></head><body>${watermark}<h1>${escape(document.typeLabel)}</h1><p>${escape(document.title)} — ${escape(document.postedAt)}</p><p>شناسه: ${escape(document.reference)}</p>${document.counterparty ? `<p>طرف حساب: ${escape(document.counterparty)}</p>` : ""}${document.localOnly ? '<p class="local">ذخیره‌شده روی این دستگاه</p>' : ""}<table><thead><tr><th>شرح کالا</th><th>تعداد</th><th>فی</th><th>مبلغ</th></tr></thead><tbody>${rows}</tbody></table><p class="total">جمع کل: ${number(document.total)} تومان</p></body></html>`);
    frame.contentDocument!.close(); assertSyncAccountCurrent(document.account);
    frame.contentWindow?.addEventListener("afterprint", () => frame.remove(), { once: true });
    setTimeout(() => { frame.contentWindow?.focus(); frame.contentWindow?.print(); }, 100);
  },
};

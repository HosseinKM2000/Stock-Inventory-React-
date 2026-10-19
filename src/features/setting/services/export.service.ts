import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import type { Product } from "@/features/app/inventory/types";
import { apiFetch } from "@/shared/api/client";
import { accessState } from "@/shared/access/access-state";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { formatJalaliDateTime } from "@/shared/lib/date/jalali";
import { barcodeRepository } from "@/features/barcode/services/barcode-repository";

export type ExportFormat = "xlsx" | "csv" | "pdf";

export type ExportScope = "all" | "low_stock" | "category" | "selected";

export type ExportOptions = {
  format: ExportFormat;

  scope: ExportScope;

  categoryId?: number | null;
  selectedIds?: number[];
};

type ExportColumn = { key: string; label: string; value(product: Product, primaryBarcodes: ReadonlyMap<number, string>): string };

function columns(): ExportColumn[] {
  const output: ExportColumn[] = [
    { key: "primary_barcode", label: "بارکد اصلی", value: (product, barcodes) => barcodes.get(product.id) ?? "" },
    { key: "id", label: "شناسه", value: (p) => String(p.id) },
    {
      key: "name",
      label: "نام",
      value: (p) => p.custom_label ?? p.catalog_product?.name ?? "",
    },
    { key: "quantity", label: "تعداد", value: (p) => String(p.quantity) },
    { key: "is_packaged", label: "بسته‌بندی", value: (p) => p.catalog_product?.is_packaged ? "بله" : "خیر" },
    { key: "pack_size", label: "تعداد در هر بسته", value: (p) => p.catalog_product?.pack_size == null ? "" : String(p.catalog_product.pack_size) },
    { key: "sale_price", label: "قیمت فروش", value: (p) => p.sale_price == null ? "" : String(p.sale_price) },
    { key: "status", label: "وضعیت", value: (p) => p.status },
    { key: "note", label: "یادداشت", value: (p) => p.note ?? "" },
    { key: "updated_at", label: "بروزرسانی", value: (p) => formatJalaliDateTime(p.updated_at) },
  ];
  if (typeof accessState.hasStorePermission === "function" && accessState.hasStorePermission("products.purchase_price.view")) {
    output.splice(7, 0, { key: "purchase_price", label: "قیمت خرید", value: (p) => p.purchase_price == null ? "" : String(p.purchase_price) });
  }
  return output;
}

function escapeCsv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(products: Product[], primaryBarcodes: ReadonlyMap<number, string>) {
  const selectedColumns = columns();
  const header = selectedColumns.map((column) => column.label).join(",");

  const rows = products.map((product) =>
    selectedColumns.map((column) => escapeCsv(column.value(product, primaryBarcodes))).join(","),
  );

  // BOM keeps Excel from mangling the Persian labels.
  return `\uFEFF${[header, ...rows].join("\n")}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toHtmlTable(products: Product[], title: string, primaryBarcodes: ReadonlyMap<number, string>) {
  const selectedColumns = columns();
  const header = selectedColumns.map((column) => `<th>${column.label}</th>`).join("");

  const rows = products
    .map(
      (product) =>
        `<tr>${selectedColumns.map(
          (column) => `<td>${escapeHtml(column.value(product, primaryBarcodes))}</td>`,
        ).join("")}</tr>`,
    )
    .join("");

  const fontUrl = window.location.origin && window.location.origin !== "null"
    ? `${window.location.origin}/fonts/vazirmatn/Vazirmatn-Variable.woff2`
    : "/fonts/vazirmatn/Vazirmatn-Variable.woff2";
  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8" />
<title>${title}</title>
<style>
@font-face{font-family:Vazirmatn;src:url('${fontUrl}') format('woff2-variations');font-style:normal;font-weight:100 900;font-display:block}
body{font-family:Vazirmatn,Tahoma,Arial,sans-serif;padding:16px}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #999;padding:6px;text-align:right;font-size:12px}
th{background:#eee}
</style></head><body><h3>${title}</h3><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

function printAsPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");

  frame.hidden = true;
  frame.src = url;
  document.body.appendChild(frame);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    frame.remove();
  };

  frame.onload = () => {
    const printWindow = frame.contentWindow;

    if (!printWindow) {
      cleanup();
      return;
    }

    printWindow.addEventListener("afterprint", cleanup, { once: true });
    void printWindow.document.fonts.ready.then(() => {
      printWindow.focus();
      printWindow.print();
    });

    // Some browsers do not emit afterprint when the dialog is cancelled.
    window.setTimeout(cleanup, 60_000);
  };
}

function applyScope(products: Product[], options: ExportOptions) {
  if (options.scope === "category" && options.categoryId == null) {
    throw new Error("برای خروجی دسته‌بندی، ابتدا یک دسته را انتخاب کنید.");
  }

  if (options.scope === "selected" && (options.selectedIds?.length ?? 0) === 0) {
    throw new Error("حداقل یک محصول را برای خروجی انتخاب کنید.");
  }

  if (options.scope === "low_stock") {
    return products.filter(
      (product) =>
        product.status === "low_stock" || product.status === "out_of_stock",
    );
  }

  if (options.scope === "category" && options.categoryId != null) {
    return products.filter((product) => product.category_id === options.categoryId);
  }

  if (options.scope === "selected") {
    const selected = new Set(options.selectedIds ?? []);
    return products.filter((product) => selected.has(product.id));
  }

  return products;
}

async function primaryBarcodeMap() {
  const barcodes = await barcodeRepository.getAll();
  const output = new Map<number, string>();
  for (const barcode of barcodes.filter((item) => item.is_active).sort((left, right) => Number(right.is_default) - Number(left.is_default))) {
    if (!output.has(barcode.product_id)) output.set(barcode.product_id, barcode.value);
  }
  return output;
}

function buildFile(products: Product[], options: ExportOptions, title: string, primaryBarcodes: ReadonlyMap<number, string>) {
  switch (options.format) {
    case "csv":
      return {
        blob: new Blob([toCsv(products, primaryBarcodes)], {
          type: "text/csv;charset=utf-8",
        }),
        extension: "csv",
      };

    case "xlsx":
      // Excel-compatible HTML table. The UI labels this honestly as .xls;
      // generating OOXML would require a spreadsheet dependency.
      return {
        blob: new Blob([toHtmlTable(products, title, primaryBarcodes)], {
          type: "application/vnd.ms-excel;charset=utf-8",
        }),
        extension: "xls",
      };

    case "pdf":
      return {
        blob: new Blob([toHtmlTable(products, title, primaryBarcodes)], {
          type: "text/html;charset=utf-8",
        }),
        extension: "html",
      };
  }
}

export class ServerExportUnavailableError extends Error {
  constructor() {
    super("برای دریافت خروجی سرور باید آنلاین باشید");
  }
}

export const exportService = {
  /** Exports the current offline state, straight from IndexedDB. */
  async exportLocal(options: ExportOptions) {
    accessState.requireTool("export");
    const products = applyScope(await inventoryService.getAll(), options);

    const title = "خروجی داده های محلی";

    const file = buildFile(products, options, title, await primaryBarcodeMap());

    const stamp = new Date().toISOString().slice(0, 10);

    if (options.format === "pdf") {
      printAsPdf(file.blob);
    } else {
      download(file.blob, `inventory-local-${stamp}.${file.extension}`);
    }

    return products.length;
  },

  /** Exports the server dataset, which may differ while changes are pending. */
  async exportServer(options: ExportOptions) {
    accessState.requireTool("export");
    accessState.requireCapability("export.server");
    if (networkService.isOffline()) {
      throw new ServerExportUnavailableError();
    }

    const stamp = new Date().toISOString().slice(0, 10);

    // The backend exposes CSV and JSON snapshots; other formats are rendered
    // client-side from the server payload so the two exports stay comparable.
    if (options.format === "csv" && options.scope === "all") {
      const blob = await apiFetch<Blob>("/export/inventory/csv", {
        responseType: "blob",
      });

      download(blob, `inventory-server-${stamp}.csv`);

      return;
    }

    const products = applyScope(
      await apiFetch<Product[]>("/export/inventory/json"),
      options,
    );

    const title = "خروجی داده های سرور";

    const file = buildFile(products, options, title, await primaryBarcodeMap());

    if (options.format === "pdf") {
      printAsPdf(file.blob);
    } else {
      download(file.blob, `inventory-server-${stamp}.${file.extension}`);
    }
  },
};

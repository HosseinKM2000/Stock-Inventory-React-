import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import type { Product } from "@/features/app/inventory/types";
import { apiFetch } from "@/shared/api/client";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";

export type ExportFormat = "xlsx" | "csv" | "pdf";

export type ExportScope = "all" | "low_stock" | "category";

export type ExportOptions = {
  format: ExportFormat;

  scope: ExportScope;

  categoryId?: number | null;
};

const COLUMNS: { key: string; label: string; value(product: Product): string }[] =
  [
    { key: "id", label: "شناسه", value: (p) => String(p.id) },
    {
      key: "name",
      label: "نام",
      value: (p) => p.custom_label ?? p.catalog_product?.name ?? "",
    },
    { key: "quantity", label: "تعداد", value: (p) => String(p.quantity) },
    { key: "price", label: "قیمت", value: (p) => String(p.price) },
    { key: "status", label: "وضعیت", value: (p) => p.status },
    { key: "note", label: "یادداشت", value: (p) => p.note ?? "" },
    { key: "updated_at", label: "بروزرسانی", value: (p) => p.updated_at },
  ];

function escapeCsv(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(products: Product[]) {
  const header = COLUMNS.map((column) => column.label).join(",");

  const rows = products.map((product) =>
    COLUMNS.map((column) => escapeCsv(column.value(product))).join(","),
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

function toHtmlTable(products: Product[], title: string) {
  const header = COLUMNS.map((column) => `<th>${column.label}</th>`).join("");

  const rows = products
    .map(
      (product) =>
        `<tr>${COLUMNS.map(
          (column) => `<td>${escapeHtml(column.value(product))}</td>`,
        ).join("")}</tr>`,
    )
    .join("");

  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8" />
<title>${title}</title>
<style>
body{font-family:sans-serif;padding:16px}
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

function applyScope(products: Product[], options: ExportOptions) {
  if (options.scope === "low_stock") {
    return products.filter(
      (product) =>
        product.status === "low_stock" || product.status === "out_of_stock",
    );
  }

  if (options.scope === "category" && options.categoryId != null) {
    return products.filter(
      (product) => product.catalog_product?.industry_id === options.categoryId,
    );
  }

  return products;
}

function buildFile(products: Product[], options: ExportOptions, title: string) {
  switch (options.format) {
    case "csv":
      return {
        blob: new Blob([toCsv(products)], {
          type: "text/csv;charset=utf-8",
        }),
        extension: "csv",
      };

    case "xlsx":
      // Excel opens an HTML table natively; avoids adding a spreadsheet dependency.
      return {
        blob: new Blob([toHtmlTable(products, title)], {
          type: "application/vnd.ms-excel;charset=utf-8",
        }),
        extension: "xls",
      };

    case "pdf":
      return {
        blob: new Blob([toHtmlTable(products, title)], {
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
    const products = applyScope(await inventoryService.getAll(), options);

    const title = "خروجی داده های محلی";

    const file = buildFile(products, options, title);

    const stamp = new Date().toISOString().slice(0, 10);

    download(file.blob, `inventory-local-${stamp}.${file.extension}`);

    if (options.format === "pdf") {
      // Let the user print-to-PDF without pulling in a PDF renderer.
      window.open(URL.createObjectURL(file.blob), "_blank")?.focus();
    }

    return products.length;
  },

  /** Exports the server dataset, which may differ while changes are pending. */
  async exportServer(options: ExportOptions) {
    if (networkService.isOffline()) {
      throw new ServerExportUnavailableError();
    }

    const stamp = new Date().toISOString().slice(0, 10);

    // The backend exposes CSV and JSON snapshots; other formats are rendered
    // client-side from the server payload so the two exports stay comparable.
    if (options.format === "csv") {
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

    const file = buildFile(products, options, title);

    download(file.blob, `inventory-server-${stamp}.${file.extension}`);
  },
};

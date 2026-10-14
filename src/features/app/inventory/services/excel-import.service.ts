import type { Product } from "../types";
import { createProductInitialValues } from "../form/product-form.initial";
import { inventoryService } from "./inventory-service";
import { accessState } from "@/shared/access/access-state";

export const IMPORT_HEADERS = ["نام محصول", "تعداد", "قیمت", "توضیحات", "یادداشت"] as const;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;
const CHUNK_SIZE = 50;

export type ImportRow = {
  row: number; name: string; quantity: number; price: number;
  description: string; note: string; errors: string[];
};

function normalizeDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function integer(value: unknown, field: string, errors: string[]) {
  if (value == null || value === "") return 0;
  const number = Number(normalizeDigits(String(value)).replace(/[,٬]/g, ""));
  if (!Number.isSafeInteger(number) || number < 0) errors.push(`${field} باید عدد صحیح و نامنفی باشد`);
  return number;
}

function textValue(cell: { value: unknown; hyperlinkId?: number } | undefined, errors: string[]) {
  if (!cell) return "";
  if (cell.hyperlinkId || (typeof cell.value === "object" && cell.value !== null)) {
    errors.push("فرمول، پیوند و مقدار پیچیده مجاز نیست"); return "";
  }
  return String(cell.value ?? "").trim();
}

export async function parseProductWorkbook(file: File): Promise<ImportRow[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("فقط فایل xlsx پذیرفته می‌شود");
  if (file.size > IMPORT_MAX_BYTES) throw new Error("حجم فایل نباید بیشتر از ۵ مگابایت باشد");
  const [{ fromBlob, loadWorkbook }, { getSheetByIndex }, { getCell, getMaxRow }] = await Promise.all([
    import("@office-kit/xlsx/io"), import("@office-kit/xlsx/workbook"), import("@office-kit/xlsx/worksheet"),
  ]);
  const workbook = await loadWorkbook(fromBlob(file));
  const sheet = getSheetByIndex(workbook, 0);
  if (!sheet) throw new Error("فایل باید حداقل یک برگه داشته باشد");
  const headers = IMPORT_HEADERS.map((_, index) => textValue(getCell(sheet, 1, index + 1), []));
  if (headers.some((header, index) => header !== IMPORT_HEADERS[index])) {
    throw new Error("ستون‌های فایل با الگوی ورود محصول مطابقت ندارند");
  }
  const maxRow = getMaxRow(sheet);
  if (maxRow - 1 > IMPORT_MAX_ROWS) throw new Error(`حداکثر ${IMPORT_MAX_ROWS} ردیف قابل ورود است`);
  const rows: ImportRow[] = [];
  for (let row = 2; row <= maxRow; row++) {
    const errors: string[] = [];
    const values = IMPORT_HEADERS.map((_, col) => textValue(getCell(sheet, row, col + 1), errors));
    if (values.every((value) => !value)) continue;
    const name = values[0].normalize("NFC").trim();
    if (!name) errors.push("نام محصول الزامی است");
    if (name.length > 200) errors.push("نام محصول بیش از ۲۰۰ نویسه است");
    rows.push({ row, name, quantity: integer(values[1], "تعداد", errors), price: integer(values[2], "قیمت", errors), description: values[3], note: values[4], errors });
  }
  return rows;
}

export async function downloadImportTemplate() {
  const [{ workbookToBytes }, { createWorkbook, addWorksheet }, { setCell, setColumnWidth, setFreezePanes }] = await Promise.all([
    import("@office-kit/xlsx/io"), import("@office-kit/xlsx/workbook"), import("@office-kit/xlsx/worksheet"),
  ]);
  const workbook = createWorkbook();
  const sheet = addWorksheet(workbook, "محصولات");
  IMPORT_HEADERS.forEach((header, index) => { setCell(sheet, 1, index + 1, header); setColumnWidth(sheet, index + 1, index === 0 ? 28 : 18); });
  setCell(sheet, 2, 1, "نمونه محصول"); setCell(sheet, 2, 2, 10); setCell(sheet, 2, 3, 250000);
  setFreezePanes(sheet, { rows: 1, cols: 0 });
  const bytes = await workbookToBytes(workbook);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a"); link.href = url; link.download = "tanzim-products-template.xlsx"; link.click();
  URL.revokeObjectURL(url);
}

function toProduct(row: ImportRow): Product {
  const product = createProductInitialValues();
  return {
    ...product, custom_label: row.name, quantity: row.quantity, price: row.price,
    note: row.note || null,
    catalog_product: { ...product.catalog_product, name: row.name, description: row.description || null },
  };
}

export async function importProductRows(rows: ImportRow[], onProgress?: (done: number) => void) {
  accessState.requireTool("import");
  let done = 0;
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE).map(toProduct);
    await inventoryService.createMany(chunk);
    done += chunk.length; onProgress?.(done);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  return done;
}

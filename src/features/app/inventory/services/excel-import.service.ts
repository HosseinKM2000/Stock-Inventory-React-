import { barcodeLookupCandidates, inferSymbology, validateBarcode } from "@/features/barcode/domain/barcode";
import { barcodeRepository } from "@/features/barcode/services/barcode-repository";
import { barcodeService } from "@/features/barcode/services/barcode-service";
import { accessState } from "@/shared/access/access-state";
import type { Product } from "../types";
import { createProductInitialValues } from "../form/product-form.initial";
import { inventoryService } from "./inventory-service";

export const IMPORT_HEADERS = ["نام محصول", "تعداد", "قیمت فروش", "قیمت خرید", "توضیحات", "یادداشت", "بارکد اصلی"] as const;
const LEGACY_PRICE_HEADER = "قیمت";
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;
const CHUNK_SIZE = 50;

export type ImportRow = { row: number; name: string; quantity: number; price: number; salePrice: number | null; purchasePrice: number | null; description: string; note: string; barcode: string; errors: string[] };

function normalizeDigits(value: string) {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function integer(value: unknown, field: string, errors: string[]) {
  if (value == null || value === "") return 0;
  const number = Number(normalizeDigits(String(value)).replace(/[,٬]/g, ""));
  if (!Number.isSafeInteger(number) || number < 0) errors.push(`${field} باید عدد صحیح و نامنفی باشد`);
  return number;
}

function optionalInteger(value: unknown, field: string, errors: string[]) {
  if (value == null || value === "") return null;
  return integer(value, field, errors);
}

function textValue(cell: { value: unknown; hyperlinkId?: number } | undefined, errors: string[]) {
  if (!cell) return "";
  if (cell.hyperlinkId || (typeof cell.value === "object" && cell.value !== null)) {
    errors.push("فرمول، پیوند و مقدار پیچیده مجاز نیست");
    return "";
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
  const headers = Array.from({ length: 8 }, (_, index) => textValue(getCell(sheet, 1, index + 1), [])).filter(Boolean);
  const positions = new Map(headers.map((header, index) => [header, index]));
  if (positions.has(LEGACY_PRICE_HEADER) && positions.has(IMPORT_HEADERS[2])) throw new Error("ستون قیمت و قیمت فروش هم‌زمان مجاز نیستند");
  const saleHeader = positions.has(IMPORT_HEADERS[2]) ? IMPORT_HEADERS[2] : positions.has(LEGACY_PRICE_HEADER) ? LEGACY_PRICE_HEADER : null;
  if (!positions.has(IMPORT_HEADERS[0]) || !positions.has(IMPORT_HEADERS[1])) throw new Error("ستون‌های نام محصول و تعداد الزامی هستند");
  const allowed = new Set<string>([...IMPORT_HEADERS, LEGACY_PRICE_HEADER]);
  if (headers.some((header) => !allowed.has(header)) || new Set(headers).size !== headers.length) throw new Error("ستون‌های فایل تکراری یا ناشناخته هستند");
  const maxRow = getMaxRow(sheet);
  if (maxRow - 1 > IMPORT_MAX_ROWS) throw new Error(`حداکثر ${IMPORT_MAX_ROWS} ردیف قابل ورود است`);
  const rows: ImportRow[] = [];
  for (let row = 2; row <= maxRow; row += 1) {
    const errors: string[] = [];
    const values = headers.map((_, col) => textValue(getCell(sheet, row, col + 1), errors));
    if (values.every((value) => !value)) continue;
    const value = (header: string) => values[positions.get(header) ?? -1] ?? "";
    const name = value(IMPORT_HEADERS[0]).normalize("NFC").trim();
    if (!name) errors.push("نام محصول الزامی است");
    if (name.length > 200) errors.push("نام محصول بیش از ۲۰۰ نویسه است");
    const barcode = value(IMPORT_HEADERS[6]);
    if (barcode) {
      const validation = validateBarcode(barcode, inferSymbology(barcode));
      if (!validation.valid) errors.push(validation.error ?? "بارکد نامعتبر است");
    }
    const salePrice = optionalInteger(saleHeader ? value(saleHeader) : "", "قیمت فروش", errors);
    const purchasePrice = optionalInteger(value(IMPORT_HEADERS[3]), "قیمت خرید", errors);
    rows.push({ row, name, quantity: integer(value(IMPORT_HEADERS[1]), "تعداد", errors), price: salePrice ?? 0, salePrice, purchasePrice, description: value(IMPORT_HEADERS[4]), note: value(IMPORT_HEADERS[5]), barcode, errors });
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
  setCell(sheet, 2, 1, "نمونه محصول"); setCell(sheet, 2, 2, 10); setCell(sheet, 2, 3, 250000); setCell(sheet, 2, 4, 180000); setCell(sheet, 2, 7, "0012345678905");
  setFreezePanes(sheet, { rows: 1, cols: 0 });
  const bytes = await workbookToBytes(workbook);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a"); link.href = url; link.download = "tanzim-products-template.xlsx"; link.click();
  URL.revokeObjectURL(url);
}

function toProduct(row: ImportRow): Product {
  const product = createProductInitialValues();
  return { ...product, custom_label: row.name, quantity: row.quantity, price: row.price, sale_price: row.salePrice, purchase_price: row.purchasePrice, price_missing: row.salePrice == null, note: row.note || null, catalog_product: { ...product.catalog_product, name: row.name, description: row.description || null } };
}

async function validateBarcodeBatch(rows: ImportRow[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.barcode) continue;
    accessState.requireCapability("barcode.manage");
    accessState.requireStorePermission("barcodes.manage");
    const candidates = barcodeLookupCandidates(row.barcode, inferSymbology(row.barcode));
    if (candidates.some((candidate) => seen.has(candidate))) throw new Error(`بارکد تکراری در ردیف ${row.row.toLocaleString("fa-IR")}`);
    const existing = (await Promise.all(candidates.map((candidate) => barcodeRepository.findByValue(candidate)))).flat().some((item) => item.is_active);
    if (existing) throw new Error(`بارکد ردیف ${row.row.toLocaleString("fa-IR")} قبلاً ثبت شده است`);
    candidates.forEach((candidate) => seen.add(candidate));
  }
}

export async function importProductRows(rows: ImportRow[], onProgress?: (done: number) => void) {
  accessState.requireTool("import");
  await validateBarcodeBatch(rows);
  let done = 0;
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const sourceRows = rows.slice(offset, offset + CHUNK_SIZE);
    const created = await inventoryService.createMany(sourceRows.map(toProduct));
    for (let index = 0; index < created.length; index += 1) {
      const barcode = sourceRows[index].barcode;
      if (barcode) await barcodeService.create({ productId: created[index].id, value: barcode, source: "manufacturer", meaning: "unit", scanQuantity: 1, isDefault: true });
    }
    done += created.length; onProgress?.(done);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  return done;
}

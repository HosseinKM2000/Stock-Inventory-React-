import { describe, expect, it } from "vitest";
import { workbookToBytes } from "@office-kit/xlsx/io";
import { addWorksheet, createWorkbook } from "@office-kit/xlsx/workbook";
import { setCell } from "@office-kit/xlsx/worksheet";
import { makeFormula } from "@office-kit/xlsx/cell";
import { IMPORT_HEADERS, parseProductWorkbook } from "@/features/app/inventory/services/excel-import.service";

async function workbookFile(row: unknown[]) {
  const workbook = createWorkbook();
  const sheet = addWorksheet(workbook, "محصولات");
  IMPORT_HEADERS.forEach((header, index) => setCell(sheet, 1, index + 1, header));
  row.forEach((value, index) => setCell(sheet, 2, index + 1, value as never));
  const bytes = await workbookToBytes(workbook);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([data], "products.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

async function workbookWithHeaders(headers: string[], row: unknown[]) {
  const workbook = createWorkbook();
  const sheet = addWorksheet(workbook, "محصولات");
  headers.forEach((header, index) => setCell(sheet, 1, index + 1, header));
  row.forEach((value, index) => setCell(sheet, 2, index + 1, value as never));
  const bytes = await workbookToBytes(workbook);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new File([data], "products.xlsx");
}

describe("Excel product import", () => {
  it("normalizes Persian digits and validates a normal row locally", async () => {
    const rows = await parseProductWorkbook(await workbookFile(["محصول تست", "۱۲", "۲۵۰٬۰۰۰", "", "شرح", "یادداشت"]));
    expect(rows).toEqual([expect.objectContaining({ name: "محصول تست", quantity: 12, price: 250_000, errors: [] })]);
  });

  it("keeps empty prices unknown and accepts explicit zero", async () => {
    const [unknown] = await parseProductWorkbook(await workbookFile(["بدون قیمت", 1, "", ""]));
    const [free] = await parseProductWorkbook(await workbookFile(["رایگان", 1, 0, 0]));
    expect(unknown).toMatchObject({ salePrice: null, purchasePrice: null });
    expect(free).toMatchObject({ salePrice: 0, purchasePrice: 0, errors: [] });
  });

  it("maps the legacy price column to sale price and accepts omitted price columns", async () => {
    const [legacy] = await parseProductWorkbook(await workbookWithHeaders(["نام محصول", "تعداد", "قیمت"], ["قدیمی", 2, 90]));
    const [unknown] = await parseProductWorkbook(await workbookWithHeaders(["نام محصول", "تعداد"], ["نامشخص", 1]));
    expect(legacy).toMatchObject({ salePrice: 90, purchasePrice: null });
    expect(unknown).toMatchObject({ salePrice: null, purchasePrice: null });
  });

  it("rejects conflicting legacy and canonical sale columns", async () => {
    await expect(parseProductWorkbook(await workbookWithHeaders(["نام محصول", "تعداد", "قیمت", "قیمت فروش"], ["تکراری", 1, 10, 11]))).rejects.toThrow("هم‌زمان");
  });

  it("rejects formulas instead of evaluating imported workbook content", async () => {
    const rows = await parseProductWorkbook(await workbookFile(["محصول", makeFormula("1+1", { cachedValue: 2 })]));
    expect(rows[0].errors).toContain("فرمول، پیوند و مقدار پیچیده مجاز نیست");
  });

  it("parses the supported 1,000-row ceiling within the performance budget", async () => {
    const workbook = createWorkbook();
    const sheet = addWorksheet(workbook, "محصولات");
    IMPORT_HEADERS.forEach((header, index) => setCell(sheet, 1, index + 1, header));
    for (let row = 2; row <= 1001; row++) {
      setCell(sheet, row, 1, `محصول ${row - 1}`);
      setCell(sheet, row, 2, row);
      setCell(sheet, row, 3, row * 1000);
    }
    const bytes = await workbookToBytes(workbook);
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const file = new File([data], "products.xlsx");
    const started = performance.now();
    const rows = await parseProductWorkbook(file);
    expect(rows).toHaveLength(1000);
    expect(performance.now() - started).toBeLessThan(5_000);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import { accessState, type Entitlement } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { inventoryStorage } from "@/shared/lib/infrastructure/storage/inventory-storage";
import { lookupInvoiceBarcode } from "@/features/invoices/invoice-barcode-selection";
import { buildInvoiceDocument } from "@/features/invoices/invoice-document";
import { product } from "../helpers/product";
import type { Invoice } from "@/features/invoices/types";

const user: User = {
  id: 607, first_name: "Invoice", last_name: "Owner", username: "invoice-output", email: null, phone: "09120000607",
  industry_id: 1, plan: "free", is_active: true, is_admin: false, is_store_owner: true, role: "USER", is_system_admin: false,
  store_id: 707, membership_id: 807, store_operating_mode: "solo", store_policy_version: 1,
  subscription_started_at: null, subscription_expires_at: null, created_at: "2026-01-01T00:00:00Z",
};
const policy: Entitlement = {
  user_id: 607, store_id: 707, plan: "free", label: "Synthetic", status: "active", account_status: "active",
  started_at: null, expires_at: null, server_time: "2026-11-05T08:00:00Z", synced_at: "2026-11-05T08:00:00Z",
  capabilities: { "inventory.read": true, "inventory.write": true, "barcode.lookup": true, "invoices.purchase": true, "invoices.sale": true }, limits: {},
};

function invoice(status: Invoice["status"] = "accepted"): Invoice {
  return { local_key: "607:707:1", local_user_id: 607, local_store_id: 707, id: 1, invoice_type: "sale", title: "عنوان ذخیره‌شده", counterparty: "مشتری",
    status, total_amount: 1200, actor_user_id: 607, actor_membership_id: 807, post_operation_id: "stable-reference", posted_at: "2026-11-05T08:00:00Z",
    lines: [{ product_id: 91, product_name: "نام ذخیره‌شده", quantity: 2, unit: "عدد", pack_size: null, base_quantity: 2, unit_price: 600, line_total: 1200, before_quantity: 5, after_quantity: 3 }] };
}

describe("invoice barcode selection and immutable output", () => {
  beforeEach(async () => {
    vi.restoreAllMocks(); accessState.clear(); accessState.saveUser(user); accessState.saveEntitlement(policy); accessState.useOfflineSnapshot();
    await db.open(); await Promise.all([db.inventoryItems.clear(), db.barcodes.clear(), db.invoices.clear(), db.syncQueue.clear(), db.inventoryMovements.clear()]);
    await inventoryStorage.save(product({ id: 91, custom_label: "نام جاری", sale_price: 900, purchase_price: 500 }));
  });

  it("finds one authorized barcode without creating stock, movement, invoice, or outbox effects", async () => {
    await db.barcodes.put({ local_key: "607:707:1", local_user_id: 607, local_store_id: 707, store_id: 707, id: 1, product_id: 91, value: "626123", source: "manufacturer", symbology: "unknown", meaning: "package", scan_quantity: 12, is_active: true, is_default: true, created_at: "2026-01-01", updated_at: "2026-01-01" });
    const products = await inventoryStorage.getAll();
    await expect(lookupInvoiceBarcode("626123", products)).resolves.toMatchObject({ kind: "unique", product: { id: 91 } });
    expect(await db.inventoryMovements.count()).toBe(0); expect(await db.invoices.count()).toBe(0); expect(await db.syncQueue.count()).toBe(0);
    expect(await inventoryStorage.get(91)).toMatchObject({ sale_price: 900, purchase_price: 500 });
  });

  it("fails closed for unknown, ambiguous, and a late result after account change", async () => {
    const products = await inventoryStorage.getAll();
    await expect(lookupInvoiceBarcode("missing", products)).resolves.toEqual({ kind: "unknown" });
    await db.barcodes.bulkPut([1, 2].map((id) => ({ local_key: `607:707:${id}`, local_user_id: 607, local_store_id: 707, store_id: 707, id, product_id: 90 + id, value: "same", source: "manufacturer" as const, symbology: "unknown" as const, meaning: "unit" as const, scan_quantity: 1, is_active: true, is_default: true, created_at: "2026-01-01", updated_at: "2026-01-01" })));
    await expect(lookupInvoiceBarcode("same", products)).resolves.toEqual({ kind: "ambiguous" });
    const get = vi.spyOn(db.barcodes, "where");
    const pending = lookupInvoiceBarcode("same", products); accessState.saveUser({ ...user, id: 608, store_id: 708 });
    await expect(pending).rejects.toThrow("SYNC_ACCOUNT_CHANGED"); get.mockRestore();
  });

  it("builds only from immutable snapshots, labels Solo pending, and refuses unknown or cross-account output", () => {
    const source = invoice(); const document = buildInvoiceDocument(source);
    expect(document).toMatchObject({ title: "عنوان ذخیره‌شده", total: 1200, lines: [{ product: "نام ذخیره‌شده", unitPrice: 600 }] });
    expect(buildInvoiceDocument(invoice("pending")).localOnly).toBe(true);
    expect(() => buildInvoiceDocument(invoice("conflict"))).toThrow("سند نهایی");
    expect(() => buildInvoiceDocument({ ...source, local_store_id: 999 })).toThrow("INVOICE_SCOPE_MISMATCH");
  });
});

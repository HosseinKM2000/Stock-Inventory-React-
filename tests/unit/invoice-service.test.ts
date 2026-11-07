import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import { product } from "../helpers/product";
import { accessState, type Entitlement } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { inventoryStorage } from "@/shared/lib/infrastructure/storage/inventory-storage";
import { invoiceService } from "@/features/invoices/invoice-service";
import { invoiceRepository } from "@/features/invoices/invoice-repository";
import { teamCommandService } from "@/shared/lib/infrastructure/sync/team-command.service";

const baseUser: User = {
  id: 606, first_name: "Invoice", last_name: "Owner", username: "invoice-owner",
  email: null, phone: "09120000606", industry_id: 1, plan: "free", is_active: true,
  is_admin: false, is_store_owner: true, role: "USER", is_system_admin: false,
  store_id: 706, membership_id: 806, store_operating_mode: "solo", store_policy_version: 1,
  subscription_started_at: null, subscription_expires_at: null, created_at: "2026-01-01T00:00:00Z",
};

function entitlement(user: User): Entitlement {
  return {
    user_id: user.id, store_id: user.store_id, plan: "free", label: "Synthetic invoice policy",
    status: "active", account_status: "active", started_at: null, expires_at: null,
    server_time: "2026-11-04T08:00:00Z", synced_at: "2026-11-04T08:00:00Z",
    capabilities: { "inventory.read": true, "inventory.write": true, "invoices.purchase": true, "invoices.sale": true },
    limits: { inventory_items: null },
  };
}

async function authenticate(user = baseUser) {
  accessState.saveUser(user);
  accessState.saveEntitlement(entitlement(user));
  accessState.useOfflineSnapshot();
  await inventoryStorage.save(product({ id: 91, quantity: 5, sale_price: 900, purchase_price: 600, custom_label: "کالای فاکتور" }));
}

describe("atomic local invoices", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    accessState.clear();
    await db.open();
    await Promise.all([db.inventoryItems.clear(), db.invoices.clear(), db.syncQueue.clear()]);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  });

  it("consolidates duplicate rows and commits invoice, stock and one immutable command together", async () => {
    await authenticate();
    const invoice = await invoiceService.post({ invoice_type: "sale", title: "فروش نقدی", lines: [
      { product_id: 91, quantity: 1, unit: "unit", pack_size: null, unit_price: 0 },
      { product_id: 91, quantity: 2, unit: "unit", pack_size: null, unit_price: 0 },
    ] });
    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0]).toMatchObject({ quantity: 3, before_quantity: 5, after_quantity: 2, unit_price: 0 });
    expect(await inventoryStorage.get(91)).toMatchObject({ quantity: 2, sale_price: 900, purchase_price: 600 });
    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ entity: "invoice", action: "CREATE", operationId: invoice.post_operation_id, attemptState: "never" });
  });

  it("rejects missing prices and insufficient sales without partial local effects", async () => {
    await authenticate();
    await expect(invoiceService.post({ invoice_type: "sale", title: "بدون قیمت", lines: [
      { product_id: 91, quantity: 1, unit: "unit", pack_size: null, unit_price: Number.NaN },
    ] })).rejects.toThrow("قیمت معامله");
    await expect(invoiceService.post({ invoice_type: "sale", title: "بیش از موجودی", lines: [
      { product_id: 91, quantity: 6, unit: "unit", pack_size: null, unit_price: 100 },
    ] })).rejects.toThrow("موجودی");
    expect(await invoiceRepository.getAll()).toEqual([]);
    expect(await db.syncQueue.count()).toBe(0);
    expect(await inventoryStorage.get(91)).toMatchObject({ quantity: 5 });
  });

  it("converts packaged quantities to base stock while totaling the entered pack price", async () => {
    await authenticate();
    const stored = await inventoryStorage.get(91);
    await inventoryStorage.save({ ...stored!, quantity: 15, catalog_product: {
      ...stored!.catalog_product!, is_packaged: true, pack_size: 6,
    } });
    const invoice = await invoiceService.post({ invoice_type: "sale", title: "فروش بسته", lines: [
      { product_id: 91, quantity: 2, unit: "pack", pack_size: 6, unit_price: 500 },
    ] });
    expect(invoice).toMatchObject({ total_amount: 1000, lines: [{ quantity: 2, base_quantity: 12, after_quantity: 3 }] });
    expect(await inventoryStorage.get(91)).toMatchObject({ quantity: 3, sale_price: 900, purchase_price: 600 });
  });

  it("compensates a purchase once and keeps the posted snapshots immutable", async () => {
    await authenticate();
    const invoice = await invoiceService.post({ invoice_type: "purchase", title: "خرید", lines: [
      { product_id: 91, quantity: 2, unit: "unit", pack_size: null, unit_price: 500 },
    ] });
    await invoiceService.cancel(invoice.id);
    expect(await inventoryStorage.get(91)).toMatchObject({ quantity: 5 });
    expect(await invoiceRepository.get(invoice.id)).toMatchObject({ status: "cancelled", lines: [{ product_name: "کالای فاکتور", before_quantity: 5, after_quantity: 7 }] });
    await expect(invoiceService.cancel(invoice.id)).rejects.toThrow("قبلاً لغو");
    expect(await db.syncQueue.count()).toBe(2);
  });

  it("does not create a Team draft or command while offline", async () => {
    const team = { ...baseUser, store_operating_mode: "team" as const };
    await authenticate(team);
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: vi.fn(async (_name: string, callback: () => unknown) => callback()),
    } });
    window.dispatchEvent(new Event("offline"));
    await expect(invoiceService.post({ invoice_type: "sale", title: "تیم آفلاین", lines: [
      { product_id: 91, quantity: 1, unit: "unit", pack_size: null, unit_price: 100 },
    ] })).rejects.toThrow("TEAM_ONLINE_REQUIRED");
    expect(await invoiceRepository.getAll()).toEqual([]);
    expect(await db.syncQueue.count()).toBe(0);
    expect(await inventoryStorage.get(91)).toMatchObject({ quantity: 5 });
  });

  it("persists one Team command before dispatch without an optimistic invoice or stock projection", async () => {
    const team = { ...baseUser, store_operating_mode: "team" as const };
    await authenticate(team);
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: vi.fn(async (_name: string, callback: () => unknown) => callback()),
    } });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    const dispatch = vi.spyOn(teamCommandService, "submit").mockResolvedValue("00000000-0000-4000-8000-000000000001");

    await invoiceService.post({ invoice_type: "sale", title: "تیم آنلاین", lines: [
      { product_id: 91, quantity: 1, unit: "unit", pack_size: null, unit_price: 100 },
    ] });

    expect(dispatch).toHaveBeenCalledOnce();
    expect(await invoiceRepository.getAll()).toEqual([]);
    expect(await inventoryStorage.get(91)).toMatchObject({ quantity: 5 });
    expect(await db.syncQueue.toArray()).toEqual([
      expect.objectContaining({ entity: "invoice", action: "CREATE", executionMode: "team", attemptState: "never" }),
    ]);
  });
});

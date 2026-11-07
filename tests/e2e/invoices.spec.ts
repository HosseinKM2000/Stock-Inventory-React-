import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-11-04T08:00:00.000Z";
const owner = {
  id: 8601, first_name: "مالک", last_name: "آزمایشی", username: "invoice-owner",
  email: null, phone: "09120008601", industry_id: 1, plan: "free", is_active: true,
  is_admin: false, role: "USER", is_system_admin: false, is_store_owner: true,
  store_id: 9601, membership_id: 10601, store_operating_mode: "solo", store_policy_version: 1,
  subscription_started_at: null, subscription_expires_at: null, created_at: now,
};

async function json(route: Route, body: unknown, status = 200) { await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); }

async function seed(page: Page) {
  await page.addInitScript(({ user, captured }) => {
    localStorage.setItem("access_token", JSON.stringify("invoice-layout-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}:${user.store_id}`, JSON.stringify({
      user_id: user.id, store_id: user.store_id, plan: "free", label: "Synthetic invoices",
      status: "active", account_status: "active", started_at: null, expires_at: null,
      server_time: captured, synced_at: captured, verified_at: captured,
      captured_at_ms: Date.now(), last_observed_at_ms: Date.now(),
      capabilities: { "inventory.read": true, "inventory.write": true, "invoices.purchase": true, "invoices.sale": true },
      limits: { inventory_items: null },
    }));
  }, { user: owner, captured: now });
  await page.route("http://localhost:8000/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return json(route, owner);
    if (path === "/api/plans/current") return json(route, {
      user_id: owner.id, store_id: owner.store_id, plan: "free", label: "Synthetic invoices",
      status: "active", account_status: "active", started_at: null, expires_at: null,
      server_time: now, synced_at: now,
      capabilities: { "inventory.read": true, "inventory.write": true, "invoices.purchase": true, "invoices.sale": true }, limits: { inventory_items: null },
    });
    if (path === "/api/sync/changes") return json(route, { cursor: 0, changes: [] });
    if (path === "/api/sync/barcodes") return json(route, { items: [] });
    if (path === "/api/sync/batch") {
      const data = await route.request().postDataBuffer();
      const body = data?.toString() ?? "";
      const operationId = /"operation_id":"([^"]+)/.exec(body)?.[1] ?? "mock-operation";
      return json(route, { results: [{ operation_id: operationId, status: "applied", entity_id: 1, record: null, error: null }], cursor: 0 });
    }
    return route.abort();
  });
  await page.goto("/tools/invoices");
  await page.evaluate(async ({ user, captured }) => {
    const request = indexedDB.open("inventory-db");
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(["inventoryItems", "syncMetadata"], "readwrite");
      transaction.objectStore("inventoryItems").put({
        local_key: `${user.id}:${user.store_id}:501`, local_user_id: user.id, local_store_id: user.store_id,
        id: 501, catalog_product_id: 701, is_catalog_backed: false, category_id: null, label_ids: [], version: 1,
        quantity: 5, price: 900, sale_price: 900, purchase_price: 600, price_missing: false,
        custom_label: "کالای تست", note: null, low_stock_threshold: 1, low_stock_alert: true,
        is_hidden: false, image_url: null, deleted_at: null, status: "in_stock", created_at: captured, updated_at: captured,
        catalog_product: { id: 701, industry_id: 1, name: "کالای تست", description: null, brand: null, image_url: null, is_packaged: false, pack_size: null, created_at: captured },
      });
      transaction.objectStore("syncMetadata").put({
        key: `${user.id}:${user.store_id}:product-sync-initialized`, value: 1, updatedAt: Date.now(),
      });
      transaction.objectStore("syncMetadata").put({
        key: `${user.id}:${user.store_id}:product-sync-cursor`, value: 0, updatedAt: Date.now(),
      });
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { user: owner, captured: now });
  await page.reload();
}

test("invoice form posts one atomic command and remains responsive", async ({ page }) => {
  await seed(page);
  await expect(page.getByRole("heading", { name: "فاکتورها", level: 1 })).toBeVisible();
  await page.getByLabel("عنوان فاکتور").fill("فروش آزمایشی");
  await page.getByLabel("طرف حساب").fill("مشتری مصنوعی");
  await page.getByLabel("محصول ردیف 1").selectOption("501");
  await page.getByLabel("تعداد ردیف 1").fill("2");
  await expect(page.getByLabel("قیمت ردیف 1")).toHaveValue("900");
  await page.getByRole("button", { name: "بررسی و ثبت قطعی" }).click();
  await expect(page.getByText("فروش آزمایشی")).toBeVisible();
  await expect(page.getByText(/جمع:.*۱٬۸۰۰.*تومان/)).toBeVisible();
  const state = await page.evaluate(async () => {
    const request = indexedDB.open("inventory-db");
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const read = (store: string) => new Promise<unknown[]>((resolve, reject) => { const tx = database.transaction(store); const value = tx.objectStore(store).getAll(); value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
    const [products, invoices] = await Promise.all([read("inventoryItems"), read("invoices")]); database.close();
    return { products, invoices };
  });
  expect(state.products).toEqual(expect.arrayContaining([expect.objectContaining({ id: 501, quantity: 3, sale_price: 900, purchase_price: 600 })]));
  expect(state.invoices).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

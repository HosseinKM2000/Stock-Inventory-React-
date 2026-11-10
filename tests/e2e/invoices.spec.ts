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

async function seed(page: Page, serverInvoices: unknown[] = [], paid = true) {
  await page.addInitScript(({ user, captured, hasInvoiceAccess }) => {
    localStorage.setItem("access_token", JSON.stringify("invoice-layout-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}:${user.store_id}`, JSON.stringify({
      user_id: user.id, store_id: user.store_id, plan: "free", label: "Synthetic invoices",
      status: "active", account_status: "active", started_at: null, expires_at: null,
      server_time: captured, synced_at: captured, verified_at: captured,
      captured_at_ms: Date.now(), last_observed_at_ms: Date.now(),
      capabilities: { "inventory.read": true, "inventory.write": true, "barcode.lookup": true, "sync": true, "invoices.purchase": hasInvoiceAccess, "invoices.sale": hasInvoiceAccess },
      limits: { inventory_items: null },
    }));
  }, { user: owner, captured: now, hasInvoiceAccess: paid });
  await page.route("http://localhost:8000/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return json(route, owner);
    if (path === "/api/plans/current") return json(route, {
      user_id: owner.id, store_id: owner.store_id, plan: "free", label: "Synthetic invoices",
      status: "active", account_status: "active", started_at: null, expires_at: null,
      server_time: now, synced_at: now,
      capabilities: { "inventory.read": true, "inventory.write": true, "barcode.lookup": true, "sync": true, "invoices.purchase": paid, "invoices.sale": paid }, limits: { inventory_items: null },
    });
    if (path === "/api/sync/changes") return json(route, { cursor: 0, changes: [] });
    if (path === "/api/invoices") return json(route, serverInvoices);
    if (path === "/api/counterparties") return json(route, [{ id: 41, kind: "person", name: "مشتری مصنوعی", phone: "09120000041", address: null, created_at: now, updated_at: now }]);
    if (path === "/api/sync/barcodes") return json(route, { items: [{
      id: 801, store_id: owner.store_id, product_id: 501, value: "6260000501", source: "manufacturer",
      symbology: "unknown", meaning: "unit", scan_quantity: 1, is_active: true, is_default: true,
      created_at: now, updated_at: now,
    }] });
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
      const transaction = database.transaction(["inventoryItems", "barcodes", "syncMetadata"], "readwrite");
      transaction.objectStore("inventoryItems").put({
        local_key: `${user.id}:${user.store_id}:501`, local_user_id: user.id, local_store_id: user.store_id,
        id: 501, catalog_product_id: 701, is_catalog_backed: false, category_id: null, label_ids: [], version: 1,
        quantity: 5, price: 900, sale_price: 900, purchase_price: 600, price_missing: false,
        custom_label: "کالای تست", note: null, low_stock_threshold: 1, low_stock_alert: true,
        is_hidden: false, image_url: null, deleted_at: null, status: "in_stock", created_at: captured, updated_at: captured,
        catalog_product: { id: 701, industry_id: 1, name: "کالای تست", description: null, brand: null, image_url: null, is_packaged: false, pack_size: null, created_at: captured },
      });
      transaction.objectStore("barcodes").put({
        local_key: `${user.id}:${user.store_id}:801`, local_user_id: user.id, local_store_id: user.store_id,
        store_id: user.store_id, id: 801, product_id: 501, value: "6260000501", source: "manufacturer",
        symbology: "unknown", meaning: "unit", scan_quantity: 1, is_active: true, is_default: true,
        created_at: captured, updated_at: captured,
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

test("downgraded Free account keeps historical read-only evidence without paid actions", async ({ page }) => {
  await seed(page, [{
    id: 211, invoice_type: "sale", title: "فاکتور تاریخی", counterparty: null,
    status: "posted", total_amount: 100, actor_user_id: owner.id,
    actor_membership_id: owner.membership_id, post_operation_id: "historical-211",
    posted_at: now, lines: [{ product_id: 501, product_name: "کالای تاریخی", quantity: 1,
      unit: "عدد", pack_size: null, base_quantity: 1, unit_price: 100,
      line_total: 100, before_quantity: 2, after_quantity: 1 }],
  }], false);
  await expect(page.getByRole("heading", { name: "فاکتورهای تاریخی" })).toBeVisible();
  await expect(page.getByText("فاکتور تاریخی")).toBeVisible();
  await expect(page.getByRole("button", { name: "بررسی و ثبت قطعی" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "دریافت PDF" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "لغو کامل فاکتور" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("invoice form posts one atomic command and remains responsive", async ({ page }) => {
  await seed(page);
  await expect(page.getByRole("heading", { name: "فاکتورها", level: 1 })).toBeVisible();
  await page.getByLabel("عنوان فاکتور").fill("فروش آزمایشی");
  await page.getByLabel("طرف حساب").fill("مشتری مصنوعی");
  await page.getByLabel("محصول ردیف 1").selectOption("501");
  await page.getByLabel("تعداد ردیف 1").fill("2");
  await expect(page.getByLabel("قیمت ردیف 1")).toHaveValue("900");
  await page.getByRole("button", { name: "بررسی و ثبت قطعی" }).click();
  await expect(page.getByRole("heading", { name: "تأیید ثبت فاکتور" })).toBeVisible();
  await page.getByRole("button", { name: "تأیید و ثبت" }).click();
  await expect(page.getByRole("heading", { name: "فاکتور با موفقیت ثبت شد" })).toBeVisible();
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

test("hardware scan selects without changing stock and exports a real offline Persian PDF", async ({ page, context }) => {
  await seed(page);
  const before = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("inventory-db"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const count = (store: string) => new Promise<number>((resolve, reject) => { const request = database.transaction(store).objectStore(store).count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const values = await Promise.all([count("inventoryMovements"), count("invoices"), count("syncQueue")]); database.close(); return values;
  });
  await page.getByLabel("کد بارکد").fill("6260000501");
  await page.getByLabel("کد بارکد").press("Enter");
  await expect(page.getByLabel("محصول ردیف 1")).toHaveValue("501");
  await expect(page.getByLabel("قیمت ردیف 1")).toHaveValue("900");
  const afterScan = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open("inventory-db"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const count = (store: string) => new Promise<number>((resolve, reject) => { const request = database.transaction(store).objectStore(store).count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const values = await Promise.all([count("inventoryMovements"), count("invoices"), count("syncQueue")]); database.close(); return values;
  });
  expect(afterScan).toEqual(before);
  await page.getByLabel("عنوان فاکتور").fill("فروش بارکدی");
  await page.getByRole("button", { name: "بررسی و ثبت قطعی" }).click();
  await page.getByRole("button", { name: "تأیید و ثبت" }).click();
  await expect(page.getByRole("heading", { name: "فاکتور با موفقیت ثبت شد" })).toBeVisible();
  await context.setOffline(true);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^invoice-.*\.pdf$/);
  const path = await download.path();
  const bytes = await import("node:fs/promises").then((fs) => fs.readFile(path!));
  expect(bytes.subarray(0, 8).toString()).toBe("%PDF-1.4");
  expect(bytes.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(1);
  await page.getByRole("button", { name: "اشتراک", exact: true }).click();
  await expect(page.getByRole("heading", { name: "فاکتور با موفقیت ثبت شد" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("cancelled purchase snapshot produces a multipage PDF without current product data", async ({ page, context }) => {
  const lines = Array.from({ length: 44 }, (_, index) => ({ id: index + 1, product_id: 9000 + index, product_name: `نام تاریخی بسیار بلند کالای خریداری‌شده ردیف ${index + 1} که دیگر در فهرست جاری وجود ندارد`, quantity: index + 1, unit: "عدد", pack_size: null, base_quantity: index + 1, unit_price: 1234567, line_total: (index + 1) * 1234567, before_quantity: 0, after_quantity: index + 1 }));
  await seed(page, [{ id: 999, invoice_type: "purchase", title: "خرید چندصفحه‌ای باطل‌شده", counterparty: "تأمین‌کننده تاریخی", status: "cancelled", total_amount: lines.reduce((sum, line) => sum + line.line_total, 0), actor_user_id: owner.id, actor_membership_id: owner.membership_id, post_operation_id: "snapshot-reference", cancel_operation_id: "cancel-reference", posted_at: now, cancelled_at: now, lines }]);
  await expect(page.getByText("خرید چندصفحه‌ای باطل‌شده", { exact: true })).toBeVisible(); await context.setOffline(true);
  const card = page.getByText("خرید چندصفحه‌ای باطل‌شده", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rt-Card')]");
  const downloadPromise = page.waitForEvent("download"); await card.getByRole("button", { name: "دریافت PDF" }).click();
  const path = await (await downloadPromise).path(); const bytes = await import("node:fs/promises").then((fs) => fs.readFile(path!));
  expect(bytes.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
});

test("dashboard reports only confirmed invoice snapshots and states coverage", async ({ page }) => {
  await seed(page, [
    { id: 301, invoice_type: "purchase", title: "خرید قطعی", counterparty: null, status: "posted", total_amount: 0, actor_user_id: owner.id, actor_membership_id: owner.membership_id, post_operation_id: "purchase-301", posted_at: now, lines: [] },
    { id: 302, invoice_type: "sale", title: "فروش قطعی", counterparty: null, status: "posted", total_amount: 1250, actor_user_id: owner.id, actor_membership_id: owner.membership_id, post_operation_id: "sale-302", posted_at: now, lines: [] },
    { id: 303, invoice_type: "sale", title: "فروش باطل", counterparty: null, status: "cancelled", total_amount: 9000, actor_user_id: owner.id, actor_membership_id: owner.membership_id, post_operation_id: "sale-303", posted_at: now, cancelled_at: now, lines: [] },
  ]);
  await page.goto("/dashboard/reports");

  await expect(page.getByRole("heading", { name: "گزارش خرید و فروش", level: 1 })).toBeVisible();
  await expect(page.getByText(/پوشش کامل آخرین بار/)).toBeVisible();
  const sevenDays = page.getByRole("heading", { name: "۷ روز اخیر", level: 2 }).locator("xpath=ancestor::section");
  await expect(sevenDays.getByText("۰ تومان", { exact: true })).toBeVisible();
  await expect(sevenDays.getByText("۱٬۲۵۰ تومان", { exact: true })).toBeVisible();
  await expect(sevenDays.getByText("۹٬۰۰۰ تومان", { exact: true })).not.toBeVisible();
  await expect(page.getByText(/وجه وصول‌شده نیست/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  for (const [appearance, size] of [["light", "compact"], ["dark", "large"]] as const) {
    await page.evaluate(({ appearance, size }) => {
      localStorage.setItem("inventory-appearance", appearance);
      localStorage.setItem("inventory-display-size", size);
    }, { appearance, size });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-appearance", appearance);
    await expect(page.locator("html")).toHaveAttribute("data-display-size", size);
    await expect(page.getByRole("heading", { name: "گزارش خرید و فروش", level: 1 })).toBeVisible();
    await page.getByRole("heading", { name: "۳۰ روز اخیر", level: 2 }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

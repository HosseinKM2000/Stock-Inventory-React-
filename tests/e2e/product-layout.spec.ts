import { expect, test, type Page } from "@playwright/test";

async function seedOfflineUser(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    const now = new Date().toISOString();
    const user = {
      id: 7111,
      first_name: "Product",
      last_name: "Layout",
      username: "product-layout",
      email: null,
      phone: null,
      industry_id: 1,
      plan: "pro",
      is_active: true,
      is_admin: false,
      role: "USER",
      is_system_admin: false,
      is_store_owner: false,
      store_permissions: ["products.view", "products.create", "products.edit", "products.quantity.change", "products.sale_price.view", "products.sale_price.change"],
      subscription_started_at: now,
      subscription_expires_at: "2099-01-01T00:00:00.000Z",
      created_at: now,
    };
    localStorage.setItem("access_token", JSON.stringify("product-layout-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}`, JSON.stringify({
      user_id: user.id,
      plan: "pro",
      label: "Pro",
      status: "active",
      account_status: "active",
      started_at: now,
      expires_at: "2099-01-01T00:00:00.000Z",
      server_time: now,
      synced_at: now,
      verified_at: now,
      captured_at_ms: Date.now(),
      last_observed_at_ms: Date.now(),
      capabilities: { "inventory.read": true, "inventory.write": true },
      limits: { inventory_items: null },
    }));
  });
  await page.route("http://localhost:8000/api/**", (route) => route.abort());
}

async function seedProduct(page: Page) {
  await page.goto("/dashboard");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    const transaction = database.transaction("inventoryItems", "readwrite");
    transaction.objectStore("inventoryItems").put({
      local_key: "7111:7111:8101", local_user_id: 7111, local_store_id: 7111,
      id: 8101, catalog_product_id: 8101, is_catalog_backed: false, category_id: null,
      label_ids: [], version: 1, quantity: 6, price: 350000, sale_price: 350000,
      purchase_price: null, price_missing: false, custom_label: "لامپ LED 12W", note: "نور گرم کم‌مصرف",
      low_stock_threshold: 8, low_stock_alert: true, is_hidden: false, image_url: null,
      deleted_at: null, status: "low_stock", created_at: now, updated_at: now,
      catalog_product: { id: 8101, industry_id: 1, is_active: true, name: "لامپ LED 12W", description: "نور گرم کم‌مصرف", brand: "Tanzim Demo", image_url: null, is_packaged: false, pack_size: null, created_at: now },
    });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  });
}

test("product filters use one responsive panel across desktop and mobile", async ({ page }) => {
  await seedOfflineUser(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory/list");

  const panel = page.locator(".inventory-filter-panel");
  const sidebar = page.locator(".inventory-filter-sidebar");
  const results = page.locator(".inventory-list-results");
  await expect(panel).toHaveCount(1);
  expect((await sidebar.boundingBox())!.y).toBeLessThan((await results.boundingBox())!.y);

  const searchBox = (await page.getByRole("textbox", { name: "جستجوی محصول" }).boundingBox())!;
  const controls = panel.locator(".inventory-filter-control, .inventory-catalog-filter");
  const positions = await Promise.all(Array.from({ length: 4 }, async (_, index) => (await controls.nth(index).boundingBox())!));
  expect(searchBox.y).toBeLessThan(positions[0].y);
  const bottoms = positions.map((box) => box.y + box.height);
  expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThan(2);

  const search = page.getByRole("textbox", { name: "جستجوی محصول" });
  await search.fill("چای سبز");
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(panel).toHaveCount(1);
  await expect(search).toHaveValue("چای سبز");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("product form order, mode accent, and fixed-navigation clearance remain visible", async ({ page }) => {
  await seedOfflineUser(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/add");

  const form = page.locator(".product-form");
  await expect(form).toHaveAttribute("data-mode", "create");
  await expect(page.getByText("افزودن محصول", { exact: true })).toBeVisible();
  const createAccent = await form.evaluate((element) => getComputedStyle(element).getPropertyValue("--product-form-accent").trim());
  expect(createAccent).toBe("#6e56cf");

  const ordered = [
    page.getByText("نام محصول", { exact: true }).first(),
    page.getByText("قیمت فروش (تومان)", { exact: true }).first(),
    page.getByText("یادداشت", { exact: true }).first(),
    page.getByText("دسته‌بندی", { exact: true }).first(),
    page.getByText("برچسب‌ها", { exact: true }).first(),
    page.getByText("پیکربندی محصول", { exact: true }).first(),
  ];
  const offsets = await Promise.all(ordered.map((locator) => locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)));
  expect(offsets).toEqual([...offsets].sort((a, b) => a - b));

  const main = page.locator("main[data-scroll-restoration-id='app-shell']");
  await main.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const submitBox = await page.getByRole("button", { name: "افزودن", exact: true }).boundingBox();
  const navigationBox = await page.getByRole("navigation", { name: "ناوبری اصلی" }).boundingBox();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navigationBox!.y);

  const addButton = await page.getByRole("link", { name: "افزودن محصول" }).locator("span").boundingBox();
  expect(addButton!.width).toBeGreaterThanOrEqual(70);
  expect(addButton!.height).toBeGreaterThanOrEqual(70);
});

test("all three product card modes retain core information and fit narrow screens", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/list");
  for (const [label, selector] of [["نمای راحت", ".inventory-card-layout"], ["نمای فشرده", ".inventory-card--compact"], ["شبکه فشرده", ".inventory-card--grid"]] as const) {
    const trigger = page.locator(".inventory-view-mode-select");
    await trigger.click();
    await page.getByRole("option", { name: label }).click();
    await expect(page.locator(selector)).toHaveCount(1);
    await expect(page.getByText("لامپ LED 12W", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  const trigger = page.locator(".inventory-view-mode-select");
  await trigger.click();
  await page.getByRole("option", { name: "شبکه فشرده" }).click();
  const columns = await page.locator(".inventory-compact-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

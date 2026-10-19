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
      store_permissions: ["products.view", "products.create", "products.edit", "products.delete", "products.quantity.change", "products.sale_price.view", "products.sale_price.change"],
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
  const desktopSidebarBox = (await sidebar.boundingBox())!;
  const desktopResultsBox = (await results.boundingBox())!;
  expect(desktopSidebarBox.x).toBeGreaterThan(desktopResultsBox.x);
  await expect(page.getByRole("heading", { name: "جستجو و فیلتر" })).toBeVisible();
  await expect(page.getByRole("button", { name: "فیلترها" })).toBeHidden();
  const searchBox = (await page.getByRole("textbox", { name: "جستجوی محصول" }).boundingBox())!;
  const catalogControl = panel.locator(":scope > .inventory-catalog-filter");
  const catalogBox = (await catalogControl.boundingBox())!;
  const controls = panel.locator(".inventory-filter-control, .inventory-catalog-filter");
  const positions = await Promise.all(Array.from({ length: 4 }, async (_, index) => (await controls.nth(index).boundingBox())!));
  expect(searchBox.y).toBeLessThan(positions[0].y);
  expect(searchBox.y + searchBox.height).toBeLessThanOrEqual(catalogBox.y);
  for (let index = 1; index < positions.length; index += 1) {
    expect(positions[index].y).toBeGreaterThan(positions[index - 1].y);
  }

  const search = page.getByRole("textbox", { name: "جستجوی محصول" });
  await search.fill("چای سبز");
  await page.setViewportSize({ width: 1024, height: 768 });
  expect((await sidebar.boundingBox())!.x).toBeGreaterThan((await results.boundingBox())!.x);
  await page.addStyleTag({
    content: ".inventory-filter-heading{display:flex!important}.inventory-filter-row{display:grid!important}",
  });
  await page.setViewportSize({ width: 375, height: 480 });
  await expect(panel).toHaveCount(1);
  await expect(search).toHaveValue("چای سبز");
  await expect(page.getByRole("heading", { name: "جستجو و فیلتر" })).toBeHidden();
  const filterTrigger = page.getByRole("button", { name: "فیلترها" });
  await expect(filterTrigger).toBeVisible();
  const mobileSearchBox = (await search.boundingBox())!;
  const mobileFilterBox = (await filterTrigger.boundingBox())!;
  await expect(panel.locator(":scope > .inventory-catalog-filter")).toBeHidden();
  expect(mobileSearchBox.y).toBeLessThan(mobileFilterBox.y);
  expect(mobileSearchBox.height).toBeLessThanOrEqual(46);
  expect(mobileFilterBox.height).toBeLessThanOrEqual(44);
  expect((await sidebar.boundingBox())!.y).toBeLessThan((await results.boundingBox())!.y);
  await filterTrigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Vazirmatn");
  await expect(dialog.getByText("دسته‌بندی", { exact: true })).toBeVisible();
  await expect(dialog.getByText("مرتب‌سازی", { exact: true })).toBeVisible();
  await expect(dialog.getByText("برچسب‌ها", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "مخفی کردن محصولات کاتالوگ در پنجره فیلترها" })).toBeVisible();
  const closeDialog = dialog.getByRole("button", { name: "بستن", exact: true });
  await closeDialog.scrollIntoViewIfNeeded();
  await expect(closeDialog).toBeInViewport();
  await closeDialog.click();
  await expect(dialog).toBeHidden();
  await expect(panel.locator(":scope > .inventory-filter-row")).toBeHidden();
  await expect(panel.locator(".inventory-filter-heading")).toBeHidden();
  await expect(filterTrigger).toBeVisible();
  expect(await panel.locator(".inventory-filter-topline").evaluate((element) => getComputedStyle(element).flexWrap)).toBe("nowrap");
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

  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  const comfortableCard = page.locator(".inventory-card");
  const cardBox = (await comfortableCard.boundingBox())!;
  const mediaBox = (await comfortableCard.locator(".inventory-card-media").boundingBox())!;
  const statusBox = (await comfortableCard.locator(".inventory-card-image-status").boundingBox())!;
  const actionBoxes = await comfortableCard.locator(".inventory-card-mobile-actions button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  const quickBoxes = await comfortableCard.locator(".quick-stock-control > *").evaluateAll((controls) =>
    controls.map((control) => {
      const box = control.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(cardBox.width / cardBox.height).toBeGreaterThan(1.16);
  expect(cardBox.width / cardBox.height).toBeLessThan(1.25);
  expect(mediaBox.width / cardBox.width).toBeGreaterThan(0.92);
  expect(mediaBox.width / cardBox.width).toBeLessThan(0.95);
  expect(mediaBox.width / mediaBox.height).toBeGreaterThan(2.4);
  expect(mediaBox.width / mediaBox.height).toBeLessThan(2.82);
  expect(statusBox.width / mediaBox.width).toBeGreaterThan(0.22);
  expect(statusBox.width / mediaBox.width).toBeLessThan(0.3);
  expect(actionBoxes).toHaveLength(3);
  for (const actionBox of actionBoxes) {
    expect(actionBox.width / cardBox.width).toBeGreaterThan(0.09);
    expect(actionBox.width / cardBox.width).toBeLessThan(0.14);
    expect(actionBox.height / cardBox.width).toBeLessThan(0.12);
  }
  expect(quickBoxes[0].width / cardBox.width).toBeGreaterThan(0.32);
  expect(quickBoxes[0].width / cardBox.width).toBeLessThan(0.36);
  expect(quickBoxes[1].width / cardBox.width).toBeGreaterThan(0.2);
  expect(quickBoxes[1].width / cardBox.width).toBeLessThan(0.23);
  expect(quickBoxes[2].width / cardBox.width).toBeGreaterThan(0.32);
  expect(quickBoxes[2].width / cardBox.width).toBeLessThan(0.36);
  await expect(comfortableCard.locator(".inventory-card-image-status")).toContainText("کم موجود");
  await expect(comfortableCard.locator(".inventory-card-mobile-meta")).toContainText("Tanzim Demo");
  await expect(comfortableCard.locator(".inventory-card-price")).toContainText("۳۵۰٬۰۰۰");
  await expect(comfortableCard.locator(".quick-stock-control")).toBeVisible();

  await page.getByRole("button", { name: "نمای فشرده", exact: true }).click();
  const compactCard = page.locator(".inventory-card--compact");
  const compactBox = (await compactCard.boundingBox())!;
  const compactImageBox = (await compactCard.locator(".inventory-compact-image").boundingBox())!;
  const compactQuickBox = (await compactCard.locator(".inventory-compact-quick").boundingBox())!;
  const compactInfoBox = (await compactCard.locator(".inventory-compact-info").boundingBox())!;
  const compactFactBoxes = await compactCard.locator(".inventory-compact-facts > *").evaluateAll((facts) =>
    facts.filter((fact) => getComputedStyle(fact).display !== "none").map((fact) => {
      const box = fact.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }),
  );
  const compactButtons = await compactCard.locator(".quick-stock-button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  const compactControls = await compactCard.locator(".quick-stock-control > *").evaluateAll((controls) =>
    controls.map((control) => {
      const box = control.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }).sort((first, second) => first.left - second.left),
  );
  expect(compactBox.width / compactBox.height).toBeGreaterThan(3.8);
  expect(compactBox.width / compactBox.height).toBeLessThan(5.4);
  expect(compactImageBox.width / compactImageBox.height).toBeGreaterThan(0.95);
  expect(compactImageBox.width / compactImageBox.height).toBeLessThan(1.05);
  expect(Math.abs((compactQuickBox.y + compactQuickBox.height / 2) - (compactBox.y + compactBox.height / 2))).toBeLessThan(10);
  for (const fact of compactFactBoxes) {
    expect(fact.left).toBeGreaterThanOrEqual(compactInfoBox.x);
    expect(fact.right).toBeLessThanOrEqual(compactInfoBox.x + compactInfoBox.width);
  }
  for (const button of compactButtons) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
  expect(compactControls[0].left).toBeGreaterThanOrEqual(compactQuickBox.x);
  expect(compactControls.at(-1)!.right).toBeLessThanOrEqual(compactQuickBox.x + compactQuickBox.width);
  for (let index = 1; index < compactControls.length; index += 1) {
    expect(compactControls[index].left).toBeGreaterThanOrEqual(compactControls[index - 1].right);
  }
  for (const [label, selector] of [["نمای راحت", ".inventory-card-layout"], ["نمای فشرده", ".inventory-card--compact"], ["شبکه فشرده", ".inventory-card--grid"]] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(selector)).toHaveCount(1);
    await expect(page.getByText("لامپ LED 12W", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  const mobileGridColumns = await page.locator(".inventory-compact-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(mobileGridColumns).toBe(3);
  const gridCard = page.locator(".inventory-card--grid");
  await expect(gridCard.locator(".inventory-grid-title")).toHaveText("لامپ LED 12W");
  await expect(gridCard.locator(".inventory-grid-quantity")).toHaveText("۶ عدد");
  await expect(gridCard.locator(".inventory-grid-status")).toHaveCount(0);
  await expect(gridCard.locator(".inventory-grid-status-dot[data-status='low_stock']")).toHaveCount(1);
  expect(await gridCard.locator(".inventory-grid-title").evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");

  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("button", { name: "نمای فشرده", exact: true }).click();
  const narrowCompactCard = page.locator(".inventory-card--compact");
  const narrowQuickBox = (await narrowCompactCard.locator(".inventory-compact-quick").boundingBox())!;
  const narrowControls = await narrowCompactCard.locator(".quick-stock-control > *").evaluateAll((controls) =>
    controls.map((control) => {
      const box = control.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    }).sort((first, second) => first.left - second.left),
  );
  expect(narrowControls[0].left).toBeGreaterThanOrEqual(narrowQuickBox.x);
  expect(narrowControls.at(-1)!.right).toBeLessThanOrEqual(narrowQuickBox.x + narrowQuickBox.width);
  expect(narrowControls[0].width).toBeGreaterThanOrEqual(44);
  expect(narrowControls.at(-1)!.width).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  const narrowGridColumns = await page.locator(".inventory-compact-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(narrowGridColumns).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  const columns = await page.locator(".inventory-compact-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(columns).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  const desktopGridCard = page.locator(".inventory-card--grid");
  const desktopGridColumns = await page.locator(".inventory-compact-grid").evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
  );
  expect(desktopGridColumns).toBeGreaterThanOrEqual(3);
  await expect(desktopGridCard.locator(".inventory-card-mobile-meta")).toContainText("Tanzim Demo");
  await expect(desktopGridCard.locator(".inventory-card-price")).toContainText("۳۵۰٬۰۰۰");
  await expect(desktopGridCard.locator(".quick-stock-control")).toBeVisible();
  await expect(desktopGridCard.locator(".inventory-card-mobile-actions")).toBeVisible();

  await page.getByRole("button", { name: "نمای فشرده", exact: true }).click();
  const desktopCompactCard = page.locator(".inventory-card--compact");
  const desktopCompactImage = (await desktopCompactCard.locator(".inventory-compact-image").boundingBox())!;
  const desktopCompactInfo = (await desktopCompactCard.locator(".inventory-compact-info").boundingBox())!;
  const desktopCompactQuick = (await desktopCompactCard.locator(".inventory-compact-quick").boundingBox())!;
  const desktopCompactBox = (await desktopCompactCard.boundingBox())!;
  const desktopCompactButtons = await desktopCompactCard.locator(".quick-stock-button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(Math.abs(desktopCompactImage.width - desktopCompactImage.height)).toBeLessThanOrEqual(1);
  const compactCenterY = desktopCompactBox.y + desktopCompactBox.height / 2;
  expect(Math.abs(desktopCompactImage.y + desktopCompactImage.height / 2 - compactCenterY)).toBeLessThanOrEqual(3);
  expect(Math.abs(desktopCompactInfo.y + desktopCompactInfo.height / 2 - compactCenterY)).toBeLessThanOrEqual(4);
  expect(Math.abs(desktopCompactQuick.y + desktopCompactQuick.height / 2 - compactCenterY)).toBeLessThanOrEqual(4);
  for (const button of desktopCompactButtons) {
    expect(button.width).toBeGreaterThanOrEqual(40);
    expect(button.width).toBeLessThanOrEqual(48);
    expect(button.height).toBeGreaterThanOrEqual(40);
    expect(button.height).toBeLessThanOrEqual(48);
  }

  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  const desktopComfortableImage = (await page.locator(".inventory-card--comfortable .inventory-card-image").boundingBox())!;
  expect(Math.abs(desktopComfortableImage.width - desktopComfortableImage.height)).toBeLessThanOrEqual(1);
});

test("product card body opens editing in every view mode", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/list");

  for (const label of ["نمای راحت", "نمای فشرده", "شبکه فشرده"] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByText("لامپ LED 12W", { exact: true }).click();
    await expect(page).toHaveURL(/\/inventory\/edit\?id=8101$/);
    await page.goto("/inventory/list");
  }
});

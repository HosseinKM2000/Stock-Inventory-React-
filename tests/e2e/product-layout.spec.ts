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
      store_permissions: ["products.view", "products.create", "products.edit", "products.delete", "products.quantity.change", "products.sale_price.view", "products.sale_price.change", "barcodes.lookup", "barcodes.manage", "labels.print"],
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
      capabilities: { "inventory.read": true, "inventory.write": true, "barcode.lookup": true, "barcode.manage": true, "label.print": true },
      limits: { inventory_items: null },
    }));
  });
  await page.route("http://localhost:8000/api/**", (route) => route.abort());
}

async function seedProduct(page: Page, options: { name?: string; packaged?: boolean; categoryName?: string; barcode?: string; salePrice?: number; quantity?: number } = {}) {
  await page.goto("/dashboard");
  await page.evaluate(async ({ name, packaged, categoryName, barcode, salePrice, quantity }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = new Date().toISOString();
    const transaction = database.transaction(["inventoryItems", "categories", "labels", "barcodes"], "readwrite");
    transaction.objectStore("inventoryItems").put({
      local_key: "7111:7111:8101", local_user_id: 7111, local_store_id: 7111,
      id: 8101, catalog_product_id: 8101, is_catalog_backed: false, category_id: categoryName ? 9101 : null,
      label_ids: [], version: 1, quantity, price: salePrice, sale_price: salePrice,
      purchase_price: null, price_missing: false, custom_label: name, note: "نور گرم کم‌مصرف",
      low_stock_threshold: 8, low_stock_alert: true, is_hidden: false, image_url: null,
      deleted_at: null, status: "low_stock", created_at: now, updated_at: now,
      catalog_product: { id: 8101, industry_id: 1, is_active: true, name, description: "نور گرم کم‌مصرف", brand: "Tanzim Demo", image_url: null, is_packaged: packaged, pack_size: packaged ? 4 : null, created_at: now },
    });
    if (categoryName) transaction.objectStore("categories").put({
      local_key: "7111:7111:9101", local_user_id: 7111, local_store_id: 7111,
      id: 9101, name: categoryName, description: "", created_at: now, updated_at: now,
    });
    transaction.objectStore("labels").put({
      local_key: "7111:7111:9201", local_user_id: 7111, local_store_id: 7111,
      id: 9201, name: "ویژه", normalized_name: "ویژه", version: 1, created_at: now, updated_at: now,
    });
    if (barcode) transaction.objectStore("barcodes").put({
      local_key: "7111:7111:9102", local_user_id: 7111, local_store_id: 7111, store_id: 7111,
      id: 9102, product_id: 8101, value: barcode, source: "manufacturer", symbology: "code128",
      meaning: "unit", scan_quantity: 1, is_active: true, is_default: true, created_at: now, updated_at: now,
    });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, {
    name: options.name ?? "لامپ LED 12W",
    packaged: options.packaged ?? false,
    categoryName: options.categoryName ?? null,
    barcode: options.barcode ?? null,
    salePrice: options.salePrice ?? 350000,
    quantity: options.quantity ?? 6,
  });
}

async function seedMixedCompactProducts(page: Page) {
  await page.goto("/dashboard");
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["inventoryItems"], "readwrite");
    const store = transaction.objectStore("inventoryItems");
    const now = new Date().toISOString();
    for (let index = 0; index < 12; index += 1) {
      const id = 8200 + index;
      const packaged = index % 3 === 0;
      store.put({
        local_key: `7111:7111:${id}`, local_user_id: 7111, local_store_id: 7111,
        id, catalog_product_id: id, is_catalog_backed: false, category_id: null,
        label_ids: [], version: 1, quantity: index * 3, price: 120000 + index * 1000,
        sale_price: 120000 + index * 1000, purchase_price: null, price_missing: false,
        custom_label: `محصول آزمایشی ${index + 1}`, note: null, low_stock_threshold: 5,
        low_stock_alert: true, is_hidden: false, image_url: null, deleted_at: null,
        status: index % 3 === 0 ? "low_stock" : index % 3 === 1 ? "in_stock" : "out_of_stock", created_at: now, updated_at: now,
        catalog_product: {
          id, industry_id: 1, is_active: true, name: `محصول آزمایشی ${index + 1}`,
          description: null, brand: null, image_url: null, is_packaged: packaged,
          pack_size: packaged ? 4 : null, created_at: now,
        },
      });
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
}

function boxesOverlap(first: { x: number; y: number; width: number; height: number }, second: { x: number; y: number; width: number; height: number }) {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

test("compact virtual rows remain separated when the mobile keyboard changes the viewport", async ({ page }) => {
  await seedOfflineUser(page);
  await seedMixedCompactProducts(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/list");
  await page.getByRole("button", { name: "نمای فشرده", exact: true }).click();
  await expect(page.locator(".inventory-card--compact").first()).toBeVisible();

  const assertRowsAreSeparated = async () => {
    const rows = await page.locator(".inventory-list-results [data-index]").evaluateAll((elements) =>
      elements.map((element) => {
        const row = element.getBoundingClientRect();
        const card = element.querySelector(".inventory-card")!.getBoundingClientRect();
        const quick = element.querySelector(".quick-stock-wrapper")!.getBoundingClientRect();
        return {
          row: { top: row.top, bottom: row.bottom },
          card: { top: card.top, bottom: card.bottom },
          quick: { top: quick.top, bottom: quick.bottom },
        };
      }).sort((first, second) => first.row.top - second.row.top),
    );

    for (const item of rows) {
      expect(item.card.top).toBeGreaterThanOrEqual(item.row.top);
      expect(item.card.bottom).toBeLessThanOrEqual(item.row.bottom);
      expect(item.quick.top).toBeGreaterThanOrEqual(item.card.top);
      expect(item.quick.bottom).toBeLessThanOrEqual(item.card.bottom);
    }
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index].card.top).toBeGreaterThanOrEqual(rows[index - 1].card.bottom);
    }
  };

  await assertRowsAreSeparated();
  const statusSurfaces = await page.locator(".inventory-compact-status").evaluateAll((badges) => badges.map((badge) => {
    const style = getComputedStyle(badge);
    return { color: badge.getAttribute("data-accent-color"), opacity: style.opacity, background: style.backgroundColor };
  }));
  expect(new Set(statusSurfaces.map((surface) => surface.color))).toEqual(new Set(["green", "yellow", "red"]));
  for (const surface of statusSurfaces) {
    expect(surface.opacity).toBe("1");
    expect(surface.background).not.toBe("transparent");
  }
  await page.getByRole("button", { name: /ویرایش مستقیم موجودی/ }).first().click();
  await page.setViewportSize({ width: 390, height: 430 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator(".app-bottom-navigation")).toHaveAttribute("data-hidden", "true");
  await assertRowsAreSeparated();
  await expect(page.getByRole("spinbutton", { name: "موجودی جدید" })).toBeInViewport();

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 700 });
  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  await expect(page.locator(".inventory-card--comfortable").first()).toBeVisible();
  await page.getByRole("button", { name: /ویرایش مستقیم موجودی/ }).first().click();
  await page.setViewportSize({ width: 390, height: 430 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator(".app-bottom-navigation")).toHaveAttribute("data-hidden", "true");
  await assertRowsAreSeparated();
  await expect(page.getByRole("spinbutton", { name: "موجودی جدید" })).toBeInViewport();
});

test("long stock quantities use full-width rows and stay clear of desktop actions", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page, { quantity: 999_999_999, packaged: true });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/list");

  const assertWideLayout = async (cardSelector: string) => {
    const control = page.locator(`${cardSelector} .quick-stock-control`);
    const quantity = control.locator(".quick-stock-quantity");
    const increase = control.locator('[data-stock-action="increase"]');
    const decrease = control.locator('[data-stock-action="decrease"]');
    await expect(control).toHaveAttribute("data-quantity-layout", "wide");

    const controlBox = (await control.boundingBox())!;
    const quantityBox = (await quantity.boundingBox())!;
    const increaseBox = (await increase.boundingBox())!;
    const decreaseBox = (await decrease.boundingBox())!;
    expect(Math.abs(quantityBox.width - controlBox.width)).toBeLessThanOrEqual(2);
    expect(increaseBox.y).toBeGreaterThanOrEqual(quantityBox.y + quantityBox.height);
    expect(Math.abs(increaseBox.y - decreaseBox.y)).toBeLessThanOrEqual(1);
    expect(await quantity.locator(".quick-stock-count").evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
  };

  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  await assertWideLayout(".inventory-card--comfortable");

  await page.getByRole("button", { name: "نمای فشرده", exact: true }).click();
  await assertWideLayout(".inventory-card--compact");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopCompactCard = page.locator(".inventory-card--compact");
  const desktopControl = page.locator(".inventory-card--compact .quick-stock-control");
  const desktopQuantity = desktopControl.locator(".quick-stock-quantity");
  const desktopModeBox = (await desktopCompactCard.locator(".quick-stock-mode").boundingBox())!;
  const desktopControlBox = (await desktopControl.boundingBox())!;
  const desktopQuantityBox = (await desktopQuantity.boundingBox())!;
  const desktopCountBox = (await desktopQuantity.locator(".quick-stock-count").boundingBox())!;
  const desktopButtonBoxes = await desktopControl.locator(".quick-stock-button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }),
  );
  expect(desktopQuantityBox.width).toBeGreaterThan(72);
  expect(desktopCountBox.x).toBeGreaterThanOrEqual(desktopQuantityBox.x);
  expect(desktopCountBox.x + desktopCountBox.width).toBeLessThanOrEqual(desktopQuantityBox.x + desktopQuantityBox.width);
  expect(Math.abs(desktopButtonBoxes[0].y - desktopButtonBoxes[1].y)).toBeLessThanOrEqual(1);
  expect(boxesOverlap(desktopQuantityBox, desktopButtonBoxes[0])).toBe(false);
  expect(boxesOverlap(desktopQuantityBox, desktopButtonBoxes[1])).toBe(false);
  expect(boxesOverlap(desktopModeBox, desktopControlBox)).toBe(false);
  await desktopQuantity.locator(".quick-stock-count").click();
  const desktopCompactInput = desktopQuantity.locator(".quick-stock-input");
  await expect(desktopCompactInput).toBeVisible();
  const desktopInputBox = (await desktopCompactInput.boundingBox())!;
  const editingQuantityBox = (await desktopQuantity.boundingBox())!;
  expect(desktopInputBox.x).toBeGreaterThanOrEqual(editingQuantityBox.x);
  expect(desktopInputBox.x + desktopInputBox.width).toBeLessThanOrEqual(editingQuantityBox.x + editingQuantityBox.width);
  for (const buttonBox of desktopButtonBoxes) expect(boxesOverlap(desktopInputBox, buttonBox)).toBe(false);
  await desktopCompactInput.press("Escape");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  await assertWideLayout(".inventory-card--grid");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  const desktopCard = page.locator(".inventory-card--comfortable");
  const desktopActions = desktopCard.locator(".inventory-card-desktop-end .inventory-card-actions");
  const desktopQuick = desktopCard.locator(".inventory-card-quick");
  await desktopCard.getByRole("button", { name: /ویرایش مستقیم موجودی/ }).click();
  const desktopInput = desktopCard.getByRole("spinbutton", { name: "موجودی جدید" });
  const cardBox = (await desktopCard.boundingBox())!;
  const actionsBox = (await desktopActions.boundingBox())!;
  const quickBox = (await desktopQuick.boundingBox())!;
  const inputBox = (await desktopInput.boundingBox())!;
  expect(quickBox.y).toBeGreaterThanOrEqual(actionsBox.y + actionsBox.height);
  expect(boxesOverlap(actionsBox, quickBox)).toBe(false);
  expect(inputBox.width).toBeGreaterThan(72);
  expect(inputBox.width).toBeLessThanOrEqual(cardBox.width * .8);
  expect(await desktopInput.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

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
  await page.setViewportSize({ width: 358, height: 680 });
  await expect(panel).toHaveCount(1);
  await expect(search).toHaveValue("چای سبز");
  await expect(page.getByRole("heading", { name: "جستجو و فیلتر" })).toBeHidden();
  const filterTrigger = page.getByRole("button", { name: "فیلترها" });
  await expect(filterTrigger).toBeVisible();
  const mobileSearchBox = (await search.boundingBox())!;
  const mobileFilterBox = (await filterTrigger.boundingBox())!;
  const mobileFilterStyle = await filterTrigger.evaluate((element) => {
    const style = getComputedStyle(element);
    const iconStyle = getComputedStyle(element.querySelector("svg")!);
    return {
      backgroundImage: style.backgroundImage,
      iconBackground: iconStyle.backgroundColor,
      iconPadding: iconStyle.padding,
    };
  });
  expect(mobileFilterStyle.backgroundImage).toBe("none");
  expect(mobileFilterStyle.iconBackground).toBe("rgba(0, 0, 0, 0)");
  expect(mobileFilterStyle.iconPadding).toBe("0px");
  await expect(panel.locator(":scope > .inventory-catalog-filter")).toBeHidden();
  expect(mobileSearchBox.y).toBeLessThan(mobileFilterBox.y);
  expect(mobileSearchBox.height).toBeLessThanOrEqual(46);
  expect(mobileFilterBox.height).toBeLessThanOrEqual(44);
  expect((await sidebar.boundingBox())!.y).toBeLessThan((await results.boundingBox())!.y);
  await filterTrigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => getComputedStyle(element).animationName)).toContain("app-dialog-enter");
  expect(await dialog.evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Vazirmatn");
  await expect(dialog.getByText("دسته‌بندی", { exact: true })).toBeVisible();
  await expect(dialog.getByText("مرتب‌سازی", { exact: true })).toBeVisible();
  await expect(dialog.getByText("برچسب‌ها", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("switch", { name: "مخفی کردن محصولات کاتالوگ در پنجره فیلترها" })).toBeVisible();
  const modalLayout = await dialog.evaluate((element) => {
    const box = (selector: string) => {
      const rect = element.querySelector(selector)!.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    return {
      title: box(".inventory-filter-dialog-title-wrap"),
      reset: box(".inventory-filter-reset"),
      resetWhiteSpace: getComputedStyle(element.querySelector(".inventory-filter-reset")!).whiteSpace,
      resetFits: (() => {
        const reset = element.querySelector(".inventory-filter-reset")!;
        return reset.scrollWidth <= reset.clientWidth && reset.scrollHeight <= reset.clientHeight;
      })(),
      close: box(".inventory-filter-dialog-x"),
      firstLabel: box(".inventory-filter-dialog-field:first-child .inventory-filter-dialog-label"),
      firstControl: box(".inventory-filter-dialog-field:first-child .inventory-filter-control"),
      catalogTitle: box(".inventory-filter-dialog-catalog-title"),
      catalogSwitch: box(".inventory-filter-dialog-catalog .rt-SwitchRoot"),
      catalogDescription: box(".inventory-filter-dialog-catalog > .rt-Text"),
      fieldControls: Array.from(element.querySelectorAll(".inventory-filter-dialog-field .inventory-filter-control"), (control) => {
        const rect = control.getBoundingClientRect();
        const leading = control.querySelector(":scope > .inventory-filter-leading-icon")!.getBoundingClientRect();
        const value = control.querySelector(".rt-SelectTriggerInner > span, .inventory-filter-button > span")!.getBoundingClientRect();
        const valueContainer = control.querySelector(".rt-SelectTriggerInner") as HTMLElement | null;
        const trailing = control.querySelector(".rt-SelectIcon, .inventory-filter-chevron-icon")!.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          scrollWidth: control.scrollWidth,
          leadingLeft: leading.left,
          valueLeft: value.left,
          valueRight: value.right,
          trailingRight: trailing.right,
          valueClientWidth: valueContainer?.clientWidth ?? 0,
          valueScrollWidth: valueContainer?.scrollWidth ?? 0,
        };
      }),
      descriptionPosition: getComputedStyle(element.querySelector(".inventory-filter-dialog-description")!).position,
    };
  });
  expect(modalLayout.close.right).toBeLessThan(modalLayout.reset.left);
  expect(modalLayout.reset.right).toBeLessThan(modalLayout.title.left);
  expect(modalLayout.resetWhiteSpace).toBe("nowrap");
  expect(modalLayout.resetFits).toBe(true);
  expect(modalLayout.firstControl.right).toBeLessThan(modalLayout.firstLabel.left);
  expect(modalLayout.catalogSwitch.right).toBeLessThan(modalLayout.catalogTitle.left);
  expect(modalLayout.catalogDescription.top).toBeGreaterThanOrEqual(modalLayout.catalogTitle.bottom);
  for (const control of modalLayout.fieldControls) {
    expect(control.width).toBeGreaterThanOrEqual(160);
    expect(control.height).toBeLessThanOrEqual(80);
    expect(control.scrollWidth).toBeLessThanOrEqual(Math.ceil(control.width));
    expect(control.valueRight).toBeLessThanOrEqual(control.leadingLeft);
    expect(control.valueLeft).toBeGreaterThanOrEqual(control.trailingRight);
    expect(control.valueScrollWidth).toBeLessThanOrEqual(control.valueClientWidth);
  }
  expect(modalLayout.descriptionPosition).toBe("absolute");
  await expect(dialog.getByRole("button", { name: "مشاهده نتایج", exact: true })).toBeInViewport();
  await dialog.getByRole("combobox").first().click();
  const selectContent = page.locator(".rt-SelectContent[data-state='open']");
  await expect(selectContent).toBeVisible();
  expect(await selectContent.locator(".rt-SelectItem").first().evaluate((element) => getComputedStyle(element).animationName)).toContain("app-menu-item-enter");
  await page.keyboard.press("Escape");
  const closeDialog = dialog.getByRole("button", { name: "بستن فیلترها", exact: true });
  await closeDialog.scrollIntoViewIfNeeded();
  await expect(closeDialog).toBeInViewport();
  await closeDialog.click();
  await expect(dialog).toBeHidden();
  await filterTrigger.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(dialog).toBeHidden();
  await expect(panel.locator(":scope > .inventory-filter-row")).toBeHidden();
  await expect(panel.locator(".inventory-filter-heading")).toBeHidden();
  await expect(filterTrigger).toBeVisible();
  expect(await panel.locator(".inventory-filter-topline").evaluate((element) => getComputedStyle(element).flexWrap)).toBe("nowrap");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("product form order, mode accent, and fixed-navigation clearance remain visible", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page, { barcode: "6261234567890" });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/add");
  await expect(page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link", { name: "محصولات" })).toHaveAttribute("data-active", "true");

  const form = page.locator(".product-form");
  await expect(form).toHaveAttribute("data-mode", "create");
  await expect(page.getByText("افزودن محصول", { exact: true })).toBeVisible();
  const createAccent = await form.evaluate((element) => getComputedStyle(element).getPropertyValue("--product-form-accent").trim());
  expect(createAccent).toBe("#6e56cf");

  const ordered = [
    page.getByText("نام محصول", { exact: true }).first(),
    page.getByText("قیمت (تومان)", { exact: true }).first(),
    page.getByText("دسته‌بندی", { exact: true }).first(),
    page.getByText("یادداشت", { exact: true }).first(),
    page.getByText("برچسب‌ها", { exact: true }).first(),
    page.getByText("پیکربندی محصول", { exact: true }).first(),
  ];
  const offsets = await Promise.all(ordered.map((locator) => locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)));
  expect(offsets).toEqual([...offsets].sort((a, b) => a - b));

  await page.getByRole("button", { name: "انتخاب برچسب‌های محصول", exact: true }).click();
  await page.getByText("ویژه", { exact: true }).last().click();
  await expect(page.getByLabel("برچسب‌های انتخاب‌شده")).toContainText("ویژه");

  await page.getByRole("button", { name: "اسکن بارکد با دوربین", exact: true }).click();
  const createScannerDialog = page.getByRole("dialog", { name: "اسکن بارکد با دوربین" });
  await expect(createScannerDialog).toHaveAttribute("data-tone", "create");
  expect(await createScannerDialog.evaluate((element) => getComputedStyle(element).getPropertyValue("--barcode-scanner-accent").trim())).toBe("#6e56cf");
  await createScannerDialog.getByRole("button", { name: "بستن اسکنر", exact: true }).click();
  await page.locator("main[data-scroll-restoration-id='app-shell']").evaluate((element) => { element.scrollTop = 0; });

  const submit = page.getByRole("button", { name: "ثبت محصول", exact: true });
  await expect(submit).toHaveCount(1);
  await expect(submit).toHaveAttribute("data-floating", "true");
  const floatingSubmitBox = (await submit.boundingBox())!;
  expect(floatingSubmitBox.x).toBeGreaterThanOrEqual(12);
  expect(floatingSubmitBox.x).toBeLessThanOrEqual(24);
  expect(await form.locator(".product-form-heading").evaluate((element) => getComputedStyle(element).position)).toBe("sticky");

  const main = page.locator("main[data-scroll-restoration-id='app-shell']");
  await main.evaluate((element) => {
    const anchor = document.querySelector<HTMLElement>(".product-form-action-anchor");
    if (!anchor) throw new Error("Product form action anchor was not found");
    const mainBox = element.getBoundingClientRect();
    const anchorBox = anchor.getBoundingClientRect();
    const anchorOffset = anchorBox.top - mainBox.top + element.scrollTop;
    element.scrollTop = Math.max(0, anchorOffset - element.clientHeight + 8);
  });
  await expect(submit).toHaveAttribute("data-floating", "true");
  await expect(submit).toBeInViewport();

  await main.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(submit).toHaveAttribute("data-floating", "false");
  const submitBox = await submit.boundingBox();
  const navigationBox = await page.getByRole("navigation", { name: "ناوبری اصلی" }).boundingBox();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navigationBox!.y);

  const addButton = await page.getByRole("link", { name: "افزودن محصول" }).locator("span").boundingBox();
  expect(addButton!.width).toBeGreaterThanOrEqual(70);
  expect(addButton!.height).toBeGreaterThanOrEqual(70);

  await page.goto("/inventory/edit?id=8101");
  await expect(page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link", { name: "محصولات" })).toHaveAttribute("data-active", "true");
  await expect(form).toHaveAttribute("data-mode", "edit");
  const editAccent = await form.evaluate((element) => getComputedStyle(element).getPropertyValue("--product-form-accent").trim());
  expect(editAccent).toBe("#c47f00");
  await expect(page.getByRole("button", { name: "ثبت تغییرات", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ثبت تغییرات", exact: true })).toHaveCount(1);
  await expect(page.locator(".product-barcode-card")).toBeVisible();
  await expect(page.locator(".product-barcode-composer")).toBeVisible();
  await page.locator(".product-barcode-card").scrollIntoViewIfNeeded();
  const editSubmit = page.getByRole("button", { name: "ثبت تغییرات", exact: true });
  await expect(editSubmit).toHaveAttribute("data-floating", "true");
  await expect(editSubmit).toBeInViewport();
  const cameraButton = page.getByRole("button", { name: "اسکن بارکد با دوربین", exact: true });
  await expect(cameraButton).toBeVisible();
  await cameraButton.click();
  const scannerDialog = page.getByRole("dialog", { name: "اسکن بارکد با دوربین" });
  await expect(scannerDialog).toHaveAttribute("data-tone", "edit");
  await expect(scannerDialog.locator(".barcode-scanner-frame")).toBeVisible();
  await expect(scannerDialog.locator(".barcode-scanner-line")).toBeVisible();
  expect(await scannerDialog.evaluate((element) => getComputedStyle(element).getPropertyValue("--barcode-scanner-accent").trim())).toBe("#c47f00");
  await scannerDialog.getByRole("button", { name: "بستن اسکنر", exact: true }).click();
  const printBarcode = page.getByRole("button", { name: "چاپ بارکد 6261234567890", exact: true });
  await expect(printBarcode).toBeVisible();
  await expect(page.getByRole("button", { name: "غیرفعال کردن بارکد", exact: true })).toBeVisible();
  const barcodeActionSizes = await page.locator(".product-barcode-row-actions button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(barcodeActionSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  await printBarcode.click();
  await expect(page.getByRole("dialog").getByText("چاپ لیبل محصولات", { exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "بستن", exact: true }).click();
  const deleteBarcode = page.getByRole("button", { name: "حذف بارکد 6261234567890", exact: true });
  await deleteBarcode.click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog.getByRole("heading", { name: "حذف بارکد", exact: true })).toBeVisible();
  await expect(deleteDialog).toContainText("6261234567890");
  await deleteDialog.getByRole("button", { name: "حذف بارکد", exact: true }).click();
  await expect(printBarcode).toHaveCount(0);
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
  const quickButtonStyles = await comfortableCard.locator(".quick-stock-button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const style = getComputedStyle(button);
      return {
        action: button.getAttribute("data-stock-action"),
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderStyle: style.borderStyle,
      };
    }),
  );
  expect(cardBox.width / cardBox.height).toBeGreaterThan(1.16);
  expect(cardBox.width / cardBox.height).toBeLessThan(1.25);
  expect(mediaBox.width / cardBox.width).toBeGreaterThan(0.92);
  expect(mediaBox.width / cardBox.width).toBeLessThan(0.95);
  expect(mediaBox.width / mediaBox.height).toBeGreaterThan(2.4);
  expect(mediaBox.width / mediaBox.height).toBeLessThan(2.82);
  expect(statusBox.width / mediaBox.width).toBeGreaterThan(0.14);
  expect(statusBox.width / mediaBox.width).toBeLessThan(0.24);
  const statusStyle = await comfortableCard.locator(".inventory-card-image-status").evaluate((element) => {
    const style = getComputedStyle(element);
    return { opacity: style.opacity, backgroundColor: style.backgroundColor };
  });
  expect(statusStyle.opacity).toBe("1");
  expect(statusStyle.backgroundColor).not.toBe("transparent");
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
  expect(quickButtonStyles.map(({ action }) => action)).toEqual(["increase", "decrease"]);
  expect(quickButtonStyles.every(({ borderStyle }) => borderStyle === "solid")).toBe(true);
  expect(quickButtonStyles[0].color).not.toBe(quickButtonStyles[1].color);
  expect(quickButtonStyles[0].backgroundColor).not.toBe(quickButtonStyles[1].backgroundColor);
  await expect(comfortableCard.locator(".inventory-card-image-status")).toContainText("کمبود");
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
  const mobileGridCardBox = (await gridCard.boundingBox())!;
  const mobileGridTitleBox = (await gridCard.locator(".inventory-grid-title").boundingBox())!;
  expect(Math.abs(mobileGridCardBox.width - mobileGridCardBox.height)).toBeLessThanOrEqual(2);
  expect(mobileGridTitleBox.x).toBeGreaterThanOrEqual(mobileGridCardBox.x);
  expect(mobileGridTitleBox.x + mobileGridTitleBox.width).toBeLessThanOrEqual(mobileGridCardBox.x + mobileGridCardBox.width);
  expect(await gridCard.locator(".inventory-grid-title").evaluate((element) => getComputedStyle(element).overflow)).toBe("hidden");

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
  const narrowGridCard = page.locator(".inventory-card--grid");
  const narrowGridCardBox = (await narrowGridCard.boundingBox())!;
  const narrowGridTitleBox = (await narrowGridCard.locator(".inventory-grid-title").boundingBox())!;
  expect(Math.abs(narrowGridCardBox.width - narrowGridCardBox.height)).toBeLessThanOrEqual(2);
  expect(narrowGridTitleBox.x).toBeGreaterThanOrEqual(narrowGridCardBox.x);
  expect(narrowGridTitleBox.x + narrowGridTitleBox.width).toBeLessThanOrEqual(narrowGridCardBox.x + narrowGridCardBox.width);
  expect(await narrowGridCard.locator(".inventory-grid-title").evaluate((element) => getComputedStyle(element).textOverflow)).toBe("ellipsis");
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
  const desktopCompactStockItems = await desktopCompactCard.locator(".quick-stock-wrapper > *").evaluateAll((items) =>
    items.filter((item) => getComputedStyle(item).display !== "none").map((item) => {
      const box = item.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }),
  );
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
  expect(Math.min(...desktopCompactStockItems.map((item) => item.left)) - desktopCompactQuick.x).toBeLessThanOrEqual(2);
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

test("only the product image opens editing in every view mode", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/list");

  for (const label of ["نمای راحت", "نمای فشرده", "شبکه فشرده"] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByText("لامپ LED 12W", { exact: true }).click();
    await expect(page).toHaveURL(/\/inventory\/list$/);
    await page.locator(".inventory-card-image, .inventory-compact-image").click();
    await expect(page).toHaveURL(/\/inventory\/edit\?id=8101$/);
    await page.goto("/inventory/list");
  }
});

test("toast notifications enter with lightweight motion", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-write"]);
  await seedOfflineUser(page);
  await seedProduct(page);
  await page.goto("/inventory/list");

  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  await page.getByRole("button", { name: /کپی نام و قیمت لامپ LED 12W/ }).click();
  const toast = page.locator(".app-toaster .app-toast").first();
  await expect(toast).toBeVisible();
  const motion = await toast.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: Number.parseFloat(style.animationDuration) };
  });
  expect(motion.name).toContain("app-toast-enter");
  expect(motion.duration).toBeGreaterThanOrEqual(.15);
  expect(motion.duration).toBeLessThanOrEqual(.25);
});

test("long press selection covers the card and bulk actions stay inside mobile viewport", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/inventory/list");

  const card = page.locator(".inventory-card");
  const imageBox = (await card.locator(".inventory-card-image").boundingBox())!;
  await page.mouse.move(imageBox.x + imageBox.width / 2, imageBox.y + imageBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();

  const overlay = card.locator(".inventory-selection-overlay");
  await expect(overlay).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  const overlayBox = (await overlay.boundingBox())!;
  expect(Math.abs(cardBox.x - overlayBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(cardBox.y - overlayBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(cardBox.width - overlayBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(cardBox.height - overlayBox.height)).toBeLessThanOrEqual(1);
  const checkBox = (await overlay.locator(".inventory-selection-check").boundingBox())!;
  expect(checkBox.x + checkBox.width).toBeGreaterThan(cardBox.x + cardBox.width * .75);
  expect(checkBox.y).toBeLessThan(cardBox.y + cardBox.height * .25);

  const bulkActions = page.locator(".bulk-selection-actions");
  const bulkBox = (await bulkActions.boundingBox())!;
  expect(bulkBox.x).toBeGreaterThanOrEqual(0);
  expect(bulkBox.x + bulkBox.width).toBeLessThanOrEqual(320);
  const bulkButtons = await bulkActions.locator("button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  for (const button of bulkButtons) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeLessThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("desktop product cards keep long content and packaged stock controls aligned without overflow", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page, {
    name: "ظرف نگهدارنده شیشه‌ای با درپوش بسیار بلند",
    packaged: true,
    categoryName: "ظروف آشپزخانه",
    barcode: "6261234567890",
    salePrice: 1295000000,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory/list");

  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  const gridCard = page.locator(".inventory-card--grid");
  const gridTitle = gridCard.locator(".inventory-grid-title");
  const gridPrice = gridCard.locator(".inventory-card-price");
  const gridQuick = gridCard.locator(".inventory-card-quick");
  const gridMediaBox = (await gridCard.locator(".inventory-card-media").boundingBox())!;
  const gridStatus = gridCard.locator(".inventory-card-image-status");
  const gridActionsBox = (await gridCard.locator(".inventory-card-mobile-actions").boundingBox())!;
  const gridFooterBox = (await gridCard.locator(".inventory-card-footer").boundingBox())!;
  const gridTitleBox = (await gridTitle.boundingBox())!;
  const gridPriceBox = (await gridPrice.boundingBox())!;
  const gridCardBox = (await gridCard.boundingBox())!;
  const gridQuickBox = (await gridQuick.boundingBox())!;
  expect(gridMediaBox.width / gridMediaBox.height).toBeGreaterThan(2);
  expect(gridMediaBox.width / gridCardBox.width).toBeGreaterThan(.9);
  await expect(gridStatus).toBeVisible();
  expect(await gridTitle.evaluate((element) => getComputedStyle(element).webkitLineClamp)).toBe("2");
  expect(await gridTitle.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("normal");
  expect(await gridTitle.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(15);
  const gridContentBox = (await gridCard.locator(".inventory-card-content").boundingBox())!;
  expect(gridTitleBox.width).toBeLessThanOrEqual(gridContentBox.width * .52);
  expect(boxesOverlap(gridTitleBox, gridPriceBox)).toBe(false);
  await expect(gridCard.locator(".inventory-card-category")).toHaveText("ظروف آشپزخانه");
  await expect(gridCard.locator(".inventory-card-barcode")).toHaveText("6261234567890");
  await expect(gridCard.locator(".inventory-card-mobile-meta")).toBeHidden();
  const gridTitleFontSize = await gridTitle.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const gridPriceFontSize = await gridPrice.locator("strong").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(Math.abs(gridPriceFontSize - gridTitleFontSize)).toBeLessThanOrEqual(.5);
  expect(await gridPrice.locator("strong").evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
  expect(Math.abs(gridActionsBox.x - gridFooterBox.x)).toBeLessThanOrEqual(2);
  expect(gridActionsBox.y - (gridPriceBox.y + gridPriceBox.height)).toBeGreaterThanOrEqual(8);
  expect(gridCardBox.height / gridCardBox.width).toBeGreaterThanOrEqual(.82);
  expect(gridActionsBox.y + gridActionsBox.height).toBeLessThanOrEqual(gridQuickBox.y);
  expect(gridQuickBox.x).toBeGreaterThanOrEqual(gridCardBox.x);
  expect(gridQuickBox.x + gridQuickBox.width).toBeLessThanOrEqual(gridCardBox.x + gridCardBox.width + 1);

  await page.getByRole("button", { name: "نمای فشرده", exact: true }).click();
  const compactCard = page.locator(".inventory-card--compact");
  const compactTitle = compactCard.locator(".inventory-compact-title");
  const compactCardBox = (await compactCard.boundingBox())!;
  const compactModeBox = (await compactCard.locator(".quick-stock-mode").boundingBox())!;
  const compactControlBox = (await compactCard.locator(".quick-stock-control").boundingBox())!;
  expect(compactCardBox.height).toBeLessThanOrEqual(96);
  expect(await compactTitle.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
  expect(await compactTitle.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(15);
  expect(Math.abs((compactModeBox.y + compactModeBox.height / 2) - (compactControlBox.y + compactControlBox.height / 2))).toBeLessThanOrEqual(4);

  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  const comfortableCard = page.locator(".inventory-card--comfortable");
  const comfortableTitle = comfortableCard.locator(".inventory-card-title");
  const comfortableBox = (await comfortableCard.boundingBox())!;
  const comfortableImage = (await comfortableCard.locator(".inventory-card-image").boundingBox())!;
  const comfortableContent = (await comfortableCard.locator(".inventory-card-content").boundingBox())!;
  const comfortableControls = (await comfortableCard.locator(".inventory-card-controls").boundingBox())!;
  const comfortableActions = (await comfortableCard.locator(".inventory-card-desktop-end .inventory-card-actions").boundingBox())!;
  const comfortableStatus = (await comfortableCard.locator(".inventory-card-desktop-status").boundingBox())!;
  const comfortableMode = (await comfortableCard.locator(".quick-stock-mode").boundingBox())!;
  const comfortableStockControl = (await comfortableCard.locator(".quick-stock-control").boundingBox())!;
  const comfortableActionButtons = await comfortableCard.locator(".inventory-card-desktop-end .inventory-card-actions button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(comfortableBox.height).toBeGreaterThanOrEqual(170);
  expect(comfortableBox.height).toBeLessThanOrEqual(184);
  expect(comfortableImage.width).toBeGreaterThanOrEqual(170);
  expect(await comfortableTitle.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("nowrap");
  expect(await comfortableTitle.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeLessThanOrEqual(16.2);
  expect(Math.abs(comfortableImage.width - comfortableImage.height)).toBeLessThanOrEqual(1);
  expect(comfortableControls.x).toBeLessThan(comfortableContent.x);
  expect(comfortableContent.x + comfortableContent.width).toBeLessThanOrEqual(comfortableImage.x + 1);
  expect(comfortableImage.x + comfortableImage.width).toBeGreaterThanOrEqual(comfortableBox.x + comfortableBox.width - 2);
  expect(Math.abs(comfortableActions.y - comfortableStatus.y)).toBeLessThanOrEqual(4);
  expect(comfortableMode.y).toBeGreaterThanOrEqual(comfortableActions.y + comfortableActions.height + 8);
  expect(comfortableStockControl.y).toBeGreaterThanOrEqual(comfortableMode.y + comfortableMode.height + 6);
  expect(Math.abs(comfortableMode.width - comfortableStockControl.width)).toBeLessThanOrEqual(2);
  expect(comfortableStockControl.width).toBeGreaterThanOrEqual(168);
  for (const button of comfortableActionButtons) {
    expect(button.width).toBeGreaterThanOrEqual(40);
    expect(button.height).toBeGreaterThanOrEqual(40);
  }
  await expect(comfortableCard.locator(".inventory-card-category")).toHaveText("ظروف آشپزخانه");
  await expect(comfortableCard.locator(".inventory-card-barcode")).toHaveText("6261234567890");
  await expect(comfortableCard.locator(".inventory-card-classification")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 700 });
  const mobileContentBox = (await comfortableCard.locator(".inventory-card-content").boundingBox())!;
  const mobileTitleBox = (await comfortableTitle.boundingBox())!;
  expect(await comfortableTitle.evaluate((element) => getComputedStyle(element).webkitLineClamp)).toBe("2");
  expect(await comfortableTitle.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe("normal");
  expect(mobileTitleBox.width).toBeLessThanOrEqual(mobileContentBox.width * .52);
  await expect(comfortableCard.locator(".inventory-card-category")).toHaveText("ظروف آشپزخانه");
  await expect(comfortableCard.locator(".inventory-card-barcode")).toHaveText("6261234567890");
  await expect(comfortableCard.locator(".inventory-card-mobile-meta")).toBeHidden();
  const mobileModeBox = (await comfortableCard.locator(".quick-stock-mode").boundingBox())!;
  const mobileStockBox = (await comfortableCard.locator(".quick-stock-control").boundingBox())!;
  const mobilePrice = comfortableCard.locator(".inventory-card-price");
  const mobileActionsBox = (await comfortableCard.locator(".inventory-card-mobile-actions").boundingBox())!;
  const mobileFooterBox = (await comfortableCard.locator(".inventory-card-footer").boundingBox())!;
  const mobilePriceBox = (await mobilePrice.boundingBox())!;
  const mobileTitleFontSize = await comfortableTitle.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  const mobilePriceFontSize = await mobilePrice.locator("strong").evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(Math.abs(mobilePriceFontSize - mobileTitleFontSize)).toBeLessThanOrEqual(.5);
  expect(Math.abs(mobileActionsBox.x - mobileFooterBox.x)).toBeLessThanOrEqual(2);
  expect(mobileActionsBox.y - (mobilePriceBox.y + mobilePriceBox.height)).toBeGreaterThanOrEqual(8);
  expect(Math.abs(mobileModeBox.width - mobileStockBox.width)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  const packagedGridQuantity = page.locator(".inventory-card--grid .inventory-grid-quantity");
  await expect(packagedGridQuantity).toBeVisible();
  await expect(packagedGridQuantity).toContainText("۶");

  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const [label, selector] of [
      ["نمای راحت", ".inventory-card--comfortable"],
      ["نمای فشرده", ".inventory-card--compact"],
      ["شبکه فشرده", ".inventory-card--grid"],
    ] as const) {
      await page.getByRole("button", { name: label, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const resultsBox = (await page.locator(".inventory-list-results").boundingBox())!;
      const cardBox = (await page.locator(selector).boundingBox())!;
      expect(cardBox.x).toBeGreaterThanOrEqual(resultsBox.x - 1);
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(resultsBox.x + resultsBox.width + 1);
    }
  }
});

test("grid and comfortable cards show a minimal empty barcode state", async ({ page }) => {
  await seedOfflineUser(page);
  await seedProduct(page, { categoryName: "ظروف آشپزخانه" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/inventory/list");

  await page.getByRole("button", { name: "شبکه فشرده", exact: true }).click();
  await expect(page.locator(".inventory-card--grid .inventory-card-barcode")).toHaveText("بدون بارکد");

  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  const desktopEmptyBarcode = page.locator(".inventory-card--comfortable .inventory-card-barcode");
  await expect(desktopEmptyBarcode).toHaveText("بدون بارکد");
  await expect(desktopEmptyBarcode).toBeVisible();

  await page.setViewportSize({ width: 390, height: 700 });
  await page.getByRole("button", { name: "نمای راحت", exact: true }).click();
  const emptyBarcode = page.locator(".inventory-card--comfortable .inventory-card-barcode");
  await expect(emptyBarcode).toHaveText("بدون بارکد");
  await expect(emptyBarcode.locator("svg")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)]));
  return value;
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function recoveryBackup(options: { withImage?: boolean } = {}) {
  const product = (id: number) => ({
    id, local_user_id: 7201, local_store_id: 7201, local_key: `7201:7201:${id}`,
    catalog_product_id: id, is_catalog_backed: false, category_id: null, label_ids: [], version: 3,
    quantity: id === 81 ? 4 : 7, price: 1200, sale_price: 1200, purchase_price: null,
    price_missing: false, custom_label: null, note: null, low_stock_threshold: 0, low_stock_alert: false,
    is_hidden: false, image_url: options.withImage && id === 81 ? "local://recovered-81.webp" : null, deleted_at: null, status: "in_stock",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    catalog_product: { id, industry_id: 1, is_active: true, name: `Recovered ${id}`, description: null, brand: null, image_url: null, is_packaged: false, pack_size: null, created_at: "2026-01-01T00:00:00Z" },
  });
  const images = options.withImage ? [{ path: "local://recovered-81.webp", mimeType: "image/webp", base64: "cGl4ZWxz" }] : [];
  const data = { products: [product(81), product(82)], categories: [], labels: [], barcodes: [], inventoryMovements: [], pendingOperations: [], reconciliation: [], preferences: {}, images, unavailableImages: [] };
  const revisionProjection = { ...data, images: images.map(({ path }) => path).sort(), unavailableImages: [] };
  const unsigned = {
    format: "tanzim-local-backup", formatVersion: 1, schemaVersion: 4,
    createdAt: "2026-10-13T10:00:00.000Z", snapshotRevision: digest(revisionProjection),
    owner: { userId: 7201, username: "backup-user", storeId: 7201 },
    counts: { products: 2, categories: 0, labels: 0, barcodes: 0, inventoryMovements: 0, pendingOperations: 0, images: images.length, unavailableImages: 0 },
    data,
  };
  return JSON.stringify({ ...unsigned, integrity: { algorithm: "SHA-256", digest: digest(unsigned) } });
}

async function recoveryStatuses(page: Page) {
  return page.evaluate(() => new Promise<string[]>((resolve, reject) => {
    const request = indexedDB.open("inventory-db");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("recoverySessions", "readonly");
      const records = transaction.objectStore("recoverySessions").getAll();
      records.onerror = () => reject(records.error);
      records.onsuccess = () => resolve((records.result as Array<{ status: string }>).map((record) => record.status));
    };
  }));
}

async function seedAuthenticatedUser(page: Page) {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const user = {
      id: 7201,
      first_name: "Backup",
      last_name: "Tester",
      username: "backup-user",
      email: null,
      phone: null,
      industry_id: 1,
      plan: "pro",
      is_active: true,
      is_admin: false,
      role: "USER",
      is_system_admin: false,
      is_store_owner: true,
      store_id: 7201,
      subscription_started_at: now,
      subscription_expires_at: "2099-01-01T00:00:00.000Z",
      created_at: now,
    };
    localStorage.setItem("access_token", JSON.stringify("backup-test-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}`, JSON.stringify({
      user_id: user.id,
      plan: "pro",
      label: "Pro",
      status: "active",
      account_status: "active",
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

test("backup shortcut and settings remain usable on desktop and narrow screens", async ({ page }) => {
  await seedAuthenticatedUser(page);
  await page.goto("/dashboard");

  const backupButton = page.locator(".app-header-left").getByRole("button", { name: /فایل پشتیبان/ });
  const notificationButton = page.locator(".app-header-right").getByRole("button", { name: /اعلان|هشدار/ });
  await expect(backupButton).toBeVisible();
  await expect(notificationButton).toBeVisible();
  await expect(page.locator(".app-header-left .sync-status-badge")).toBeVisible();

  await backupButton.click();
  await expect(page.getByText(/برای اطمینان بیشتر/)).toBeVisible();
  await expect(page.getByRole("button", { name: "ذخیره فایل پشتیبان" })).toBeVisible();

  await page.goto("/setting");
  await expect(page.getByRole("link", { name: /فایل پشتیبان محلی/ })).toHaveAttribute("href", "/setting/backup");
  await page.goto("/setting/backup");
  await expect(page.getByRole("heading", { name: "فایل پشتیبان محلی", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "مقصد ذخیره" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "زمان‌بندی" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "بازیابی" })).toBeVisible();

  for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${viewport.width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test("restore review survives restart and apply, export, and discard stay explicit", async ({ page }, testInfo) => {
  await seedAuthenticatedUser(page);
  await page.goto("/setting/backup");
  await page.locator('input[type="file"]').setInputFiles({
    name: "recovery.tanzimbackup",
    mimeType: "application/vnd.tanzim.backup+json",
    buffer: Buffer.from(recoveryBackup()),
  });
  await expect(page.getByRole("heading", { name: "تأیید بازیابی فایل پشتیبان" })).toBeVisible();
  await page.getByRole("button", { name: "بازیابی اطلاعات" }).click();
  await expect(page.getByRole("heading", { name: "بررسی بازیابی ناتمام" })).toBeVisible();
  await expect(page.getByText(/۲ تصمیم باقی مانده/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "بررسی بازیابی ناتمام" })).toBeVisible();
  const exportAction = page.getByRole("button", { name: "صدور مدرک بازیابی" });
  await exportAction.scrollIntoViewIfNeeded();
  await expect(exportAction).toBeVisible();
  await exportAction.focus();
  await expect(exportAction).toBeFocused();
  await page.evaluate(() => {
    localStorage.setItem("inventory-appearance", "light");
    localStorage.setItem("inventory-display-size", "compact");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "compact");
  await expect(page.getByRole("button", { name: "صدور مدرک بازیابی" })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem("inventory-appearance", "dark");
    localStorage.setItem("inventory-display-size", "large");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-display-size", "large");
  const reviewDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(reviewDimensions.scrollWidth).toBeLessThanOrEqual(reviewDimensions.clientWidth);
  const reviewPanel = page.getByRole("heading", { name: "بررسی بازیابی ناتمام" })
    .locator("xpath=ancestor::*[contains(@class, 'rt-Card')][1]");
  await reviewPanel.screenshot({ path: testInfo.outputPath("restore-review-dark-large.png") });
  await page.getByRole("button", { name: "اعمال با بررسی سرور" }).first().click();
  await expect(page.getByText("آمادهٔ ارسال")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "صدور مدرک بازیابی" }).click();
  expect((await download).suggestedFilename()).toContain("tanzim-backup");

  await page.getByRole("button", { name: "کنار گذاشتن قصد" }).click();
  await expect(page.getByRole("heading", { name: "کنار گذاشتن قصد بازیابی؟" })).toBeVisible();
  await page.getByRole("button", { name: "تأیید کنار گذاشتن" }).click();
  await expect(page.getByText("کنار گذاشته‌شده")).toBeVisible();
  await expect(page.getByRole("button", { name: "ارسال موارد تأییدشده و ادامهٔ همگام‌سازی" })).toBeEnabled();
});

test("closing the restoring tab during media staging safely aborts on reopen", async ({ page, context }) => {
  await seedAuthenticatedUser(page);
  await page.addInitScript(() => {
    const prototype = FileSystemFileHandle.prototype;
    const original = prototype.createWritable;
    prototype.createWritable = async function (...args) {
      const writable = await original.apply(this, args);
      if (!this.name.startsWith("restore-")) return writable;
      const write = writable.write.bind(writable);
      writable.write = async (data) => {
        await write(data);
        await new Promise<never>(() => undefined);
      };
      return writable;
    };
  });
  await page.goto("/setting/backup");
  await page.locator('input[type="file"]').setInputFiles({
    name: "interrupted.tanzimbackup",
    mimeType: "application/vnd.tanzim.backup+json",
    buffer: Buffer.from(recoveryBackup({ withImage: true })),
  });
  const restoreAttempt = page.getByRole("button", { name: "بازیابی اطلاعات" }).click().catch(() => undefined);
  await expect.poll(() => recoveryStatuses(page)).toContain("preparing");

  await page.close();
  await restoreAttempt;

  const reopened = await context.newPage();
  await seedAuthenticatedUser(reopened);
  await reopened.goto("/setting/backup");
  await expect.poll(() => recoveryStatuses(reopened)).toEqual([]);
  await expect(reopened.getByRole("heading", { name: "بررسی بازیابی ناتمام" })).toHaveCount(0);
});

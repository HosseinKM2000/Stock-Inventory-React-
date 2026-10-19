import { chromium, expect, test } from "@playwright/test";
import { rmSync } from "node:fs";

test("PWA manifest and service worker are served", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/dashboard" });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192", purpose: "any" }),
    expect.objectContaining({ sizes: "512x512", purpose: "any" }),
    expect.objectContaining({ sizes: "192x192", purpose: "maskable" }),
    expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
  ]));

  for (const asset of [
    "/pwa-icon-192.png",
    "/pwa-icon-512.png",
    "/pwa-icon-maskable-192.png",
    "/pwa-icon-maskable-512.png",
    "/apple-touch-icon.png",
  ]) {
    const response = await request.get(asset);
    expect(response.ok(), `${asset} should be served`).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  const source = await worker.text();
  expect(source).toContain("inventory-sync");
  expect(source).toContain("await cache.addAll(resources)");
  expect(source).toContain("tanzim-activate-update");
  expect(source).not.toContain("precacheApplication().then(() => self.skipWaiting())");
});

test("prepares unvisited core routes and local inventory for an offline cold page", async ({ page, context }) => {
  const userId = 9001;
  await page.addInitScript(({ id }) => {
    const now = new Date().toISOString();
    localStorage.setItem("access_token", JSON.stringify("offline-test-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify({
      id,
      first_name: "Offline",
      last_name: "User",
      username: "offline-user",
      email: null,
      phone: null,
      industry_id: 1,
      plan: "pro",
      is_active: true,
      is_admin: false,
      role: "USER",
      is_system_admin: false,
      subscription_started_at: now,
      subscription_expires_at: "2099-01-01T00:00:00.000Z",
      created_at: now,
    }));
    localStorage.setItem(`inventory-entitlement-v2:${id}`, JSON.stringify({
      user_id: id,
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
  }, { id: userId });

  await page.goto("/dashboard");
  await expect(page.locator("main").first()).toBeVisible();

  await page.evaluate(async ({ id }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("inventoryItems", "readwrite");
      transaction.objectStore("inventoryItems").put({
        id: 9002,
        local_user_id: id,
        catalog_product_id: 9002,
        is_catalog_backed: false,
        category_id: null,
        quantity: 7,
        price: 100,
        custom_label: "Offline Product",
        note: null,
        low_stock_threshold: 2,
        low_stock_alert: true,
        is_hidden: false,
        image_url: "http://127.0.0.1:9/missing.webp",
        deleted_at: null,
        status: "in_stock",
        created_at: "2026-10-12T00:00:00.000Z",
        updated_at: "2026-10-12T00:00:00.000Z",
        catalog_product: {
          id: 9002,
          industry_id: 1,
          name: "Offline Product",
          description: null,
          brand: null,
          image_url: null,
          is_packaged: false,
          pack_size: null,
          created_at: "2026-10-12T00:00:00.000Z",
        },
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { id: userId });

  await expect.poll(() => page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return Boolean(await caches.match(new URL("/.__offline-ready-v8", location.origin)));
  }), { timeout: 15_000 }).toBe(true);
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    { timeout: 15_000 },
  ).toBe(true);

  await page.close();
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await offlinePage.goto("/inventory/list");
  expect(await offlinePage.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  expect(await offlinePage.evaluate(async () => {
    const resources = [...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"], link[rel="stylesheet"]')];
    const missing: string[] = [];
    for (const resource of resources) {
      if (!(await caches.match(resource.href))) missing.push(resource.href);
    }
    return missing;
  })).toEqual([]);
  await expect(offlinePage.getByText("Offline Product").first()).toBeVisible();

  const productImage = offlinePage.getByAltText("Offline Product").first();
  await expect(productImage).toHaveAttribute("src", /^data:image\/svg\+xml/);

  await offlinePage.reload();
  await expect(offlinePage.getByText("Offline Product").first()).toBeVisible();
});

test("IndexedDB inventory survives a persistent browser-profile restart", async (_fixtures, testInfo) => {
  const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173";
  const userDataDir = testInfo.outputPath("persistent-storage-profile");
  const userId = 9101;
  rmSync(userDataDir, { recursive: true, force: true });
  const launchOptions = {
    baseURL,
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  };

  let persistentContext = await chromium.launchPersistentContext(userDataDir, launchOptions);
  await persistentContext.addInitScript(({ id }) => {
    localStorage.setItem("access_token", JSON.stringify("restart-test-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify({
      id,
      first_name: "Restart",
      last_name: "User",
      username: "restart-user",
      email: null,
      phone: null,
      industry_id: 1,
      plan: "pro",
      is_active: true,
      is_admin: true,
      role: "ADMIN",
      is_system_admin: false,
      subscription_started_at: null,
      subscription_expires_at: null,
      created_at: "2026-10-12T00:00:00.000Z",
    }));
  }, { id: userId });

  let profilePage = persistentContext.pages()[0] ?? await persistentContext.newPage();
  await profilePage.goto(`${baseURL}/dashboard`);
  await profilePage.evaluate(async ({ id }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("inventoryItems", "readwrite");
      transaction.objectStore("inventoryItems").put({
        id: 9102,
        local_user_id: id,
        catalog_product_id: 9102,
        is_catalog_backed: false,
        category_id: null,
        quantity: 1,
        price: 1,
        custom_label: "Restart Durable Product",
        note: null,
        low_stock_threshold: 0,
        low_stock_alert: false,
        is_hidden: false,
        image_url: null,
        deleted_at: null,
        status: "in_stock",
        created_at: "2026-10-12T00:00:00.000Z",
        updated_at: "2026-10-12T00:00:00.000Z",
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { id: userId });
  await persistentContext.close();

  persistentContext = await chromium.launchPersistentContext(userDataDir, launchOptions);
  profilePage = persistentContext.pages()[0] ?? await persistentContext.newPage();
  await profilePage.goto(`${baseURL}/dashboard`);
  await expect.poll(() => profilePage.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const stored = await new Promise<IDBValidKey | undefined>((resolve, reject) => {
      const request = database.transaction("inventoryItems").objectStore("inventoryItems").getKey(9102);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return stored;
  })).toBe(9102);
  await persistentContext.close();
});

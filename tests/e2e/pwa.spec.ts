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
  await page.route("http://localhost:8000/api/**", (route) => route.abort());
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
        local_key: `${id}:${id}:9002`,
        id: 9002,
        local_user_id: id,
        local_store_id: id,
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
    return Boolean(await caches.match(new URL("/.__offline-ready-v9", location.origin)));
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

  const productImage = offlinePage
    .locator(".inventory-card")
    .filter({ hasText: "Offline Product" })
    .locator("img")
    .first();
  await expect(productImage).toHaveAttribute("src", /^data:image\/svg\+xml/);

  await offlinePage.reload();
  await expect(offlinePage.getByText("Offline Product").first()).toBeVisible();

  await offlinePage.goto("/tools");
  await expect(offlinePage.getByRole("heading", { name: "ابزارها" })).toBeVisible();
  await expect(offlinePage.getByRole("link", { name: /کاتالوگ/ })).toBeVisible();
  await offlinePage.goto("/tools/catalog");
  await expect(offlinePage.getByRole("heading", { name: "کاتالوگ" })).toBeVisible();
  await expect(offlinePage.getByRole("switch", { name: "نمایش محصولات کاتالوگی" })).toBeVisible();

  await offlinePage.goto("/inventory/add");
  await offlinePage.locator('input[name="custom_label"]').fill("Offline CRUD Product");
  await offlinePage.locator('input[name="quantity"]').fill("3");
  await offlinePage.locator('input[name="price"]').fill("250");
  await offlinePage.locator('form button[type="submit"]').click();
  await expect(offlinePage).toHaveURL(/\/inventory\/list/);
  await expect(offlinePage.getByText("Offline CRUD Product").first()).toBeVisible();

  const created = await offlinePage.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const products = await new Promise<Array<{ id: number; custom_label: string; quantity: number }>>((resolve, reject) => {
      const request = database.transaction("inventoryItems").objectStore("inventoryItems").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = products.find((item) => item.custom_label === "Offline CRUD Product");
    const queued = record
      ? await new Promise<{ action: string; payload: { quantity: number } } | undefined>((resolve, reject) => {
          const request = database.transaction("syncQueue").objectStore("syncQueue").get(`9001:product-${record.id}`);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        })
      : undefined;
    database.close();
    return { record, queued };
  });
  expect(created.record?.quantity).toBe(3);
  expect(created.queued).toMatchObject({ action: "CREATE", payload: { quantity: 3 } });
  if (!created.record) throw new Error("Offline-created product was not persisted");
  const createdId = created.record.id;

  await offlinePage.goto(`/inventory/edit?id=${createdId}`);
  await offlinePage.locator('input[name="quantity"]').fill("6");
  await offlinePage.locator('form button[type="submit"]').click();
  await expect(offlinePage).toHaveURL(/\/inventory\/list/);
  await offlinePage.reload();
  await expect(offlinePage.getByText("Offline CRUD Product").first()).toBeVisible();
  expect(await offlinePage.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const queued = await new Promise<Array<{ action: string; entity: string; entityId: number; payload: { quantity: number }; updatedAt: number }>>((resolve, reject) => {
      const request = database.transaction("syncQueue").objectStore("syncQueue").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return queued
      .filter((item) => item.entity === "product" && item.entityId === id)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }, createdId)).toMatchObject({ payload: { quantity: 6 } });

  await offlinePage.goto(`/inventory/edit?id=${createdId}`);
  await offlinePage.getByRole("button", { name: "حذف", exact: true }).click();
  await offlinePage.getByRole("button", { name: "حذف محصول", exact: true }).click();
  await expect(offlinePage).toHaveURL(/\/inventory\/list/);
  await offlinePage.reload();
  await expect(offlinePage.getByText("Offline CRUD Product")).toHaveCount(0);
  expect(await offlinePage.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["inventoryItems", "syncQueue"]);
    const productKey = await new Promise<IDBValidKey | undefined>((resolve, reject) => {
      const request = transaction.objectStore("inventoryItems").getKey(`9001:9001:${id}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const queued = await new Promise<Array<{ action: string; entity: string; entityId: number }>>((resolve, reject) => {
      const request = transaction.objectStore("syncQueue").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      productKey,
      hasDelete: queued.some((item) => item.entity === "product" && item.entityId === id && item.action === "DELETE"),
    };
  }, createdId)).toEqual({ productKey: undefined, hasDelete: true });
});

test("IndexedDB inventory survives a persistent browser-profile restart", async ({ browserName }, testInfo) => {
  expect(browserName).toBe("chromium");
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
        local_key: `${id}:${id}:9102`,
        id: 9102,
        local_user_id: id,
        local_store_id: id,
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
      const request = database.transaction("inventoryItems").objectStore("inventoryItems").getKey("9101:9101:9102");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return stored;
  })).toBe("9101:9101:9102");
  await persistentContext.close();
});

test("two isolated browser profiles keep the same account's local state independent", async ({ browser }) => {
  const userId = 9201;
  const contexts = [await browser.newContext(), await browser.newContext()];

  try {
    const states = await Promise.all(contexts.map(async (context, index) => {
      await context.addInitScript(({ id }) => {
        localStorage.setItem("access_token", JSON.stringify("multi-device-test-token"));
        localStorage.setItem("inventory-last-user", JSON.stringify({
          id,
          first_name: "Device",
          last_name: "User",
          username: "multi-device-user",
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

      const page = await context.newPage();
      await page.goto("/dashboard");
      return page.evaluate(async ({ id, quantity, operationId }) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("inventory-db");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(["inventoryItems", "syncQueue"], "readwrite");
          transaction.objectStore("inventoryItems").put({
            local_key: `${id}:${id}:9202`,
            id: 9202,
            local_user_id: id,
            local_store_id: id,
            catalog_product_id: 9202,
            is_catalog_backed: false,
            category_id: null,
            quantity,
            price: 1,
            custom_label: "Multi-device product",
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
          transaction.objectStore("syncQueue").put({
            id: `${id}:product-9202`,
            ownerUserId: id,
            operationId,
            entity: "product",
            entityId: 9202,
            action: "UPDATE",
            payload: { quantity, version: 1 },
            createdAt: 1,
            updatedAt: 1,
            retryCount: 0,
            status: "pending",
            nextAttemptAt: 0,
          });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });
        const transaction = database.transaction(["inventoryItems", "syncQueue"]);
        const product = await new Promise<{ quantity: number }>((resolve, reject) => {
          const request = transaction.objectStore("inventoryItems").get(`${id}:${id}:9202`);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const queued = await new Promise<{ operationId: string }>((resolve, reject) => {
          const request = transaction.objectStore("syncQueue").get(`${id}:product-9202`);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        database.close();
        return { quantity: product.quantity, operationId: queued.operationId };
      }, {
        id: userId,
        quantity: index === 0 ? 11 : 22,
        operationId: `device-${index + 1}-operation`,
      });
    }));

    expect(states).toEqual([
      { quantity: 11, operationId: "device-1-operation" },
      { quantity: 22, operationId: "device-2-operation" },
    ]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

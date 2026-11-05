import { expect, test, type Route } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const buildA = process.env.E2E_PWA_BUILD_A;
const buildB = process.env.E2E_PWA_BUILD_B;
test.skip(!buildA || !buildB, "E2E_PWA_BUILD_A and E2E_PWA_BUILD_B are required");

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2",
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

test("real two-build update preserves durable work, old tabs, and offline bytes", async ({ context }) => {
  test.setTimeout(90_000);
  let root = path.resolve(buildA!);
  let failOneAsset = false;
  const serverErrors: string[] = [];
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      let file = path.resolve(root, relative || "index.html");
      if (!file.startsWith(`${root}${path.sep}`) && file !== path.join(root, "index.html")) {
        response.writeHead(403).end(); return;
      }
      try { if (!(await stat(file)).isFile()) file = path.join(root, "index.html"); }
      catch { file = path.join(root, "index.html"); }
      if (failOneAsset && relative.startsWith("assets/")) {
        failOneAsset = false;
        response.writeHead(503, { "cache-control": "no-store" }).end("interrupted update");
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": types[path.extname(file)] ?? "application/octet-stream",
        "cache-control": relative === "sw.js" ? "no-cache, no-store, must-revalidate" : "no-cache",
      });
      response.end(body);
    } catch (error) {
      serverErrors.push(`${request.url}: ${String(error)}`);
      response.writeHead(500).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(43125, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  const origin = `http://127.0.0.1:${address.port}`;
  const user = {
    id: 7001, username: "update-owner", first_name: "مالک", last_name: "آزمایش",
    email: null, phone: "09120007001", industry_id: 1, plan: "free", is_active: true,
    is_admin: false, is_system_admin: false, role: "USER", is_store_owner: true,
    store_id: 7101, membership_id: 7201, store_operating_mode: "solo", store_policy_version: 1,
    subscription_started_at: null, subscription_expires_at: null, created_at: "2026-11-04T00:00:00Z",
  };

  await context.addInitScript(({ value }) => {
    localStorage.setItem("access_token", JSON.stringify("update-test-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(value));
    localStorage.setItem("pwa-update-load-count", String(Number(localStorage.getItem("pwa-update-load-count") ?? "0") + 1));
  }, { value: user });
  await context.route("http://localhost:8000/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return json(route, user);
    if (url.pathname.includes("entitlement")) return json(route, {
      user_id: user.id, store_id: user.store_id, plan: "free", label: "Free", status: "active",
      account_status: "active", started_at: null, expires_at: null, server_time: new Date().toISOString(),
      synced_at: new Date().toISOString(), capabilities: { "inventory.read": true, "inventory.write": true },
      limits: { inventory_items: null },
    });
    return route.abort();
  });

  try {
    const page = await context.newPage();
    const startupErrors: string[] = [];
    page.on("pageerror", (error) => startupErrors.push(error.stack ?? error.message));
    page.on("console", (message) => { if (message.type() === "error") startupErrors.push(message.text()); });
    await page.goto(`${origin}/setting/update`);
    await page.waitForTimeout(500);
    if (!(await page.getByRole("heading", { name: "بروزرسانی برنامه" }).count())) {
      throw new Error(`startup failed at ${page.url()}: ${startupErrors.join(" | ")} server=${serverErrors.join(" | ")} body=${(await page.locator("body").innerText()).slice(0, 500)}`);
    }
    await expect(page.getByRole("heading", { name: "بروزرسانی برنامه" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      return Boolean(navigator.serviceWorker.controller);
    })).toBe(true);
    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("inventory-db");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(["inventoryItems", "syncQueue", "invoices"], "readwrite");
        transaction.objectStore("inventoryItems").put({
          local_key: "7001:7101:501", id: 501, local_user_id: 7001, local_store_id: 7101,
          custom_label: "کالای حفظ‌شده", quantity: 2, price: 100, sale_price: 100,
          purchase_price: null, price_missing: false, image_url: "pwa-update/image.webp",
          updated_at: "2026-11-04T00:00:00Z",
        });
        transaction.objectStore("syncQueue").put({
          id: "durable-queue", ownerUserId: 7001, storeId: 7101, operationId: "durable-operation-id",
          resourceKey: "product:501", attemptState: "attempted", entity: "product", entityId: 501,
          action: "UPDATE", payload: { quantity: 2 }, status: "in_flight", retryCount: 0,
          nextAttemptAt: 0, createdAt: 1, updatedAt: 2, executionMode: "solo", policyVersion: 1,
        });
        transaction.objectStore("invoices").put({
          local_key: "7001:7101:invoice-501", local_user_id: 7001, local_store_id: 7101,
          id: "invoice-501", invoice_type: "sale", title: "سند حفظ‌شده", counterparty: null,
          status: "pending", total_amount: 200, actor_user_id: 7001, actor_membership_id: 7201,
          post_operation_id: "durable-invoice-operation", posted_at: "2026-11-04T00:00:00Z",
          lines: [{ product_id: 501, product_name: "کالای حفظ‌شده", quantity: 2, unit: "عدد",
            pack_size: null, base_quantity: 2, unit_price: 100, line_total: 200,
            before_quantity: 4, after_quantity: 2 }],
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      const root = await navigator.storage.getDirectory();
      const folder = await root.getDirectoryHandle("pwa-update", { create: true });
      const handle = await folder.getFileHandle("image.webp", { create: true });
      const writable = await handle.createWritable();
      await writable.write(new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]));
      await writable.close();
    });

    const oldTab = await context.newPage();
    await oldTab.goto(`${origin}/dashboard`);
    await expect(oldTab.locator("main").first()).toBeVisible();

    root = path.resolve(buildB!);
    failOneAsset = true;
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.installing?.state ?? "none"), { timeout: 15_000 }).toBe("none");
    expect(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
    await expect(page.getByRole("heading", { name: "بروزرسانی برنامه" })).toBeVisible();

    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? "none"), { timeout: 20_000 }).toBe("installed");
    await expect(page.getByRole("button", { name: "نصب نسخه جدید" })).toBeVisible();

    await oldTab.evaluate(() => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      Object.assign(window, { __releaseUpdateWrite: release });
      void navigator.locks.request("tanzim-local-mutations:7001", async () => gate);
    });
    await page.getByRole("button", { name: "نصب نسخه جدید" }).click();
    await expect(page.getByText("نصب تا رفع مانع به تعویق افتاده است")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const beforeActivationLoads = await page.evaluate(() => Number(localStorage.getItem("pwa-update-load-count")));
    await oldTab.evaluate(() => (window as unknown as { __releaseUpdateWrite(): void }).__releaseUpdateWrite());
    await expect.poll(() => oldTab.evaluate(async () => {
      const state = await navigator.locks.query();
      const coordinated = new Set(["tanzim-app-update-activation", "tanzim-outbox-sync", "tanzim-local-mutations:7001"]);
      return state.held?.filter((lock) => lock.name && coordinated.has(lock.name)).map((lock) => lock.name) ?? [];
    }), { timeout: 20_000 }).toEqual([]);

    await page.evaluate(() => {
      const locks = navigator.locks as LockManager & { request: LockManager["request"] };
      const request = locks.request.bind(locks);
      const trace: Array<{ name: string; acquired: boolean }> = [];
      Object.assign(window, { __updateLockTrace: trace });
      locks.request = ((name: string, options: LockOptions, callback: (lock: Lock | null) => unknown) =>
        request(name, options, (lock) => {
          trace.push({ name, acquired: Boolean(lock) });
          return callback(lock);
        })) as LockManager["request"];
    });
    await page.getByRole("button", { name: "تلاش دوباره برای نصب" }).click();
    await page.waitForTimeout(1_000);
    if (await page.getByText("نصب تا رفع مانع به تعویق افتاده است").count()) {
      const trace = await page.evaluate(() => (window as unknown as { __updateLockTrace: unknown }).__updateLockTrace);
      const workerState = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return { waiting: registration?.waiting?.state ?? null, active: registration?.active?.state ?? null, controller: Boolean(navigator.serviceWorker.controller) };
      });
      throw new Error(`activation did not advance: errors=${JSON.stringify(startupErrors)} locks=${JSON.stringify(trace)} worker=${JSON.stringify(workerState)}`);
    }
    await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("pwa-update-load-count"))), { timeout: 20_000 }).toBe(beforeActivationLoads + 1);
    await expect(page.getByRole("heading", { name: "بروزرسانی برنامه" })).toBeVisible();
    expect(await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("inventory-db"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const value = await new Promise<unknown>((resolve, reject) => {
        const request = database.transaction("syncQueue").objectStore("syncQueue").get("durable-queue");
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const invoice = await new Promise<unknown>((resolve, reject) => {
        const request = database.transaction("invoices").objectStore("invoices").get("7001:7101:invoice-501");
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      database.close(); return { value, invoice };
    })).toMatchObject({
      value: { operationId: "durable-operation-id", payload: { quantity: 2 }, attemptState: "attempted" },
      invoice: { status: "pending", post_operation_id: "durable-invoice-operation", lines: [{ product_name: "کالای حفظ‌شده" }] },
    });

    await oldTab.getByRole("link", { name: /تنظیمات/ }).first().click();
    await expect(oldTab).toHaveURL(/\/setting/);
    await expect(oldTab.locator("main").first()).toBeVisible();
    expect(await oldTab.evaluate(() => Number(localStorage.getItem("pwa-update-load-count")))).toBe(beforeActivationLoads + 1);

    await oldTab.close();
    await page.close();
    await context.setOffline(true);
    const offline = await context.newPage();
    await offline.goto(`${origin}/inventory/list`);
    await expect(offline.locator("main").first()).toBeVisible();
    const preserved = await offline.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("inventory-db"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const operation = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = database.transaction("syncQueue").objectStore("syncQueue").get("durable-queue");
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      const invoice = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const request = database.transaction("invoices").objectStore("invoices").get("7001:7101:invoice-501");
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      database.close();
      const root = await navigator.storage.getDirectory();
      const file = await (await (await root.getDirectoryHandle("pwa-update")).getFileHandle("image.webp")).getFile();
      return { operation, invoice, bytes: [...new Uint8Array(await file.arrayBuffer())] };
    });
    expect(preserved.operation).toMatchObject({ operationId: "durable-operation-id", attemptState: "attempted" });
    expect(preserved.invoice).toMatchObject({ status: "pending", post_operation_id: "durable-invoice-operation" });
    expect(preserved.bytes).toEqual([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  } finally {
    await context.setOffline(false);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

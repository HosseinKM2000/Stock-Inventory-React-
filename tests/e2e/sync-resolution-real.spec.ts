import { expect, test } from "@playwright/test";
import crypto from "node:crypto";

const api = process.env.E2E_REAL_API_URL;
test.skip(!api, "E2E_REAL_API_URL is required for the live operation-resolution journey");

test("authorized read-only resolution finds a committed result without replaying the command", async ({ request, browser, baseURL }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const phoneDigits = BigInt(`0x${crypto.createHash("sha256").update(suffix).digest("hex").slice(0, 12)}`) % 1_000_000_000n;
  const adminDevice = `resolution-admin-${suffix}`;
  const adminLogin = await request.post(`${api}/auth/login`, { data: {
    username: "HosseinKM2000",
    password: "Test-only-system-admin-password-123!",
    device_fingerprint: adminDevice,
  } });
  expect(adminLogin.ok()).toBeTruthy();
  const admin = await adminLogin.json();
  const industry = await request.post(`${api}/industries`, {
    headers: {
      Authorization: `Bearer ${admin.access_token}`,
      "X-Device-Fingerprint": adminDevice,
    },
    data: { name: `Resolution E2E ${suffix}`, description: "disposable resolution journey", tools: {} },
  });
  expect(industry.ok()).toBeTruthy();

  const device = `resolution-owner-${suffix}`;
  const signup = await request.post(`${api}/auth/signup`, { data: {
    username: `resolution-owner-${suffix}`,
    password: "StrongPass123!",
    device_fingerprint: device,
    phone: `09${phoneDigits.toString().padStart(9, "0")}`,
  } });
  expect(signup.status()).toBe(201);
  const session = await signup.json();
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    "X-Device-Fingerprint": device,
    "X-Client-Data-Schema": "3",
  };
  const selected = await request.patch(`${api}/auth/industry`, {
    headers,
    data: { industry_id: (await industry.json()).id },
  });
  expect(selected.ok()).toBeTruthy();
  const user = await selected.json();

  const productId = Date.now() * 1000;
  const operationId = crypto.randomUUID();
  const payload = {
    quantity: 6,
    sale_price: 300,
    custom_label: "Resolution E2E product",
    low_stock_threshold: 0,
    low_stock_alert: false,
    is_hidden: false,
    catalog_product: { id: 0, name: "Resolution E2E product" },
  };
  const accepted = await request.post(`${api}/sync/batch`, {
    headers,
    multipart: { operations_json: JSON.stringify({ operations: [{
      operation_id: operationId,
      entity: "product",
      entity_id: productId,
      operation: "CREATE",
      payload,
    }] }) },
  });
  expect(accepted.ok()).toBeTruthy();
  expect((await accepted.json()).results[0].status).toBe("applied");

  // This journey verifies the application/API resolution boundary, not the
  // service-worker controller lifecycle (covered by pwa-update-real.spec.ts).
  // Blocking registration keeps the document stable while the test seeds the
  // already-initialized Dexie queue.
  const context = await browser.newContext({ serviceWorkers: "block" });
  let resolutionRequests = 0;
  let batchRequests = 0;
  await context.route("http://localhost:8000/api/**", async (route) => {
    const source = new URL(route.request().url());
    if (source.pathname.startsWith("/api/sync/operations/")) resolutionRequests += 1;
    if (source.pathname === "/api/sync/batch") batchRequests += 1;
    const response = await route.fetch({
      url: `${api}${source.pathname.replace(/^\/api/, "")}${source.search}`,
    });
    await route.fulfill({ response });
  });
  await context.addInitScript(({ token, activeUser, fingerprint }) => {
    localStorage.setItem("access_token", JSON.stringify(token));
    localStorage.setItem("inventory-last-user", JSON.stringify(activeUser));
    localStorage.setItem("inventory_device_fingerprint", fingerprint);
  }, { token: session.access_token, activeUser: user, fingerprint: device });

  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}/setting/sync`);
    await expect(page).toHaveURL(/\/setting\/sync$/);
    await expect(page.locator("main")).toBeVisible();
    await page.evaluate(async ({ activeUser, id, opId, productPayload }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open("inventory-db");
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("syncQueue", "readwrite");
        transaction.objectStore("syncQueue").put({
          id: `${activeUser.id}:product-${id}`,
          ownerUserId: activeUser.id,
          storeId: activeUser.store_id,
          operationId: opId,
          resourceKey: `product:${id}`,
          attemptState: "uncertain",
          attemptedAt: Date.now() - 10_000,
          entity: "product",
          entityId: id,
          action: "CREATE",
          payload: productPayload,
          status: "fatal_error",
          retryCount: 1,
          nextAttemptAt: Number.MAX_SAFE_INTEGER,
          createdAt: Date.now() - 20_000,
          updatedAt: Date.now(),
          lastError: "SYNC_OUTCOME_UNRESOLVED_ACCESS_DENIED:STORE_MEMBERSHIP_INACTIVE",
          executionMode: "solo",
          policyVersion: activeUser.store_policy_version,
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }, { activeUser: user, id: productId, opId: operationId, productPayload: payload });
    await page.reload();

    const resolveButton = page.getByRole("button", { name: "بررسی نتیجه با همان شناسه" });
    await expect(resolveButton).toBeVisible();
    await resolveButton.click();
    await expect(page.getByText("تغییر منتظری وجود ندارد.")).toBeVisible();
    expect(resolutionRequests).toBe(1);
    expect(batchRequests).toBe(0);

    const product = await request.get(`${api}/products/${productId}`, { headers });
    expect(product.ok()).toBeTruthy();
    expect((await product.json()).quantity).toBe(6);
  } finally {
    await context.close();
  }
});

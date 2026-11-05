import { expect, test } from "@playwright/test";
import crypto from "node:crypto";

const api = process.env.E2E_REAL_API_URL;
test.skip(!api, "E2E_REAL_API_URL is required for the live disposable-backend journey");

const webp = Buffer.from(
  "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==",
  "base64",
);

test("live upload, fresh-profile hydration, and offline OPFS reopen render", async ({ request, browser, baseURL }) => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const phoneDigits = BigInt(`0x${crypto.createHash("sha256").update(suffix).digest("hex").slice(0, 12)}`) % 1_000_000_000n;
  const adminLogin = await request.post(`${api}/auth/login`, { data: {
    username: "HosseinKM2000", password: "Test-only-system-admin-password-123!",
    device_fingerprint: `media-admin-${suffix}`,
  } });
  expect(adminLogin.ok()).toBeTruthy();
  const admin = await adminLogin.json();
  const adminHeaders = {
    Authorization: `Bearer ${admin.access_token}`,
    "X-Device-Fingerprint": `media-admin-${suffix}`,
  };
  const industryResponse = await request.post(`${api}/industries`, {
    headers: adminHeaders,
    data: { name: `Media E2E ${suffix}`, description: "disposable media journey", tools: {} },
  });
  expect(industryResponse.ok()).toBeTruthy();
  const industry = await industryResponse.json();

  const device = `media-owner-${suffix}`;
  const signup = await request.post(`${api}/auth/signup`, { data: {
    username: `media-owner-${suffix}`, password: "StrongPass123!", device_fingerprint: device,
    phone: `09${phoneDigits.toString().padStart(9, "0")}`,
  } });
  expect(signup.status()).toBe(201);
  const session = await signup.json();
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    "X-Device-Fingerprint": device,
    "X-Client-Data-Schema": "3",
  };
  const selected = await request.patch(`${api}/auth/industry`, { headers, data: { industry_id: industry.id } });
  expect(selected.ok()).toBeTruthy();
  const activeUser = await selected.json();

  const transferId = crypto.randomUUID();
  const digest = crypto.createHash("sha256").update(webp).digest("hex");
  const transferred = await request.post(`${api}/media/transfers`, {
    headers,
    multipart: {
      transfer_id: transferId,
      content_sha256: digest,
      file: { name: "product.webp", mimeType: "image/webp", buffer: webp },
    },
  });
  expect(transferred.ok()).toBeTruthy();
  const asset = await transferred.json();
  const productId = Date.now() * 1000;
  const operation = {
    operation_id: crypto.randomUUID(), entity: "product", entity_id: productId, operation: "CREATE",
    payload: {
      quantity: 1, sale_price: 1200, custom_label: "تصویر پایدار",
      low_stock_threshold: 0, low_stock_alert: false, is_hidden: false,
      media_asset_id: asset.id,
      catalog_product: { id: 0, name: "تصویر پایدار" },
    },
  };
  const accepted = await request.post(`${api}/sync/batch`, {
    headers,
    multipart: { operations_json: JSON.stringify({ operations: [operation] }) },
  });
  expect(accepted.ok()).toBeTruthy();
  const record = (await accepted.json()).results[0].record;
  expect(record.media_content_sha256).toBe(digest);

  const context = await browser.newContext();
  await context.route(`${api}/media/**`, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  await context.route(`${baseURL}/__media-e2e`, (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><html lang='fa' dir='rtl'><body>media e2e</body></html>",
  }));
  await context.addInitScript(({ token, user, fingerprint }) => {
    localStorage.setItem("access_token", JSON.stringify(token));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem("device_fingerprint", JSON.stringify(fingerprint));
  }, { token: session.access_token, user: activeUser, fingerprint: device });
  const page = await context.newPage();
  await page.goto(`${baseURL}/__media-e2e`);
  const hydrated = await page.evaluate(async ({ apiUrl, token, deviceFingerprint, detailUrl, expectedHash, assetId, version, serverRecord, userId, storeId }) => {
    const response = await fetch(`${apiUrl}${detailUrl.replace(/^\/api/, "")}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Device-Fingerprint": deviceFingerprint },
    });
    if (!response.ok) throw new Error(`download failed ${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
      .map((value) => value.toString(16).padStart(2, "0")).join("");
    if (hash !== expectedHash) throw new Error("hash mismatch");
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle("inventory-images", { create: true });
    const name = `media-${assetId}-v${version}.webp`;
    const handle = await directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("inventory-db", 14);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("inventoryItems")) {
          request.result.createObjectStore("inventoryItems", { keyPath: "local_key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("inventoryItems", "readwrite");
      transaction.objectStore("inventoryItems").put({
        ...serverRecord,
        image_url: `local://${name}`,
        server_image_url: detailUrl,
        local_user_id: userId,
        local_store_id: storeId,
        local_key: `${userId}:${storeId}:${serverRecord.id}`,
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return { name, size: blob.size, type: blob.type };
  }, {
    apiUrl: api!, token: session.access_token, deviceFingerprint: device,
    detailUrl: record.media_detail_url, expectedHash: digest,
    assetId: asset.id, version: asset.version, serverRecord: record,
    userId: activeUser.id, storeId: activeUser.store_id,
  });
  expect(hydrated).toEqual({ name: `media-${asset.id}-v1.webp`, size: webp.length, type: "image/webp" });

  const reopened = await context.newPage();
  await reopened.goto(`${baseURL}/__media-e2e`);
  await page.close();
  await context.setOffline(true);
  const rendered = await reopened.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle("inventory-images");
    const file = await (await directory.getFileHandle(name)).getFile();
    const url = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.id = "offline-product";
    image.alt = "تصویر پایدار";
    document.body.replaceChildren(image);
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, size: file.size };
  }, hydrated.name);
  expect(rendered).toEqual({ width: 1, height: 1, size: webp.length });
  await context.close();
});

import { expect, test } from "@playwright/test";

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
  expect(source).toContain("Promise.allSettled");
  expect(source).toContain("precacheApplication().then(() => self.skipWaiting())");
});

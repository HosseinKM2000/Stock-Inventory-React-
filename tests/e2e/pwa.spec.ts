import { expect, test } from "@playwright/test";

test("PWA manifest and service worker are served", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ display: "standalone", start_url: "/dashboard" });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: "192x192" }),
    expect.objectContaining({ sizes: "512x512" }),
  ]));

  const worker = await request.get("/sw.js");
  expect(worker.ok()).toBe(true);
  const source = await worker.text();
  expect(source).toContain("inventory-sync");
  expect(source).toContain("Promise.allSettled");
  expect(source).toContain("precacheApplication().then(() => self.skipWaiting())");
});

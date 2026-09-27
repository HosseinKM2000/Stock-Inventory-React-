import { expect, test } from "@playwright/test";

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

test("public application shell has no horizontal overflow across supported widths", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/auth/login");

    for (const direction of ["rtl", "ltr"] as const) {
      await page.locator("html").evaluate((element, dir) => { element.setAttribute("dir", dir); }, direction);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `${viewport.width}px ${direction}`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

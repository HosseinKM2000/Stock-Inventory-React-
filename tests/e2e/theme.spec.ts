import { expect, test } from "@playwright/test";

test("saved dark appearance is applied before the application renders", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("inventory-appearance", "dark"));
  await page.goto("/auth/login");

  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(23, 19, 38)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#171326");
});

test("system appearance follows the browser color scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("inventory-appearance", "system"));
  await page.goto("/auth/login");
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "light");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(255, 255, 255)");
});

test("all display sizes are applied before render in light and dark themes", async ({ page }) => {
  for (const appearance of ["light", "dark"] as const) {
    for (const size of ["compact", "normal", "large"] as const) {
      await page.goto("/auth/login");
      await page.evaluate(({ appearance, size }) => {
        localStorage.setItem("inventory-appearance", appearance);
        localStorage.setItem("inventory-display-size", size);
      }, { appearance, size });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-appearance", appearance);
      await expect(page.locator("html")).toHaveAttribute("data-display-size", size);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `${appearance}/${size}`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

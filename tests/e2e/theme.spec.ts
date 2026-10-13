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

import { expect, test } from "@playwright/test";

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

test.describe("authenticated browser journey", () => {
  test.skip(!username || !password, "E2E_USERNAME and E2E_PASSWORD must identify an isolated test user");
  test.skip(({ isMobile }) => Boolean(isMobile), "logout control is in the desktop settings navigation");

  test("login grants protected access and logout revokes it", async ({ page }) => {
    await page.goto("/auth/login");
    await page.locator('input[name="username"]').fill(username!);
    await page.locator('input[name="password"]').fill(password!);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/(dashboard|industry|inventory)/);
    await expect(page.locator("main")).toBeVisible();

    await page.goto("/setting/appearance");
    await page.getByRole("button", { name: /خروج|ط®ط±ظˆط¬/ }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await page.goto("/inventory/list");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

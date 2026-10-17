import { expect, test, type Page } from "@playwright/test";

async function seedAuthenticatedUser(page: Page) {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const user = {
      id: 7201,
      first_name: "Backup",
      last_name: "Tester",
      username: "backup-user",
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
    };
    localStorage.setItem("access_token", JSON.stringify("backup-test-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}`, JSON.stringify({
      user_id: user.id,
      plan: "pro",
      label: "Pro",
      status: "active",
      account_status: "active",
      expires_at: "2099-01-01T00:00:00.000Z",
      server_time: now,
      synced_at: now,
      verified_at: now,
      captured_at_ms: Date.now(),
      last_observed_at_ms: Date.now(),
      capabilities: { "inventory.read": true, "inventory.write": true },
      limits: { inventory_items: null },
    }));
  });
  await page.route("http://localhost:8000/api/**", (route) => route.abort());
}

test("backup shortcut and settings remain usable on desktop and narrow screens", async ({ page }) => {
  await seedAuthenticatedUser(page);
  await page.goto("/dashboard");

  const backupButton = page.locator(".app-header-left").getByRole("button", { name: /فایل پشتیبان/ });
  const notificationButton = page.locator(".app-header-left").getByRole("button", { name: /اعلان|هشدار/ });
  await expect(backupButton).toBeVisible();
  await expect(notificationButton).toBeVisible();
  expect((await backupButton.boundingBox())!.x).toBeLessThan((await notificationButton.boundingBox())!.x);

  await backupButton.click();
  await expect(page.getByText(/برای اطمینان بیشتر/)).toBeVisible();
  await expect(page.getByRole("button", { name: "ذخیره فایل پشتیبان" })).toBeVisible();

  await page.goto("/setting");
  await expect(page.getByRole("link", { name: /فایل پشتیبان محلی/ })).toHaveAttribute("href", "/setting/backup");
  await page.goto("/setting/backup");
  await expect(page.getByRole("heading", { name: "فایل پشتیبان محلی", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "مقصد ذخیره" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "زمان‌بندی" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "بازیابی" })).toBeVisible();

  for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${viewport.width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

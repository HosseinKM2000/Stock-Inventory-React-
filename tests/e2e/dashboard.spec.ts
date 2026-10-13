import { expect, test, type Page } from "@playwright/test";

async function seedAuthenticatedUser(page: Page) {
  await page.addInitScript(() => {
    const now = new Date().toISOString();
    const user = {
      id: 7201, first_name: "Dashboard", last_name: "Tester",
      username: "dashboard-tester", email: null, phone: null,
      industry_id: 1, plan: "pro", is_active: true, is_admin: false,
      role: "USER", is_system_admin: false,
      subscription_started_at: now,
      subscription_expires_at: "2099-01-01T00:00:00.000Z",
      created_at: now,
    };
    localStorage.setItem("access_token", JSON.stringify("dashboard-test-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}`, JSON.stringify({
      user_id: user.id, plan: "pro", label: "Pro", status: "active",
      account_status: "active", started_at: now, expires_at: "2099-01-01T00:00:00.000Z",
      server_time: now, synced_at: now, verified_at: now,
      captured_at_ms: Date.now(), last_observed_at_ms: Date.now(),
      capabilities: { "inventory.read": true, "inventory.write": true, "categories.write": true },
      limits: { inventory_items: null },
    }));
  });
  await page.route("http://localhost:8000/api/**", (route) => route.abort());
}

const orderedLabels = [
  "مجموع کالاها", "عدم موجودی", "کمبود موجودی", "نیاز به خرید",
  "بدون قیمت", "اقدام‌های امروز", "محصولات بدون دسته یا برچسب",
  "بدون تصویر", "ارزشمندترین‌ها", "ارزش موجودی",
  "محصولات افزوده‌شده امروز", "محصولات مخفی",
];

test("dashboard order is identical at mobile and desktop widths", async ({ page }) => {
  await seedAuthenticatedUser(page);
  for (const viewport of [{ width: 390, height: 640 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/dashboard");
    const cards = page.locator("[id^='dashboard-section-']");
    await expect(cards).toHaveCount(orderedLabels.length);
    for (let index = 0; index < orderedLabels.length; index += 1) {
      await expect(cards.nth(index)).toContainText(orderedLabels[index]);
    }
  }
});

test("dashboard restores scroll after browser back and in-app return", async ({ page }) => {
  await seedAuthenticatedUser(page);
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/dashboard");
  const shell = page.locator("[data-scroll-restoration-id='app-shell']");

  await shell.hover();
  await page.mouse.wheel(0, 10_000);
  await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
  await page.locator("#dashboard-section-highest-value").click();
  await expect(page).toHaveURL(/\/dashboard\/products\/highest-value/);
  await page.goBack();
  await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);

  await page.locator("#dashboard-section-hidden").click();
  await page.getByRole("navigation", { name: "ناوبری اصلی" }).getByRole("link", { name: "داشبورد" }).click();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect.poll(() => shell.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
});

test("highest-value mode switching remains available offline", async ({ page, context }) => {
  await seedAuthenticatedUser(page);
  await page.goto("/dashboard/products/highest-value");
  const select = page.getByRole("combobox", { name: "نوع رتبه‌بندی ارزش موجودی" });
  await expect(select).toBeVisible();
  await expect(page.getByText("موردی با ارزش موجودی مثبت یافت نشد.")).toBeVisible();
  await context.setOffline(true);
  await select.click();
  await page.getByRole("option", { name: "دسته‌بندی‌ها" }).click();
  await expect(select).toContainText("دسته‌بندی‌ها");
});

import { expect, test, type Page } from "@playwright/test";

async function seedOfflineUser(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    const now = new Date().toISOString();
    const user = {
      id: 7111,
      first_name: "Product",
      last_name: "Layout",
      username: "product-layout",
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
    localStorage.setItem("access_token", JSON.stringify("product-layout-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}`, JSON.stringify({
      user_id: user.id,
      plan: "pro",
      label: "Pro",
      status: "active",
      account_status: "active",
      started_at: now,
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

test("product filters use one responsive panel on the physical right", async ({ page }) => {
  await seedOfflineUser(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/inventory/list");

  const panel = page.locator(".inventory-filter-panel");
  const sidebar = page.locator(".inventory-filter-sidebar");
  const results = page.locator(".inventory-list-results");
  await expect(panel).toHaveCount(1);
  expect((await sidebar.boundingBox())!.x).toBeGreaterThan((await results.boundingBox())!.x);

  const labels = ["جستجو", "دسته‌بندی‌ها", "مرتب‌سازی", "برچسب‌ها", "مخفی کردن کاتالوگ"];
  const positions = await Promise.all(labels.map(async (label) => (await panel.getByText(label, { exact: true }).first().boundingBox())!.y));
  expect(positions).toEqual([...positions].sort((a, b) => a - b));

  const search = page.getByRole("textbox", { name: "جستجوی محصول" });
  await search.fill("چای سبز");
  await page.setViewportSize({ width: 390, height: 700 });
  await expect(panel).toHaveCount(1);
  await expect(search).toHaveValue("چای سبز");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("product form order, mode accent, and fixed-navigation clearance remain visible", async ({ page }) => {
  await seedOfflineUser(page);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/inventory/add");

  const form = page.locator(".product-form");
  await expect(form).toHaveAttribute("data-mode", "create");
  await expect(page.getByText("افزودن محصول", { exact: true })).toBeVisible();
  const createAccent = await form.evaluate((element) => getComputedStyle(element).getPropertyValue("--product-form-accent").trim());
  expect(createAccent).toBe("#6e56cf");

  const ordered = [
    page.getByText("نام محصول", { exact: true }).first(),
    page.getByText("قیمت (تومان)", { exact: true }).first(),
    page.getByText("یادداشت", { exact: true }).first(),
    page.getByText("دسته‌بندی", { exact: true }).first(),
    page.getByText("برچسب‌ها", { exact: true }).first(),
    page.getByText("پیکربندی محصول", { exact: true }).first(),
  ];
  const offsets = await Promise.all(ordered.map((locator) => locator.evaluate((element) => element.getBoundingClientRect().top + window.scrollY)));
  expect(offsets).toEqual([...offsets].sort((a, b) => a - b));

  const main = page.locator("main[data-scroll-restoration-id='app-shell']");
  await main.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const submitBox = await page.getByRole("button", { name: "افزودن", exact: true }).boundingBox();
  const navigationBox = await page.getByRole("navigation", { name: "ناوبری اصلی" }).boundingBox();
  expect(submitBox!.y + submitBox!.height).toBeLessThanOrEqual(navigationBox!.y);

  const addButton = await page.getByRole("link", { name: "افزودن محصول" }).locator("span").boundingBox();
  expect(addButton!.width).toBeGreaterThanOrEqual(70);
  expect(addButton!.height).toBeGreaterThanOrEqual(70);
});

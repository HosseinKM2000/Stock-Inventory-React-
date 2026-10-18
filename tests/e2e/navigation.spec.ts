import { expect, test, type Page } from "@playwright/test";

type Role = "USER" | "ADMIN";

async function seedAuthenticatedUser(page: Page, role: Role) {
  await page.addInitScript(({ seededRole }) => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false });
    const now = new Date().toISOString();
    const user = {
      id: seededRole === "ADMIN" ? 7102 : 7101,
      first_name: "Navigation",
      last_name: "Tester",
      username: `navigation-${seededRole.toLowerCase()}`,
      email: null,
      phone: null,
      industry_id: 1,
      plan: "pro",
      is_active: true,
      is_admin: seededRole === "ADMIN",
      role: seededRole,
      is_system_admin: false,
      subscription_started_at: now,
      subscription_expires_at: "2099-01-01T00:00:00.000Z",
      created_at: now,
    };
    localStorage.setItem("access_token", JSON.stringify("navigation-test-token"));
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
      capabilities: {
        "inventory.read": true,
        "inventory.write": true,
        "categories.write": true,
        "labels.write": true,
        "import.xlsx": true,
        "export.local": true,
        "export.server": true,
      },
      limits: { inventory_items: null },
    }));
  }, { seededRole: role });
  await page.route("http://localhost:8000/api/**", (route) => route.abort());
}

test("standard navigation separates Settings and Tools with contextual back behavior", async ({ page }) => {
  await seedAuthenticatedUser(page, "USER");
  await page.goto("/dashboard");

  const header = page.locator(".app-header");
  const leftControls = header.locator(".app-header-left");
  const rightControls = header.locator(".app-header-right");
  const backupShortcut = leftControls.getByRole("button", { name: /فایل پشتیبان/ });
  const notificationShortcut = rightControls.getByRole("button", { name: /اعلان‌ها|هشدار فعال/ });
  await expect(leftControls.getByRole("link", { name: "تنظیمات" })).toHaveCount(0);
  await expect(backupShortcut).toBeVisible();
  await expect(notificationShortcut).toBeVisible();
  await expect(leftControls.locator(".sync-status-badge")).toBeVisible();
  await expect(leftControls.getByRole("button", { name: /اعلان‌ها|هشدار فعال/ })).toHaveCount(0);
  await expect(rightControls.locator(".sync-status-badge")).toHaveCount(0);
  expect((await leftControls.boundingBox())!.x).toBeLessThan((await rightControls.boundingBox())!.x);
  await expect(page.getByRole("button", { name: "بازگشت" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /منو/ })).toHaveCount(0);

  const bottomNavigation = page.getByRole("navigation", { name: "ناوبری اصلی" });
  await expect(bottomNavigation.getByRole("link", { name: "ابزارها" })).toBeVisible();
  await expect(bottomNavigation.getByRole("link", { name: "مدیریت" })).toHaveCount(0);
  await expect(bottomNavigation.getByRole("link", { name: "تنظیمات" })).toBeVisible();
  await expect(bottomNavigation.getByRole("link", { name: "افزودن محصول" })).toBeVisible();

  await bottomNavigation.getByRole("link", { name: "تنظیمات" }).click();
  await expect(page).toHaveURL(/\/setting\/?$/);
  await expect(page.getByRole("heading", { name: "تنظیمات" })).toBeVisible();
  await expect(page.getByRole("link", { name: /پروفایل/ })).toHaveAttribute("href", "/setting/profile");
  await expect(page.getByRole("link", { name: /اشتراک/ })).toHaveAttribute("href", "/setting/subscription");
  await expect(page.getByRole("button", { name: "بازگشت" })).toBeVisible();

  await page.goto("/tools");
  await expect(page.getByRole("heading", { name: "ابزارها" })).toBeVisible();
  await expect(page.getByRole("link", { name: /دسته‌ها/ })).toHaveAttribute("href", "/tools/categories");
  await expect(page.getByRole("link", { name: /بازیابی/ })).toHaveAttribute("href", "/tools/recovery");
  await expect(page.getByRole("button", { name: "بازگشت" })).toBeVisible();

  await page.goto("/setting/categories");
  await expect(page).toHaveURL(/\/tools\/categories$/);
  await page.goto("/management");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("contextual back uses safe fallbacks for direct descendants and access pages", async ({ page }) => {
  await seedAuthenticatedUser(page, "USER");
  await page.goto("/tools/catalog");
  await page.getByRole("button", { name: "بازگشت" }).click();
  await expect(page).toHaveURL(/\/tools\/?$/);

  await page.reload();
  await page.getByRole("button", { name: "بازگشت" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("administrators receive a fixed Management shortcut above the menu without contextual back controls", async ({ page }) => {
  await seedAuthenticatedUser(page, "ADMIN");
  await page.goto("/dashboard");
  const navigation = page.getByRole("navigation", { name: "ناوبری اصلی" });
  const managementShortcut = navigation.getByRole("link", { name: "مدیریت" });
  await expect(managementShortcut).toBeVisible();
  await expect(managementShortcut).toHaveClass(/app-admin-shortcut/);
  await expect(page.locator(".app-header").getByRole("link", { name: "مدیریت" })).toHaveCount(0);

  const shortcutBox = await managementShortcut.boundingBox();
  const navigationBox = await navigation.boundingBox();
  expect(shortcutBox!.y + shortcutBox!.height).toBeLessThanOrEqual(navigationBox!.y + 1);

  await page.goto("/management");
  await expect(page.getByRole("heading", { name: "مدیریت" })).toBeVisible();
  await expect(page.getByRole("button", { name: "بازگشت" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /مدیریت اشتراک‌ها/ })).toHaveAttribute(
    "href",
    "/management/subscriptions",
  );
  await expect(page.getByRole("link", { name: /کاربران/ })).toHaveAttribute("href", "/management/users");
});

test("application navigation has no horizontal overflow at narrow and desktop widths", async ({ page }) => {
  await seedAuthenticatedUser(page, "ADMIN");
  for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/management");
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth, `${viewport.width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test("sync status links expose responsive details", async ({ page }) => {
  await seedAuthenticatedUser(page, "USER");
  await page.goto("/setting/sync");

  await expect(page.getByRole("heading", { name: "همگام‌سازی", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "همگام‌سازی اکنون" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "صف تغییرات" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "آخرین رخدادها" })).toBeVisible();

  const header = page.locator(".app-header");
  await expect(header.getByRole("link", { name: /مشاهده جزئیات همگام‌سازی/ })).toHaveAttribute("href", "/setting/sync");
  await expect(header.locator(".sync-status-badge")).toHaveAttribute("href", "/setting/sync");
  await expect(header.locator("[aria-label='باز کردن جزئیات همگام‌سازی']")).toHaveCount(0);

  await expect(header.locator(".sync-status-label")).toHaveCount(0);

  for (const viewport of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const badgeBox = await header.locator(".sync-status-badge").boundingBox();
    const iconBox = await header.locator(".sync-status-icon").boundingBox();
    const badgeCenter = { x: badgeBox!.x + badgeBox!.width / 2, y: badgeBox!.y + badgeBox!.height / 2 };
    const iconCenter = { x: iconBox!.x + iconBox!.width / 2, y: iconBox!.y + iconBox!.height / 2 };
    expect(Math.abs(badgeCenter.x - iconCenter.x), `${viewport.width}px horizontal center`).toBeLessThanOrEqual(1);
    expect(Math.abs(badgeCenter.y - iconCenter.y), `${viewport.width}px vertical center`).toBeLessThanOrEqual(1);
  }
});

test("domain policy hides a tool and protects its direct route while Help remains available", async ({ page }) => {
  await seedAuthenticatedUser(page, "USER");
  await page.addInitScript(() => {
    const user = JSON.parse(localStorage.getItem("inventory-last-user")!);
    const key = `inventory-entitlement-v2:${user.id}`;
    const entitlement = JSON.parse(localStorage.getItem(key)!);
    entitlement.tools = { import: true, labels: true, categories: true, export: false, catalog: true, recovery: true };
    localStorage.setItem(key, JSON.stringify(entitlement));
  });

  await page.goto("/tools");
  await expect(page.getByRole("link", { name: /راهنمای برنامه/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^خروجی/ })).toHaveCount(0);

  await page.goto("/tools/export");
  await expect(page).toHaveURL(/\/tools\/?$/);
  await page.goto("/tools/help");
  await expect(page.getByRole("heading", { name: "راهنمای برنامه" })).toBeVisible();
});

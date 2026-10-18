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

test("settings and tools share a neutral responsive guide for roots and descendants", async ({ page }) => {
  await seedAuthenticatedUser(page, "USER");
  const rootStyles: Array<{ iconColor: string; iconBackground: string; descriptionBackground: string }> = [];

  for (const path of ["/setting", "/tools"] as const) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    const guide = page.locator(".page-guide");
    await expect(guide).toHaveAttribute("data-root", "true");
    await expect(guide.locator(".page-guide-context")).toBeVisible();
    rootStyles.push(await guide.evaluate((element) => {
      const icon = element.querySelector<HTMLElement>(".page-guide-page-icon")!;
      const description = element.querySelector<HTMLElement>(".page-guide-description")!;
      return {
        iconColor: getComputedStyle(icon).color,
        iconBackground: getComputedStyle(icon).backgroundColor,
        descriptionBackground: getComputedStyle(description).backgroundColor,
      };
    }));
  }
  expect(rootStyles[0]).toEqual(rootStyles[1]);

  await page.goto("/tools/export");
  const descendant = page.locator(".page-guide");
  await expect(descendant).toHaveAttribute("data-root", "false");
  await expect(descendant.locator(".page-guide-section")).toHaveAttribute("href", "/tools");
  await expect(descendant.locator(".page-guide-breadcrumb")).toBeVisible();

  for (const viewport of [{ width: 320, height: 568 }, { width: 768, height: 700 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const boxes = await descendant.evaluate((element) => {
      const guide = element.getBoundingClientRect();
      const heading = element.querySelector<HTMLElement>(".page-guide-heading")!.getBoundingClientRect();
      const description = element.querySelector<HTMLElement>(".page-guide-description")!.getBoundingClientRect();
      return {
        guide: { left: guide.left, right: guide.right },
        headingBottom: heading.bottom,
        descriptionTop: description.top,
      };
    });
    expect(boxes.guide.left, `${viewport.width}px guide left`).toBeGreaterThanOrEqual(0);
    expect(boxes.guide.right, `${viewport.width}px guide right`).toBeLessThanOrEqual(viewport.width);
    expect(boxes.descriptionTop, `${viewport.width}px row order`).toBeGreaterThan(boxes.headingBottom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }

  await page.evaluate(() => {
    localStorage.setItem("inventory-appearance", "dark");
    window.dispatchEvent(new CustomEvent("appearance-change", { detail: "dark" }));
  });
  await expect(page.locator("html")).toHaveAttribute("data-appearance", "dark");
  await expect(descendant.locator(".page-guide-title")).toBeVisible();
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

test("bottom navigation stays ordered and circular without covering the final page action", async ({ page }) => {
  await seedAuthenticatedUser(page, "USER");
  await page.addInitScript(() => localStorage.setItem("inventory-display-size", "large"));

  for (const viewport of [
    { width: 320, height: 480 },
    { width: 390, height: 700 },
    { width: 768, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/setting");

    const main = page.locator("main.app-shell-content");
    const logout = main.locator("button").last();
    await expect(logout).toHaveCount(1);
    await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(logout).toBeInViewport();

    const metrics = await page.evaluate(() => {
      const mainElement = document.querySelector<HTMLElement>("main.app-shell-content")!;
      const navigationElement = document.querySelector<HTMLElement>(".app-bottom-navigation")!;
      const surfaceElement = document.querySelector<HTMLElement>(".app-bottom-navigation-surface")!;
      const addElement = document.querySelector<HTMLElement>(".app-bottom-navigation-add-button")!;
      const logoutElement = [...mainElement.querySelectorAll<HTMLElement>("button")].at(-1)!;
      const navigationBox = navigationElement.getBoundingClientRect();
      const surfaceBox = surfaceElement.getBoundingClientRect();
      const addBox = addElement.getBoundingClientRect();
      const logoutBox = logoutElement.getBoundingClientRect();
      const itemBoxes = [...surfaceElement.children].map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right };
      });
      return {
        paddingBottom: Number.parseFloat(getComputedStyle(mainElement).paddingBottom),
        navigationHeight: navigationBox.height,
        navigationTop: navigationBox.top,
        surface: { left: surfaceBox.left, right: surfaceBox.right },
        add: { width: addBox.width, height: addBox.height },
        logoutBottom: logoutBox.bottom,
        itemBoxes,
      };
    });

    expect(metrics.paddingBottom, `${viewport.width}px bottom inset`).toBeGreaterThan(metrics.navigationHeight);
    expect(metrics.logoutBottom, `${viewport.width}px final action`).toBeLessThanOrEqual(metrics.navigationTop);
    expect(Math.abs(metrics.add.width - metrics.add.height), `${viewport.width}px add shape`).toBeLessThanOrEqual(1);
    for (const item of metrics.itemBoxes) {
      expect(item.left, `${viewport.width}px item left`).toBeGreaterThanOrEqual(metrics.surface.left - 1);
      expect(item.right, `${viewport.width}px item right`).toBeLessThanOrEqual(metrics.surface.right + 1);
    }
  }
});

test("shared navigation inset keeps final form actions reachable in short viewports and large text", async ({ page }) => {
  await seedAuthenticatedUser(page, "USER");
  await page.addInitScript(() => localStorage.setItem("inventory-display-size", "large"));
  await page.setViewportSize({ width: 320, height: 480 });
  await page.goto("/inventory/add");

  const main = page.locator("main.app-shell-content");
  const submit = page.locator("form button[type='submit']");
  await expect(submit).toBeVisible();
  await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(submit).toBeInViewport();

  const metrics = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const mainElement = document.querySelector<HTMLElement>("main.app-shell-content")!;
    const navElement = document.querySelector<HTMLElement>(".app-bottom-navigation")!;
    const submitElement = document.querySelector<HTMLElement>("form button[type='submit']")!;
    const navRect = navElement.getBoundingClientRect();
    const submitRect = submitElement.getBoundingClientRect();
    return {
      measured: Number.parseFloat(root.getPropertyValue("--app-bottom-navigation-measured-height")),
      padding: Number.parseFloat(getComputedStyle(mainElement).paddingBottom),
      nav: { y: navRect.y, height: navRect.height },
      submit: { bottom: submitRect.bottom },
    };
  });
  expect(metrics.measured).toBeGreaterThanOrEqual(metrics.nav.height);
  expect(metrics.padding).toBeGreaterThan(metrics.nav.height);
  expect(metrics.submit.bottom).toBeLessThanOrEqual(metrics.nav.y);

  await page.setViewportSize({ width: 640, height: 360 });
  await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(submit).toBeInViewport();

  await page.evaluate(() => {
    localStorage.setItem("inventory-display-size", "compact");
    document.documentElement.dataset.displaySize = "compact";
    window.dispatchEvent(new CustomEvent("display-size-change", { detail: "compact" }));
  });
  await expect.poll(() => page.evaluate(() => Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--app-bottom-navigation-measured-height"),
  ))).toBeLessThan(metrics.measured);
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

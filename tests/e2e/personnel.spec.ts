import { expect, test, type Page, type Route } from "@playwright/test";
import path from "node:path";

const now = "2026-10-20T08:00:00.000Z";
const owner = {
  id: 8201,
  first_name: "مالک",
  last_name: "مجموعه",
  username: "store-owner",
  email: null,
  phone: null,
  industry_id: 1,
  plan: "team",
  is_active: true,
  is_admin: false,
  role: "USER",
  is_system_admin: false,
  is_store_owner: true,
  store_id: 41,
  membership_id: 51,
  subscription_started_at: now,
  subscription_expires_at: "2099-01-01T00:00:00.000Z",
  created_at: now,
};

const personnel = {
  membership_id: 72,
  user_id: 81,
  first_name: "تست",
  last_name: "تستی",
  username: "test.person",
  role_id: 2,
  role_name: "مشاهده‌گر",
  active: true,
  temporary_password_required: true,
  credentials_notice_viewed: false,
  created_at: now,
  last_activity_at: now,
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function openPersonnel(page: Page) {
  await page.addInitScript(({ user, capturedAt }) => {
    localStorage.setItem("access_token", JSON.stringify("personnel-layout-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}`, JSON.stringify({
      user_id: user.id,
      plan: "team",
      label: "تیمی",
      status: "active",
      account_status: "active",
      started_at: capturedAt,
      expires_at: "2099-01-01T00:00:00.000Z",
      server_time: capturedAt,
      synced_at: capturedAt,
      verified_at: capturedAt,
      captured_at_ms: Date.now(),
      last_observed_at_ms: Date.now(),
      capabilities: { "inventory.read": true, "personnel.manage": true },
      limits: { inventory_items: null },
    }));
  }, { user: owner, capturedAt: now });

  await page.route("http://localhost:8000/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return json(route, owner);
    if (url.pathname === "/api/plans/current") return json(route, {
      user_id: owner.id,
      plan: "team",
      label: "تیمی",
      status: "active",
      account_status: "active",
      started_at: now,
      expires_at: "2099-01-01T00:00:00.000Z",
      server_time: now,
      synced_at: now,
      verified_at: now,
      capabilities: { "inventory.read": true, "personnel.manage": true },
      limits: { inventory_items: null },
    });
    if (url.pathname === "/api/store/personnel/capacity") return json(route, { enabled: true, used: 1, limit: 4, available: 3 });
    if (url.pathname === "/api/store/roles") return json(route, [{ id: 2, name: "مشاهده‌گر", permissions: [], assigned_count: 1 }]);
    if (url.pathname === "/api/store/personnel/72/temporary-credentials") return json(route, { ...personnel, temporary_password: "QS7!safe-temporary" });
    if (url.pathname === "/api/store/personnel") return json(route, [personnel]);
    return json(route, {});
  });

  await page.goto("/setting/personnel");
  await expect(page.getByRole("heading", { name: "پرسنل مجموعه", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "مسیر صفحه" })).toContainText("تنظیمات");
  await expect(page.locator(".page-guide").getByRole("button", { name: "بازگشت" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "افزودن پرسنل" })).toBeVisible();
  await expect(page.getByText("تست تستی")).toBeVisible();
}

test("personnel layout adapts without horizontal overflow", async ({ page }, testInfo) => {
  await openPersonnel(page);
  await page.getByRole("button", { name: /رمز موقت تازه/ }).click();
  await expect(page.getByRole("heading", { name: /اطلاعات ورود فقط همین‌بار/ })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const gridColumns = await page.locator(".personnel-main-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  if (testInfo.project.name.includes("mobile")) expect(gridColumns).toBe(1);
  else {
    expect(gridColumns).toBe(2);
    await page.setViewportSize({ width: 820, height: 1180 });
    const tabletColumns = await page.locator(".personnel-main-grid").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
    expect(tabletColumns).toBe(1);
    const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(tabletOverflow).toBeLessThanOrEqual(1);
  }

  if (process.env.UPDATE_PERSONNEL_GALLERY === "1") {
    const mobile = testInfo.project.name.includes("mobile");
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await page.locator("[data-sonner-toast]").getByRole("button").click().catch(() => undefined);
    await page.locator("[data-sonner-toast]").waitFor({ state: "detached", timeout: 6_000 }).catch(() => undefined);
    await page.locator(".app-shell-content").evaluate((element) => element.scrollTo({ top: 0 }));
    await page.screenshot({
      path: path.resolve(
        "artifacts/ui-layout-gallery-2026-10-20",
        mobile ? "mobile/settings/01-personnel.png" : "desktop/settings/01-personnel.png",
      ),
    });
  }
});

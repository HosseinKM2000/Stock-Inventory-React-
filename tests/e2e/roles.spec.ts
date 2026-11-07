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

const roles = [
  { id: 1, name: "اپراتور موجودی", permissions: ["products.view", "products.quantity.change", "barcodes.lookup"], assigned_count: 0 },
  { id: 2, name: "سرپرست", permissions: ["products.view", "products.edit", "finance.view", "dashboard.view"], assigned_count: 2 },
  { id: 3, name: "مشاهده‌گر", permissions: ["products.view", "dashboard.view"], assigned_count: 1 },
  { id: 4, name: "ویرایشگر قیمت", permissions: ["products.view", "products.sale_price.change", "products.purchase_price.change"], assigned_count: 0 },
];

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function openRoles(page: Page) {
  await page.addInitScript(({ user, capturedAt }) => {
    localStorage.setItem("access_token", JSON.stringify("roles-layout-token"));
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
    if (url.pathname === "/api/store/personnel/capacity") return json(route, { enabled: true, used: 3, limit: 5, available: 2 });
    if (url.pathname === "/api/store/roles") return json(route, roles);
    return json(route, {});
  });

  await page.goto("/setting/roles");
  await expect(page.getByRole("heading", { name: "نقش‌های مجموعه", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "مسیر صفحه" })).toContainText("تنظیمات");
  await expect(page.locator(".page-guide").getByRole("button", { name: "بازگشت" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "نقش تازه" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "نقش‌های تعریف‌شده" })).toBeVisible();
}

test("roles layout is responsive, grouped and free of horizontal overflow", async ({ page }, testInfo) => {
  await openRoles(page);

  await expect(page.getByRole("group", { name: "مدیریت محصولات" })).toBeVisible();
  await expect(page.getByRole("group", { name: "سایر دسترسی‌ها" })).toBeVisible();
  await expect(page.getByText("۴ نقش")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const permissionColumns = await page.locator(".role-permission-grid").first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  const roleColumns = await page.locator(".roles-list").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  if (testInfo.project.name.includes("mobile")) {
    expect(permissionColumns).toBe(1);
    expect(roleColumns).toBe(1);
  } else {
    expect(permissionColumns).toBe(2);
    expect(roleColumns).toBe(2);
  }

  await page.getByRole("button", { name: "ویرایش" }).first().click();
  await expect(page.getByRole("heading", { name: "ویرایش نقش" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /نام نقش/ })).toHaveValue("اپراتور موجودی");

  if (process.env.UPDATE_ROLES_GALLERY === "1") {
    const mobile = testInfo.project.name.includes("mobile");
    await page.getByRole("button", { name: "انصراف" }).click();
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
    await page.locator(".app-shell-content").evaluate((element) => element.scrollTo({ top: 0 }));
    await page.screenshot({
      path: path.resolve(
        "artifacts/ui-layout-gallery-2026-10-20",
        mobile ? "mobile/settings/02-roles.png" : "desktop/settings/02-roles.png",
      ),
    });
  }
});

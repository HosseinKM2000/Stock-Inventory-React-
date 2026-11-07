import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-11-03T08:00:00.000Z";
const expiry = "2026-12-03T08:00:00.000Z";

const capabilities = {
  "inventory.read": true,
  "inventory.write": true,
  "categories.write": true,
  "labels.write": true,
  "inventory.bulk_edit": true,
  "import.xlsx": true,
  "export.local": true,
  "export.server": true,
  "catalog.use": true,
  "dashboard.analytics": true,
  "barcode.lookup": true,
  "barcode.manage": true,
  "label.print": true,
  personnel: true,
  backup: true,
  sync: true,
  "media.recovery": false,
  "invoices.purchase": false,
  "invoices.sale": false,
};

const plan = {
  id: "pro",
  name: "Pro",
  description: "پیکربندی فعلی آزمایشی",
  price_minor: 1_000_000,
  currency: "IRR",
  duration: 30,
  duration_unit: "day",
  is_active: true,
  features: capabilities,
  limits: { inventory_items: 5000, active_personnel: 10, devices: null },
  policy_revision: 4,
  commercial_status: "legacy_unapproved",
  configuration_errors: [],
  created_at: now,
  updated_at: now,
};

const registry = {
  capabilities: [
    { key: "inventory.read", label_fa: "مشاهده موجودی", status: "implemented", dependencies: [], permissions: ["products.view"], enforcement: ["products"] },
    { key: "media.recovery", label_fa: "بازیابی رسانه برنامه‌ریزی‌شده", status: "planned", dependencies: ["backup"], permissions: [], enforcement: [] },
  ],
  capacities: [
    { key: "inventory_items", label_fa: "تعداد کالا", unit: "record", minimum: 0, maximum: 10_000_000, supports_unlimited: true, capability: "inventory.write", enforcement: ["products.create"] },
    { key: "active_personnel", label_fa: "پرسنل فعال", unit: "membership", minimum: 0, maximum: 100_000, supports_unlimited: false, capability: "personnel", enforcement: ["personnel.create"] },
    { key: "devices", label_fa: "دستگاه فعال", unit: "session", minimum: 0, maximum: 100_000, supports_unlimited: true, capability: null, enforcement: ["session.admission"] },
  ],
  semantics: {},
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function seed(page: Page, admin: boolean) {
  const user = {
    id: admin ? 9001 : 9002,
    first_name: admin ? "مدیر" : "مالک",
    last_name: "آزمایشی",
    username: admin ? "policy-admin" : "grant-owner",
    email: null,
    phone: null,
    industry_id: 1,
    plan: "free",
    is_active: true,
    is_admin: admin,
    role: admin ? "ADMIN" : "USER",
    is_system_admin: admin,
    is_store_owner: true,
    store_id: admin ? 90 : 91,
    membership_id: admin ? 190 : 191,
    subscription_started_at: now,
    subscription_expires_at: expiry,
    created_at: now,
  };
  await page.addInitScript(({ value, capturedAt, caps, grantExpiry }) => {
    localStorage.setItem("access_token", JSON.stringify("entitlement-e2e-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(value));
    localStorage.setItem(`inventory-entitlement-v2:${value.id}:${value.store_id}`, JSON.stringify({
      user_id: value.id,
      store_id: value.store_id,
      plan: value.is_admin ? "administrator" : "pro",
      base_plan: "free",
      entitlement_source: value.is_admin ? "administrator" : "grant",
      grant_id: value.is_admin ? null : 44,
      grant_expires_at: value.is_admin ? null : grantExpiry,
      policy_revision: 4,
      label: value.is_admin ? "مدیر سامانه" : "Pro",
      status: "active",
      account_status: "active",
      started_at: capturedAt,
      expires_at: grantExpiry,
      server_time: capturedAt,
      synced_at: capturedAt,
      verified_at: capturedAt,
      captured_at_ms: Date.now(),
      last_observed_at_ms: Date.now(),
      capabilities: caps,
      limits: { inventory_items: 5000, active_personnel: 10, devices: null },
    }));
  }, { value: user, capturedAt: now, caps: capabilities, grantExpiry: expiry });
  return user;
}

test("administrator policy and explicit grant controls stay reachable", async ({ page }) => {
  const admin = await seed(page, true);
  const customer = {
    ...admin,
    id: 9002,
    username: "grant-owner",
    first_name: "مالک",
    is_admin: false,
    is_system_admin: false,
    role: "USER",
    store_id: 91,
    plan: "free",
    subscription_status: "active",
    last_activity_at: now,
    remaining_days: 30,
    device_limit_mode: "inherit",
    device_limit_override: null,
    effective_device_limit: null,
    device_limit_source: "plan",
    active_session_count: 1,
  };
  await page.route("http://localhost:8000/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return json(route, admin);
    if (url.pathname === "/api/admin/plans") return json(route, [plan]);
    if (url.pathname === "/api/admin/entitlements/registry") return json(route, registry);
    if (url.pathname === "/api/admin/users") return json(route, [customer]);
    if (url.pathname === "/api/plans") return json(route, [plan]);
    if (url.pathname === "/api/admin/grants" && route.request().method() === "POST") {
      const request = route.request().postDataJSON();
      return json(route, { id: 44, ...request, granted_by_user_id: admin.id, revoked_at: null, revoked_by_user_id: null, revocation_reason: null, created_at: now }, 201);
    }
    return json(route, {});
  });

  await page.goto("/management/subscriptions");
  await expect(page.getByText("pro", { exact: true })).toBeVisible();
  await expect(page.getByText("تخصیص‌های تأییدنشده")).toBeVisible();
  await expect(page.getByText("بازبینی سیاست: 4")).toBeVisible();
  await page.getByRole("button", { name: "ویرایش" }).click();
  const planned = page.getByRole("checkbox", { name: /بازیابی رسانه برنامه‌ریزی‌شده/ });
  await expect(planned).toBeDisabled();
  await expect(page.getByText(/وابسته به: backup/)).toBeVisible();

  await page.goto("/management/users");
  await page.getByRole("button", { name: "گرنت موقت" }).click();
  await expect(page.getByRole("heading", { name: "اعطای طرح پولی زمان‌دار" })).toBeVisible();
  await expect(page.getByText(/اشتراک پایه دوباره مؤثر می‌شود/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("customer sees effective grant and preserved base subscription", async ({ page }) => {
  const customer = await seed(page, false);
  await page.route("http://localhost:8000/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return json(route, customer);
    if (url.pathname === "/api/plans") return json(route, [plan]);
    if (url.pathname === "/api/plans/current") return json(route, {
      user_id: customer.id,
      store_id: customer.store_id,
      plan: "pro",
      base_plan: "free",
      entitlement_source: "grant",
      grant_id: 44,
      grant_expires_at: expiry,
      policy_revision: 4,
      label: "Pro",
      status: "active",
      account_status: "active",
      started_at: now,
      expires_at: expiry,
      server_time: now,
      synced_at: now,
      capabilities,
      limits: plan.limits,
      tools: {},
    });
    return json(route, {});
  });

  await page.goto("/setting/subscription");
  await expect(page.getByText(/هدیه زمان‌دار تا/)).toBeVisible();
  await expect(page.getByText(/اشتراک پایه «free»/)).toBeVisible();
  await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
});

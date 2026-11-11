import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-11-10T12:00:00.000Z";
const owner = {
  id: 8701, first_name: "مالک", last_name: "آزمایشی", username: "counterparty-owner",
  email: null, phone: "09120008701", industry_id: 1, plan: "free", is_active: true,
  is_admin: false, role: "USER", is_system_admin: false, is_store_owner: true,
  store_id: 9701, membership_id: 10701, store_operating_mode: "solo", store_policy_version: 1,
  subscription_started_at: null, subscription_expires_at: null, created_at: now,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function openCounterparties(page: Page) {
  const records: Array<Record<string, unknown>> = [];
  await page.addInitScript(({ user, captured }) => {
    localStorage.setItem("access_token", JSON.stringify("counterparty-layout-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}:${user.store_id}`, JSON.stringify({
      user_id: user.id, store_id: user.store_id, plan: "free", label: "Synthetic counterparties",
      status: "active", account_status: "active", started_at: null, expires_at: null,
      server_time: captured, synced_at: captured, verified_at: captured,
      captured_at_ms: Date.now(), last_observed_at_ms: Date.now(),
      capabilities: { "inventory.read": true, "invoices.purchase": true, "invoices.sale": true },
      limits: { inventory_items: null },
    }));
  }, { user: owner, captured: now });
  await page.route("http://localhost:8000/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return json(route, owner);
    if (path === "/api/plans/current") return json(route, {
      user_id: owner.id, store_id: owner.store_id, plan: "free", label: "Synthetic counterparties",
      status: "active", account_status: "active", started_at: null, expires_at: null,
      server_time: now, synced_at: now,
      capabilities: { "inventory.read": true, "invoices.purchase": true, "invoices.sale": true },
      limits: { inventory_items: null },
    });
    if (path === "/api/counterparties" && route.request().method() === "GET") return json(route, records);
    if (path === "/api/counterparties" && route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      const created = { id: 51, ...input, created_at: now, updated_at: now };
      records.push(created);
      return json(route, created, 201);
    }
    const match = /^\/api\/counterparties\/(\d+)$/.exec(path);
    if (match && route.request().method() === "PATCH") {
      const index = records.findIndex((item) => item.id === Number(match[1]));
      records[index] = { ...records[index], ...route.request().postDataJSON(), updated_at: now };
      return json(route, records[index]);
    }
    if (match && route.request().method() === "DELETE") {
      const index = records.findIndex((item) => item.id === Number(match[1]));
      records.splice(index, 1);
      return route.fulfill({ status: 204 });
    }
    return route.abort();
  });
  await page.goto("/tools/counterparties");
}

test("counterparty workspace creates, edits, searches and deletes online records", async ({ page }) => {
  await openCounterparties(page);
  await expect(page.getByRole("heading", { name: "طرف‌حساب‌ها", level: 1 })).toBeVisible();
  await page.getByLabel("نوع طرف‌حساب").click();
  await page.getByRole("option", { name: "مجموعه" }).click();
  await page.getByLabel("نام طرف‌حساب").fill("فروشگاه سپهر");
  await page.getByLabel("تلفن طرف‌حساب").fill("02112345678");
  await page.getByLabel("نشانی طرف‌حساب").fill("تهران");
  await page.getByRole("button", { name: "افزودن" }).click();
  await expect(page.getByText("فروشگاه سپهر", { exact: true })).toBeVisible();

  await page.getByLabel("ویرایش فروشگاه سپهر").click();
  await page.getByLabel("نام طرف‌حساب").fill("فروشگاه سپهر نو");
  await page.getByRole("button", { name: "ذخیره" }).click();
  await page.getByPlaceholder("جست‌وجوی نام یا تلفن").fill("سپهر نو");
  await expect(page.getByText("فروشگاه سپهر نو", { exact: true })).toBeVisible();

  await page.getByLabel("حذف فروشگاه سپهر نو").click();
  await page.getByRole("button", { name: "حذف", exact: true }).click();
  await expect(page.getByText("فروشگاه سپهر نو", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

test("minimal signup is reachable, responsive, and submits only one credential request", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let requestCount = 0;
  let submitted: Record<string, unknown> | null = null;
  await page.route("http://localhost:8000/api/auth/signup", async (route) => {
    requestCount += 1;
    submitted = route.request().postDataJSON();
    await gate;
    await json(route, { detail: "Username already exists" }, 409);
  });

  await page.goto("/auth/register");
  await expect(page.locator('input[name="username"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("autocomplete", "new-password");
  await expect(page.locator('input[name="repeatPassword"]')).toHaveAttribute("autocomplete", "new-password");
  await expect(page.locator('input[name="firstName"], input[name="lastName"], input[type="email"], input[type="tel"]')).toHaveCount(0);

  await page.locator('input[name="username"]').fill("new-owner");
  await page.locator('input[name="password"]').fill("StrongPass123!");
  await page.locator('input[name="repeatPassword"]').fill("DifferentPass123!");
  await page.getByRole("button", { name: "ساخت حساب" }).click();
  await expect(page.getByText(/یکسان نیست/)).toBeVisible();

  await page.locator('input[name="repeatPassword"]').fill("StrongPass123!");
  await page.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect.poll(() => requestCount).toBe(1);
  expect(submitted).toMatchObject({ username: "new-owner", password: "StrongPass123!" });
  expect(submitted).not.toHaveProperty("repeatPassword");
  expect(submitted).not.toHaveProperty("first_name");
  expect(submitted).not.toHaveProperty("email");
  release();

  await expect(page.getByText(/قبلاً ثبت شده/)).toBeVisible();
  await expect(page.locator('input[name="username"]')).toHaveValue("new-owner");
  await expect(page.locator('input[name="password"]')).toHaveValue("StrongPass123!");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("access_token"))).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

async function seedIncompleteOwner(page: Page) {
  const user = {
    id: 8201,
    first_name: null,
    last_name: null,
    username: "profile-owner",
    email: null,
    phone: null,
    industry_id: 1,
    plan: "free",
    is_active: true,
    is_admin: false,
    role: "USER",
    is_system_admin: false,
    is_store_owner: true,
    store_id: 9201,
    membership_id: 10201,
    store_operating_mode: "solo",
    store_policy_version: 1,
    subscription_started_at: null,
    subscription_expires_at: null,
    created_at: "2026-11-03T08:00:00.000Z",
  };
  await page.addInitScript((value) => {
    localStorage.setItem("access_token", JSON.stringify("profile-reminder-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(value));
  }, user);
  return user;
}

test("profile reminder survives viewing and resolves after successful owner completion", async ({ page }) => {
  let currentUser = await seedIncompleteOwner(page);
  await page.route("http://localhost:8000/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me" && route.request().method() === "PATCH") {
      currentUser = { ...currentUser, ...route.request().postDataJSON() };
      return json(route, currentUser);
    }
    if (url.pathname === "/api/auth/me") return json(route, currentUser);
    return route.abort();
  });

  await page.goto("/dashboard");
  const notificationButton = page.locator(".app-header-right").getByRole("button", { name: /اعلان|هشدار/ });
  await notificationButton.click();
  await expect(page.getByText("پروفایل شما کامل نیست")).toBeVisible();
  await expect(page.getByText("اطلاع‌رسانی")).toBeVisible();
  await page.getByRole("link", { name: "تکمیل پروفایل" }).click();
  await expect(page).toHaveURL(/\/setting\/profile/);

  await page.goto("/dashboard");
  await notificationButton.click();
  await expect(page.getByText("پروفایل شما کامل نیست")).toBeVisible();
  await page.getByRole("link", { name: "تکمیل پروفایل" }).click();

  await page.locator('input[name="first_name"]').fill("Sara");
  await page.locator('input[name="last_name"]').fill("Ahmadi");
  await page.locator('input[name="email"]').fill("sara@example.com");
  await page.locator('input[name="phone"]').fill("09120000000");
  await page.getByRole("button", { name: "ذخیره اطلاعات" }).click();
  await expect(page.getByText(/با موفقیت ذخیره شد/)).toBeVisible();

  await page.goto("/dashboard");
  await notificationButton.click();
  await expect(page.getByText("پروفایل شما کامل نیست")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

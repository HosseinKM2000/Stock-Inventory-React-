import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const galleryRoot = path.join(root, "artifacts", "ui-layout-gallery-2026-10-20");
const manifestPath = path.join(galleryRoot, "manifest.json");

const capturedAt = "2026-10-20T08:00:00.000Z";
const admin = {
  id: 8201,
  first_name: "مدیر",
  last_name: "سامانه",
  username: "layout-admin",
  email: "admin@example.test",
  phone: null,
  industry_id: 1,
  plan: "vip",
  is_active: true,
  is_admin: true,
  role: "ADMIN",
  is_system_admin: true,
  is_store_owner: true,
  store_id: 41,
  membership_id: 51,
  subscription_status: "active",
  subscription_started_at: capturedAt,
  subscription_expires_at: "2099-01-01T00:00:00.000Z",
  remaining_days: null,
  created_at: capturedAt,
  last_activity_at: capturedAt,
  device_limit_mode: "inherit",
  device_limit_override: null,
  active_session_count: 1,
  effective_device_limit: null,
  device_limit_source: "plan",
};
const entitlement = {
  user_id: admin.id,
  plan: "vip",
  label: "ویژه",
  status: "active",
  account_status: "active",
  started_at: capturedAt,
  expires_at: "2099-01-01T00:00:00.000Z",
  server_time: capturedAt,
  synced_at: capturedAt,
  verified_at: capturedAt,
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
    "personnel.manage": true,
  },
  limits: { inventory_items: null, active_personnel: 10 },
};
const industry = { id: 1, name: "فروشگاه عمومی", description: "کالا و موجودی عمومی", is_active: true, tools: { scanner: true, import: true, labels: true, categories: true, export: true, catalog: true, recovery: true } };
const plan = { id: "vip", name: "ویژه", description: "دسترسی کامل برای مجموعه‌های حرفه‌ای", price_minor: 0, duration: null, duration_unit: null, is_active: true, features: { personnel: true, backup: true, export: true }, limits: { active_personnel: 10 } };
const role = { id: 2, name: "مشاهده‌گر", permissions: ["products.view", "dashboard.view"], assigned_count: 1 };
const person = { membership_id: 72, user_id: 81, first_name: "همکار", last_name: "فروشگاه", username: "store.person", role_id: 2, role_name: role.name, active: true, temporary_password_required: false, credentials_notice_viewed: true, created_at: capturedAt, last_activity_at: capturedAt };

async function seedIsolatedAdmin(page) {
  await page.addInitScript(({ user, currentEntitlement }) => {
    localStorage.setItem("access_token", JSON.stringify("gallery-layout-token"));
    localStorage.setItem("inventory-last-user", JSON.stringify(user));
    localStorage.setItem(`inventory-entitlement-v2:${user.id}`, JSON.stringify(currentEntitlement));
  }, { user: admin, currentEntitlement: entitlement });

  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let body = [];
    if (pathname === "/api/auth/me") body = admin;
    else if (pathname === "/api/plans/current") body = entitlement;
    else if (pathname === "/api/plans" || pathname === "/api/admin/plans") body = [plan];
    else if (pathname === "/api/admin/users") body = [admin];
    else if (pathname === "/api/industries") body = [industry];
    else if (pathname === "/api/store/personnel/capacity") body = { enabled: true, used: 1, limit: 10, available: 9 };
    else if (pathname === "/api/store/roles") body = [role];
    else if (pathname === "/api/store/personnel") body = [person];
    else if (pathname === "/api/store/activity/today-summary") body = { count: 1 };
    else if (pathname === "/api/store/activity") body = { items: [], total: 0, page: 1, page_size: 25 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const appUrl = process.env.GALLERY_APP_URL ?? "http://127.0.0.1:5173";
const routeFilter = process.env.GALLERY_ROUTE;
const browser = await chromium.launch();

try {
  for (const [viewportName, viewport] of Object.entries({
    desktop: { width: 1440, height: 1000 },
    mobile: { width: 390, height: 844 },
  })) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => console.error(`${viewportName} page error: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") console.error(`${viewportName} console error: ${message.text()}`); });
    await seedIsolatedAdmin(page);

    for (const capture of manifest.captures.filter((item) => item.viewport === viewportName && (!routeFilter || item.route === routeFilter))) {
      await page.goto(`${appUrl}${capture.route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      await page.locator(".app-shell-content").evaluate((element) => element.scrollTo({ top: 0 })).catch(() => undefined);
      if (await page.getByText("Something went wrong!", { exact: false }).count()) throw new Error(`Render failed for ${capture.route}`);
      await page.locator("[data-sonner-toaster]").evaluateAll((elements) => elements.forEach((element) => element.remove()));
      await page.screenshot({ path: path.join(galleryRoot, capture.relativePath), animations: "disabled" });
      console.log(`${viewportName}: ${capture.route}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

manifest.generatedAt = new Date().toISOString();
manifest.appUrl = appUrl;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

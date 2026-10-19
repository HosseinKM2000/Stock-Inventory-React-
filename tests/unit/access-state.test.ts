import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";
import type { Entitlement } from "@/shared/access/access-state";

const user: User = {
  id: 42,
  first_name: "Test",
  last_name: "User",
  username: "test-user",
  email: null,
  phone: null,
  industry_id: null,
  plan: "pro",
  is_active: true,
  is_admin: false,
  role: "USER",
  is_system_admin: false,
  subscription_started_at: null,
  subscription_expires_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

function entitlement(expiresAt: string | null, tools?: Record<string, boolean>): Entitlement {
  return {
    user_id: user.id,
    plan: "pro",
    label: "Pro",
    status: "active",
    account_status: "active",
    started_at: "2026-08-01T00:00:00Z",
    expires_at: expiresAt,
    server_time: "2026-09-02T08:00:00Z",
    synced_at: "2026-09-02T08:00:00Z",
    capabilities: { "inventory.read": true, "inventory.write": true, "export.local": true },
    limits: { inventory_items: 100 },
    tools,
  };
}

describe("offline subscription access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.setSystemTime(new Date("2026-09-02T08:00:00Z"));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  });

  it("allows cached capabilities only until the absolute expiry boundary", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser(user);
    accessState.saveEntitlement(entitlement("2026-09-02T09:00:00Z"));
    accessState.useOfflineSnapshot();
    expect(accessState.canWrite()).toBe(true);

    vi.setSystemTime(new Date("2026-09-02T09:00:00Z"));
    expect(accessState.evaluate().status).toBe("expired");
    expect(accessState.canWrite()).toBe(false);
    expect(accessState.canUse("inventory.read")).toBe(true);
  });

  it("requires server verification after reconnect without deleting cached data", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser(user);
    accessState.saveEntitlement(entitlement("2026-10-01T00:00:00Z"));
    accessState.requireOnlineVerification();
    expect(accessState.evaluate().status).toBe("requires_online_verification");
    expect(accessState.canWrite()).toBe(false);
    expect(accessState.entitlement()?.plan).toBe("pro");
  });

  it("pauses personnel access after the 24-hour authorization lease", async () => {
    const { accessState, PERSONNEL_AUTHORIZATION_VALIDITY_MS } = await import("@/shared/access/access-state");
    accessState.saveUser({ ...user, store_id: 9, is_store_owner: false, store_permissions: ["products.view"], membership_authorization_checked_at: "2026-09-02T08:00:00Z" });
    accessState.saveEntitlement(entitlement(null));
    accessState.useOfflineSnapshot();
    expect(accessState.canUse("inventory.read")).toBe(true);

    vi.setSystemTime(new Date(Date.parse("2026-09-02T08:00:00Z") + PERSONNEL_AUTHORIZATION_VALIDITY_MS + 1));
    expect(accessState.evaluate().status).toBe("requires_online_verification");
    expect(accessState.canUse("inventory.read")).toBe(false);
  });

  it("never grants regular capabilities from another user's cached snapshot", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser(user);
    accessState.saveEntitlement(entitlement(null));
    accessState.saveUser({ ...user, id: 99, username: "other-user" });
    accessState.useOfflineSnapshot();
    expect(accessState.entitlement()).toBeNull();
    expect(accessState.canWrite()).toBe(false);
  });

  it("denies disabled users even when a valid entitlement is cached", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser(user);
    accessState.saveEntitlement(entitlement(null));
    accessState.disableAccount();
    expect(accessState.evaluate().status).toBe("disabled");
    expect(accessState.canAccess()).toBe(false);
    expect(accessState.canWrite()).toBe(false);
  });

  it("gives domain restrictions precedence and keeps the last offline policy", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser(user);
    accessState.saveEntitlement(entitlement(null, { export: false, catalog: true }));
    accessState.useOfflineSnapshot();
    expect(accessState.canUse("export.local")).toBe(true);
    expect(accessState.canUseTool("export")).toBe(false);
    expect(accessState.canUseTool("catalog")).toBe(true);
  });

  it("preserves tools for legacy snapshots with no domain policy", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser(user);
    accessState.saveEntitlement(entitlement(null));
    accessState.useOfflineSnapshot();
    expect(accessState.canUseTool("export")).toBe(true);
  });

  it("grants a system administrator every store permission", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser({
      ...user,
      is_admin: true,
      role: "ADMIN",
      is_system_admin: true,
      is_store_owner: false,
      store_permissions: [],
    });

    expect(accessState.hasStorePermission("products.view")).toBe(true);
    expect(accessState.hasStorePermission("products.delete")).toBe(true);
    expect(accessState.hasStorePermission("tools.backup")).toBe(true);
  });

  it("denies new purchase and finance permissions for legacy users without membership metadata", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    accessState.saveUser({ ...user, is_store_owner: undefined, store_permissions: undefined });
    expect(accessState.hasStorePermission("products.view")).toBe(true);
    expect(accessState.hasStorePermission("products.purchase_price.view")).toBe(false);
    expect(accessState.hasStorePermission("finance.view")).toBe(false);
  });
});

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

function entitlement(expiresAt: string | null): Entitlement {
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
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), setQueryData: vi.fn() }));
vi.mock("@/shared/api/client", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/shared/api/query-client", () => ({ queryClient: { setQueryData: mocks.setQueryData } }));
vi.mock("@/shared/api/token-store", () => ({ isAuthenticated: () => true }));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({ networkService: { isOffline: () => false } }));

function user(id: number, storeId: number): User {
  return {
    id, store_id: storeId, first_name: "Test", last_name: "User", username: `user-${id}`,
    email: null, phone: null, industry_id: null, plan: "free", is_active: true,
    is_admin: false, role: "USER", is_system_admin: false,
    subscription_started_at: null, subscription_expires_at: null, created_at: "2026-01-01T00:00:00Z",
  };
}

describe("entitlement refresh partition", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.apiFetch.mockReset();
    mocks.setQueryData.mockReset();
    localStorage.clear();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("does not save a late response after the authenticated account changes", async () => {
    const { accessState } = await import("@/shared/access/access-state");
    const first = user(10, 100);
    const second = user(20, 200);
    accessState.saveUser(first);
    let resolveUser!: (value: User) => void;
    mocks.apiFetch.mockReturnValueOnce(new Promise<User>((resolve) => { resolveUser = resolve; }));
    const { entitlementService } = await import("@/shared/access/entitlement-service");
    const verification = entitlementService.verify();
    accessState.saveUser(second);
    resolveUser(first);
    await expect(verification).rejects.toThrow("ENTITLEMENT_ACCOUNT_CHANGED");
    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(accessState.user()?.id).toBe(second.id);
    expect(accessState.entitlement()).toBeNull();
  });
});

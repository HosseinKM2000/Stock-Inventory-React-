import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";

import type { User } from "@/features/auth/types";
import { accessState } from "@/shared/access/access-state";
import { transitionToAccount } from "@/shared/auth/account-transition";

function user(id: number): User {
  return {
    id,
    first_name: "Test",
    last_name: String(id),
    username: `user-${id}`,
    email: null,
    phone: null,
    industry_id: null,
    plan: "free",
    is_active: true,
    is_admin: false,
    role: "USER",
    is_system_admin: false,
    subscription_started_at: null,
    subscription_expires_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("authenticated account transition", () => {
  beforeEach(() => accessState.clear());

  it("removes cached operational data before switching users", () => {
    const queryClient = new QueryClient();
    accessState.saveUser(user(1));
    queryClient.setQueryData(["products", "list"], [{ id: 101 }]);
    queryClient.setQueryData(["dashboard", "stats"], { total: 1 });

    transitionToAccount(queryClient, user(2));

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(accessState.user()?.id).toBe(2);
  });

  it("preserves the current account cache during same-user reauthentication", () => {
    const queryClient = new QueryClient();
    accessState.saveUser(user(1));
    queryClient.setQueryData(["products", "list"], [{ id: 101 }]);

    transitionToAccount(queryClient, { ...user(1), first_name: "Updated" });

    expect(queryClient.getQueryData(["products", "list"])).toEqual([{ id: 101 }]);
    expect(accessState.user()?.first_name).toBe("Updated");
  });
});

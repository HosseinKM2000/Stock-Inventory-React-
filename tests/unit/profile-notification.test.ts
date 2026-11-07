import { describe, expect, it } from "vitest";
import type { User } from "@/features/auth/types";
import { notificationService } from "@/features/notifications/services/notification.service";

function user(overrides: Partial<User> = {}): User {
  return {
    id: 11,
    first_name: null,
    last_name: null,
    username: "owner",
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
    created_at: "2026-11-03T00:00:00Z",
    store_id: 21,
    is_store_owner: true,
    ...overrides,
  };
}

describe("profile completion reminder", () => {
  it("derives one actionable informational reminder for an incomplete owner", () => {
    const notifications = notificationService.deriveProfile(user());
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      id: "profile-completion",
      kind: "profile_completion",
      severity: "info",
      route: "/setting/profile",
    });
  });

  it("stays visible after viewing and resolves only when the profile is complete", () => {
    const incomplete = user();
    expect(notificationService.deriveProfile(incomplete)).toHaveLength(1);
    expect(notificationService.deriveProfile(incomplete)).toHaveLength(1);
    expect(notificationService.deriveProfile(user({
      first_name: "Sara",
      last_name: "Ahmadi",
      phone: "09120000000",
      email: "sara@example.com",
    }))).toEqual([]);
  });

  it("does not ask personnel or the isolated administrator workspace to edit owner profile data", () => {
    expect(notificationService.deriveProfile(user({ id: 12, is_store_owner: false }))).toEqual([]);
    expect(notificationService.deriveProfile(user({ id: 13, is_system_admin: true }))).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { User } from "@/features/auth/types";
import {
  managementNavigationItems,
  primaryNavigationItems,
  settingsNavigationItems,
  toolsNavigationItems,
  visibleNavigationItems,
} from "@/features/app/layout/navigation-items";
import {
  contextualBackFallback,
  contextualSection,
} from "@/shared/lib/navigation/contextual-back";

const standardUser: User = {
  id: 1,
  first_name: "Test",
  last_name: "User",
  username: "test-user",
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

describe("navigation metadata", () => {
  it("keeps Settings in primary navigation and Management out of the bottom menu", () => {
    expect(primaryNavigationItems(standardUser).map((item) => item.to)).toEqual([
      "/dashboard",
      "/inventory/list",
      "/tools",
      "/setting",
    ]);
    expect(primaryNavigationItems({ ...standardUser, role: "ADMIN" }).map((item) => item.to)).toEqual([
      "/dashboard",
      "/inventory/list",
      "/tools",
      "/setting",
    ]);
  });

  it("separates personal subscription, tools, and administrative destinations", () => {
    expect(settingsNavigationItems.map((item) => item.to)).toContain("/setting/subscription");
    expect(settingsNavigationItems.map((item) => item.to)).toContain("/setting/sync");
    expect(toolsNavigationItems.map((item) => item.to)).toEqual([
      "/tools/activity",
      "/tools/help",
      "/tools/import",
      "/tools/labels",
      "/tools/categories",
      "/tools/export",
      "/tools/catalog",
      "/tools/recovery",
    ]);
    expect(managementNavigationItems.map((item) => item.to)).toContain("/management/subscriptions");
    expect(visibleNavigationItems(managementNavigationItems, standardUser)).toEqual([]);
    expect(visibleNavigationItems(managementNavigationItems, { ...standardUser, is_admin: true })).toHaveLength(4);
  });
});

describe("contextual header back navigation", () => {
  it.each([
    ["/setting", "settings"],
    ["/setting/profile", "settings"],
    ["/tools", "tools"],
    ["/tools/export", "tools"],
    ["/dashboard", null],
    ["/management", null],
  ])("scopes %s to %s", (pathname, section) => {
    expect(contextualSection(pathname)).toBe(section);
  });

  it.each([
    ["/setting", "/dashboard"],
    ["/setting/security", "/setting"],
    ["/tools", "/dashboard"],
    ["/tools/recovery", "/tools"],
  ])("provides a deterministic fallback from %s", (pathname, fallback) => {
    expect(contextualBackFallback(pathname)).toBe(fallback);
  });
});

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/features/auth/types";

const state = vi.hoisted(() => ({
  online: true,
  user: null as User | null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

vi.mock("@/shared/auth/use-auth", () => ({
  useAuth: () => ({ user: state.user }),
}));

vi.mock("@/shared/lib/infrastructure/sync/use-sync-status", () => ({
  useOnline: () => state.online,
}));

import { QuickAccessPage } from "@/features/app/layout/quick-access-page";
import {
  managementNavigationItems,
  settingsNavigationItems,
} from "@/features/app/layout/navigation-items";

const user: User = {
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

describe("quick-access navigation", () => {
  beforeEach(() => {
    state.user = user;
    state.online = true;
  });

  it("renders semantic links to dedicated Settings pages", () => {
    render(
      <QuickAccessPage
        title="تنظیمات"
        description="تنظیمات حساب"
        items={settingsNavigationItems}
      />,
    );

    expect(screen.getByRole("navigation", { name: "تنظیمات" })).toBeVisible();
    expect(screen.getByRole("link", { name: /پروفایل/ })).toHaveAttribute("href", "/setting/profile");
    expect(screen.getByRole("link", { name: /امنیت/ })).toHaveAttribute("href", "/setting/security");
    expect(screen.getByRole("link", { name: /اشتراک/ })).toHaveAttribute("href", "/setting/subscription");
  });

  it("hides admin entries from standard users and exposes them to administrators", () => {
    const { rerender } = render(
      <QuickAccessPage title="مدیریت" description="مدیریت سامانه" items={managementNavigationItems} />,
    );
    expect(screen.queryAllByRole("link")).toHaveLength(0);

    state.user = { ...user, role: "ADMIN" };
    rerender(
      <QuickAccessPage title="مدیریت" description="مدیریت سامانه" items={managementNavigationItems} />,
    );
    expect(screen.getByRole("link", { name: /مدیریت اشتراک‌ها/ })).toHaveAttribute(
      "href",
      "/management/subscriptions",
    );
  });

  it("marks server-dependent destinations without blocking local navigation offline", () => {
    state.online = false;
    render(
      <QuickAccessPage
        title="تنظیمات"
        description="تنظیمات حساب"
        items={settingsNavigationItems}
      />,
    );

    expect(screen.getAllByText("نیازمند اینترنت").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /ظاهر/ })).toBeVisible();
  });
});

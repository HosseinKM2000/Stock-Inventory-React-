import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: "USER" }));
vi.mock("@/shared/auth/use-auth", () => ({ useAuth: () => ({ user: { role: state.role, is_admin: state.role === "ADMIN", is_system_admin: false } }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { canGoBack: () => false, back: vi.fn() } }),
  useRouterState: ({ select }: { select: (routerState: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: "/tools/help" } }),
}));

import { HelpPage } from "@/features/help/help-page";

describe("Persian help", () => {
  it("provides categorized navigation and direct feature links", () => {
    render(<HelpPage />);
    expect(screen.getByRole("navigation", { name: "بخش‌های راهنما" })).toBeVisible();
    expect(screen.getByRole("link", { name: "وضعیت همگام‌سازی" })).toHaveAttribute("href", "/setting/sync");
    expect(screen.getByText(/ذخیره محلی روی همین مرورگر/)).toBeVisible();
  });

  it("shows administrator instructions only to administrators", () => {
    const view = render(<HelpPage />);
    expect(screen.queryByText("راهنمای مدیر")).not.toBeInTheDocument();
    state.role = "ADMIN";
    view.rerender(<HelpPage />);
    expect(screen.getByRole("heading", { name: "راهنمای مدیر" })).toBeVisible();
    state.role = "USER";
  });
});

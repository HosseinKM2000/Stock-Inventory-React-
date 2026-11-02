import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@radix-ui/themes";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  capacity: vi.fn(),
  roles: vi.fn(),
  personnel: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  resetCredentials: vi.fn(),
  operatingMode: vi.fn(),
  activateTeam: vi.fn(),
}));

const activation = vi.hoisted(() => ({ activate: vi.fn() }));

vi.mock("@/features/app/layout/page-guide", () => ({
  PageGuide: ({ section, title }: { section: string; title: string }) => (
    <header>
      <nav aria-label="مسیر صفحه">{section}</nav>
      <h1>{title}</h1>
    </header>
  ),
}));

vi.mock("@/shared/access/online-guard", () => ({
  OnlineGuard: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock("@/features/personnel/api", () => ({
  personnelKeys: {
    all: ["store-personnel"],
    roles: ["store-roles"],
    capacity: ["personnel-capacity"],
    mode: ["store-operating-mode"],
  },
  personnelApi: api,
}));

vi.mock("@/features/personnel/services/team-activation.service", () => ({
  teamActivationService: activation,
}));

import { PersonnelPage } from "@/features/personnel/personnel-page";

const member = {
  membership_id: 7,
  user_id: 70,
  first_name: "تست",
  last_name: "تستی",
  username: "test.person",
  role_id: 2,
  role_name: "مشاهده‌گر",
  active: true,
  temporary_password_required: true,
  credentials_notice_viewed: false,
  created_at: "2026-10-20T08:00:00Z",
  last_activity_at: null,
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Theme><PersonnelPage /></Theme>
    </QueryClientProvider>,
  );
}

describe("personnel page", () => {
  beforeEach(() => {
    api.capacity.mockResolvedValue({ enabled: true, used: 1, limit: 4, available: 3 });
    api.roles.mockResolvedValue([{ id: 2, name: "مشاهده‌گر", permissions: [], assigned_count: 1 }]);
    api.personnel.mockResolvedValue([member]);
    api.operatingMode.mockResolvedValue({ operating_mode: "team", policy_version: 2, team_eligible: true });
    api.resetCredentials.mockResolvedValue({ ...member, temporary_password: "temporary-secret" });
    activation.activate.mockResolvedValue({ operating_mode: "team", policy_version: 2 });
  });

  it("shows the responsive management sections and member controls", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "پرسنل مجموعه", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "مسیر صفحه" })).toHaveTextContent("تنظیمات");
    expect(await screen.findByRole("heading", { name: "افزودن پرسنل" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "اعضای پرسنل" })).toBeInTheDocument();
    expect(await screen.findByText("تست تستی")).toBeInTheDocument();
    expect(screen.getByText(/۳ جایگاه باقی‌مانده/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "غیرفعال کردن" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /رمز موقت تازه/ })).toBeInTheDocument();
  });

  it("reveals reset credentials once with separate copy actions", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /رمز موقت تازه/ }));

    await waitFor(() => expect(api.resetCredentials).toHaveBeenCalledWith(7, expect.any(Object)));
    expect(await screen.findByRole("heading", { name: /اطلاعات ورود فقط همین‌بار/ })).toBeInTheDocument();
    expect(screen.getByText("temporary-secret")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "کپی نام کاربری" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "کپی رمز موقت" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /کپی اطلاعات ورود/ })).toBeInTheDocument();
  });

  it("requires an explicit activation before personnel controls are shown", async () => {
    api.operatingMode.mockResolvedValue({ operating_mode: "solo", policy_version: 1, team_eligible: true });
    renderPage();
    expect(await screen.findByRole("heading", { name: "فعال‌سازی صریح حالت تیمی" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "افزودن پرسنل" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "فعال‌سازی حالت تیمی" }));
    await waitFor(() => expect(activation.activate).toHaveBeenCalledWith(1));
  });
});

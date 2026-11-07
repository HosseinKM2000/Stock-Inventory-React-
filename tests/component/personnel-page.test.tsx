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
}));

vi.mock("@/features/app/layout/page-guide", () => ({
  PageGuide: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/shared/access/online-guard", () => ({
  OnlineGuard: ({ children }: React.PropsWithChildren) => children,
}));

vi.mock("@/features/personnel/api", () => ({
  personnelKeys: {
    all: ["store-personnel"],
    roles: ["store-roles"],
    capacity: ["personnel-capacity"],
  },
  personnelApi: api,
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
    api.resetCredentials.mockResolvedValue({ ...member, temporary_password: "temporary-secret" });
  });

  it("shows the responsive management sections and member controls", async () => {
    renderPage();

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
});

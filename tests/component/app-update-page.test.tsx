import { render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUpdateSnapshot } from "@/features/app-update/types";

const mocks = vi.hoisted(() => ({
  update: null as AppUpdateSnapshot | null,
  canUse: vi.fn(),
  check: vi.fn(),
  activate: vi.fn(),
}));

vi.mock("@/features/app-update/hooks/use-app-update", () => ({ useAppUpdate: () => mocks.update }));
vi.mock("@/features/app-update/services/app-update.service", () => ({
  appUpdateService: { checkForUpdate: mocks.check, activateUpdate: mocks.activate },
}));
vi.mock("@/shared/access/use-entitlement", () => ({
  useEntitlementAccess: () => ({ requiresOnlineVerification: false }),
}));
vi.mock("@/shared/access/access-state", () => ({ accessState: { canUse: mocks.canUse } }));
vi.mock("@/shared/api/query-client", () => ({ queryClient: { isMutating: () => 0 } }));
vi.mock("@/features/app/layout/page-guide", () => ({
  PageGuide: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { AppUpdatePage } from "@/features/app-update/components/app-update-page";

describe("app update settings", () => {
  beforeEach(() => {
    mocks.canUse.mockReset();
    mocks.canUse.mockImplementation((capability: string) => capability === "inventory.write");
    mocks.update = {
      status: "available",
      currentVersion: "0.11.0",
      release: {
        version: "0.12.0",
        released_at: "2026-10-21T00:00:00+03:30",
        title: "نسخه تازه تنظیم",
        summary: "بهبودهای تازه",
        features: [
          { title: "موجودی", description: "کنترل موجودی", capability: "inventory.write" },
          { title: "بارکد", description: "مدیریت بارکد", capability: "barcode.manage" },
        ],
      },
      lastCheckedAt: "2026-10-21T00:00:00+03:30",
      canInstall: true,
      error: null,
    };
  });

  it("shows the ready release and evaluates features against verified subscription access", () => {
    render(<Theme><AppUpdatePage /></Theme>);
    expect(screen.getByRole("heading", { name: "بروزرسانی برنامه" })).toBeInTheDocument();
    expect(screen.getByText("۰.۱۱.۰")).toBeInTheDocument();
    expect(screen.getByText("۰.۱۲.۰")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /نصب نسخه جدید/ })).toBeEnabled();
    expect(screen.getByText("فعال در طرح شما")).toBeInTheDocument();
    expect(screen.getByText("نیازمند طرح بالاتر")).toBeInTheDocument();
  });
});

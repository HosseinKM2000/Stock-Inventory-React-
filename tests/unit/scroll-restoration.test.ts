import { describe, expect, it } from "vitest";
import {
  accountScrollRestorationKey,
  consumeDashboardReturnAnchor,
  rememberDashboardReturnAnchor,
} from "@/shared/lib/navigation/scroll-restoration";

describe("account-scoped scroll restoration", () => {
  it("keeps the same history entry separate across account changes", () => {
    const location = {
      href: "/dashboard",
      pathname: "/dashboard",
      state: { __TSR_key: "dashboard-history-entry" },
    } as never;
    expect(accountScrollRestorationKey(location, 11)).toBe("11:dashboard");
    expect(accountScrollRestorationKey(location, 22)).toBe("22:dashboard");
  });

  it("does not reuse dashboard positions for unrelated routes", () => {
    const location = {
      href: "/inventory/list",
      pathname: "/inventory/list",
      state: { __TSR_key: "inventory-entry" },
    } as never;
    expect(accountScrollRestorationKey(location, 11)).toBe("11:inventory-entry");
  });

  it("consumes the originating section without leaking it across accounts", () => {
    rememberDashboardReturnAnchor(11, "dashboard-section-highest-value");

    expect(consumeDashboardReturnAnchor(22)).toBeNull();
    expect(consumeDashboardReturnAnchor(11)).toBe("dashboard-section-highest-value");
    expect(consumeDashboardReturnAnchor(11)).toBeNull();
  });
});

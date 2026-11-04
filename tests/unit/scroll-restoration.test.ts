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
    expect(accountScrollRestorationKey(location, 11, 101)).toBe("11:101:dashboard");
    expect(accountScrollRestorationKey(location, 22, 202)).toBe("22:202:dashboard");
  });

  it("does not reuse dashboard positions for unrelated routes", () => {
    const location = {
      href: "/inventory/list",
      pathname: "/inventory/list",
      state: { __TSR_key: "inventory-entry" },
    } as never;
    expect(accountScrollRestorationKey(location, 11, 101)).toBe("11:101:inventory-entry");
  });

  it("consumes the originating section without leaking it across accounts", () => {
    rememberDashboardReturnAnchor(11, "dashboard-section-highest-value", 101);

    expect(consumeDashboardReturnAnchor(11, 202)).toBeNull();
    expect(consumeDashboardReturnAnchor(11, 101)).toBe("dashboard-section-highest-value");
    expect(consumeDashboardReturnAnchor(11, 101)).toBeNull();
  });
});

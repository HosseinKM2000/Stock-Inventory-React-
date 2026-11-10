import { act, fireEvent, render, screen } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConnectionStatus from "@/features/app/layout/connection-status";
import type { SyncStatus } from "@/shared/lib/infrastructure/sync/sync-status";

const syncServiceMocks = vi.hoisted(() => ({ retry: vi.fn() }));

let online = true;
let status: SyncStatus = {
  state: "idle",
  pending: 0,
  lastSyncedAt: null,
  error: null,
};

vi.mock("@/shared/lib/infrastructure/sync/use-sync-status", () => ({
  useOnline: () => online,
  useSyncStatus: () => status,
}));

vi.mock("@/shared/access/subscription-limit", () => ({
  notifySubscriptionRestriction: vi.fn(),
}));

vi.mock("@/shared/lib/infrastructure/sync/sync-service", () => ({
  syncService: syncServiceMocks,
}));

describe("header connection status", () => {
  const renderStatus = () => render(<Theme><ConnectionStatus /></Theme>);

  beforeEach(() => {
    vi.useFakeTimers();
    syncServiceMocks.retry.mockReset();
    online = true;
    status = { state: "idle", pending: 0, lastSyncedAt: null, error: null };
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("reveals on click and closes automatically", () => {
    renderStatus();
    const badge = screen.getByRole("button", { name: /نمایش وضعیت همگام‌سازی/ });
    const control = badge.closest(".sync-status-control");

    expect(control).toHaveAttribute("data-revealed", "false");
    expect(badge).not.toHaveAttribute("href");
    fireEvent.click(badge);
    expect(control).toHaveAttribute("data-revealed", "true");

    act(() => vi.advanceTimersByTime(4_000));
    expect(control).toHaveAttribute("data-revealed", "false");
  });

  it("reveals again with the current result whenever status changes", () => {
    const { rerender } = renderStatus();
    const badge = screen.getByRole("button", { name: /نمایش وضعیت همگام‌سازی/ });
    const control = badge.closest(".sync-status-control");

    status = { ...status, state: "syncing" };
    rerender(<Theme><ConnectionStatus /></Theme>);
    expect(control).toHaveAttribute("data-revealed", "true");
    expect(control).toHaveTextContent("ارسال");

    status = { ...status, state: "synced", lastSyncedAt: Date.now() };
    rerender(<Theme><ConnectionStatus /></Theme>);
    expect(control).toHaveAttribute("data-status", "success");
    expect(control).toHaveTextContent("همگام");

    act(() => vi.advanceTimersByTime(3_999));
    expect(control).toHaveAttribute("data-revealed", "true");
    act(() => vi.advanceTimersByTime(1));
    expect(control).toHaveAttribute("data-revealed", "false");
  });

  it("offers a compact sync action for an online backlog", () => {
    status = { ...status, pending: 3 };
    renderStatus();

    fireEvent.click(screen.getByRole("button", { name: /نمایش وضعیت همگام‌سازی/ }));
    expect(screen.getByText("۳ صف")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "همگام‌سازی اکنون" }));

    expect(syncServiceMocks.retry).toHaveBeenCalledTimes(1);
  });
});

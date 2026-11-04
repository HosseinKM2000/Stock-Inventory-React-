import { notificationService } from "@/features/notifications/services/notification.service";
import type { AppUpdateSnapshot } from "@/features/app-update/types";
import { describe, expect, it } from "vitest";

const state = (status: AppUpdateSnapshot["status"]): AppUpdateSnapshot => ({
  status,
  currentVersion: "0.11.0",
  release: {
    version: "0.12.0",
    released_at: "2026-10-21T00:00:00+03:30",
    title: "نسخه تازه",
    summary: "امکانات تازه آماده است.",
    features: [],
  },
  lastCheckedAt: "2026-10-21T00:00:00+03:30",
  canInstall: status === "ready" || status === "deferred",
  error: null,
});

describe("app update notifications", () => {
  it("keeps a ready release in the notification center until installation", () => {
    expect(notificationService.deriveUpdate(state("ready"))).toEqual([
      expect.objectContaining({
        id: "app-update-ready",
        severity: "info",
        route: "/setting/update",
        context: "نسخه 0.12.0",
      }),
    ]);
    expect(notificationService.deriveUpdate(state("applying"))).toHaveLength(1);
    expect(notificationService.deriveUpdate(state("deferred"))).toHaveLength(1);
  });

  it("does not notify when the installed release is current", () => {
    expect(notificationService.deriveUpdate(state("current"))).toEqual([]);
  });
});

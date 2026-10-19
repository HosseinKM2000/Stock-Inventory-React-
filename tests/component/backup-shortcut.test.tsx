import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackupShortcut } from "@/features/backup/components/backup-shortcut";
import type { BackupStatus } from "@/features/backup/types";

const mocks = vi.hoisted(() => ({
  setup: vi.fn(),
  saveNow: vi.fn(),
  status: null as BackupStatus | null,
}));

vi.mock("@/features/backup/hooks/use-backup-status", () => ({
  useBackupStatus: () => mocks.status,
}));
vi.mock("@/features/backup/services/backup-service", () => ({
  backupService: { setup: mocks.setup, saveNow: mocks.saveNow },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

function backupStatus(onboardingCompleted: boolean): BackupStatus {
  return {
    currentRevision: "new",
    hasRecoverableData: true,
    dirty: true,
    busy: false,
    settings: {
      userId: 1,
      mode: "directory",
      onboardingCompleted,
      automaticEnabled: true,
      intervalMs: 300_000,
      permission: "granted",
      lastSuccessfulAt: null,
      lastSuccessfulRevision: onboardingCompleted ? "old" : null,
      lastFailure: null,
      retryCount: 0,
      nextAttemptAt: 0,
      restoreRequiresReview: false,
    },
  };
}

const renderShortcut = () => render(<Theme><BackupShortcut /></Theme>);

describe("header backup shortcut", () => {
  beforeEach(() => {
    mocks.status = backupStatus(false);
    mocks.setup.mockReset();
    mocks.saveNow.mockReset();
  });

  it("describes the pending state and shows Persian onboarding only on first use", () => {
    renderShortcut();
    fireEvent.click(screen.getByRole("button", { name: /تغییرات ذخیره‌نشده/ }));
    expect(screen.getByText(/برای اطمینان بیشتر/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ذخیره فایل پشتیبان" })).toBeInTheDocument();
    expect(mocks.saveNow).not.toHaveBeenCalled();
  });

  it("treats picker cancellation as a quiet, incomplete setup", async () => {
    mocks.setup.mockResolvedValue("cancelled");
    renderShortcut();
    fireEvent.click(screen.getByRole("button", { name: /تغییرات ذخیره‌نشده/ }));
    fireEvent.click(screen.getByRole("button", { name: "ذخیره فایل پشتیبان" }));
    await waitFor(() => expect(mocks.setup).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText(/برای اطمینان بیشتر/)).not.toBeInTheDocument());
  });

  it("updates directly after setup without reopening onboarding", async () => {
    mocks.status = backupStatus(true);
    mocks.saveNow.mockResolvedValue("saved");
    renderShortcut();
    fireEvent.click(screen.getByRole("button", { name: /تغییرات ذخیره‌نشده/ }));
    await waitFor(() => expect(mocks.saveNow).toHaveBeenCalledWith({ interactive: true }));
    expect(screen.queryByText(/برای اطمینان بیشتر/)).not.toBeInTheDocument();
  });
});

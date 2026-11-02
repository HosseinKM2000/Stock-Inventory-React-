import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), saveUser: vi.fn(),
  sessions: vi.fn(), items: vi.fn(),
  prepareDrain: vi.fn(), sync: vi.fn(), syncWithinLock: vi.fn(), queue: vi.fn(),
  activate: vi.fn(), getMe: vi.fn(),
}));

function table(result: ReturnType<typeof vi.fn>) {
  return { where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: result })) })) };
}

vi.mock("@/shared/access/access-state", () => ({ accessState: { user: mocks.user, saveUser: mocks.saveUser } }));
vi.mock("@/shared/lib/infrastructure/storage/db", () => ({
  db: { recoverySessions: table(mocks.sessions), recoveryItems: table(mocks.items) },
}));
vi.mock("@/shared/lib/infrastructure/sync/queue.service", () => ({
  queueService: { prepareActivationDrain: mocks.prepareDrain, getAll: mocks.queue },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-service", () => ({
  syncService: { sync: mocks.sync, syncWithinOutboxLock: mocks.syncWithinLock },
}));
vi.mock("@/features/personnel/api", () => ({ personnelApi: { activateTeam: mocks.activate } }));
vi.mock("@/features/auth/api/auth.api", () => ({ getMe: mocks.getMe }));

import { teamActivationService } from "@/features/personnel/services/team-activation.service";

describe("team activation inventory", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.user.mockReturnValue({ id: 7, store_id: 3 });
    mocks.sessions.mockResolvedValue([]);
    mocks.items.mockResolvedValue([]);
    mocks.prepareDrain.mockResolvedValue(undefined);
    mocks.sync.mockResolvedValue(undefined);
    mocks.syncWithinLock.mockResolvedValue(undefined);
    mocks.queue.mockResolvedValue([]);
    mocks.activate.mockResolvedValue({ operating_mode: "team", policy_version: 2 });
    mocks.getMe.mockResolvedValue({ id: 7, store_id: 3, store_operating_mode: "team", store_policy_version: 2 });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: vi.fn((_name: string, callback: () => unknown) => callback()) },
    });
  });

  it("drains eligible retryable work before the atomic transition", async () => {
    const result = await teamActivationService.activate(1);
    expect(result).toMatchObject({ operating_mode: "team", policy_version: 2 });
    expect(navigator.locks.request).toHaveBeenNthCalledWith(1, "tanzim-mode-activation:7", expect.any(Function));
    expect(navigator.locks.request).toHaveBeenNthCalledWith(2, "tanzim-outbox-sync", expect.any(Function));
    expect(navigator.locks.request).toHaveBeenNthCalledWith(3, "tanzim-local-mutations:7", expect.any(Function));
    expect(mocks.sync).toHaveBeenCalledBefore(mocks.prepareDrain);
    expect(mocks.prepareDrain).toHaveBeenCalledBefore(mocks.syncWithinLock);
    expect(mocks.syncWithinLock).toHaveBeenCalledBefore(mocks.queue);
    expect(mocks.activate).toHaveBeenCalledWith(1, expect.any(String));
    expect(mocks.saveUser).toHaveBeenCalledWith(expect.objectContaining({ store_operating_mode: "team" }));
    expect(localStorage.getItem("tanzim:7:mode-activation-maintenance")).toBeNull();
  });

  it("blocks unresolved recovery or any remaining outbox state", async () => {
    mocks.sessions.mockResolvedValue([{ status: "review" }]);
    await expect(teamActivationService.activate(1)).rejects.toThrow("TEAM_ACTIVATION_RECOVERY_UNRESOLVED");
    expect(mocks.activate).not.toHaveBeenCalled();

    mocks.sessions.mockResolvedValue([]);
    mocks.queue.mockResolvedValue([{ status: "conflict" }]);
    await expect(teamActivationService.activate(1)).rejects.toThrow("TEAM_ACTIVATION_OUTBOX_UNRESOLVED");
    expect(mocks.activate).not.toHaveBeenCalled();
  });

  it("reuses the durable transition identity after a lost activation response", async () => {
    mocks.activate
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({ operating_mode: "team", policy_version: 2 });

    await expect(teamActivationService.activate(1)).rejects.toThrow("response lost");
    expect(localStorage.getItem("tanzim:7:3:team-activation-intent")).not.toBeNull();
    expect(localStorage.getItem("tanzim:7:mode-activation-maintenance")).toBeNull();

    await expect(teamActivationService.activate(1)).resolves.toMatchObject({ operating_mode: "team" });
    expect(mocks.activate.mock.calls[1][1]).toBe(mocks.activate.mock.calls[0][1]);
    expect(localStorage.getItem("tanzim:7:3:team-activation-intent")).toBeNull();
  });
});

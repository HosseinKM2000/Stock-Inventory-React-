import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  offline: vi.fn(),
  enqueue: vi.fn(),
  sync: vi.fn(),
  getAll: vi.fn(),
}));

vi.mock("@/shared/access/access-state", () => ({ accessState: { user: mocks.user } }));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({
  networkService: { isOffline: mocks.offline },
}));
vi.mock("@/shared/lib/infrastructure/sync/queue.service", () => ({
  queueService: { enqueue: mocks.enqueue, getAll: mocks.getAll },
}));
vi.mock("@/shared/lib/infrastructure/sync/sync-service", () => ({
  syncService: { sync: mocks.sync },
}));

import { teamCommandService } from "@/shared/lib/infrastructure/sync/team-command.service";

const COMMAND_1 = "00000000-0000-4000-8000-000000000001";
const COMMAND_2 = "00000000-0000-4000-8000-000000000002";

describe("team server-accepted commands", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.user.mockReturnValue({ id: 7, store_operating_mode: "team", store_policy_version: 4 });
    mocks.offline.mockReturnValue(false);
    mocks.enqueue.mockResolvedValue(COMMAND_1);
    mocks.sync.mockResolvedValue(undefined);
    mocks.getAll.mockResolvedValue([]);
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: vi.fn((_name: string, callback: () => unknown) => callback()) },
    });
  });

  it("persists policy context before dispatch and waits for a resolved result", async () => {
    const order: string[] = [];
    mocks.enqueue.mockImplementation(async () => { order.push("persist"); });
    mocks.sync.mockImplementation(async () => { order.push("dispatch"); });

    await expect(teamCommandService.submit("product", 9, "UPDATE", { version: 2 }, COMMAND_1))
      .resolves.toBe(COMMAND_1);

    expect(order).toEqual(["persist", "dispatch"]);
    expect(mocks.enqueue).toHaveBeenCalledWith("product", 9, "UPDATE", { version: 2 }, {
      operationId: COMMAND_1,
      forceNew: true,
      executionMode: "team",
      policyVersion: 4,
    });
  });

  it("keeps an unknown-outcome command for same-id retry and never creates an offline draft", async () => {
    const unresolved = { operationId: COMMAND_1, entity: "product", entityId: 9, payload: {}, status: "retryable_error", lastError: "network" };
    mocks.getAll.mockResolvedValueOnce([]).mockResolvedValue([unresolved]);
    await expect(teamCommandService.submit("product", 9, "UPDATE", {}, COMMAND_1)).rejects.toThrow("network");
    expect(mocks.enqueue).toHaveBeenCalledOnce();

    mocks.enqueue.mockClear();
    await expect(teamCommandService.submit("product", 9, "UPDATE", {}, COMMAND_2)).rejects.toThrow("TEAM_PREDECESSOR_UNRESOLVED");
    expect(mocks.enqueue).not.toHaveBeenCalled();

    mocks.offline.mockReturnValue(true);
    await expect(teamCommandService.submit("product", 9, "UPDATE", {}, COMMAND_2)).rejects.toThrow("TEAM_ONLINE_REQUIRED");
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("does not dispatch when durable command storage fails", async () => {
    mocks.enqueue.mockRejectedValue(new Error("indexeddb unavailable"));
    await expect(teamCommandService.submit("product", 9, "UPDATE", {}, COMMAND_1))
      .rejects.toThrow("indexeddb unavailable");
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("coordinates the resource through a cross-tab Web Lock", async () => {
    await teamCommandService.submit("product", 9, "UPDATE", {}, COMMAND_1);
    expect(navigator.locks.request).toHaveBeenCalledWith(
      "tanzim-team-command:7:7:product:9",
      expect.any(Function),
    );
  });
});

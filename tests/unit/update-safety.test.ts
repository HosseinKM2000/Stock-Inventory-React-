import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dirty: false,
  mutating: 0,
  sessions: [] as Array<{ status: string }>,
  user: { id: 7, store_id: 11 } as { id: number; store_id: number } | null,
}));

vi.mock("@/features/app-update/services/unsaved-work", () => ({
  unsavedWork: { hasAny: () => mocks.dirty },
}));
vi.mock("@/shared/api/query-client", () => ({
  queryClient: { isMutating: () => mocks.mutating },
}));
vi.mock("@/shared/access/access-state", () => ({
  accessState: { user: () => mocks.user },
}));
vi.mock("@/shared/lib/infrastructure/storage/db", () => ({
  db: {
    recoverySessions: {
      where: () => ({ equals: () => ({ filter: () => ({ toArray: async () => mocks.sessions }) }) }),
    },
  },
}));

import { activateWhenSafe } from "@/features/app-update/services/update-safety";

describe("safe update activation", () => {
  beforeEach(() => {
    mocks.dirty = false;
    mocks.mutating = 0;
    mocks.sessions = [];
    mocks.user = { id: 7, store_id: 11 };
  });

  it("uses the established update, outbox, then local-mutation lock order", async () => {
    const order: string[] = [];
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: async (name: string, _options: LockOptions, callback: (lock: object) => unknown) => {
          order.push(name);
          return callback({});
        },
      },
    });
    const activate = vi.fn();

    await expect(activateWhenSafe(activate)).resolves.toBeNull();
    expect(order).toEqual([
      "tanzim-app-update-activation",
      "tanzim-outbox-sync",
      "tanzim-local-mutations:7",
    ]);
    expect(activate).toHaveBeenCalledOnce();
  });

  it("defers unsaved forms and critical restore stages but not durable journals", async () => {
    const request = vi.fn(async (_name: string, _options: LockOptions, callback: (lock: object) => unknown) => callback({}));
    Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
    const activate = vi.fn();

    mocks.dirty = true;
    await expect(activateWhenSafe(activate)).resolves.toBe("unsaved_form");
    mocks.dirty = false;
    mocks.sessions = [{ status: "media_staged" }];
    await expect(activateWhenSafe(activate)).resolves.toBe("critical_recovery");
    mocks.sessions = [{ status: "review" }, { status: "failed" }];
    await expect(activateWhenSafe(activate)).resolves.toBeNull();
    expect(activate).toHaveBeenCalledOnce();
  });

  it("defers when another tab owns a coordinated lock", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: async (_name: string, _options: LockOptions, callback: (lock: null) => unknown) => callback(null) },
    });
    await expect(activateWhenSafe(vi.fn())).resolves.toBe("another_tab");
  });
});

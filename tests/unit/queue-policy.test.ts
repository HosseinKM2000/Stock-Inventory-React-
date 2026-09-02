import { describe, expect, it } from "vitest";
import { backoffDelay, consolidate, MAX_RETRIES } from "@/shared/lib/infrastructure/sync/queue.service";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";

function pending(action: SyncQueueItem["action"], payload: unknown = { a: 1 }): SyncQueueItem {
  return {
    id: "1:product-1",
    ownerUserId: 1,
    operationId: "operation-1",
    entity: "product",
    entityId: 1,
    action,
    payload,
    createdAt: 1,
    updatedAt: 1,
    retryCount: 0,
    status: "pending",
    nextAttemptAt: 1,
  };
}

describe("durable outbox consolidation", () => {
  it("cancels an offline create followed by delete", () => {
    expect(consolidate(pending("CREATE"), "DELETE", null)).toBeNull();
  });

  it("preserves CREATE while merging later edits", () => {
    expect(consolidate(pending("CREATE", { name: "A", quantity: 1 }), "UPDATE", { quantity: 2 }))
      .toEqual({ action: "CREATE", payload: { name: "A", quantity: 2 } });
  });

  it("turns recreation after a queued delete into an update", () => {
    expect(consolidate(pending("DELETE", null), "CREATE", { quantity: 2 }))
      .toEqual({ action: "UPDATE", payload: { quantity: 2 } });
  });

  it("does not cancel a create already sent in flight", () => {
    expect(consolidate({ ...pending("CREATE"), status: "in_flight" }, "DELETE", null))
      .toEqual({ action: "DELETE", payload: null });
  });

  it("uses bounded exponential backoff", () => {
    expect(backoffDelay(0)).toBe(5_000);
    expect(backoffDelay(1)).toBe(10_000);
    expect(backoffDelay(MAX_RETRIES + 20)).toBe(300_000);
  });
});

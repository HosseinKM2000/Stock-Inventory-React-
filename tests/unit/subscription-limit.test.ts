import { describe, expect, it } from "vitest";
import {
  SubscriptionRestrictionError,
  inventoryCapacityNotice,
  subscriptionRestrictionFrom,
  subscriptionRestrictionMessage,
} from "@/shared/access/subscription-limit";
import { ApiError } from "@/shared/api/api-error";

describe("subscription restriction feedback", () => {
  it("includes the active plan limit in local capacity feedback", () => {
    const error = new SubscriptionRestrictionError(
      { code: "inventory_limit", plan: "رایگان", limit: 50 },
      "INVENTORY_LIMIT_REACHED",
    );
    const restriction = subscriptionRestrictionFrom(error);
    expect(restriction).toMatchObject({ code: "inventory_limit", limit: 50 });
    expect(subscriptionRestrictionMessage(restriction!)).toContain("۵۰");
  });

  it("maps the backend limit code into the same central feedback model", () => {
    expect(subscriptionRestrictionFrom(new ApiError(403, "INVENTORY_LIMIT_REACHED")))
      .toMatchObject({ code: "inventory_limit" });
  });

  it("warns progressively at 70, 85 and 95 percent without warning unlimited plans", () => {
    expect(inventoryCapacityNotice(139, 200)).toBeNull();
    expect(inventoryCapacityNotice(140, 200)?.level).toBe("approaching");
    expect(inventoryCapacityNotice(170, 200)?.level).toBe("near");
    expect(inventoryCapacityNotice(190, 200)?.level).toBe("critical");
    expect(inventoryCapacityNotice(200, 200)).toMatchObject({ level: "full", remaining: 0 });
    expect(inventoryCapacityNotice(10_000, null)).toBeNull();
  });
});

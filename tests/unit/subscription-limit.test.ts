import { describe, expect, it } from "vitest";
import {
  SubscriptionRestrictionError,
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
});

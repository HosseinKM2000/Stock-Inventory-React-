import { describe, expect, it } from "vitest";

import { sortPlansByPrice } from "@/features/setting/components/subscription-management/plan-options";

describe("subscription plan presentation", () => {
  it("orders plans from free through the highest configured price without mutating the response", () => {
    const plans = [
      { id: "team", price_toman: 900_000 },
      { id: "legacy", price_toman: null },
      { id: "free", price_toman: null },
      { id: "pro", price_toman: 300_000 },
    ] as const;

    const sorted = sortPlansByPrice(plans);

    expect(sorted.map((plan) => plan.id)).toEqual(["free", "pro", "team", "legacy"]);
    expect(plans.map((plan) => plan.id)).toEqual(["team", "legacy", "free", "pro"]);
  });
});

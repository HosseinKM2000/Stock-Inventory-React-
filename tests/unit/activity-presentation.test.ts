import { describe, expect, it } from "vitest";
import { presentActivity } from "@/features/personnel/activity-presentation";
import type { Activity } from "@/features/personnel/api";

function activity(patch: Partial<Activity> = {}): Activity {
  return {
    id: 1, actor_user_id: 2, actor_membership_id: 3, actor_display_name: "کاربر نمونه",
    actor_role_name: "انباردار", operation_id: "operation-safe-123", target_entity: "product",
    target_id: "991", action: "sync.update", before: null, after: { name: "چای", quantity: 4 },
    outcome: "applied", client_occurred_at: null, accepted_at: "2026-11-05T08:00:00Z", ...patch,
  };
}

describe("activity presentation", () => {
  it("describes a business action and keeps the technical id out of the primary copy", () => {
    const view = presentActivity(activity());
    expect(view.title).toBe("ویرایش محصول «چای»");
    expect(view.detail).toContain("تأیید مجموعه");
    expect(`${view.title} ${view.detail}`).not.toContain("operation-safe-123");
    expect(view.diagnostic).toContain("operation-safe-123");
  });

  it("does not invent missing legacy details and distinguishes rejection from conflict", () => {
    const sparse = presentActivity(activity({ action: "legacy.unknown", after: null, target_entity: "legacy", outcome: "rejected" }));
    expect(sparse.title).toBe("ثبت رویداد اطلاعات");
    expect(sparse.result).toContain("اطلاعات موجود تغییر نکرد");
    expect(presentActivity(activity({ outcome: "conflict" })).result).toContain("نیاز به بررسی");
  });

  it("only reads whitelisted human labels and never exposes price or token values", () => {
    const view = presentActivity(activity({ after: { purchase_price: 9000, token: "secret", description: "hidden" } }));
    expect(`${view.title} ${view.detail} ${view.result}`).not.toMatch(/9000|secret|hidden/);
  });

  it("describes a reliable stock delta when both accepted values exist", () => {
    const view = presentActivity(activity({ action: "inventory.scan.receive", target_entity: "inventory_movement", after: { name: "لنت جلو", before_quantity: 7, quantity: 12 } }));
    expect(view.detail).toBe("۵ عدد به موجودی اضافه شد (از ۷ به ۱۲).");
  });
});

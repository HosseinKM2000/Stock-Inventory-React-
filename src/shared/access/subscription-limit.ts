import { toast } from "sonner";
import { ApiError } from "@/shared/api/api-error";

export type SubscriptionRestriction = {
  code: "inventory_limit" | "capability";
  plan: string;
  limit?: number;
  capability?: string;
};

export class SubscriptionRestrictionError extends Error {
  readonly restriction: SubscriptionRestriction;

  constructor(restriction: SubscriptionRestriction, message: string) {
    super(message);
    this.name = "SubscriptionRestrictionError";
    this.restriction = restriction;
  }
}

export function subscriptionRestrictionFrom(error: unknown): SubscriptionRestriction | null {
  if (error instanceof SubscriptionRestrictionError) return error.restriction;
  if ((error instanceof ApiError || error instanceof Error) && error.message === "INVENTORY_LIMIT_REACHED") {
    return { code: "inventory_limit", plan: "فعلی" };
  }
  if ((error instanceof ApiError || error instanceof Error) && error.message.startsWith("CAPABILITY_REQUIRED:")) {
    return { code: "capability", plan: "فعلی", capability: error.message.split(":", 2)[1] };
  }
  return null;
}

export function subscriptionRestrictionMessage(restriction: SubscriptionRestriction) {
  if (restriction.code === "inventory_limit") {
    const allowed = restriction.limit == null
      ? "به سقف مجاز رسیده‌اید"
      : `طرح ${restriction.plan} تا ${restriction.limit.toLocaleString("fa-IR")} محصول را پشتیبانی می‌کند`;
    return `امکان افزودن محصول وجود ندارد؛ ${allowed}. برای افزودن محصولات بیشتر، طرح خود را ارتقا دهید.`;
  }
  return `این قابلیت در طرح ${restriction.plan} در دسترس نیست. برای فعال‌کردن آن، اشتراک خود را ارتقا دهید.`;
}

export function notifySubscriptionRestriction(error: unknown): boolean {
  const restriction = subscriptionRestrictionFrom(error);
  if (!restriction) return false;
  toast.error(subscriptionRestrictionMessage(restriction), {
    duration: 8_000,
    action: {
      label: "مشاهده طرح‌ها",
      onClick: () => { window.location.href = "/setting/subscription"; },
    },
  });
  return true;
}

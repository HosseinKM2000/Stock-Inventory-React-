import type { User } from "./types";

type UserPayload = Partial<Pick<
  User,
  "plan" | "is_active" | "is_admin" | "subscription_expires_at" | "industry_id"
>> & Omit<User, "plan" | "is_active" | "is_admin" | "subscription_expires_at" | "industry_id">;

/** Backward-compatible normalization for responses/cache created before account state. */
export function normalizeUser(user: UserPayload): User {
  return {
    ...user,
    plan: user.plan ?? "free",
    is_active: user.is_active ?? true,
    is_admin: user.is_admin ?? false,
    subscription_expires_at: user.subscription_expires_at ?? null,
    industry_id: user.industry_id ?? null,
  };
}

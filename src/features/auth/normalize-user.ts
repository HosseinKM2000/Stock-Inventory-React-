import type { User } from "./types";

type UserPayload = Partial<Pick<
  User,
  "plan" | "is_active" | "is_admin" | "role" | "is_system_admin" |
  "subscription_started_at" | "subscription_expires_at" | "industry_id"
  | "store_id" | "membership_id" | "store_role_id" | "store_role_name"
  | "store_permissions" | "is_store_owner" | "temporary_password_required"
  | "credentials_notice_viewed" | "membership_authorization_checked_at"
>> & Omit<User, "plan" | "is_active" | "is_admin" | "role" | "is_system_admin" |
  "subscription_started_at" | "subscription_expires_at" | "industry_id" |
  "store_id" | "membership_id" | "store_role_id" | "store_role_name" |
  "store_permissions" | "is_store_owner" | "temporary_password_required" |
  "credentials_notice_viewed" | "membership_authorization_checked_at">;

/** Backward-compatible normalization for responses/cache created before account state. */
export function normalizeUser(user: UserPayload): User {
  return {
    ...user,
    plan: user.plan ?? "free",
    is_active: user.is_active ?? true,
    is_admin: user.is_admin ?? false,
    role: user.role ?? (user.is_admin ? "ADMIN" : "USER"),
    is_system_admin: user.is_system_admin ?? false,
    subscription_started_at: user.subscription_started_at ?? null,
    subscription_expires_at: user.subscription_expires_at ?? null,
    industry_id: user.industry_id ?? null,
    store_id: user.store_id ?? null,
    membership_id: user.membership_id ?? null,
    store_role_id: user.store_role_id ?? null,
    store_role_name: user.store_role_name ?? null,
    store_permissions: user.store_permissions ?? [],
    // A pre-TZ-012 cached account was necessarily the sole owner of its data.
    is_store_owner: user.is_store_owner ?? true,
    temporary_password_required: user.temporary_password_required ?? false,
    credentials_notice_viewed: user.credentials_notice_viewed ?? true,
    membership_authorization_checked_at: user.membership_authorization_checked_at ?? null,
  };
}

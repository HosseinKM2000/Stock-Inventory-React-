import type { User } from "@/features/auth/types";

export type Permission =
  | "users.read"
  | "users.manage"
  | "plans.manage"
  | "catalog.manage"
  | "industry.manage";

const ADMIN_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "users.read",
  "users.manage",
  "plans.manage",
  "catalog.manage",
  "industry.manage",
]);

export function isAdmin(user: User | null | undefined): boolean {
  return Boolean(user?.is_system_admin || user?.role === "ADMIN" || user?.is_admin);
}

export function canUser(user: User | null | undefined, permission: Permission): boolean {
  return isAdmin(user) && ADMIN_PERMISSIONS.has(permission);
}

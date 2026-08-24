import type { User } from "@/features/auth/types";
import { normalizeUser } from "@/features/auth/normalize-user";
import { isAdmin } from "./authorization";

export type Entitlement = {
  plan: string;
  label: string;
  status: "active" | "expired";
  started_at: string | null;
  expires_at: string | null;
  synced_at: string;
  capabilities: Record<string, boolean>;
  limits: Record<string, number | null>;
};

const USER_KEY = "inventory-last-user";
const ENTITLEMENT_KEY = "inventory-entitlement";

function read<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") as T | null; }
  catch { return null; }
}

export const accessState = {
  user: () => {
    const user = read<User>(USER_KEY);
    return user ? normalizeUser(user) : null;
  },
  entitlement: () => read<Entitlement>(ENTITLEMENT_KEY),
  canWrite() {
    if (isAdmin(this.user())) return true;
    const value = this.entitlement();
    if (!value) return true;
    if (value.expires_at && new Date(value.expires_at).getTime() <= Date.now()) {
      return false;
    }
    return value.status !== "expired" && value.capabilities["inventory.write"] !== false;
  },
  canAccess() {
    return this.user()?.is_active !== false;
  },
  requireWrite() {
    if (!this.canAccess()) throw new Error("حساب کاربری غیرفعال است");
    if (!this.canWrite()) throw new Error("اشتراک فعلی اجازه ایجاد یا تغییر اطلاعات را نمی‌دهد");
  },
  requireCapability(capability: string) {
    if (!this.canAccess()) throw new Error("حساب کاربری غیرفعال است");
    if (isAdmin(this.user())) return;
    const value = this.entitlement();
    if (value?.capabilities[capability] === false) {
      throw new Error("اشتراک فعلی اجازه انجام این عملیات را نمی‌دهد");
    }
  },
  saveUser(user: User) { localStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(user))); },
  saveEntitlement(value: Entitlement) { localStorage.setItem(ENTITLEMENT_KEY, JSON.stringify(value)); },
  disableAccount() {
    const user = this.user();
    if (user) this.saveUser({ ...user, is_active: false });
    window.dispatchEvent(new Event("account-state-change"));
  },
  clear() {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ENTITLEMENT_KEY);
  },
};

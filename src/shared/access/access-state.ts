import type { User } from "@/features/auth/types";
import { normalizeUser } from "@/features/auth/normalize-user";
import { storage } from "@/shared/lib/infrastructure/storage/local-storage";
import { isAdmin } from "./authorization";

export type Entitlement = {
  user_id: number;
  plan: string;
  label: string;
  status: "active" | "expired";
  account_status: "active";
  started_at: string | null;
  expires_at: string | null;
  server_time: string;
  synced_at: string;
  capabilities: Record<string, boolean>;
  limits: Record<string, number | null>;
};

export type LocalEntitlement = Entitlement & {
  verified_at: string;
  captured_at_ms: number;
  last_observed_at_ms: number;
};

export type EntitlementAccessStatus =
  | "active"
  | "expiring"
  | "expired"
  | "requires_online_verification"
  | "disabled"
  | "missing";

export type EntitlementEvaluation = {
  entitlement: LocalEntitlement | null;
  status: EntitlementAccessStatus;
  remainingMs: number | null;
  requiresOnlineVerification: boolean;
};

const USER_KEY = "inventory-last-user";
const LEGACY_ENTITLEMENT_KEY = "inventory-entitlement";
const ENTITLEMENT_PREFIX = "inventory-entitlement-v2:";
const EXPIRING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const EXPIRED_CAPABILITIES = new Set(["inventory.read"]);
const listeners = new Set<() => void>();

let revision = 0;
let verificationRequired =
  typeof navigator !== "undefined" && navigator.onLine;
let runtimeAnchor: { userId: number; serverMs: number; monotonicMs: number } | null = null;

function entitlementKey(userId: number) {
  return `${ENTITLEMENT_PREFIX}${userId}`;
}

function emit() {
  revision += 1;
  listeners.forEach((listener) => listener());
}

function readUser(): User | null {
  const user = storage.get<User>(USER_KEY);
  return user ? normalizeUser(user) : null;
}

function readEntitlement(userId: number): LocalEntitlement | null {
  const current = storage.get<LocalEntitlement>(entitlementKey(userId));
  if (current?.user_id === userId) return current;

  const legacy = storage.get<Partial<Entitlement>>(LEGACY_ENTITLEMENT_KEY);
  if (legacy?.user_id === userId && legacy.plan) {
    const now = Date.now();
    const serverTime = legacy.server_time ?? legacy.synced_at ?? new Date(now).toISOString();
    const migrated: LocalEntitlement = {
      ...(legacy as Entitlement),
      user_id: userId,
      account_status: "active",
      server_time: serverTime,
      verified_at: serverTime,
      captured_at_ms: now,
      last_observed_at_ms: now,
    };
    storage.set(entitlementKey(userId), migrated);
    storage.remove(LEGACY_ENTITLEMENT_KEY);
    return migrated;
  }
  // The legacy global snapshot was not user-bound, so it is unsafe to grant
  // offline permissions from it. One online verification creates the v2 copy.
  if (legacy) storage.remove(LEGACY_ENTITLEMENT_KEY);
  return null;
}

function trustedNow(snapshot: LocalEntitlement): number {
  const wallClock = Date.now();
  const serverClock = new Date(snapshot.server_time).getTime();
  let runtimeClock = serverClock;

  if (Number.isFinite(serverClock)) {
    if (!runtimeAnchor || runtimeAnchor.userId !== snapshot.user_id) {
      runtimeAnchor = {
        userId: snapshot.user_id,
        serverMs: serverClock,
        monotonicMs: performance.now(),
      };
    }
    runtimeClock = runtimeAnchor.serverMs + Math.max(0, performance.now() - runtimeAnchor.monotonicMs);
  }

  // Reasonable rollback resistance, not DRM: the backend remains authoritative.
  return Math.max(wallClock, snapshot.last_observed_at_ms, runtimeClock);
}

function evaluate(): EntitlementEvaluation {
  const user = readUser();
  if (user?.is_active === false) {
    return { entitlement: null, status: "disabled", remainingMs: null, requiresOnlineVerification: false };
  }

  const entitlement = user ? readEntitlement(user.id) : null;
  if (!entitlement) {
    return {
      entitlement: null,
      status: verificationRequired ? "requires_online_verification" : "missing",
      remainingMs: null,
      requiresOnlineVerification: true,
    };
  }

  const now = trustedNow(entitlement);
  const expiresAt = entitlement.expires_at ? new Date(entitlement.expires_at).getTime() : null;
  const remainingMs = expiresAt == null || !Number.isFinite(expiresAt)
    ? null
    : Math.max(0, expiresAt - now);

  if (verificationRequired) {
    return { entitlement, status: "requires_online_verification", remainingMs, requiresOnlineVerification: true };
  }
  if (entitlement.status === "expired" || remainingMs === 0) {
    return { entitlement, status: "expired", remainingMs: 0, requiresOnlineVerification: false };
  }
  return {
    entitlement,
    status: remainingMs != null && remainingMs <= EXPIRING_WINDOW_MS ? "expiring" : "active",
    remainingMs,
    requiresOnlineVerification: false,
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === USER_KEY || event.key?.startsWith(ENTITLEMENT_PREFIX)) emit();
  });
}

export const accessState = {
  user: readUser,
  entitlement() {
    const user = readUser();
    return user ? readEntitlement(user.id) : null;
  },
  evaluate,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  revision: () => revision,
  canUse(capability: string) {
    const user = this.user();
    if (isAdmin(user)) return user?.is_active !== false;
    const state = evaluate();
    if (!state.entitlement || state.status === "disabled" || state.status === "missing") return false;
    if (state.status === "requires_online_verification") {
      return capability === "inventory.read" && state.entitlement.capabilities[capability] === true;
    }
    if (state.status === "expired") {
      return EXPIRED_CAPABILITIES.has(capability) && state.entitlement.capabilities[capability] === true;
    }
    return state.entitlement.capabilities[capability] === true;
  },
  canWrite() {
    return this.canUse("inventory.write");
  },
  canAccess() {
    return this.user()?.is_active === true;
  },
  requireWrite() {
    if (!this.canAccess()) throw new Error("حساب کاربری غیرفعال است");
    if (!this.canWrite()) throw new Error("اشتراک فعلی اجازه ایجاد یا تغییر اطلاعات را نمی‌دهد");
  },
  requireCapability(capability: string) {
    if (!this.canAccess()) throw new Error("حساب کاربری غیرفعال است");
    if (!this.canUse(capability)) throw new Error("اشتراک فعلی اجازه انجام این عملیات را نمی‌دهد");
  },
  requireInventoryCapacity(currentCount: number) {
    if (isAdmin(this.user())) return;
    const limit = this.entitlement()?.limits.inventory_items;
    if (limit != null && currentCount >= limit) {
      throw new Error("تعداد کالاهای طرح فعلی به سقف مجاز رسیده است");
    }
  },
  saveUser(user: User) {
    storage.set(USER_KEY, normalizeUser(user));
    emit();
  },
  saveEntitlement(value: Entitlement) {
    const now = Date.now();
    const serverMs = new Date(value.server_time).getTime();
    const user = this.user();
    if (user?.id === value.user_id) {
      storage.set(USER_KEY, normalizeUser({
        ...user,
        plan: value.plan,
        subscription_started_at: value.started_at,
        subscription_expires_at: value.expires_at,
        is_active: true,
      }));
    }
    const snapshot: LocalEntitlement = {
      ...value,
      verified_at: value.server_time,
      captured_at_ms: now,
      last_observed_at_ms: Math.max(now, serverMs),
    };
    storage.set(entitlementKey(value.user_id), snapshot);
    runtimeAnchor = { userId: value.user_id, serverMs, monotonicMs: performance.now() };
    verificationRequired = false;
    emit();
  },
  checkpointTime() {
    const snapshot = this.entitlement();
    if (!snapshot) return emit();
    const observed = trustedNow(snapshot);
    if (observed > snapshot.last_observed_at_ms) {
      storage.set(entitlementKey(snapshot.user_id), { ...snapshot, last_observed_at_ms: observed });
    }
    emit();
  },
  requireOnlineVerification() {
    verificationRequired = true;
    emit();
  },
  useOfflineSnapshot() {
    verificationRequired = false;
    emit();
  },
  disableAccount() {
    const user = this.user();
    if (user) this.saveUser({ ...user, is_active: false });
    emit();
  },
  enableAccount() {
    const user = this.user();
    if (user?.is_active === false) this.saveUser({ ...user, is_active: true });
  },
  clear() {
    const user = this.user();
    storage.remove(USER_KEY);
    if (user) storage.remove(entitlementKey(user.id));
    storage.remove(LEGACY_ENTITLEMENT_KEY);
    runtimeAnchor = null;
    verificationRequired = typeof navigator !== "undefined" && navigator.onLine;
    emit();
  },
};

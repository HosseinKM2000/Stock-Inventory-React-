import { planKeys } from "@/features/setting/query/query-keys";
import { apiFetch } from "@/shared/api/client";
import { queryClient } from "@/shared/api/query-client";
import { isAuthenticated } from "@/shared/api/token-store";
import { networkService } from "@/shared/lib/infrastructure/network/network-service";
import { accessState, type Entitlement } from "./access-state";
import type { User } from "@/features/auth/types";
import { authKeys } from "@/features/auth/query/query-keys";

let verification: Promise<boolean> | null = null;
let started = false;

async function verifyCurrentEntitlement(): Promise<boolean> {
  if (!isAuthenticated() || networkService.isOffline()) {
    accessState.useOfflineSnapshot();
    return false;
  }

  accessState.requireOnlineVerification();
  try {
    const authoritativeUser = await apiFetch<User>("/auth/me");
    accessState.saveUser(authoritativeUser);
    queryClient.setQueryData(authKeys.me, authoritativeUser);
    const entitlement = await apiFetch<Entitlement>("/plans/current");
    const user = accessState.user();
    if (!user || entitlement.user_id !== user.id) {
      throw new Error("Entitlement does not belong to the authenticated user");
    }
    accessState.enableAccount();
    accessState.saveEntitlement(entitlement);
    queryClient.setQueryData(planKeys.current, entitlement);
    return true;
  } catch (error) {
    // A connection that disappears mid-verification may continue using the
    // last valid offline snapshot. Other failures stay verification-gated.
    if (networkService.isOffline() || error instanceof TypeError) {
      accessState.useOfflineSnapshot();
    }
    throw error;
  }
}

export const entitlementService = {
  start() {
    if (started) return;
    started = true;
    window.setInterval(() => accessState.checkpointTime(), 60_000);
    accessState.checkpointTime();
  },
  markOnline() {
    accessState.requireOnlineVerification();
  },
  markOffline() {
    accessState.useOfflineSnapshot();
  },
  async verify() {
    if (verification) return verification;
    verification = verifyCurrentEntitlement().finally(() => {
      verification = null;
    });
    return verification;
  },
  async ensureVerified() {
    if (networkService.isOffline()) {
      this.markOffline();
      return false;
    }
    if (accessState.evaluate().requiresOnlineVerification) {
      return this.verify();
    }
    return true;
  },
  canUse(capability: string) {
    return accessState.canUse(capability);
  },
  getCurrentSubscription() {
    return accessState.evaluate();
  },
  isSubscriptionActive() {
    const status = accessState.evaluate().status;
    return status === "active" || status === "expiring";
  },
  isSubscriptionExpired() {
    return accessState.evaluate().status === "expired";
  },
  requiresOnlineVerification() {
    return accessState.evaluate().requiresOnlineVerification;
  },
};

import { getMe } from "@/features/auth/api/auth.api";
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { personnelApi } from "../api";

function maintenanceKey(userId: number) {
  return `tanzim:${userId}:mode-activation-maintenance`;
}

function activationIntentKey(userId: number, storeId: number) {
  return `tanzim:${userId}:${storeId}:team-activation-intent`;
}

function durableActivationIntent(userId: number, storeId: number, expectedPolicyVersion: number) {
  const key = activationIntentKey(userId, storeId);
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const existing = JSON.parse(raw) as { transitionId?: string; expectedPolicyVersion?: number };
      if (existing.transitionId && existing.expectedPolicyVersion === expectedPolicyVersion) {
        return { key, transitionId: existing.transitionId };
      }
    } catch {
      // Replace malformed local evidence before any server dispatch.
    }
  }
  const transitionId = crypto.randomUUID();
  localStorage.setItem(key, JSON.stringify({ transitionId, expectedPolicyVersion }));
  return { key, transitionId };
}

async function assertRecoveryResolved(userId: number, storeId: number) {
  const sessions = await db.recoverySessions.where("[ownerUserId+storeId]").equals([userId, storeId]).toArray();
  if (sessions.some((session) => session.status !== "complete")) throw new Error("TEAM_ACTIVATION_RECOVERY_UNRESOLVED");
  const items = await db.recoveryItems.where("[ownerUserId+storeId]").equals([userId, storeId]).toArray();
  if (items.some((item) => item.decision !== "discarded" && item.decision !== "resolved")) {
    throw new Error("TEAM_ACTIVATION_RECOVERY_UNRESOLVED");
  }
}

export const teamActivationService = {
  async activate(expectedPolicyVersion: number) {
    const user = accessState.user();
    if (!user?.id || !user.store_id) throw new Error("STORE_CONTEXT_REQUIRED");
    if (!navigator.locks) throw new Error("TEAM_LOCKING_UNAVAILABLE");
    return navigator.locks.request(`tanzim-mode-activation:${user.id}`, async () => {
      // Drain once before entering the transition boundary, then use the same
      // global order as restore: outbox -> local mutations. The final drain
      // runs under the already-held outbox lock and cannot deadlock by trying
      // to reacquire it.
      await syncService.sync();
      return navigator.locks.request("tanzim-outbox-sync", async () => {
        return navigator.locks.request(`tanzim-local-mutations:${user.id}`, async () => {
          const intent = durableActivationIntent(user.id, user.store_id!, expectedPolicyVersion);
          const marker = { storeId: user.store_id, expiresAt: Date.now() + 120_000 };
          localStorage.setItem(maintenanceKey(user.id), JSON.stringify(marker));
          try {
            await assertRecoveryResolved(user.id, user.store_id!);
            await queueService.prepareActivationDrain();
            await syncService.syncWithinOutboxLock();
            const unresolved = await queueService.getAll();
            if (unresolved.length) throw new Error("TEAM_ACTIVATION_OUTBOX_UNRESOLVED");
            await assertRecoveryResolved(user.id, user.store_id!);
            const result = await personnelApi.activateTeam(expectedPolicyVersion, intent.transitionId);
            accessState.saveUser(await getMe());
            localStorage.removeItem(intent.key);
            return result;
          } finally {
            localStorage.removeItem(maintenanceKey(user.id));
          }
        });
      });
    });
  },
};

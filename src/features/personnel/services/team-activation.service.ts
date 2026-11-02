import { getMe } from "@/features/auth/api/auth.api";
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import { syncService } from "@/shared/lib/infrastructure/sync/sync-service";
import { personnelApi } from "../api";

function maintenanceKey(userId: number) {
  return `tanzim:${userId}:mode-activation-maintenance`;
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
      // Wait for any already-running local transaction, then hold the same
      // cross-tab lock through drain and the server transition. The marker
      // gives fast, explicit failures to later writers while this lock is held.
      return navigator.locks.request(`tanzim-local-mutations:${user.id}`, async () => {
        const marker = { storeId: user.store_id, expiresAt: Date.now() + 120_000 };
        localStorage.setItem(maintenanceKey(user.id), JSON.stringify(marker));
        try {
          await assertRecoveryResolved(user.id, user.store_id!);
          await queueService.prepareActivationDrain();
          await syncService.sync();
          const unresolved = await queueService.getAll();
          if (unresolved.length) throw new Error("TEAM_ACTIVATION_OUTBOX_UNRESOLVED");
          await assertRecoveryResolved(user.id, user.store_id!);
          const result = await personnelApi.activateTeam(expectedPolicyVersion, crypto.randomUUID());
          accessState.saveUser(await getMe());
          return result;
        } finally {
          localStorage.removeItem(maintenanceKey(user.id));
        }
      });
    });
  },
};

import { queryClient } from "@/shared/api/query-client";
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { unsavedWork } from "./unsaved-work";

export type UpdateDeferral =
  | "unsaved_form"
  | "active_request"
  | "critical_recovery"
  | "another_tab"
  | "locking_unavailable"
  | "local_state_unavailable";

async function hasCriticalRecovery(userId: number, storeId: number) {
  const sessions = await db.recoverySessions
    .where("ownerUserId")
    .equals(userId)
    .filter((session) => session.storeId === storeId)
    .toArray();
  return sessions.some((session) =>
    ["preparing", "media_staged", "database_committed"].includes(session.status),
  );
}

function synchronousBlock(): UpdateDeferral | null {
  if (unsavedWork.hasAny()) return "unsaved_form";
  if (queryClient.isMutating() > 0) return "active_request";
  return null;
}

export async function activateWhenSafe(activate: () => void): Promise<UpdateDeferral | null> {
  const immediate = synchronousBlock();
  if (immediate) return immediate;
  if (!navigator.locks) return "locking_unavailable";

  const user = accessState.user();
  let outcome: UpdateDeferral | null = "another_tab";
  await navigator.locks.request("tanzim-app-update-activation", { ifAvailable: true }, async (updateLock) => {
    if (!updateLock) return;
    const beforeLocks = synchronousBlock();
    if (beforeLocks) { outcome = beforeLocks; return; }

    const run = async () => {
      const beforeActivation = synchronousBlock();
      if (beforeActivation) { outcome = beforeActivation; return; }
      if (user?.id && user.store_id) {
        try {
          if (await hasCriticalRecovery(user.id, user.store_id)) {
            outcome = "critical_recovery";
            return;
          }
        } catch (error) {
          console.error("UPDATE_RECOVERY_STATE_UNAVAILABLE", error instanceof Error ? error.name : "unknown");
          outcome = "local_state_unavailable";
          return;
        }
      }
      activate();
      outcome = null;
    };

    if (!user?.id) { await run(); return; }
    await navigator.locks.request("tanzim-outbox-sync", { ifAvailable: true }, async (outboxLock) => {
      if (!outboxLock) return;
      await navigator.locks.request(`tanzim-local-mutations:${user.id}`, { ifAvailable: true }, async (mutationLock) => {
        if (!mutationLock) return;
        await run();
      });
    });
  });
  return outcome;
}

import { accessState } from "@/shared/access/access-state";

export type SyncAccountContext = {
  actorUserId: number;
  storeId: number;
};

export function captureSyncAccountContext(): SyncAccountContext {
  const user = accessState.user();
  if (!user) throw new Error("SYNC_ACCOUNT_MISSING");
  return { actorUserId: user.id, storeId: user.store_id ?? user.id };
}

export function isSyncAccountCurrent(expected: SyncAccountContext) {
  const user = accessState.user();
  return user?.id === expected.actorUserId && (user.store_id ?? user.id) === expected.storeId;
}

export function assertSyncAccountCurrent(expected: SyncAccountContext) {
  if (!isSyncAccountCurrent(expected)) throw new Error("SYNC_ACCOUNT_CHANGED");
}

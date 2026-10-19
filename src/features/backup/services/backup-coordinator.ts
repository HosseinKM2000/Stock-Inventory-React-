const INSTANCE_ID = crypto.randomUUID();
const LEASE_MS = 90_000;

type LockNavigator = Navigator & {
  locks?: LockManager;
};

async function withLease<T>(userId: number, task: () => Promise<T>): Promise<T | undefined> {
  const key = `tanzim-backup-writer:${userId}`;
  const now = Date.now();
  try {
    const current = JSON.parse(localStorage.getItem(key) ?? "null") as { owner?: string; expiresAt?: number } | null;
    if (current?.owner !== INSTANCE_ID && (current?.expiresAt ?? 0) > now) return undefined;
    localStorage.setItem(key, JSON.stringify({ owner: INSTANCE_ID, expiresAt: now + LEASE_MS }));
    const confirmed = JSON.parse(localStorage.getItem(key) ?? "null") as { owner?: string } | null;
    if (confirmed?.owner !== INSTANCE_ID) return undefined;
    return await task();
  } finally {
    try {
      const current = JSON.parse(localStorage.getItem(key) ?? "null") as { owner?: string } | null;
      if (current?.owner === INSTANCE_ID) localStorage.removeItem(key);
    } catch {
      // Another tab or restricted storage owns cleanup.
    }
  }
}

export async function withBackupWriter<T>(userId: number, task: () => Promise<T>): Promise<T | undefined> {
  const locks = (navigator as LockNavigator).locks;
  if (!locks) return withLease(userId, task);
  let result: T | undefined;
  await locks.request(`tanzim-local-backup:${userId}`, { ifAvailable: true }, async (lock) => {
    if (lock) result = await task();
  });
  return result;
}

export async function withBackupRestore<T>(userId: number, task: () => Promise<T>): Promise<T | undefined> {
  return withBackupWriter(userId, async () => {
    const locks = (navigator as LockNavigator).locks;
    if (!locks) return task();
    let result: T | undefined;
    await locks.request("tanzim-outbox-sync", async () => {
      result = await task();
    });
    return result;
  });
}

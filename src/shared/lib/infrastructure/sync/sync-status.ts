export type SyncState =
  | "idle"
  | "syncing"
  | "synced"
  | "failed";

export type SyncStatus = {
  state: SyncState;

  pending: number;

  lastSyncedAt: number | null;

  error: string | null;
};

type Listener = () => void;

class SyncStatusStore {
  private status: SyncStatus = {
    state: "idle",

    pending: 0,

    lastSyncedAt: null,

    error: null,
  };

  private listeners = new Set<Listener>();

  get(): SyncStatus {
    return this.status;
  }

  set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch };

    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const syncStatusStore = new SyncStatusStore();

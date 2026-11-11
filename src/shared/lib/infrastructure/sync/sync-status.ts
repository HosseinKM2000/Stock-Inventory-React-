export type SyncState =
  | "idle"
  | "syncing"
  | "synced"
  | "conflict"
  | "failed";

export type SyncStatus = {
  state: SyncState;

  pending: number;

  lastSyncedAt: number | null;

  error: string | null;
};

export type SyncEvent = SyncStatus & {
  id: number;
  occurredAt: number;
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

  private events: SyncEvent[] = [];

  private nextEventId = 1;

  get(): SyncStatus {
    return this.status;
  }

  getEvents(): readonly SyncEvent[] {
    return this.events;
  }

  set(patch: Partial<SyncStatus>) {
    const next = { ...this.status, ...patch };
    const changed =
      next.state !== this.status.state ||
      next.pending !== this.status.pending ||
      next.lastSyncedAt !== this.status.lastSyncedAt ||
      next.error !== this.status.error;

    this.status = next;

    if (changed) {
      this.events = [
        { ...next, id: this.nextEventId, occurredAt: Date.now() },
        ...this.events,
      ].slice(0, 20);
      this.nextEventId += 1;
    }

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

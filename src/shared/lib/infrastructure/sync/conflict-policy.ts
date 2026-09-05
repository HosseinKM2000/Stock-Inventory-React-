export type VersionedRecord = {
  updated_at?: string | null;
};

export type ConflictResolution = "local" | "server";

/**
 * Single place where the "who wins" rule lives so the policy can evolve
 * (server version, vector clocks, manual review) without touching the engine.
 *
 * Default policy: last-write-wins based on `updated_at`, server wins on ties
 * because the server already accepted the write.
 */
export const conflictPolicy = {
  resolve(local: VersionedRecord, server: VersionedRecord): ConflictResolution {
    const localAt = local.updated_at ? Date.parse(local.updated_at) : 0;

    const serverAt = server.updated_at ? Date.parse(server.updated_at) : 0;

    if (Number.isNaN(localAt) || Number.isNaN(serverAt)) return "server";

    return localAt > serverAt ? "local" : "server";
  },
};

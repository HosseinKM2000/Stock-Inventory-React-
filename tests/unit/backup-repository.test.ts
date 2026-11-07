import { beforeEach, describe, expect, it } from "vitest";

import { backupRepository } from "@/features/backup/services/backup-repository";
import { db } from "@/shared/lib/infrastructure/storage/db";

describe("account-scoped backup settings", () => {
  beforeEach(async () => {
    await db.open();
    await db.backupSettings.clear();
  });

  it("keeps modes, revisions, and destination handles isolated per account", async () => {
    const firstHandle = { kind: "file", name: "first.tanzimbackup" } as FileSystemFileHandle;
    const secondHandle = { kind: "directory", name: "Second" } as FileSystemDirectoryHandle;
    await backupRepository.getOrCreate(1, "file");
    await backupRepository.update(1, { handle: firstHandle, destinationName: firstHandle.name, lastSuccessfulRevision: "first" });
    await backupRepository.getOrCreate(2, "directory");
    await backupRepository.update(2, { handle: secondHandle, destinationName: secondHandle.name, lastSuccessfulRevision: "second" });

    expect(await backupRepository.get(1)).toMatchObject({ userId: 1, mode: "file", destinationName: "first.tanzimbackup", lastSuccessfulRevision: "first" });
    expect(await backupRepository.get(2)).toMatchObject({ userId: 2, mode: "directory", destinationName: "Second", lastSuccessfulRevision: "second" });
  });
});

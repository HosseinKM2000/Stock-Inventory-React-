import { describe, expect, it, vi } from "vitest";

import { queryHandlePermission, writeConnectedBackup } from "@/features/backup/services/external-backup-adapter";
import type { BackupSettings } from "@/features/backup/types";

class MemoryFileHandle {
  readonly kind = "file" as const;
  failClose = false;
  name: string;
  content: Blob;

  constructor(name: string, content = new Blob()) {
    this.name = name;
    this.content = content;
  }

  async getFile() {
    return new File([this.content], this.name, { type: this.content.type });
  }

  async createWritable() {
    let staged = this.content;
    return {
      write: vi.fn(async (value: Blob) => { staged = value; }),
      close: vi.fn(async () => {
        if (this.failClose) throw new Error("interrupted");
        this.content = staged;
      }),
      abort: vi.fn(async () => undefined),
    };
  }
}

class MemoryDirectoryHandle {
  readonly kind = "directory" as const;
  readonly name = "Backups";
  files = new Map<string, MemoryFileHandle>();

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (!options?.create) throw new DOMException("missing", "NotFoundError");
    const created = new MemoryFileHandle(name);
    this.files.set(name, created);
    return created;
  }

  async removeEntry(name: string) {
    this.files.delete(name);
  }
}

function connected(handle: FileSystemHandle): BackupSettings {
  return {
    userId: 1,
    mode: handle.kind === "directory" ? "directory" : "file",
    onboardingCompleted: true,
    automaticEnabled: true,
    intervalMs: 300_000,
    destinationName: handle.name,
    handle: handle as FileSystemFileHandle | FileSystemDirectoryHandle,
    permission: "granted",
    lastSuccessfulAt: null,
    lastSuccessfulRevision: null,
    lastFailure: null,
    retryCount: 0,
    nextAttemptAt: 0,
    restoreRequiresReview: false,
  };
}

describe("external backup adapter", () => {
  it("prepares, verifies, and keeps one previous directory version", async () => {
    const directory = new MemoryDirectoryHandle();
    directory.files.set("tanzim-backup.tanzimbackup", new MemoryFileHandle("tanzim-backup.tanzimbackup", new Blob(["old"])));

    await writeConnectedBackup(connected(directory as unknown as FileSystemDirectoryHandle), new Blob(["new backup"]));

    await expect(directory.files.get("tanzim-backup.tanzimbackup")!.getFile().then((file) => file.text())).resolves.toBe("new backup");
    await expect(directory.files.get("tanzim-backup.previous.tanzimbackup")!.getFile().then((file) => file.text())).resolves.toBe("old");
    expect(directory.files.has("tanzim-backup.pending.tanzimbackup")).toBe(false);
  });

  it("does not replace a single granted file until close succeeds", async () => {
    const file = new MemoryFileHandle("backup.tanzimbackup", new Blob(["usable"]));
    file.failClose = true;
    await expect(writeConnectedBackup(connected(file as unknown as FileSystemFileHandle), new Blob(["broken"]))).rejects.toThrow("interrupted");
    await expect(file.getFile().then((value) => value.text())).resolves.toBe("usable");
  });

  it("reports revoked and missing permissions without prompting", async () => {
    const denied = { kind: "file", name: "backup", queryPermission: vi.fn(async () => "denied") };
    await expect(queryHandlePermission(denied as unknown as FileSystemFileHandle)).resolves.toBe("denied");
    await expect(queryHandlePermission()).resolves.toBe("missing");
    expect(denied.queryPermission).toHaveBeenCalledOnce();
  });
});

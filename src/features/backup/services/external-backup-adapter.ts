import type { BackupMode, BackupPermission, BackupSettings } from "../types";

const BACKUP_FILENAME = "tanzim-backup.tanzimbackup";
const PREVIOUS_FILENAME = "tanzim-backup.previous.tanzimbackup";
const TEMP_FILENAME = "tanzim-backup.pending.tanzimbackup";

type PermissionHandle = FileSystemHandle & {
  queryPermission?(options?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(options?: { mode: "read" | "readwrite" }): Promise<PermissionState>;
};

type PickerWindow = Window & {
  showDirectoryPicker?(options?: { mode?: "read" | "readwrite"; id?: string }): Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?(options?: unknown): Promise<FileSystemFileHandle>;
  showOpenFilePicker?(options?: unknown): Promise<FileSystemFileHandle[]>;
};

function pickerWindow() {
  return window as PickerWindow;
}

export function externalBackupMode(): BackupMode {
  if (!window.isSecureContext) return "manual";
  if (pickerWindow().showDirectoryPicker) return "directory";
  if (pickerWindow().showSaveFilePicker) return "file";
  return "manual";
}

export function isPickerCancellation(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function queryHandlePermission(handle?: FileSystemHandle): Promise<BackupPermission> {
  if (!handle) return "missing";
  try {
    return await (handle as PermissionHandle).queryPermission?.({ mode: "readwrite" }) ?? "prompt";
  } catch {
    return "denied";
  }
}

export async function requestHandlePermission(handle?: FileSystemHandle): Promise<BackupPermission> {
  if (!handle) return "missing";
  try {
    return await (handle as PermissionHandle).requestPermission?.({ mode: "readwrite" }) ?? "prompt";
  } catch {
    return "denied";
  }
}

export async function selectBackupDestination() {
  const mode = externalBackupMode();
  if (mode === "directory") {
    const handle = await pickerWindow().showDirectoryPicker!({ mode: "readwrite", id: "tanzim-backup" });
    return { mode, handle, destinationName: `${handle.name}/${BACKUP_FILENAME}` };
  }
  if (mode === "file") {
    const handle = await pickerWindow().showSaveFilePicker!({
      suggestedName: BACKUP_FILENAME,
      types: [{ description: "Tanzim Backup", accept: { "application/vnd.tanzim.backup+json": [".tanzimbackup"] } }],
    });
    return { mode, handle, destinationName: handle.name };
  }
  return { mode, handle: undefined, destinationName: BACKUP_FILENAME };
}

async function writeFile(handle: FileSystemFileHandle, blob: Blob) {
  const writable = await handle.createWritable({ keepExistingData: false });
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

async function writeDirectory(handle: FileSystemDirectoryHandle, blob: Blob) {
  const pending = await handle.getFileHandle(TEMP_FILENAME, { create: true });
  await writeFile(pending, blob);
  const prepared = await pending.getFile();
  if (prepared.size !== blob.size) {
    await handle.removeEntry(TEMP_FILENAME).catch(() => undefined);
    throw new Error("BACKUP_PREPARE_VERIFICATION_FAILED");
  }

  try {
    const current = await handle.getFileHandle(BACKUP_FILENAME);
    const previous = await handle.getFileHandle(PREVIOUS_FILENAME, { create: true });
    await writeFile(previous, await current.getFile());
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
  }

  const destination = await handle.getFileHandle(BACKUP_FILENAME, { create: true });
  await writeFile(destination, await pending.getFile());
  await handle.removeEntry(TEMP_FILENAME).catch(() => undefined);
}

export async function writeConnectedBackup(settings: BackupSettings, blob: Blob) {
  if (!settings.handle) throw new Error("BACKUP_DESTINATION_MISSING");
  if (settings.handle.kind === "directory") {
    await writeDirectory(settings.handle as FileSystemDirectoryHandle, blob);
  } else {
    await writeFile(settings.handle as FileSystemFileHandle, blob);
  }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function deliverManualBackup(blob: Blob) {
  const file = new File([blob], BACKUP_FILENAME, { type: blob.type });
  const shareNavigator = navigator as Navigator & {
    canShare?(data: ShareData): boolean;
    share?(data: ShareData): Promise<void>;
  };
  if (shareNavigator.share && shareNavigator.canShare?.({ files: [file] })) {
    await shareNavigator.share({ files: [file], title: "فایل پشتیبان تنظیم" });
    return;
  }
  download(blob, BACKUP_FILENAME);
}

export async function readConnectedBackup(settings: BackupSettings) {
  if (!settings.handle) throw new Error("BACKUP_DESTINATION_MISSING");
  if (settings.handle.kind === "directory") {
    const fileHandle = await (settings.handle as FileSystemDirectoryHandle).getFileHandle(BACKUP_FILENAME);
    return fileHandle.getFile();
  }
  return (settings.handle as FileSystemFileHandle).getFile();
}

export async function chooseBackupFile() {
  if (window.isSecureContext && pickerWindow().showOpenFilePicker) {
    const [handle] = await pickerWindow().showOpenFilePicker!({
      multiple: false,
      types: [{ description: "Tanzim Backup", accept: { "application/vnd.tanzim.backup+json": [".tanzimbackup"] } }],
    });
    return handle?.getFile() ?? null;
  }
  return null;
}

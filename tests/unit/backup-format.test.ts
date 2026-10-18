import { describe, expect, it } from "vitest";

import {
  buildBackupEnvelope,
  parseBackupEnvelope,
  normalizeBackupProducts,
  revisionForBackupData,
  type BackupData,
} from "@/features/backup/services/backup-format";
import { product } from "../helpers/product";

const data = (overrides: Partial<BackupData> = {}): BackupData => ({
  products: [],
  categories: [],
  labels: [],
  pendingOperations: [],
  reconciliation: [],
  preferences: {},
  images: [],
  unavailableImages: [],
  ...overrides,
});

describe("portable backup format", () => {
  it("is deterministic for equivalent data and distinguishes meaningful changes", async () => {
    const first = data({ preferences: { b: "2", a: "1" } });
    const reordered = data({ preferences: { a: "1", b: "2" } });
    const changed = data({ preferences: { a: "1", b: "3" } });

    expect(await revisionForBackupData(first)).toBe(await revisionForBackupData(reordered));
    expect(await revisionForBackupData(first)).not.toBe(await revisionForBackupData(changed));
  });

  it("round-trips an integrity-protected snapshot for its owning account", async () => {
    const envelope = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner" },
      data: data({
        images: [{ path: "local://product.webp", mimeType: "image/webp", base64: "cGl4ZWxz" }],
      }),
      createdAt: "2026-10-13T10:00:00.000Z",
    });

    await expect(parseBackupEnvelope(JSON.stringify(envelope), 42)).resolves.toEqual(envelope);
  });

  it("rejects tampering, incompatible schemas, and another account's backup", async () => {
    const envelope = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner" },
      data: data(),
      createdAt: "2026-10-13T10:00:00.000Z",
    });

    const tampered = { ...envelope, data: data({ preferences: { changed: "true" } }) };
    await expect(parseBackupEnvelope(JSON.stringify(tampered), 42)).rejects.toThrow("INTEGRITY");
    await expect(parseBackupEnvelope(JSON.stringify(envelope), 9)).rejects.toThrow("OWNER");
    await expect(parseBackupEnvelope(JSON.stringify({ ...envelope, schemaVersion: 99 }), 42)).rejects.toThrow("SCHEMA");
  });

  it("migrates legacy price to sale price without inventing purchase cost", () => {
    const [migrated] = normalizeBackupProducts([product({ price: 125, sale_price: undefined, purchase_price: undefined })]);
    expect(migrated).toMatchObject({ price: 125, sale_price: 125, purchase_price: null, price_missing: false });
  });
});

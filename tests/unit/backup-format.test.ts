import { describe, expect, it } from "vitest";

import {
  buildBackupEnvelope,
  parseBackupEnvelope,
  normalizeBackupProducts,
  revisionForBackupData,
  type BackupData,
} from "@/features/backup/services/backup-format";
import { product } from "../helpers/product";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function digest(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

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
    await expect(parseBackupEnvelope(JSON.stringify(envelope), 42, 9)).rejects.toThrow("STORE");
    await expect(parseBackupEnvelope(JSON.stringify({ ...envelope, schemaVersion: 99 }), 42)).rejects.toThrow("SCHEMA");
  });

  it("migrates legacy price to sale price without inventing purchase cost", () => {
    const [migrated] = normalizeBackupProducts([product({ price: 125, sale_price: undefined, purchase_price: undefined })]);
    expect(migrated).toMatchObject({ price: 125, sale_price: 125, purchase_price: null, price_missing: false });
  });

  it("rejects untrusted authority fields, broken relationships, and corrupt embedded media", async () => {
    const authority = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner", storeId: 42 },
      data: data({ products: [{ ...product({ id: 1 }), access_token: "must-not-import" } as never] }),
    });
    await expect(parseBackupEnvelope(JSON.stringify(authority), 42, 42)).rejects.toThrow("AUTHORITY");

    const relationship = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner", storeId: 42 },
      data: data({ products: [product({ id: 1, category_id: 999 })] }),
    });
    await expect(parseBackupEnvelope(JSON.stringify(relationship), 42, 42)).rejects.toThrow("RELATIONSHIP");

    const corrupt = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner", storeId: 42 },
      data: data({ images: [{ path: "local://broken.webp", mimeType: "image/webp", base64: "%%%" }] }),
    });
    await expect(parseBackupEnvelope(JSON.stringify(corrupt), 42, 42)).rejects.toThrow("IMAGE_CORRUPT");
  });

  it("rejects invalid business values and unknown executable operation types", async () => {
    const invalidProduct = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner", storeId: 42 },
      data: data({ products: [product({ id: 1, quantity: -1 })] }),
    });
    await expect(parseBackupEnvelope(JSON.stringify(invalidProduct), 42, 42)).rejects.toThrow("PRODUCT_INVALID");

    const unknownOperation = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner", storeId: 42 },
      data: data({ pendingOperations: [{
        id: "42:authority:1", ownerUserId: 42, storeId: 42, operationId: "unknown-op",
        entity: "membership", entityId: 1, action: "UPDATE", payload: {}, createdAt: 1,
        updatedAt: 1, retryCount: 0, status: "pending", nextAttemptAt: 1, attemptState: "never",
      }] }),
    });
    await expect(parseBackupEnvelope(JSON.stringify(unknownOperation), 42, 42)).rejects.toThrow("OPERATION_INVALID");
  });

  it("keeps explicitly unavailable media visible instead of claiming recovery", async () => {
    const envelope = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner", storeId: 42 },
      data: data({ unavailableImages: [{ path: "local://missing.webp", reason: "missing" }] }),
    });
    const parsed = await parseBackupEnvelope(JSON.stringify(envelope), 42, 42);
    expect(parsed.counts.unavailableImages).toBe(1);
    expect(parsed.data.unavailableImages).toEqual([{ path: "local://missing.webp", reason: "missing" }]);
  });

  it("preserves immutable invoice evidence and its pending command identity", async () => {
    const pending = {
      id: "42:42:invoice-command", ownerUserId: 42, storeId: 42,
      operationId: "invoice-command", entity: "invoice" as const, entityId: 7001,
      action: "CREATE" as const,
      payload: { invoice_type: "sale", title: "فروش", lines: [{ product_id: 1, quantity: 1, unit: "unit", pack_size: null, unit_price: 0 }] },
      createdAt: 1, updatedAt: 1, retryCount: 0, status: "pending" as const,
      nextAttemptAt: 1, attemptState: "attempted" as const,
    };
    const invoice = {
      id: 7001, invoice_type: "sale" as const, title: "فروش", counterparty: null,
      status: "pending" as const, total_amount: 0, actor_user_id: 42, actor_membership_id: 52,
      post_operation_id: pending.operationId, posted_at: "2026-11-04T08:00:00Z",
      lines: [{ product_id: 1, product_name: "کالای بایگانی", quantity: 1, unit: "عدد" as const,
        pack_size: null, base_quantity: 1, unit_price: 0, line_total: 0, before_quantity: 2, after_quantity: 1 }],
    };
    const envelope = await buildBackupEnvelope({
      owner: { userId: 42, username: "owner", storeId: 42 },
      data: data({ products: [product({ id: 1, quantity: 1 })], invoices: [invoice], pendingOperations: [pending] }),
    });

    const restored = await parseBackupEnvelope(JSON.stringify(envelope), 42, 42);
    expect(restored.data.invoices).toEqual([invoice]);
    expect(restored.data.pendingOperations[0]).toMatchObject({
      operationId: pending.operationId, payload: pending.payload, attemptState: "attempted",
    });
  });

  it("continues to read a valid schema-v1 owner-bound backup", async () => {
    const current = await buildBackupEnvelope({ owner: { userId: 42, username: "legacy" }, data: data() });
    const unsignedCurrent = Object.fromEntries(Object.entries(current).filter(([key]) => key !== "integrity"));
    const unsigned = {
      ...unsignedCurrent,
      schemaVersion: 1,
      owner: { userId: 42, username: "legacy" },
      counts: {
        products: 0, categories: 0, labels: 0, pendingOperations: 0, images: 0, unavailableImages: 0,
      },
    };
    const legacy = { ...unsigned, integrity: { algorithm: "SHA-256", digest: await digest(unsigned) } };
    await expect(parseBackupEnvelope(JSON.stringify(legacy), 42, 999)).resolves.toMatchObject({ schemaVersion: 1 });
  });
});

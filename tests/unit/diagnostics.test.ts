import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDiagnostics,
  createProblemReport,
  diagnosticEntries,
  recordDiagnostic,
  sanitizeDiagnosticValue,
} from "@/shared/lib/diagnostics/diagnostic-buffer";

function signIn(id: number, storeId: number) {
  localStorage.setItem("inventory-last-user", JSON.stringify({ id, store_id: storeId }));
}

describe("release diagnostics", () => {
  beforeEach(() => {
    signIn(10, 20);
    clearDiagnostics();
  });

  it("recursively redacts secrets, payloads, descriptions, and image data", () => {
    expect(sanitizeDiagnosticValue({
      token: "secret", password_hash: "hash", api_key: "key", cookie: "session",
      phone: "09120000000", email: "person@example.test", actor_user_id: 99, local_path: "private/file.webp",
      request_body: { product_description: "private customer text" }, image: "base64",
      safe: { status: "failed", operation_id: "operation-1" },
    })).toEqual({
      token: "[redacted]", password_hash: "[redacted]", api_key: "[redacted]", cookie: "[redacted]",
      phone: "[redacted]", email: "[redacted]", actor_user_id: "[redacted]", local_path: "[redacted]",
      request_body: "[redacted]", image: "[redacted]",
      safe: { status: "failed", operation_id: "operation-1" },
    });
  });

  it("is bounded and partitioned by authenticated person and store", () => {
    for (let index = 0; index < 70; index += 1) {
      recordDiagnostic({ kind: "api_error", summary: `HTTP_500_${index}`, requestId: `request-${index}` });
    }
    expect(diagnosticEntries()).toHaveLength(40);
    expect(diagnosticEntries()[0].summary).toBe("HTTP_500_30");

    signIn(11, 21);
    expect(diagnosticEntries()).toEqual([]);
    recordDiagnostic({ kind: "network_error", summary: "NETWORK_UNAVAILABLE", requestId: "other-request" });
    expect(diagnosticEntries()).toHaveLength(1);

    signIn(10, 20);
    expect(diagnosticEntries()).toHaveLength(40);
  });

  it("exports useful build/schema context without identity or raw error bodies", () => {
    recordDiagnostic({
      kind: "sync_failure", summary: "OPERATION_PAYLOAD_MISMATCH",
      requestId: "request-safe", operationId: "operation-safe", details: { authorization: "Bearer secret" },
    });
    const report = createProblemReport();
    expect(report.context.client_data_schema).toBe(3);
    expect(report.context.dexie_schema).toBe(14);
    expect(report.entries[0]).toMatchObject({ requestId: "request-safe", operationId: "operation-safe" });
    expect(JSON.stringify(report)).not.toMatch(/Bearer secret|user_id|store_id/);
  });
});

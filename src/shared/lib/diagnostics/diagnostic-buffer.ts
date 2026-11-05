const PREFIX = "tanzim-diagnostics-v1:";
const MAX_ENTRIES = 40;
const MAX_SERIALIZED_BYTES = 48 * 1024;
const SENSITIVE_KEY = /(?:password|passcode|token|authorization|cookie|secret|api.?key|request.?body|payload|description|image|base64|content|phone|email|username|first.?name|last.?name|user.?id|store.?id|actor.?id|membership.?id|local.?path|storage.?key|hash|sha256)/i;
const SAFE_CODE = /^[A-Z][A-Z0-9_.:-]{2,127}$/;

export type DiagnosticKind =
  | "api_error"
  | "network_error"
  | "sync_failure"
  | "media_failure"
  | "recovery_failure"
  | "client_error";

export type DiagnosticEntry = {
  id: string;
  occurredAt: string;
  kind: DiagnosticKind;
  summary: string;
  requestId?: string;
  operationId?: string;
  httpStatus?: number;
  path?: string;
  details?: unknown;
};

export type DiagnosticInput = Omit<DiagnosticEntry, "id" | "occurredAt">;

function currentPartition() {
  try {
    const value = JSON.parse(localStorage.getItem("inventory-last-user") ?? "null") as { id?: unknown; store_id?: unknown } | null;
    const user = typeof value?.id === "number" ? value.id : "anonymous";
    const store = typeof value?.store_id === "number" ? value.store_id : "none";
    return `${user}:${store}`;
  } catch {
    return "anonymous:none";
  }
}

function storageKey() {
  return `${PREFIX}${currentPartition()}`;
}

function safeIdentifier(value: string | undefined) {
  if (!value) return undefined;
  return /^[A-Za-z0-9_.:-]{4,128}$/.test(value) ? value : undefined;
}

function safeSummary(value: string) {
  return SAFE_CODE.test(value) ? value : "UNCLASSIFIED_FAILURE";
}

function safePath(value: string | undefined) {
  if (!value) return undefined;
  return value.split("?", 1)[0]
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .slice(0, 160);
}

export function sanitizeDiagnosticValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeDiagnosticValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeDiagnosticValue(item, depth + 1),
    ]));
  }
  if (typeof value === "string") return value.slice(0, 160);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  return String(value).slice(0, 80);
}

function read(): DiagnosticEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey()) ?? "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function write(entries: DiagnosticEntry[]) {
  let bounded = entries.slice(-MAX_ENTRIES);
  while (bounded.length && new Blob([JSON.stringify(bounded)]).size > MAX_SERIALIZED_BYTES) bounded = bounded.slice(1);
  try {
    localStorage.setItem(storageKey(), JSON.stringify(bounded));
  } catch {
    // Diagnostics must never block the customer workflow when storage is full.
  }
}

export function recordDiagnostic(input: DiagnosticInput) {
  const entry: DiagnosticEntry = {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    kind: input.kind,
    summary: safeSummary(input.summary),
    requestId: safeIdentifier(input.requestId),
    operationId: safeIdentifier(input.operationId),
    httpStatus: Number.isInteger(input.httpStatus) ? input.httpStatus : undefined,
    path: safePath(input.path),
    details: input.details == null ? undefined : sanitizeDiagnosticValue(input.details),
  };
  write([...read(), entry]);
  return entry;
}

export function diagnosticEntries() {
  return read();
}

export function clearDiagnostics() {
  localStorage.removeItem(storageKey());
}

export function createProblemReport(state?: unknown) {
  return {
    format: "tanzim-problem-report-v1",
    generated_at: new Date().toISOString(),
    context: {
      app_version: import.meta.env.VITE_APP_VERSION ?? "unknown",
      build_id: import.meta.env.VITE_BUILD_ID ?? "unknown",
      client_data_schema: 3,
      dexie_schema: 14,
      online: typeof navigator === "undefined" ? null : navigator.onLine,
    },
    state: state == null ? undefined : sanitizeDiagnosticValue(state),
    entries: read(),
  };
}

export function problemReportText(state?: unknown) {
  return JSON.stringify(createProblemReport(state), null, 2);
}

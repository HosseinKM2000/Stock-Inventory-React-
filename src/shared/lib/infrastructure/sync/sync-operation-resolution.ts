import { apiFetch } from "@/shared/api/client";

export type RecordedSyncOperationResult = {
  operation_id: string;
  status: "applied" | "conflict" | "fatal_error";
  entity_id: number;
  record: Record<string, unknown> | null;
  error: string | null;
};

export function fetchRecordedOperationResult(operationId: string) {
  return apiFetch<RecordedSyncOperationResult>(
    `/sync/operations/${encodeURIComponent(operationId)}`,
  );
}

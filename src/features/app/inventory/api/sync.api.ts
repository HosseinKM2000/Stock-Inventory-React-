import { apiFetch } from "@/shared/api/client";
import {
  imageService,
  isLocalImage,
} from "@/shared/lib/infrastructure/media/image.service";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import type { Product } from "../types";

export type SyncResult = {
  operation_id: string;
  status: "applied" | "conflict" | "fatal_error";
  entity_id: number;
  record: Product | null;
  error: string | null;
};

export type SyncBatchResponse = {
  results: SyncResult[];
  cursor: number;
};

export type ServerChange = {
  cursor: number;
  entity: "product";
  entity_id: number;
  operation: "UPSERT" | "DELETE";
  record: Product | null;
};

export type SyncChangesResponse = {
  cursor: number;
  changes: ServerChange[];
};

export async function pushProductBatch(items: SyncQueueItem[]) {
  const formData = new FormData();

  formData.append(
    "operations_json",
    JSON.stringify({
      operations: items.map((item) => {
        const product = item.payload as Product | null;

        return {
          operation_id: item.operationId,
          entity: "product",
          entity_id: item.entityId,
          operation: item.action,
          payload: product,
          base_version: product?.version,
        };
      }),
    }),
  );

  for (const item of items) {
    const product = item.payload as Product | null;
    if (!isLocalImage(product?.image_url)) continue;

    try {
      formData.append(
        "files",
        await imageService.read(product.image_url),
        item.operationId,
      );
    } catch {
      // Missing media must not block synchronization of the product record.
    }
  }

  return apiFetch<SyncBatchResponse>("/sync/batch", {
    method: "POST",
    formData,
  });
}

export function pullProductChanges(cursor: number) {
  return apiFetch<SyncChangesResponse>(`/sync/changes?cursor=${cursor}`);
}

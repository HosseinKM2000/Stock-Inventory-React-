import { queueStorage } from "@/shared/lib/infrastructure/storage/queue-storage";
import { syncMetadataStorage } from "@/shared/lib/infrastructure/storage/sync-metadata-storage";
import { imageService } from "@/shared/lib/infrastructure/media/image.service";
import type { SyncQueueItem } from "@/shared/lib/infrastructure/storage/types";
import {
  registerInboundSyncHandler,
  registerSyncHandler,
  type SyncHandlerResult,
} from "@/shared/lib/infrastructure/sync/sync-service";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";

import { pullProductChanges, pushProductBatch } from "../api/sync.api";
import type { Product } from "../types";
import { inventoryRepository } from "./inventory.repository";
import { PRODUCT_ENTITY } from "./inventory-service";

const CURSOR_KEY = "product-sync-cursor";
const INITIALIZED_KEY = "product-sync-initialized";
const PERMANENTLY_REMOVED_ERRORS = new Set([
  "PRODUCT_NOT_FOUND",
  "CATALOG_PRODUCT_NOT_AVAILABLE",
]);

async function removeLocalProduct(id: number) {
  const local = await inventoryRepository.get(id);
  await inventoryRepository.remove(id);
  await imageService.remove(local?.image_url);
}

function localRepresentation(server: Product, local?: Product): Product {
  const localImage = local?.image_url?.startsWith("local://")
    ? local.image_url
    : undefined;

  return {
    ...server,
    image_url: localImage ?? server.image_url ?? null,
    server_image_url: server.image_url ?? null,
  };
}

async function push(items: SyncQueueItem[]): Promise<SyncHandlerResult[]> {
  const response = await pushProductBatch(items);

  const output: SyncHandlerResult[] = [];

  for (const result of response.results) {
    const item = items.find(
      (candidate) => candidate.operationId === result.operation_id,
    );

    if (!item) continue;

    if (
      result.status === "fatal_error" &&
      result.error &&
      PERMANENTLY_REMOVED_ERRORS.has(result.error)
    ) {
      // The server permanently removed this inventory source while the client
      // was offline. Keep the rejected payload recoverable as a conflict while
      // applying the authoritative server deletion to the local read model.
      await removeLocalProduct(item.entityId);
      output.push({ itemId: item.id, status: "conflict", error: result.error });
      continue;
    }

    if (result.record) {
      const local = await inventoryRepository.get(item.entityId);
      await inventoryRepository.save(localRepresentation(result.record, local));
    }

    output.push({
      itemId: item.id,
      status: result.status,
      error: result.error,
    });
  }

  return output;
}

async function pull() {
  const cursor = await syncMetadataStorage.getNumber(CURSOR_KEY);
  const initialized = await syncMetadataStorage.getNumber(INITIALIZED_KEY);
  let requestCursor = initialized && cursor === 0 ? -1 : cursor;
  let firstPage = true;

  // The server caps incremental pages at 500 changes. Drain every available
  // page in this run so a busy account does not remain partially reconciled
  // until another focus/connectivity event happens.
  while (true) {
    const response = await pullProductChanges(requestCursor);

    if (!initialized && firstPage) {
      const serverIds = new Set(
        response.changes
          .filter((change) => change.operation === "UPSERT")
          .map((change) => change.entity_id),
      );

      for (const local of await inventoryRepository.getAll()) {
        const pending = await queueStorage.get(`${PRODUCT_ENTITY}-${local.id}`);

        if (!serverIds.has(local.id) && !pending) {
          await removeLocalProduct(local.id);
        } else if (
          !serverIds.has(local.id) &&
          pending?.action === "UPDATE"
        ) {
          await queueService.markConflict(pending, "PRODUCT_NOT_FOUND");
          await removeLocalProduct(local.id);
        } else if (
          !serverIds.has(local.id) &&
          pending?.action === "DELETE"
        ) {
          await queueService.removeIfUnchanged(pending);
          await removeLocalProduct(local.id);
        }
      }
    }

    for (const change of response.changes) {
      const pending = await queueStorage.get(
        `${PRODUCT_ENTITY}-${change.entity_id}`,
      );

      if (change.operation === "DELETE") {
        // A server tombstone wins in the read model. A rejected edit remains in
        // the outbox so the user can inspect/recover it instead of losing it.
        if (pending?.action === "DELETE") {
          await queueService.removeIfUnchanged(pending);
        } else if (pending) {
          await queueService.markConflict(pending, "PRODUCT_NOT_FOUND");
        }
        await removeLocalProduct(change.entity_id);
        continue;
      }

      if (pending) continue;

      if (change.record) {
        const local = await inventoryRepository.get(change.entity_id);
        await inventoryRepository.save(localRepresentation(change.record, local));
      }
    }

    await syncMetadataStorage.set(CURSOR_KEY, response.cursor);

    const cursorAdvanced = response.cursor > requestCursor;
    if (response.changes.length < 500 || !cursorAdvanced) break;
    requestCursor = response.cursor;
    firstPage = false;
  }

  await syncMetadataStorage.set(INITIALIZED_KEY, 1);
}

export function registerProductSync() {
  registerSyncHandler(PRODUCT_ENTITY, push);
  registerInboundSyncHandler(PRODUCT_ENTITY, pull);
}

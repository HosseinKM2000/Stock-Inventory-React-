
import type { LocalInventoryItem } from "@/features/app/inventory/storage/types";
import type {
  SyncMetadataItem,
  SyncQueueItem,
} from "./types";

export interface InventoryDatabase {

  inventoryItems: LocalInventoryItem;

  syncQueue: SyncQueueItem;

  syncMetadata: SyncMetadataItem;

}

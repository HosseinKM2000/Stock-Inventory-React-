import Dexie, { type EntityTable } from "dexie";

import type {
  SyncQueueItem,
} from "./types";
import type { LocalInventoryItem } from "@/features/app/inventory/storage/types";


class AppDatabase extends Dexie {

  inventoryItems!: EntityTable<
    LocalInventoryItem,
    "id"
  >;

  syncQueue!: EntityTable<
    SyncQueueItem,
    "id"
  >;


  constructor() {

    super("inventory-db");


    this.version(1).stores({

      inventoryItems:
        "id, catalog_product_id, updated_at",

      syncQueue:
        "id, entity, entityId, updatedAt",

    });
  }
}


export const db = new AppDatabase();
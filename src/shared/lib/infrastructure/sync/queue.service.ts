import { db } from "../storage/db";
import type { QueueAction } from "../storage/types";



export const queueService = {

  async add(
    entity: string,
    entityId: number,
    action: QueueAction,
    payload: unknown,
  ) {

    await db.syncQueue.put({
      id: `${entity}-${entityId}`,
      entity,
      entityId,
      action,
      payload,
      updatedAt: Date.now(),
    });

  },


  async getAll() {

    return db.syncQueue.toArray();

  },


  async remove(id: string) {

    return db.syncQueue.delete(id);

  },


  async clear() {

    return db.syncQueue.clear();

  }

};
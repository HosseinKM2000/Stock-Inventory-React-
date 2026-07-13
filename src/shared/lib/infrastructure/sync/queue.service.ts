
import { queueStorage } from "../storage/queue-storage";
import type { QueueAction } from "../storage/types";

export const queueService = {

  async add(
    entity: string,
    entityId: number,
    action: QueueAction,
    payload: unknown,
  ) {

    await queueStorage.upsert({

      id: `${entity}-${entityId}`,

      entity,

      entityId,

      action,

      payload,

      updatedAt: Date.now(),

    });

  },


  async getAll() {
    return queueStorage.getAll();
  },


  async remove(id: string) {
    return queueStorage.remove(id);
  },


  async clear() {
    return queueStorage.clear();
  },

};
import { accessState } from "@/shared/access/access-state";
import { db } from "@/shared/lib/infrastructure/storage/db";
import { createLocalEntityId } from "@/shared/lib/infrastructure/storage/local-entity-id";
import { labelStorage } from "@/shared/lib/infrastructure/storage/label-storage";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import {
  PRODUCT_ENTITY,
  productSyncAction,
} from "@/features/app/inventory/services/inventory-service";
import type { Label, LabelInput } from "../types";

export const LABEL_ENTITY = "label";

export function normalizeLabelName(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("fa");
}

async function validatedName(input: LabelInput, exceptId?: number) {
  const name = input.name.normalize("NFC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) throw new Error("نام برچسب باید بین ۱ تا ۶۰ نویسه باشد");
  const normalized = normalizeLabelName(name);
  const duplicate = (await labelStorage.getAll()).find(
    (label) => label.id !== exceptId && label.normalized_name === normalized,
  );
  if (duplicate) throw new Error("این برچسب قبلاً ایجاد شده است");
  return { name, normalized };
}

export const labelService = {
  getAll: () => labelStorage.getAll(),

  async create(input: LabelInput) {
    accessState.requireTool("labels");
    const { name, normalized } = await validatedName(input);
    const now = new Date().toISOString();
    const label: Label = {
      id: createLocalEntityId(), name, normalized_name: normalized,
      created_at: now, updated_at: now,
    };
    await localMutationStorage.label(async () => {
      await labelStorage.save(label);
      await queueService.enqueue(LABEL_ENTITY, label.id, "CREATE", label);
    });
    return label;
  },

  async update(id: number, input: LabelInput) {
    accessState.requireTool("labels");
    const current = await labelStorage.get(id);
    if (!current) throw new Error("برچسب پیدا نشد");
    const { name, normalized } = await validatedName(input, id);
    const label = { ...current, name, normalized_name: normalized, updated_at: new Date().toISOString() };
    await localMutationStorage.label(async () => {
      await labelStorage.save(label);
      await queueService.enqueue(LABEL_ENTITY, id, "UPDATE", label);
    });
    return label;
  },

  async remove(id: number) {
    accessState.requireTool("labels");
    await localMutationStorage.label(async () => {
      for (const product of await db.inventoryItems.toArray()) {
        if (product.local_user_id !== accessState.user()?.id || !product.label_ids?.includes(id)) continue;
        const updated = {
          ...product,
          label_ids: product.label_ids.filter((labelId) => labelId !== id),
          updated_at: new Date().toISOString(),
        };
        await db.inventoryItems.put(updated);
        await queueService.enqueue(
          PRODUCT_ENTITY,
          product.id,
          productSyncAction(product),
          updated,
        );
      }
      await labelStorage.remove(id);
      await queueService.enqueue(LABEL_ENTITY, id, "DELETE", null);
    });
  },
};

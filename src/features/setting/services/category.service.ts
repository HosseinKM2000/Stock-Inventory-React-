import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import type { Category, CategoryInput } from "../types";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import { accessState } from "@/shared/access/access-state";
import { createLocalEntityId } from "@/shared/lib/infrastructure/storage/local-entity-id";
import { localMutationStorage } from "@/shared/lib/infrastructure/storage/local-mutation-storage";

export const CATEGORY_ENTITY = "category";

export const categoryService = {
  getAll: () => categoryStorage.getAll(),

  async create(input: CategoryInput) {
    accessState.requireTool("categories");
    const now = new Date().toISOString();
    const category: Category = {
      id: input.id ?? createLocalEntityId(),
      name: input.name.trim(),
      description: input.description ?? "",
      created_at: now,
      updated_at: now,
    };
    await localMutationStorage.category(async () => {
      await categoryStorage.save(category);
      await queueService.enqueue(CATEGORY_ENTITY, category.id, "CREATE", category);
    });
    return category;
  },

  async update(id: number, input: CategoryInput) {
    accessState.requireTool("categories");
    const current = await categoryStorage.get(id);
    if (!current) throw new Error("Category not found");
    const category = {
      ...current,
      name: input.name.trim(),
      description: input.description ?? "",
      updated_at: new Date().toISOString(),
    };
    await localMutationStorage.category(async () => {
      await categoryStorage.save(category);
      await queueService.enqueue(CATEGORY_ENTITY, id, "UPDATE", category);
    });
    return category;
  },

  async remove(id: number) {
    accessState.requireTool("categories");
    for (const product of await inventoryService.getAll({ category_id: id })) {
      await inventoryService.update(product.id, { category_id: null });
    }
    await localMutationStorage.category(async () => {
      await categoryStorage.remove(id);
      await queueService.enqueue(CATEGORY_ENTITY, id, "DELETE", null);
    });
  },
};

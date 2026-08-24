import { categoryStorage } from "@/shared/lib/infrastructure/storage/category-storage";
import { queueService } from "@/shared/lib/infrastructure/sync/queue.service";
import type { Category, CategoryInput } from "../types";
import { inventoryService } from "@/features/app/inventory/services/inventory-service";
import { accessState } from "@/shared/access/access-state";

export const CATEGORY_ENTITY = "category";

export const categoryService = {
  getAll: () => categoryStorage.getAll(),

  async create(input: CategoryInput) {
    accessState.requireCapability("categories.write");
    const now = new Date().toISOString();
    const category: Category = {
      id: input.id ?? Date.now(),
      name: input.name.trim(),
      description: input.description ?? "",
      created_at: now,
      updated_at: now,
    };
    await categoryStorage.save(category);
    await queueService.enqueue(CATEGORY_ENTITY, category.id, "CREATE", category);
    return category;
  },

  async update(id: number, input: CategoryInput) {
    accessState.requireCapability("categories.write");
    const current = await categoryStorage.get(id);
    if (!current) throw new Error("Category not found");
    const category = {
      ...current,
      name: input.name.trim(),
      description: input.description ?? "",
      updated_at: new Date().toISOString(),
    };
    await categoryStorage.save(category);
    await queueService.enqueue(CATEGORY_ENTITY, id, "UPDATE", category);
    return category;
  },

  async remove(id: number) {
    accessState.requireCapability("categories.write");
    for (const product of await inventoryService.getAll({ category_id: id })) {
      await inventoryService.update(product.id, { category_id: null });
    }
    await categoryStorage.remove(id);
    await queueService.enqueue(CATEGORY_ENTITY, id, "DELETE", null);
  },
};

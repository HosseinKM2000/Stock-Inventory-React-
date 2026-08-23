import type { Category } from "@/features/setting/types";
import { db } from "./db";

export const categoryStorage = {
  getAll: () => db.categories.orderBy("name").toArray(),
  get: (id: number) => db.categories.get(id),
  save: (category: Category) => db.categories.put(category),
  saveMany: (categories: Category[]) => db.categories.bulkPut(categories),
  remove: (id: number) => db.categories.delete(id),
};

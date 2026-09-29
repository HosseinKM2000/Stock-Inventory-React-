import type { Category } from "@/features/setting/types";
import { db } from "./db";
import { accessState } from "@/shared/access/access-state";

const userId = () => accessState.user()?.id;

export const categoryStorage = {
  getAll: async () => {
    const owner = userId();
    if (!owner) return [];
    const categories = await db.categories
      .where("local_user_id")
      .equals(owner)
      .toArray();
    return categories.sort((left, right) => {
      const byCreatedAt =
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      return byCreatedAt || right.id - left.id;
    });
  },
  get: async (id: number) => {
    const category = await db.categories.get(id);
    return category?.local_user_id === userId() ? category : undefined;
  },
  save: (category: Category) => {
    const owner = userId();
    if (!owner) throw new Error("برای دسترسی به دسته‌ها باید وارد حساب شوید");
    return db.categories.put({ ...category, local_user_id: owner });
  },
  saveMany: (categories: Category[]) => {
    const owner = userId();
    if (!owner) throw new Error("برای دسترسی به دسته‌ها باید وارد حساب شوید");
    return db.categories.bulkPut(categories.map((item) => ({ ...item, local_user_id: owner })));
  },
  replaceAll: async (categories: Category[]) => {
    const owner = userId();
    if (!owner) throw new Error("برای دسترسی به دسته‌ها باید وارد حساب شوید");
    await db.transaction("rw", db.categories, async () => {
      const existing = await db.categories
        .where("local_user_id")
        .equals(owner)
        .primaryKeys();
      await db.categories.bulkDelete(existing);
      await db.categories.bulkPut(
        categories.map((item) => ({ ...item, local_user_id: owner })),
      );
    });
  },
  remove: async (id: number) => {
    const category = await db.categories.get(id);
    if (category?.local_user_id === userId()) await db.categories.delete(id);
  },
};

import { accessState } from "@/shared/access/access-state";
import type { Label } from "@/features/setting/types";
import { db } from "./db";

const userId = () => accessState.user()?.id;

export const labelStorage = {
  async getAll() {
    const owner = userId();
    if (!owner) return [];
    return db.labels.where("local_user_id").equals(owner).sortBy("name");
  },
  async get(id: number) {
    const item = await db.labels.get(id);
    return item?.local_user_id === userId() ? item : undefined;
  },
  async save(label: Label) {
    const owner = userId();
    if (!owner) throw new Error("برای ذخیره برچسب باید وارد حساب شوید");
    return db.labels.put({ ...label, local_user_id: owner });
  },
  async remove(id: number) {
    const item = await this.get(id);
    if (item) await db.labels.delete(id);
  },
};

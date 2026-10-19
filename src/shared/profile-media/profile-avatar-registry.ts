import analytics from "./assets/analytics.svg";
import commerce from "./assets/commerce.svg";
import inventory from "./assets/inventory.svg";
import store from "./assets/store.svg";
import warehouse from "./assets/warehouse.svg";

export const profileAvatarRegistry = [
  { id: "store", src: store, label: "فروشگاه" },
  { id: "warehouse", src: warehouse, label: "انبار" },
  { id: "inventory", src: inventory, label: "موجودی" },
  { id: "analytics", src: analytics, label: "تحلیل" },
  { id: "commerce", src: commerce, label: "تجارت" },
] as const;

export type ProfileAvatarId = (typeof profileAvatarRegistry)[number]["id"];

export function isProfileAvatarId(value: unknown): value is ProfileAvatarId {
  return profileAvatarRegistry.some((avatar) => avatar.id === value);
}

export function getProfileAvatar(id: ProfileAvatarId) {
  return profileAvatarRegistry.find((avatar) => avatar.id === id);
}

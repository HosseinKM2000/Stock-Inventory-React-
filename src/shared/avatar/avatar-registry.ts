import avatar01 from "./assets/avatar-01.svg";
import avatar02 from "./assets/avatar-02.svg";
import avatar03 from "./assets/avatar-03.svg";
import avatar04 from "./assets/avatar-04.svg";
import avatar05 from "./assets/avatar-05.svg";

export const avatarRegistry = [
  { id: "initials", src: null, label: "حروف نام" },
  { id: "avatar-01", src: avatar01, label: "آبی مدرن" },
  { id: "avatar-02", src: avatar02, label: "سبز حرفه‌ای" },
  { id: "avatar-03", src: avatar03, label: "گرم و دوستانه" },
  { id: "avatar-04", src: avatar04, label: "نیلی آرام" },
  { id: "avatar-05", src: avatar05, label: "بنفش پویا" },
] as const;

export type AvatarId = (typeof avatarRegistry)[number]["id"];

export function getAvatar(id: AvatarId) {
  return avatarRegistry.find((avatar) => avatar.id === id) ?? avatarRegistry[0];
}

export function isAvatarId(value: string | null): value is AvatarId {
  return avatarRegistry.some((avatar) => avatar.id === value);
}

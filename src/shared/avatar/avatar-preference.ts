import { isAvatarId, type AvatarId } from "./avatar-registry";

const KEY = "inventory-avatar";
export const AVATAR_CHANGE_EVENT = "avatar-change";

export function getAvatarPreference(): AvatarId {
  const value = localStorage.getItem(KEY);
  return isAvatarId(value) ? value : "initials";
}

export function setAvatarPreference(value: AvatarId) {
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new CustomEvent<AvatarId>(AVATAR_CHANGE_EVENT, { detail: value }));
}

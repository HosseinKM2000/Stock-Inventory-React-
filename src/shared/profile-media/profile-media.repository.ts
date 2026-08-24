import { isLocalImage } from "@/shared/lib/infrastructure/media/image.service";
import { isProfileAvatarId, type ProfileAvatarId } from "./profile-avatar-registry";

export type ProfileMediaSelection =
  | { kind: "initials" }
  | { kind: "avatar"; avatarId: ProfileAvatarId }
  | { kind: "custom"; path: string };

const KEY = "inventory-profile-media-v1";
const LEGACY_AVATAR_KEY = "inventory-avatar";
const CHANGE_EVENT = "profile-media-change";
const DEFAULT_SELECTION: ProfileMediaSelection = { kind: "initials" };
let cachedRaw: string | null | undefined;
let cachedSelection: ProfileMediaSelection = DEFAULT_SELECTION;

function parse(value: string | null): ProfileMediaSelection {
  if (!value) return DEFAULT_SELECTION;
  try {
    const selection = JSON.parse(value) as Partial<ProfileMediaSelection>;
    if (selection.kind === "custom" && isLocalImage(selection.path)) {
      return { kind: "custom", path: selection.path };
    }
    if (selection.kind === "avatar" && isProfileAvatarId(selection.avatarId)) {
      return { kind: "avatar", avatarId: selection.avatarId };
    }
  } catch {
    // Corrupted local preference falls back to initials.
  }
  return DEFAULT_SELECTION;
}

export const profileMediaRepository = {
  get(): ProfileMediaSelection {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSelection = parse(raw);
    }
    return cachedSelection;
  },

  cleanupLegacyPreference() {
    localStorage.removeItem(LEGACY_AVATAR_KEY);
  },

  set(selection: ProfileMediaSelection) {
    const raw = JSON.stringify(selection);
    localStorage.setItem(KEY, raw);
    cachedRaw = raw;
    cachedSelection = selection;
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  },

  subscribe(listener: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) listener();
    };
    window.addEventListener(CHANGE_EVENT, listener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

import { isLocalImage } from "@/shared/lib/infrastructure/media/image.service";
import { isProfileAvatarId, type ProfileAvatarId } from "./profile-avatar-registry";
import { accessState } from "@/shared/access/access-state";

export type ProfileMediaSelection =
  | { kind: "initials" }
  | { kind: "avatar"; avatarId: ProfileAvatarId }
  | { kind: "custom"; path: string };

const LEGACY_MEDIA_KEY = "inventory-profile-media-v1";
const LEGACY_AVATAR_KEY = "inventory-avatar";
const CHANGE_EVENT = "profile-media-change";
const DEFAULT_SELECTION: ProfileMediaSelection = { kind: "initials" };
let cachedRaw: string | null | undefined;
let cachedKey: string | undefined;
let cachedSelection: ProfileMediaSelection = DEFAULT_SELECTION;

function storageKey() {
  return `inventory:${accessState.user()?.id ?? "anonymous"}:profile-media-v1`;
}

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
    const key = storageKey();
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_MEDIA_KEY);
      if (legacy) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_MEDIA_KEY);
        raw = legacy;
      }
    }
    if (key !== cachedKey || raw !== cachedRaw) {
      cachedKey = key;
      cachedRaw = raw;
      cachedSelection = parse(raw);
    }
    return cachedSelection;
  },

  cleanupLegacyPreference() {
    localStorage.removeItem(LEGACY_AVATAR_KEY);
  },

  set(selection: ProfileMediaSelection) {
    const key = storageKey();
    const raw = JSON.stringify(selection);
    localStorage.setItem(key, raw);
    cachedKey = key;
    cachedRaw = raw;
    cachedSelection = selection;
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  },

  subscribe(listener: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey()) listener();
    };
    window.addEventListener(CHANGE_EVENT, listener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, listener);
      window.removeEventListener("storage", onStorage);
    };
  },
};

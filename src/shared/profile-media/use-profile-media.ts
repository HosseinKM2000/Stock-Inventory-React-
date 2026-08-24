import { useSyncExternalStore } from "react";
import { useResolvedImage } from "@/shared/lib/infrastructure/media/useImage";
import { getProfileAvatar } from "./profile-avatar-registry";
import { profileMediaRepository } from "./profile-media.repository";

export function useProfileMedia() {
  const selection = useSyncExternalStore(
    profileMediaRepository.subscribe,
    profileMediaRepository.get,
  );
  const customPath = selection.kind === "custom" ? selection.path : null;
  const customImage = useResolvedImage(customPath);
  const avatar = selection.kind === "avatar" ? getProfileAvatar(selection.avatarId) : undefined;

  return {
    selection,
    src: selection.kind === "custom" ? customImage.src : avatar?.src,
    imageLoading: selection.kind === "custom" && customImage.loading,
    imageError: selection.kind === "custom" ? customImage.error : undefined,
  };
}

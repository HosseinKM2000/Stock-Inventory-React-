import { imageService } from "@/shared/lib/infrastructure/media/image.service";
import type { ProfileAvatarId } from "./profile-avatar-registry";
import { profileMediaRepository } from "./profile-media.repository";

async function removePreviousCustom(previous: ReturnType<typeof profileMediaRepository.get>) {
  if (previous.kind === "custom") await imageService.remove(previous.path);
}

export const profileMediaService = {
  async selectCustom(file: File) {
    const previous = profileMediaRepository.get();
    const path = await imageService.save(file, { purpose: "profile" });
    try {
      profileMediaRepository.set({ kind: "custom", path });
    } catch (error) {
      await imageService.remove(path);
      throw error;
    }
    await removePreviousCustom(previous);
  },

  async selectAvatar(avatarId: ProfileAvatarId) {
    const previous = profileMediaRepository.get();
    profileMediaRepository.set({ kind: "avatar", avatarId });
    await removePreviousCustom(previous);
  },

  async remove() {
    const previous = profileMediaRepository.get();
    profileMediaRepository.set({ kind: "initials" });
    await removePreviousCustom(previous);
  },
};

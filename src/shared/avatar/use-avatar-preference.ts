import { useEffect, useState } from "react";
import { getAvatar, type AvatarId } from "./avatar-registry";
import { AVATAR_CHANGE_EVENT, getAvatarPreference, setAvatarPreference } from "./avatar-preference";

export function useAvatarPreference() {
  const [id, setId] = useState<AvatarId>(getAvatarPreference);

  useEffect(() => {
    const handleChange = (event: Event) => setId((event as CustomEvent<AvatarId>).detail);
    const handleStorage = () => setId(getAvatarPreference());
    window.addEventListener(AVATAR_CHANGE_EVENT, handleChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(AVATAR_CHANGE_EVENT, handleChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    id,
    avatar: getAvatar(id),
    select: setAvatarPreference,
  };
}

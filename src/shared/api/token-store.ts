import { storage } from "@/shared/storage/local-storage";
import { STORAGE_KEYS } from "@/shared/storage/keys";

export function getToken() {
  return storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN);
}

export function setToken(token: string) {
  storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
}

export function clearToken() {
  storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

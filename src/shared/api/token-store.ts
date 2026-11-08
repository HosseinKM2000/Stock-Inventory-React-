import { STORAGE_KEYS } from "@/shared/lib/infrastructure/storage/keys";
import { storage } from "@/shared/lib/infrastructure/storage/local-storage";

export function getToken() {
  return storage.get<string>(STORAGE_KEYS.ACCESS_TOKEN)
    ?? sessionStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function setToken(token: string, persist = true) {
  clearToken();
  if (persist) storage.set(STORAGE_KEYS.ACCESS_TOKEN, token);
  else sessionStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
}

export function clearToken() {
  storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
  sessionStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

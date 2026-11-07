import { useSyncExternalStore } from "react";
import { appUpdateService } from "../services/app-update.service";

export function useAppUpdate() {
  return useSyncExternalStore(
    appUpdateService.subscribe,
    appUpdateService.getSnapshot,
    appUpdateService.getSnapshot,
  );
}

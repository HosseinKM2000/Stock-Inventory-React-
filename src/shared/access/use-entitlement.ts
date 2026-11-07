import { useSyncExternalStore } from "react";
import { accessState } from "./access-state";

export function useEntitlementAccess() {
  useSyncExternalStore(accessState.subscribe, accessState.revision, accessState.revision);
  return accessState.evaluate();
}

export function useEntitlement() {
  return useEntitlementAccess().entitlement;
}

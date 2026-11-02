import { accessState } from "@/shared/access/access-state";
import { networkService } from "../network/network-service";
import { syncResourceKey, type QueueAction } from "../storage/types";
import { queueService } from "./queue.service";
import { syncService } from "./sync-service";

export function isTeamMode() {
  return accessState.user()?.store_operating_mode === "team";
}

export const teamCommandService = {
  async submit(entity: string, entityId: number, action: QueueAction, payload: unknown, operationId = crypto.randomUUID()) {
    const user = accessState.user();
    if (user?.store_operating_mode !== "team" || !user.store_policy_version) {
      throw new Error("STORE_POLICY_CONTEXT_REQUIRED");
    }
    if (!navigator.locks) throw new Error("TEAM_LOCKING_UNAVAILABLE");
    if (networkService.isOffline()) throw new Error("TEAM_ONLINE_REQUIRED");

    const resourceKey = syncResourceKey({ entity, entityId, payload });
    const predecessor = (await queueService.getAll()).find(
      (item) => syncResourceKey(item) === resourceKey,
    );
    if (predecessor) {
      if (predecessor.operationId !== operationId) throw new Error("TEAM_PREDECESSOR_UNRESOLVED");
      await syncService.sync();
      const unresolvedReplay = (await queueService.getAll()).find((item) => item.operationId === operationId);
      if (unresolvedReplay) throw new Error(unresolvedReplay.lastError ?? "TEAM_RESULT_UNCONFIRMED");
      return operationId;
    }

    await queueService.enqueue(entity, entityId, action, payload, {
      operationId,
      forceNew: true,
      executionMode: "team",
      policyVersion: user.store_policy_version,
    });
    await syncService.sync();
    const unresolved = (await queueService.getAll()).find((item) => item.operationId === operationId);
    if (unresolved) throw new Error(unresolved.lastError ?? "TEAM_RESULT_UNCONFIRMED");
    return operationId;
  },
};

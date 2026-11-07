const TAB_ID = crypto.randomUUID();
const STALE_AFTER_MS = 30_000;
const localDirty = new Set<string>();
const remoteTabs = new Map<string, { dirty: boolean; observedAt: number }>();
const channel = typeof BroadcastChannel === "undefined"
  ? null
  : new BroadcastChannel("tanzim-unsaved-work-v1");

function publish() {
  channel?.postMessage({ type: "state", tabId: TAB_ID, dirty: localDirty.size > 0, observedAt: Date.now() });
}

channel?.addEventListener("message", (event) => {
  const data = event.data as { type?: string; tabId?: string; dirty?: boolean; observedAt?: number };
  if (data.type === "query" && data.tabId !== TAB_ID) {
    publish();
    return;
  }
  if (!data.tabId || data.tabId === TAB_ID || typeof data.dirty !== "boolean") return;
  remoteTabs.set(data.tabId, { dirty: data.dirty, observedAt: data.observedAt ?? Date.now() });
});

channel?.postMessage({ type: "query", tabId: TAB_ID });

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    localDirty.clear();
    publish();
  });
  window.setInterval(() => {
    if (localDirty.size > 0) publish();
  }, 10_000);
}

export const unsavedWork = {
  set(formId: string, dirty: boolean) {
    if (dirty) localDirty.add(formId);
    else localDirty.delete(formId);
    publish();
  },
  hasAny() {
    const now = Date.now();
    for (const [tabId, state] of remoteTabs) {
      if (now - state.observedAt > STALE_AFTER_MS) remoteTabs.delete(tabId);
    }
    return localDirty.size > 0 || [...remoteTabs.values()].some((state) => state.dirty);
  },
};

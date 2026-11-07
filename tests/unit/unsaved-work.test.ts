import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class ChannelDouble {
  static current: ChannelDouble;
  readonly name: string;
  messages: unknown[] = [];
  listener?: (event: MessageEvent) => void;

  constructor(name: string) {
    this.name = name;
    ChannelDouble.current = this;
  }

  postMessage(value: unknown) {
    this.messages.push(value);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listener = listener;
  }

  dispatch(value: unknown) {
    this.listener?.({ data: value } as MessageEvent);
  }
}

describe("cross-tab unsaved work", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.stubGlobal("BroadcastChannel", ChannelDouble);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("queries existing tabs immediately and tracks their dirty/clean replies", async () => {
    const { unsavedWork } = await import("@/features/app-update/services/unsaved-work");
    const channel = ChannelDouble.current;
    expect(channel.name).toBe("tanzim-unsaved-work-v1");
    expect(channel.messages).toEqual([expect.objectContaining({ type: "query" })]);

    channel.dispatch({ type: "state", tabId: "other-tab", dirty: true, observedAt: Date.now() });
    expect(unsavedWork.hasAny()).toBe(true);
    channel.dispatch({ type: "state", tabId: "other-tab", dirty: false, observedAt: Date.now() });
    expect(unsavedWork.hasAny()).toBe(false);

    unsavedWork.set("profile-form", true);
    expect(channel.messages.at(-1)).toEqual(expect.objectContaining({ type: "state", dirty: true }));
  });
});

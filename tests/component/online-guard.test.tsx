import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ online: false }));

vi.mock("@/shared/lib/infrastructure/sync/use-sync-status", () => ({
  useOnline: () => state.online,
}));

import { OnlineGuard } from "@/shared/access/online-guard";

describe("server-dependent operation boundary", () => {
  beforeEach(() => {
    state.online = false;
  });

  it("does not expose a server action while offline", () => {
    render(<OnlineGuard><button type="button">server action</button></OnlineGuard>);
    expect(screen.queryByRole("button", { name: "server action" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeVisible();
  });

  it("restores the action when connectivity is available", () => {
    state.online = true;
    render(<OnlineGuard><button type="button">server action</button></OnlineGuard>);
    expect(screen.getByRole("button", { name: "server action" })).toBeVisible();
  });
});

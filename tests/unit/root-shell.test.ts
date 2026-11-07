import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("application root shell", () => {
  it("does not mount the TanStack Router development badge", () => {
    const rootRoutePath = resolve(process.cwd(), "src/routes/__root.tsx");
    const rootRouteSource = readFileSync(rootRoutePath, "utf8");

    expect(rootRouteSource).not.toContain("@tanstack/router-devtools");
    expect(rootRouteSource).not.toContain("TanStackRouterDevtools");
  });
});

import path from "node:path";
import { defineConfig } from "vitest/config";

const shared = {
  alias: { "@": path.resolve(__dirname, "./src") },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: shared,
        test: {
          name: "unit",
          environment: "happy-dom",
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        resolve: shared,
        test: {
          name: "component",
          environment: "happy-dom",
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/component/**/*.test.tsx"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage/frontend",
      include: [
        "src/features/app/inventory/domain/**/*.ts",
        "src/features/app/{dashboard,inventory}/services/**/*.ts",
        "src/features/setting/services/**/*.ts",
        "src/shared/{access,theme}/**/*.{ts,tsx}",
        "src/shared/lib/infrastructure/{media,storage,sync}/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "**/types.ts"],
    },
  },
});

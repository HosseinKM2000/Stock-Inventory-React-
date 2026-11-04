import path from "path";
import { defineConfig } from "vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-vite-plugin";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";

const appVersion = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;
const buildId = (process.env.TANZIM_BUILD_ID || appVersion).replace(/[^a-zA-Z0-9._-]/g, "-");

function stampServiceWorker() {
  return {
    name: "stamp-service-worker",
    closeBundle() {
      const workerPath = new URL("./dist/sw.js", import.meta.url);
      const source = readFileSync(workerPath, "utf8");
      writeFileSync(workerPath, source.replaceAll("__TANZIM_BUILD_ID__", buildId));
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion),
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(buildId),
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
      routeFileIgnorePrefix: "-",
      quoteStyle: "single",
    }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    stampServiceWorker(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  build: {
    // The service worker reads this file during installation so every
    // code-split route is available before the connection disappears.
    manifest: true,
  },
});

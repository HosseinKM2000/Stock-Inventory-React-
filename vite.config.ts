import path from "path";
import { defineConfig } from "vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from "@tanstack/router-vite-plugin";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
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
  ],
  resolve: {
    alias: {
      "src": path.resolve(__dirname, "./src"),
      "@fs/form": path.resolve(__dirname, "./packages/shared/ui/form"),
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});

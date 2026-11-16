import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: [
      "@fullcalendar/react",
      "react",
      "react-dom",
      "@assistant-ui/react",
      "@assistant-ui/react-lexical",
      "@assistant-ui/react-markdown",
    ],
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: "127.0.0.1",
    port: 3340,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3341",
        rewrite: (path) => (path.startsWith("/api/v1/") ? path.slice(4) : path),
      },
    },
  },
  // Direct Vite builds are previews. scripts/build.mjs publishes complete builds
  // to dist, preserves old hashed assets and replaces the entrypoint atomically.
  build: {
    outDir: fileURLToPath(
      new URL("../../.local/web-preview/", import.meta.url),
    ),
    emptyOutDir: true,
  },
});

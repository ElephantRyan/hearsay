/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In development the app and the API share an origin: /api/* goes to the fiig
// service with the prefix removed, so the session cookie is first-party and
// no CORS is involved. A production deployment does the same in its proxy.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:8080",
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    // Tests ask the (fake) server where ABS is, whatever a local .env builds in.
    env: { VITE_ABS_URL: "" },
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});

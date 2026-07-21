import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // During local dev: proxy /api/* → backend on :4000
      // NOTE: the frontend calls the backend directly via VITE_API_URL,
      // so this proxy is a convenience fallback only.
    },
  },
});

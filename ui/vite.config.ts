import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Dev proxy: browser only talks to Vite; API/WebSocket stay on the compute host.
    // Use when SSH-forwarding just port 5173 (omit VITE_API_BASE).
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});

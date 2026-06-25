import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api -> FastAPI on :3333 so the frontend can use relative URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 2222,
    proxy: {
      "/api": "http://localhost:3333",
    },
  },
});

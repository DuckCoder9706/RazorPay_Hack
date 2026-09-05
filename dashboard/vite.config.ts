import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const api = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    proxy: {
      "/health": api,
      "/batch": api,
      "/exceptions": api,
      "/learn": api,
      "/churn": api,
      "/audit": api,
      "/outcome-model": api,
      "/razorpay": api,
      "/verify": api,
      "/reconciliation": api,
      "/pipeline": api,
    },
  },
});

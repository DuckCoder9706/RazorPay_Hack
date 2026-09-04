import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy API calls to the FastAPI backend during development.
// Every read-only endpoint the dashboard consumes is listed here.
const api = "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/health": api,
      "/batch": api,
      "/exceptions": api,
      "/learn": api,
      "/churn": api,
      "/audit": api,
      "/outcome-model": api,
    },
  },
});

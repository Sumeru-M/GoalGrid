import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend reuses the AI engine (../src) and backend (../backend) source
// directly, so we allow Vite to serve files from the repo root.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [".."] } },
});

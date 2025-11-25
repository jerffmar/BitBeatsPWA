import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
    target: "esnext", // Required for Top-level await and advanced Storage APIs
    sourcemap: false,
  },
  server: {
    host: true,
  },
});

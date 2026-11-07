import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const server = `http://127.0.0.1:${process.env.PORT ?? 3210}`;

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": server, "/w": server, "/bridge.js": server, "/stoa": server },
  },
});

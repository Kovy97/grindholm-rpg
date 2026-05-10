import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  base: "./",
  publicDir: "../assets",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
      "/sprites": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
    },
  },
});

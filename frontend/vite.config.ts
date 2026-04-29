import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://localhost:9090",
        changeOrigin: true,
        secure: false
      },
      "/ws": {
        target: "wss://localhost:9090",
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "framer-motion"],
          charts: ["recharts"]
        }
      }
    }
  }
});

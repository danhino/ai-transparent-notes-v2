import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/@codemirror/theme-one-dark/')) return 'codemirror-theme';
          if (id.includes('/@codemirror/lang-') || id.includes('/@codemirror/legacy-modes/')) return 'codemirror-langs';
          if (id.includes('/@codemirror/') || id.includes('/codemirror/')) return 'codemirror-core';
          if (id.includes('/react-dom/') || id.includes('/react/')) return 'vendor-react';
          if (id.includes('/zustand/')) return 'vendor-state';
          if (id.includes('/framer-motion/')) return 'vendor-animation';
          if (id.includes('/diff-match-patch/')) return 'vendor-diff';
        },
      },
    },
  },
}));

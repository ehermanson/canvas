import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

function createManualChunks(id: string) {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("/react/") || id.includes("/react-dom/")) {
    return "vendor-react";
  }

  if (id.includes("/@base-ui/")) {
    return "vendor-base-ui";
  }

  if (id.includes("/@dnd-kit/")) {
    return "vendor-dnd";
  }

  if (id.includes("/motion/")) {
    return "vendor-motion";
  }

  if (id.includes("/lucide-react/")) {
    return "vendor-icons";
  }

  if (id.includes("/nuqs/")) {
    return "vendor-routing";
  }

  return undefined;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: createManualChunks,
      },
    },
  },
});

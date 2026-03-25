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

  if (id.includes("/motion/")) {
    return "vendor-motion";
  }

  if (id.includes("/lucide-react/")) {
    return "vendor-icons";
  }

  return undefined;
}

// Floor-plan app configuration
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/test/setup.ts",
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

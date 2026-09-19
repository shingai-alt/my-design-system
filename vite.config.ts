import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/index.js"),
      formats: ["es"],
      fileName: () => "ds.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "ds.css";
          return "[name][extname]";
        },
      },
    },
  },
});

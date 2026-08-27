import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "web",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../server/dist/widget",
    emptyOutDir: true,
    rollupOptions: {
      input: "web/mcp-app.html"
    }
  }
});

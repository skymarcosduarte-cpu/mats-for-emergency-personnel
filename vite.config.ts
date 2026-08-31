import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const BUILD_TIME = new Date().toISOString();
const BUILD_NUMBER =
  process.env.BUILD_NUMBER ||
  process.env.GITHUB_RUN_NUMBER ||
  BUILD_TIME.replace(/[-:TZ.]/g, "").slice(0, 12);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_NUMBER__: JSON.stringify(BUILD_NUMBER),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

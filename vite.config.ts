import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const BUILD_TIME = new Date().toISOString();
const BUILD_NUMBER =
  process.env.BUILD_NUMBER ||
  process.env.GITHUB_RUN_NUMBER ||
  BUILD_TIME.replace(/[-:TZ.]/g, "").slice(0, 12);
// Identificadores del commit de GitHub que se compiló (en CI vienen de GitHub Actions).
const GIT_SHA = process.env.GIT_SHA || process.env.GITHUB_SHA || "";
const CI_RUN_ID = process.env.CI_RUN_ID || process.env.GITHUB_RUN_ID || "";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_NUMBER__: JSON.stringify(BUILD_NUMBER),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __GIT_SHA__: JSON.stringify(GIT_SHA),
    __CI_RUN_ID__: JSON.stringify(CI_RUN_ID),
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

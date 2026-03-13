import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const deployTarget = env.VITE_DEPLOY_TARGET || "cloudflare";
  const explicitBase = env.VITE_BASE_PATH?.trim();
  const backendBaseUrl = env.VITE_BACKEND_BASE_URL || "http://localhost:8080";

  const normalizedBase =
    explicitBase && explicitBase.startsWith("/")
      ? explicitBase
      : mode === "production" && deployTarget === "github-pages"
        ? "/signal-guide-health/"
        : "/";

  return {
    base: normalizedBase,
    server: {
      host: "::",
      port: 8081,
      proxy: {
        "/api": {
          target: backendBaseUrl,
          changeOrigin: true,
        },
        "/health": {
          target: backendBaseUrl,
          changeOrigin: true,
        },
        "/ready": {
          target: backendBaseUrl,
          changeOrigin: true,
        },
      },
      hmr: {
        overlay: false,
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

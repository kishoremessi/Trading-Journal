import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Safe defaults (NO hard crash)
const port = Number(process.env.PORT) || 5173;
const basePath = process.env.BASE_PATH || "/";

export default defineConfig(async () => {
  const isReplit = Boolean(process.env.REPL_ID);

  const plugins: any[] = [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
  ];

  // Only load Replit plugins inside Replit
  if (isReplit) {
    const cartographer = await import("@replit/vite-plugin-cartographer");
    const devBanner = await import("@replit/vite-plugin-dev-banner");

    plugins.push(
      cartographer.cartographer({
        root: path.resolve(import.meta.dirname, ".."),
      }),
      devBanner.devBanner()
    );
  }

  return {
    base: basePath,

    plugins,

    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets"
        ),
      },
      dedupe: ["react", "react-dom"],
    },

    root: path.resolve(import.meta.dirname),

    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },

    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },

    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});

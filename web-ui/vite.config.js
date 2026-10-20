import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const deviceUrl = env.ESP32_URL?.replace(/\/$/, "") ?? "";
  const proxy = deviceUrl
    ? Object.fromEntries(
        [
          "/pot",
          "/degree",
          "/temp",
          "/humidity",
          "/relay",
          "/relayState",
          "/calibrate",
          "/calibration/reset",
          "/target",
          "/stop",
          "/motorStatus",
        ].map((path) => [
          path,
          { target: deviceUrl, changeOrigin: true },
        ]),
      )
    : undefined;

  return {
    plugins: [tailwindcss()],
    define: {
      __ESP32_TARGET__: JSON.stringify(deviceUrl),
    },
    server: {
      host: "0.0.0.0",
      proxy,
    },
    build: {
      outDir: "../data",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          assetFileNames: "assets/[hash][extname]",
        },
      },
    },
  };
});

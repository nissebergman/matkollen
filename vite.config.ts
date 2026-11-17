import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const configuredBasePath = process.env.VITE_BASE_PATH ?? "/";
const base = configuredBasePath.endsWith("/")
  ? configuredBasePath
  : `${configuredBasePath}/`;

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    restoreMocks: true,
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: fileURLToPath(new URL("./vitest.setup.ts", import.meta.url)),
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

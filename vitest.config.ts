import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts", "src/**/__tests__/**/*.ts"],
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
  },
});

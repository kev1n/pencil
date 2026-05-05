import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: [
      "src/**/*.spec.ts",
      "src/**/__tests__/**/*.ts",
      "eslint-rules/**/*.spec.ts"
    ],
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
  },
});

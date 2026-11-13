// Tests for the app's own modules. Run from the repo root, which has vitest:
//   npx vitest run --config mobile/vitest.config.ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias: { "@ext": fileURLToPath(new URL("../src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.spec.ts"] }
});

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// The app runs the extension's own modules from ../src. `@ext` points there.
const ext = fileURLToPath(new URL("../src", import.meta.url));

// Development only: PENCIL_CTEC_BYPASS=1 turns the CTEC access check off in
// the bundle, for accounts that have not filled out their own CTECs. Never
// set it for a build that ships.
function ctecBypass(): Plugin {
  return {
    name: "pencil-ctec-bypass",
    async load(id) {
      if (!/ctec-index\/access-shared\.ts$/.test(id)) return null;
      const source = await readFile(id, "utf8");
      return source.replace("CTEC_ACCESS_CHECK_ENABLED = true", "CTEC_ACCESS_CHECK_ENABLED = false");
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), ...(process.env.PENCIL_CTEC_BYPASS === "1" ? [ctecBypass()] : [])],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0") },
  resolve: { alias: { "@ext": ext } },
  server: { fs: { allow: [".."] } },
  build: { outDir: "dist", target: "es2022", chunkSizeWarningLimit: 2000 }
});

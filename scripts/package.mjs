import { execFile } from "node:child_process";
import { readFile, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

const args = process.argv.slice(2);
const target = getArgValue(args, "--target") ?? "chrome";
if (target !== "chrome" && target !== "firefox") {
  throw new Error(`Unsupported target "${target}". Use chrome or firefox.`);
}

const root = resolve(process.cwd());
const sourceDir = resolve(root, "dist", target);

const manifest = JSON.parse(
  await readFile(resolve(sourceDir, "manifest.json"), "utf8")
);
const version = manifest.version ?? "0.0.0";
const zipName = `better-caesar-${target}-${version}.zip`;
const zipPath = resolve(root, "dist", zipName);

const sourceStat = await stat(sourceDir).catch(() => null);
if (!sourceStat?.isDirectory()) {
  throw new Error(`Build output not found at ${sourceDir}. Run npm run build:${target} first.`);
}

await rm(zipPath, { force: true });

// `zip -r ../<name> .` from inside the build dir so the manifest sits at
// the root of the archive — Chrome Web Store rejects zips that contain a
// wrapping folder.
await exec("zip", ["-r", zipPath, "."], { cwd: sourceDir });

console.log(`Packaged ${target} v${version} → dist/${zipName}`);

function getArgValue(allArgs, key) {
  const index = allArgs.indexOf(key);
  if (index === -1 || index + 1 >= allArgs.length) return null;
  return allArgs[index + 1];
}

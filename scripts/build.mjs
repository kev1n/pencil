import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const watch = args.includes("--watch");
const targetArg = getArgValue(args, "--target") ?? "all";
const targets = targetArg === "all" ? ["chrome", "firefox"] : [targetArg];
const allowedTargets = new Set(["chrome", "firefox"]);

for (const target of targets) {
  if (!allowedTargets.has(target)) {
    throw new Error(`Unsupported target "${target}". Use chrome, firefox, or all.`);
  }
}

const root = resolve(process.cwd());
const manifestBasePath = resolve(root, "src/manifest.base.json");

const env = await loadDotenv(resolve(root, ".env"));
const DEFAULT_SCHEDULE_URL = "https://better-caesar.example.com/bucket-schedule.json";
const scheduleUrl = process.env.BC_BUCKET_SCHEDULE_URL ?? env.BC_BUCKET_SCHEDULE_URL ?? DEFAULT_SCHEDULE_URL;
const scheduleHostPermission = toHostPermission(scheduleUrl);
console.log(`Schedule URL: ${scheduleUrl}`);
const staticAssets = [
  { from: "src/popup/popup.html", to: "popup/popup.html" },
  { from: "src/popup/popup.css", to: "popup/popup.css" },
  { from: "src/assets/fonts", to: "assets/fonts" },
  { from: "src/assets/icons", to: "assets/icons" }
];

const entryPoints = {
  background: "src/background.ts",
  "content/index": "src/content/index.ts",
  "popup/popup": "src/popup/popup.ts"
};

async function readManifestBase() {
  const raw = await readFile(manifestBasePath, "utf8");
  return JSON.parse(raw);
}

function buildManifestForTarget(baseManifest, target) {
  const manifest = structuredClone(baseManifest);

  if (scheduleHostPermission && !manifest.host_permissions.includes(scheduleHostPermission)) {
    manifest.host_permissions.push(scheduleHostPermission);
  }

  if (target === "chrome") {
    manifest.background = {
      service_worker: "background.js"
    };
    delete manifest.browser_specific_settings;
    return manifest;
  }

  manifest.background = {
    scripts: ["background.js"]
  };
  manifest.browser_specific_settings = {
    gecko: {
      id: "pencil@local.dev",
      strict_min_version: "128.0",
      // AMO data-collection disclosure (required as of 2025). The
      // extension stores everything locally via chrome.storage.local and
      // makes no requests to any extension-operator-controlled endpoint
      // — every remote fetch is either the user's own CAESAR / Bluera /
      // NU-SSO session (the user is already there) or a public paper.nu
      // CDN that returns the same data to everyone. Nothing about the
      // user is uploaded anywhere, so the correct disclosure is "none".
      data_collection_permissions: {
        required: ["none"]
      }
    }
  };

  return manifest;
}

function bundleConfigForTarget(target) {
  const outdir = resolve(root, "dist", target);

  return {
    entryPoints,
    outdir,
    bundle: true,
    format: "iife",
    target: target === "chrome" ? "chrome120" : "firefox128",
    sourcemap: true,
    entryNames: "[dir]/[name]",
    logLevel: "info",
    define: {
      __BC_BUCKET_SCHEDULE_URL__: JSON.stringify(scheduleUrl)
    }
  };
}

async function copyStaticFiles(outdir) {
  await mkdir(resolve(outdir, "popup"), { recursive: true });
  for (const asset of staticAssets) {
    await cp(resolve(root, asset.from), resolve(outdir, asset.to), { recursive: true });
  }
}

async function writeManifest(outdir, manifest) {
  await writeFile(
    resolve(outdir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

if (watch) {
  if (targets.length !== 1) {
    throw new Error("Watch mode supports a single target. Use --target chrome or --target firefox.");
  }

  const target = targets[0];
  const outdir = resolve(root, "dist", target);
  const manifest = buildManifestForTarget(await readManifestBase(), target);
  const config = bundleConfigForTarget(target);
  const ctx = await context(config);

  await rm(outdir, { recursive: true, force: true });
  await copyStaticFiles(outdir);
  await writeManifest(outdir, manifest);
  await ctx.watch();
  console.log(`Watching extension files for ${target}...`);
} else {
  const manifestBase = await readManifestBase();

  for (const target of targets) {
    const outdir = resolve(root, "dist", target);
    const manifest = buildManifestForTarget(manifestBase, target);
    const config = bundleConfigForTarget(target);

    await rm(outdir, { recursive: true, force: true });
    await build(config);
    await copyStaticFiles(outdir);
    await writeManifest(outdir, manifest);
    await assertFixtureNotBundled(outdir, target);
  }
}

// Guard against accidentally bundling the prereqs golden-file fixture
// (~900 KB) into the shipped extension. The fixture lives under
// src/content/prereqs/__fixtures__/ and is only loaded by *.spec.ts;
// esbuild won't pull it into dist/ unless something inside src/ imports
// it. We assert by grepping for an id that appears nowhere else in the
// codebase ("AF_AM_ST 319-0", the first fixture entry).
async function assertFixtureNotBundled(outdir, target) {
  const sentinel = "AF_AM_ST 319-0";
  const bundle = resolve(outdir, "content/index.js");
  const text = await readFile(bundle, "utf8");
  if (text.includes(sentinel)) {
    throw new Error(
      `Build leak: prereqs fixture appears to be bundled in ${target}/content/index.js (found sentinel "${sentinel}"). Check that __fixtures__/prereqs-parsed.json is only imported from spec files.`
    );
  }
}

function getArgValue(allArgs, key) {
  const index = allArgs.indexOf(key);
  if (index === -1 || index + 1 >= allArgs.length) return null;
  return allArgs[index + 1];
}

async function loadDotenv(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
  const out = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function toHostPermission(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

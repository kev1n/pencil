// Pencil for Windows and Linux: a window around the same web bundle as the
// phone and Mac apps (mobile/dist). It does what mobile/mac/PencilMac.swift
// and NUSessionCore.swift do there: serves the bundle from inside the app,
// shows Northwestern's own sign-in pages, and makes the app's requests with
// the session those pages leave. Nothing is sent anywhere but Northwestern.
const { app, BrowserWindow, ipcMain, nativeTheme, net, protocol, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { autoUpdater } = require("electron-updater");

const SCHEME = "pencil";
const LINK_SCHEME = "pencilnu";
const bundle = app.isPackaged ? path.join(process.resourcesPath, "dist") : path.join(__dirname, "..", "dist");

// Development aids, as on the Mac: `--route=/you`, `--link=<url>`,
// `--shot=<png> --after=<seconds>` saves a picture of the window and quits.
const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? "";
const linkIn = (argv) => argv.find((a) => a.startsWith(`${LINK_SCHEME}://`)) ?? "";

// A development run keeps its data apart from an installed copy (and, on a
// Mac, from the Mac app, which uses the same folder name).
if (!app.isPackaged) app.setPath("userData", path.join(app.getPath("appData"), "Pencil-desktop-dev"));

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

let win = null;
let launchLink = flag("link") || linkIn(process.argv);

// Northwestern's cookies live in their own store, shared by the sign-in
// window and the app's requests, and apart from the app's own saved data.
const nu = () => session.fromPartition("persist:northwestern");
// CAESAR's parsers know the desktop layout; say we are a plain desktop Chrome.
const desktopAgent = () => app.userAgentFallback.replace(/\s(Electron|Pencil|pencil-desktop)\/\S+/g, "");

// Chromium forgets cookies that have no end date when the app quits. CAESAR's
// are like that, so they are kept in a file and put back at launch.
const cookieFile = () => path.join(app.getPath("userData"), "session.json");
const cookieUrl = (c) => `http${c.secure ? "s" : ""}://${c.domain.replace(/^\./, "")}${c.path}`;

async function saveCookies() {
  const cookies = await nu().cookies.get({});
  await fs.promises.writeFile(cookieFile(), JSON.stringify(cookies), { mode: 0o600 });
}

async function loadCookies() {
  let saved = [];
  try {
    saved = JSON.parse(await fs.promises.readFile(cookieFile(), "utf8"));
  } catch {
    return;
  }
  for (const c of saved) {
    await nu().cookies
      .set({
        url: cookieUrl(c),
        name: c.name,
        value: c.value,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        expirationDate: c.expirationDate,
        ...(c.hostOnly ? {} : { domain: c.domain })
      })
      .catch(() => undefined);
  }
}

async function dropCookies(keep) {
  for (const c of await nu().cookies.get({})) {
    if (!keep(c)) await nu().cookies.remove(cookieUrl(c), c.name);
  }
  await saveCookies();
}

// Shows a Northwestern sign-in page. It closes itself when the address
// matches `doneUrlPattern`; closing it by hand counts as not finished.
function signIn(options) {
  return new Promise((resolve) => {
    const pattern = options.doneUrlPattern ? new RegExp(options.doneUrlPattern) : null;
    const sheet = new BrowserWindow({
      parent: win,
      modal: true,
      width: 560,
      height: 720,
      title: options.title ?? "Northwestern sign-in",
      autoHideMenuBar: true,
      webPreferences: { session: nu() }
    });
    let completed = false;
    let last = options.url;
    sheet.webContents.on("did-finish-load", () => {
      last = sheet.webContents.getURL();
      if (pattern?.test(last)) {
        completed = true;
        sheet.close();
      }
    });
    sheet.on("closed", async () => {
      // Start CAESAR's page session over, keeping the sign-in itself.
      if (completed && options.resetPeopleSoft) {
        await dropCookies((c) => c.domain !== ".northwestern.edu" || c.name === "PS_DEVICEFEATURES");
      }
      await saveCookies();
      resolve({ completed, finalUrl: last });
    });
    void sheet.loadURL(options.url);
  });
}

async function request(options) {
  try {
    const response = await nu().fetch(options.url, {
      method: options.method ?? "GET",
      headers: options.headers ?? {},
      body: options.body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000)
    });
    const data = Buffer.from(await response.arrayBuffer());
    void saveCookies();
    return {
      ok: true,
      status: response.status,
      finalUrl: response.url || options.url,
      contentType: response.headers.get("content-type") ?? "",
      ...(options.binary ? { base64: data.toString("base64") } : { text: data.toString("utf8") })
    };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error), connectionFailed: true };
  }
}

const methods = {
  signIn,
  request,
  async status() {
    const cookies = await nu().cookies.get({ name: "mod_auth_openidc_session" });
    return { hasCaesarSession: cookies.some((c) => c.domain.endsWith("caesar.ent.northwestern.edu")) };
  },
  async signOut() {
    await dropCookies(() => false);
    return {};
  },
  async forgetSite({ host }) {
    if (host) await dropCookies((c) => !c.domain.endsWith(host));
    return {};
  },
  appearance({ mode }) {
    nativeTheme.themeSource = mode === "dark" || mode === "light" ? mode : "system";
    return {};
  },
  launchLink() {
    const url = launchLink;
    launchLink = "";
    return { url };
  },
  debugRoute: () => ({ route: flag("route") })
};

// Keeps the Windows app current. The installer's update files are read from
// pencil.nu/download/windows, which forwards to one release; pointing it at a
// new release is what rolls an update out. A newer version is downloaded
// quietly and installed when the app quits.
function keepCurrent() {
  if (!app.isPackaged || process.platform !== "win32" || flag("shot")) return;
  // Development aids: `PENCIL_UPDATE_URL` reads the update files from
  // somewhere else, and `PENCIL_UPDATE=now` installs without waiting.
  if (process.env.PENCIL_UPDATE_URL) autoUpdater.setFeedURL({ provider: "generic", url: process.env.PENCIL_UPDATE_URL });
  if (process.env.PENCIL_UPDATE === "now") autoUpdater.on("update-downloaded", () => autoUpdater.quitAndInstall(true, false));
  autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
}

function send(name, detail = "") {
  void win?.webContents.executeJavaScript(
    `window.dispatchEvent(new CustomEvent('pencil:${name}', { detail: ${JSON.stringify(detail)} }))`
  );
}

function openWindow() {
  win = new BrowserWindow({
    width: Number(flag("width")) || 1280,
    height: Number(flag("height")) || 860,
    minWidth: 380,
    minHeight: 560,
    show: !flag("shot"),
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1c1b1a" : "#faf8f3",
    webPreferences: { preload: path.join(__dirname, "preload.js") }
  });
  // Links to other sites open in the browser, never inside the app's window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith(`${SCHEME}://`)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
  void win.loadURL(`${SCHEME}://app/index.html`);

  const shot = flag("shot");
  if (shot) {
    const errors = [];
    win.webContents.on("console-message", (_e, level, message) => level >= 3 && errors.push(message));
    setTimeout(async () => {
      fs.writeFileSync(shot, (await win.webContents.capturePage()).toPNG());
      if (errors.length) console.error("page errors:", JSON.stringify(errors));
      app.quit();
    }, (Number(flag("after")) || 6) * 1000);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAsDefaultProtocolClient(LINK_SCHEME);
  // A plan link opened while the app is running arrives here.
  app.on("second-instance", (_event, argv) => {
    const url = linkIn(argv);
    if (win?.isMinimized()) win.restore();
    win?.focus();
    if (url) send("link", url);
  });

  app.whenReady().then(async () => {
    nu().setUserAgent(desktopAgent());
    await loadCookies();
    protocol.handle(SCHEME, (req) => {
      const { pathname } = new URL(req.url);
      const file = path.normalize(path.join(bundle, pathname === "/" ? "index.html" : decodeURIComponent(pathname)));
      if (!file.startsWith(bundle)) return new Response("", { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    });
    ipcMain.handle("pencil", (_event, { method, options }) => {
      const run = methods[method];
      if (!run) throw new Error(`Unknown method ${method}`);
      return run(options ?? {});
    });
    openWindow();
    keepCurrent();
  });

  app.on("window-all-closed", () => app.quit());
}

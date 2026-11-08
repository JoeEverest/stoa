/**
 * Stoa desktop shell. It runs the same server as `npm start` in an Electron utilityProcess on a
 * private 127.0.0.1 port, and shows the app in a window. Everything else (agents, lessons, the
 * lesson bridge) works as in the browser version, because the window loads the same origin.
 *
 * What the shell adds:
 * - app folders: data and video tools under the OS app-data folder (userData)
 * - the shell's PATH from a login shell (apps started from the Dock or a menu do not get it)
 * - a per-launch token cookie, so only this window can use the local server
 * - Claude access: an API key, a custom endpoint token or a Bedrock key, stored encrypted with safeStorage
 * - whisper-cli from the app's resources (built in CI, see scripts/build-whisper.sh)
 * - updates from GitHub Releases (desktop/updater.ts)
 *
 * Dev: `npm run desktop:dev` loads the Vite dev server (STOA_DEV_URL) and runs the server on the
 * fixed port Vite proxies to, without the token.
 */
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, safeStorage, session, shell, utilityProcess, type UtilityProcess } from "electron";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createUpdater } from "./updater.ts";

const DEV_URL = process.env.STOA_DEV_URL;
// A separate profile (data, video tools, key) for testing: STOA_USER_DATA=/some/folder.
if (process.env.STOA_USER_DATA) app.setPath("userData", path.resolve(process.env.STOA_USER_DATA));
const APP_ROOT = app.getAppPath();
const USER_DATA = app.getPath("userData");
const LOG_DIR = path.join(USER_DATA, "logs");
const KEY_FILE = path.join(USER_DATA, "anthropic-key.bin");

let server: UtilityProcess | null = null;
let serverUrl = "";
let token = "";
let win: BrowserWindow | null = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.focus();
});

// ---- Environment ----

/** PATH as the user's login shell sets it (Homebrew, nvm, ~/.local/bin ...). */
function loginShellPath() {
  const fallback = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  const merge = (...lists: (string | undefined)[]) =>
    [...new Set(lists.flatMap((l) => (l ?? "").split(path.delimiter)).filter(Boolean))].join(path.delimiter);
  const sh = process.env.SHELL || (process.platform === "darwin" ? "/bin/zsh" : "/bin/bash");
  try {
    const mark = "__STOA_PATH__";
    const out = execFileSync(sh, ["-ilc", `printf '${mark}%s${mark}' "$PATH"`], {
      encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, DISABLE_AUTO_UPDATE: "true", ZSH_DISABLE_COMPFIX: "true" },
    });
    const found = out.split(mark)[1];
    if (found) return merge(found, process.env.PATH, fallback.join(path.delimiter));
  } catch { /* use the fallback */ }
  return merge(process.env.PATH, fallback.join(path.delimiter));
}

function whisperPath(pathEnv: string) {
  const plat = `${process.platform}-${process.arch}`;
  if (app.isPackaged) return path.join(process.resourcesPath, "whisper", "whisper-cli");
  const vendored = path.join(APP_ROOT, "vendor", "whisper", plat, "whisper-cli");
  if (fs.existsSync(vendored)) return vendored;
  // Dev without a local build: a whisper-cli on PATH (for example from Homebrew).
  for (const d of pathEnv.split(path.delimiter)) {
    const p = path.join(d, "whisper-cli");
    if (fs.existsSync(p)) return p;
  }
  return vendored;
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

// ---- Secrets: the Anthropic API key, a custom endpoint's token, a Bedrock API key ----

type SecretName = "anthropic" | "custom" | "bedrock";
const SECRET_NAMES: SecretName[] = ["anthropic", "custom", "bedrock"];
const SECRET_FILES: Record<SecretName, string> = {
  anthropic: KEY_FILE,
  custom: path.join(USER_DATA, "custom-token.bin"),
  bedrock: path.join(USER_DATA, "bedrock-token.bin"),
};
/** How each secret reaches the server at start (server/settings.ts takes it out of the environment). */
const SECRET_ENV: Record<SecretName, string> = {
  anthropic: "ANTHROPIC_API_KEY", custom: "STOA_CUSTOM_TOKEN", bedrock: "STOA_BEDROCK_TOKEN",
};

function readSecret(name: SecretName): string | null {
  try {
    const buf = fs.readFileSync(SECRET_FILES[name]);
    return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString("utf8");
  } catch { return null; }
}

function writeSecret(name: SecretName, value: string | null) {
  if (!value) return fs.rmSync(SECRET_FILES[name], { force: true });
  // Without an OS keychain (some Linux desktops) the secret is kept readable only by this user.
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value) : Buffer.from(value, "utf8");
  fs.writeFileSync(SECRET_FILES[name], data, { mode: 0o600 });
}

async function validateApiKey(key: string) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (res.ok) return null;
    if (res.status === 401 || res.status === 403) return "Anthropic did not accept this API key.";
    return `Anthropic answered with an error (${res.status}). Try again in a moment.`;
  } catch {
    return "Stoa could not reach Anthropic. Check your internet connection.";
  }
}

// ---- Server ----

async function startServer() {
  const port = DEV_URL ? Number(process.env.PORT ?? 3210) : await freePort();
  token = DEV_URL ? "" : randomBytes(32).toString("hex");
  const pathEnv = loginShellPath();
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: pathEnv,
    NODE_ENV: app.isPackaged ? "production" : "development",
    HOST: "127.0.0.1",
    PORT: String(port),
    DATA_DIR: path.join(USER_DATA, "data"),
    STOA_DESKTOP: "1",
    STOA_RUNTIMES_DIR: path.join(USER_DATA, "runtimes"),
    STOA_WHISPER_PATH: whisperPath(pathEnv),
  };
  delete env.ELECTRON_RUN_AS_NODE;
  // Only the connection the learner set up in Stoa is used, not one from the shell that started it.
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_USE_BEDROCK", "ANTHROPIC_BEDROCK_BASE_URL", "AWS_BEARER_TOKEN_BEDROCK"]) delete env[k];
  if (token) env.STOA_TOKEN = token;
  for (const name of SECRET_NAMES) {
    const value = readSecret(name);
    if (value) env[SECRET_ENV[name]] = value;
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const log = fs.createWriteStream(path.join(LOG_DIR, "server.log"), { flags: "a" });
  log.write(`\n---- ${new Date().toISOString()} Stoa ${app.getVersion()} ----\n`);

  const child = utilityProcess.fork(path.join(APP_ROOT, "server", "index.ts"), [], {
    env, stdio: "pipe", serviceName: "Stoa server", cwd: APP_ROOT,
  });
  server = child;
  for (const s of [child.stdout, child.stderr]) {
    s?.on("data", (d) => { log.write(d); if (!app.isPackaged) process.stdout.write(d); });
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The Stoa server did not start in 30 seconds.")), 30_000);
    child.on("message", (m) => {
      if (m?.type === "listening") { clearTimeout(timer); resolve(); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`The Stoa server stopped while starting (exit ${code}).`)); });
  });
  serverUrl = `http://127.0.0.1:${port}`;

  child.once("exit", async (code) => {
    server = null;
    if (quitting) return;
    const { response } = await dialog.showMessageBox({
      type: "error", buttons: ["Restart Stoa", "Quit"], defaultId: 0,
      message: "Stoa stopped unexpectedly.",
      detail: `The server exited with code ${code}. The log is in ${LOG_DIR}.`,
    });
    if (response === 0) { app.relaunch(); }
    quitting = true;
    app.quit();
  });
}

/** Ask the server to stop its agents, then end it. */
function stopServer() {
  const child = server;
  if (!child) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => { child.kill(); resolve(); }, 8000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.postMessage({ type: "shutdown" });
  });
}

function sendToServer(message: unknown, reply: string) {
  return new Promise<void>((resolve) => {
    if (!server) return resolve();
    const child = server;
    const on = (m: any) => { if (m?.type === reply) { child.off("message", on); resolve(); } };
    child.on("message", on);
    child.postMessage(message);
    setTimeout(resolve, 15_000);
  });
}

// ---- Window ----

async function createWindow() {
  const url = DEV_URL ?? serverUrl;
  if (token) {
    await session.defaultSession.cookies.set({
      url: serverUrl, name: "stoa_token", value: token, httpOnly: true, sameSite: "strict",
    });
  }
  const mac = process.platform === "darwin";
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 900, minHeight: 600, show: false,
    title: "Stoa",
    // Same colors as the app's sidebar, so nothing flashes while the page loads.
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#161f23" : "#f6f7f8",
    // macOS: no title bar. The traffic lights sit in the sidebar's top row; the web app leaves room
    // for them and marks its own drag regions (web/src/styles.css, "Desktop app").
    ...(mac ? { titleBarStyle: "hiddenInset" as const, trafficLightPosition: { x: 16, y: 16 } } : {}),
    // Linux shows the icon in the window list; macOS takes it from the app bundle.
    ...(!mac ? { icon: path.join(APP_ROOT, "build", "icon.png") } : {}),
    webPreferences: {
      preload: path.join(APP_ROOT, "desktop", "preload.cjs"),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      plugins: true, // Chromium's PDF viewer, for the learner's own PDFs in the lesson frame
    },
  });
  const origin = new URL(url).origin;
  // Links that leave the app open in the system browser.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/.test(target) && new URL(target).origin !== origin) shell.openExternal(target);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, target) => {
    if (new URL(target).origin === origin) return;
    e.preventDefault();
    if (/^https?:/.test(target)) shell.openExternal(target);
  });
  // An app window does not pinch-zoom like a web page.
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.once("ready-to-show", () => win?.show());
  win.on("closed", () => { win = null; });
  await win.loadURL(url);
}

// ---- IPC from the setup screen (desktop/preload.cjs) ----

const isSecretName = (v: unknown): v is SecretName => SECRET_NAMES.includes(v as SecretName);

ipcMain.handle("stoa:set-secret", async (_e, name: unknown, raw: unknown) => {
  if (!isSecretName(name)) return { ok: false, error: "Unknown setting." };
  const value = typeof raw === "string" ? raw.trim() : "";
  if (name === "anthropic") {
    if (!/^sk-ant-[\w-]{20,}$/.test(value)) return { ok: false, error: "This does not look like an Anthropic API key (it starts with sk-ant-)." };
    const error = await validateApiKey(value);
    if (error) return { ok: false, error };
  } else if (!value || value.length > 8192 || /\s/.test(value)) {
    return { ok: false, error: "Paste the key or token on its own, with no spaces or line breaks." };
  }
  writeSecret(name, value);
  await sendToServer({ type: "secret", name, value }, "secret-applied");
  return { ok: true };
});

ipcMain.handle("stoa:clear-secret", async (_e, name: unknown) => {
  if (!isSecretName(name)) return { ok: false };
  writeSecret(name, null);
  await sendToServer({ type: "secret", name, value: null }, "secret-applied");
  return { ok: true };
});

/** Which secrets are stored, and the last four characters of each, so Settings can show which one. Never the secret. */
ipcMain.handle("stoa:secret-info", () => {
  const out = {} as Record<SecretName, { set: boolean; last4: string | null }>;
  for (const name of SECRET_NAMES) {
    const v = readSecret(name);
    out[name] = { set: !!v, last4: v && v.length > 12 ? v.slice(-4) : null };
  }
  return out;
});

/** Open a terminal that runs `claude`, so the learner can type /login. */
ipcMain.handle("stoa:open-claude-login", async (_e, cliPath: unknown) => {
  const bin = typeof cliPath === "string" && path.isAbsolute(cliPath) && path.basename(cliPath) === "claude" && fs.existsSync(cliPath) ? cliPath : "claude";
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const script = path.join(app.getPath("temp"), "stoa-claude-login.command");
  fs.writeFileSync(script, `#!/bin/sh\necho "Type /login and follow the steps. Then go back to Stoa."\necho\nexec ${q(bin)}\n`, { mode: 0o755 });
  if (process.platform === "darwin") {
    const err = await shell.openPath(script); // .command files open in Terminal
    return err ? { ok: false, error: err } : { ok: true };
  }
  for (const [cmd, args] of [["x-terminal-emulator", ["-e", script]], ["gnome-terminal", ["--", script]], ["konsole", ["-e", script]], ["xterm", ["-e", script]]] as const) {
    try {
      const child = spawn(cmd, [...args], { detached: true, stdio: "ignore" });
      const ok = await new Promise<boolean>((r) => { child.once("error", () => r(false)); child.once("spawn", () => r(true)); });
      if (ok) { child.unref(); return { ok: true }; }
    } catch { /* try the next terminal */ }
  }
  return { ok: false, error: "Stoa could not open a terminal." };
});

ipcMain.handle("stoa:open-logs", () => shell.openPath(LOG_DIR));

// ---- Updates (desktop/updater.ts) ----

const updater = createUpdater({
  repo: process.env.STOA_UPDATE_REPO ?? "JoeEverest/stoa",
  userData: USER_DATA,
  getWindow: () => win,
  quit: () => app.quit(), // before-quit stops the server and its agents first
});
ipcMain.handle("stoa:update-status", () => updater.status());
ipcMain.handle("stoa:update-check", () => updater.check());
ipcMain.handle("stoa:update-download", () => updater.download());
ipcMain.handle("stoa:update-install", () => updater.install());
ipcMain.handle("stoa:update-auto", (_e, on: unknown) => updater.setAuto(on !== false));
ipcMain.handle("stoa:update-release-page", () => updater.openReleasePage());

// ---- Lifecycle ----

app.whenReady().then(async () => {
  // Running from source has no app bundle, so give the Dock the app icon.
  if (!app.isPackaged && process.platform === "darwin") app.dock?.setIcon(path.join(APP_ROOT, "build", "icon.png"));
  try {
    await startServer();
    await createWindow();
    updater.start();
  } catch (err) {
    dialog.showErrorBox("Stoa could not start", `${err instanceof Error ? err.message : err}\n\nThe log is in ${LOG_DIR}.`);
    quitting = true;
    await stopServer();
    app.quit();
  }
});

// Lessons and videos take many minutes to build. On macOS, closing the window keeps Stoa (and
// Athena's work) running in the Dock, as macOS apps do; elsewhere closing the window quits.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (!win && serverUrl) createWindow();
});

app.on("before-quit", (e) => {
  if (quitting || !server) return;
  e.preventDefault();
  quitting = true;
  stopServer().finally(() => app.quit());
});

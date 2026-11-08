/**
 * In-app updates from GitHub Releases.
 *
 * Stoa's macOS builds are not signed with an Apple Developer ID, and Squirrel.Mac (what
 * electron-updater uses on macOS) refuses to install an update into an app that is not. So Stoa
 * updates itself the plain way:
 *
 *   1. Ask the GitHub API for the latest published release (drafts and prereleases are skipped).
 *   2. Pick this computer's package: macOS  Stoa-<v>-<arch>-mac.zip
 *                                     Linux  Stoa-<v>-<arch>.AppImage, or the .deb for a .deb install
 *   3. Download it and check it against the SHA-256 digest GitHub records for every release asset.
 *   4. Install on restart:
 *        macOS     unzip next to the app with ditto, then a small script waits for Stoa to quit,
 *                  swaps the .app bundle and opens the new one
 *        AppImage  the same, swapping the AppImage file
 *        .deb      open the package in the system's software installer (it needs an admin password)
 *
 * Nothing runs that the digest did not vouch for: a file whose digest does not match is deleted.
 */
import { app, shell, type BrowserWindow } from "electron";
import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type UpdateKind = "mac" | "appimage" | "deb";
export type UpdateStatus = {
  current: string;
  /** How this copy of Stoa installs updates; null when it cannot (running from source, for example). */
  kind: UpdateKind | null;
  /** Why updates cannot install here, in words for the learner. */
  blocked: string | null;
  state: "idle" | "checking" | "none" | "available" | "downloading" | "ready" | "error";
  latest: { version: string; notes: string; url: string; publishedAt: string; size: number } | null;
  progress: { bytes: number; total: number } | null;
  error: string | null;
  checkedAt: string | null;
  auto: boolean;
};

type Asset = { name: string; size: number; digest: string | null; url: string };
type Release = { version: string; notes: string; url: string; publishedAt: string; asset: Asset | null };

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_MS = 15_000;
const ARCH_NAMES: Record<string, string[]> = { x64: ["x64", "x86_64", "amd64"], arm64: ["arm64", "aarch64"] };

export function createUpdater(opts: { repo: string; userData: string; getWindow: () => BrowserWindow | null; quit: () => void }) {
  const DIR = path.join(opts.userData, "updates");
  const PREFS = path.join(opts.userData, "update-prefs.json");
  // Running from source, STOA_FAKE_VERSION pretends to be an older Stoa, to try the flow end to end.
  const current = (!app.isPackaged && process.env.STOA_FAKE_VERSION) || app.getVersion();

  const readAuto = () => { try { return JSON.parse(fs.readFileSync(PREFS, "utf8")).auto !== false; } catch { return true; } };
  const { kind, blocked, target } = detect();

  const status: UpdateStatus = {
    current, kind, blocked, state: "idle", latest: null, progress: null, error: null, checkedAt: null, auto: readAuto(),
  };
  let release: Release | null = null;
  let staged: string | null = null; // the verified download (macOS: the unpacked .app)
  let busy: Promise<unknown> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function emit(patch: Partial<UpdateStatus>) {
    Object.assign(status, patch);
    const win = opts.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("stoa:update-status", status);
  }

  /** Where this copy of Stoa lives, and whether Stoa may replace it. */
  function detect(): { kind: UpdateKind | null; blocked: string | null; target: string | null } {
    // Running from source, STOA_UPDATE_TARGET points the updater at a scratch copy of Stoa.app to test installs.
    if (!app.isPackaged && process.platform === "darwin" && process.env.STOA_UPDATE_TARGET) {
      return { kind: "mac", blocked: null, target: path.resolve(process.env.STOA_UPDATE_TARGET) };
    }
    if (!app.isPackaged) return { kind: null, blocked: "Updates install only in a packaged copy of Stoa.", target: null };
    if (process.platform === "darwin") {
      const bundle = path.resolve(process.execPath, "..", "..", "..");
      if (!bundle.endsWith(".app")) return { kind: null, blocked: "Stoa could not find its app bundle.", target: null };
      if (bundle.includes("/AppTranslocation/") || bundle.startsWith("/Volumes/")) {
        return { kind: "mac", blocked: "Move Stoa to your Applications folder, then open it from there to get updates.", target: bundle };
      }
      if (!writable(path.dirname(bundle)) || !writable(bundle)) {
        return { kind: "mac", blocked: `Stoa cannot replace itself in ${path.dirname(bundle)}. Download updates from the release page instead.`, target: bundle };
      }
      return { kind: "mac", blocked: null, target: bundle };
    }
    if (process.platform === "linux") {
      const image = process.env.APPIMAGE;
      if (image) {
        if (!writable(path.dirname(image))) return { kind: "appimage", blocked: `Stoa cannot write to ${path.dirname(image)}.`, target: image };
        return { kind: "appimage", blocked: null, target: image };
      }
      return { kind: "deb", blocked: null, target: null };
    }
    return { kind: null, blocked: "Updates are not available on this system.", target: null };
  }

  async function fetchLatest(): Promise<Release> {
    const res = await fetch(`https://api.github.com/repos/${opts.repo}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": `Stoa/${current}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404) throw new Error("No published release yet.");
    if (res.status === 403 || res.status === 429) throw new Error("GitHub is limiting update checks from this network. Stoa will try again later.");
    if (!res.ok) throw new Error(`GitHub answered with an error (${res.status}).`);
    const r: any = await res.json();
    const version = String(r.tag_name ?? "").replace(/^v/, "");
    const assets: Asset[] = (r.assets ?? []).map((a: any) => ({
      name: a.name, size: a.size, url: a.browser_download_url,
      digest: typeof a.digest === "string" && a.digest.startsWith("sha256:") ? a.digest.slice(7).toLowerCase() : null,
    }));
    return { version, notes: String(r.body ?? ""), url: r.html_url, publishedAt: r.published_at, asset: pickAsset(assets) };
  }

  function pickAsset(assets: Asset[]): Asset | null {
    const archs = ARCH_NAMES[process.arch] ?? [process.arch];
    const has = (name: string, suffix: string) => archs.some((a) => name.endsWith(`-${a}${suffix}`) || name.endsWith(`_${a}${suffix}`));
    const want = process.platform === "darwin" ? (n: string) => has(n, "-mac.zip")
      : kind === "appimage" ? (n: string) => has(n, ".AppImage")
      : (n: string) => has(n, ".deb");
    return assets.find((a) => want(a.name)) ?? null;
  }

  async function check() {
    if (busy) return status;
    emit({ state: "checking", error: null });
    busy = (async () => {
      try {
        const r = await fetchLatest();
        release = r;
        const latest = { version: r.version, notes: r.notes, url: r.url, publishedAt: r.publishedAt, size: r.asset?.size ?? 0 };
        const checkedAt = new Date().toISOString();
        if (compare(r.version, current) <= 0) return emit({ state: "none", latest, checkedAt });
        if (!r.asset) return emit({ state: "available", latest, checkedAt, error: `This release has no package for ${process.platform} ${process.arch}. Get it from the release page.` });
        // Already downloaded and checked earlier in this session?
        if (staged && status.latest?.version === r.version) return emit({ state: "ready", latest, checkedAt });
        emit({ state: "available", latest, checkedAt });
        if (status.auto && !blocked) void download();
      } catch (err) {
        emit({ state: "error", error: err instanceof Error ? err.message : String(err), checkedAt: new Date().toISOString() });
      } finally {
        busy = null;
      }
    })();
    await busy;
    return status;
  }

  async function download() {
    const r = release;
    if (!r?.asset || blocked || status.state === "downloading" || status.state === "ready") return status;
    const asset = r.asset;
    if (!asset.digest) {
      emit({ state: "error", error: "GitHub gave no checksum for this update, so Stoa will not install it. Get it from the release page." });
      return status;
    }
    emit({ state: "downloading", progress: { bytes: 0, total: asset.size }, error: null });
    try {
      fs.rmSync(DIR, { recursive: true, force: true });
      fs.mkdirSync(DIR, { recursive: true });
      const file = path.join(DIR, asset.name);
      const res = await fetch(asset.url, { headers: { "user-agent": `Stoa/${current}` }, redirect: "follow" });
      if (!res.ok || !res.body) throw new Error(`The download failed (HTTP ${res.status}).`);
      const hash = createHash("sha256");
      let bytes = 0, last = 0;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) {
          bytes += chunk.byteLength;
          hash.update(chunk);
          if (Date.now() - last > 250) { last = Date.now(); emit({ progress: { bytes, total: asset.size } }); }
          ctl.enqueue(chunk);
        },
      });
      await pipeline(Readable.fromWeb(res.body.pipeThrough(counter) as any), fs.createWriteStream(file));
      if (hash.digest("hex") !== asset.digest) {
        fs.rmSync(file, { force: true });
        throw new Error("The update did not match its checksum, so Stoa deleted it. Try again.");
      }
      staged = await prepare(file, r.version);
      emit({ state: "ready", progress: { bytes: asset.size, total: asset.size } });
    } catch (err) {
      staged = null;
      emit({ state: "error", progress: null, error: err instanceof Error ? err.message : String(err) });
    }
    return status;
  }

  /** Unpack and check the download. Returns what install() puts in place. */
  async function prepare(file: string, version: string) {
    if (kind === "mac") {
      const out = path.join(DIR, "unpacked");
      fs.mkdirSync(out, { recursive: true });
      await run("/usr/bin/ditto", ["-x", "-k", file, out]);
      const appDir = fs.readdirSync(out).find((n) => n.endsWith(".app"));
      if (!appDir) throw new Error("The update package has no app in it.");
      const bundle = path.join(out, appDir);
      const got = (await run("/usr/bin/plutil", ["-extract", "CFBundleShortVersionString", "raw", "-o", "-", path.join(bundle, "Contents", "Info.plist")])).trim();
      if (got !== version) throw new Error(`The update says it is version ${got}, not ${version}.`);
      fs.rmSync(file, { force: true });
      return bundle;
    }
    if (kind === "appimage") {
      fs.chmodSync(file, 0o755);
      return file;
    }
    return file; // .deb
  }

  /** Quit, put the new version in place, and start it. */
  async function install() {
    if (status.state !== "ready" || !staged) return { ok: false, error: "No update is ready." };
    if (kind === "deb") {
      const err = await shell.openPath(staged);
      return err ? { ok: false, error: `Stoa could not open the package (${err}). It is in ${staged}.` } : { ok: true };
    }
    if (!target || blocked) return { ok: false, error: blocked ?? "Stoa cannot update itself here." };
    const script = path.join(DIR, "install.sh");
    const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
    const old = `${target}.old-${Date.now()}`;
    const lines = [
      "#!/bin/sh",
      "# Written by Stoa (desktop/updater.ts): swap in the new version once Stoa has quit.",
      `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done`,
      `if mv ${q(target)} ${q(old)}; then`,
      `  if mv ${q(staged)} ${q(target)}; then rm -rf ${q(old)}; else mv ${q(old)} ${q(target)}; fi`,
      "fi",
      ...(kind === "mac"
        ? [`xattr -dr com.apple.quarantine ${q(target)} 2>/dev/null`, ...(app.isPackaged || !process.env.STOA_UPDATE_TARGET ? [`open ${q(target)}`] : [])]
        : [`chmod +x ${q(target)}`, `nohup ${q(target)} >/dev/null 2>&1 &`]),
    ];
    fs.writeFileSync(script, lines.join("\n") + "\n", { mode: 0o755 });
    spawn("/bin/sh", [script], { detached: true, stdio: "ignore" }).unref();
    opts.quit();
    return { ok: true };
  }

  function setAuto(on: boolean) {
    fs.writeFileSync(PREFS, JSON.stringify({ auto: on }));
    emit({ auto: on });
    if (on && status.state === "available" && !blocked) void download();
    return status;
  }

  function start() {
    setTimeout(() => void check(), FIRST_CHECK_MS);
    timer = setInterval(() => void check(), CHECK_EVERY_MS);
    timer.unref?.();
  }

  return {
    status: () => status,
    check: () => check(),
    download,
    install,
    setAuto,
    start,
    openReleasePage: () => shell.openExternal(status.latest?.url ?? `https://github.com/${opts.repo}/releases/latest`),
  };
}

/** Compare dotted versions numerically: 1.10.0 > 1.9.2. A prerelease suffix ranks below its release. */
export function compare(a: string, b: string) {
  const [pa, sa] = a.split("-", 2), [pb, sb] = b.split("-", 2);
  const na = pa.split(".").map(Number), nb = pb.split(".").map(Number);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const d = (na[i] || 0) - (nb[i] || 0);
    if (d) return Math.sign(d);
  }
  if (sa && !sb) return -1;
  if (!sa && sb) return 1;
  return 0;
}

function writable(p: string) {
  try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; }
}

function run(cmd: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(cmd)} failed: ${(stderr || err.message).trim().split("\n").pop()}`));
      else resolve(stdout);
    });
  });
}

/**
 * Video tools for the desktop app. Lesson videos need Python with the Kokoro voice, ffmpeg,
 * whisper.cpp and a headless Chrome. The desktop app installs them into its own folder during
 * setup, so the learner does not install anything by hand:
 *
 *   python, ffmpeg     downloaded from pinned release files and checked against SHA-256
 *   whisper-cli        shipped inside the app (built in CI, see scripts/build-whisper.sh)
 *   Chrome, models     fetched by HyperFrames itself (its own pinned versions), into our cache
 *
 * The teacher's runs then get an environment (`runtimeEnv`) that points HyperFrames and the
 * shell at these tools. Without STOA_RUNTIMES_DIR (the web and Docker setups) nothing here is
 * used and the system's own tools apply.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const RUNTIMES_DIR = process.env.STOA_RUNTIMES_DIR ? path.resolve(process.env.STOA_RUNTIMES_DIR) : null;
const PLATFORM = `${process.platform}-${process.arch}`;

type Asset = { url: string; sha256: string; size: number };

// python-build-standalone 20261026, CPython 3.12.16, "install_only_stripped". Unpacks to python/.
const PBS = "https://github.com/astral-sh/python-build-standalone/releases/download/20261026/cpython-3.12.16%2B20261026";
const PYTHON: Record<string, Asset> = {
  "darwin-arm64": { url: `${PBS}-aarch64-apple-darwin-install_only_stripped.tar.gz`, size: 25035343, sha256: "353d5f1b4fd2715e7053f12f068435d5bbad16b91e057006b5d01e0925709a7e" },
  "darwin-x64": { url: `${PBS}-x86_64-apple-darwin-install_only_stripped.tar.gz`, size: 24757272, sha256: "37c38fda76fec1fbf310adcbafb7f0d96af13b5511bf8ea954c3aa8eec185734" },
  "linux-arm64": { url: `${PBS}-aarch64-unknown-linux-gnu-install_only_stripped.tar.gz`, size: 29234064, sha256: "bb4b6392670c5d3f93876996fcaa19858a4a413a0c7720144c18b0d6f1f0db2d" },
  "linux-x64": { url: `${PBS}-x86_64-unknown-linux-gnu-install_only_stripped.tar.gz`, size: 34505639, sha256: "ce4f6d0a6cfdb3bed6e44c2f9affd85943c76a42e25ad3a259002f31d6fb8a20" },
};
const PIP_PACKAGES = ["kokoro-onnx==0.6.1", "soundfile==0.14.0"];

// Static ffmpeg builds from ffmpeg-static release b6.1.1 (ffmpeg 6.0; gzip of a single binary).
const FF = "https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1";
const FFMPEG: Record<string, { ffmpeg: Asset; ffprobe: Asset }> = {
  "darwin-arm64": {
    ffmpeg: { url: `${FF}/ffmpeg-darwin-arm64.gz`, size: 19246198, sha256: "8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa" },
    ffprobe: { url: `${FF}/ffprobe-darwin-arm64.gz`, size: 19207077, sha256: "d986a8ec7b030899fe66a8a288ed809a3543338705a3ce178cfb85869c5d80be" },
  },
  "darwin-x64": {
    ffmpeg: { url: `${FF}/ffmpeg-darwin-x64.gz`, size: 25296431, sha256: "929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106" },
    ffprobe: { url: `${FF}/ffprobe-darwin-x64.gz`, size: 25239438, sha256: "d4da574d6e2e197bd259b47d69cf262df9e312af24ad960444f6d806d3d4c186" },
  },
  "linux-arm64": {
    ffmpeg: { url: `${FF}/ffmpeg-linux-arm64.gz`, size: 25568691, sha256: "754a678672298bc68156adff58aa7385a592c2b30b1d0ae8750c45c915c4bac0" },
    ffprobe: { url: `${FF}/ffprobe-linux-arm64.gz`, size: 25493573, sha256: "2ab6aba60ee84412dff9188720703376cb4e7aaf7e0b5e43aa8249f2acae5bf8" },
  },
  "linux-x64": {
    ffmpeg: { url: `${FF}/ffmpeg-linux-x64.gz`, size: 29354986, sha256: "bfe8a8fc511530457b528c48d77b5737527b504a3797a9bc4866aeca69c2dffa" },
    ffprobe: { url: `${FF}/ffprobe-linux-x64.gz`, size: 29276839, sha256: "25d9b6ccb05e3d9de9e04e31e2506d8dd7f9f0418981965ac6df12e8d3afd067" },
  },
};

/** The whisper model HyperFrames uses by default (`hyperframes transcribe` without -m). */
const WHISPER_MODEL = "small.en";

// ---- Layout of RUNTIMES_DIR ----

const dir = (...p: string[]) => path.join(RUNTIMES_DIR!, ...p);
const paths = () => ({
  python: dir("python-3.12.16", "python", "bin", "python3"),
  ffmpeg: dir("ffmpeg-static-b6.1.1", "ffmpeg"),
  ffprobe: dir("ffmpeg-static-b6.1.1", "ffprobe"),
  bin: dir("bin"),
  cache: dir("hyperframes-cache"),
  downloads: dir("downloads"),
  state: dir("state.json"),
});
const whisperPath = () => process.env.STOA_WHISPER_PATH ?? "";

// ---- Steps ----

type StepId = "python" | "voice-packages" | "ffmpeg" | "browser" | "voice-model" | "whisper-model";
type StepStatus = "pending" | "running" | "done" | "error";
export type Step = { id: StepId; label: string; status: StepStatus; bytes: number; total: number | null; error: string | null };

const STEPS: { id: StepId; label: string; total: number | null; key: string }[] = [
  { id: "python", label: "Python runtime", total: PYTHON[PLATFORM]?.size ?? null, key: "python-3.12.16+20261026" },
  { id: "voice-packages", label: "Voice software", total: null, key: PIP_PACKAGES.join(" ") },
  { id: "ffmpeg", label: "Audio and video encoder", total: FFMPEG[PLATFORM] ? FFMPEG[PLATFORM].ffmpeg.size + FFMPEG[PLATFORM].ffprobe.size : null, key: "ffmpeg-static-b6.1.1" },
  { id: "browser", label: "Video renderer (Chrome)", total: 95_000_000, key: "hyperframes-browser" },
  { id: "voice-model", label: "Narrator voice", total: 337_000_000, key: "kokoro-v1.0" },
  { id: "whisper-model", label: "Speech timing model", total: 488_000_000, key: `whisper-${WHISPER_MODEL}` },
];

/** Persisted: which steps finished, keyed by version, plus the Chrome path HyperFrames found. */
type State = { done: Record<string, string>; browserPath?: string };
const readState = (): State => {
  try { return JSON.parse(fs.readFileSync(paths().state, "utf8")); } catch { return { done: {} }; }
};
const writeState = (s: State) => fs.writeFileSync(paths().state, JSON.stringify(s, null, 2));

let steps: Step[] = [];
let installing: Promise<void> | null = null;
let lastError: string | null = null;

function resetSteps() {
  const st = readState();
  steps = STEPS.map((s) => ({
    id: s.id, label: s.label, total: s.total, bytes: 0, error: null,
    status: st.done[s.id] === s.key ? "done" : "pending",
  }));
}

export function runtimeStatus() {
  if (!RUNTIMES_DIR) return { managed: false as const };
  if (!steps.length) resetSteps();
  const whisper = whisperPath();
  const whisperOk = !!whisper && fs.existsSync(whisper);
  const supported = !!PYTHON[PLATFORM] && !!FFMPEG[PLATFORM];
  return {
    managed: true as const,
    supported,
    platform: PLATFORM,
    whisper: whisperOk,
    ready: supported && whisperOk && steps.every((s) => s.status === "done"),
    installing: !!installing,
    error: lastError,
    steps,
  };
}

/** Start (or join) the install. Finished steps are skipped, so this also repairs a broken install. */
export function installRuntimes() {
  if (!RUNTIMES_DIR) return Promise.resolve();
  if (installing) return installing;
  resetSteps();
  lastError = null;
  installing = (async () => {
    try {
      if (!PYTHON[PLATFORM] || !FFMPEG[PLATFORM]) throw new Error(`Video tools are not available for ${PLATFORM} yet.`);
      if (!fs.existsSync(whisperPath())) throw new Error("whisper-cli is missing from this build of Stoa. Reinstall the app.");
      fs.mkdirSync(paths().downloads, { recursive: true });
      writeShims();
      for (const def of STEPS) {
        const step = steps.find((s) => s.id === def.id)!;
        if (step.status === "done") continue;
        step.status = "running";
        try {
          await RUN[def.id](step);
          const st = readState();
          st.done[def.id] = def.key;
          writeState(st);
          step.status = "done";
          if (step.total) step.bytes = step.total;
        } catch (err) {
          step.status = "error";
          step.error = err instanceof Error ? err.message : String(err);
          throw err;
        }
      }
      fs.rmSync(paths().downloads, { recursive: true, force: true });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error("[runtimes]", lastError);
    } finally {
      installing = null;
    }
  })();
  return installing;
}

const RUN: Record<StepId, (step: Step) => Promise<void>> = {
  async python(step) {
    const p = paths();
    const archive = await download(PYTHON[PLATFORM], path.join(p.downloads, "python.tar.gz"), step);
    const dest = path.dirname(path.dirname(path.dirname(p.python))); // .../python-3.12.16
    await replaceDir(dest, async (tmp) => run("tar", ["-xzf", archive, "-C", tmp]));
    await run(p.python, ["--version"]);
  },

  async "voice-packages"() {
    const p = paths();
    // Wheels only: no compiler on the learner's machine. Pinned top-level versions.
    await run(p.python, ["-m", "pip", "install", "--disable-pip-version-check", "--no-warn-script-location",
      "--only-binary=:all:", "--no-input", ...PIP_PACKAGES], { env: { PIP_NO_CACHE_DIR: "1", PYTHONNOUSERSITE: "1" } });
    await run(p.python, ["-c", "import kokoro_onnx, soundfile"]);
  },

  async ffmpeg(step) {
    const p = paths();
    const assets = FFMPEG[PLATFORM];
    const dest = path.dirname(p.ffmpeg);
    let base = 0;
    const files: [string, Asset][] = [["ffmpeg", assets.ffmpeg], ["ffprobe", assets.ffprobe]];
    const gz: string[] = [];
    for (const [name, asset] of files) {
      gz.push(await download(asset, path.join(p.downloads, `${name}.gz`), step, base));
      base += asset.size;
    }
    await replaceDir(dest, async (tmp) => {
      for (let i = 0; i < files.length; i++) {
        const out = path.join(tmp, files[i][0]);
        await pipeline(fs.createReadStream(gz[i]), zlib.createGunzip(), fs.createWriteStream(out, { mode: 0o755 }));
      }
    });
    await run(p.ffmpeg, ["-version"]);
  },

  async browser(step) {
    await watchSize(path.join(paths().cache, "chrome"), step, () => hyperframes(["browser", "ensure"]));
    const out = (await hyperframes(["browser", "path"])).trim().split("\n").pop()!.trim();
    if (!out || !fs.existsSync(out)) throw new Error("HyperFrames did not report a Chrome path.");
    const st = readState();
    st.browserPath = out;
    writeState(st);
  },

  async "voice-model"(step) {
    // The first `tts` downloads the Kokoro model and voices (HyperFrames checks them) and
    // proves the voice works end to end.
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "stoa-tts-"));
    try {
      await watchSize(path.join(paths().cache, "tts"), step, () =>
        hyperframes(["tts", "Stoa is ready to make lesson videos.", "-v", "af_heart", "-o", path.join(work, "check.wav")]));
      fs.copyFileSync(path.join(work, "check.wav"), path.join(RUNTIMES_DIR!, "voice-check.wav"));
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  },

  async "whisper-model"(step) {
    const sample = path.join(RUNTIMES_DIR!, "voice-check.wav");
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "stoa-asr-"));
    try {
      await watchSize(path.join(paths().cache, "whisper"), step, () =>
        hyperframes(["transcribe", sample, "-d", work, "-m", WHISPER_MODEL, "--no-runtime-install", "--json"]));
      if (!fs.existsSync(path.join(work, "transcript.json"))) throw new Error("Transcription produced no transcript.");
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  },
};

// ---- Environment for agent runs ----

/** Variables that point the teacher's tools at the installed runtimes. Empty outside the desktop app. */
export function runtimeEnv(): Record<string, string> {
  if (!RUNTIMES_DIR) return {};
  const p = paths();
  const st = readState();
  const env: Record<string, string> = {
    PATH: [p.bin, path.dirname(p.ffmpeg), path.dirname(p.python), process.env.PATH ?? ""].join(path.delimiter),
    HYPERFRAMES_CACHE_DIR: p.cache,
    HYPERFRAMES_PYTHON: p.python,
    HYPERFRAMES_FFMPEG_PATH: p.ffmpeg,
    HYPERFRAMES_FFPROBE_PATH: p.ffprobe,
    HYPERFRAMES_WHISPER_PATH: whisperPath(),
    HYPERFRAMES_NO_TELEMETRY: "1",
    PYTHONNOUSERSITE: "1",
  };
  if (st.browserPath) {
    env.HYPERFRAMES_BROWSER_PATH = st.browserPath;
    // The anatomy skill's capture scripts look for Chrome here.
    if (!process.env.CHROME_PATH) env.CHROME_PATH = st.browserPath;
  }
  return env;
}

/**
 * Small launchers in RUNTIMES_DIR/bin, first on the agent's PATH. `node` runs the app's own
 * runtime (Electron in Node mode), so the learner needs no Node install; `npx hyperframes`
 * runs the HyperFrames version that ships with the app instead of downloading one.
 * Written at every start, because the app's path can change (an update, an AppImage mount).
 */
export function writeShims() {
  if (!RUNTIMES_DIR) return;
  const bin = paths().bin;
  fs.mkdirSync(bin, { recursive: true });
  const req = createRequire(import.meta.url);
  const hfBin = path.join(path.dirname(req.resolve("hyperframes/package.json")), "bin", "hyperframes.mjs");
  const npmDir = path.dirname(req.resolve("npm/package.json"));
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const node = process.versions.electron
    ? `ELECTRON_RUN_AS_NODE=1 exec ${q(process.execPath)} "$@"`
    : `exec ${q(process.execPath)} "$@"`;
  const shims: Record<string, string> = {
    node,
    hyperframes: `exec ${q(path.join(bin, "node"))} ${q(hfBin)} "$@"`,
    npm: `exec ${q(path.join(bin, "node"))} ${q(path.join(npmDir, "bin", "npm-cli.js"))} "$@"`,
    // Route `npx [-y] hyperframes[@version] ...` to the bundled CLI; anything else goes to npm.
    npx: [
      `while [ $# -gt 0 ]; do case "$1" in -y|--yes|-q|--quiet) shift ;; *) break ;; esac; done`,
      `case "$1" in hyperframes|hyperframes@*) shift; exec ${q(path.join(bin, "hyperframes"))} "$@" ;; esac`,
      `exec ${q(path.join(bin, "node"))} ${q(path.join(npmDir, "bin", "npx-cli.js"))} "$@"`,
    ].join("\n"),
  };
  for (const [name, body] of Object.entries(shims)) {
    const file = path.join(bin, name);
    fs.writeFileSync(file, `#!/bin/sh\n# Written by Stoa (server/runtimes.ts) at startup.\n${body}\n`, { mode: 0o755 });
  }
}

// ---- Helpers ----

function hyperframes(args: string[]) {
  return run(path.join(paths().bin, "hyperframes"), args, { env: runtimeEnv() });
}

/** Run a command; reject with the end of its output when it fails. Resolves with stdout. */
function run(cmd: string, args: string[], opts: { env?: Record<string, string> } = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      env: { ...process.env, ...opts.env }, stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d; if (out.length > 1e6) out = out.slice(-5e5); });
    child.stderr.on("data", (d) => { err += d; if (err.length > 1e6) err = err.slice(-5e5); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(out);
      const tail = (err || out).replace(/\r/g, "\n").trim().split("\n").slice(-6).join("\n");
      reject(new Error(`${path.basename(cmd)} ${args[0] ?? ""} failed (exit ${code}): ${tail}`));
    });
  });
}

/** Download with resume and a SHA-256 check. Returns the file path. */
async function download(asset: Asset, file: string, step: Step, base = 0) {
  if (fs.existsSync(file) && (await sha256(file)) === asset.sha256) {
    step.bytes = base + asset.size;
    return file;
  }
  const part = file + ".part";
  for (let attempt = 1; ; attempt++) {
    const have = fs.existsSync(part) ? fs.statSync(part).size : 0;
    try {
      const res = await fetch(asset.url, { headers: have ? { range: `bytes=${have}-` } : {}, redirect: "follow" });
      if (res.status === 416) { fs.rmSync(part, { force: true }); continue; }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${asset.url}`);
      const append = have > 0 && res.status === 206;
      let got = append ? have : 0;
      step.bytes = base + got;
      const counter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) { got += chunk.byteLength; step.bytes = base + got; ctl.enqueue(chunk); },
      });
      await pipeline(Readable.fromWeb(res.body.pipeThrough(counter) as any), fs.createWriteStream(part, { flags: append ? "a" : "w" }));
      break;
    } catch (err) {
      if (attempt >= 4) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  const digest = await sha256(part);
  if (digest !== asset.sha256) {
    fs.rmSync(part, { force: true });
    throw new Error(`The download of ${path.basename(asset.url)} is damaged (checksum mismatch). Try again.`);
  }
  fs.renameSync(part, file);
  return file;
}

function sha256(file: string) {
  return new Promise<string>((resolve, reject) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(file).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex"))).on("error", reject);
  });
}

/** Build a folder in a temp sibling, then swap it in, so a failed step never leaves half a tool. */
async function replaceDir(dest: string, fill: (tmp: string) => Promise<unknown>) {
  const tmp = `${dest}.tmp-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  try {
    await fill(tmp);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(tmp, dest);
  } catch (err) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
}

/** Report progress for downloads that HyperFrames does itself, from the size of its cache folder. */
async function watchSize<T>(folder: string, step: Step, work: () => Promise<T>) {
  const start = folderSize(folder);
  const timer = setInterval(() => {
    const grown = Math.max(0, folderSize(folder) - start);
    step.bytes = step.total ? Math.min(grown, step.total) : grown;
  }, 1000);
  try { return await work(); } finally { clearInterval(timer); }
}

function folderSize(folder: string): number {
  let total = 0;
  try {
    for (const e of fs.readdirSync(folder, { withFileTypes: true })) {
      const p = path.join(folder, e.name);
      if (e.isDirectory()) total += folderSize(p);
      else if (e.isFile()) total += fs.statSync(p).size;
    }
  } catch { /* not there yet */ }
  return total;
}

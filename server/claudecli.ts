/**
 * The Claude Code CLI on the learner's computer. Stoa's agents run on the Claude Code that ships
 * inside the Agent SDK, so the CLI is not needed to teach. Learners need it to sign in to Claude
 * (`claude`, then `/login`), and setup installs it when it is missing, with the official installer:
 *
 *   curl -fsSL https://claude.ai/install.sh | bash
 *
 * The installer puts `claude` in ~/.local/bin. Desktop app only, on macOS and Linux.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

export const INSTALL_COMMAND = "curl -fsSL https://claude.ai/install.sh | bash";

export type CliStatus = {
  installed: boolean;
  path: string | null;
  version: string | null;
  installing: boolean;
  error: string | null;
  /** The end of the installer's output, for the logs view when it fails. */
  log: string;
  supported: boolean;
};

const supported = process.platform === "darwin" || process.platform === "linux";
let found: { path: string; version: string | null } | null | undefined;
let installing: Promise<void> | null = null;
let error: string | null = null;
let log = "";

/** Where the installer and older installs put `claude`, after the folders on PATH. */
function candidates() {
  const home = os.homedir();
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extra = [path.join(home, ".local", "bin"), path.join(home, ".claude", "local"), "/opt/homebrew/bin", "/usr/local/bin"];
  return [...new Set([...dirs, ...extra])].map((d) => path.join(d, "claude"));
}

function run(cmd: string, args: string[], timeout: number) {
  return new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let out = "";
    const add = (d: Buffer) => { out += d; if (out.length > 200_000) out = out.slice(-100_000); };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
    child.on("error", (e) => { clearTimeout(timer); resolve({ code: -1, out: String(e) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, out }); });
  });
}

async function find(): Promise<{ path: string; version: string | null } | null> {
  for (const p of candidates()) {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      if (!fs.statSync(p).isFile()) continue;
    } catch { continue; }
    const { code, out } = await run(p, ["--version"], 15_000);
    const version = code === 0 ? out.trim().split("\n")[0]?.trim() || null : null;
    return { path: p, version };
  }
  return null;
}

/** Look for the CLI (again with `force`). */
export async function cliStatus(force = false): Promise<CliStatus> {
  if (found === undefined || (force && !installing)) found = await find();
  return {
    installed: !!found, path: found?.path ?? null, version: found?.version ?? null,
    installing: !!installing, error, log: log.slice(-4000), supported,
  };
}

/** Run the official installer. Joins an install that is already running. */
export function installCli() {
  if (!supported) {
    error = "Stoa installs Claude Code on macOS and Linux only.";
    return Promise.resolve();
  }
  if (installing) return installing;
  error = null;
  log = "";
  installing = (async () => {
    try {
      const res = await run("/bin/bash", ["-c", `set -o pipefail; ${INSTALL_COMMAND}`], 10 * 60_000);
      log = res.out.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
      if (res.code !== 0) {
        const tail = log.trim().split("\n").slice(-4).join("\n");
        throw new Error(`The Claude Code installer failed (exit ${res.code}).${tail ? `\n${tail}` : ""}`);
      }
      // The installer adds ~/.local/bin to the shell profile; this process needs it now.
      const bin = path.join(os.homedir(), ".local", "bin");
      const dirs = (process.env.PATH ?? "").split(path.delimiter);
      if (!dirs.includes(bin)) process.env.PATH = [bin, ...dirs].join(path.delimiter);
      found = await find();
      if (!found) throw new Error("The installer finished, but Stoa cannot find the claude command.");
      console.log(`[claude-cli] installed ${found.version ?? ""} at ${found.path}`);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error("[claude-cli]", error);
    } finally {
      installing = null;
    }
  })();
  return installing;
}

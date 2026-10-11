import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { deleteSession, listSessions } from "@anthropic-ai/claude-agent-sdk";

/**
 * Remove the agent sessions that ran in a topic folder: the transcripts, subagent transcripts and
 * per-project data the Claude Agent SDK keeps under its config directory.
 */
export async function deleteAgentSessions(dir: string) {
  let removed = 0;
  try {
    const sessions = await listSessions({ dir, includeWorktrees: false });
    for (const s of sessions) {
      try {
        await deleteSession(s.sessionId, { dir });
        removed++;
      } catch { /* already gone */ }
    }
  } catch (err) {
    console.warn("[delete] could not list agent sessions:", err instanceof Error ? err.message : err);
  }
  // The SDK keeps one folder per working directory, named after the path with every
  // non-alphanumeric character replaced by "-". Remove what is left in it (for example memory).
  const configDir = process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), ".claude");
  const projectDir = path.join(configDir, "projects", dir.replace(/[^a-zA-Z0-9]/g, "-"));
  if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true, force: true });
  return removed;
}

/**
 * Stop processes that still work inside a folder (a video render or a voice-over that the agent
 * started). Aborting the agent stops the agent itself, but not always the tools it launched.
 */
export function killProcessesIn(dir: string) {
  const pids = new Set<number>();
  const inside = (p: string) => p === dir || p.startsWith(dir + path.sep);
  try {
    if (process.platform === "linux") {
      for (const entry of fs.readdirSync("/proc")) {
        if (!/^\d+$/.test(entry)) continue;
        try { if (inside(fs.readlinkSync(`/proc/${entry}/cwd`))) pids.add(Number(entry)); } catch { /* gone or not ours */ }
      }
    } else if (process.platform === "darwin") {
      // -Fpn prints "p<pid>" then "n<cwd>" for every process's current directory.
      const out = execFileSync("lsof", ["-a", "-d", "cwd", "-Fpn"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      let pid = 0;
      for (const line of out.split("\n")) {
        if (line.startsWith("p")) pid = Number(line.slice(1));
        else if (line.startsWith("n") && pid && inside(line.slice(1))) pids.add(pid);
      }
    }
  } catch { /* lsof missing or failed: nothing more we can do */ }
  pids.delete(process.pid);
  for (const pid of pids) {
    try { process.kill(pid, "SIGTERM"); } catch { /* already exited */ }
  }
  return pids.size;
}

/** Delete a folder, retrying briefly while processes that were just stopped release it. */
export async function removeFolder(dir: string) {
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      if (!fs.existsSync(dir)) return true;
    } catch { /* busy */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return !fs.existsSync(dir);
}

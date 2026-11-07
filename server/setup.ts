/**
 * First-run setup for the desktop app: Claude access and the video tools.
 *
 * Claude access: an existing Claude Code login on this computer is used first. Only when there
 * is none does the learner give an API key; the desktop shell stores it encrypted and hands it to
 * this process (see desktop/main.ts), which puts it in ANTHROPIC_API_KEY for the agents.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { installRuntimes, runtimeStatus } from "./runtimes.ts";

export const DESKTOP = process.env.STOA_DESKTOP === "1";

export type ClaudeAccess = {
  /** "login": a Claude Code login; "apiKey": a key the learner gave; null: none yet. */
  mode: "login" | "apiKey" | null;
  login: { email: string | null; plan: string | null; provider: string | null } | null;
  checkedAt: string;
};

let access: ClaudeAccess | null = null;
let checking: Promise<ClaudeAccess> | null = null;

/** Look for a Claude Code login. Starts the Claude Code process without sending a prompt (no cost). */
async function findLogin(): Promise<ClaudeAccess["login"]> {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // look at the login only
  const abortController = new AbortController();
  async function* idle() { await new Promise<never>(() => {}); }
  const q = query({ prompt: idle(), options: { settingSources: [], abortController, env, persistSession: false } });
  try {
    const info = await Promise.race([
      q.accountInfo(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Claude Code did not answer in time")), 20_000)),
    ]);
    const thirdParty = info.apiProvider && info.apiProvider !== "firstParty";
    const hasToken = !!info.email || !!info.subscriptionType || (!!info.tokenSource && info.tokenSource !== "none");
    if (!thirdParty && !hasToken) return null;
    return { email: info.email ?? null, plan: info.subscriptionType ?? null, provider: info.apiProvider ?? null };
  } finally {
    abortController.abort();
  }
}

export function checkClaude(force = false): Promise<ClaudeAccess> {
  if (access && !force) return Promise.resolve(access);
  if (checking) return checking;
  checking = (async () => {
    let login: ClaudeAccess["login"] = null;
    try { login = await findLogin(); } catch (err) {
      console.warn("[setup] login check failed:", err instanceof Error ? err.message : err);
    }
    const mode = process.env.ANTHROPIC_API_KEY ? "apiKey" : login ? "login" : null;
    access = { mode, login, checkedAt: new Date().toISOString() };
    return access;
  })().finally(() => { checking = null; });
  return checking;
}

/** The desktop shell sends the API key (or its removal) to this process. */
export function setApiKey(key: string | null) {
  if (key) process.env.ANTHROPIC_API_KEY = key;
  else delete process.env.ANTHROPIC_API_KEY;
  access = null;
  return checkClaude(true);
}

export async function setupState() {
  if (!DESKTOP) return { desktop: false as const, ready: true };
  const claude = await checkClaude();
  const tools = runtimeStatus();
  const toolsReady = tools.managed ? tools.ready : true;
  return { desktop: true as const, ready: !!claude.mode && toolsReady, claude, tools };
}

export function startToolInstall() {
  void installRuntimes();
  return runtimeStatus();
}

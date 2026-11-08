/**
 * First-run setup for the desktop app: Claude access, the Claude Code CLI, and the video tools.
 *
 * Claude access, in order:
 *   1. a custom endpoint or Amazon Bedrock, when the learner set one up (server/settings.ts)
 *   2. an Anthropic API key the learner gave (the desktop shell stores it encrypted)
 *   3. an existing Claude Code login on this computer
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { installRuntimes, runtimeEnv, runtimeStatus } from "./runtimes.ts";
import { cliStatus, installCli } from "./claudecli.ts";
import { connectionMode, getSettings, providerEnv, setSecret, teacherModel, type SecretName } from "./settings.ts";

export const DESKTOP = process.env.STOA_DESKTOP === "1";

export type ClaudeAccess = {
  /** "login": a Claude Code login; "apiKey": a key the learner gave; "custom"/"bedrock": a connection; null: none yet. */
  mode: "login" | "apiKey" | "custom" | "bedrock" | null;
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
    const provider = getSettings().provider;
    const mode = provider !== "anthropic"
      ? connectionMode()
      : process.env.ANTHROPIC_API_KEY ? "apiKey" : login ? "login" : null;
    access = { mode, login, checkedAt: new Date().toISOString() };
    return access;
  })().finally(() => { checking = null; });
  return checking;
}

/** The desktop shell sends a secret (or its removal) to this process. */
export function applySecret(name: SecretName, value: string | null) {
  setSecret(name, value);
  access = null;
  return checkClaude(true);
}

/** Settings changed: work out the access again, without waiting for a new login check. */
export function settingsChanged() {
  if (!access) return;
  const provider = getSettings().provider;
  access = {
    ...access,
    mode: provider !== "anthropic" ? connectionMode() : process.env.ANTHROPIC_API_KEY ? "apiKey" : access.login ? "login" : null,
  };
}

export async function setupState() {
  if (!DESKTOP) return { desktop: false as const, ready: true };
  const [claude, cli] = await Promise.all([checkClaude(), cliStatus()]);
  const tools = runtimeStatus();
  const toolsReady = tools.managed ? tools.ready : true;
  return { desktop: true as const, ready: !!claude.mode && toolsReady, claude, cli, tools };
}

export function startToolInstall() {
  void installRuntimes();
  return runtimeStatus();
}

export async function startCliInstall() {
  void installCli();
  return cliStatus();
}

/**
 * Send one short prompt through the saved connection and model, the same way a lesson run does.
 * Costs a few tokens. Resolves with the reply or the error the service gave.
 */
export async function testConnection(): Promise<{ ok: boolean; model: string; ms: number; reply?: string; error?: string }> {
  const model = teacherModel();
  const started = Date.now();
  // Claude Code retries a URL it cannot reach for a long time. Check that something answers first.
  const s = getSettings();
  const url = s.provider === "custom" ? s.custom.baseUrl : s.provider === "bedrock" ? s.bedrock.baseUrl : "";
  if (url) {
    try {
      await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000), redirect: "manual" });
    } catch (err) {
      const why = (err as any)?.cause?.code ?? (err instanceof Error && err.name === "TimeoutError" ? "no answer in 8 seconds" : "");
      return { ok: false, model, ms: Date.now() - started, error: `Stoa cannot reach ${url}${why ? ` (${why})` : ""}. Check the URL and that the service is running.` };
    }
  }
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), 90_000);
  let reply = "";
  let error: string | null = null;
  try {
    const stream = query({
      prompt: "Reply with the single word: ready",
      options: {
        model, abortController, settingSources: [], persistSession: false, maxTurns: 1, tools: [],
        env: providerEnv({ ...process.env, ...runtimeEnv() }),
      },
    });
    for await (const m of stream as AsyncIterable<any>) {
      if (m.type === "assistant") {
        if (m.error) error = describe(m.error);
        for (const b of m.message?.content ?? []) if (b.type === "text") reply += b.text;
      } else if (m.type === "result") {
        if (m.is_error || m.subtype !== "success") error ??= (typeof m.result === "string" && m.result) || (m.errors ?? []).join("\n") || "The service returned an error.";
        break;
      }
    }
  } catch (err) {
    error = abortController.signal.aborted ? "No answer in 90 seconds. Check the URL and that the service is running." : err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
    abortController.abort();
  }
  const ms = Date.now() - started;
  if (error || !reply.trim()) return { ok: false, model, ms, error: error ?? "The service answered with no text." };
  return { ok: true, model, ms, reply: reply.trim().slice(0, 200) };
}

function describe(code: string) {
  const map: Record<string, string> = {
    authentication_failed: "The service did not accept the credentials.",
    billing_error: "The account has a billing problem.",
    rate_limit: "The service is rate limiting this account. Try again in a minute.",
    invalid_request: "The service rejected the request. Check the model ID.",
    server_error: "The service had an error. Try again in a moment.",
  };
  return map[code] ?? `The service returned an error (${code}).`;
}

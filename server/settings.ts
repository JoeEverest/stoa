/**
 * App settings: which service the agents talk to, and which models they use.
 *
 * Three connections:
 *   anthropic  Anthropic's API, with a Claude Code login or an API key (the default)
 *   custom     an Anthropic-compatible URL: an LLM gateway, a proxy, or a self-hosted router
 *   bedrock    Amazon Bedrock, optionally through a custom endpoint (VPC endpoint, gateway)
 *
 * The plain settings live in DATA_DIR/settings.json. Secrets (API keys, tokens) never go there:
 * the desktop shell keeps them encrypted and hands them to this process (desktop/main.ts), which
 * holds them in memory only. Each run of an agent gets the environment that `providerEnv` builds.
 *
 * With no settings file (the web and Docker setups) nothing is changed: the process environment
 * (ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, CLAUDE_CODE_USE_BEDROCK, LEARN_MODEL ...) applies as before.
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.ts";

export type Provider = "anthropic" | "custom" | "bedrock";
export type SecretName = "anthropic" | "custom" | "bedrock";

export type Settings = {
  provider: Provider;
  /** Athena (lessons, videos). Empty: the default for the connection. */
  model: string;
  /** The tutor beside a lesson. Empty: the same as `model`. */
  tutorModel: string;
  /** Small background work inside Claude Code (titles, summaries). Custom and Bedrock only. Empty: `model`. */
  fastModel: string;
  custom: { baseUrl: string; auth: "x-api-key" | "bearer" | "none" };
  bedrock: { region: string; baseUrl: string; auth: "profile" | "apiKey" | "none"; profile: string };
};

export const DEFAULT_MODEL = "claude-opus-5-5";

const DEFAULTS: Settings = {
  provider: "anthropic",
  model: "",
  tutorModel: "",
  fastModel: "",
  custom: { baseUrl: "", auth: "x-api-key" },
  bedrock: { region: "us-east-1", baseUrl: "", auth: "profile", profile: "" },
};

const FILE = path.join(DATA_DIR, "settings.json");
let cached: Settings | null = null;
/** True once the learner saved settings (or a settings file exists). */
let explicit = false;

export function getSettings(): Settings {
  if (cached) return cached;
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    cached = merge(DEFAULTS, raw);
    explicit = true;
  } catch {
    cached = structuredClone(DEFAULTS);
  }
  return cached;
}

function merge(base: Settings, raw: any): Settings {
  const s = structuredClone(base);
  if (!raw || typeof raw !== "object") return s;
  if (["anthropic", "custom", "bedrock"].includes(raw.provider)) s.provider = raw.provider;
  for (const k of ["model", "tutorModel", "fastModel"] as const) if (typeof raw[k] === "string") s[k] = raw[k].trim();
  if (raw.custom) {
    if (typeof raw.custom.baseUrl === "string") s.custom.baseUrl = raw.custom.baseUrl.trim();
    if (["x-api-key", "bearer", "none"].includes(raw.custom.auth)) s.custom.auth = raw.custom.auth;
  }
  if (raw.bedrock) {
    for (const k of ["region", "baseUrl", "profile"] as const) if (typeof raw.bedrock[k] === "string") s.bedrock[k] = raw.bedrock[k].trim();
    if (["profile", "apiKey", "none"].includes(raw.bedrock.auth)) s.bedrock.auth = raw.bedrock.auth;
  }
  return s;
}

/** Check and store new settings. Returns an error message for the learner, or null. */
export function saveSettings(raw: unknown): string | null {
  const next = merge(getSettings(), raw);
  const problem = validate(next);
  if (problem) return problem;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  cached = next;
  explicit = true;
  return null;
}

const MODEL_RE = /^[\w.:/@\[\]-]{1,200}$/;

function validate(s: Settings): string | null {
  for (const [label, v] of [["Teacher model", s.model], ["Tutor model", s.tutorModel], ["Fast model", s.fastModel]]) {
    if (v && !MODEL_RE.test(v)) return `${label}: use the model ID only (letters, digits, and . : / @ - _).`;
  }
  if (s.provider === "custom") {
    const url = checkUrl(s.custom.baseUrl);
    if (!s.custom.baseUrl) return "Enter the URL of your endpoint.";
    if (url) return url;
    if (!s.model) return "Choose the model your endpoint serves.";
  }
  if (s.provider === "bedrock") {
    if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(s.bedrock.region)) return "Enter an AWS region, such as us-east-1.";
    if (s.bedrock.baseUrl) { const url = checkUrl(s.bedrock.baseUrl); if (url) return url; }
    if (s.bedrock.profile && !/^[\w.+-]{1,64}$/.test(s.bedrock.profile)) return "The AWS profile name has characters a profile cannot have.";
    if (!s.model) return "Enter the Bedrock model ID or inference profile to use.";
  }
  return null;
}

function checkUrl(v: string): string | null {
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "The URL must start with https:// (or http:// for a local server).";
    return null;
  } catch {
    return "This is not a full URL. It looks like https://gateway.example.com.";
  }
}

// ---- Secrets (from the desktop shell; memory only) ----

const secrets: Partial<Record<SecretName, string>> = {};
// The shell passes stored secrets at start. Take them out of the environment, so they reach an
// agent only through providerEnv, and only for the connection that uses them.
for (const [name, env] of [["custom", "STOA_CUSTOM_TOKEN"], ["bedrock", "STOA_BEDROCK_TOKEN"]] as const) {
  if (process.env[env]) secrets[name] = process.env[env];
  delete process.env[env];
}
if (process.env.ANTHROPIC_API_KEY) secrets.anthropic = process.env.ANTHROPIC_API_KEY;

export function setSecret(name: SecretName, value: string | null) {
  if (value) secrets[name] = value;
  else delete secrets[name];
  if (name === "anthropic") {
    if (value) process.env.ANTHROPIC_API_KEY = value;
    else delete process.env.ANTHROPIC_API_KEY;
  }
}
export const hasSecret = (name: SecretName) => !!secrets[name];

// ---- What the agents get ----

/** Variables every Claude Code connection might read. Cleared before a custom or Bedrock run. */
const CONNECTION_VARS = [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY",
  "ANTHROPIC_BEDROCK_BASE_URL", "CLAUDE_CODE_SKIP_BEDROCK_AUTH", "AWS_BEARER_TOKEN_BEDROCK",
];

/**
 * The environment for one agent run: `base` with the connection applied. Keys set to undefined
 * are removed from the result.
 */
export function providerEnv(base: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string | undefined> = { ...base };
  const s = getSettings();
  if (explicit && s.provider !== "anthropic") {
    for (const k of CONNECTION_VARS) delete env[k];
    const model = s.model;
    const fast = s.fastModel || model;
    // Claude Code and its skills sometimes ask for a model by family ("sonnet", "haiku"). A gateway
    // or a Bedrock account may serve one model only, so every family points at the chosen ones.
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = fast;
    env.ANTHROPIC_SMALL_FAST_MODEL = fast;
    env.CLAUDE_CODE_SUBAGENT_MODEL = model;
    if (s.provider === "custom") {
      env.ANTHROPIC_BASE_URL = s.custom.baseUrl.replace(/\/+$/, "");
      const token = secrets.custom;
      if (token && s.custom.auth === "x-api-key") env.ANTHROPIC_API_KEY = token;
      if (token && s.custom.auth === "bearer") env.ANTHROPIC_AUTH_TOKEN = token;
      // A gateway that needs no key still needs Claude Code to send something.
      if (s.custom.auth === "none") env.ANTHROPIC_AUTH_TOKEN = "none";
    } else {
      env.CLAUDE_CODE_USE_BEDROCK = "1";
      env.AWS_REGION = s.bedrock.region;
      if (s.bedrock.baseUrl) env.ANTHROPIC_BEDROCK_BASE_URL = s.bedrock.baseUrl.replace(/\/+$/, "");
      if (s.bedrock.auth === "profile" && s.bedrock.profile) env.AWS_PROFILE = s.bedrock.profile;
      if (s.bedrock.auth === "apiKey" && secrets.bedrock) env.AWS_BEARER_TOKEN_BEDROCK = secrets.bedrock;
      if (s.bedrock.auth === "none") env.CLAUDE_CODE_SKIP_BEDROCK_AUTH = "1";
    }
  }
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  return env as Record<string, string>;
}

/** The connection in use, for setup: null while a custom or Bedrock connection is missing a piece. */
export function connectionMode(): "custom" | "bedrock" | null {
  const s = getSettings();
  if (!explicit || s.provider === "anthropic") return null;
  if (validate(s)) return null;
  if (s.provider === "custom" && s.custom.auth !== "none" && !secrets.custom) return null;
  if (s.provider === "bedrock" && s.bedrock.auth === "apiKey" && !secrets.bedrock) return null;
  return s.provider;
}

export const isExplicit = () => explicit;

export function teacherModel() {
  const s = getSettings();
  return (explicit && s.model) || process.env.LEARN_MODEL || DEFAULT_MODEL;
}
export function tutorModel() {
  const s = getSettings();
  return (explicit && s.tutorModel) || process.env.TUTOR_MODEL || teacherModel();
}

/** Settings for the UI: the stored values, which secrets are set, and the models in use. */
export function publicSettings() {
  return {
    settings: getSettings(),
    secrets: { anthropic: hasSecret("anthropic"), custom: hasSecret("custom"), bedrock: hasSecret("bedrock") },
    effective: { model: teacherModel(), tutorModel: tutorModel() },
    defaultModel: DEFAULT_MODEL,
  };
}

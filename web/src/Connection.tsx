import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type ClaudeAccess, type CliStatus, type ConnectionTest, type Provider, type Settings, type SettingsState } from "./api";
import * as I from "./icons";

/**
 * How Stoa reaches Claude, and which models it uses. Shared by the setup screen and Settings.
 *
 *   Anthropic        a Claude Code login, or an Anthropic API key
 *   Custom endpoint  any Anthropic-compatible URL (an LLM gateway, a proxy, a local router)
 *   Amazon Bedrock   Claude in the learner's AWS account, optionally through a custom endpoint
 *
 * Secrets go to the desktop shell (stored encrypted), never to the server's settings file.
 */

export const ANTHROPIC_MODELS = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "Recommended" },
  { id: "claude-fable-5-1", name: "Claude Fable 5.1", note: "Most capable, costs more" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "Faster, costs less" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "Fastest, for quick answers" },
];
const BEDROCK_SUGGESTIONS = ["anthropic.claude-opus-5-5", "anthropic.claude-sonnet-5-5", "anthropic.claude-haiku-5-5", "anthropic.claude-fable-5-1"];
const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: "anthropic", label: "Anthropic", hint: "Claude login or API key" },
  { id: "custom", label: "Custom URL", hint: "Gateway or proxy" },
  { id: "bedrock", label: "Amazon Bedrock", hint: "Your AWS account" },
];

type Secrets = Record<StoaSecretName, StoaSecretInfo>;
const noSecrets: Secrets = { anthropic: { set: false, last4: null }, custom: { set: false, last4: null }, bedrock: { set: false, last4: null } };

export function ConnectionForm({ claude, cli, compact, onSaved }: {
  /** Desktop only: the access the server found. */
  claude: ClaudeAccess | null;
  cli: CliStatus | null;
  /** The setup screen: fewer model options in view. */
  compact?: boolean;
  onSaved: () => void;
}) {
  const desktop = window.stoaDesktop;
  const [state, setState] = useState<SettingsState | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [secretInfo, setSecretInfo] = useState<Secrets>(noSecrets);
  const [secret, setSecret] = useState<Record<StoaSecretName, string>>({ anthropic: "", custom: "", bedrock: "" });
  const [replacing, setReplacing] = useState<StoaSecretName | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [test, setTest] = useState<ConnectionTest | null>(null);

  const load = async () => {
    try {
      const [s, k] = await Promise.all([api.settings(), desktop ? desktop.secretInfo() : Promise.resolve(noSecrets)]);
      setState(s);
      setDraft(structuredClone(s.settings));
      setSecretInfo(k);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => { load(); }, []);

  if (!state || !draft) return <p className="settings-loading"><I.Spinner size={14} />Loading settings</p>;

  const canConnect = state.desktop && !!desktop;
  const p = draft.provider;
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.settings) || Object.values(secret).some((v) => v.trim());
  const set = (patch: Partial<Settings>) => { setDraft({ ...draft, ...patch }); setNotice(null); setTest(null); };
  const setCustom = (patch: Partial<Settings["custom"]>) => set({ custom: { ...draft.custom, ...patch } });
  const setBedrock = (patch: Partial<Settings["bedrock"]>) => set({ bedrock: { ...draft.bedrock, ...patch } });
  const needsSecret: StoaSecretName | null =
    p === "custom" && draft.custom.auth !== "none" ? "custom"
    : p === "bedrock" && draft.bedrock.auth === "apiKey" ? "bedrock" : null;

  const save = async () => {
    setBusy("save");
    setError(null);
    setNotice(null);
    setTest(null);
    try {
      // Secrets first: the shell checks an Anthropic key with Anthropic before it keeps it.
      for (const name of ["anthropic", "custom", "bedrock"] as const) {
        const v = secret[name].trim();
        if (!v || !desktop) continue;
        const res = await desktop.setSecret(name, v);
        if (!res.ok) throw new Error(res.error ?? "The key was not saved.");
      }
      if (needsSecret && !secret[needsSecret].trim() && !secretInfo[needsSecret].set) {
        throw new Error(needsSecret === "custom" ? "Enter the key or token for your endpoint, or choose “No key”." : "Enter your Bedrock API key, or choose another way to sign in to AWS.");
      }
      const next = await api.saveSettings(draft);
      setState(next);
      setDraft(structuredClone(next.settings));
      setSecret({ anthropic: "", custom: "", bedrock: "" });
      setReplacing(null);
      if (desktop) setSecretInfo(await desktop.secretInfo());
      setNotice(p === "anthropic" ? "Saved. New work uses these settings." : "Saved. Test the connection to make sure it works.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };

  const runTest = async () => {
    setBusy("test");
    setError(null);
    setNotice(null);
    setTest(null);
    try { setTest(await api.testConnection()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };

  const removeKey = async () => {
    if (!desktop) return;
    setBusy("remove");
    await desktop.clearSecret("anthropic");
    setSecretInfo(await desktop.secretInfo());
    setNotice(claude?.login ? "Key removed. Stoa uses your Claude login for new work." : "Key removed.");
    setBusy(null);
    onSaved();
  };

  const secretField = (name: StoaSecretName, label: string, placeholder: string) => {
    const info = secretInfo[name];
    if (info.set && replacing !== name) {
      return (
        <div className="field-row">
          <span className="field-label">{label}</span>
          <div className="secret-set">
            <span><I.Check size={14} />Saved{info.last4 ? <> · ends in <code>…{info.last4}</code></> : null}</span>
            <button type="button" className="link-btn" onClick={() => setReplacing(name)}>Replace</button>
          </div>
        </div>
      );
    }
    return (
      <label className="field-row">
        <span className="field-label">{label}</span>
        <input type="password" className="field" placeholder={placeholder} value={secret[name]} autoComplete="off" spellCheck={false}
          onChange={(e) => { setSecret({ ...secret, [name]: e.target.value }); setNotice(null); }} disabled={!!busy} />
      </label>
    );
  };

  return (
    <form className="conn" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {canConnect && (
        <div className="segctl" role="radiogroup" aria-label="Connect to Claude through">
          {PROVIDERS.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={p === o.id} className={p === o.id ? "on" : ""}
              onClick={() => set({ provider: o.id })} disabled={!!busy}>
              <span className="segctl-label">{o.label}</span>
              <span className="segctl-hint">{o.hint}</span>
            </button>
          ))}
        </div>
      )}
      {!canConnect && (
        <p className="settings-note">This server connects to Claude with the settings in its environment
          (<code>ANTHROPIC_API_KEY</code>, <code>ANTHROPIC_BASE_URL</code> or <code>CLAUDE_CODE_USE_BEDROCK</code>).
          You can choose the models here.</p>
      )}

      {canConnect && p === "anthropic" && (
        <AnthropicAccess claude={claude} cli={cli} keyInfo={secretInfo.anthropic} replacing={replacing === "anthropic"}
          onReplace={() => setReplacing("anthropic")} keyField={secretField("anthropic", "Anthropic API key", "sk-ant-…")}
          onRemove={removeKey} busy={!!busy} onRecheck={onSaved} />
      )}

      {canConnect && p === "custom" && (
        <div className="conn-fields">
          <p className="settings-note">
            Any service that speaks the Anthropic Messages API: an LLM gateway such as LiteLLM, a company proxy, or a
            router to another model. Stoa sends every request to this URL instead of Anthropic.
          </p>
          <label className="field-row">
            <span className="field-label">Endpoint URL</span>
            <input className="field field-wide" type="url" placeholder="https://gateway.example.com" value={draft.custom.baseUrl}
              spellCheck={false} onChange={(e) => setCustom({ baseUrl: e.target.value })} disabled={!!busy} />
          </label>
          <div className="field-row">
            <span className="field-label">How to send the key</span>
            <div className="choice">
              {([["x-api-key", "x-api-key header"], ["bearer", "Bearer token"], ["none", "No key"]] as const).map(([id, label]) => (
                <label key={id}><input type="radio" name="custom-auth" checked={draft.custom.auth === id} onChange={() => setCustom({ auth: id })} disabled={!!busy} />{label}</label>
              ))}
            </div>
          </div>
          {draft.custom.auth !== "none" && secretField("custom", draft.custom.auth === "bearer" ? "Token" : "API key", "Paste the key")}
        </div>
      )}

      {canConnect && p === "bedrock" && (
        <div className="conn-fields">
          <p className="settings-note">
            Claude through your AWS account. Turn on the Claude models in the Bedrock console first. Set a custom endpoint
            only for a VPC endpoint or a gateway in front of Bedrock.
          </p>
          <div className="field-pair">
            <label className="field-row">
              <span className="field-label">AWS region</span>
              <input className="field" placeholder="us-east-1" value={draft.bedrock.region} spellCheck={false}
                onChange={(e) => setBedrock({ region: e.target.value })} disabled={!!busy} />
            </label>
            <label className="field-row">
              <span className="field-label">Custom endpoint <span className="opt">optional</span></span>
              <input className="field" type="url" placeholder="https://bedrock-runtime.us-east-1.amazonaws.com" value={draft.bedrock.baseUrl}
                spellCheck={false} onChange={(e) => setBedrock({ baseUrl: e.target.value })} disabled={!!busy} />
            </label>
          </div>
          <div className="field-row">
            <span className="field-label">Sign in to AWS with</span>
            <div className="choice">
              {([["profile", "AWS profile"], ["apiKey", "Bedrock API key"], ["none", "Endpoint handles it"]] as const).map(([id, label]) => (
                <label key={id}><input type="radio" name="bedrock-auth" checked={draft.bedrock.auth === id} onChange={() => setBedrock({ auth: id })} disabled={!!busy} />{label}</label>
              ))}
            </div>
          </div>
          {draft.bedrock.auth === "profile" && (
            <label className="field-row">
              <span className="field-label">Profile name <span className="opt">optional</span></span>
              <input className="field" placeholder="default" value={draft.bedrock.profile} spellCheck={false}
                onChange={(e) => setBedrock({ profile: e.target.value })} disabled={!!busy} />
              <span className="field-help">From <code>~/.aws/config</code>. For SSO, run <code>aws sso login</code> first.</span>
            </label>
          )}
          {draft.bedrock.auth === "apiKey" && secretField("bedrock", "Bedrock API key", "Paste the key")}
        </div>
      )}

      <ModelFields draft={draft} set={set} provider={canConnect ? p : "anthropic"} compact={compact} defaultModel={state.defaultModel} disabled={!!busy} />

      <div className="conn-actions">
        <button className="btn btn-primary" type="submit" disabled={!!busy || !dirty}>
          {busy === "save" ? <><I.Spinner size={14} />Saving</> : "Save"}
        </button>
        <button className="btn btn-secondary" type="button" onClick={runTest} disabled={!!busy || dirty}
          title={dirty ? "Save first, then test" : "Send one short message with these settings"}>
          {busy === "test" ? <><I.Spinner size={14} />Testing</> : "Test connection"}
        </button>
        {dirty && !busy && <span className="muted conn-dirty">Unsaved changes</span>}
      </div>
      {test && (test.ok
        ? <p className="settings-ok" role="status"><I.Check size={14} /><span><strong>{test.model}</strong> answered in {(test.ms / 1000).toFixed(1)} s. The connection works.</span></p>
        : <div className="setup-error" role="alert"><p><strong>{test.model}</strong> did not answer. {test.error}</p></div>)}
      {notice && <p className="settings-ok" role="status"><I.Check size={14} />{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function AnthropicAccess({ claude, cli, keyInfo, replacing, onReplace, keyField, onRemove, busy, onRecheck }: {
  claude: ClaudeAccess | null; cli: CliStatus | null; keyInfo: StoaSecretInfo; replacing: boolean;
  onReplace: () => void; keyField: ReactNode; onRemove: () => void; busy: boolean; onRecheck: () => void;
}) {
  const login = claude?.login;
  const [showKey, setShowKey] = useState(false);
  const usingKey = keyInfo.set;
  return (
    <div className="conn-fields">
      {usingKey ? (
        <p>Stoa uses your Anthropic API key{keyInfo.last4 ? <> ending in <code>…{keyInfo.last4}</code></> : null}. Lessons are billed to that key.</p>
      ) : login ? (
        <p>Signed in to Claude{login.email ? <> as <strong>{login.email}</strong></> : null}{login.plan ? ` (${login.plan})` : ""}. Lessons count toward that plan's usage.</p>
      ) : (
        <p>Sign in with your Claude account, or use an API key from the Claude Console.</p>
      )}

      {!usingKey && !login && <SignIn cli={cli} onRecheck={onRecheck} />}

      {usingKey && !replacing ? (
        <div className="settings-actions">
          <button type="button" className="btn btn-secondary" onClick={onReplace} disabled={busy}>Replace key</button>
          <button type="button" className="btn btn-secondary" onClick={onRemove} disabled={busy}>Remove key</button>
        </div>
      ) : showKey || replacing || (!login && !usingKey) ? (
        <>
          {keyField}
          <p className="settings-note">
            Get a key at <a className="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
            Stoa checks the key with Anthropic before it saves it. One lesson with a video cost about US$3.70 in testing.
          </p>
        </>
      ) : (
        <div className="settings-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowKey(true)} disabled={busy}>Use an API key instead</button>
        </div>
      )}
      {usingKey && !login && !replacing && (
        <p className="settings-note">With no API key, Stoa uses a Claude login. None is on this computer yet.</p>
      )}
    </div>
  );
}

/** Open a terminal running `claude` for /login, then look for the login every few seconds. */
function SignIn({ cli, onRecheck }: { cli: CliStatus | null; onRecheck: () => void }) {
  const desktop = window.stoaDesktop;
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);
  if (!cli?.installed || !desktop) return null;
  const open = async () => {
    setError(null);
    const res = await desktop.openClaudeLogin(cli.path);
    if (!res.ok) return setError(`${res.error ?? "Stoa could not open a terminal."} Open one yourself, run claude, then type /login.`);
    setWaiting(true);
    clearInterval(timer.current);
    let n = 0;
    timer.current = setInterval(async () => {
      if (++n > 60) { clearInterval(timer.current); setWaiting(false); return; }
      try {
        const s = await api.checkClaude();
        if (s.desktop && s.claude.mode) { clearInterval(timer.current); setWaiting(false); onRecheck(); }
      } catch { /* try again */ }
    }, 5000);
  };
  return (
    <div className="signin">
      <div className="settings-actions">
        <button type="button" className="btn btn-primary" onClick={open}>Sign in with Claude</button>
        <button type="button" className="btn btn-secondary" onClick={async () => { await api.checkClaude(); onRecheck(); }}>Check again</button>
      </div>
      <p className="settings-note">
        {waiting
          ? <><I.Spinner size={12} /> In the terminal, type <code>/login</code> and follow the steps. Stoa notices when you are signed in.</>
          : <>Opens a terminal with Claude Code. Type <code>/login</code> there.</>}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

function ModelFields({ draft, set, provider, compact, defaultModel, disabled }: {
  draft: Settings; set: (p: Partial<Settings>) => void; provider: Provider; compact?: boolean; defaultModel: string; disabled: boolean;
}) {
  const [more, setMore] = useState(!!draft.tutorModel || !!draft.fastModel);
  const third = provider !== "anthropic";
  const suggestions = provider === "bedrock" ? BEDROCK_SUGGESTIONS : ANTHROPIC_MODELS.map((m) => m.id);
  const placeholder = provider === "bedrock" ? "anthropic.claude-opus-5-5, or an inference profile ID or ARN" : "The model ID your endpoint serves";
  const field = (key: "model" | "tutorModel" | "fastModel", label: string, help: string, emptyLabel: string) => (
    <label className="field-row">
      <span className="field-label">{label}</span>
      {third ? (
        <input className="field" list={`models-${provider}`} placeholder={key === "model" ? placeholder : emptyLabel}
          value={draft[key]} spellCheck={false} disabled={disabled} onChange={(e) => set({ [key]: e.target.value.trim() })} />
      ) : (
        <ModelSelect value={draft[key]} onChange={(v) => set({ [key]: v })} emptyLabel={emptyLabel} disabled={disabled} />
      )}
      <span className="field-help">{help}</span>
    </label>
  );
  return (
    <fieldset className="conn-models">
      <legend>Models</legend>
      {third && <datalist id={`models-${provider}`}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
      {field("model", "Teacher", "Athena plans the course, writes the lessons and makes the videos.",
        `Default (${ANTHROPIC_MODELS.find((m) => m.id === defaultModel)?.name ?? defaultModel})`)}
      {(more || !compact) ? (
        <>
          {field("tutorModel", "Tutor", "Answers your questions beside a lesson.", "Same as the teacher")}
          {third && field("fastModel", "Background model", "Small jobs inside Claude Code, such as titles and summaries. Pick a cheaper model if your endpoint has one.", "Same as the teacher")}
        </>
      ) : (
        <button type="button" className="link-btn conn-more" onClick={() => setMore(true)}>More model options</button>
      )}
    </fieldset>
  );
}

function ModelSelect({ value, onChange, emptyLabel, disabled }: { value: string; onChange: (v: string) => void; emptyLabel: string; disabled: boolean }) {
  const known = !value || ANTHROPIC_MODELS.some((m) => m.id === value);
  const [other, setOther] = useState(!known);
  return (
    <div className="model-select">
      <select className="field" value={other ? "__other" : value} disabled={disabled}
        onChange={(e) => {
          if (e.target.value === "__other") { setOther(true); return; }
          setOther(false);
          onChange(e.target.value);
        }}>
        <option value="">{emptyLabel}</option>
        {ANTHROPIC_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.note}</option>)}
        <option value="__other">Another model ID…</option>
      </select>
      {other && (
        <input className="field" placeholder="claude-…" value={value} spellCheck={false} disabled={disabled} autoFocus
          onChange={(e) => onChange(e.target.value.trim())} aria-label="Model ID" />
      )}
    </div>
  );
}

/** The Claude Code CLI: found, installing, or failed. Setup installs it when it is missing. */
export function CliRow({ cli, onChange }: { cli: CliStatus; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); onChange(); } };
  if (!cli.supported) return <p className="settings-note">Stoa can install Claude Code on macOS and Linux only.</p>;
  if (cli.installing) return <p className="settings-loading"><I.Spinner size={14} />Installing Claude Code with the official installer</p>;
  if (cli.installed) {
    return (
      <p className="setup-ok">
        Installed{cli.version ? <> · <code>{cli.version}</code></> : null}{cli.path ? <> at <code>{cli.path}</code></> : null}.
      </p>
    );
  }
  return (
    <div className="setup-body">
      {cli.error ? (
        <div className="setup-error" role="alert">
          <p>{cli.error}</p>
          <div className="setup-error-actions">
            <button className="btn btn-secondary" onClick={() => act(api.installCli)} disabled={busy}>Try again</button>
            {window.stoaDesktop && <button className="link-btn" onClick={() => window.stoaDesktop?.openLogs()}>Open logs</button>}
          </div>
        </div>
      ) : (
        <p>Claude Code is not on this computer. Stoa installs it with <code>curl -fsSL https://claude.ai/install.sh | bash</code>.</p>
      )}
      <div className="settings-actions">
        {!cli.error && <button className="btn btn-secondary" onClick={() => act(api.installCli)} disabled={busy}>Install Claude Code</button>}
        <button className="link-btn" onClick={() => act(() => api.cli(true))} disabled={busy}>Check again</button>
      </div>
    </div>
  );
}

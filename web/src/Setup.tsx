import { useEffect, useRef, useState } from "react";
import { api, type SetupState, type SetupStep } from "./api";
import * as I from "./icons";

type Desktop = Extract<SetupState, { desktop: true }>;

const mb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);

/** First run of the desktop app: Claude access, then the video tools. Both are required. */
export function Setup({ state, onChange, onDone }: { state: Desktop; onChange: () => void; onDone: () => void }) {
  const { claude, tools } = state;
  const started = useRef(false);

  // The video tools are required, so the install starts as soon as setup opens.
  useEffect(() => {
    if (started.current || !tools.managed || tools.ready || tools.installing || tools.error || !tools.supported) return;
    started.current = true;
    api.installTools().then(onChange).catch(onChange);
  }, [tools]);

  const toolsReady = !tools.managed || tools.ready;
  return (
    <div className="setup-page">
      <div className="setup-inner">
        <div className="brand setup-brand"><I.Mark size={24} /><span>Stoa</span></div>
        <h1>Set up Stoa</h1>
        <p className="lead">
          Stoa needs two things before your first lesson: access to Claude, so Athena can teach, and the
          tools Athena uses to make narrated lesson videos. Both stay on this computer.
        </p>
        <ol className="setup-steps">
          <ClaudeStep claude={claude} onChange={onChange} />
          {tools.managed && <ToolsStep tools={tools} onChange={onChange} />}
        </ol>
        <div className="setup-actions">
          <button className="btn btn-primary" disabled={!state.ready} onClick={onDone}>
            Start learning<I.ArrowRight />
          </button>
          {!state.ready && (
            <span className="muted setup-wait">
              {!claude.mode ? "Connect Claude to continue." : !toolsReady ? "Waiting for the video tools." : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHead({ n, done, busy, title }: { n: number; done: boolean; busy?: boolean; title: string }) {
  return (
    <div className="setup-step-head">
      <span className={`num ${done ? "done" : ""}`}>{done ? <I.Check size={12} /> : busy ? <I.Spinner size={12} /> : n}</span>
      <h2>{title}</h2>
    </div>
  );
}

function ClaudeStep({ claude, onChange }: { claude: Desktop["claude"]; onChange: () => void }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"key" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const desktop = window.stoaDesktop;

  const check = async () => {
    setBusy("check");
    setError(null);
    try { await api.checkClaude(); onChange(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
  };
  const saveKey = async () => {
    if (!desktop || !key.trim()) return;
    setBusy("key");
    setError(null);
    const res = await desktop.setApiKey(key.trim()).catch((e) => ({ ok: false, error: String(e) }));
    setBusy(null);
    if (!res.ok) return setError(res.error ?? "The key was not saved.");
    setKey("");
    onChange();
  };
  const removeKey = async () => {
    await desktop?.clearApiKey();
    onChange();
  };

  return (
    <li className="setup-step">
      <StepHead n={1} done={!!claude.mode} title="Claude" />
      {claude.mode === "login" && (
        <p className="setup-ok">
          Signed in to Claude{claude.login?.email ? <> as <strong>{claude.login.email}</strong></> : null}
          {claude.login?.plan ? ` (${claude.login.plan})` : ""}. Athena uses this login, so lessons count
          toward that plan's usage.
        </p>
      )}
      {claude.mode === "apiKey" && (
        <p className="setup-ok">
          Stoa uses your Anthropic API key, stored encrypted on this computer. Lessons are billed to that key.{" "}
          <button className="link-btn" onClick={removeKey}>Remove key</button>
        </p>
      )}
      {!claude.mode && (
        <div className="setup-body">
          <p>
            Stoa found no Claude login on this computer. If you use Claude Code, sign in there: run{" "}
            <code>claude</code> in a terminal, type <code>/login</code>, then check again.
          </p>
          <button className="btn btn-secondary" onClick={check} disabled={!!busy}>
            {busy === "check" ? <><I.Spinner size={14} />Checking</> : "Check again"}
          </button>
          <p className="setup-or">Or use an API key from the Claude Console.</p>
          <form className="key-form" onSubmit={(e) => { e.preventDefault(); saveKey(); }}>
            <input type="password" className="field" placeholder="sk-ant-…" value={key} autoComplete="off" spellCheck={false}
              aria-label="Anthropic API key" onChange={(e) => setKey(e.target.value)} disabled={!!busy || !desktop} />
            <button className="btn btn-primary" type="submit" disabled={!key.trim() || !!busy || !desktop}>
              {busy === "key" ? <><I.Spinner size={14} />Checking key</> : "Use this key"}
            </button>
          </form>
          <p className="muted setup-note">
            Get a key at <a className="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
            Use with an API key is billed by Anthropic; one lesson with a video cost about US$3.70 in testing.
          </p>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}

function ToolsStep({ tools, onChange }: { tools: Extract<Desktop["tools"], { managed: true }>; onChange: () => void }) {
  const total = tools.steps.reduce((n, s) => n + (s.total ?? 0), 0);
  const done = tools.steps.reduce((n, s) => n + (s.status === "done" ? s.total ?? 0 : Math.min(s.bytes, s.total ?? s.bytes)), 0);
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const retry = () => api.installTools().then(onChange).catch(onChange);
  return (
    <li className="setup-step">
      <StepHead n={2} done={tools.ready} busy={tools.installing} title="Video tools" />
      {!tools.supported ? (
        <p className="error">Video tools are not available for this computer ({tools.platform}) yet.</p>
      ) : tools.ready ? (
        <p className="setup-ok">Installed. Athena can make narrated videos for your lessons.</p>
      ) : (
        <div className="setup-body">
          <p>
            Stoa downloads a voice, a speech-timing model, a video renderer and an encoder, about {mb(total)} in
            all. You need to do this once. You can leave this window open while it works.
          </p>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Video tools download">
            <i style={{ width: `${pct}%` }} />
          </div>
          <ul className="tool-list">
            {tools.steps.map((s) => <ToolRow key={s.id} step={s} />)}
          </ul>
          {tools.error && !tools.installing && (
            <div className="setup-error" role="alert">
              <p>{tools.error}</p>
              <div className="setup-error-actions">
                <button className="btn btn-secondary" onClick={retry}>Try again</button>
                {window.stoaDesktop && <button className="link-btn" onClick={() => window.stoaDesktop?.openLogs()}>Open logs</button>}
              </div>
            </div>
          )}
          {!tools.whisper && <p className="error">This copy of Stoa is missing its speech-timing program. Reinstall the app.</p>}
        </div>
      )}
    </li>
  );
}

function ToolRow({ step }: { step: SetupStep }) {
  const icon = step.status === "done" ? <I.Check size={14} /> : step.status === "running" ? <I.Spinner size={14} /> : step.status === "error" ? <span className="tool-x">!</span> : <span className="tool-dot" />;
  const detail = step.status === "done" ? "Done"
    : step.status === "running" ? (step.bytes > 0 ? (step.total ? `${mb(step.bytes)} of ${mb(step.total)}` : mb(step.bytes)) : "Starting")
    : step.status === "error" ? "Failed"
    : step.total ? mb(step.total) : "";
  return (
    <li className={`tool ${step.status}`}>
      <span className="tool-icon">{icon}</span>
      <span className="tool-name">{step.label}</span>
      <span className="tool-meta">{detail}</span>
    </li>
  );
}

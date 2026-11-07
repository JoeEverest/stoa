import { useEffect, useRef, useState } from "react";
import { api, type SetupState } from "./api";
import * as I from "./icons";

type Desktop = Extract<SetupState, { desktop: true }>;
type KeyInfo = { set: boolean; last4: string | null };

/** Sidebar button and dialog for app settings. Desktop app only (the browser version has none). */
export function SettingsButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  if (!window.stoaDesktop) return null;
  return (
    <>
      <button className="rail-icon-btn" aria-label="Settings" title="Settings"
        onClick={() => { setOpen(true); dialog.current?.showModal(); }}><I.Settings /></button>
      <dialog ref={dialog} className="confirm settings" aria-labelledby="settings-title" onClose={() => setOpen(false)}>
        {open && <SettingsBody onClose={() => dialog.current?.close()} />}
      </dialog>
    </>
  );
}

function SettingsBody({ onClose }: { onClose: () => void }) {
  const desktop = window.stoaDesktop!;
  const [state, setState] = useState<Desktop | null>(null);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"load" | "key" | "remove" | null>("load");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Look again for a Claude Code login (the learner may have signed in or out since setup). */
  const load = async () => {
    setBusy("load");
    setError(null);
    try {
      const [s, k] = await Promise.all([api.checkClaude(), desktop.apiKeyInfo()]);
      if (s.desktop) setState(s);
      setKeyInfo(k);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(null);
  };
  useEffect(() => { load(); }, []);

  const saveKey = async () => {
    if (!key.trim()) return;
    setBusy("key");
    setError(null);
    const res = await desktop.setApiKey(key.trim()).catch((e) => ({ ok: false, error: String(e) }));
    if (!res.ok) { setBusy(null); return setError(res.error ?? "The key was not saved."); }
    setKey("");
    setEditing(false);
    setNotice("Stoa now uses this key for new work.");
    await load();
  };
  const removeKey = async () => {
    setBusy("remove");
    setError(null);
    await desktop.clearApiKey();
    setNotice("Key removed. Stoa now uses your Claude login for new work.");
    await load();
  };

  const claude = state?.claude;
  const login = claude?.login;
  const who = login?.email ? <strong>{login.email}</strong> : "your Claude account";
  const plan = login?.plan ? ` (${login.plan})` : "";

  return (
    <>
      <h2 id="settings-title">Settings</h2>
      <section className="settings-section" aria-labelledby="settings-claude">
        <h3 id="settings-claude">Claude</h3>
        {!state || !keyInfo ? (
          <p className="settings-loading"><I.Spinner size={14} />Checking Claude access</p>
        ) : (
          <>
            {claude?.mode === "apiKey" && (
              <p>
                Stoa uses your Anthropic API key{keyInfo.last4 ? <> ending in <code>…{keyInfo.last4}</code></> : null}.
                Lessons are billed to that key.
              </p>
            )}
            {claude?.mode === "login" && (
              <p>Signed in to Claude as {who}{plan}. Lessons count toward that plan's usage.</p>
            )}
            {!claude?.mode && <p>Stoa has no Claude access. Sign in to Claude Code or add an API key.</p>}

            {editing || !claude?.mode ? (
              <form className="key-form" onSubmit={(e) => { e.preventDefault(); saveKey(); }}>
                <input type="password" className="field" placeholder="sk-ant-…" value={key} autoComplete="off" spellCheck={false}
                  aria-label="Anthropic API key" autoFocus onChange={(e) => setKey(e.target.value)} disabled={!!busy} />
                <button className="btn btn-primary" type="submit" disabled={!key.trim() || !!busy}>
                  {busy === "key" ? <><I.Spinner size={14} />Checking key</> : "Use this key"}
                </button>
                {claude?.mode && (
                  <button className="btn btn-secondary" type="button" disabled={!!busy}
                    onClick={() => { setEditing(false); setKey(""); setError(null); }}>Cancel</button>
                )}
              </form>
            ) : (
              <div className="settings-actions">
                <button className="btn btn-secondary" onClick={() => { setEditing(true); setNotice(null); }} disabled={!!busy}>
                  {claude.mode === "apiKey" ? "Replace key" : "Use an API key instead"}
                </button>
                {claude.mode === "apiKey" && (
                  <button className="btn btn-secondary" onClick={removeKey} disabled={!!busy || !login}>
                    {busy === "remove" ? <><I.Spinner size={14} />Removing</> : "Remove key"}
                  </button>
                )}
              </div>
            )}

            {claude?.mode === "apiKey" && !editing && (
              <p className="settings-note">
                {login
                  ? <>If you remove the key, Stoa uses your Claude login ({login.email ?? "found on this computer"}).</>
                  : <>To remove the key, first sign in to Claude Code (run <code>claude</code>, then <code>/login</code>), then check again.</>}
              </p>
            )}
            {editing && (
              <p className="settings-note">
                Get a key at <a className="link" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
                Stoa checks the key with Anthropic before it saves it.
              </p>
            )}
            <p className="settings-note">Work that Athena or the tutor has already started finishes with the access it started with.</p>
          </>
        )}
        {notice && <p className="settings-ok" role="status"><I.Check size={14} />{notice}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      <div className="confirm-actions settings-foot">
        <button className="link-btn settings-recheck" onClick={load} disabled={!!busy}>Check again for a Claude login</button>
        <button className="btn btn-primary" onClick={onClose} autoFocus>Done</button>
      </div>
    </>
  );
}

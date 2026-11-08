import { useEffect, useState, type ReactNode } from "react";
import { api, usePoll, type SetupState } from "./api";
import { CliRow, ConnectionForm } from "./Connection";
import { UpdatesSection } from "./Updates";
import * as I from "./icons";

type Desktop = Extract<SetupState, { desktop: true }>;
type ThemePref = "light" | "dark" | "system";

const mb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.round(n / 1e6)} MB`);

/** The settings page (#/settings): Claude connection and models, Claude Code, video tools, appearance. */
export function SettingsPage({ theme, onTheme, toggle }: { theme: ThemePref; onTheme: (t: ThemePref) => void; toggle: ReactNode }) {
  const setup = usePoll(api.setup, 3000, []);
  const s = setup.data;
  const desktop = s?.desktop ? (s as Desktop) : null;
  const [checking, setChecking] = useState(false);

  // #/settings/updates (the sidebar's update button) opens at the Updates section.
  useEffect(() => {
    if (!location.hash.endsWith("/updates")) return;
    const t = setTimeout(() => document.getElementById("updates")?.scrollIntoView({ block: "start" }), 50);
    return () => clearTimeout(t);
  }, []);

  // Look again for a Claude Code login when the page opens: the learner may have signed in or out.
  useEffect(() => {
    if (!window.stoaDesktop) return;
    setChecking(true);
    api.checkClaude().then(setup.refresh).catch(() => {}).finally(() => setChecking(false));
  }, []);

  return (
    <div className="settings-page">
      <header className="settings-top">
        {toggle && <span className="topbar-toggle">{toggle}</span>}
        <h1>Settings</h1>
      </header>
      <div className="settings-inner">
        <section className="settings-chapter" aria-labelledby="set-claude">
          <div className="settings-chapter-head">
            <h2 id="set-claude">Claude</h2>
            <p>Where Athena and the tutor send their work, and which models they use. Changes apply to new work; work already started finishes as it began.</p>
          </div>
          <div className="settings-chapter-body">
          {!s ? <p className="settings-loading"><I.Spinner size={14} />Loading</p> : (
            <>
              {desktop && <AccessBadge claude={desktop.claude} checking={checking} />}
              <ConnectionForm claude={desktop?.claude ?? null} cli={desktop?.cli ?? null} onSaved={setup.refresh} />
            </>
          )}
          </div>
        </section>

        {window.stoaDesktop?.updates && (
          <section className="settings-chapter" aria-labelledby="set-updates" id="updates">
            <div className="settings-chapter-head">
              <h2 id="set-updates">Updates</h2>
              <p>New versions come from Stoa's GitHub releases. Each download is checked against its published checksum before it installs.</p>
            </div>
            <div className="settings-chapter-body">
              <UpdatesSection />
            </div>
          </section>
        )}

        {desktop && (
          <section className="settings-chapter" aria-labelledby="set-cli">
            <div className="settings-chapter-head">
              <h2 id="set-cli">Claude Code</h2>
              <p>Used to sign in to your Claude account. Stoa's agents run on their own copy, so updates here do not change lessons.</p>
            </div>
            <div className="settings-chapter-body">
            <CliRow cli={desktop.cli} onChange={setup.refresh} />
            {window.stoaDesktop && (
              <button className="link-btn settings-logs" onClick={() => window.stoaDesktop?.openLogs()}>Open the logs folder</button>
            )}
            </div>
          </section>
        )}

        {desktop?.tools.managed && (
          <section className="settings-chapter" aria-labelledby="set-tools">
            <div className="settings-chapter-head">
              <h2 id="set-tools">Video tools</h2>
              <p>The voice, speech timing model, renderer and encoder Athena uses for lesson videos.</p>
            </div>
            <div className="settings-chapter-body">
            <ToolsSummary tools={desktop.tools} onChange={setup.refresh} />
            </div>
          </section>
        )}

        <section className="settings-chapter" aria-labelledby="set-look">
          <div className="settings-chapter-head">
            <h2 id="set-look">Appearance</h2>
            <p>Lessons follow the app's theme.</p>
          </div>
          <div className="settings-chapter-body">
          <div className="segctl segctl-small" role="radiogroup" aria-label="Theme">
            {([["light", "Light", <I.Sun key="s" />], ["dark", "Dark", <I.Moon key="m" />], ["system", "Match system", <I.Monitor key="c" />]] as const).map(([id, label, icon]) => (
              <button key={id} type="button" role="radio" aria-checked={theme === id} className={theme === id ? "on" : ""} onClick={() => onTheme(id)}>
                <span className="segctl-label">{icon}{label}</span>
              </button>
            ))}
          </div>
          </div>
        </section>
      </div>
    </div>
  );
}

const ACCESS: Record<string, string> = {
  login: "Claude login", apiKey: "Anthropic API key", custom: "Custom endpoint", bedrock: "Amazon Bedrock",
};

function AccessBadge({ claude, checking }: { claude: Desktop["claude"]; checking: boolean }) {
  return (
    <p className={`access-badge ${claude.mode ? "on" : "off"}`}>
      <span className="access-dot" aria-hidden="true" />
      {claude.mode ? <>Connected through <strong>{ACCESS[claude.mode]}</strong></> : "Not connected. Lessons cannot start until Claude is set up."}
      {checking && <I.Spinner size={12} />}
    </p>
  );
}

function ToolsSummary({ tools, onChange }: { tools: Extract<Desktop["tools"], { managed: true }>; onChange: () => void }) {
  const total = tools.steps.reduce((n, s) => n + (s.total ?? 0), 0);
  const repair = () => api.installTools().then(onChange).catch(onChange);
  if (!tools.supported) return <p className="error">Video tools are not available for this computer ({tools.platform}) yet.</p>;
  if (tools.installing) return <p className="settings-loading"><I.Spinner size={14} />Installing</p>;
  return (
    <div className="setup-body">
      {tools.ready
        ? <p className="setup-ok"><I.Check size={14} /> Installed, about {mb(total)}.</p>
        : <p>{tools.error ?? "Some video tools are missing."}</p>}
      <button className="btn btn-secondary" onClick={repair}>{tools.ready ? "Check and repair" : "Install"}</button>
    </div>
  );
}

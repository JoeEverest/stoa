import { useEffect, useState } from "react";
import { api } from "./api";
import * as I from "./icons";

/** The desktop app's update status, kept current by the main process (desktop/updater.ts). */
export function useUpdates() {
  const u = window.stoaDesktop?.updates;
  const [status, setStatus] = useState<StoaUpdateStatus | null>(null);
  useEffect(() => {
    if (!u) return;
    let alive = true;
    u.status().then((s) => alive && setStatus(s)).catch(() => {});
    const off = u.onStatus((s) => setStatus({ ...s }));
    return () => { alive = false; off(); };
  }, []);
  return status;
}

/**
 * Release notes as plain text. They come from the network, so they are never rendered as HTML here:
 * headings lose their #, list markers become bullets, links and emphasis keep only their text.
 */
function plainNotes(md: string) {
  return md
    .replace(/\r/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)(.+?)\1/g, "$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const mb = (n: number) => `${Math.max(1, Math.round(n / 1e6))} MB`;
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

/** Restart into the new version. Asks once more when Athena or the tutor is working, since a restart stops them. */
function useRestart() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const restart = async () => {
    setError(null);
    if (!confirming) {
      const topics = await api.topics().catch(() => []);
      if (topics.some((t) => t.busy)) { setConfirming(true); return; }
    }
    setBusy(true);
    const res = await window.stoaDesktop!.updates.install();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "The update could not be installed.");
  };
  return { restart, confirming, cancel: () => setConfirming(false), error, busy };
}

export function UpdatesSection() {
  const s = useUpdates();
  const u = window.stoaDesktop?.updates;
  const r = useRestart();
  if (!u || !s) return null;
  const v = s.latest?.version;
  const notes = s.latest ? plainNotes(s.latest.notes) : "";

  return (
    <div className="updates">
      <p className="updates-current">
        You have Stoa <strong>{s.current}</strong>.{s.state === "none" && " This is the latest version."}
        {s.state === "checking" && <span className="updates-checking"><I.Spinner size={12} />Checking for updates</span>}
      </p>

      {(s.state === "available" || s.state === "downloading" || s.state === "ready") && v && (
        <div className="update-card">
          <div className="update-head">
            <span className="update-dot" aria-hidden="true" />
            <strong>Stoa {v}</strong>
            {s.latest?.publishedAt && <span className="muted">· {when(s.latest.publishedAt)}</span>}
          </div>
          {notes && <p className="update-notes">{notes.length > 600 ? notes.slice(0, 600).trimEnd() + "…" : notes}</p>}

          {s.state === "downloading" && s.progress && (
            <div className="update-progress">
              <div className="meter" role="progressbar" aria-label="Update download" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round((s.progress.bytes / s.progress.total) * 100)}>
                <i style={{ width: `${(s.progress.bytes / s.progress.total) * 100}%` }} />
              </div>
              <span className="muted">Downloading · {mb(s.progress.bytes)} of {mb(s.progress.total)}</span>
            </div>
          )}

          <div className="settings-actions">
            {s.state === "ready" && !r.confirming && (
              <button className="btn btn-primary" onClick={r.restart} disabled={r.busy}>
                {s.kind === "deb" ? "Install update" : "Restart to update"}
              </button>
            )}
            {s.state === "ready" && r.confirming && (
              <>
                <button className="btn btn-primary" onClick={r.restart} disabled={r.busy}>Restart anyway</button>
                <button className="btn btn-secondary" onClick={r.cancel}>Not now</button>
              </>
            )}
            {s.state === "available" && !s.blocked && !s.error && (
              <button className="btn btn-primary" onClick={() => u.download()}>Download {s.latest?.size ? `(${mb(s.latest.size)})` : ""}</button>
            )}
            {(s.blocked || s.error) && s.state !== "downloading" && (
              <button className="btn btn-secondary" onClick={() => u.openReleasePage()}>Open the release page</button>
            )}
            <button className="link-btn" onClick={() => u.openReleasePage()}>Release notes</button>
          </div>
          {r.confirming && <p className="settings-note">Athena is working. Restarting stops that work, and you can start it again after the update.</p>}
          {s.state === "ready" && s.kind === "deb" && <p className="settings-note">Opens the package in your software installer, which asks for an admin password.</p>}
          {s.state === "ready" && s.kind !== "deb" && !r.confirming && <p className="settings-note">Stoa closes, installs the update and opens again. Your topics and lessons stay as they are.</p>}
        </div>
      )}

      {s.blocked && <p className="settings-note">{s.blocked}</p>}
      {s.error && <p className="error" role="alert">{s.error}</p>}
      {r.error && <p className="error" role="alert">{r.error}</p>}

      <div className="settings-actions">
        <button className="btn btn-secondary" onClick={() => u.check()} disabled={s.state === "checking" || s.state === "downloading"}>
          Check for updates
        </button>
        <label className="toggle">
          <input type="checkbox" checked={s.auto} onChange={(e) => u.setAuto(e.target.checked)} />
          Download updates automatically
        </label>
      </div>
      {s.checkedAt && <p className="settings-note">Last checked {new Date(s.checkedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.</p>}
    </div>
  );
}

/** A quiet line above the sidebar's foot when an update is ready (or available to download). */
export function RailUpdateNotice() {
  const s = useUpdates();
  if (!s?.latest || !(s.state === "ready" || (s.state === "available" && !s.auto))) return null;
  return (
    <a className="rail-update" href="#/settings" title={`Stoa ${s.latest.version} is ${s.state === "ready" ? "ready to install" : "available"}`}>
      <span className="update-dot" aria-hidden="true" />
      <span className="btn-label">{s.state === "ready" ? `Restart to update to ${s.latest.version}` : `Stoa ${s.latest.version} is available`}</span>
    </a>
  );
}

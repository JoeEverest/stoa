// The learner's own files: lecture notes, slides, textbooks. Athena reads them and teaches from them.
import React, { useRef, useState } from "react";
import { api, usePoll, type Upload } from "./api";
import * as I from "./icons";

export const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif";
const OK = /\.(pdf|docx|pptx|txt|md|csv|png|jpe?g|webp|gif)$/i;
const EXPORT_FIRST = /\.(doc|ppt|key|pages|odt|odp|epub|rtf)$/i;
/** Files the app can show in its frame. Word and PowerPoint files are only listed. */
export const VIEWABLE = /\.(pdf|png|jpe?g|webp|gif|txt|md|csv)$/i;
const MAX = 500 * 1024 * 1024;

/** Why a file can not be added, or null. Same rules as the server, so most problems show at once. */
export function fileProblem(f: File) {
  if (EXPORT_FIRST.test(f.name)) return `Save “${f.name}” as a PDF, then add the PDF.`;
  if (!OK.test(f.name)) return `Stoa can not read “${f.name}”. Add a PDF, Word, PowerPoint, text or image file.`;
  if (f.size > MAX) return `“${f.name}” is larger than 500 MB.`;
  if (f.size === 0) return `“${f.name}” is empty.`;
  return null;
}

export const sizeLabel = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** A button that opens the file picker. */
export function AttachButton({ onFiles, label = "Attach files", className = "btn btn-secondary", disabled, icon = <I.Paperclip /> }: {
  onFiles: (files: File[]) => void; label?: React.ReactNode; className?: string; disabled?: boolean; icon?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()} disabled={disabled}>
        {icon}{label}
      </button>
      <input ref={input} type="file" multiple accept={ACCEPT} hidden
        onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; if (files.length) onFiles(files); }} />
    </>
  );
}

/** Props that make an element a drop target for files. `over` is true while files are dragged over it. */
export function useDropFiles(onFiles: (files: File[]) => void) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files");
  return {
    over,
    props: {
      onDragEnter: (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setOver(true); },
      onDragOver: (e: React.DragEvent) => { if (hasFiles(e)) e.preventDefault(); },
      onDragLeave: () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); },
      onDrop: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      },
    },
  };
}

/** A topic's uploads: the list, plus adding (one file at a time) and removing. */
export function useUploads(topicId: string) {
  const list = usePoll(() => api.uploads(topicId), 5000, [topicId]);
  const [queue, setQueue] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const add = async (files: File[]) => {
    const problems = files.map(fileProblem).filter(Boolean) as string[];
    const good = files.filter((f) => !fileProblem(f));
    setErrors(problems);
    setQueue((q) => [...q, ...good.map((f) => f.name)]);
    let added = 0, steered = false;
    for (const f of good) {
      try {
        steered = (await api.upload(topicId, f)).steered || steered;
        added++;
      } catch (e) {
        problems.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
        setErrors([...problems]);
      }
      setQueue((q) => q.slice(1));
      list.refresh();
    }
    return { added, steered };
  };
  const remove = async (u: Upload) => {
    await api.deleteUpload(topicId, u.id);
    list.refresh();
  };
  return { uploads: list.data ?? [], queue, errors, add, remove, clearErrors: () => setErrors([]) };
}

type Uploads = ReturnType<typeof useUploads>;

function status(u: Upload, working: boolean) {
  if (u.problem) return { text: u.problem, tone: "bad" as const };
  if (!u.read_at) return { text: working ? "New. Athena got it while she works." : "New. Athena reads it for the next lesson.", tone: "new" as const };
  return { text: u.summary || "Read by Athena", tone: "read" as const };
}

/** A remove button that asks once: the first click arms it, the second removes. */
function RemoveButton({ name, onRemove }: { name: string; onRemove: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (armed) {
    return (
      <button type="button" className="mat-remove armed" autoFocus onBlur={() => !busy && setArmed(false)}
        onClick={async () => { setBusy(true); try { await onRemove(); } finally { setBusy(false); setArmed(false); } }}>
        {busy ? <I.Spinner size={12} /> : "Remove"}
      </button>
    );
  }
  return (
    <button type="button" className="mat-remove" aria-label={`Remove ${name}`} title="Remove" onClick={() => setArmed(true)}>
      <I.X size={14} />
    </button>
  );
}

/** The "Your course files" section of the classroom outline. */
export function MaterialsList({ u, hrefFor, current, onPick, onAdded, working }: {
  u: Uploads; hrefFor: (file: string) => string; working: boolean; current: string | null; onPick: () => void; onAdded: (n: number, steered: boolean) => void;
}) {
  const add = async (files: File[]) => { const r = await u.add(files); if (r.added) onAdded(r.added, r.steered); };
  const drop = useDropFiles(add);
  return (
    <div className={`refs materials ${drop.over ? "drop-over" : ""}`} {...drop.props}>
      <div className="col-head">
        <span>Your course files</span>
        {u.uploads.length > 0 && <AttachButton onFiles={add} label="Add" className="col-action" icon={<I.Plus />} />}
      </div>
      {u.uploads.map((m) => {
        const s = status(m, working);
        const body = (
          <>
            <I.Paperclip />
            <span className="mat-text">
              <FileName name={m.name} max={16} />
              <span className={`mat-meta ${s.tone}`} title={s.text}>{s.text}</span>
            </span>
          </>
        );
        return (
          <div key={m.id} className="mat">
            {VIEWABLE.test(m.file)
              ? <a className="ref" href={hrefFor(m.file)} aria-current={current === m.file ? "page" : undefined} onClick={onPick} title={m.name}>{body}</a>
              : <div className="ref" title={`${m.name} (shown to Athena as text)`}>{body}</div>}
            <RemoveButton name={m.name} onRemove={() => u.remove(m)} />
          </div>
        );
      })}
      {u.queue.map((name, i) => (
        <div key={`${name}-${i}`} className="ref mat-uploading" role="status">
          <I.Spinner size={14} />
          <span className="mat-text"><span className="mat-name">{name}</span><span className="mat-meta new">Adding</span></span>
        </div>
      ))}
      {u.uploads.length === 0 && u.queue.length === 0 && (
        <AttachButton onFiles={add} className="mat-empty"
          label={<span className="mat-empty-text"><strong>Add course files</strong><span>Lecture notes, slides or a textbook. Athena teaches from them.</span></span>} />
      )}
      {u.errors.map((e) => <p key={e} className="mat-error" role="alert">{e}</p>)}
    </div>
  );
}

/** A file name cut to about `max` characters, keeping the extension ("PHYS101-lectu….pdf"). CSS still clips as a fallback. */
export function FileName({ name, className = "mat-name", max = 24 }: { name: string; className?: string; max?: number }) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  // Cut the middle: keep the start, the last few characters of the name and the extension ("PHYS101-…ure-4.pdf").
  const keepEnd = Math.min(3, Math.max(0, name.length - ext.length - 4));
  const stem = name.slice(0, name.length - ext.length);
  const head = Math.max(4, max - 1 - keepEnd - ext.length);
  const short = name.length <= max ? name : stem.slice(0, head) + "…" + stem.slice(stem.length - keepEnd) + ext;
  return <span className={`${className} fname`} title={name}>{short}</span>;
}

/** Small file chips, for the intake chat and the new-topic page. */
export function FileChips({ items }: {
  items: { key: string; name: string; meta?: string; busy?: boolean; onRemove?: () => Promise<void> | void }[];
}) {
  if (!items.length) return null;
  return (
    <ul className="chips" aria-label="Attached files">
      {items.map((c) => (
        <li key={c.key} className="chip" title={c.meta ? `${c.name}: ${c.meta}` : c.name}>
          {c.busy ? <I.Spinner size={12} /> : <I.Doc size={14} />}
          <FileName name={c.name} className="chip-name" />
          {c.meta && <span className="chip-meta">{c.meta}</span>}
          {c.onRemove && (
            <button type="button" className="chip-x" aria-label={`Remove ${c.name}`} onClick={() => c.onRemove?.()}><I.X size={12} /></button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Chips for a topic's uploads (intake chat). */
export function uploadChips(u: Uploads) {
  return [
    ...u.uploads.map((m) => ({
      key: String(m.id), name: m.name,
      meta: m.problem ? "Could not read" : m.read_at ? "Read by Athena" : sizeLabel(m.size),
      onRemove: () => u.remove(m),
    })),
    ...u.queue.map((name, i) => ({ key: `q-${i}-${name}`, name, meta: "Adding", busy: true })),
  ];
}

import React, { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { api, useArrivals, usePoll, useThread, type Lesson, type Message, type Topic, type TopicState } from "./api";
import * as I from "./icons";

// ---- Routing: #/ (new topic), #/t/<topic>, #/t/<topic>/<lesson-id | ref:reference/x.html> ----

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const parts = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  return parts[0] === "t" ? { topicId: parts[1] ?? null, view: parts.slice(2).join("/") || null } : { topicId: null, view: null };
}
const topicHref = (topicId: string, view?: string) =>
  `#/t/${encodeURIComponent(topicId)}${view ? `/${encodeURIComponent(view)}` : ""}`;
const go = (topicId?: string, view?: string) => { location.hash = topicId ? topicHref(topicId, view).slice(1) : "/"; };

// ---- Theme: light by default; dark or system only when the user chooses it ----

type ThemePref = "light" | "dark" | "system";
function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try { return (localStorage.getItem("stoa-theme") as ThemePref) || "light"; } catch { return "light"; }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && media.matches);
      document.documentElement.toggleAttribute("data-theme", dark);
      if (dark) document.documentElement.setAttribute("data-theme", "dark");
    };
    apply();
    try { localStorage.setItem("stoa-theme", pref); } catch { /* private mode: theme still applies */ }
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [pref]);
  return [pref, setPref] as const;
}

export function App() {
  const { topicId, view } = useHash();
  const topics = usePoll(api.topics, 4000, []);
  const [theme, setTheme] = useTheme();
  return (
    <div className="shell">
      <aside className="rail" aria-label="Topics">
        <div className="brand"><I.Mark /><span>Stoa</span></div>
        <a className="btn btn-secondary new-topic" href="#/"><I.Plus />New topic</a>
        <div className="rail-label" id="topics-label">Topics</div>
        <nav className="topic-list" aria-labelledby="topics-label">
          {topics.data?.length === 0 && <p className="rail-empty">Your topics appear here.</p>}
          {topics.data?.map((t) => <TopicLink key={t.id} topic={t} active={t.id === topicId} />)}
        </nav>
        <ThemeSwitch value={theme} onChange={setTheme} />
      </aside>
      <main className="main">
        {topicId
          ? <TopicView key={topicId} topicId={topicId} view={view} onChange={topics.refresh} />
          : <NewTopic onCreated={topics.refresh} />}
      </main>
    </div>
  );
}

function TopicLink({ topic, active }: { topic: Topic; active: boolean }) {
  const meta = topic.busy
    ? topic.phase === "intake" ? "Athena is replying" : "Athena is working"
    : topic.phase === "intake" ? "Getting started"
    : topic.lessonCount ? `${topic.doneCount ?? 0} of ${topic.lessonCount} lessons done` : "First lesson coming";
  return (
    <a href={topicHref(topic.id)} className={`topic ${topic.busy ? "busy" : ""}`} aria-current={active ? "page" : undefined}>
      <span className="topic-icon">{topic.busy ? <I.Spinner size={14} /> : <span className="topic-dot" />}</span>
      <span className="topic-name">{topic.title}</span>
      <span className="topic-meta">{meta}</span>
    </a>
  );
}

function ThemeSwitch({ value, onChange }: { value: ThemePref; onChange: (v: ThemePref) => void }) {
  const opts: [ThemePref, string, React.ReactNode][] = [
    ["light", "Light", <I.Sun />], ["dark", "Dark", <I.Moon />], ["system", "Match system", <I.Monitor />],
  ];
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance">
      {opts.map(([v, label, icon]) => (
        <button key={v} role="radio" aria-checked={value === v} title={label} aria-label={label}
          className={value === v ? "on" : ""} onClick={() => onChange(v)}>{icon}</button>
      ))}
    </div>
  );
}

// ---- New topic ----

const EXAMPLES = [
  "Program an ESP32 to read a temperature sensor and send the values to my home server",
  "Understand projectile motion well enough to write a program that draws a trajectory",
  "Speak enough Spanish to get around on a two-week trip to Mexico",
];

function NewTopic({ onCreated }: { onCreated: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { id } = await api.createTopic(text);
      onCreated();
      go(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div className="new-topic-page">
      <div className="new-topic-inner">
        <h1>What do you want to learn?</h1>
        <p className="lead">
          Say what you want to be able to do. Athena asks a few questions about your goal, then builds
          your first lesson: reading, a narrated video and exercises.
        </p>
        <Composer value={text} onChange={setText} onSend={start} disabled={busy} rows={3} autoFocus
          placeholder="I want to learn…" sendLabel={busy ? "Starting" : "Start"} big />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="examples">
          <span className="examples-label">Or start from an example</span>
          {EXAMPLES.map((e) => (
            <button key={e} className="example" onClick={() => setText(e)}>{e}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Topic ----

function TopicView({ topicId, view, onChange }: { topicId: string; view: string | null; onChange: () => void }) {
  const state = usePoll(() => api.topic(topicId), 2500, [topicId]);
  const s = state.data;
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    if (s && prevPhase.current && prevPhase.current !== s.topic.phase) onChange();
    if (s) prevPhase.current = s.topic.phase;
  }, [s?.topic.phase]);

  if (state.error && !s) return <div className="center"><p className="error" role="alert">{state.error}</p></div>;
  if (!s) return <div className="center"><I.Spinner label="Loading" /></div>;
  const menu = <TopicMenu topic={s.topic} onDeleted={() => { onChange(); go(); }} />;
  if (s.topic.phase === "intake") return <IntakeChat state={s} onSent={state.refresh} menu={menu} />;
  return <Classroom state={s} view={view} refresh={state.refresh} menu={menu} />;
}

function IntakeChat({ state, onSent, menu }: { state: TopicState; onSent: () => void; menu: React.ReactNode }) {
  const { topic, busy, lastError } = state;
  const thread = useThread((after) => api.messages(topic.id, after), 1500, topic.id);
  const [text, setText] = useState("");
  const send = async () => {
    if (!text.trim() || busy) return;
    const t = text;
    setText("");
    await api.sendIntake(topic.id, t);
    thread.refresh();
    onSent();
  };
  return (
    <div className="intake">
      <header className="topbar">
        <div className="topbar-title">
          <h1>{topic.title}</h1>
          <p className="status">Athena is getting to know your goal. The first lesson starts after this chat.</p>
        </div>
        <div className="topbar-actions">{menu}</div>
      </header>
      <ChatLog messages={thread.messages} baseline={thread.baseline} typing={busy} who="Athena" />
      <div className="chat-dock">
        {lastError && !busy && <p className="error" role="alert">Athena stopped: {lastError}. Send a message to try again.</p>}
        <Composer value={text} onChange={setText} onSend={send} disabled={busy} autoFocus
          placeholder={busy ? "Athena is writing…" : "Reply to Athena"} sendLabel="Send" />
      </div>
    </div>
  );
}

function Classroom({ state, view, refresh, menu }: {
  state: TopicState; view: string | null; refresh: () => void; menu: React.ReactNode;
}) {
  const { topic, lessons, building, lastError } = state;
  const refs = usePoll(() => api.references(topic.id), 8000, [topic.id]);
  const [tutorOpen, setTutorOpen] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Default view: the oldest lesson that is not finished, else the newest lesson.
  const current = view ?? (lessons.find((l) => !l.completed_at) ?? lessons.at(-1))?.id ?? null;
  const lesson = lessons.find((l) => l.id === current) ?? null;
  const refFile = current?.startsWith("ref:") ? current.slice(4) : null;
  const src = lesson ? `/w/${topic.id}/${lesson.file}` : refFile ? `/w/${topic.id}/${refFile}` : null;
  const doneCount = lessons.filter((l) => l.completed_at).length;
  const buildingNext = state.buildingNew;
  const makingVideo = building && !buildingNext && lessons.at(-1)?.video_status === "planned";
  // A lesson that Athena is building counts in every total, so the bar, the status and the switcher agree.
  const total = lessons.length + (buildingNext ? 1 : 0);
  const arrivals = useArrivals(lessons.map((l) => l.id), lessons.filter((l) => l.completed_at).map((l) => l.id));

  // Lesson pages report submit/complete through postMessage; refresh state when they do.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.source !== "learn") return;
      refresh();
      if (e.data.type === "complete") flash("Lesson finished. Athena is preparing the next one.");
    };
    addEventListener("message", on);
    return () => removeEventListener("message", on);
  }, []);

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  };
  const next = async () => {
    const { queued } = await api.next(topic.id);
    flash(queued ? "Athena started the next lesson." : "Athena is already building a lesson.");
    refresh();
  };

  return (
    <div className="classroom">
      <header className="topbar">
        <div className="topbar-title">
          <h1>{topic.title}</h1>
          <div className="status">
            <ProgressBar lessons={lessons} building={buildingNext} />
            <span className="status-text" aria-live="polite">
              {lessons.length > 0 && <span>{doneCount} of {total} done</span>}
              {building
                ? <span className="status-athena">Athena: {topic.status_message ?? "working on the next lesson"}</span>
                : lastError ? <span className="error-text">Athena stopped: {lastError}</span>
                : !lessons.length && topic.status_message ? <span>{topic.status_message}</span> : null}
            </span>
            {building && <button className="link-btn" onClick={() => api.stop(topic.id).then(refresh)}>Stop</button>}
          </div>
        </div>
        <div className="topbar-actions">
          {lesson && (
            <button className="btn btn-secondary" onClick={() => setTutorOpen((o) => !o)} aria-pressed={tutorOpen}>
              <I.PanelRight />{tutorOpen ? "Hide tutor" : "Show tutor"}
            </button>
          )}
          {building
            ? <span className="btn btn-secondary is-waiting" role="status"><I.Spinner size={14} />{buildingNext ? "Next lesson in progress" : makingVideo ? "Video in progress" : "Athena is finishing up"}</span>
            : <button className="btn btn-primary" onClick={next} disabled={!lessons.length}>Next lesson<I.ArrowRight /></button>}
          {menu}
        </div>
      </header>
      <div className={`workspace ${lesson && tutorOpen ? "with-tutor" : ""}`}>
        <nav className={`outline ${outlineOpen ? "open" : ""}`} aria-label="Lessons and references">
          <button className="outline-toggle" aria-expanded={outlineOpen} onClick={() => setOutlineOpen((o) => !o)}>
            <span className="outline-toggle-text">
              <span className="muted">{lesson ? `Lesson ${lessons.indexOf(lesson) + 1} of ${total}` : refFile ? "Reference" : "Lessons"}</span>
              <span className="outline-toggle-title">{lesson?.title ?? refs.data?.find((r) => r.file === refFile)?.title ?? "Your first lesson"}</span>
            </span>
            <I.Chevron className="outline-chevron" />
          </button>
          <div className="col-head"><span>Lessons</span>{lessons.length > 0 && <span>{lessons.length} ready</span>}</div>
          <ol className="lesson-list">
            {lessons.map((l, i) => (
              <LessonItem key={l.id} lesson={l} n={i + 1} active={l.id === current} topicId={topic.id} onPick={() => setOutlineOpen(false)}
                fresh={arrivals.fresh.has(l.id)} justDone={arrivals.justDone.has(l.id)} />
            ))}
            {buildingNext && (
              <li className="li building" aria-live="polite">
                <span className="num"><I.Spinner size={14} /></span>
                <span className="li-name">{lessons.length ? `Lesson ${lessons.length + 1}` : "Your first lesson"}</span>
                <span className="li-meta">{topic.status_message ?? "Athena is working"}</span>
              </li>
            )}
          </ol>
          {!!refs.data?.length && (
            <div className="refs">
              <div className="col-head"><span>Reference</span></div>
              {refs.data.map((r) => (
                <a key={r.file} className="ref" aria-current={refFile === r.file ? "page" : undefined}
                  href={topicHref(topic.id, `ref:${r.file}`)} onClick={() => setOutlineOpen(false)}><I.Doc />{r.title}</a>
              ))}
            </div>
          )}
        </nav>
        <section className="stage" aria-label={lesson?.title ?? "Lesson"}>
          {src ? <iframe key={src} src={src} title={lesson?.title ?? "Reference"} />
            : <BuildingPlaceholder topicId={topic.id} message={topic.status_message} />}
        </section>
        {lesson && tutorOpen && <Tutor key={lesson.id} topicId={topic.id} lesson={lesson} busy={state.tutorBusy.includes(lesson.id)} />}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/** One segment per lesson: done, current, being built. No invented fractions. */
function ProgressBar({ lessons, building }: { lessons: Lesson[]; building: boolean }) {
  if (!lessons.length && !building) return null;
  const firstOpen = lessons.findIndex((l) => !l.completed_at);
  return (
    <span className="segbar" aria-hidden="true">
      {lessons.map((l, i) => (
        <span key={l.id} className={`seg ${l.completed_at ? "done" : i === firstOpen ? "current" : ""}`}><i /></span>
      ))}
      {building && <span className="seg building" />}
    </span>
  );
}

function LessonItem({ lesson, n, active, topicId, fresh, justDone, onPick }: {
  lesson: Lesson; n: number; active: boolean; topicId: string; fresh: boolean; justDone: boolean; onPick: () => void;
}) {
  const r = lesson.responses;
  const done = !!lesson.completed_at;
  return (
    <li>
      <a className={`li ${done ? "done" : ""} ${fresh ? "fresh" : ""} ${justDone ? "just-done" : ""}`} aria-current={active ? "page" : undefined} href={topicHref(topicId, lesson.id)} onClick={onPick}>
        <span className="num">{done ? <I.Check size={12} /> : n}</span>
        <span className="li-name">{lesson.title}</span>
        <span className="li-meta">
          {r.graded > 0 && <span>{r.right}/{r.graded} correct</span>}
          {lesson.video_status === "ready" && <span><I.Video size={14} />Video</span>}
          {lesson.video_status === "planned" && <span className="li-pending"><I.Spinner size={12} />Video in progress</span>}
          {lesson.video_status === "failed" && <span>No video</span>}
        </span>
      </a>
    </li>
  );
}

function BuildingPlaceholder({ topicId, message }: { topicId: string; message: string | null }) {
  const thread = useThread((after) => api.messages(topicId, after), 3000, topicId);
  const notes = thread.messages.filter((m) => m.role !== "user").slice(-5);
  return (
    <div className="building-page">
      <div className="building-head">
        <I.Spinner size={18} />
        <div>
          <h2>Athena is building your first lesson</h2>
          <p className="status-cell" aria-live="polite">{message ?? "Researching sources"}</p>
        </div>
      </div>
      <p className="muted">
        The reading part appears here first, usually within a few minutes. The narrated video follows when it has rendered.
      </p>
      <div className="skeleton" aria-hidden="true">
        <i style={{ width: "62%", height: 28 }} /><i style={{ width: "92%" }} /><i style={{ width: "84%" }} />
        <i className="block" /><i style={{ width: "88%" }} /><i style={{ width: "70%" }} />
      </div>
      {notes.length > 0 && (
        <details className="notes">
          <summary>Athena's notes so far</summary>
          {notes.map((m) => <div key={m.id} className="md" dangerouslySetInnerHTML={{ __html: md(m.content) }} />)}
        </details>
      )}
    </div>
  );
}

function Tutor({ topicId, lesson, busy }: { topicId: string; lesson: Lesson; busy: boolean }) {
  const thread = useThread((after) => api.tutorMessages(topicId, lesson.id, after), 1500, `${topicId}:${lesson.id}`);
  const [text, setText] = useState("");
  const send = async (value = text) => {
    if (!value.trim()) return;
    setText("");
    await api.sendTutor(topicId, lesson.id, value.trim());
    thread.refresh();
  };
  const suggestions = ["Explain this lesson in simpler words", "Give me another example", "Quiz me on this lesson"];
  return (
    <aside className="tutor" aria-label="Tutor">
      <div className="tutor-head">
        <h2>Tutor</h2>
        <p>Ask about this lesson. Questions the lesson did not answer go to Athena for the next one.</p>
      </div>
      <ChatLog messages={thread.messages} baseline={thread.baseline} typing={busy} who="Tutor" compact
        empty={
          <span className="suggestions">
            <span>Stuck, or curious? Ask anything about “{lesson.title}”, or start with:</span>
            {suggestions.map((q) => <button key={q} className="example" onClick={() => send(q)}>{q}</button>)}
          </span>
        } />
      <div className="chat-dock">
        <Composer value={text} onChange={setText} onSend={() => send()} placeholder="Ask the tutor" rows={2} sendLabel="Send" iconOnly />
      </div>
    </aside>
  );
}

// ---- Topic menu and delete ----

function TopicMenu({ topic, onDeleted }: { topic: Topic; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    addEventListener("pointerdown", close);
    addEventListener("keydown", close);
    return () => { removeEventListener("pointerdown", close); removeEventListener("keydown", close); };
  }, [open]);

  const confirm = () => { setOpen(false); setError(null); dialog.current?.showModal(); };
  const remove = async () => {
    setDeleting(true);
    try {
      await api.deleteTopic(topic.id);
      dialog.current?.close();
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  };

  return (
    <div className="menu-wrap" ref={wrap}>
      <button className="btn btn-secondary icon-only" aria-label="More actions for this topic" aria-haspopup="menu"
        aria-expanded={open} onClick={() => setOpen((o) => !o)}><I.More /></button>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" className="menu-item danger" onClick={confirm}><I.Trash />Delete topic…</button>
        </div>
      )}
      <dialog ref={dialog} className="confirm" aria-labelledby="del-title" onClose={() => setDeleting(false)}>
        <h2 id="del-title">Delete “{topic.title}”?</h2>
        <p>
          This removes the topic and everything Athena made for it from this computer: lessons, videos,
          reference sheets, your answers, and the chats with Athena and the tutor. If Athena is working on
          it, that work stops first. This can't be undone.
        </p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={() => dialog.current?.close()} autoFocus disabled={deleting}>Keep topic</button>
          <button className="btn btn-danger" onClick={remove} disabled={deleting}>
            {deleting ? <><I.Spinner size={14} />Deleting</> : "Delete topic"}
          </button>
        </div>
      </dialog>
    </div>
  );
}

// ---- Shared pieces ----

const md = (s: string) => marked.parse(s, { async: false, breaks: true }) as string;

function ChatLog({ messages, baseline, typing, who, compact, empty }: {
  messages: Message[]; baseline: number | null; typing: boolean; who: string; compact?: boolean; empty?: React.ReactNode;
}) {
  const isFresh = (m: Message) => baseline !== null && m.id > baseline;
  // Scroll only the log itself; scrollIntoView would also scroll the page around it.
  const log = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [messages.length, typing]);
  return (
    <div ref={log} className={`chat-log ${compact ? "compact" : ""}`}>
      <div className="chat-inner" aria-live="polite">
        {messages.length === 0 && !typing && empty && <p className="chat-empty">{empty}</p>}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className={`msg me ${isFresh(m) ? "fresh" : ""}`}>{m.content}</div>
          ) : m.role === "activity" ? (
            <div key={m.id} className={`msg activity ${isFresh(m) ? "fresh" : ""}`}>{m.content}</div>
          ) : (
            <div key={m.id} className={`msg them ${isFresh(m) ? "fresh" : ""}`}>
              <div className="who"><span className="ava" aria-hidden="true">{who[0]}</span>{who}</div>
              <div className="md" dangerouslySetInnerHTML={{ __html: md(m.content) }} />
            </div>
          ),
        )}
        {typing && (
          <div className="msg them">
            <div className="who"><span className="ava" aria-hidden="true">{who[0]}</span>{who}</div>
            <span className="typing" role="status" aria-label={`${who} is writing`}><i /><i /><i /></span>
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({ value, onChange, onSend, disabled, placeholder, rows = 2, sendLabel, iconOnly, big, autoFocus }: {
  value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean; placeholder?: string;
  rows?: number; sendLabel: string; iconOnly?: boolean; big?: boolean; autoFocus?: boolean;
}) {
  return (
    <form className={`composer ${big ? "big" : ""}`} onSubmit={(e) => { e.preventDefault(); onSend(); }}>
      <textarea
        value={value} rows={rows} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); } }}
      />
      <div className="composer-row">
        <span className="composer-hint">Enter to send · Shift+Enter for a new line</span>
        {iconOnly
          ? <button className="send" type="submit" disabled={disabled || !value.trim()} aria-label={sendLabel}><I.ArrowUp /></button>
          : <button className="btn btn-primary" type="submit" disabled={disabled || !value.trim()}>{sendLabel}<I.ArrowRight /></button>}
      </div>
    </form>
  );
}

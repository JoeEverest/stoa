import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { marked } from "marked";
import { api, useArrivals, usePoll, useThread, type Lesson, type Message, type Topic, type TopicState } from "./api";
import * as I from "./icons";
import { Setup } from "./Setup";
import { SettingsPage } from "./Settings";
import { RailUpdateNotice } from "./Updates";
import { ACCEPT, AttachButton, FileChips, MaterialsList, fileProblem, sizeLabel, uploadChips, useDropFiles, useUploads } from "./Materials";

// ---- Routing: #/ (new topic), #/t/<topic>, #/t/<topic>/<lesson-id | ref:reference/x.html> ----

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const parts = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (parts[0] === "settings") return { topicId: null, view: null, page: "settings" as const };
  return parts[0] === "t" ? { topicId: parts[1] ?? null, view: parts.slice(2).join("/") || null, page: null } : { topicId: null, view: null, page: null };
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
  const applied = useRef(false);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = pref === "dark" || (pref === "system" && media.matches);
      const root = document.documentElement;
      if ((root.getAttribute("data-theme") === "dark") === dark) return;
      // Element transitions are off for the swap (styles.css, .theme-swap), so colors do not each fade
      // on their own. Instead the whole window cross-fades once, unless motion is reduced.
      const swap = () => {
        root.classList.add("theme-swap");
        root.toggleAttribute("data-theme", dark);
        if (dark) root.setAttribute("data-theme", "dark");
        void getComputedStyle(root).color; // flush styles before transitions come back
        requestAnimationFrame(() => root.classList.remove("theme-swap"));
      };
      const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (applied.current && !calm && document.startViewTransition) document.startViewTransition(swap);
      else swap();
    };
    apply();
    applied.current = true;
    try { localStorage.setItem("stoa-theme", pref); } catch { /* private mode: theme still applies */ }
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [pref]);
  return [pref, setPref] as const;
}

/** The desktop app shows setup until Claude access and the video tools are ready. */
export function App() {
  const [setupDone, setSetupDone] = useState(false);
  const setup = usePoll(setupDone ? null : api.setup, 1000, [setupDone]);
  const shown = useRef(false);
  const s = setup.data;
  useEffect(() => {
    // Ready on the first check (or not the desktop app): go straight in, no setup screen.
    if (s && s.ready && !shown.current) setSetupDone(true);
    if (s && !s.ready) shown.current = true;
  }, [s]);
  if (setupDone) return <Main />;
  if (!s) {
    return (
      <div className="center" style={{ height: "100%" }}>
        {setup.error ? <p className="error" role="alert">{setup.error}</p> : <I.Spinner label="Starting Stoa" />}
      </div>
    );
  }
  if (!s.desktop) return <Main />;
  return <Setup state={s} onChange={setup.refresh} onDone={() => setSetupDone(true)} />;
}

// ---- Topics sidebar: collapsed to icons or expanded ----

const NARROW = "(max-width: 1100px)";
const RAIL_KEY = "stoa-rail";
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The sidebar shows or hides fully, like the sidebar of a Mac app. The learner's choice wins and is
 * remembered. Until they choose, it hides in windows 1100px wide or less, so the lesson keeps its width.
 */
function useRailCollapsed() {
  const [pref, setPref] = useState<"collapsed" | "expanded" | null>(() => {
    try { const v = localStorage.getItem(RAIL_KEY); return v === "collapsed" || v === "expanded" ? v : null; } catch { return null; }
  });
  const [narrow, setNarrow] = useState(() => matchMedia(NARROW).matches);
  useEffect(() => {
    const media = matchMedia(NARROW);
    const on = () => setNarrow(media.matches);
    media.addEventListener("change", on);
    return () => media.removeEventListener("change", on);
  }, []);
  const collapsed = pref ? pref === "collapsed" : narrow;
  const toggle = () => {
    const next = collapsed ? "expanded" : "collapsed";
    setPref(next);
    try { localStorage.setItem(RAIL_KEY, next); } catch { /* the choice lasts for this session only */ }
  };
  // ⌘\ (Ctrl+\ elsewhere) toggles the sidebar, as in most editors.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "\\" && (isMac ? e.metaKey : e.ctrlKey) && !e.altKey && !e.shiftKey) { e.preventDefault(); toggle(); }
    };
    const fromLesson = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.source === "learn" && e.data.type === "toggle-sidebar") toggle();
    };
    addEventListener("keydown", on);
    addEventListener("message", fromLesson);
    return () => { removeEventListener("keydown", on); removeEventListener("message", fromLesson); };
  });
  return [collapsed, toggle] as const;
}

/**
 * The "show sidebar" button while the sidebar is hidden. Pages render it INSIDE their header: in the
 * desktop app the header is a window drag region, and Electron only lets a button take clicks there
 * when the button is a descendant of that region (a button merely layered over it gets no clicks).
 */
const RailToggle = React.createContext<React.ReactNode>(null);

function Main() {
  const { topicId, view, page } = useHash();
  const topics = usePoll(api.topics, 4000, []);
  const [theme, setTheme] = useTheme();
  const [collapsed, toggleRail] = useRailCollapsed();
  const toggle = (
    <button type="button" className="rail-icon-btn rail-toggle" onClick={toggleRail}
      aria-label={collapsed ? "Show sidebar" : "Hide sidebar"} aria-expanded={!collapsed}
      title={`${collapsed ? "Show" : "Hide"} sidebar (${isMac ? "⌘" : "Ctrl+"}\\)`}>
      <I.PanelLeft />
    </button>
  );
  return (
    <div className={`shell ${topicId ? "in-topic" : ""} ${collapsed ? "rail-collapsed" : ""}`}>
      <aside className="rail" aria-label="Topics" inert={collapsed || undefined}>
        {/* The sidebar's top row is also the window's title bar in the desktop app (traffic lights, drag). */}
        <div className="rail-head">
          <div className="brand"><I.Mark /><span>Stoa</span></div>
          {!collapsed && toggle}
        </div>
        <a className="nav-item new-topic" href="#/" aria-label="New topic" title="New topic" aria-current={topicId || page ? undefined : "page"}><I.Plus /><span className="btn-label">New topic</span></a>
        <div className="rail-label" id="topics-label">Topics</div>
        <nav className="topic-list" aria-labelledby="topics-label">
          {topics.data?.length === 0 && <p className="rail-empty">Your topics appear here.</p>}
          {topics.data?.map((t) => (
            <React.Fragment key={t.id}>
              <TopicLink topic={t} active={t.id === topicId} />
              {/* The open topic's lessons, references and files appear here (Classroom renders them). */}
              {t.id === topicId && <div className="topic-tree" id={TREE_SLOT} />}
            </React.Fragment>
          ))}
        </nav>
        <RailUpdateNotice />
        <div className="rail-foot">
          <ThemeSwitch value={theme} onChange={setTheme} />
          <ThemeCycle value={theme} onChange={setTheme} />
          <a className="rail-icon-btn" href="#/settings" aria-label="Settings" title="Settings"
            aria-current={page === "settings" ? "page" : undefined}><I.Settings /></a>
        </div>
      </aside>
      <main className="main">
        <RailToggle.Provider value={collapsed ? toggle : null}>
          {page === "settings"
            ? <SettingsPage theme={theme} onTheme={setTheme} toggle={collapsed ? toggle : null} />
            : topicId
            ? <TopicView key={topicId} topicId={topicId} view={view} onChange={topics.refresh} />
            : <NewTopic onCreated={topics.refresh} topics={topics.data ?? null} />}
        </RailToggle.Provider>
      </main>
    </div>
  );
}

function TopicLink({ topic, active }: { topic: Topic; active: boolean }) {
  const meta = topic.busy
    ? topic.phase === "intake" ? "Athena is replying" : "Athena is working"
    : topic.phase === "intake" ? "Getting started"
    : topic.lessonCount ? `${topic.doneCount ?? 0} of ${topic.lessonCount} lessons done` : "First lesson coming";
  const count = !topic.busy && topic.phase === "learning" && topic.lessonCount ? `${topic.doneCount ?? 0}/${topic.lessonCount}` : null;
  // In the phone layout the topics are one scrolling row: keep the open topic in view.
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <a ref={ref} href={topicHref(topic.id)} title={`${topic.title}: ${meta}`} className={`topic ${topic.busy ? "busy" : ""}`} aria-current={active ? "page" : undefined}>
      <span className="topic-icon">{topic.busy ? <I.Spinner size={14} /> : <span className="topic-dot" />}</span>
      <span className="topic-name">{topic.title}</span>
      <span className="topic-meta">{meta}</span>
      {count && <span className="topic-count">{count}</span>}
    </a>
  );
}

const TREE_SLOT = "topic-tree-slot";
const PHONE = "(max-width: 860px)";

function usePhone() {
  const [phone, setPhone] = useState(() => matchMedia(PHONE).matches);
  useEffect(() => {
    const media = matchMedia(PHONE);
    const on = () => setPhone(media.matches);
    media.addEventListener("change", on);
    return () => media.removeEventListener("change", on);
  }, []);
  return phone;
}

/** The sidebar slot under the open topic, once the topic list has rendered it. */
function useTreeSlot() {
  const [slot, setSlot] = useState<HTMLElement | null>(() => document.getElementById(TREE_SLOT));
  useEffect(() => {
    const find = () => setSlot((cur) => {
      const el = document.getElementById(TREE_SLOT);
      return el === cur ? cur : el;
    });
    find();
    const obs = new MutationObserver(find);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return slot;
}

/** Start of a page header: the "show sidebar" button (sidebar hidden) and the phone's way back to the topics. */
function BackToTopics() {
  const railToggle = React.useContext(RailToggle);
  return (
    <>
      {railToggle && <span className="topbar-toggle">{railToggle}</span>}
      <a className="topbar-back" href="#/" aria-label="All topics" title="All topics"><I.ArrowLeft /></a>
    </>
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

/** Phone layout: one button that steps through light, dark and system, in place of the three-way switch. */
function ThemeCycle({ value, onChange }: { value: ThemePref; onChange: (v: ThemePref) => void }) {
  const order: ThemePref[] = ["light", "dark", "system"];
  const names = { light: "Light", dark: "Dark", system: "Match system" };
  const nextPref = order[(order.indexOf(value) + 1) % order.length];
  const Icon = value === "light" ? I.Sun : value === "dark" ? I.Moon : I.Monitor;
  return (
    <button className="btn btn-secondary icon-only theme-cycle" onClick={() => onChange(nextPref)}
      aria-label={`Appearance: ${names[value]}. Switch to ${names[nextPref]}`} title={`Appearance: ${names[value]}`}><Icon /></button>
  );
}

// ---- New topic ----

const EXAMPLES = [
  "Program an ESP32 to read a temperature sensor and send the values to my home server",
  "Understand projectile motion well enough to write a program that draws a trajectory",
  "Speak enough Spanish to get around on a two-week trip to Mexico",
];

/** Home page for a returning learner: each recent topic, opened at the lesson to pick up. */
function ContinueLearning({ topics }: { topics: Topic[] }) {
  return (
    <section className="continue" aria-labelledby="continue-label">
      <h2 id="continue-label" className="continue-label">Continue learning</h2>
      <ul className="continue-list">
        {topics.slice(0, 5).map((t) => {
          const count = t.lessonCount ?? 0, done = t.doneCount ?? 0;
          const line = t.phase === "intake"
            ? (t.busy ? "Athena is replying" : "Finish telling Athena about your goal")
            : !t.next ? (t.busy ? "Athena is building your first lesson" : "Your first lesson is on its way")
            : t.next.done ? `All ${count} lessons done · review lesson ${t.next.n}: ${t.next.title}`
            : `Lesson ${t.next.n}: ${t.next.title}`;
          return (
            <li key={t.id}>
              <a className="continue-item" href={topicHref(t.id, t.next?.id)} title={`${t.title}: ${line}`}>
                <span className="continue-icon" aria-hidden="true">
                  {t.busy ? <I.Spinner size={16} /> : <ProgressRing done={done} total={count} />}
                </span>
                <span className="continue-text">
                  <span className="continue-topic">{t.title}</span>
                  <span className="continue-lesson">{line}</span>
                </span>
                <span className="continue-meta">{count > 0 ? `${done} of ${count} done` : ""}</span>
                <I.ArrowRight className="continue-go" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A small pie that fills with the share of lessons done (a wedge, so it never looks like the working spinner). */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const part = total ? done / total : 0, r = 3.5, c = 2 * Math.PI * r;
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="7.25" fill="none" stroke={part >= 1 ? "var(--accent)" : "var(--ink-4)"} strokeWidth="1.5" />
      {part > 0 && <circle cx="9" cy="9" r={r} fill="none" stroke="var(--accent)" strokeWidth={2 * r}
        strokeDasharray={`${c * Math.min(part, 1)} ${c}`} transform="rotate(-90 9 9)" />}
    </svg>
  );
}

function NewTopic({ onCreated, topics }: { onCreated: () => void; topics: Topic[] | null }) {
  const railToggle = React.useContext(RailToggle);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A topic whose files did not all upload: the learner can retry or continue without them.
  const [pending, setPending] = useState<{ id: string; failed: File[] } | null>(null);

  const attach = (picked: File[]) => {
    const problems = picked.map(fileProblem).filter(Boolean);
    setError(problems.length ? problems.join(" ") : null);
    setFiles((f) => [...f, ...picked.filter((p) => !fileProblem(p) && !f.some((x) => x.name === p.name && x.size === p.size))]);
  };
  const drop = useDropFiles(attach);

  const begin = async (id: string) => {
    await api.startTopic(id);
    onCreated();
    go(id);
  };
  const uploadAll = async (id: string, list: File[]) => {
    const failed: File[] = [];
    const reasons: string[] = [];
    for (const [i, f] of list.entries()) {
      setBusy(`Adding ${f.name}${list.length > 1 ? ` (${i + 1} of ${list.length})` : ""}`);
      try { await api.upload(id, f); } catch (e) { failed.push(f); reasons.push(`${f.name}: ${e instanceof Error ? e.message : e}`); }
    }
    if (!failed.length) return begin(id);
    setPending({ id, failed });
    setFiles(failed);
    setError(reasons.join(" "));
    setBusy(null);
  };
  const start = async () => {
    if (busy) return;
    setError(null);
    try {
      if (pending) { setBusy("Adding files"); return await uploadAll(pending.id, files); }
      if (!text.trim()) return;
      setBusy("Starting");
      const { id } = await api.createTopic(text, files.length === 0);
      if (!files.length) { onCreated(); return go(id); }
      await uploadAll(id, files);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };
  return (
    <div className={`new-topic-page ${drop.over ? "drop-over" : ""}`} {...drop.props}>
      {railToggle && <div className="main-toggle">{railToggle}</div>}
      <div className="new-topic-inner">
        {!!topics?.length && <ContinueLearning topics={topics} />}
        <h1>{topics?.length ? "What do you want to learn next?" : "What do you want to learn?"}</h1>
        <p className="lead">
          Say what you want to be able to do. Athena asks a few questions about your goal, then builds
          your first lesson: reading, a narrated video and exercises.
        </p>
        <Composer value={text} onChange={setText} onSend={start} disabled={!!busy || !!pending} rows={2} autoFocus={topics?.length === 0}
          placeholder="Describe what you want to be able to do…" sendLabel={busy ?? "Start"} big
          extra={<AttachButton onFiles={attach} disabled={!!busy} className="attach-btn" label="Attach course files" />}
          top={<FileChips items={files.map((f, i) => ({
            key: `${i}-${f.name}`, name: f.name, meta: sizeLabel(f.size),
            onRemove: busy ? undefined : () => setFiles((all) => all.filter((x) => x !== f)),
          }))} />} />
        <p className="attach-hint">Studying for a class? Attach notes, slides or a textbook (PDF, Word, PowerPoint) and Athena follows your course.</p>
        {error && <p className="error" role="alert">{error}</p>}
        {pending && !busy && (
          <div className="pending-actions">
            <button className="btn btn-primary" onClick={start} disabled={!files.length}>Try again<I.ArrowRight /></button>
            <button className="btn btn-secondary" onClick={() => begin(pending.id).catch((e) => setError(e instanceof Error ? e.message : String(e)))}>Continue without them</button>
          </div>
        )}
        {topics?.length === 0 && <div className="examples">
          <span className="examples-label">Or start from an example</span>
          {EXAMPLES.map((e) => (
            <button key={e} className="example" onClick={() => setText(e)}>{e}</button>
          ))}
        </div>}
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
  const videos = s.lessons.filter((l) => l.video_status === "ready").length;
  const stakes = s.lessons.length
    ? `${plural(s.lessons.length, "lesson")}${videos ? `, ${plural(videos, "video")}` : ""}, your files, answers and chats`
    : "the chat with Athena and your files";
  const menu = (extra?: MenuItem[]) => <TopicMenu topic={s.topic} stakes={stakes} extra={extra} onDeleted={() => { onChange(); go(); }} />;
  if (s.topic.phase === "intake") return <IntakeChat state={s} onSent={state.refresh} menu={menu} />;
  return <Classroom state={s} view={view} refresh={state.refresh} menu={menu} />;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
type MenuItem = { label: string; icon: React.ReactNode; onClick: () => void; className?: string };

function IntakeChat({ state, onSent, menu }: { state: TopicState; onSent: () => void; menu: (extra?: MenuItem[]) => React.ReactNode }) {
  const { topic, busy, lastError } = state;
  const thread = useThread((after) => api.messages(topic.id, after), 1500, topic.id);
  const files = useUploads(topic.id);
  const drop = useDropFiles(files.add);
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
    <div className={`intake ${drop.over ? "drop-over" : ""}`} {...drop.props}>
      <header className="topbar">
        <BackToTopics />
        <div className="topbar-title">
          <h1>{topic.title}</h1>
          <p className="status"><span>Athena is getting to know your goal.<span className="wide-only"> The first lesson starts after this chat.</span></span></p>
        </div>
        <div className="topbar-actions">{menu()}</div>
      </header>
      <ChatLog messages={thread.messages} baseline={thread.baseline} typing={busy} who="Athena" />
      <div className="chat-dock">
        {lastError && !busy && <p className="error" role="alert">Athena stopped: {lastError}. Send a message to try again.</p>}
        {files.errors.map((e) => <p key={e} className="error" role="alert">{e}</p>)}
        <Composer value={text} onChange={setText} onSend={send} disabled={busy} autoFocus rows={1}
          placeholder={busy ? "Athena is writing…" : "Reply to Athena"} sendLabel="Send"
          top={<FileChips items={uploadChips(files)} />}
          extra={<AttachButton onFiles={files.add} className="attach-btn" label="Attach course files" />} />
      </div>
    </div>
  );
}

function Classroom({ state, view, refresh, menu }: {
  state: TopicState; view: string | null; refresh: () => void; menu: (extra?: MenuItem[]) => React.ReactNode;
}) {
  const { topic, lessons, building, lastError } = state;
  const refs = usePoll(() => api.references(topic.id), 8000, [topic.id]);
  const materials = useUploads(topic.id);
  // The tutor starts open beside the lesson; on a phone it is a sheet the learner opens.
  const [tutorOpen, setTutorOpen] = useState(() => !matchMedia("(max-width: 860px)").matches);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const phone = usePhone();
  const treeSlot = useTreeSlot();
  const [toast, setToast] = useState<string | null>(null);

  // Default view: the oldest lesson that is not finished, else the newest lesson.
  const current = view ?? (lessons.find((l) => !l.completed_at) ?? lessons.at(-1))?.id ?? null;
  const lesson = lessons.find((l) => l.id === current) ?? null;
  const refFile = current?.startsWith("ref:") ? current.slice(4) : null;
  const refPath = refFile?.split("#")[0] ?? null; // a link to a file may carry #page=12
  const refTitle = refs.data?.find((r) => r.file === refPath)?.title ?? materials.uploads.find((u) => u.file === refPath)?.name;
  const src = lesson ? `/w/${topic.id}/${lesson.file}` : refFile ? `/w/${topic.id}/${refFile}` : null;
  // The lesson the learner read last, for the "Back to lesson" link above a reference page.
  const lastLesson = useRef<Lesson | null>(null);
  if (lesson) lastLesson.current = lesson;
  const backTo = !lesson && refFile ? lastLesson.current ?? lessons.find((l) => !l.completed_at) ?? lessons.at(-1) ?? null : null;
  // On a reference page the tutor keeps the context of the lesson the learner came from.
  const tutorLesson = lesson ?? backTo;
  const allDone = lessons.length > 0 && lessons.every((l) => l.completed_at);

  // Keep the pages the learner visited loaded in hidden frames, so switching to a reference and
  // back does not reload a lesson and lose what was typed. Hiding a frame keeps its document;
  // only removing it would reload. At most KEEP pages stay loaded.
  const KEEP = 6;
  const [pages, setPages] = useState<string[]>([]);
  useEffect(() => {
    if (!src) return;
    setPages((p) => (p.includes(src) ? p : [...p, src].slice(-KEEP)));
  }, [src]);
  const shownPages = src && !pages.includes(src) ? [...pages, src] : pages;
  const doneCount = lessons.filter((l) => l.completed_at).length;
  const buildingNext = state.buildingNew;
  // Any lesson's video: the newest one after a build, or an older one the learner asked Athena to remake.
  const makingVideo = building && !buildingNext && lessons.some((l) => l.video_status === "planned");
  // A lesson that Athena is building counts in every total, so the bar, the status and the switcher agree.
  const total = lessons.length + (buildingNext ? 1 : 0);
  const workingLabel = buildingNext ? `Athena is building lesson ${lessons.length + 1}` : makingVideo ? "Athena is making the video" : "Athena is finishing up";
  const arrivals = useArrivals(lessons.map((l) => l.id), lessons.filter((l) => l.completed_at).map((l) => l.id));

  // Lesson pages report submit/complete through postMessage; refresh state when they do.
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.source !== "learn") return;
      refresh();
      if (e.data.type === "complete") flash("Lesson finished. Athena is preparing the next one.");
      // A link inside a lesson to another workspace page: change the app's view, not the frame.
      if (e.data.type === "navigate" && typeof e.data.data?.path === "string") {
        const path: string = e.data.data.path;
        const lessonMatch = path.match(/^lessons\/([^/]+)\.html?$/);
        go(topic.id, lessonMatch ? lessonMatch[1] : `ref:${path}${e.data.data.hash ?? ""}`);
      }
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

  const filesAdded = (n: number, steered: boolean) => {
    const what = n === 1 ? "File" : `${n} files`, it = n === 1 ? "it" : "them";
    flash(steered
      ? `${what} added. Athena got ${it} and uses ${it} in the work she is doing now.`
      : `${what} added. Athena reads ${it} when she builds the next lesson.`);
  };
  // "Add course files…" in the ⋯ menu works with the sidebar hidden too.
  const filePicker = useRef<HTMLInputElement>(null);
  const addFromPicker = async (files: File[]) => {
    const r = await materials.add(files);
    if (r.problems.length) flash(r.problems.join(" "));
    else if (r.added) filesAdded(r.added, r.steered);
  };

  // Lessons, references and the learner's files: in the sidebar under the open topic on a computer,
  // in the lesson picker on a phone. One copy, so upload state and drop targets are never doubled.
  const outline = (
    <div className="outline-body">
      <ol className="lesson-list" aria-label="Lessons">
        {lessons.map((l, i) => (
          <LessonItem key={l.id} lesson={l} n={i + 1} active={l.id === current} topicId={topic.id} onPick={() => setOutlineOpen(false)}
            fresh={arrivals.fresh.has(l.id)} justDone={arrivals.justDone.has(l.id)} />
        ))}
        {buildingNext && (
          <li className="li building" aria-live="polite" title={topic.status_message ?? "Athena is writing it"}>
            <span className="num"><I.Spinner size={12} /></span>
            <span className="li-name">{lessons.length ? `Lesson ${lessons.length + 1}` : "Your first lesson"}</span>
            <span className="li-meta">Athena is writing it</span>
          </li>
        )}
      </ol>
      {!!refs.data?.length && (
        <div className="refs">
          <div className="col-head"><span>Reference</span></div>
          {refs.data.map((r) => (
            <a key={r.file} className="ref" aria-current={refPath === r.file ? "page" : undefined} title={r.title}
              href={topicHref(topic.id, `ref:${r.file}`)} onClick={() => setOutlineOpen(false)}><I.Doc /><span className="ref-name">{r.title}</span></a>
          ))}
        </div>
      )}
      <MaterialsList u={materials} current={refPath} working={building} onPick={() => setOutlineOpen(false)}
        hrefFor={(file) => topicHref(topic.id, `ref:${file}`)} onAdded={filesAdded} />
    </div>
  );
  // Breadcrumb: Topic / the page open now.
  const crumb = lesson ? `Lesson ${lessons.indexOf(lesson) + 1}: ${lesson.title}` : refTitle ?? (lessons.length ? null : "Your first lesson");

  return (
    <div className="classroom">
      <header className="topbar">
        <BackToTopics />
        <div className="topbar-title">
          <h1>{topic.title}</h1>
          {crumb && <><span className="crumb-sep" aria-hidden="true">/</span><span className="crumb" title={crumb}>{crumb}</span></>}
          <div className="status">
            {lessons.length > 0 && <ProgressBar lessons={lessons} building={buildingNext} />}
            <span className="status-text" aria-live="polite">
              {lessons.length > 0 && <span>{doneCount} of {total} done</span>}
              {building
                ? <span className="status-working"><I.Spinner size={12} />{workingLabel}</span>
                : lastError ? <span className="error-text">Athena stopped: {lastError}</span>
                : !lessons.length && topic.status_message ? <span>{topic.status_message}</span> : null}
            </span>
            {building && <StopButton onStop={() => api.stop(topic.id).then(refresh)} />}
          </div>
        </div>
        <div className="topbar-actions">
          {tutorLesson && <button className={`btn btn-secondary tutor-toggle ${tutorOpen ? "is-on" : ""}`} onClick={() => setTutorOpen((o) => !o)}
            aria-pressed={tutorOpen} aria-label="Tutor" title={tutorOpen ? "Hide the tutor" : "Ask the tutor about this lesson"}>
            <I.Chat /><span className="btn-label">Tutor</span>
          </button>}
          {/* Finishing a lesson builds the next one, so mid-lesson the header has no build button;
              it is in the menu. When every lesson is done, building the next one is the main action. */}
          {!building && allDone && <button className="btn btn-primary build-btn" onClick={next}
                title={`Ask Athena to build lesson ${lessons.length + 1} from your answers so far`}>
                <span>Build lesson {lessons.length + 1}</span><I.ArrowRight />
              </button>}
          {/* On a phone the build and stop actions live in this menu, to keep the header to one row. */}
          {menu([
            { label: "Add course files…", icon: <I.Paperclip />, onClick: () => filePicker.current?.click() },
            ...(building
              ? [{ label: "Stop Athena", icon: <I.Stop />, onClick: () => { api.stop(topic.id).then(refresh); }, className: "phone-only" }]
              : [{ label: `Build lesson ${lessons.length + 1} now`, icon: <I.Plus />, onClick: next, className: allDone ? "phone-only" : "" }]),
          ])}
          <input ref={filePicker} type="file" multiple accept={ACCEPT} hidden
            onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) addFromPicker(f); }} />
        </div>
      </header>
      <div className={`workspace ${tutorLesson && tutorOpen ? "with-tutor" : ""}`}>
        <nav className={`outline ${outlineOpen ? "open" : ""}`} aria-label="Lessons and references">
          <button className="outline-toggle" aria-expanded={outlineOpen} onClick={() => setOutlineOpen((o) => !o)}>
            <span className="outline-toggle-text">
              <span className="muted outline-toggle-meta">
                <span>{lesson ? `Lesson ${lessons.indexOf(lesson) + 1} of ${total}` : refPath?.startsWith("uploads/") ? "Your course files" : refFile ? "Reference" : "Lessons"}</span>
                {lessons.length > 0 && <span>{doneCount} done</span>}
                {building && <span className="outline-working"><I.Spinner size={12} />{workingLabel}</span>}
              </span>
              <span className="outline-toggle-title">{lesson?.title ?? refTitle ?? "Your first lesson"}</span>
              <span className="outline-toggle-label">Lessons and files</span>
            </span>
            <I.Chevron className="outline-chevron" />
          </button>
          {phone ? outline : null}
        </nav>
        {!phone && treeSlot && createPortal(outline, treeSlot)}
        <section className="stage" aria-label={lesson?.title ?? refTitle ?? "Lesson"}>
          {refFile && (
            <div className="stage-bar">
              {backTo && (
                <a className="back-link" href={topicHref(topic.id, backTo.id)}>
                  <I.ArrowLeft />Back to lesson {lessons.indexOf(backTo) + 1}
                </a>
              )}
              {refPath?.startsWith("uploads/") && <span className="stage-kind">Your course file</span>}
            </div>
          )}
          <div className="stage-frames">
            {src ? shownPages.map((p) => (
              <iframe key={p} src={p} hidden={p !== src} allow="fullscreen" title={p === src ? lesson?.title ?? refTitle ?? "Reference" : "Hidden page"} />
            ))
              : <BuildingPlaceholder topicId={topic.id} message={topic.status_message} since={state.workingSince} />}
          </div>
        </section>
        {tutorLesson && tutorOpen && <>
          <div className="tutor-scrim" onClick={() => setTutorOpen(false)} aria-hidden="true" />
          <Tutor key={tutorLesson.id} topicId={topic.id} lesson={tutorLesson} n={lessons.indexOf(tutorLesson) + 1} busy={state.tutorBusy.includes(tutorLesson.id)} onClose={() => setTutorOpen(false)} />
        </>}
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
    <span className="segbar" aria-hidden="true"
      title={`${lessons.filter((l) => l.completed_at).length} done${firstOpen >= 0 ? ` · lesson ${firstOpen + 1} in progress` : ""}${building ? " · next lesson being built" : ""}`}>
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
      <a className={`li ${done ? "done" : ""} ${fresh ? "fresh" : ""} ${justDone ? "just-done" : ""}`} aria-current={active ? "page" : undefined}
        href={topicHref(topicId, lesson.id)} onClick={onPick} title={`Lesson ${n}: ${lesson.title}`}>
        <span className="num">{done ? <I.Check size={12} /> : n}</span>
        <span className="li-name">{lesson.title}</span>
        <span className="li-meta">
          {done ? r.graded > 0 && <span>{r.right} of {r.graded} correct</span>
            : r.n > 0 && <span>{lesson.exercises ? `${Math.min(r.n, lesson.exercises)} of ${lesson.exercises} answered` : `${r.n} answered`}</span>}
          {lesson.video_status === "ready" && <span title="The narrated video is ready"><I.Video size={14} />Video</span>}
          {lesson.video_status === "planned" && <span className="li-pending" title="Athena is making the video"><I.Spinner size={12} /><span className="li-pending-text">Video in progress</span></span>}
          {lesson.video_status === "failed" && <span>No video</span>}
        </span>
      </a>
    </li>
  );
}

/** "Started 3 min ago", from a UTC SQLite time ("2026-11-07 18:02:11"). Updates every 20 s. */
function useElapsed(since: string | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  if (!since) return null;
  const min = Math.max(0, Math.floor((now - Date.parse(since.replace(" ", "T") + "Z")) / 60_000));
  return min < 1 ? "Started less than a minute ago" : `Started ${plural(min, "minute")} ago`;
}

function BuildingPlaceholder({ topicId, message, since }: { topicId: string; message: string | null; since: string | null }) {
  const thread = useThread((after) => api.messages(topicId, after), 3000, topicId);
  const elapsed = useElapsed(since);
  const slow = !!since && Date.now() - Date.parse(since.replace(" ", "T") + "Z") > 8 * 60_000;
  const notes = thread.messages.filter((m) => m.role !== "user").slice(-5);
  return (
    <div className="building-page">
      <p className="building-step" aria-live="polite">
        <I.Spinner size={14} /><span>{message ?? "Researching sources"}</span>
        {elapsed && <span className="elapsed">{elapsed}</span>}
      </p>
      <h2>Your first lesson is on its way</h2>
      <p className="muted">
        {slow
          ? "This is taking longer than usual. Athena is still working. You can keep waiting, or press Stop at the top and then choose Build lesson 1 now in the ⋯ menu."
          : "The reading appears here first, usually within a few minutes. The narrated video follows when it has rendered."}
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

/** Stops Athena's run. It asks once ("Stop now?") so a stray click does not throw work away. */
function StopButton({ onStop }: { onStop: () => Promise<unknown> }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`stop-btn ${armed ? "armed" : ""}`}
      onClick={() => (armed ? onStop().finally(() => setArmed(false)) : setArmed(true))}
      title={armed ? "Click again to stop Athena" : "Stop Athena's work. Your lessons and chats are kept."}>
      {armed ? "Stop now?" : "Stop"}
    </button>
  );
}

function Tutor({ topicId, lesson, n, busy, onClose }: { topicId: string; lesson: Lesson; n: number; busy: boolean; onClose: () => void }) {
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
        <div className="tutor-title">
          <h2>Tutor</h2>
          <button type="button" className="rail-icon-btn tutor-close" onClick={onClose} aria-label="Close the tutor" title="Close the tutor"><I.X /></button>
        </div>
        <p className="tutor-context" title={lesson.title}>Helps with lesson {n}</p>
      </div>
      <ChatLog messages={thread.messages} baseline={thread.baseline} typing={busy} who="Tutor" compact
        empty={
          <span className="suggestions">
            <span>Ask anything about this lesson. Anything the lesson did not answer goes to Athena for your next lesson. Or start with:</span>
            {suggestions.map((q) => <button key={q} className="example" onClick={() => send(q)}>{q}</button>)}
          </span>
        } />
      <div className="chat-dock">
        <Composer value={text} onChange={setText} onSend={() => send()} placeholder="Ask the tutor" rows={1} sendLabel="Ask" small />
      </div>
    </aside>
  );
}

// ---- Topic menu and delete ----

function TopicMenu({ topic, stakes, extra = [], onDeleted }: { topic: Topic; stakes: string; extra?: MenuItem[]; onDeleted: () => void }) {
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
      // The lesson bridge keeps answer drafts in this browser; remove them too.
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith(`stoa-draft:${topic.id}:`)) localStorage.removeItem(k);
      } catch { /* storage unavailable */ }
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
          {extra.map((it) => (
            <button key={it.label} role="menuitem" className={`menu-item ${it.className ?? ""}`} onClick={() => { setOpen(false); it.onClick(); }}>{it.icon}{it.label}</button>
          ))}
          <button role="menuitem" className="menu-item danger" onClick={confirm}><I.Trash />Delete topic…</button>
        </div>
      )}
      <dialog ref={dialog} className="confirm" aria-labelledby="del-title" onClose={() => setDeleting(false)}>
        <h2 id="del-title">Delete “{topic.title}”?</h2>
        <p>
          This removes {stakes} from this computer.
          <strong> This can't be undone.</strong>
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
  // Athena and the tutor are two different helpers; their avatars differ too.
  const ava = <span className={`ava ${who === "Tutor" ? "ava-tutor" : ""}`} aria-hidden="true">{who[0]}</span>;
  // A reply that follows another reply (with only activity rows between) is the same turn: no second name row.
  const sameTurn = (i: number) => {
    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].role === "activity") continue;
      return messages[j].role === "assistant";
    }
    return false;
  };
  // Scroll only the log itself; scrollIntoView would also scroll the page around it.
  const log = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: first.current ? "auto" : "smooth" });
    // The thread loads after mount: the first load with messages also jumps, without animation.
    if (messages.length) first.current = false;
  }, [messages.length, typing]);
  return (
    <div ref={log} className={`chat-log ${compact ? "compact" : ""} ${messages.length === 0 && !typing ? "is-empty" : ""}`}>
      <div className="chat-inner" aria-live="polite">
        {messages.length === 0 && !typing && empty && <p className="chat-empty">{empty}</p>}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={m.id} className={`msg me ${isFresh(m) ? "fresh" : ""}`}>{m.content}</div>
          ) : m.role === "activity" ? (
            <div key={m.id} className={`msg activity ${isFresh(m) ? "fresh" : ""}`}>
              {/* The newest step is still running while Athena writes; earlier steps are done. */}
              {typing && i === messages.length - 1 ? <I.Spinner size={12} /> : <I.Check size={12} />}
              <span>{m.content}</span>
            </div>
          ) : (
            <div key={m.id} className={`msg them ${isFresh(m) ? "fresh" : ""}`}>
              {!sameTurn(i) && <div className="who">{ava}{who}</div>}
              <div className="md" dangerouslySetInnerHTML={{ __html: md(m.content) }} />
            </div>
          ),
        )}
        {typing && (
          <div className="msg them">
            <div className="who">{ava}{who}</div>
            <span className="typing" role="status" aria-label={`${who} is writing`}><i /><i /><i /></span>
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({ value, onChange, onSend, disabled, placeholder, rows = 2, sendLabel, iconOnly, big, small, autoFocus, extra, top }: {
  value: string; onChange: (v: string) => void; onSend: () => void; disabled?: boolean; placeholder?: string;
  rows?: number; sendLabel: string; iconOnly?: boolean; big?: boolean; small?: boolean; autoFocus?: boolean;
  /** Shown at the left of the bottom row (an attach button). */ extra?: React.ReactNode;
  /** Shown above the text (attached files). */ top?: React.ReactNode;
}) {
  // The field starts at `rows` lines and grows with the text, up to about eight lines.
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);
  return (
    <form className={`composer ${big ? "big" : ""} ${small ? "small" : ""}`} onSubmit={(e) => { e.preventDefault(); onSend(); }}>
      {top}
      <textarea
        ref={area} value={value} rows={rows} placeholder={placeholder} disabled={disabled} autoFocus={autoFocus}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); } }}
      />
      <div className="composer-row">
        {extra}
        <span className="composer-hint">Enter to {sendLabel.toLowerCase()} · Shift+Enter for a new line</span>
        {iconOnly
          ? <button className="send" type="submit" disabled={disabled || !value.trim()} aria-label={sendLabel}><I.ArrowUp /></button>
          : <button className="btn btn-primary" type="submit" disabled={disabled || !value.trim()}>{sendLabel}<I.ArrowRight /></button>}
      </div>
    </form>
  );
}

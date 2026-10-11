import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { DATA_DIR } from "./paths.ts";

export const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'intake',      -- intake | learning
  status_message TEXT,
  intake_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  id TEXT NOT NULL,                          -- file stem, e.g. 0001-two-motions
  file TEXT NOT NULL,                        -- path relative to the topic folder
  title TEXT NOT NULL,
  video_status TEXT NOT NULL DEFAULT 'none', -- none | planned | ready | failed
  video_file TEXT,
  video_poster TEXT,
  video_message TEXT,
  tutor_session_id TEXT,
  completed_at TEXT,
  completion TEXT,                           -- JSON from learn.complete()
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (topic_id, id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  thread TEXT NOT NULL,                      -- 'teacher' or 'tutor:<lesson-id>'
  role TEXT NOT NULL,                        -- user | assistant | activity
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS messages_thread ON messages(topic_id, thread, id);

CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  prompt TEXT,
  answer TEXT,                               -- JSON
  correct INTEGER,                           -- 1 | 0 | NULL (teacher grades later)
  meta TEXT,                                 -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS responses_lesson ON responses(topic_id, lesson_id, id);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                        -- intake | build | tutor
  lesson_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',     -- queued | running | done | error
  session_id TEXT,
  error TEXT,
  cost_usd REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  ended_at TEXT
);
`);

// Runs that were active when the server stopped can not continue.
db.exec(`UPDATE runs SET status = 'error', error = 'Server restarted', ended_at = datetime('now')
         WHERE status IN ('queued', 'running')`);

export type Topic = {
  id: string; title: string; phase: "intake" | "learning"; status_message: string | null;
  intake_session_id: string | null; created_at: string; updated_at: string;
};
export type Lesson = {
  topic_id: string; id: string; file: string; title: string;
  video_status: "none" | "planned" | "ready" | "failed";
  video_file: string | null; video_poster: string | null; video_message: string | null;
  tutor_session_id: string | null; completed_at: string | null; completion: string | null;
  created_at: string;
};
export type Message = { id: number; topic_id: string; thread: string; role: string; content: string; created_at: string };
export type Run = {
  id: number; topic_id: string; kind: "intake" | "build" | "tutor"; lesson_id: string | null;
  status: string; session_id: string | null; error: string | null; created_at: string; started_at: string | null;
};

const q = <T>(sql: string) => {
  const st = db.prepare(sql);
  return {
    get: (...a: any[]) => st.get(...a) as T | undefined,
    all: (...a: any[]) => st.all(...a) as T[],
    run: (...a: any[]) => st.run(...a),
  };
};

export const Topics = {
  list: () => q<Topic>(`SELECT * FROM topics ORDER BY updated_at DESC`).all(),
  get: (id: string) => q<Topic>(`SELECT * FROM topics WHERE id = ?`).get(id),
  create: (id: string, title: string) => q(`INSERT INTO topics (id, title) VALUES (?, ?)`).run(id, title),
  update: (id: string, fields: Partial<Pick<Topic, "title" | "phase" | "status_message" | "intake_session_id">>) => {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const sets = keys.map((k) => `${k} = ?`).join(", ");
    q(`UPDATE topics SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .run(...keys.map((k) => (fields as any)[k]), id);
  },
  remove: (id: string) => q(`DELETE FROM topics WHERE id = ?`).run(id),
};

export const Lessons = {
  list: (topicId: string) => q<Lesson>(`SELECT * FROM lessons WHERE topic_id = ? ORDER BY id`).all(topicId),
  get: (topicId: string, id: string) => q<Lesson>(`SELECT * FROM lessons WHERE topic_id = ? AND id = ?`).get(topicId, id),
  upsert: (topicId: string, id: string, file: string, title: string, videoStatus: string) =>
    q(`INSERT INTO lessons (topic_id, id, file, title, video_status) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (topic_id, id) DO UPDATE SET file = excluded.file, title = excluded.title,
         video_status = CASE WHEN lessons.video_status = 'ready' AND excluded.video_status = 'planned'
                             THEN lessons.video_status ELSE excluded.video_status END`)
      .run(topicId, id, file, title, videoStatus),
  setVideo: (topicId: string, id: string, status: string, file: string | null, poster: string | null, message: string | null) =>
    q(`UPDATE lessons SET video_status = ?, video_file = ?, video_poster = ?, video_message = ? WHERE topic_id = ? AND id = ?`)
      .run(status, file, poster, message, topicId, id),
  setTutorSession: (topicId: string, id: string, sessionId: string) =>
    q(`UPDATE lessons SET tutor_session_id = ? WHERE topic_id = ? AND id = ?`).run(sessionId, topicId, id),
  complete: (topicId: string, id: string, completion: unknown) =>
    q(`UPDATE lessons SET completed_at = datetime('now'), completion = ? WHERE topic_id = ? AND id = ?`)
      .run(JSON.stringify(completion ?? {}), topicId, id),
};

export const Messages = {
  list: (topicId: string, thread: string, afterId = 0) =>
    q<Message>(`SELECT * FROM messages WHERE topic_id = ? AND thread = ? AND id > ? ORDER BY id`).all(topicId, thread, afterId),
  add: (topicId: string, thread: string, role: string, content: string) =>
    q(`INSERT INTO messages (topic_id, thread, role, content) VALUES (?, ?, ?, ?)`).run(topicId, thread, role, content),
};

export type ResponseRow = {
  id: number; lesson_id: string; item_id: string; prompt: string | null; answer: unknown;
  correct: boolean | null; meta: unknown; created_at: string;
};
const parse = (s: unknown) => { try { return s == null ? null : JSON.parse(String(s)); } catch { return s; } };
const toResponse = (r: any): ResponseRow => ({
  id: r.id, lesson_id: r.lesson_id, item_id: r.item_id, prompt: r.prompt, answer: parse(r.answer),
  correct: r.correct == null ? null : !!r.correct, meta: parse(r.meta), created_at: r.created_at,
});

export const Responses = {
  add: (topicId: string, lessonId: string, r: { itemId: string; prompt?: string; answer?: unknown; correct?: boolean | null; meta?: unknown }) =>
    q(`INSERT INTO responses (topic_id, lesson_id, item_id, prompt, answer, correct, meta) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(topicId, lessonId, r.itemId, r.prompt ?? null, JSON.stringify(r.answer ?? null),
        r.correct == null ? null : r.correct ? 1 : 0, r.meta == null ? null : JSON.stringify(r.meta)),
  list: (topicId: string, lessonId?: string) =>
    (lessonId
      ? q(`SELECT * FROM responses WHERE topic_id = ? AND lesson_id = ? ORDER BY id`).all(topicId, lessonId)
      : q(`SELECT * FROM responses WHERE topic_id = ? ORDER BY id`).all(topicId)
    ).map(toResponse),
  counts: (topicId: string) =>
    q<{ lesson_id: string; n: number; right: number; graded: number }>(
      `SELECT lesson_id, COUNT(*) n, SUM(correct = 1) AS "right", SUM(correct IS NOT NULL) AS graded
       FROM responses WHERE topic_id = ? GROUP BY lesson_id`).all(topicId),
};

export const Runs = {
  create: (topicId: string, kind: Run["kind"], lessonId: string | null = null) =>
    Number(q(`INSERT INTO runs (topic_id, kind, lesson_id) VALUES (?, ?, ?)`).run(topicId, kind, lessonId).lastInsertRowid),
  start: (id: number) => q(`UPDATE runs SET status = 'running', started_at = datetime('now') WHERE id = ?`).run(id),
  setSession: (id: number, sessionId: string) => q(`UPDATE runs SET session_id = ? WHERE id = ?`).run(sessionId, id),
  finish: (id: number, status: "done" | "error", error: string | null, cost: number | null) =>
    q(`UPDATE runs SET status = ?, error = ?, cost_usd = ?, ended_at = datetime('now') WHERE id = ?`).run(status, error, cost, id),
  get: (id: number) => q<Run>(`SELECT * FROM runs WHERE id = ?`).get(id),
  cancelQueued: (topicId: string) =>
    q(`UPDATE runs SET status = 'error', error = 'Stopped', ended_at = datetime('now') WHERE topic_id = ? AND status = 'queued'`).run(topicId),
  active: (topicId: string) =>
    q<Run>(`SELECT * FROM runs WHERE topic_id = ? AND status IN ('queued', 'running') ORDER BY id`).all(topicId),
  last: (topicId: string, kind: Run["kind"]) =>
    q<Run>(`SELECT * FROM runs WHERE topic_id = ? AND kind = ? ORDER BY id DESC LIMIT 1`).get(topicId, kind),
};

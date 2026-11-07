import { useEffect, useRef, useState } from "react";

export type Topic = {
  id: string; title: string; phase: "intake" | "learning"; status_message: string | null;
  updated_at: string; busy?: boolean; lessonCount?: number; doneCount?: number;
};
export type Lesson = {
  id: string; file: string; title: string; video_status: "none" | "planned" | "ready" | "failed";
  completed_at: string | null; responses: { n: number; right: number; graded: number };
};
export type TopicState = {
  topic: Topic; lessons: Lesson[]; busy: boolean; building: boolean; buildingNew: boolean;
  tutorBusy: string[]; lastError: string | null;
};
export type Message = { id: number; role: "user" | "assistant" | "activity"; content: string; created_at: string };
export type Reference = { file: string; title: string };
export type Upload = {
  id: number; file: string; name: string; size: number; text_file: string | null; problem: string | null;
  summary: string | null; read_at: string | null; created_at: string;
  /** Only in the upload response: a teacher run was working and got the file as a steering message. */
  steered?: boolean;
};

export type SetupStep = {
  id: string; label: string; status: "pending" | "running" | "done" | "error";
  bytes: number; total: number | null; error: string | null;
};
export type ClaudeAccess = {
  mode: "login" | "apiKey" | null;
  login: { email: string | null; plan: string | null; provider: string | null } | null;
};
export type SetupState =
  | { desktop: false; ready: true }
  | {
      desktop: true; ready: boolean; claude: ClaudeAccess;
      tools: { managed: false } | {
        managed: true; supported: boolean; platform: string; whisper: boolean; ready: boolean;
        installing: boolean; error: string | null; steps: SetupStep[];
      };
    };

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  setup: () => req<SetupState>("GET", "/api/setup"),
  checkClaude: () => req<SetupState>("POST", "/api/setup/claude/check"),
  installTools: () => req("POST", "/api/setup/tools/install"),
  topics: () => req<Topic[]>("GET", "/api/topics"),
  createTopic: (message: string, start = true) => req<{ id: string }>("POST", "/api/topics", { message, start }),
  startTopic: (id: string) => req<{ started: boolean }>("POST", `/api/topics/${id}/start`),
  uploads: (id: string) => req<Upload[]>("GET", `/api/topics/${id}/uploads`),
  upload: async (id: string, file: File) => {
    const res = await fetch(`/api/topics/${id}/uploads?name=${encodeURIComponent(file.name)}`, {
      method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as any).error ?? `Upload failed (${res.status})`);
    return data as Upload;
  },
  deleteUpload: (id: string, upload: number) => req("DELETE", `/api/topics/${id}/uploads/${upload}`),
  topic: (id: string) => req<TopicState>("GET", `/api/topics/${id}`),
  messages: (id: string, after = 0) => req<Message[]>("GET", `/api/topics/${id}/messages?thread=teacher&after=${after}`),
  sendIntake: (id: string, text: string) => req("POST", `/api/topics/${id}/messages`, { text }),
  next: (id: string) => req<{ queued: boolean }>("POST", `/api/topics/${id}/next`),
  stop: (id: string) => req("POST", `/api/topics/${id}/stop`),
  deleteTopic: (id: string) => req<{ ok: boolean; folderRemoved: boolean }>("DELETE", `/api/topics/${id}`),
  references: (id: string) => req<Reference[]>("GET", `/api/topics/${id}/references`),
  tutorMessages: (id: string, lesson: string, after = 0) =>
    req<Message[]>("GET", `/api/topics/${id}/lessons/${lesson}/tutor?after=${after}`),
  sendTutor: (id: string, lesson: string, text: string) => req("POST", `/api/topics/${id}/lessons/${lesson}/tutor`, { text }),
};

/** Poll a loader every `ms` while mounted. The UI polls instead of using a socket. */
export function usePoll<T>(load: (() => Promise<T>) | null, ms: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!load) { setData(null); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        const d = await load();
        if (alive) { setData(d); setError(null); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
      if (alive) timer = setTimeout(run, ms);
    };
    run();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, refresh: () => setTick((t) => t + 1) };
}

/**
 * Append-only message list for a thread, fetched with an `after` cursor.
 * `baseline` is the newest ID of the first fetch: messages above it arrived while the view was open.
 */
export function useThread(load: ((after: number) => Promise<Message[]>) | null, ms: number, key: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [baseline, setBaseline] = useState<number | null>(null);
  const last = useRef(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setMessages([]);
    setBaseline(null);
    last.current = 0;
  }, [key]);
  useEffect(() => {
    if (!load) return;
    let alive = true;
    let first = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        const fresh = await load(last.current);
        if (!alive) return;
        if (fresh.length) {
          last.current = fresh[fresh.length - 1].id;
          setMessages((m) => [...m, ...fresh]);
        }
        if (first) { setBaseline((b) => b ?? last.current); first = false; }
      } catch { /* retry on next poll */ }
      if (alive) timer = setTimeout(run, ms);
    };
    run();
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  return { messages, baseline, refresh: () => setTick((t) => t + 1) };
}

/**
 * Remember which IDs existed when a list first rendered, and which were already done,
 * so entrance motion plays only for items that arrive or finish while the user watches.
 */
export function useArrivals(ids: string[], doneIds: string[]) {
  const seen = useRef<Set<string> | null>(null);
  const done = useRef<Set<string> | null>(null);
  const fresh = new Set<string>();
  const justDone = new Set<string>();
  if (seen.current) for (const id of ids) if (!seen.current.has(id)) fresh.add(id);
  if (done.current) for (const id of doneIds) if (!done.current.has(id)) justDone.add(id);
  useEffect(() => {
    seen.current = new Set(ids);
    done.current = new Set(doneIds);
  });
  return { fresh, justDone };
}

import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { Lessons, Messages, Responses, Runs, Topics } from "./db.ts";
import { APP_ROOT, WEB_DIST, resolveInTopic, topicDir } from "./paths.ts";
import { requestNextLesson, sendIntakeMessage, sendTutorMessage, stopTopicRuns, stopTopicRunsAndWait } from "./runner.ts";
import { deleteAgentSessions, killProcessesIn, removeFolder } from "./cleanup.ts";

const app = new Hono();
const BRIDGE = fs.readFileSync(path.join(APP_ROOT, "server", "bridge.js"), "utf8");
// Lesson pages get the app's tokens and lesson kit, so Athena's pages look native.
const readShared = (f: string) => fs.readFileSync(path.join(APP_ROOT, "shared", f), "utf8");
const LESSON_CSS = () => readShared("tokens.css") + "\n" + readShared("lesson.css");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

/** Send a file. Supports Range requests so videos can seek. */
function sendFile(c: Context, abs: string) {
  const stat = fs.statSync(abs);
  const type = MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  const range = c.req.header("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) return c.body(null, 416, { "content-range": `bytes */${stat.size}` });
    const stream = Readable.toWeb(fs.createReadStream(abs, { start, end })) as ReadableStream;
    return c.body(stream, 206, {
      "content-type": type, "accept-ranges": "bytes", "content-length": String(end - start + 1),
      "content-range": `bytes ${start}-${end}/${stat.size}`,
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(abs)) as ReadableStream;
  return c.body(stream, 200, { "content-type": type, "accept-ranges": "bytes", "content-length": String(stat.size) });
}

// ---- Workspace files (lessons, references, media), shown in the iframe ----

app.get("/bridge.js", (c) => c.body(BRIDGE, 200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" }));
app.get("/stoa/lesson.css", (c) => c.body(LESSON_CSS(), 200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" }));

app.get("/w/:topic/*", (c) => {
  const topic = c.req.param("topic");
  const rel = decodeURIComponent(c.req.path.slice(`/w/${encodeURIComponent(topic)}/`.length));
  const abs = resolveInTopic(topic, rel);
  if (!Topics.get(topic) || !abs || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) return c.notFound();
  if (/\.html?$/i.test(abs)) {
    let html = fs.readFileSync(abs, "utf8");
    // Kit first, so the page's own styles override it; the bridge sets the theme before paint.
    const tag = `<link rel="stylesheet" href="/stoa/lesson.css"><script src="/bridge.js"></script>`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + tag) : tag + html;
    return c.html(html, 200, { "cache-control": "no-cache" });
  }
  return sendFile(c, abs);
});

// ---- API ----

const api = new Hono();

function slug(text: string) {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 5).join("-");
  return `${s || "topic"}-${randomBytes(3).toString("hex")}`;
}

/** A short sidebar title until Athena sets the real one at the end of intake. */
function workingTitle(message: string) {
  let t = message.trim().split(/[.\n!?]/)[0]
    .replace(/^(hi|hey|hello)[,!\s]+/i, "")
    .replace(/^(i\s+(want|would like|'d like|need)\s+to\s+(learn|understand|know)\s+(about\s+|how\s+to\s+)?|teach me\s+(about\s+|how\s+to\s+)?|learn\s+)/i, "")
    .trim();
  if (t.length > 40) t = t.slice(0, 40).replace(/\s+\S*$/, "") + "…";
  return t ? t[0].toUpperCase() + t.slice(1) : "New topic";
}

function topicState(id: string) {
  const topic = Topics.get(id);
  if (!topic) return null;
  const counts = new Map(Responses.counts(id).map((r) => [r.lesson_id, r]));
  const lessons = Lessons.list(id).map((l) => ({ ...l, responses: counts.get(l.id) ?? { n: 0, right: 0, graded: 0 } }));
  const active = Runs.active(id);
  const lastTeacher = Runs.last(id, "build") ?? Runs.last(id, "intake");
  const teacherRun = active.find((r) => r.kind !== "tutor" && r.status === "running");
  const building = active.some((r) => r.kind === "build") || (topic.phase === "learning" && active.some((r) => r.kind === "intake"));
  // A run makes a new lesson only if the newest lesson existed before it started; otherwise it is
  // still finishing that lesson (its video, notes, references).
  const newest = lessons.at(-1);
  const buildingNew = building && (!newest || !teacherRun?.started_at || newest.created_at < teacherRun.started_at);
  return {
    topic,
    lessons,
    busy: active.some((r) => r.kind !== "tutor"),
    building,
    buildingNew,
    tutorBusy: active.filter((r) => r.kind === "tutor").map((r) => r.lesson_id),
    lastError: lastTeacher?.status === "error" ? lastTeacher.error : null,
  };
}

api.get("/topics", (c) =>
  c.json(Topics.list().map((t) => {
    const lessons = Lessons.list(t.id);
    return {
      ...t,
      busy: Runs.active(t.id).some((r) => r.kind !== "tutor"),
      lessonCount: lessons.length,
      doneCount: lessons.filter((l) => l.completed_at).length,
    };
  })));

api.post("/topics", async (c) => {
  const { message } = await c.req.json<{ message: string }>();
  if (!message?.trim()) return c.json({ error: "Write what you want to learn." }, 400);
  const id = slug(message);
  fs.mkdirSync(topicDir(id), { recursive: true });
  Topics.create(id, workingTitle(message));
  sendIntakeMessage(id, message.trim(), true);
  return c.json({ id });
});

api.get("/topics/:id", (c) => {
  const state = topicState(c.req.param("id"));
  return state ? c.json(state) : c.notFound();
});

api.get("/topics/:id/messages", (c) => {
  const thread = c.req.query("thread") ?? "teacher";
  const after = Number(c.req.query("after") ?? 0);
  return c.json(Messages.list(c.req.param("id"), thread, after));
});

api.post("/topics/:id/messages", async (c) => {
  const id = c.req.param("id");
  const topic = Topics.get(id);
  if (!topic) return c.notFound();
  if (topic.phase !== "intake") return c.json({ error: "The intake chat is closed. Use the tutor in a lesson." }, 409);
  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: "Empty message" }, 400);
  sendIntakeMessage(id, text.trim(), false);
  return c.json({ ok: true });
});

api.post("/topics/:id/next", (c) => {
  const id = c.req.param("id");
  if (!Topics.get(id)) return c.notFound();
  return c.json({ queued: requestNextLesson(id, "the learner clicked Next lesson") });
});

api.post("/topics/:id/stop", (c) => c.json({ stopped: stopTopicRuns(c.req.param("id")) }));

/**
 * Delete a topic and everything it made: stop its agents and their tools, then remove the
 * database rows (lessons, answers, chats, runs), the workspace folder (lessons, videos, notes)
 * and the agent session transcripts.
 */
api.delete("/topics/:id", async (c) => {
  const id = c.req.param("id");
  if (!Topics.get(id)) return c.notFound();
  const dir = topicDir(id);
  await stopTopicRunsAndWait(id);
  const killed = killProcessesIn(dir);
  Topics.remove(id); // cascades to lessons, messages, responses, runs
  const sessions = await deleteAgentSessions(dir);
  const folderRemoved = await removeFolder(dir);
  console.log(`[delete] ${new Date().toISOString()} ${id} (client: ${c.req.header("user-agent")?.slice(0, 60) ?? "unknown"}): ` +
    `${sessions} sessions, ${killed} processes stopped, folder removed: ${folderRemoved}`);
  return c.json({ ok: true, folderRemoved });
});

api.get("/topics/:id/references", (c) => {
  const dir = resolveInTopic(c.req.param("id"), "reference");
  if (!dir || !fs.existsSync(dir)) return c.json([]);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html")).sort();
  return c.json(files.map((f) => {
    const html = fs.readFileSync(path.join(dir, f), "utf8");
    const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || f.replace(/\.html$/, "");
    return { file: `reference/${f}`, title };
  }));
});

api.get("/topics/:id/lessons/:lesson", (c) => {
  const l = Lessons.get(c.req.param("id"), c.req.param("lesson"));
  return l ? c.json(l) : c.notFound();
});

api.get("/topics/:id/lessons/:lesson/responses", (c) => c.json(Responses.list(c.req.param("id"), c.req.param("lesson"))));

api.post("/topics/:id/lessons/:lesson/responses", async (c) => {
  const id = c.req.param("id"), lesson = c.req.param("lesson");
  if (!Lessons.get(id, lesson)) return c.notFound();
  const body = await c.req.json<any>();
  if (typeof body?.itemId !== "string" || !body.itemId) return c.json({ error: "itemId is required" }, 400);
  const correct = body.correct === true ? true : body.correct === false ? false : null;
  const prompt = body.prompt == null ? undefined : String(body.prompt);
  Responses.add(id, lesson, { itemId: body.itemId, prompt, answer: body.answer, correct, meta: body.meta });
  return c.json({ ok: true });
});

api.post("/topics/:id/lessons/:lesson/complete", async (c) => {
  const id = c.req.param("id"), lesson = c.req.param("lesson");
  if (!Lessons.get(id, lesson)) return c.notFound();
  const body = await c.req.json<unknown>().catch(() => ({}));
  Lessons.complete(id, lesson, body);
  // Only the newest lesson starts the next build; finishing an old lesson again does not.
  const newest = Lessons.list(id).at(-1)?.id;
  const queued = newest === lesson ? requestNextLesson(id, `the learner completed lesson ${lesson}`) : false;
  return c.json({ ok: true, queued });
});

api.get("/topics/:id/lessons/:lesson/tutor", (c) =>
  c.json(Messages.list(c.req.param("id"), `tutor:${c.req.param("lesson")}`, Number(c.req.query("after") ?? 0))));

api.post("/topics/:id/lessons/:lesson/tutor", async (c) => {
  const id = c.req.param("id"), lesson = c.req.param("lesson");
  if (!Lessons.get(id, lesson)) return c.notFound();
  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: "Empty message" }, 400);
  sendTutorMessage(id, lesson, text.trim());
  return c.json({ ok: true });
});

app.route("/api", api);

// ---- React app (production build) ----

app.get("*", (c) => {
  if (!fs.existsSync(WEB_DIST)) return c.text("Web app not built. Run `npm run build`, or use `npm run dev`.", 404);
  const rel = c.req.path.replace(/^\/+/, "");
  const abs = path.resolve(WEB_DIST, rel);
  if (rel && abs.startsWith(WEB_DIST + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return sendFile(c, abs);
  return c.html(fs.readFileSync(path.join(WEB_DIST, "index.html"), "utf8"));
});

const port = Number(process.env.PORT ?? 3210);
serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? "127.0.0.1" }, () => {
  console.log(`learning-app server on http://localhost:${port}`);
});

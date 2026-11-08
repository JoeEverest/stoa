import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import { serve } from "@hono/node-server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { randomBytes } from "node:crypto";
import { Lessons, Messages, Responses, Runs, Topics, Uploads } from "./db.ts";
import { APP_ROOT, WEB_DIST, resolveInTopic, topicDir } from "./paths.ts";
import { announceUploads, requestNextLesson, requestVideoRemake, sendIntakeMessage, sendTutorMessage, stopTopicRuns, stopTopicRunsAndWait } from "./runner.ts";
import { deleteAgentSessions, killProcessesIn, removeFolder } from "./cleanup.ts";
import { publishStrandedLessons } from "./mcp.ts";
import { DESKTOP, applySecret, checkClaude, settingsChanged, setupState, startCliInstall, startToolInstall, testConnection } from "./setup.ts";
import { publicSettings, saveSettings, type SecretName } from "./settings.ts";
import { cliStatus } from "./claudecli.ts";
import { writeShims } from "./runtimes.ts";
import { UploadError, checkName, deleteUpload, saveUpload } from "./uploads.ts";

const app = new Hono();
const port = Number(process.env.PORT ?? 3210);

// The desktop app runs this server on 127.0.0.1 for its own window only. Other local programs and
// web pages (DNS rebinding) must not reach it: require the app's Host and its per-launch cookie.
const TOKEN = process.env.STOA_TOKEN;
if (TOKEN) {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  app.use("*", async (c, next) => {
    if (!hosts.has(c.req.header("host") ?? "") || getCookie(c, "stoa_token") !== TOKEN) return c.text("Forbidden", 403);
    await next();
  });
}
const BRIDGE = fs.readFileSync(path.join(APP_ROOT, "server", "bridge.js"), "utf8");
// Lesson pages get the app's tokens and lesson kit, so Athena's pages look native.
const readShared = (f: string) => fs.readFileSync(path.join(APP_ROOT, "shared", f), "utf8");
const LESSON_CSS = () => readShared("tokens.css") + "\n" + readShared("lesson.css");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".csv": "text/plain; charset=utf-8",
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
app.get("/stoa/palette.css", (c) => c.body(readShared("palette.css"), 200, { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" }));

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
    // The lesson palette goes last, after the page's own styles and its topic.css, so lessons keep
    // to the palette (shared/palette.css) even when a topic once chose other colors.
    const palette = `<link rel="stylesheet" href="/stoa/palette.css">`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, palette + "</head>") : html + palette;
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

/** How many exercise cards a lesson page has (the kit's `.exercise` class), for "1 of 3 answered". Cached by mtime. */
const exerciseCache = new Map<string, { mtime: number; n: number }>();
function exerciseCount(topicId: string, file: string) {
  const abs = resolveInTopic(topicId, file);
  if (!abs) return null;
  try {
    const mtime = fs.statSync(abs).mtimeMs;
    const hit = exerciseCache.get(abs);
    if (hit?.mtime === mtime) return hit.n;
    const n = (fs.readFileSync(abs, "utf8").match(/<section\b[^>]*\bclass="[^"]*\bexercise\b/gi) ?? []).length;
    exerciseCache.set(abs, { mtime, n });
    return n;
  } catch { return null; }
}

function topicState(id: string) {
  const topic = Topics.get(id);
  if (!topic) return null;
  if (topic.phase === "learning") publishStrandedLessons(id);
  const counts = new Map(Responses.counts(id).map((r) => [r.lesson_id, r]));
  const lessons = Lessons.list(id).map((l) => ({
    ...l, responses: counts.get(l.id) ?? { n: 0, right: 0, graded: 0 }, exercises: exerciseCount(id, l.file),
  }));
  const active = Runs.active(id);
  const lastTeacher = Runs.last(id, "build") ?? Runs.last(id, "intake");
  const teacherRun = active.find((r) => r.kind !== "tutor" && r.status === "running");
  const building = active.some((r) => r.kind === "build" || r.kind === "video") || (topic.phase === "learning" && active.some((r) => r.kind === "intake"));
  // A run makes a new lesson only if the newest lesson existed before it started; otherwise it is
  // still finishing that lesson (its video, notes, references).
  const newest = lessons.at(-1);
  // Only a build (or the intake run that goes on to lesson 1) makes a new lesson; a video remake does not.
  const makesLesson = active.some((r) => r.kind === "build" || r.kind === "intake") && teacherRun?.kind !== "video";
  const buildingNew = building && makesLesson && (!newest || !teacherRun?.started_at || newest.created_at < teacherRun.started_at);
  return {
    topic,
    lessons,
    busy: active.some((r) => r.kind !== "tutor"),
    building,
    buildingNew,
    tutorBusy: active.filter((r) => r.kind === "tutor").map((r) => r.lesson_id),
    /** When the teacher run that is working now started (UTC, SQLite format), for "Started 3 min ago". */
    workingSince: teacherRun?.started_at ?? null,
    lastError: lastTeacher?.status === "error" ? lastTeacher.error : null,
  };
}

api.get("/topics", (c) =>
  c.json(Topics.list().map((t) => {
    const lessons = Lessons.list(t.id);
    // The lesson to pick up: the first one not finished, else the newest. For "Continue learning".
    const i = lessons.findIndex((l) => !l.completed_at);
    const at = i >= 0 ? i : lessons.length - 1;
    return {
      ...t,
      busy: Runs.active(t.id).some((r) => r.kind !== "tutor"),
      lessonCount: lessons.length,
      doneCount: lessons.filter((l) => l.completed_at).length,
      next: at >= 0 ? {
        id: lessons[at].id, title: lessons[at].title, n: at + 1, done: !!lessons[at].completed_at,
        // For the home page's preview: the lesson's video and poster, when it has one.
        video: lessons[at].video_file ? {
          file: `/w/${encodeURIComponent(t.id)}/${lessons[at].video_file}`,
          poster: lessons[at].video_poster ? `/w/${encodeURIComponent(t.id)}/${lessons[at].video_poster}` : null,
        } : null,
      } : null,
    };
  })));

/**
 * Create a topic. With `start: false` the first message is saved but Athena does not start until
 * POST /topics/:id/start, so files the learner attached can be uploaded first.
 */
api.post("/topics", async (c) => {
  const { message, start = true } = await c.req.json<{ message: string; start?: boolean }>();
  if (!message?.trim()) return c.json({ error: "Write what you want to learn." }, 400);
  const id = slug(message);
  fs.mkdirSync(topicDir(id), { recursive: true });
  Topics.create(id, workingTitle(message));
  if (start) sendIntakeMessage(id, message.trim(), true);
  else Messages.add(id, "teacher", "user", message.trim());
  return c.json({ id });
});

/** Start the intake of a topic created with `start: false`, from the messages saved so far. */
function startIntake(id: string) {
  const text = Messages.list(id, "teacher").filter((m) => m.role === "user").map((m) => m.content).join("\n\n");
  sendIntakeMessage(id, text, true, false);
}

api.post("/topics/:id/start", (c) => {
  const id = c.req.param("id");
  if (!Topics.get(id)) return c.notFound();
  if (Runs.last(id, "intake")) return c.json({ started: false });
  startIntake(id);
  return c.json({ started: true });
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
  if (!Runs.last(id, "intake")) {
    // The topic was never started (the app closed while files uploaded): start with everything said.
    Messages.add(id, "teacher", "user", text.trim());
    startIntake(id);
  } else {
    sendIntakeMessage(id, text.trim(), false);
  }
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

// ---- The learner's own files ----

api.get("/topics/:id/uploads", (c) => c.json(Uploads.list(c.req.param("id"))));

/** Body: the raw file. Query: ?name=<file name>. Streams to disk, so large textbooks are fine. */
api.put("/topics/:id/uploads", async (c) => {
  const id = c.req.param("id");
  if (!Topics.get(id)) return c.notFound();
  const name = (c.req.query("name") ?? "").trim();
  if (!name) return c.json({ error: "The file has no name." }, 400);
  try {
    checkName(name);
    const declared = Number(c.req.header("content-length") ?? 0);
    if (declared > 500 * 1024 * 1024) throw new UploadError("The file is larger than 500 MB.", 413);
    const upload = await saveUpload(id, name, c.req.raw.body);
    // A teacher run that is working now gets the file as a steering message.
    return c.json({ ...upload, steered: announceUploads(id) });
  } catch (err) {
    if (err instanceof UploadError) return c.json({ error: err.message }, err.status);
    console.error("[upload]", err);
    return c.json({ error: "Stoa could not save the file." }, 500);
  }
});

api.delete("/topics/:id/uploads/:upload", (c) => {
  const id = c.req.param("id");
  const u = Uploads.get(id, Number(c.req.param("upload")));
  if (!u) return c.notFound();
  deleteUpload(id, u);
  return c.json({ ok: true });
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

/** The learner asks Athena for a new video for a lesson. Body: { reason?: string } (what should be better). */
api.post("/topics/:id/lessons/:lesson/video/remake", async (c) => {
  const id = c.req.param("id"), lesson = c.req.param("lesson");
  const l = Lessons.get(id, lesson);
  if (!l) return c.notFound();
  if (!l.video_file && l.video_status !== "failed") return c.json({ error: "This lesson has no video to remake yet." }, 409);
  const body = await c.req.json<{ reason?: unknown }>().catch(() => ({} as { reason?: unknown }));
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 2000) : "";
  return c.json({ queued: requestVideoRemake(id, lesson, reason) });
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

// ---- Desktop setup (Claude access, video tools) ----

api.get("/setup", async (c) => c.json(await setupState()));
api.post("/setup/claude/check", async (c) => {
  if (!DESKTOP) return c.notFound();
  await checkClaude(true);
  return c.json(await setupState());
});
api.post("/setup/tools/install", (c) => (DESKTOP ? c.json(startToolInstall()) : c.notFound()));
api.get("/setup/cli", async (c) => (DESKTOP ? c.json(await cliStatus(c.req.query("force") === "1")) : c.notFound()));
api.post("/setup/cli/install", async (c) => (DESKTOP ? c.json(await startCliInstall()) : c.notFound()));

// ---- Settings (connection and models) ----

api.get("/settings", (c) => c.json({ ...publicSettings(), desktop: DESKTOP }));
api.put("/settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  // The connection is the desktop app's to change; a web server keeps the one in its environment.
  if (!DESKTOP && body && typeof body === "object") { delete body.provider; delete body.custom; delete body.bedrock; }
  const error = saveSettings(body);
  if (error) return c.json({ error }, 400);
  settingsChanged();
  return c.json({ ...publicSettings(), desktop: DESKTOP });
});
api.post("/settings/test", async (c) => c.json(await testConnection()));

app.route("/api", api);

// ---- React app (production build) ----

app.get("*", (c) => {
  if (!fs.existsSync(WEB_DIST)) return c.text("Web app not built. Run `npm run build`, or use `npm run dev`.", 404);
  const rel = c.req.path.replace(/^\/+/, "");
  const abs = path.resolve(WEB_DIST, rel);
  if (rel && abs.startsWith(WEB_DIST + path.sep) && fs.existsSync(abs) && fs.statSync(abs).isFile()) return sendFile(c, abs);
  return c.html(fs.readFileSync(path.join(WEB_DIST, "index.html"), "utf8"));
});

writeShims();

const server = serve({ fetch: app.fetch, port, hostname: process.env.HOST ?? "127.0.0.1" }, (info) => {
  console.log(`Stoa server on http://localhost:${info.port}`);
  process.parentPort?.postMessage({ type: "listening", port: info.port });
});

// Messages from the desktop shell (Electron utilityProcess).
process.parentPort?.on("message", async (e: { data: any }) => {
  const msg = e.data;
  if (msg?.type === "secret" && ["anthropic", "custom", "bedrock"].includes(msg.name)) {
    await applySecret(msg.name as SecretName, msg.value ?? null);
    process.parentPort?.postMessage({ type: "secret-applied", name: msg.name });
  } else if (msg?.type === "shutdown") {
    await shutdown();
  }
});

/** Stop every agent run (and the tools it started) before the process ends. */
async function shutdown() {
  server.close();
  await Promise.allSettled(Topics.list().map((t) => stopTopicRunsAndWait(t.id, 5000)));
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

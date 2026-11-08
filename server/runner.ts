import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { query, type Options, type SDKMessage, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Lessons, Messages, Runs, Topics, Uploads, type Run } from "./db.ts";
import { PLUGIN_DIR, topicDir } from "./paths.ts";
import { teacherMcp, tutorMcp } from "./mcp.ts";
import { runtimeEnv } from "./runtimes.ts";
import { TEACHER_SYSTEM, buildPrompt, intakePrompt, intakeReply, tutorSystem, videoRemakePrompt } from "./prompts.ts";
import { uploadsNotice, uploadsSteer } from "./uploads.ts";

const MODEL = process.env.LEARN_MODEL ?? "claude-opus-5-5";
const TUTOR_MODEL = process.env.TUTOR_MODEL ?? MODEL;

/** The app plugin's skills plus two built-in skills that help with research and charts. */
const TEACHER_SKILLS = [
  ...fs.readdirSync(path.join(PLUGIN_DIR, "skills")).map((name) => `learn:${name}`),
  "deep-research",
  "dataviz",
];

/** The agents' environment: this process's, plus the desktop app's video tools when installed. */
const agentEnv = () => ({ ...process.env, ...runtimeEnv(), CLAUDE_AGENT_SDK_CLIENT_APP: "stoa/0.1.0" });

/** One promise chain per key. Teacher runs use the topic ID; tutor runs use topic + lesson. */
const chains = new Map<string, Promise<void>>();
const aborts = new Map<number, AbortController>();

function enqueue(key: string, job: () => Promise<void>) {
  const next = (chains.get(key) ?? Promise.resolve()).then(job, job).catch((err) => {
    console.error(`[queue ${key}]`, err instanceof Error ? err.message : err);
  });
  chains.set(key, next);
  return next;
}

type RunSpec = {
  run: number;
  topicId: string;
  thread: string;
  prompt: string;
  options: Options;
  onSession?: (sessionId: string) => void;
  /** Teacher runs: the learner can steer the running agent (for now: files they add). */
  steerable?: boolean;
};

/** The running teacher run of each topic, which accepts steering messages. */
type Live = { run: number; steer: (text: string) => boolean; accepting: () => boolean; announced: Set<number> };
const live = new Map<string, Live>();

/**
 * The agent's input in streaming mode: the first prompt, then any steering messages. It stays open
 * until the run is over, so messages can reach the agent while it works.
 */
function inputChannel() {
  const queue: SDKUserMessage[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  return {
    iterable: {
      async *[Symbol.asyncIterator]() {
        for (;;) {
          while (queue.length) yield queue.shift()!;
          if (closed) return;
          await new Promise<void>((r) => { wake = r; });
          wake = null;
        }
      },
    } as AsyncIterable<SDKUserMessage>,
    get closed() { return closed; },
    push(text: string, priority?: SDKUserMessage["priority"]) {
      if (closed) return null;
      const uuid = randomUUID();
      queue.push({ type: "user", message: { role: "user", content: text }, parent_tool_use_id: null, uuid, ...(priority && { priority }) });
      wake?.();
      return uuid;
    },
    close() { closed = true; wake?.(); },
  };
}

/** How long to wait, after a turn ends with a steering message not taken in, for the turn that answers it. */
const STEER_GRACE_MS = 20_000;

async function execute({ run, topicId, thread, prompt, options, onSession, steerable }: RunSpec) {
  if (Runs.get(run)?.status !== "queued") return; // stopped while it waited
  const abortController = new AbortController();
  aborts.set(run, abortController);
  Runs.start(run);
  let cost: number | null = null;
  let pending: string | null = null;
  const input = inputChannel();
  input.push(prompt);
  // Steering messages the agent has not taken in yet. "next" folds a message into the running turn
  // between tool calls; one sent after the turn's last tool call starts a new turn instead. The CLI
  // reports each message's state (queued, started, completed) as a command_lifecycle message.
  const unconsumed = new Set<string>();
  let grace: ReturnType<typeof setTimeout> | null = null;
  const stopGrace = () => { if (grace) clearTimeout(grace); grace = null; };
  if (steerable) {
    live.set(topicId, {
      run,
      announced: new Set(Uploads.unread(topicId).map((u) => u.id)), // already in the prompt
      accepting: () => !input.closed,
      steer: (text) => {
        const uuid = input.push(text, "next");
        if (uuid) unconsumed.add(uuid);
        return !!uuid;
      },
    });
  }
  try {
    const stream = query({ prompt: input.iterable, options: { ...options, abortController } });
    for await (const msg of stream as AsyncIterable<SDKMessage>) {
      const m = msg as any;
      if (m.type === "command_lifecycle" && m.state === "started" && unconsumed.delete(m.command_uuid)) {
        stopGrace(); // after a result: the agent took it up in a new turn
      } else if (msg.type === "system" && msg.subtype === "init") {
        Runs.setSession(run, msg.session_id);
        onSession?.(msg.session_id);
      } else if (msg.type === "assistant" && msg.parent_tool_use_id === null) {
        // Text before a later tool call is progress ("activity"); only the last text is the reply.
        const text = msg.message.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text as string)
          .join("\n")
          .trim();
        if (text) {
          if (pending) Messages.add(topicId, thread, "activity", pending);
          pending = text;
        }
      } else if (msg.type === "result") {
        if (pending) Messages.add(topicId, thread, "assistant", pending);
        pending = null;
        cost = (msg as any).total_cost_usd ?? null; // cumulative across turns
        if (msg.subtype !== "success") throw new Error(`Agent stopped: ${msg.subtype}`);
        if (!unconsumed.size) input.close(); // done: the stream ends
        // A steering message is still waiting: the agent answers it in one more turn. If that turn does
        // not start (a CLI that does not report command_lifecycle), end the run after a short wait.
        else grace = setTimeout(() => input.close(), STEER_GRACE_MS);
      }
    }
    Runs.finish(run, "done", null, cost);
  } catch (err) {
    const message = abortController.signal.aborted ? "Stopped" : err instanceof Error ? err.message : String(err);
    console.error(`[run ${run}]`, message);
    // The topic may have been deleted while this run stopped; then these writes have nowhere to go.
    if (Topics.get(topicId)) {
      try {
        if (pending) Messages.add(topicId, thread, "assistant", pending);
        Runs.finish(run, "error", message, cost);
        if (Runs.get(run)?.kind !== "tutor") Lessons.abandonPlannedVideos(topicId, `The video was not finished: ${message}`);
        Messages.add(topicId, thread, "activity", `The agent stopped: ${message}`);
      } catch { /* topic removed mid-write */ }
    }
  } finally {
    stopGrace();
    input.close();
    if (live.get(topicId)?.run === run) live.delete(topicId);
    aborts.delete(run);
  }
}

const steerTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Tell the running teacher run about files the learner just added. Files added close together go
 * in one message. Returns false when no teacher run is working; the next run's prompt lists them.
 */
export function announceUploads(topicId: string) {
  if (!live.get(topicId)?.accepting()) return false;
  clearTimeout(steerTimers.get(topicId));
  steerTimers.set(topicId, setTimeout(() => {
    steerTimers.delete(topicId);
    const l = live.get(topicId);
    if (!l) return;
    const fresh = Uploads.unread(topicId).filter((u) => !l.announced.has(u.id));
    if (!fresh.length || !l.steer(uploadsSteer(fresh))) return;
    for (const u of fresh) l.announced.add(u.id);
    const names = fresh.map((u) => u.name).join(", ");
    Messages.add(topicId, "teacher", "activity", `You added ${names}. Athena got ${fresh.length === 1 ? "it" : "them"} while she works.`);
  }, 1500));
  return true;
}

function teacherOptions(topicId: string, resume?: string): Options {
  return {
    cwd: topicDir(topicId),
    model: MODEL,
    effort: "high",
    resume,
    systemPrompt: { type: "preset", preset: "claude_code", append: TEACHER_SYSTEM },
    tools: { type: "preset", preset: "claude_code" },
    // Isolate the agent from the host user's Claude settings; load only the app plugin.
    settingSources: [],
    plugins: [{ type: "local", path: PLUGIN_DIR }],
    skills: TEACHER_SKILLS,
    mcpServers: { learn: teacherMcp(topicId) },
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    env: agentEnv(),
  };
}

/**
 * Intake: each learner message is one run that resumes the intake session. `record: false` runs a
 * message that is already in the chat (a topic created first, then started after its uploads).
 */
export function sendIntakeMessage(topicId: string, text: string, first: boolean, record = true) {
  if (record) Messages.add(topicId, "teacher", "user", text);
  const run = Runs.create(topicId, "intake");
  return enqueue(topicId, () => {
    const topic = Topics.get(topicId);
    if (!topic) return Promise.resolve();
    return execute({
      run, topicId, thread: "teacher",
      prompt: first ? intakePrompt(text, uploadsNotice(topicId)) : intakeReply(text, uploadsNotice(topicId)),
      options: teacherOptions(topicId, topic.intake_session_id ?? undefined),
      steerable: true,
      onSession: (id) => Topics.update(topicId, { intake_session_id: id }),
    });
  });
}

/**
 * Queue a build of the next lesson in a new session. Returns false when a build is already
 * queued or running, so a double trigger (button + learn.complete) builds one lesson only.
 */
export function requestNextLesson(topicId: string, reason: string) {
  if (Runs.active(topicId).some((r) => r.kind === "build")) return false;
  const run = Runs.create(topicId, "build");
  Topics.update(topicId, { status_message: "Next lesson queued" });
  enqueue(topicId, () =>
    execute({ run, topicId, thread: "teacher", prompt: buildPrompt(reason, uploadsNotice(topicId)), options: teacherOptions(topicId), steerable: true }),
  );
  return true;
}

/**
 * Queue a remake of one lesson's video (the learner asked from the video player). The old video
 * stays attached and playable; the lesson shows "being remade" until Athena publishes the new one.
 * Returns false when a remake of this lesson is already queued or running.
 */
export function requestVideoRemake(topicId: string, lessonId: string, reason: string) {
  const lesson = Lessons.get(topicId, lessonId);
  if (!lesson) return false;
  if (Runs.active(topicId).some((r) => r.kind === "video" && r.lesson_id === lessonId)) return false;
  const n = Lessons.list(topicId).findIndex((l) => l.id === lessonId) + 1;
  Lessons.setVideo(topicId, lessonId, "planned", lesson.video_file, lesson.video_poster, null);
  const run = Runs.create(topicId, "video", lessonId);
  Topics.update(topicId, { status_message: `Remaking the video for lesson ${n}` });
  enqueue(topicId, () =>
    execute({
      run, topicId, thread: "teacher",
      prompt: videoRemakePrompt(lesson, n, reason.trim(), uploadsNotice(topicId)),
      options: teacherOptions(topicId), steerable: true,
    }),
  );
  return true;
}

export function sendTutorMessage(topicId: string, lessonId: string, text: string) {
  const thread = `tutor:${lessonId}`;
  Messages.add(topicId, thread, "user", text);
  const run = Runs.create(topicId, "tutor", lessonId);
  return enqueue(`${topicId}:${lessonId}`, () => {
    const lesson = Lessons.get(topicId, lessonId);
    if (!lesson) return Promise.resolve();
    return execute({
      run, topicId, thread, prompt: text,
      options: {
        cwd: topicDir(topicId),
        model: TUTOR_MODEL,
        effort: "medium",
        resume: lesson.tutor_session_id ?? undefined,
        systemPrompt: tutorSystem(lesson),
        tools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
        allowedTools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch", "mcp__tutor__add_lesson_note", "mcp__tutor__get_responses", "mcp__tutor__list_uploads"],
        // Anything not listed above is denied without a prompt.
        permissionMode: "dontAsk",
        settingSources: [],
        mcpServers: { tutor: tutorMcp(topicId, lessonId) },
        env: agentEnv(),
      },
      onSession: (id) => Lessons.setTutorSession(topicId, lessonId, id),
    });
  });
}

/** Stop every run of a topic (teacher and tutors) and wait until they have ended, at most `ms`. */
export async function stopTopicRunsAndWait(topicId: string, ms = 10_000) {
  stopTopicRuns(topicId);
  const keys = [...chains.keys()].filter((k) => k === topicId || k.startsWith(`${topicId}:`));
  await Promise.race([
    Promise.allSettled(keys.map((k) => chains.get(k))),
    new Promise((r) => setTimeout(r, ms)),
  ]);
  for (const k of keys) chains.delete(k);
}

export function stopTopicRuns(topicId: string) {
  const active: Run[] = Runs.active(topicId);
  Runs.cancelQueued(topicId);
  for (const r of active) aborts.get(r.id)?.abort();
  Topics.update(topicId, { status_message: "Stopped" });
  return active.length;
}

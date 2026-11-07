import fs from "node:fs";
import path from "node:path";
import { query, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { Lessons, Messages, Runs, Topics, type Run } from "./db.ts";
import { PLUGIN_DIR, topicDir } from "./paths.ts";
import { teacherMcp, tutorMcp } from "./mcp.ts";
import { TEACHER_SYSTEM, buildPrompt, intakePrompt, intakeReply, tutorSystem } from "./prompts.ts";

const MODEL = process.env.LEARN_MODEL ?? "claude-opus-5-5";
const TUTOR_MODEL = process.env.TUTOR_MODEL ?? MODEL;

/** The app plugin's skills plus two built-in skills that help with research and charts. */
const TEACHER_SKILLS = [
  ...fs.readdirSync(path.join(PLUGIN_DIR, "skills")).map((name) => `learn:${name}`),
  "deep-research",
  "dataviz",
];

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
};

async function execute({ run, topicId, thread, prompt, options, onSession }: RunSpec) {
  if (Runs.get(run)?.status !== "queued") return; // stopped while it waited
  const abortController = new AbortController();
  aborts.set(run, abortController);
  Runs.start(run);
  let cost: number | null = null;
  let pending: string | null = null;
  try {
    const stream = query({ prompt, options: { ...options, abortController } });
    for await (const msg of stream as AsyncIterable<SDKMessage>) {
      if (msg.type === "system" && msg.subtype === "init") {
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
        cost = (msg as any).total_cost_usd ?? null;
        if (msg.subtype !== "success") throw new Error(`Agent stopped: ${msg.subtype}`);
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
    aborts.delete(run);
  }
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
    env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "stoa/0.1.0" },
  };
}

/** Intake: each learner message is one run that resumes the intake session. */
export function sendIntakeMessage(topicId: string, text: string, first: boolean) {
  Messages.add(topicId, "teacher", "user", text);
  const run = Runs.create(topicId, "intake");
  return enqueue(topicId, () => {
    const topic = Topics.get(topicId);
    if (!topic) return Promise.resolve();
    return execute({
      run, topicId, thread: "teacher",
      prompt: first ? intakePrompt(text) : intakeReply(text),
      options: teacherOptions(topicId, topic.intake_session_id ?? undefined),
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
    execute({ run, topicId, thread: "teacher", prompt: buildPrompt(reason), options: teacherOptions(topicId) }),
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
        allowedTools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch", "mcp__tutor__add_lesson_note", "mcp__tutor__get_responses"],
        // Anything not listed above is denied without a prompt.
        permissionMode: "dontAsk",
        settingSources: [],
        mcpServers: { tutor: tutorMcp(topicId, lessonId) },
        env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: "stoa/0.1.0" },
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

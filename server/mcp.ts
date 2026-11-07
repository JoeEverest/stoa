import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { Lessons, Responses, Topics, Uploads } from "./db.ts";
import { lessonIdFromFile, resolveInTopic } from "./paths.ts";
import { uploadInfo } from "./uploads.ts";

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});
const fail = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });

function lessonSummary(topicId: string) {
  const counts = new Map(Responses.counts(topicId).map((c) => [c.lesson_id, c]));
  return Lessons.list(topicId).map((l) => ({
    id: l.id, title: l.title, file: l.file, video: l.video_status,
    completed: !!l.completed_at, completion: l.completion ? JSON.parse(l.completion) : null,
    responses: counts.get(l.id) ?? { n: 0, right: 0, graded: 0 },
  }));
}

const getResponses = (topicId: string) =>
  tool(
    "get_responses",
    "Return the learner's assessment records (answers sent by lesson pages through learn.submit). " +
      "Records with correct = null still need grading by the teacher.",
    { lesson: z.string().optional().describe("Lesson ID such as 0002-split-the-velocity. Omit for all lessons.") },
    async ({ lesson }) => ok(Responses.list(topicId, lesson)),
    { annotations: { readOnlyHint: true } },
  );

const listUploads = (topicId: string) =>
  tool(
    "list_uploads",
    "List the files the learner added to this topic (lecture notes, slides, textbooks, past papers), with how " +
      "to read each one and whether the teacher has read it. The files are in uploads/ and are read-only.",
    {},
    async () => ok(Uploads.list(topicId).map(uploadInfo)),
    { annotations: { readOnlyHint: true } },
  );

/** Tools for the teacher. They connect the agent to the React app. */
export function teacherMcp(topicId: string) {
  return createSdkMcpServer({
    name: "learn",
    version: "0.1.0",
    alwaysLoad: true,
    tools: [
      tool(
        "end_intake",
        "Call once, when MISSION.md is written and you have what you need to start lesson 1. " +
          "The app closes the intake chat; continue with the build in the same turn.",
        { title: z.string().describe("Short topic title for the sidebar"), summary: z.string().describe("One sentence for the learner") },
        async ({ title, summary }) => {
          Topics.update(topicId, { phase: "learning", title, status_message: summary });
          return ok("Intake closed. The learner now sees the build status. Continue with lesson 1.");
        },
      ),
      tool(
        "set_status",
        "Show a one-line status to the learner while you build (for example 'Writing the voice-over script').",
        { message: z.string() },
        async ({ message }) => {
          Topics.update(topicId, { status_message: message });
          return ok("Status shown.");
        },
      ),
      tool(
        "publish_lesson",
        "Show a lesson page to the learner. Call it when the text lesson is complete, before the video. " +
          "Call it again to update the title or video state.",
        {
          file: z.string().describe("Path relative to the workspace, e.g. lessons/0001-two-motions.html"),
          title: z.string(),
          video: z.enum(["planned", "none"]).describe("'planned' if a video for this lesson is coming"),
        },
        async ({ file, title, video }) => {
          const abs = resolveInTopic(topicId, file);
          if (!abs || !fs.existsSync(abs)) return fail(`File not found in the workspace: ${file}`);
          if (!/^lessons\/[^/]+\.html$/.test(file)) return fail("Lessons must be HTML files directly in lessons/.");
          const id = lessonIdFromFile(file);
          Lessons.upsert(topicId, id, file, title, video);
          return ok(`Published lesson ${id}.`);
        },
      ),
      tool(
        "publish_video",
        "Attach a rendered video to a published lesson. The lesson's <div data-learn-video> shows the player.",
        {
          lesson: z.string().describe("Lesson ID, e.g. 0001-two-motions"),
          file: z.string().describe("MP4 path relative to the workspace, e.g. lessons/media/0001-two-motions.mp4"),
          poster: z.string().optional().describe("Poster image path relative to the workspace"),
        },
        async ({ lesson, file, poster }) => {
          if (!Lessons.get(topicId, lesson)) return fail(`Unknown lesson ${lesson}. Publish the lesson first.`);
          for (const f of [file, poster].filter(Boolean) as string[]) {
            const abs = resolveInTopic(topicId, f);
            if (!abs || !fs.existsSync(abs)) return fail(`File not found in the workspace: ${f}`);
          }
          Lessons.setVideo(topicId, lesson, "ready", file, poster ?? null, null);
          return ok(`Video attached to ${lesson}.`);
        },
      ),
      tool(
        "video_failed",
        "Mark a planned video as failed, so the learner does not wait for it.",
        { lesson: z.string(), reason: z.string() },
        async ({ lesson, reason }) => {
          if (!Lessons.get(topicId, lesson)) return fail(`Unknown lesson ${lesson}.`);
          Lessons.setVideo(topicId, lesson, "failed", null, null, reason);
          return ok("Marked as failed.");
        },
      ),
      getResponses(topicId),
      listUploads(topicId),
      tool(
        "mark_upload_read",
        "Call after you read a file the learner added and wrote its map (MATERIALS.md in the teach skill). " +
          "The learner sees the summary next to the file.",
        {
          id: z.number().int().describe("Upload ID from list_uploads"),
          summary: z.string().describe("One plain sentence for the learner: what the file is and how you use it"),
        },
        async ({ id, summary }) => {
          if (!Uploads.get(topicId, id)) return fail(`Unknown upload ${id}. Call list_uploads.`);
          Uploads.markRead(topicId, id, summary.trim());
          return ok("Marked as read.");
        },
      ),
      tool(
        "list_lessons",
        "List published lessons with video state, completion state and response counts.",
        {},
        async () => ok(lessonSummary(topicId)),
        { annotations: { readOnlyHint: true } },
      ),
    ],
  });
}

/** Tools for the tutor of one lesson. The tutor can not change the workspace except its notes file. */
export function tutorMcp(topicId: string, lessonId: string) {
  return createSdkMcpServer({
    name: "tutor",
    version: "0.1.0",
    alwaysLoad: true,
    tools: [
      tool(
        "add_lesson_note",
        "Leave a note for the teacher, who reads it before building the next lesson. Use it for questions the " +
          "lesson did not answer, misconceptions you saw, learner preferences, and requests for future lessons.",
        {
          kind: z.enum(["question", "misconception", "preference", "request"]),
          note: z.string().describe("One or two plain sentences. Quote the learner where it helps."),
        },
        async ({ kind, note }) => {
          const rel = `lesson-notes/${lessonId}.md`;
          const abs = resolveInTopic(topicId, rel)!;
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          // Format: agent/plugin/skills/teach/LESSON-NOTES-FORMAT.md
          if (!fs.existsSync(abs)) fs.writeFileSync(abs, `# Lesson notes: ${lessonId}\n`);
          const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
          fs.appendFileSync(abs, `\n## ${stamp} · ${kind}\n${note.trim()}\n`);
          return ok("Note saved for the teacher.");
        },
      ),
      getResponses(topicId),
      listUploads(topicId),
    ],
  });
}

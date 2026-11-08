# Architecture

Stoa: the app. Athena: the teacher agent.

A self-hostable learning app for one user. A Node server runs Claude agents with the
Claude Agent SDK, keeps app state in SQLite, and serves a React app.

## Roles

- **Teacher** (the professor). One agent per topic. It runs the intake chat, then builds
  lessons, reference documents and lesson videos. It has full tools in the topic folder.
- **Tutor**. A read-only agent for the side chat of one lesson. It answers questions and
  writes notes for the teacher through one MCP tool. One tutor session per lesson.

## Storage

```
$DATA_DIR/
  app.db                     SQLite: topics, lessons, messages, responses, runs, uploads
  topics/<topic-id>/         one teach workspace (one mission)
    MISSION.md  RESOURCES.md  GLOSSARY.md  NOTES.md
    learning-records/0001-*.md
    lessons/0001-<slug>.html  lesson pages (served in an iframe)
    lessons/media/            rendered videos and posters
    lesson-notes/0001-<slug>.md   tutor notes for the teacher (written by the server)
    reference/*.html          reference documents
    library/                  topic asset library (fonts, sfx, scene parts, video starter)
    videos/0001-<slug>/       HyperFrames source projects
    uploads/                  the learner's own files (read-only for the agents)
    uploads/text/<name>.md    text and images taken from .docx/.pptx uploads by the server
    material-notes/<name>.md  Athena's map of each uploaded file
```

A lesson ID is the file name of the lesson without `.html`, for example `0001-two-motions`.

## Flow

1. The user creates a topic with a first message. The server makes the workspace folder and
   starts the teacher (intake).
2. Each user message in the intake chat is one teacher run that resumes the intake session.
3. The teacher calls `end_intake`. The UI closes the chat. The same run continues and builds
   lesson 1.
4. The teacher calls `publish_lesson` when the text lesson is ready. The UI shows it.
5. The teacher builds the video and calls `publish_video`. The bridge puts the player into the
   lesson.
6. The user does the lesson. Answers go to SQLite through `window.learn.submit`.
7. The user asks the tutor questions. The tutor calls `add_lesson_note`.
8. "Next lesson" or `window.learn.complete()` queues a build run. Each build run is a new
   teacher session; workspace files are the handoff.

One teacher run per topic at a time. Other runs for that topic wait in a queue.

## Lesson kit

Every served workspace HTML page gets `<link rel="stylesheet" href="/stoa/lesson.css">` (the
app's tokens from `shared/tokens.css` plus `shared/lesson.css`) and the bridge script, both before
the page's own styles, and `/stoa/palette.css` (`shared/palette.css`) at the end of `<head>`, after
them, so lesson colors always resolve to the lesson palette (five colors plus black and white). The bridge copies the app's theme choice (`localStorage["stoa-theme"]`) onto the
page. Athena's rules: `agent/plugin/skills/teach/STYLE-GUIDE.md`.

## Bridge contract (`/bridge.js`, injected into every served workspace HTML page)

```js
await learn.submit({ itemId, prompt, answer, correct, meta })
// itemId: string, stable in the lesson ("q1", "drill-angle-3")
// prompt: string, the question as the learner saw it
// answer: any JSON
// correct: true | false | null  (null = the teacher grades it later)
// meta:   any JSON (score, attempts, time, hints used...)

await learn.complete({ score, total, summary })   // all optional; queues the next lesson build
const records = await learn.responses()           // earlier answers for this lesson
```

Video area: `<div data-learn-video></div>`. The bridge shows a "video is being made" state
until the teacher publishes the video, then puts a `<video>` player there.

## Teacher MCP tools (`mcp__learn__*`)

| Tool | Input | Effect |
|---|---|---|
| `end_intake` | `title`, `summary` | Closes the intake chat in the UI |
| `set_status` | `message` | Shows a one-line build status |
| `preview_page` | `file`, `themes?`, `widths?`, `selector?` | Renders a workspace page in Chrome (light/dark, desktop/phone) and returns screenshots plus a contrast and palette check (`server/preview.ts`) |
| `publish_lesson` | `file`, `title`, `video` (`planned`/`none`) | Registers and shows a lesson. The server also publishes a lesson whose video was started without it |
| `publish_video` | `lesson`, `file`, `poster?` | Attaches a rendered video to a lesson |
| `video_failed` | `lesson`, `reason` | Marks the video as failed |
| `get_responses` | `lesson?` | Returns assessment records |
| `list_lessons` | — | Lessons with completion state and response counts |
| `list_uploads` | — | The learner's files, how to read each, and which are read |
| `mark_upload_read` | `id`, `summary` | Marks a file as read; the learner sees the summary |

## Tutor MCP tools (`mcp__tutor__*`)

| Tool | Input | Effect |
|---|---|---|
| `add_lesson_note` | `kind`, `note` | Appends to `lesson-notes/<lesson>.md` |
| `get_responses` | `lesson?` | Returns assessment records |
| `list_uploads` | — | The learner's files |

## The learner's files (`server/uploads.ts`)

The learner can add files when they create a topic, in the intake chat, or in the classroom's
"Your materials" list: PDF, Word (.docx), PowerPoint (.pptx), text, Markdown, CSV and images, up
to 500 MB each. `PUT /api/topics/:id/uploads?name=<file name>` streams the raw body to
`uploads/`. The agents read PDFs and images directly. For .docx and .pptx the server writes
`uploads/text/<name>.md` (headings, bullets, one section per slide, speaker notes) and copies the
images to `uploads/text/<name>-media/`, with a small zip reader and no extra dependencies.

Every teacher prompt (intake turns and builds) ends with an `<uploads>` block while there are
files Athena has not marked as read. How she reads, maps and teaches from them:
`agent/plugin/skills/teach/MATERIALS.md`. To upload files before the first intake turn, the app
creates the topic with `start: false`, uploads, then calls `POST /api/topics/:id/start`.

**Steering.** Teacher runs use the SDK's streaming input: the prompt is the first message of an
input stream that stays open while the run works. When the learner adds a file during a teacher
run, `announceUploads()` (after 1.5 s, so files added together go in one message) pushes an
`<uploads>` message with `priority: "next"`, which the CLI folds into the running turn at the next
tool call. A message that arrives after the turn's last tool call starts one more turn instead, so
the runner closes the input only when every steering message has reached `command_lifecycle` state
`started` (20 s fallback). The learner sees an activity line in the chat, and the upload response
has `steered: true`. With no teacher run working, the next run's prompt lists the unread files.

Lessons cite files as `../uploads/x.pdf#page=12`; the bridge opens such links in the app's frame,
so the lesson stays loaded.

## Skills

The agent loads skills from the app plugin in `agent/plugin/` only (`settingSources: []`), so
the user's own Claude settings do not change the teacher.

- `teach` — the app version of the teach skill.
- `lesson-video` — the app version of reel-motion-graphics for long narrated lesson videos.
- `hyperframes-*` — HyperFrames reference skills, copied by `scripts/sync-skills.sh`.

## Desktop app (`desktop/`)

The Electron main process starts `server/index.ts` in a `utilityProcess` (Electron's Node 24 runs
the TypeScript directly) on a free `127.0.0.1` port, then loads that URL in the window. The app,
the lesson frames and the bridge keep one origin, as in the browser version.

- **Access control.** The server gets `STOA_TOKEN`; the window gets it as an HTTP-only cookie.
  Requests without the cookie or with another `Host` header get 403, so other local programs and
  web pages cannot use the server.
- **Folders.** `DATA_DIR` = `<userData>/data`, `STOA_RUNTIMES_DIR` = `<userData>/runtimes`.
  The app ships without asar, because the agents read the plugin and run binaries from disk.
- **PATH.** Read from a login shell at start, because apps started from the Dock or a menu do not
  get it.
- **Claude access** (`server/setup.ts`, `server/settings.ts`). Three connections: Anthropic (a
  Claude Code login, found by starting Claude Code without a prompt and reading `accountInfo()`,
  or an API key), a custom Anthropic-compatible URL, or Amazon Bedrock. Plain settings (provider,
  URLs, region, models) are in `DATA_DIR/settings.json`. Secrets (the API key, a custom endpoint's
  token, a Bedrock API key) are stored by the shell with `safeStorage` and sent to the server over
  the utilityProcess port (`{ type: "secret" }`), which keeps them in memory. `providerEnv()` builds
  each agent run's environment: for a custom URL it sets `ANTHROPIC_BASE_URL` with
  `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`; for Bedrock `CLAUDE_CODE_USE_BEDROCK`,
  `AWS_REGION`, `ANTHROPIC_BEDROCK_BASE_URL`, `AWS_PROFILE`, `AWS_BEARER_TOKEN_BEDROCK` or
  `CLAUDE_CODE_SKIP_BEDROCK_AUTH`; and for both it points every model family
  (`ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL`) at the chosen models, since a gateway may serve
  only one. `POST /api/settings/test` sends one short prompt through the saved connection.
- **Updates** (`desktop/updater.ts`, main process). Reads the latest published release from the
  GitHub API, picks this computer's package by name, streams it to `<userData>/updates` while
  hashing it, and keeps it only if the SHA-256 matches the asset's `digest`. On macOS it unpacks the
  zip with `ditto` and checks the bundle's version; on install a detached shell script waits for
  Stoa's PID to exit, renames the old bundle (or AppImage) aside, moves the new one in, removes the
  old one (or puts it back if the move failed) and starts the new version. The window gets status
  pushes on `stoa:update-status`. Not used: Squirrel.Mac, which needs a Developer ID signature.
- **Claude Code CLI** (`server/claudecli.ts`). Setup looks for `claude` on PATH and in
  `~/.local/bin`, and runs `curl -fsSL https://claude.ai/install.sh | bash` when it is missing. The
  CLI is for signing in (the shell can open a terminal running it); the agents use the SDK's copy.
- **Video tools** (`server/runtimes.ts`). Setup installs Python (python-build-standalone) with
  `kokoro-onnx` and `soundfile`, and static ffmpeg, from pinned files with SHA-256 checks. Then it
  runs HyperFrames itself to fetch Chrome, the Kokoro model and the whisper model into
  `HYPERFRAMES_CACHE_DIR`, which also proves each tool works. `whisper-cli` is built in CI
  (`scripts/build-whisper.sh`) and ships in the app's resources. `runtimeEnv()` points the
  teacher's runs at all of it (`HYPERFRAMES_*_PATH`, `HYPERFRAMES_PYTHON`, `PATH`).
- **Shims.** `<runtimes>/bin` holds `node`, `npm`, `npx` and `hyperframes` launchers, first on the
  agent's PATH. `node` is Electron in Node mode, and `npx hyperframes` runs the bundled
  HyperFrames. They are rewritten at every start, because the app's path can change.
- **Shutdown.** On quit the shell asks the server to stop every run and the tools they started,
  then ends it. On macOS, closing the window keeps Stoa running, so a lesson build can finish.

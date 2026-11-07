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
  app.db                     SQLite: topics, lessons, messages, responses, runs
  topics/<topic-id>/         one teach workspace (one mission)
    MISSION.md  RESOURCES.md  GLOSSARY.md  NOTES.md
    learning-records/0001-*.md
    lessons/0001-<slug>.html  lesson pages (served in an iframe)
    lessons/media/            rendered videos and posters
    lesson-notes/0001-<slug>.md   tutor notes for the teacher (written by the server)
    reference/*.html          reference documents
    library/                  topic asset library (fonts, sfx, scene parts, video starter)
    videos/0001-<slug>/       HyperFrames source projects
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
the page's own styles. The bridge copies the app's theme choice (`localStorage["stoa-theme"]`) onto the
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
| `publish_lesson` | `file`, `title`, `video` (`planned`/`none`) | Registers and shows a lesson |
| `publish_video` | `lesson`, `file`, `poster?` | Attaches a rendered video to a lesson |
| `video_failed` | `lesson`, `reason` | Marks the video as failed |
| `get_responses` | `lesson?` | Returns assessment records |
| `list_lessons` | — | Lessons with completion state and response counts |

## Tutor MCP tools (`mcp__tutor__*`)

| Tool | Input | Effect |
|---|---|---|
| `add_lesson_note` | `kind`, `note` | Appends to `lesson-notes/<lesson>.md` |
| `get_responses` | `lesson?` | Returns assessment records |

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
- **Claude access** (`server/setup.ts`). A Claude Code login is found by starting Claude Code
  without a prompt and reading `accountInfo()` (no cost). Without a login, the learner gives an
  API key in setup; the shell checks it, stores it with `safeStorage` and sends it to the server
  over the utilityProcess port. The server puts it in `ANTHROPIC_API_KEY` for the agents only in
  that case.
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

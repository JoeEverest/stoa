# Stoa

Stoa is a self-hosted learning app. You tell it what you want to learn, and Athena, an AI teacher
built on the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk), teaches it to you one
lesson at a time: readable lessons with citations, narrated explainer videos, and interactive
exercises. A tutor in the side panel answers questions while you work.

## The goal

Most learning tools give everyone the same course. Stoa writes the course for one person:

- **It starts from your goal.** Athena first asks why you want to learn the topic and what "done"
  looks like for you, and writes that down as the topic's mission. Every lesson ties back to it.
- **It teaches from evidence.** Your answers to exercises go back to Athena. Before each new
  lesson, Athena reads them, grades open answers, and records what you have actually shown you
  understand. The next lesson starts where you are, not where a syllabus assumes you are.
- **It shows, not only tells.** Concepts with motion, space or process get a narrated video made
  for that lesson (animated diagrams and a voice-over, rendered locally).
- **It listens between lessons.** The tutor answers your questions about the current lesson and
  leaves notes for Athena, so what confused you is covered next time.
- **It stays yours.** Everything (lessons, videos, answers, chats) lives on your machine.

## How it works

```
You ── intake chat ──▶ Athena (teacher agent) ── writes ──▶ topic workspace (files)
 │                          │                                 mission, resources, lessons,
 │                          │ publishes lessons and videos    videos, reference sheets, notes
 ▼                          ▼
Stoa web app ◀────── server (Hono + SQLite) ◀── answers, tutor notes, status
 │   lesson pages in a frame, with an injected `window.learn` bridge
 └── tutor (read-only agent) ── leaves notes for Athena
```

- Each topic is its own workspace folder with one mission. Topics never mix.
- Athena runs with full tools inside that folder. The tutor can only read it.
- Lesson pages are HTML that Athena writes. The app injects its lesson kit (so every lesson looks
  like part of Stoa, with colors Athena picks for each topic) and a small script that sends your
  answers to SQLite.
- Lessons follow a writing guide (plain, calm, a specific example before the rule, one name per
  term). A second agent edits each lesson against it, and a script checks the reading grade
  against the level the learner gave at intake.
- Videos are made with [HyperFrames](https://www.npmjs.com/package/hyperframes) (HTML + GSAP
  rendered to MP4), a local Kokoro voice, and ffmpeg.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Design system: [DESIGN.md](DESIGN.md).

## Desktop app (macOS and Linux)

Stoa also runs as a desktop app. It contains the server, the agents and HyperFrames, so you do
not install Node or any video tools yourself.

On first launch, a setup screen does three things:

1. **Claude Code.** If the `claude` command is not on this computer, Stoa installs it with the
   official installer (`curl -fsSL https://claude.ai/install.sh | bash`). You use it to sign in to
   your Claude account; Stoa's agents run on the copy inside the Agent SDK.
2. **Claude.** Choose how Stoa reaches Claude:
   - **Anthropic**: the Claude Code login on this computer (a **Sign in with Claude** button opens a
     terminal for `/login`), or an API key from the Claude Console, which Stoa checks with Anthropic.
   - **Custom URL**: any Anthropic-compatible endpoint (LiteLLM or another gateway, a company
     proxy). Give the URL, how to send the key (`x-api-key`, Bearer token or none) and the model ID.
   - **Amazon Bedrock**: an AWS region, an optional custom endpoint (VPC endpoint or gateway), how
     to sign in (an AWS profile, a Bedrock API key, or the endpoint handles it) and the model ID or
     inference profile.

   Keys and tokens are stored encrypted (macOS Keychain, or the Linux keyring through Electron's
   `safeStorage`). **Test connection** sends one short message through the saved settings.
3. **Video tools.** Stoa downloads Python with the Kokoro voice, ffmpeg, a headless Chrome and the
   whisper speech-timing model, about 1 GB, into its app-data folder. Every file is pinned to a
   version, and the ones Stoa downloads itself are checked against a SHA-256. `whisper-cli` ships
   inside the app. Videos are part of every lesson, so setup finishes only when the tools work.

**Settings** (the sliders button at the bottom of the sidebar, or `#/settings`) changes the
connection and the models later: the teacher (Athena), the tutor, and for a custom URL or Bedrock
a cheaper background model. Changes apply to new work. The browser version shows Settings too, with
the models only; its connection comes from the server's environment.

Data lives in the OS app-data folder (`~/Library/Application Support/Stoa` on macOS,
`~/.config/Stoa` on Linux): `data/` (database and topics), `runtimes/` (video tools) and
`logs/server.log`.

**Updates.** Stoa checks GitHub for a new release at launch and every six hours, downloads it in
the background (Settings → Updates turns that off), and checks the file against the SHA-256 digest
GitHub records for it. **Restart to update** closes Stoa, swaps in the new version and opens it
again; your data folder is not touched. This works for the macOS app in a folder you can write to
(normally Applications) and for the Linux AppImage. A `.deb` install downloads the new package and
opens it in your software installer. Stoa does not use Squirrel.Mac (electron-updater), because that
requires an app signed with an Apple Developer ID.

Build it yourself:

```bash
npm install
npm run sync-skills
npm run build:whisper   # needs git, cmake and a C compiler; builds vendor/whisper/<platform>/whisper-cli
npm run desktop         # run the app from source
npm run dist            # package: release/*.dmg + .zip (macOS) or .AppImage + .deb (Linux)
```

`npm run desktop:dev` runs the app with the Vite dev server (hot reload for the web app). Build
each package on its own OS and CPU; `.github/workflows/desktop.yml` does this for macOS arm64/x64
and Linux x64/arm64. macOS packages are signed and notarized when the signing secrets are set.
Windows is not supported yet.

To ship a release: bump `version` in `package.json`, commit, and push a matching tag (`v1.1.0`). CI
builds every package and collects them, with `SHA256SUMS.txt`, into a draft GitHub release. Edit the
notes, then publish the draft; installed copies of Stoa offer the update within six hours. Package
names must keep the arch (`Stoa-<version>-<arch>-mac.zip`, `Stoa-<version>-<arch>.AppImage`),
because the updater picks its file by name.

## Server setup (browser or Docker)

### Requirements

- **Node.js 22.18 or newer** (the server runs TypeScript directly).
- **Claude access** for the agents, either:
  - an `ANTHROPIC_API_KEY` from the Claude Console, or
  - an existing Claude Code login on the same machine (`claude`, then `/login`). Check that your
    plan and Anthropic's terms allow this use.
- **For videos** (lessons still work without them):
  - ffmpeg (`brew install ffmpeg`, or your package manager)
  - Python 3 with the voice model packages: `pip install kokoro-onnx soundfile`
  - whisper.cpp for word timings (`brew install whisper-cpp` on macOS)
  - Check everything with `npx hyperframes doctor`. HyperFrames downloads a headless Chrome on the
    first render.

### Install and run

```bash
git clone https://github.com/JoeEverest/stoa.git
cd stoa
npm install
npm run sync-skills     # copies the HyperFrames and anatomy skills into agent/plugin
npm run build
npm start               # http://localhost:3210
```

For development (server with reload on :3210, web app with hot reload on :5173):

```bash
npm run dev             # open http://localhost:5173
```

### Using it

1. Open the app and write what you want to learn, for example
   "Program an ESP32 to read a temperature sensor and send the values to my home server".
2. Answer Athena's questions about your goal. When Athena has enough, the chat closes and the
   first lesson is built. The reading part appears first (a few minutes); the video follows when
   it has rendered (often 10–20 minutes, depending on its length and your machine).
   Studying for a class? Attach your lecture notes, slides, textbook or past papers (PDF, Word or
   PowerPoint) when you start, during the chat, or later under **Your materials**. Athena reads
   them, follows your course's order and terms, and cites the exact slide or page.
3. Read, watch, and do the exercises. Ask the tutor on the right when something is unclear.
4. Click **Finish lesson** at the end of a lesson, or **Next lesson** at the top, and Athena builds
   the next one from your answers and the tutor's notes.

To remove a topic and everything it created (lessons, videos, answers, chats and the agents'
saved sessions), open the **⋯** menu in the topic header and choose **Delete topic**.

### Settings

| Variable | Default | Use |
|---|---|---|
| `DATA_DIR` | `./data` | Database and topic workspaces |
| `PORT` / `HOST` | `3210` / `127.0.0.1` | Server address |
| `LEARN_MODEL` | `claude-opus-5-5` | Athena's model (a model chosen in Settings wins) |
| `TUTOR_MODEL` | same as `LEARN_MODEL` | Tutor model (a model chosen in Settings wins) |
| `ANTHROPIC_API_KEY` | (none) | Claude access, if you do not use a Claude Code login |
| `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, ... | (none) | Any Claude Code connection variable; the agents inherit them |
| `CHROME_PATH` | (found automatically) | Chrome or Chromium that Athena uses to check figures |

The desktop app sets these itself. For testing, `STOA_USER_DATA=/some/folder` gives it a separate
profile (data, video tools, keys and settings).

## Costs and safety

- The agents use your Claude account. As a rough guide, one lesson with a two-minute video cost
  about US$3.70 with the default model in testing. Tutor answers cost a few cents each.
- Athena runs shell commands and writes files **without asking**, inside the topic folder. Run
  Stoa only on a machine where that is acceptable. The Docker setup below is meant to contain it.

## Docker (pending)

A `Dockerfile` is included and the image builds, but running the app in a container has **not
been tested yet** (Claude access inside the container, the Linux voice and transcription tools,
and the process cleanup on delete). Treat it as work in progress:

```bash
docker build -t stoa .
docker run -d --name stoa -p 3210:3210 -v stoa-data:/data -e ANTHROPIC_API_KEY=sk-ant-... stoa
```

## Project layout

```
server/         Hono server: API, agent runner, MCP tools for Athena and the tutor, lesson bridge,
                desktop setup (Claude access, video tool installer)
desktop/        Electron shell: starts the server, window, encrypted key storage
web/            React app (Vite)
shared/         Design tokens and the lesson kit, shared by the app and the lessons
agent/plugin/   Claude Code plugin: skills (teach, lesson-video; HyperFrames and anatomy after sync), lesson-editor agent
docs/           Architecture notes
```

## Credits

- The `teach` skill in `agent/plugin/skills/teach/` is adapted from the `teach` skill in
  [mattpocock/skills](https://github.com/mattpocock/skills), MIT License, Copyright (c) 2026 Matt
  Pocock. Its four format files are unchanged; `SKILL.md` is rewritten for this app. The original
  license is in [agent/plugin/skills/teach/LICENSE](agent/plugin/skills/teach/LICENSE).
- Videos are built with [HyperFrames](https://www.npmjs.com/package/hyperframes); its skills are
  installed by `npm run sync-skills` and are not part of this repository.
- Explainer figures use the [anatomy](https://github.com/wheresryan22/anatomy) skill (MIT
  License). `npm run sync-skills` copies it from `~/.claude/skills/anatomy`, or clones it from
  GitHub; it is not part of this repository.

## License

[MIT](LICENSE)

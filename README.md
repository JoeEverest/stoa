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

## Setup

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
| `LEARN_MODEL` | `claude-opus-5-5` | Athena's model |
| `TUTOR_MODEL` | same as `LEARN_MODEL` | Tutor model |
| `ANTHROPIC_API_KEY` | (none) | Claude access, if you do not use a Claude Code login |
| `CHROME_PATH` | (found automatically) | Chrome or Chromium that Athena uses to check figures |

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
server/         Hono server: API, agent runner, MCP tools for Athena and the tutor, lesson bridge
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

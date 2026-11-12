---
name: lesson-video
description: Make a narrated explainer video for a lesson with HyperFrames (HTML + GSAP rendered to MP4) - script, local text-to-speech voiceover, word-timed animated illustrations, sound effects, chapters for long videos, render, visual check, and publish into the lesson. Use whenever the teacher decides a lesson gets a video, and for fixes to an existing lesson video.
---

# Lesson videos with HyperFrames

A video is a small web page: `index.html` holds what is on screen, one paused GSAP timeline says
what moves and when, and `npx hyperframes render` captures every frame and encodes an MP4.
Because the video is text, you can build it, look at it, and fix it like code.

This skill is the full process for a lesson video. Run it end to end without asking anyone for
approval: the learner is not in a chat with you during a build. The HyperFrames reference skills
hold the technical contract; use them for depth:

- Read `hyperframes-core` (SKILL.md, ~100 lines) before you write composition HTML the first time
  in a run. It lists the lint rules you will otherwise hit one by one. Its
  `references/sub-compositions.md` covers chapters as sub-compositions.
- `hyperframes-cli` covers every CLI command (`tts`, `transcribe`, `check`, `snapshot`,
  `timeline`, `render`). Ignore its "render only after approval" step; in this app you render
  when `check` passes.
- `hyperframes-animation`, `hyperframes-keyframes`, `hyperframes-creative` and
  `hyperframes-audio` are for motion technique, camera moves, design and audio mixing.

Report progress with `mcp__learn__set_status` at each step below, and during long renders.

## Defaults

- 1920x1080 landscape, 30 fps.
- Length: whatever the concept needs. A single idea is often 1-3 minutes; a full topic can be
  10-20 minutes in chapters.
- Voice: the one in `NOTES.md`; if none is recorded, `af_heart`. Record the voice you used in
  `NOTES.md` so every video in the topic sounds the same.
- Style: the Stoa look, so the video feels like part of the app (see the teach skill's
  `STYLE-GUIDE.md`, "Videos"): background `#ffffff` or `#f7f7f8`, ink `#0f0f11`, secondary ink
  `#3f4048`, and only the lesson palette for color: teal `#2a9d8f` (the primary colour), saffron
  `#e9c46a`, sandy `#f4a261`, sienna `#e76f51`, and charcoal `#264653` for ink-weight lines and
  labels only, never as a fill for shapes, discs or title cards (plus black and white; no other
  hues), and Geist
  (400/500/600) for all on-screen text. Calm motion, no
  gradients or glows. `references/craft.md` has the design rules; ignore the presets in
  `references/styles.md` unless the learner asks for a different look in `NOTES.md`.
- Follow any video preferences in `NOTES.md` (length, pace, style, script review steps).

Before anything else: the text lesson must already be published (`mcp__learn__publish_lesson`,
`video: "planned"`). Check with `mcp__learn__list_lessons`; if it is missing, publish it now.

## 0. Preflight (once per machine)

```bash
node -v                       # need 22+
ffmpeg -version | head -1
npx -y hyperframes doctor
```

If something is missing and you cannot install it, call `mcp__learn__video_failed` with the
exact missing tool and the command to install it. The text lesson still stands.

## 1. Start the project

Each video lives in `videos/<lesson-id>/`.

- **If `library/video-starter/` exists**, copy it: `cp -R library/video-starter videos/<lesson-id>`,
  then rename the project in `package.json` and `meta.json`.
- **Else** scaffold, add fonts and sounds, and save a starter for the next video:

```bash
cd videos
HYPERFRAMES_SKIP_SKILLS=1 npx hyperframes init <lesson-id> --non-interactive --example blank --resolution landscape
cd <lesson-id>
mkdir -p fonts && for w in 400 500 600; do curl -sfL -o fonts/Geist-$w.woff2 "https://cdn.jsdelivr.net/fontsource/fonts/geist@latest/latin-$w-normal.woff2"; done
bash <skill-dir>/scripts/make-sfx.sh        # pop tick counter chime snap star switch fill success
mkdir -p ../../library/video-starter
cp -R fonts sfx package.json hyperframes.json meta.json CLAUDE.md AGENTS.md ../../library/video-starter/ 2>/dev/null || true
```

Self-host every font with a local `@font-face`. Make any extra sound effects with ffmpeg
(`sine`/`anoisesrc` + `afade`) and add them to the starter's `sfx/` too.

## 2. Script: teach, do not recite

The video is a teacher at a whiteboard working **one** problem *with* the learner. It is not a
summary of the lesson read aloud. A script that is a list of true statements ("The inner loop
tries each number. A hash map answers that in one step. The cost is memory.") is a failed
script, even when every sentence is correct.

Write `script.txt`: plain spoken English, one paragraph per voice line, each line one beat. Plan
the visual for every line at the same time in `storyboard.md` (what is on screen, what moves).

### The shape every lesson video follows

1. **Hand over the problem.** Show the concrete problem and its input, then ask the learner to
   try it: "Pause the video and find two numbers that add up to seven." Show a "Pause and try"
   cue and leave two or three seconds of quiet. This is not a hook: the line teaches the problem.
2. **Do the obvious approach out loud, for real.** Narrate the first few actual steps slowly,
   with the counter on screen, so the learner *sees* why it is slow. Then speed the animation up
   and say what it is doing. Never only state the cost ("so it does 15 checks").
3. **Find the insight with the learner.** Stop on the step that repeats work. Ask the question an
   expert asks ("What is the inner loop really looking for?"), give a beat of quiet, then answer
   from what the learner just watched. The insight must come out of the example, not arrive as
   a fact.
4. **Bring in the new tool only when it is needed,** and say in one or two sentences what it is
   and why it fits, at this learner's level (what a hash map stores; why finding a key is fast).
5. **Walk the new method step by step, and say *why* at each step**, not only what. Where the
   learner must track state (a pointer, a table, a stack), go slowly: a beat of quiet and a
   visible change per step. If steps repeat, do two slowly, then say what will happen and let
   the animation run. "1 needs 6. 7 needs 0. 5 needs 2." is a list, not a walkthrough.
6. **Show the trap.** One wrong move learners make (from `learning-records/`, `lesson-notes/`, or
   the common mistake for this idea), on a concrete input on screen, and why it fails.
7. **One idea per video.** A second problem or an extension gets its own chapter with this same
   shape (section 6), or it stays in the text lesson. Never squeeze it into the last 20 seconds.
8. **End with a check, not an announcement.** Say the idea in one sentence. Then ask one question
   the learner answers in their head ("Target ten, array three, five, seven: what is in the map
   when you find the pair?"), pause, and answer it. Then one line on what the lesson asks next.

The shape is what the video does, not what it says. The quoted lines above are examples of a
move, never wording to reuse, and the learner must not hear the steps announced ("Here is the
idea in one sentence.", "Now the trap.", "Now check yourself."). Each video finds its own words
for each move. Before you write, read the scripts of this topic's earlier videos
(`videos/*/script.txt`) and do not open, turn or close with a phrase they already used.

### Writing for the ear

- Talk to one learner: "you", "let's", real questions. Give reasons: "because", "so", "that
  means". A line that states a fact with no reason and no link to the screen is a reciting line;
  give it its reason or cut it.
- **Write speech, not text.** The narration follows the teach skill's `WRITING.md`
  ("Language"), and speech needs it even more than a page does. Use contractions everywhere a
  person would ("that's too big", "we can't use a map here", "it's already in there"). A script
  with "that is", "do not" and "cannot" in every other line sounds like a machine.
- **Let sentences run when the thought runs.** Join a step to its reason: "Two plus fifteen is
  seventeen, which is one too many, so something has to go." Then a short line lands: "It's the
  fifteen." Four or more short sentences of the same shape in a row is a list, not a teacher.
- **Do not read the screen.** The learner can see "5 + 2 = 7". Say what to notice about it: which
  number matters, what just changed, what is about to go wrong. In a stretch of repeated steps,
  speak the first one or two in full, then talk over the rest ("the same thing happens for nine,
  four and seven: no partner yet, so in they go").
- **React like a person.** A teacher says "good", "not quite", "hang on", "notice something
  odd?", "that's a lot of work for six numbers". Use these where they are true. No hype.
- **Refer to what the learner saw, not to how the video is built.** Never say "chapter",
  "scene", "section" or "slide": say "a minute ago" or "back when we had no negative numbers".
- Follow `WRITING.md`: the first line teaches something (handing over the problem counts; "get
  ready for" does not), a specific example before the rule, things at their real size, no hype.
- Every name must be clear when *heard*. Read each line aloud: "seen" sounds like "scene", so
  say "the map of numbers we have seen". Use the glossary's terms and the text lesson's names.
- Spell out what TTS reads badly: "nine point eight metres per second", not "9.8 m/s";
  "v cos theta", not "v·cosθ". Keep symbols on screen, words in the voice.
- Point at the picture: "watch the pointer move to the nine", "the green row is the match".
- Pace: about 130 to 150 spoken words a minute, plus the quiet beats. Length follows the
  teaching: a walkthrough with pauses is often three to six minutes. That is fine.

Every claim must be correct; animations of physical or technical processes must be accurate
(real proportions, correct directions, correct timing relations). Citations go in the lesson,
not in the video.

### Review before any voice is made

Give `script.txt` and `storyboard.md` to the `learn:video-script-editor` subagent with the lesson
file path. Fix every structural problem it reports (it edits wording itself, but the teaching
shape is yours). Before you send it, run `node <teach skill directory>/scripts/readability.mjs script.txt` and
read every line it flags aloud; most "full form" and "short sentences in a row" flags in a script
are real. Do not start the voiceover until the editor passes it. After the voiceover, read the
whisper transcript once *as the learner*: if any stretch is a list of facts, or sounds like
something nobody would say, rewrite those lines and regenerate only them.

## 3. Voiceover

Split the script into `vo/line01.txt`, `vo/line02.txt`, ... then for each line generate the
speech locally (Kokoro), trim silence, normalise loudness, and get word timings:

```bash
for f in vo/line*.txt; do
  b=${f%.txt}
  npx hyperframes tts "$f" -v <voice> -o ${b}_raw.wav < /dev/null >/dev/null 2>&1
  ffmpeg -v error -y -i ${b}_raw.wav -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-2,aresample=48000" ${b}.wav
  rm ${b}_raw.wav
  npx hyperframes transcribe ${b}.wav --json < /dev/null >/dev/null 2>&1
  mv vo/transcript.json ${b}.json
done
for f in vo/line??.wav; do echo "$f $(ffprobe -v error -show_entries format=duration -of csv=p=0 $f)"; done
```

- Every `npx` call inside a loop needs `< /dev/null`, or npx eats the rest of the loop.
- `vo/lineNN.json` is a list of `{ text, start, end }` words, relative to that line.
- Listen for problems by reading the transcript: a misheard word in the transcript usually
  means TTS said it badly. Rewrite that line and regenerate only that line. For a poor
  transcription, try `-m medium.en`.

## 4. Timeline

Place the voice lines on the main timeline: line 1 starts at about 0.5 s, and each next line
starts at the previous line's end plus a gap (0.4-0.8 s inside a scene, 1-1.5 s at a scene
change). Write the starts down (a small table in a comment at the top of `index.html`).

Anchor every visual event to a word: the absolute time is the line's start plus the word's
`start` from `vo/lineNN.json`. An arrow appears on "arrow", the ball drops on "dropped".
Animations that land 0.1-0.2 s before the word feel right.

Each voice line is an `<audio>` element on its own track:

```html
<audio id="vo4" src="vo/line04.wav" data-start="31.5" data-duration="19.67" data-track-index="20"></audio>
```

Sound effects are short `<audio>` clips at low volume (`data-volume` 0.1-0.2, impacts up to 0.5)
on separate tracks. Use them for contact, arrival and completion moments, not for every motion.

## 5. Build

Skeleton rules that matter most (full list in `hyperframes-core`):

- Root: `<div id="root" data-composition-id="main" data-start="0" data-duration="N"
  data-width="1920" data-height="1080">`. Root `data-duration` sets the length.
- One `gsap.timeline({ paused: true })`, registered as `window.__timelines["main"]` after it is
  built.
- Each scene is a `class="clip"` element with `data-start`, `data-duration`, `data-track-index`.
  Animate the **children** of a clip, never the clip's visibility.
- Start states inside tweens with `fromTo`, not CSS `transform`. Centre with flexbox.
- **Deterministic only:** no `Math.random()` without a seed, no `Date.now()`, no infinite repeats,
  no data fetched at render time. Physics motion must be computed from time
  (`x = x0 + vx*t`, `y = y0 + vy*t - g*t*t/2`) in an `onUpdate` or with sampled keyframes, so any
  frame renders the same at any seek position.
- Diagrams: inline SVG in a fixed 1920x1080 coordinate space. Choose a pixels-per-unit scale and
  keep it for the whole video so sizes stay comparable.
- On-screen text: few words, large (34 px and up), high contrast. The voice explains; the screen
  shows labels, values and the one key statement.
- Each screen stays up long enough to read: about 0.3 s per word, at least 1.2 s.
- Scene changes: overlap scenes by 0.1-0.3 s so the background never shows alone. A hard cut or a
  wipe reads cleaner than a cross-fade.
- Hidden-but-present elements still count in `check`'s overlap audit: keep not-yet-entered
  elements at `opacity: 0` and `tl.set` them visible when they enter.

Named moves (rise, pop, count-up, typewriter, bar fill, ...) are in `references/moves.md`.
`references/recipes.md` has recipes for overlays, sound effects and transparent export.

### Reusable scenes

Look in `library/scenes/` before you draw something again. When you build a part that a later
video will need (axes with a ground line, a ball with a trail, velocity arrows with labels, a
breadboard, a code panel), save it as a small HTML/JS snippet in `library/scenes/<name>.html`
with a comment on how to use it, and list it in `library/README.md`.

## 6. Long videos: chapters

Do not put a long video into one `index.html`; it becomes too large to edit reliably. Above
about 3 minutes, split it into chapters of 1-4 minutes, each one idea:

1. Write the whole script first, with chapter breaks, so the story flows.
2. Build each chapter as its own HyperFrames project in `videos/<lesson-id>/ch01/`, `ch02/`, ...
   (copied from the starter), with its own `vo/` and its own timeline. Alternatively use
   sub-compositions (`hyperframes-core` → `references/sub-compositions.md`) if the chapters
   share a lot.
3. Check, render (to `chNN/renders/chNN.mp4`) and look at each chapter before you start the next one. Fix problems while the
   chapter is fresh.
4. Join the chapter renders:

```bash
cd videos/<lesson-id>
printf "file '%s'\n" ch*/renders/ch*.mp4 > chapters.txt
ffmpeg -v error -y -f concat -safe 0 -i chapters.txt -c copy renders/<lesson-id>.mp4
```

All chapters must use the same resolution, fps and audio settings, or `-c copy` fails; re-encode
in that case. Note the chapter start times in the lesson so the learner can jump to them.

## 7. Check, render, look

```bash
npx hyperframes check                                  # lint + runtime + layout + contrast
npx hyperframes snapshot --at 12.5,31.2,60.0           # quick frames at chosen times
npx hyperframes render -o renders/<lesson-id>.mp4
bash <skill-dir>/scripts/frames.sh renders/<lesson-id>.mp4 8   # contact sheet; then Read the PNG
```

Fix every `check` error; a lint error silently disables the layout and contrast audits. Fix the
real warnings.

**Always look at the frames before you publish.** A successful render says nothing about text
that is cut off, overlapping, unreadable, or in the wrong font, or an arrow that points the wrong
way. Sample frames at scene changes and at the key moments of the explanation, not only at even
intervals. For long videos, check per chapter with 6-8 frames each so the sheet stays readable.
Check that the audio is present and at a normal level:

```bash
ffmpeg -hide_banner -i renders/<lesson-id>.mp4 -vn -af volumedetect -f null /dev/null 2>&1 | grep -E "mean_volume|max_volume"
```

Command output: `transcribe`, `tts` and `render` print spinners; pipe through
`2>&1 | tr '\r' '\n' | tail -20` when you need the output.

## 8. Publish

```bash
mkdir -p lessons/media
cp videos/<lesson-id>/renders/<lesson-id>.mp4 lessons/media/<lesson-id>.mp4
ffmpeg -v error -y -ss <a representative second> -i lessons/media/<lesson-id>.mp4 -frames:v 1 -q:v 3 lessons/media/<lesson-id>-poster.jpg
```

Then call `mcp__learn__publish_video` with the lesson ID, `file: "lessons/media/<lesson-id>.mp4"`
and the poster path. The lesson's `<div data-learn-video>` shows the player.

If you cannot finish, call `mcp__learn__video_failed` with a short reason. Do not leave a
planned video without a result.

## 9. Fixing a video later

When notes or answers show a part of a video confused the learner, stay in the same project:
change only that part (script line, timing, a diagram), regenerate only the affected voice lines,
re-render to the same path, and publish again. Typical fixes:

| Problem | Edit |
|---|---|
| Too fast | Longer gaps between lines; hold key frames longer. Multiply durations and positions by the same factor and check the root duration still fits. |
| A word is mispronounced | Rewrite that line's text (spell it out), regenerate that line, re-anchor its events. |
| A diagram was misunderstood | Add a labelled step, slow the motion, or show the components one at a time. |
| Card a bit early/late | Re-anchor to the exact word in `vo/lineNN.json`. |
| Plain fallback font | The `@font-face` path is wrong or the file is missing. |
| Huge file | Render with `--crf 23`. |

# Recipes

Each recipe is a shape that worked, not a script to copy. Adapt timings to the actual words.

## Contents
1. Text-only reel
2. Product launch video
3. SaaS promo from screenshots
4. Graphics on the user's own video
5. Fix one spot
6. Sound effects
7. Transparent overlay export

---

## 1. Text-only reel

Default: 1080x1920, 30 fps, 15 s, one sentence per screen.

- Use the user's exact words. Never rewrite, shorten or "punch up" the script — it is theirs.
  Splitting into screens happens at sentence boundaries only.
- Long sentence → wrap over two or three lines on the same screen, never split across screens.
- Budget time by word count: give each screen `max(1.2, 0.3 × words) + entry` seconds, then scale
  so the total equals the requested length. Check the shortest screen is still readable.
- Keep all text inside the middle 80 % of the width.
- Any STYLE block decides the look; with none, use Liquid Glass.

## 2. Product launch video

Default: 1920x1080, 12 s. Structure that worked:

| Time | Beat |
|---|---|
| 0–2 s | logo or product name reveal |
| 2–9 s | 3 feature moments, ~2.3 s each — each one **shows** the product doing the thing (a UI built in HTML/CSS: a "Connected" button state, a fees table that fills, a phone notification), with one short line beside it |
| 9–12 s | end card: product name, one short line, call to action |

- If `product.png` (or similar) is in the folder, use it as the hero; otherwise build the product
  UI, logo, or a phone mock-up in HTML/CSS.
- If the user gives no numbers, invent clearly plausible example numbers and tell them which ones
  you made up.
- Layout: copy left (~40 %), UI right (~50 %) reads well at 16:9.

## 3. SaaS promo from screenshots

Default: 1920x1080, ~60 s, Kinetic-flavoured.

1. Open and look at every image in `screenshots/` first (Read each one). Write down what each
   shows and the one region that matters (a number, a chart, a button).
   No screenshots yet but a live site? `node <skill-dir>/scripts/shoot.mjs <url> out.png 1440 900 0 3000 [1=full page]`
   takes a 2× shot with the headless Chrome that HyperFrames already installed. Scroll the whole page once before the shot so
   scroll-triggered reveals fire, and remove fixed-position popups (cookie/sign-up) first.
   `npx hyperframes capture <url>` also pulls the site's assets, fonts and colours.
   A full-page screenshot inside a browser-window frame, panned with `y`, makes a deterministic
   "scroll recording".
2. Use the screenshots as they are — `<img>`, never redrawn. Zoom and pan into the region that
   matters by animating a wrapper (`scale` + `x/y` computed from the region's pixel box), and
   outline that region with a highlight box.
3. Pattern per screen: big bold word card (0.8–1.2 s) → screenshot full → zoom to region with a
   short caption of what it does for the customer (3–5 s).
4. Cuts land on a steady beat (e.g. every 0.5 s grid); hook first, logo + one line + CTA last.
5. Screenshots are often 2–3× the canvas; set `width` on the image and compute zoom targets from
   its displayed size, not the file size.

## 4. Graphics on the user's own video

The footage is sacred: same size, frame rate, audio and cut. You only add graphics on top.

1. Probe it: `ffprobe -v error -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of compact clip.mp4`.
   Build the composition at exactly that size and duration.
2. Transcribe: `npx hyperframes transcribe clip.mp4 2>&1 | tr '\r' '\n' | tail -5` → `transcript.json`
   (word list with `start`/`end`). If whisper is missing, stop and tell the user to run setup.
   The first run downloads the whisper model (a few hundred MB), so it can take a minute.
3. Read the whole transcript and decide what the video is about and which 2–4 moments matter.
   Map each to a graphic made for that moment: a number → counter, a list → checklist that ticks
   on each item's word, before/after → comparison card.
4. Whisper word starts can be ~0.1–0.15 s late on connected speech; when a hit must land on a
   word, check it against the waveform (`ffmpeg -af silencedetect` or by ear).
   Anchor each graphic's start to the `start` of the exact word (e.g. the word "forty"), not to a
   rounded second. Checklist items tick on their own words.
5. Rules: nothing in the first 3 s (that is the hook); one style for the whole video; keep off the
   face, out of the bottom third (captions), and away from the outer 10 % left and right. In a
   centred talking-head shot, the usable band is usually just above the bottom third, between the
   chest and the caption area.
6. Place the clip as `<video id="a-roll" src="clip.mp4" data-start="0" data-duration="D"
   data-has-audio="true" playsinline>` — no `muted`, no `crossorigin`, and no timed wrapper around
   it.
7. Check frames at each graphic's midpoint against the face position before rendering the whole
   thing (`npx hyperframes snapshot --at 5,10,17`).

## 5. Fix one spot

Build the base first and get it right; then change one moment at a time. When the user describes
the moment in words ("when I say Sales went from 40 a week to over 90"), find that phrase in
`transcript.json` and use its word timings — words beat seconds. Keep everything else exactly the
same and render to the same file. For a sequence of screenshots ("pop up one after another"), cut
them on successive words of that phrase so they stay in sync with the voice.

## 6. Sound effects

Files: the `sfx/` folder (or `scripts/make-sfx.sh` to make one).

- A tick when each list item or check appears, the counter sound while a number rolls, a chime on
  the last card. That is all.
- No sound when a card slides in or leaves. No whooshes.
- Keep them quiet under the voice, ~20 dB below it: `data-volume="0.1"`–`0.2` is a good start for
  the synthesized files; on text-only videos with no voice, ~0.4.
- Each sound is its own `<audio id="sfx-tick-1" src="sfx/tick.wav" data-start="4.5"
  data-duration="0.1" data-volume="0.15">`. **Every `<audio>` needs a unique `id`**, or it is
  silently dropped from the mix.
- Trim the counter sound to the roll length with `data-duration`.
- Verify the render has an audio stream (`ffprobe ... -show_streams`) and list in the report each
  sound with its time.

## 6b. Voiceover and music

- Local voiceover: `npx hyperframes tts "<line>" -v af_heart -o vo/vo_01.wav` (Kokoro-82M). Needs
  `kokoro-onnx` + `soundfile` in a Python that HyperFrames can find; on Homebrew Python (PEP 668)
  make a venv and point `HYPERFRAMES_PYTHON` at its `python`.
- One file per line, each placed at its own `data-start`; trim silence
  (`silenceremove` both ends) and normalise (`loudnorm=I=-16:TP=-2`). Then transcribe each line
  to get word times inside it and move visual hits onto those words.
- No music library? A short procedural bed (numpy: soft kick, shaker, marimba motif, pad) on a
  BPM grid that matches the cut points works and is licence-free. Sit it ~12–15 dB under the voice.
- OpenAI Codex CLI signed in with a ChatGPT account has no text-to-speech or music tool; don't
  route audio through it.

## 7. Transparent overlay export

For use over footage in Premiere / After Effects / Resolve.

1. Make the page transparent first: `html, body, #root { background: transparent; }` and remove
   full-frame backgrounds/blobs. Otherwise you get "a transparent file of a solid background".
2. Frosted cards lose their blur with nothing behind them — switch to solid cards.
3. Export:
   ```bash
   npx hyperframes render --format mov -o renders/card.mov               # ProRes 4444 + alpha
   npx hyperframes render --format png-sequence -o renders/card-png      # RGBA PNGs
   ```
4. Verify alpha: `ffprobe -v error -select_streams v -show_entries stream=codec_name,pix_fmt renders/card.mov`
   should show `prores` and a `yuva444p…` pixel format; check a corner pixel of a PNG frame is
   alpha 0.

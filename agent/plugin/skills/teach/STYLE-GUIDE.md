# Stoa lesson style guide

Lessons and reference pages must look like part of the Stoa app. The app does most of the work:
it injects the **lesson kit** (`/stoa/lesson.css`) into every HTML page it serves from the
workspace, before your own styles. Write plain, semantic HTML and use the kit's classes. A full
working example is in [LESSON-EXAMPLE.html](./LESSON-EXAMPLE.html): start every lesson from it.

## The look in one paragraph

White page, near-black text, one blue accent used only for actions, the current selection, focus
and progress. System font, calm spacing, a 68-character reading column. No decoration: no
gradients, no textures, no emoji as icons, no colored side stripes, no drop-shadow cards. The
lesson leads; color appears where it means something (a right or wrong answer, a diagram series).

## What the app uses

- **Primary color:** blue `#2563eb` (`--accent`; hover `#1d4ed8`, soft tint `#eef3fe`). In dark
  mode `#4f86f7`. It marks primary buttons, the current selection, focus rings and progress.
- **Text:** `#0f0f11` (`--ink-1`), `#3f4048` (`--ink-2`), `#62636b` (`--ink-3`) on white `#ffffff`;
  quiet panels `#f7f7f8` (`--surface-2`); hairlines `#e6e6e9` (`--line`).
- **States:** correct `#15803d` (`--ok`), wrong `#b91c1c` (`--bad`), hint `#a16207` (`--warn`).
- **Fonts:** the system sans for everything (`-apple-system, BlinkMacSystemFont, "Segoe UI",
  system-ui, Roboto, "Noto Sans", sans-serif`; token `--font`); a math serif for formulas
  (`"STIX Two Math", "Cambria Math", "Times New Roman", serif`; `--math`); the system monospace
  for code (`ui-monospace, "SF Mono", Menlo, Consolas, monospace`; `--mono`). Weights 400, 500,
  600 (titles 650). Sizes: body 17px, lede 19px, h2 22px, h1 32px, UI 14px.

## The topic look (your colors)

Each topic can have its own look, so an ESP32 course does not feel like a Spanish course. You
choose it once per topic, at the first lesson, from the subject (for example a circuit-board
green for electronics, a terracotta for Spanish, a chalkboard teal for maths) and you keep it for
every lesson in the topic.

- Put it in `library/topic.css` and link it from every lesson and reference page:
  `<link rel="stylesheet" href="../library/topic.css">` (after the `<title>`).
- Set the three topic tokens. The kit uses them for callouts, step numbers and glossary terms:
  `--topic` (the topic color), `--topic-soft` (a pale tint for backgrounds), `--topic-ink` (a dark
  shade for text on white and on the tint). Define a dark-mode version too.
- You may add more colors of your own (`--topic-2`, `--topic-3`, illustration colors) for
  diagrams, simulations, illustrations, section art and the video. Use them freely in figures.
- Contrast: `--topic-ink` must reach 4.5:1 on white and on `--topic-soft`; check it.
- Keep these as the app's: the primary button, focus rings, correct and wrong states, and the
  fonts. Topic colors decorate and explain; they never signal right or wrong.

```css
/* library/topic.css: Electronics */
:root { --topic: #0f8a5f; --topic-soft: #e8f6ef; --topic-ink: #0b5e41; --topic-2: #d4a017; }
:root[data-theme="dark"] { --topic: #3cc48f; --topic-soft: #12271e; --topic-ink: #8fe3bf; --topic-2: #e9bd45; }
```

## Rules

1. **Do not set the page fonts, base text colors, or the page background.** Do not link other
   font files or CSS frameworks for the page itself. The kit sets them, and it also switches to
   dark mode when the learner chooses it; hard-coded colors break dark mode. Your colors come in
   through the topic look above.
2. **Use tokens for any color you need**, for example in an inline SVG diagram or a simulation:
   `var(--ink-1)` (text), `var(--ink-2)`, `var(--ink-3)` (secondary), `var(--line)`,
   `var(--surface-2)` (quiet panel), `var(--accent)`, `var(--ok)`, `var(--bad)`, and the diagram
   series `var(--viz-1)` … `var(--viz-5)` (blue, red, teal, amber, violet), and your topic
   colors `var(--topic)`, `var(--topic-2)` and so on. In canvas code, read
   them with `getComputedStyle(document.documentElement).getPropertyValue("--viz-1")`.
3. **Structure:** everything inside one `<main>`. Order: `.meta` line, `<h1>`, `.lede` (which says, in a normal
   sentence, how this lesson connects to the learner's goal), the video area, then sections with `<h2>`, then exercises, then
   `.lesson-foot`.
4. **Headings:** one `<h1>` (the lesson title). Sections use `<h2>`, subsections `<h3>`. No labels
   or kickers above headings. No section numbers unless the order itself matters. Every title and
   heading says what the section teaches, in plain words (WRITING.md, "Titles and headings").
5. **Lesson-specific CSS** goes in a small `<style>` in the page (layout of a simulation, a
   special figure). Reuse spacing tokens `--s-1` … `--s-8` (4 8 12 16 24 32 48 64 px) and radii
   `--r-sm`, `--r-md`, `--r-lg`.
6. **Accessibility:** every input has a visible `<label>`; diagrams have `role="img"` and an
   `aria-label`; never rely on color alone (the kit's feedback lines add a ✓/✗ icon and text).
7. **Keep the learner's work.** The app saves what the learner types or picks in any `input`,
   `textarea` or `select` and puts it back when the page reloads, so give every field a stable
   `id`. Answers that were already checked must come back too: on load, call
   `learn.responses()` and restore each answered item (its field classes, the selected option, the
   feedback line, the score). The example lesson shows how. Links to other lessons and reference
   pages work as normal links; the app opens them without unloading the lesson.
8. **Motion:** only for feedback and for explanation (a simulation, a step-by-step reveal). Keep
   feedback and state changes under 300 ms with `var(--ease-out)`; a rare entrance or a progress
   fill may take up to about 500 ms. Explanatory animation can be as long as it needs. Always
   respect `prefers-reduced-motion` (replace movement with a short fade).

## Components

| Need | Markup |
|---|---|
| Meta line | `<p class="meta"><span>Lesson 2</span><span>About 12 minutes</span></p>` |
| Lede | `<p class="lede">…</p>` |
| Key-idea box (a rule or definition the learner should keep; not a goal or a "why this matters") | `<div class="callout"><p>…</p></div>` |
| Neutral note / warning | `.callout.note`, `.callout.warn` |
| Video area | `<div data-learn-video></div>` (the app fills it) |
| Citation | `<a class="cite" href="…">[OpenStax, 4.3]</a>` |
| Glossary term in text | `<span class="term">velocity</span>` |
| Formula block | `<div class="formula"><p>v<sub>x</sub> = v · cos θ</p></div>`; inline: `<span class="math">v<sub>x</sub></span>` |
| Diagram | `<figure><svg class="diagram" viewBox="…" role="img" aria-label="…">…</svg><figcaption>…</figcaption></figure>` |
| Explainer figure (a machine whose working is the concept) | Anatomy figure inside `<div class="iso">…</div>`, no `data-theme`; see SKILL.md, "Figures" |
| Code | `<pre><code>…</code></pre>`; inline `<code>` |
| Real-world steps | `<ol class="steps"><li>…</li></ol>` |
| Optional depth | `<details><summary>Why sine is the vertical one</summary><p>…</p></details>` |
| Table | plain `<table>`; numeric cells `class="num"` |
| Buttons | `.btn` (secondary), `.btn.btn-primary` (one main action per exercise), `.btn-quiet` |
| Exercise | `<section class="exercise"><span class="count">Exercise 1 of 3</span><h2>Question</h2> … <div class="actions"><button class="btn btn-primary">Check</button></div></section>` |
| Text or number input | `<div class="fields"><div class="field"><label for="a">…</label><input class="input" id="a"></div></div>`; long answer: `<textarea class="input">` |
| Input result | add `is-correct` or `is-wrong` to the `.input` |
| Multiple choice | `<div class="options"><button class="option">…</button>…</div>`; mark `is-selected`, `is-correct`, `is-wrong`; disable after answering if one try only |
| Feedback line | `<p class="feedback ok">Right: …</p>` or `<p class="feedback bad">Not yet: …</p>` |
| Hint | `<p class="hint">Check your calculator is in degrees …</p>` |
| Score | `<span class="score">3 of 4 correct</span>` |
| Finish | `<div class="lesson-foot"><button class="btn btn-primary">Finish lesson</button><span>Questions? Ask the tutor on the right.</span></div>` then a `.done-card` after `learn.complete()` |

## Writing in the page

How to explain, the voice (a teacher talking to a student, never marketing copy), and the
editing pass are in [WRITING.md](./WRITING.md). In short:

- Address the learner as "you". Name Athena when you refer to yourself in the page ("Athena
  reads this before your next lesson"). The side chat is "the tutor".
- Buttons say what they do: "Check", "Send to Athena", "Finish lesson", "Show the answer".
- Feedback says what is right or wrong and why, never only "Correct!" or "Wrong".
- No exclamation marks; no emoji. Describe things at their real size, without hype.

## Reference pages

Reference documents in `reference/` use the same kit and the same `<main>` structure. They are
for quick review: a short `.lede`, then tables, formulas, code and diagrams; little prose. Give
each page a `<title>`; the app lists references by their title.

## Videos

Videos should feel like the same product: white or `#f7f7f8` background, ink `#0f0f11`, the
topic colors from `library/topic.css` as the main accents (else the app blue `#2563eb`), the
diagram series `#2563eb #e5484d #12a594 #d97706 #8e4ec6`, and one neutral sans for all on-screen
text. The `lesson-video` skill has the details.

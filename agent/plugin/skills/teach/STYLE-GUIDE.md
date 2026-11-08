# Stoa lesson style guide

Lessons and reference pages must look like part of the Stoa app. The app does most of the work:
it injects the **lesson kit** (`/stoa/lesson.css`) into every HTML page it serves from the
workspace, before your own styles. Write plain, semantic HTML and use the kit's classes. A full
working example is in [LESSON-EXAMPLE.html](./LESSON-EXAMPLE.html): start every lesson from it.

## The look in one paragraph

White page, near-black text, a reading column of about 68 characters, system font, calm spacing.
Color comes only from **the lesson palette** below, and it appears where it means something: an
action, a right or wrong answer, a diagram series, a highlight. No decoration: no gradients, no
textures, no emoji as icons, no colored side stripes, no drop-shadow cards.

## The lesson palette (the only colors)

Lessons, reference pages, figures, simulations and videos use these five colors, plus black and
white. Nothing else: no other hues, and no "nearby" shades of these.

| Name | Hex | Token | What it is for |
|---|---|---|---|
| Charcoal | `#264653` | `--charcoal` | Primary buttons and links (light mode), strong figure lines |
| Teal | `#2a9d8f` | `--teal` | Correct answers, focus, the topic accent, first diagram series |
| Saffron | `#e9c46a` | `--saffron` | Hints and highlights (as a fill or tint, not as thin lines or text on white) |
| Sandy | `#f4a261` | `--sandy` | A second accent in figures |
| Sienna | `#e76f51` | `--sienna` | Wrong answers, warnings, the item to watch in a figure |
| Black / white | | `--ink-1` … `--ink-3`, `--line`, `--surface-2` | Text, hairlines, quiet panels (grays are black mixed with white) |

- Tints of a palette color (for a soft background) are that color mixed with white, or with the
  dark background in dark mode; the kit already provides them (`--topic-soft`, `--ok-soft` …).
- Text: use ink (black) or charcoal on white. Teal, sandy, saffron and sienna are below 4.5:1
  on white, so never use them for body text or small labels; use them for shapes, lines, fills,
  icons and large figure labels.
- Dark mode: the kit swaps charcoal for teal on actions and links, and white stands in for
  charcoal in figures. Use the tokens, never the hex values, and dark mode works by itself.
- Check your page with `mcp__learn__preview_page`: it renders it in both themes and lists any
  text below 4.5:1 contrast and any color outside the palette.
- The app enforces the tokens: it loads the palette after your styles, so `--topic`, `--viz-*`,
  `--ok`, `--bad` and the rest always resolve to the palette. Hard-coded hex values are the only
  way to break it, so do not write them.

## The topic look

Topics share one palette; a topic's character comes from its figures, examples and video, not
from new colors. Do not create `library/topic.css` color overrides (old ones are overridden by the
palette). For extra figure colors use `var(--topic-2)` (sandy), `var(--topic-3)` (sienna),
`var(--topic-4)` (saffron) and `var(--topic-5)` (charcoal in light mode, white in dark mode), each
with a `-soft` tint.

## Rules

1. **Do not set the page fonts, base text colors, or the page background.** Do not link other
   font files or CSS frameworks for the page itself. The kit sets them, and it also switches to
   dark mode when the learner chooses it; hard-coded colors break dark mode and the palette.
2. **Use tokens for any color you need**, for example in an inline SVG diagram or a simulation:
   `var(--ink-1)` (text), `var(--ink-2)`, `var(--ink-3)` (secondary), `var(--line)`,
   `var(--surface-2)` (quiet panel), `var(--accent)`, `var(--ok)`, `var(--bad)`, the diagram
   series `var(--viz-1)` … `var(--viz-5)` (teal, sienna, saffron, sandy, charcoal/white), and
   the topic colors `var(--topic)`, `var(--topic-2)` … `var(--topic-5)`. In canvas code, read
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

Videos use the lesson palette too: white or `#f7f7f8` background (or a charcoal `#264653`
title card), ink `#0f0f11`, and only `#264653 #2a9d8f #e9c46a #f4a261 #e76f51` for accents and
diagram series (in that role order: teal, sienna, saffron, sandy, charcoal). One neutral sans
for all on-screen text. The `lesson-video` skill has the details.

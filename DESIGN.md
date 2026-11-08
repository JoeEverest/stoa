---
name: Stoa
description: A self-hosted learning app where a quiet frame holds one learner's lessons.
colors:
  bg: "#ffffff"
  surface-2: "#f6f7f8"
  surface-3: "#eef0f1"
  line: "#e5e9ea"
  line-strong: "#d4dadd"
  ink-1: "#0f1c22"
  ink-2: "#33454d"
  ink-3: "#5a6b72"
  ink-4: "#adb9be"
  accent: "#264653"
  accent-hover: "#192e37"
  accent-ink: "#1c685e"
  accent-soft: "#f2f9f8"
  accent-line: "#99d0c9"
  on-accent: "#ffffff"
  ok: "#228175"
  ok-soft: "#f2f9f8"
  ok-line: "#99d0c9"
  ok-ink: "#154e48"
  bad: "#984935"
  bad-soft: "#fef6f5"
  bad-line: "#f3baab"
  bad-ink: "#53281d"
  warn: "#746235"
  warn-soft: "#fcf7ea"
  warn-ink: "#382f19"
  viz-1: "#2a9d8f"
  viz-2: "#e76f51"
  viz-3: "#e9c46a"
  viz-4: "#f4a261"
  viz-5: "#264653"
  progress: "#2a9d8f"
  focus: "#2a9d8f"
  highlight: "#e9c46a"
  highlight-soft: "#fcf7ea"
  highlight-ink: "#382f19"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  ui:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "tnum"
  secondary:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, Roboto, Noto Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  mono:
    fontFamily: "ui-monospace, SF Mono, Menlo, Consolas, Liberation Mono, monospace"
    fontSize: "0.875em"
    fontWeight: 400
  math:
    fontFamily: "STIX Two Math, Cambria Math, Times New Roman, Times, serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.on-accent}"
  button-secondary:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-1}"
    typography: "{typography.ui}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-1}"
  button-waiting:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    height: "36px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  send-button:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    size: "30px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  input-correct:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ink-1}"
  input-wrong:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.ink-1}"
  option:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  option-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink-1}"
  option-correct:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ink-1}"
  option-wrong:
    backgroundColor: "{colors.bad-soft}"
    textColor: "{colors.ink-1}"
  composer:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.lg}"
    padding: "12px"
  callout:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.lg}"
    padding: "16px"
  callout-note:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.lg}"
    padding: "16px"
  callout-warn:
    backgroundColor: "{colors.warn-soft}"
    textColor: "{colors.warn-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  exercise:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.lg}"
    padding: "24px"
  done-card:
    backgroundColor: "{colors.ok-soft}"
    textColor: "{colors.ok-ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  rail:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-1}"
    width: "240px"
    padding: "12px"
  topic-current:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink-1}"
    rounded: "{rounded.md}"
    padding: "8px"
  lesson-item-current:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "8px"
  tutor-panel:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-1}"
    width: "340px"
  toast:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System: Stoa

## Overview

**Creative North Star: "The Quiet Frame"**

Stoa is the category standard for a learning tool, executed at full craft, with no metaphor and no themed world. The app is a quiet frame. The lesson in the centre column is the product, and every other surface steps back from it. The craft bar is Brilliant.org, Claude.ai and Notion: white paper, a near-black three-step ink ladder, hairline borders, and one charcoal-and-teal voice that appears only where it means something.

The density is that of a work tool, not a marketing page. App chrome uses 14px text and 36px controls. The lesson uses 17px body text at a 68-character measure, so the learner can read for an hour. Progress, waiting and Athena's status are always visible and always specific. Waiting is calm: hatched segments, a slow spinner, a sentence about what Athena does now.

App and lessons share one token file (`shared/tokens.css`). Agent-written lesson pages get the same tokens and a lesson kit (`shared/lesson.css`), so a lesson looks like part of the app. The agent-facing rules for lesson markup live in `agent/plugin/skills/teach/STYLE-GUIDE.md`. This file does not repeat them.

Light mode is the default. Dark mode applies only when the user chooses it with the appearance switch (`data-theme="dark"` on `<html>`). Every token has a dark counterpart (see `.impeccable/design.json`).

**Key Characteristics:**
- White surfaces, a cool off-white second layer for rails and the tutor, 1px hairlines.
- One accent: charcoal for primary actions and the current place, teal for focus and progress.
- System font stack, a fixed rem type scale, tabular numerals everywhere in the UI.
- 8px radius on controls, 12px on panels and lesson blocks.
- Near-flat: two small shadows, used on controls and floating items, never on content cards.
- Short, purposeful motion on one ease-out curve; reduced motion falls back to fades.

## Colors

Five colors, one palette for the app and its lessons: charcoal #264653, teal #2a9d8f, saffron #e9c46a, sandy #f4a261, sienna #e76f51 ([coolors](https://coolors.co/palette/264653-2a9d8f-e9c46a-f4a261-e76f51)). Each has a tonal ramp in `shared/tokens.css` (`--teal-50` to `--teal-950`: mixed with white below 500, with black above). App code uses the role tokens, not the ramp; a new role gets a token first.

### Primary
- **Charcoal** (accent, accent-hover): primary buttons, the current lesson and topic, the lesson-number disc of a completed lesson, Athena's avatar. In dark mode charcoal disappears, so teal takes this role (with black text on it).
- **Deep Teal** (accent-ink, teal-700): links, Athena's status line, the current lesson name. Text in the accent always uses accent-ink.
- **Teal Wash** (accent-soft) with **Teal Hairline** (accent-line): the current lesson row, selected options and choices, link underlines.
- **Teal** (progress, focus): meters, progress segments, spinners, focus rings and the border of a focused field.
- **Saffron** (highlight, highlight-soft, highlight-ink): something new or needing attention that is not an error, such as "not connected yet" in Settings.

### Neutral
Greys are tinted toward charcoal.
- **Paper** (bg): the page, the lesson stage, cards, inputs.
- **Rail Grey** (surface-2): the left rail, the tutor panel, code blocks, quiet notes, secondary-button hover.
- **Well Grey** (surface-3): hover on rail items, user chat bubbles, empty progress segments, segmented-control tracks.
- **Hairline** (line) and **Strong Hairline** (line-strong): dividers and block borders; control borders.
- **Ink 1 to Ink 3**: primary, secondary and tertiary text. Ink 3 passes WCAG AA on Paper, Rail Grey and Well Grey.
- **Ink 4**: decoration only (dots, separators, numberless rings). Never text.

### Tertiary (states)
- **Right Teal** (ok, ok-soft, ok-line, ok-ink): correct answers, the completion card, "connected".
- **Wrong Sienna** (bad, bad-soft, bad-line, bad-ink): wrong answers, errors, the hover on the "Stop" link. Text uses sienna-700, which passes AA; plain sienna is for fills and icons.
- **Hint Saffron** (warn, warn-soft, warn-ink): hints and warning callouts, with dark saffron text.

### Topic look (per topic)
Each topic may set `--topic`, `--topic-soft` and `--topic-ink` (plus its own extra colors such as `--topic-2`) in its workspace's `library/topic.css`, with a dark-mode version. They default to the accent values. The lesson kit uses them for callouts, step numbers and glossary terms, and Athena uses them in diagrams and videos. They never replace the primary button, focus rings, the correct/wrong states or the fonts. Rules for Athena: `agent/plugin/skills/teach/STYLE-GUIDE.md`, "The topic look".

### Diagram series
- **viz-1 to viz-5** (teal, sienna, saffron, sandy, charcoal): figures, charts, simulations and video posters only. They never carry UI state.

### Named Rules
**The One Voice Rule.** Charcoal (teal in dark mode) marks an action or the current place; teal marks focus and progress. If an accent-colored element is none of these, it is wrong.

**The Token-Only Rule.** Lessons and app code read colors from tokens, never hard-coded hex values, so dark mode works. The only exception is the black letterbox behind a started video.

**The Decoration Ink Rule.** Ink 4 is for dots, rings and separators. Text uses Ink 1, 2 or 3.

## Typography

**Display Font:** system UI stack (`-apple-system`, Segoe UI, Roboto, Noto Sans)
**Body Font:** the same system UI stack
**Label/Mono Font:** `ui-monospace` stack for code; STIX Two Math (with Cambria Math, Times) for formulas only

**Character:** One neutral sans for everything, given weight and tight negative tracking at heading sizes. It reads as a tool, not a brand.

### Hierarchy
- **Display** (650, 2rem, 1.25, -0.025em): the lesson title and the "New topic" page title. One per page.
- **Headline** (600, 1.375rem, 1.3, -0.015em): lesson sections (`h2`).
- **Title** (600, 1.125rem, 1.4): lesson subsections (`h3`). The app top bar uses a 20px/28px, 600, -0.015em topic title.
- **Lede** (400, 1.1875rem, 1.6, Ink 2): the paragraph after the lesson title, at 64ch.
- **Body** (400, 1.0625rem, 1.65): lesson text, at 68ch for paragraphs and 66ch for lists.
- **UI** (400 or 500, 0.875rem, 20px): controls, lists, chat, tables.
- **Secondary** (0.8125rem, Ink 3): status lines, captions, meta lines.
- **Label** (500, 0.75rem, Ink 3, sentence case): rail and column group labels ("Topics", "Lessons"), list meta.

### Named Rules
**The Sentence Case Rule.** All labels are sentence case, with no uppercase tracking. No label or kicker sits above a heading. The lesson meta line holds facts only (lesson number, time, topic).

**The Tabular Rule.** UI numerals are tabular (`font-variant-numeric: tabular-nums`), so counts and scores do not shift.

## Layout

The desktop shell is a fixed grid of columns. Left rail 240px. A topic header with the title, a segmented progress bar, a one-line status and the primary action. Below it: the lesson list (240px), the lesson stage (flexible, the hero), and the tutor (340px) when open. The lesson inside the stage is centred at a 680px maximum with 48px top padding.

At 1180px and below, the lesson list narrows to 220px and the tutor to 300px. At 860px and below, the rail becomes two rows at the top (brand, new topic and theme; then topics in a horizontal scroll). The workspace becomes one column: a collapsible lesson outline, the lesson at 78vh, then the tutor at 70vh.

Spacing follows a 4px-based scale (4, 8, 12, 16, 24, 32, 48, 64). Lists use 2px gaps between rows. Lesson sections start 48px after the previous block; paragraphs start 16px apart.

**The Measure Rule.** Reading text never runs wider than 68ch.

## Elevation & Depth

Stoa is near-flat. Depth comes from tonal layers (Paper over Rail Grey over Well Grey) and hairlines. Two shadows exist. The small one lifts interactive controls slightly off the page. The larger one is only for items that float above the layout.

### Shadow Vocabulary
- **Control lift** (`--shadow-1`, `0 1px 2px rgba(15,15,17,0.05)`): secondary buttons, the composer, the current topic row, the selected theme button.
- **Float** (`--shadow-2`, `0 4px 12px rgba(15,15,17,0.08), 0 1px 3px rgba(15,15,17,0.06)`): the toast and the video play button.
- **Focus ring** (`--ring`, a 2px Paper gap then a 2px accent ring): every `:focus-visible`.
- **Field ring** (`--field-ring`, 3px accent at 18%): focused inputs and the focused composer.

### Named Rules
**The Flat Content Rule.** Content blocks (callouts, exercises, code, formulas, details, the video frame) have a border or a tint, never a shadow.

## Shapes

Gently rounded, never pill-shaped. Controls, rows and inline code use 8px (or 6px for small parts such as inline code, theme buttons and the avatar). Panels and lesson blocks use 12px. Circles are for status only: lesson-number discs, step counters, status dots and the video play button. Progress segments are 36 by 6px with 3px ends. Borders are 1px; numbered discs use a 1.5px inset ring.

Icons are one family: a 16px grid, 1.5px stroke, round caps and joins, `currentColor`, inline SVG (`web/src/icons.tsx`). The Stoa mark is three columns under a lintel, in a 6px-radius square.

## Components

### Buttons
Calm and exact; the primary button is the only filled color in the frame.
- **Shape:** 8px radius, 36px tall in the app (40px in lessons), 500 weight, 14px text, 8px icon gap.
- **Primary:** Charcoal fill, white text, a faint charcoal-tinted shadow. Hover goes to charcoal-700. One primary action per view ("Next lesson") and per exercise ("Check").
- **Secondary:** Paper fill, Strong Hairline border, Control lift. Hover goes to Rail Grey with an Ink 4 border.
- **Waiting:** a secondary button that holds a teal spinner and says what is in progress ("Next lesson in progress"). It is not a disabled primary.
- **Quiet (lessons):** no border, no fill, Ink 2 text.
- **Press:** every button scales to 0.97 over 160ms on the ease-out curve.
- **Link button:** small Ink 3 text with an underline in Strong Hairline (the "Stop" control); hover turns it Wrong Red.

### Inputs / Fields
- **Style:** 44px tall, 8px radius, Strong Hairline border, Paper fill, 16px 500 tabular text. A textarea is 120px minimum and resizes vertically.
- **Focus:** the border turns teal and the field ring appears.
- **Result:** correct turns the border Right Green over a green wash; wrong uses Wrong Red the same way.

### Multiple-choice options
Full-width rows, 48px minimum, 8px radius, Strong Hairline border. Hover tints to Rail Grey. Selected uses the Teal Wash and a teal border; correct and wrong use the state washes. Press scales to 0.99.

### Exercise and feedback
An exercise is a 12px-radius block with a Hairline border and 24px padding, a right-aligned "Exercise N of M" count, the question as a body-size heading, and an actions row. Feedback lines carry an SVG tick or cross plus a sentence that says why. Hints sit in an amber well. The completion card is a green wash.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper with a Hairline border (exercise, details), Rail Grey with a Hairline (note, code, formula, diagram), or a tint without a border (mission callout in Teal Wash, warning in saffron).
- **Shadow Strategy:** none (see The Flat Content Rule).
- **Internal Padding:** 16px for callouts, 16 by 24px for code and formulas, 24px for exercises.

### Navigation
- **Left rail:** Rail Grey with a right hairline. Brand, a secondary "New topic" button, a "Topics" label, then topic rows. A row is a dot (or a spinner when Athena works) with the name and a one-line meta. Hover is Well Grey. The current topic is lifted onto Paper with a hairline and Control lift.
- **Lesson list:** numbered discs. Done is a filled charcoal disc with a tick that draws in once. Current is a Teal Wash row with an accent ring and a deep-teal name. Building is a teal spinner with Athena's status in deep-teal text.
- **Mobile:** the rail becomes a top bar with horizontal topics; the lesson list collapses behind a toggle that shows "Lesson N of M" and the title.

### Segmented progress bar (signature)
One segment per lesson in the topic header. Done segments fill teal from the left over 520ms. The current segment is a Teal Wash with a teal hairline. A lesson that Athena is building shows as a grey hatched segment that crawls slowly. This is the only gradient in the system, and it signals a state.

### Composer and tutor
The composer is a 12px-radius Paper box with a Strong Hairline border and Control lift. On focus it takes the accent border and field ring. Its send button is a 30px Ink 1 square with a Paper arrow. The tutor panel is Rail Grey with a hairline, a short heading and suggestion chips (the bordered "example" buttons).

### Video area
A 16:9 frame with a 12px radius, a Hairline border and a Rail Grey poster ground, with a 72px accent play disc. While the video renders, the frame is a dashed Strong Hairline box with a sentence, a reason and a sliding teal bar.

### Motion
One curve: `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`). Press 160ms, hover and color 120ms, state changes 200ms, entrances 320ms. Entrances (a 4px rise and fade) apply only to items that arrive while the view is open: new chat messages, a new lesson row, feedback, the toast. Under `prefers-reduced-motion`, entrances become fades, press scaling stops, and looping hatches and bars stop.

## Do's and Don'ts

### Do:
- **Do** read every color, space and radius from `shared/tokens.css`; lessons follow `agent/plugin/skills/teach/STYLE-GUIDE.md`.
- **Do** keep the accent for actions and the current place, and teal for focus and progress (The One Voice Rule).
- **Do** give every waiting state a specific sentence about what Athena does now.
- **Do** put 8px radius on controls and 12px on panels and lesson blocks.
- **Do** use the 160ms press scale (0.97) on buttons and the 4px rise only for items that arrive while the view is open.
- **Do** pair every color signal with an icon or words (feedback ticks and crosses, status text).
- **Do** keep reading text at 68ch or less.

### Don't:
- **Don't** add a course-catalog dashboard: card grids, streaks, badges or hero metrics.
- **Don't** put shadows on content blocks; shadows belong to controls and floating items only.
- **Don't** use decorative gradients or textures. The hatched "being built" segment and the video-wait bar are state signals, not decoration.
- **Don't** add colored side stripes. A neutral left rule (Strong Hairline on blockquotes, Hairline on chat activity lines) is part of the system.
- **Don't** place a label, kicker or eyebrow above a heading, and don't use uppercase tracked labels.
- **Don't** use emoji or text glyphs as icons; use the 16px stroke icon family.
- **Don't** set fonts or a page background inside a lesson, and don't load other font files.
- **Don't** open the app in dark mode by default.

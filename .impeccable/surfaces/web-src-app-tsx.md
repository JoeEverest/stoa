---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: ["web/src/styles.css"]
---

# Surface brief: Stoa web app (classroom, intake, new topic)

Scope: the whole React app in web/ plus the lesson style guide that Athena uses for lesson pages.
Mode: Operate (app shell) around a Read surface (the lesson). Audience, job and constraints: PRODUCT.md.

## Direction contract

THESIS: A learning app that disappears into the lesson. It refuses the course-catalog dashboard (card grids, streaks, badges, hero metrics) and the chatbot-with-sidebar default; the lesson page is the screen, the app is a quiet frame around it.

OWN-WORLD: White surfaces and a near-black text ladder (three steps), a cool off-white second layer for the rails, hairline borders, one confident blue accent only on primary actions, current selection, focus and progress. System font stack, a fixed rem type scale, tabular numerals. 8px radius on controls, 12px on panels. Lessons use the same tokens and components, so a lesson looks like part of the app.

STORY: The learner sees at once where they are (topic, lesson N of M), what is being made for them (Athena's status, honest and specific), and what to do now (read, watch, answer, ask the tutor). Answers give immediate, clear feedback. Waiting is calm and informative.

FIRST VIEWPORT: Left rail 240px: Stoa, New topic, topics with state. Topic header: title, segmented progress bar (one segment per lesson: done, current with partial fill, being built), one-line status, primary "Next lesson". Lesson list 240px. Lesson column (the hero) at a 68ch measure. Tutor 340px on the right with its composer at the bottom.

FORM: Category standard (canon), chosen by the user over the rolled direction (Library Card Catalog, candidate 5 of 7); seed key c0cc5f5f. Craft bar: Brilliant.org, Claude.ai, Notion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

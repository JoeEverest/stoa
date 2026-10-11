# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Self-directed learners who choose their own topic and pace: adults learning hobby or work subjects
(programming, electronics, physics, languages), and also students and teens. They mostly use a
laptop. The first user is the person who self-hosts the app; they share it with others.

## Product Purpose
Stoa is a self-hosted learning app. The learner says what they want to learn; an AI teacher named
Athena interviews them about their goal, then builds one lesson at a time: readable text with
citations, narrated explainer videos, and interactive exercises. Answers go back to Athena, who
uses them (and notes from a side-chat tutor) to choose and shape the next lesson. Success: the
learner reaches the concrete outcome written in the topic's mission.

## Positioning
Lessons are written for one learner, from that learner's own mission and evidence of what they
already understand, and each lesson can include a narrated video made for it. It is not a course
catalog: every topic is a private workspace that grows lesson by lesson.

## Operating Context
- One topic = one workspace (mission, resources, learning records, lessons, reference sheets).
- Flow: intake chat with Athena -> Athena builds lesson 1 (text first, video later) -> learner
  reads, watches, does exercises, asks the tutor -> next lesson.
- Lesson pages are HTML that Athena writes at run time and the app shows in a frame. They must
  look like part of the app.
- Builds take many minutes (video renders are slow), so waiting states are a normal part of use.

## Capabilities and Constraints
- Stack: Node server (Hono, SQLite), React + Vite web app, Claude Agent SDK. Ships as a Docker
  image with a data volume.
- Agent-written lessons follow a style guide the app gives the agent; the guide must be short and
  exact enough for an agent to apply without seeing the app.
- Lesson videos are 16:9 HyperFrames renders with a voice-over.

## Brand Commitments
- App name: Stoa (chosen by the designer at the user's request). Teacher agent name: Athena
  (the user's choice). The side-chat helper is "the tutor".
- The app opens light. It follows the system dark setting only through an explicit user choice.
- Visual direction (chosen 2026-10-10): the category standard, executed at full craft, with no
  metaphor or themed world. Quality bar: Brilliant.org, Claude.ai and Notion.
- The app frame recedes; the lesson leads. Each topic may carry its own stronger accent inside
  lessons, on a shared base.

## Evidence on Hand
- A real two-lesson course the user took: ~/Downloads/projectile-motion (lessons, videos,
  reference sheets). The user liked the experience and disliked its fonts and colors (cream grid
  paper, Instrument Serif, Inter).
- No logos, testimonials, or user numbers exist. Do not invent them.

## Product Principles
1. The lesson is the product; the app frame stays out of its way.
2. Calm enough to study in for an hour: no decoration that competes with reading or exercises.
3. Respect the learner's age range: never childish, never corporate.
4. Show progress honestly: what was built, what is still being made, what the evidence says.
5. Waiting is normal; make it informative, not anxious.

## Accessibility & Inclusion
Teens and adults; long reading sessions. WCAG AA contrast, keyboard access, reduced-motion support,
readable line lengths in lessons.

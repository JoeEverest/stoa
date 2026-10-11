# Lesson Notes Format

Lesson notes live in `./lesson-notes/<lesson-id>.md`, one file per lesson (for example
`lesson-notes/0002-split-the-velocity.md`). They are the channel from the **tutor** (the side
chat the learner uses while working through a lesson) to **you**, the teacher.

You never write these files. The tutor calls its `add_lesson_note` tool and the server appends
an entry. The file does not exist until the first note is written.

## Structure

```md
# Lesson notes: 0002-split-the-velocity

## 2026-10-10T14:32:05Z · question
The learner asked why sin goes with the vertical part. They had swapped sin and cos in drill 3
and thought "cos is always the vertical one because it comes first".

## 2026-10-10T14:40:51Z · misconception
Believes a heavier ball thrown sideways lands later than a light one. Corrected in chat with the
two-ball demo from lesson 1; they seemed convinced but did not test it.

## 2026-10-10T14:52:17Z · preference
Wants shorter videos with a pause-and-predict question halfway through.

## 2026-10-10T15:03:40Z · request
Asked for a lesson on how to code the trajectory in Python next.
```

Each entry is a level-two heading with an ISO timestamp and a kind, followed by a short
paragraph in plain words.

## Kinds

| Kind | Meaning | What you do with it |
|---|---|---|
| `question` | Something the lesson did not make clear, or the learner wanted to go further. | Answer it in the next lesson (a short recap section, a better diagram, a new exercise). |
| `misconception` | A wrong belief the learner showed. | Design the next lesson or a drill to confront it directly. Write a learning record once the learner shows the corrected understanding. |
| `preference` | How the learner wants to be taught. | Copy it into `NOTES.md` under teaching preferences. Ask nothing; just apply it. |
| `request` | Something the learner wants to learn or do next. | Weigh it against the mission and the zone of proximal development. Teach it if it fits; if it changes the mission, raise that in the next lesson. |

## Rules for the teacher

- **Read before every build.** Read the notes of the previous lesson, and of any earlier lesson
  whose notes you have not yet handled.
- **Notes are evidence, not proof.** A tutor note that the learner "seemed to get it" is weaker
  than a correct answer in the lesson's assessments. Prefer `get_responses` evidence for
  learning records.
- **Track what you handled.** After a build, add one line to the working notes in `NOTES.md`,
  for example `- lesson-notes/0002 handled through 2026-10-10T15:03:40Z (questions on sin/cos in
  lesson 0003 recap)`. The next build then knows where to start.
- **Never edit or delete these files.** They are an append-only log written by the server.

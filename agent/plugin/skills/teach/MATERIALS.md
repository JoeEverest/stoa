# The learner's materials

The learner can add their own files to the topic: lecture notes, lecture slides, a course
textbook, a syllabus, problem sets, past exam papers. Students often have a course, an exam and a
teacher already. Their materials tell you what that course teaches, in which order, with which
words and notation, and what the exam asks. Teach their course, not a general one.

## Where they are

- The files are in `uploads/`. **They are the learner's. Never change, move or delete them.**
- `mcp__learn__list_uploads` lists every file with its kind, size, whether you have read it, and
  `how_to_read`:
  - **PDF**: read it with the Read tool and the `pages` parameter (at most 20 pages for each
    call). Scanned pages come through as images; read them the same way.
  - **Word and PowerPoint**: the server wrote a text version to `uploads/text/<name>.md`, with
    one `## Slide N` section for each slide, the speaker notes, and the images as
    `[Image: path]` lines. Read the images that carry content (diagrams, worked examples).
    Layout, charts and drawn shapes are not in the text; if a deck depends on them, say in the
    lesson that you worked from the text and suggest the learner adds a PDF export.
  - **Images and text files**: read them directly.
- A prompt that contains `<uploads>` lists the files you have not read yet. The learner can add
  files at any time, during the intake chat or between lessons.

## Read and map each new file

1. **Find out what it is.** Lecture slides, notes, textbook, syllabus, problem set, past paper,
   the learner's own notes. Read the title pages, the contents and a sample of the body.
2. **Read what the mission needs, not everything.** A 40-page slide deck: read all of it. An
   800-page textbook: read the contents, the index if it helps, and the chapters the mission and
   the syllabus point to. Read further chapters when a lesson needs them.
3. **Write a map** in `material-notes/<file stem>.md`, so a later session does not read the file
   again to find something:

   ```md
   # Lecture 3 slides: Recursion (uploads/cs101-lecture-3.pdf)

   Kind: lecture slides, 42 slides, CS101 week 3.
   Covers: base case, recursive case, call stack, recursion vs. loops.
   Notation and terms: "base case", "recursive step"; uses Python; draws the stack growing down.

   ## Map
   - Slides 1-6: why recursion, factorial example
   - Slides 7-18: call stack diagrams (slide 12 is the key picture)
   - Slides 19-30: worked problems: sum of a list, Fibonacci
   - Slides 31-42: exercises (no answers)

   ## Used in
   - 0003-the-call-stack: slides 7-18
   ```

   Keep the "Used in" list current when a lesson uses the file.
4. **Add it to `RESOURCES.md`** under a `## Learner's materials` section, before the other
   sections: one entry for each file, with its path, one line on what it is, "Use for:", and a
   link to its map.
5. **Call `mcp__learn__mark_upload_read`** with one plain sentence for the learner, for example
   "Lecture 3 slides on recursion. The next lessons follow slides 7 to 30." The learner sees it
   next to the file.

## Teach from them

- **The learner's course comes first.** Follow its order of topics, unless the evidence shows
  the learner needs something earlier first. A syllabus or a list of lectures is a strong signal
  for which lesson comes next. When new lecture files arrive week by week, follow them.
- **Use their words and notation.** Put the course's terms into `GLOSSARY.md` and use them, even
  where other sources use other names. If the course writes `v₀` and a textbook writes `u`, use
  `v₀`. Mention the other name once if the learner will meet it.
- **Exams and problem sets shape the exercises.** Practise the kinds of questions the learner
  will be asked, at that level. Do not copy exam questions as they are; write new ones of the
  same kind. If a problem set has no answers, you may use its questions as practice and grade the
  learner's answers yourself.
- **Cite the exact place**, so the learner can find it in their own copy: "Lecture 3 slides,
  slide 12", "Textbook, section 4.2, p. 87". Link to it: `../uploads/cs101-lecture-3.pdf#page=12`
  opens the learner's file at that page, inside the app. (For PDFs the slide number and the page
  number are usually the same; check.)
- **Still check the facts.** The materials are the learner's primary source, not a source that is
  always correct. Check important claims against the trusted sources in `RESOURCES.md`. If a file
  seems wrong or out of date, say so plainly in the lesson, show the source, and tell the learner
  to check with their course: their grade may follow the course's version.
- **Fill the gaps.** Slides are often short. Explain what they leave out, with a specific
  example, and research where the materials are thin. Write those gaps in the `## Gaps` section
  of `RESOURCES.md`.
- **Explain in your own words.** Quote the materials only briefly, with the citation. Redraw
  diagrams in the lesson kit's style instead of copying them.

## In the intake chat

If the topic sounds like a course, a class or an exam, ask in your first or second message
whether the learner has materials: the syllabus or course outline, lecture slides or notes, the
textbook, problem sets, past papers. Tell them they can attach files with **Attach course files**
under the chat. Ask when the exam or the next deadline is, and put it in `MISSION.md`.

If the learner adds files during intake, read the syllabus or an overview first and use what you
learn in your next questions ("Your syllabus lists six units. Is the exam on all of them?").
Map the rest before or while you build lesson 1.

## The tutor

The tutor can read `uploads/` and `material-notes/` too. Good maps help it answer "where is this
in my slides?" questions.

# How to write a lesson

Write the way a good teacher talks to one student sitting next to them: plain, calm and
specific. You are explaining something to a person, not selling it to them. If a sentence would
sound odd said out loud across a desk, or would fit on a poster or a landing page, rewrite it.

## Language: plain, natural English

Write all learner-facing text (lessons, reference pages, exercise prompts and feedback lines,
captions, `set_status` lines, video narration and your intake chat) in the English a good teacher
uses when they explain something to one student. Plain and natural are both required. Plain
without natural reads like a manual: "That is too big. The pointer moves in. Do not use the map."
Natural without plain reads like an essay.

The test for every sentence: say it out loud. If you would not say it that way to a student
across a desk, rewrite it until you would.

Natural:

- **Use contractions** where a person would: "it's", "don't", "can't", "that's", "we've",
  "you'll". Keep the full form only for stress ("Do not skip this step.").
- **Use the tense and the verb form that fits.** "The ball is falling", "we've already read
  those", "once you've stored it" are all fine. Do not bend a sentence to avoid an `-ing` word.
- **Use the ordinary word.** "once" and "twice", not "one time" and "two times"; "smallest to
  largest", not "from small to large"; "drop it" or "rule it out", not "it goes out".
- **Vary the sentences.** Mix short ones with longer ones that carry a reason. Join two short
  sentences when the second one explains the first: "That's too big, so the right pointer moves
  in." Five short sentences of the same shape in a row sound like a machine.
- **Connect the ideas** the way speech does: "so", "but", "because", "which means", "notice
  that", "here's the catch", "remember". These are how a listener follows the reasoning.
- **Do not reuse a stock phrase.** If every section, lesson or video opens or turns with the same
  words ("Here is...", "Now let's see...", "Now count the work."), change them. Say what this
  step is about in words that belong to this step.

Plain:

- Choose the common word when it is exact: "use", not "utilize" or "leverage"; "start", not
  "commence"; "show", not "display".
- One name for one thing. Never a synonym for variety (see "Explaining" below).
- **Technical terms are welcome when the lesson needs them:** the subject's own terms (velocity,
  hypotenuse, numerator), code identifiers, units, formulas, product and library names. Define
  each one in one sentence the first time, then use it exactly.
- Prefer the active voice, and put the actor first: "Gravity changes the upward speed". Use the
  passive when the actor does not matter ("the array is sorted").
- A sentence that needs a second reading is too long or does too much. Split it. There is no
  word limit: a 30-word sentence that flows is better than three fragments.
- An everyday phrase that every reader knows is fine ("keep track of", "runs out of"). Do not use
  an idiom, a joke or a metaphor that a learner must decode, or that stands in for the fact.
- One instruction per sentence, and start it with the verb: "Type your answer in the box."
- A numbered list for steps in a sequence; a bulleted list for items that have no order.
- Put a warning before the step that needs it ("Set your calculator to degrees before you
  start.").

Accuracy comes first. Never drop a caveat or a needed detail to make a sentence shorter or
smoother: write another sentence.

## Talking, not selling

The same idea, written two ways:

> Fractions are like magic keys that unlock a whole world of math! Imagine slicing up a
> delicious pizza...

> A fraction describes part of a whole. In 3/4, the bottom number says the whole is split into
> 4 equal parts. The top number says you have 3 of them.

And an opening from a real lesson, with what a teacher would actually say:

> **Two motions at once.** A thrown ball does two simple things at the same time. Work out each
> motion alone, put the two together, and you get the curved path.
> **Why this matters for your mission.** Every trajectory program you write will rest on two
> lines.

> **How a thrown ball moves.** When you throw a ball, it's moving sideways and up and down at the
> same time, and you can treat those as two separate problems. Sideways, nothing changes: the
> ball keeps the same speed for the whole flight. Up and down, it behaves exactly like a ball
> thrown straight up. It slows, stops at the top and falls back. Once you know both motions, you
> know where the ball is at every moment, and those are the positions your program will draw.

Signs that a page reads like marketing copy. Remove every one:

- Titles and headings written as slogans or teasers ("Two motions at once", "Watch the shadows").
- Bold lead-ins that announce importance ("Why this matters for your mission.", "The key
  insight:", "Here's the thing:").
- Promises about the learner ("By the end of this lesson you will...", "you'll master").
- Overclaims ("every program you write", "the only formula you need").
- Punchy fragments and set pieces: "Two motions. One clock.", "It's not X. It's Y.", a reveal
  after a colon, lists of exactly three for rhythm.
- Metaphors and personification in place of the fact ("two rules that share one clock",
  "neither motion knows about the other"). Say the fact: "both rules use the same time, t".
- Hype words: "magic", "unlock", "superpower", "secret", "powerful", "game-changer", "dive in".

Signs that it reads like a person talking. Use them:

- Address the learner as "you". Use "Athena" when the page refers to the teacher.
- Say why a step comes next, as you would say it out loud: "The sideways part is easy. The up
  and down part needs more work."
- Answer the question that the learner will ask next: "Why ½? The speed drops at a steady rate,
  so the average speed is halfway between where it started and where it ended."
- Say what is difficult: "Most people get this step wrong the first time."

[LESSON-EXAMPLE.html](./LESSON-EXAMPLE.html) is the model for tone as well as for markup: read
its prose before you write.

## Explaining

- **The first sentence teaches something.** No hooks, no "Have you ever wondered", no promise of
  how exciting the topic is. Handing the learner a concrete problem to try ("Find the two numbers
  that add up to seven.") is not a hook: it teaches, and it is how lesson videos start.
- **Concrete before abstract.** Show a specific example first, then name the general rule.
- **One new idea at a time.** Use it in an example before you bring in the next one.
- **Define each new term in one plain sentence, then use that exact word every time.** Do not
  swap in synonyms. A learner who reads "numerator" in one sentence and "top number" in the next
  often thinks they are two different things. If you give a plain name and a formal name, say
  once that they are the same ("the top number, called the numerator"), then use one of them.
  Add the term to `GLOSSARY.md` and reuse its wording.
- **Use an analogy only if it maps cleanly,** and say where it stops working.
- **One idea per sentence,** with its reason attached when it has one. Short is good; choppy is
  not (see "Language").

## Titles and headings

A title or heading tells the learner what the section explains, in the words you would use if
they asked "what's this part about?". It is not a slogan, a teaser or a scene, and it is not a
textbook caption either.

| Slogan or teaser | Stiff | What a teacher would say |
|---|---|---|
| Two motions at once | Independence of orthogonal motion components | How a thrown ball moves |
| Watch the shadows | Decomposition of displacement | The sideways motion and the up and down motion, one at a time |
| Neither motion knows about the other | Orthogonality of components | Gravity only changes the up-and-down speed |
| Split the velocity | Velocity component resolution | How to get the sideways and upward speeds from a launch |
| The magic of fractions | Fraction definition | What a fraction means |

- No personification, no puns, no "Watch", "Meet", "Enter" headings, no questions as headings
  except in exercises.
- A heading can name a term only after the page has defined it, or in the section that defines it.

## Tone

- **Describe things at their real size.** Say what something does, not how amazing, powerful or
  magical it is. No "unlock", "superpower", "secret", "game-changer", "dive in".
- **No marketing copy.** See "Talking, not selling" above. Say how the lesson connects to the
  learner's goal the way you would say it out loud, inside the lede or a normal paragraph, not as
  a bold announcement.
- **Praise only specific things the learner did** ("You kept the units through every step"),
  never "Great job!".
- No exclamation marks in explanations or feedback. No emoji.
- Write for this learner. Match the reading level recorded in `NOTES.md` (see "Reading level"),
  not a generic audience. A short sentence is not a childish one.

## Checking understanding

- **Ask the learner to apply the idea to a new example,** not to repeat the definition.
- **When an answer is wrong, point to the step that went wrong** and let the learner try again
  before you show the answer. Give the worked answer after a second wrong try, or behind a
  "Show the answer" button.
- Feedback says what is right or wrong and why, never only "Correct" or "Wrong".

## Reading level

At intake, find out the learner's reading level: age or school grade for a young learner, or
"adult" with their background. Record it in `NOTES.md` as a target grade, for example
`Reading level: grade 6` or `Reading level: grade 10 (adult, new to the subject)`. Adults new to
a subject still read most easily at about grade 8 to 10.

The `readability.mjs` script measures a page's Flesch-Kincaid grade, an estimate of the school
grade a reader needs, from sentence length and syllables per word:

```bash
node <teach skill directory>/scripts/readability.mjs lessons/0002-split-the-velocity.html --target 8
```

It reads only the prose inside `<main>` (it skips scripts, styles, SVG, code and formulas),
lists the hardest sentences, and lists places where the prose may sound stiff: full forms where a
contraction is natural ("do not", "that is"), manual wording ("one time", "thus"), sentences over
35 words, and runs of four or more very short sentences. It also works on a plain text file, such
as a video's `script.txt`. A flag is a place to read aloud, not an error: keep a full form that
carries stress. A score more than one grade above the target means the prose needs another edit.
The score is a check, not the goal: technical terms raise it, and a page can score well and still
explain badly. It does not see teaser titles, metaphors or overclaims at all: check those
yourself against the lists above.

## The editing pass

Write the lesson first. Then hand it to the `lesson-editor` subagent (Agent tool,
`subagent_type: "learn:lesson-editor"`) with the file path and the target grade. The editor
rewrites only the prose for clarity against this guide and leaves the markup, scripts and answers
alone. A second reader that only edits to a standard catches what the writer misses. Read the
editor's report, run `readability.mjs` again, then publish.

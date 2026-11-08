# How to write a lesson

Write the way a good teacher talks to one student sitting next to them: plain, calm and
specific. You are explaining something to a person, not selling it to them. If a sentence would
sound odd said out loud across a desk, or would fit on a poster or a landing page, rewrite it.

## Language: ASD-STE100 Simplified Technical English

Write all learner-facing text in Simplified Technical English (STE, the ASD-STE100 standard):
lessons, reference pages, exercise prompts and feedback lines, captions, `set_status` lines, video
narration and your intake chat. STE keeps one meaning per word and short, direct sentences, so a
learner never has to guess what a sentence means. Write it as a teacher who talks to one student,
not as a manual.

Words:

- Use common words that have one clear meaning, and use each word with one meaning and one part
  of speech only. For example, use "show" (verb) and not "display"; use "start" and not
  "commence"; use "use" and not "utilize" or "leverage".
- Use one word for one thing. Never a synonym for variety (see "Explaining" below).
- **Technical terms are allowed when the lesson needs them:** the subject's own terms (velocity,
  hypotenuse, numerator), code identifiers, units, formulas, product and library names, and
  technical verbs of the field (compile, render, solder). Define each one in one sentence the
  first time, then use it exactly. These terms may break the other STE rules.
- No idioms, metaphors, slang, humour or figures of speech.

Sentences:

- Active voice: "Gravity changes the upward speed", not "The upward speed is changed by gravity".
- Not more than 20 words in an instruction ("Type your answer in the box."). Not more than 25 words
  in a description.
- One instruction in one sentence. Start an instruction with the verb.
- Simple present, simple past or simple future tense only.
- No `-ing` form as a verb or an adjective ("the ball is falling" becomes "the ball falls"; "the
  falling ball" becomes "the ball that falls"). An `-ing` word is allowed only inside a technical
  name (`string`, "ray tracing") or as a noun that the subject requires.
- No contractions: "do not", "it is", "you will".
- Keep the articles "a", "an" and "the". Do not put more than three nouns together.

Paragraphs:

- One topic in one paragraph. The most important information first.
- A numbered list for steps in a sequence; a bulleted list for items that have no order.
- Put a warning before the step that needs it, and write it as a command ("Set your calculator
  to degrees before you start.").

Accuracy is above compliance. Do not remove a caveat or a necessary detail to obey a word limit:
write another sentence instead.

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

> **How a thrown ball moves.** When you throw a ball, it moves sideways and up and down at the
> same time. You can solve these as two separate problems. Sideways, the ball keeps the same
> speed for all of its flight. Up and down, it moves like a ball that you throw straight up: it
> slows, stops at the top, and falls back. When you know both motions, you know the position of
> the ball at each moment. Your program will draw these positions.

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
- Answer the question that the learner will ask next: "Why ½? The speed decreases at a constant
  rate. Thus the average speed is halfway between the first speed and the last speed."
- Say what is difficult: "Many learners make an error at this step the first time."

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
- **Short sentences, one idea each.**

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
lists the hardest sentences, and lists possible STE problems: sentences over 25 words, `-ing`
words, passive voice and contractions. Some flags are technical terms that may stay; fix the rest. A score more than one grade above the target means the prose needs
another edit. The score is a check, not the goal: technical terms raise it, and a page can score
well and still explain badly. It does not see teaser titles, metaphors or overclaims at all: check
those yourself against the lists above.

## The editing pass

Write the lesson first. Then hand it to the `lesson-editor` subagent (Agent tool,
`subagent_type: "learn:lesson-editor"`) with the file path and the target grade. The editor
rewrites only the prose for clarity against this guide and leaves the markup, scripts and answers
alone. A second reader that only edits to a standard catches what the writer misses. Read the
editor's report, run `readability.mjs` again, then publish.

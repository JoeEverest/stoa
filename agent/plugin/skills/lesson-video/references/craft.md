# Craft: making a reel look designed, not generated

Distilled from the impeccable, animate, frontend-design and refactoring-ui skills, translated from
web pages to short vertical/landscape video. Read this before you build any screen.

**The brief wins.** A pasted STYLE block, the user's brand, or an explicit request ("purple-to-blue
gradient", "frosted glass", "eyebrow label", "film grain", "hard offset shadows") is a pinned
decision. Execute it with precision; the defaults below only govern the axes the brief leaves free.
Redirecting a clear brief toward your own taste is a failure, not craft.

## The test

Freeze any frame and ask: if someone were told "an AI made this", would they believe it instantly?
Then it is generic. The usual fingerprints in motion graphics:

- every element arrives with the same fade-and-rise, at the same speed, staggered evenly;
- a centred rounded card with a soft grey drop shadow on a purple-blue or cyan gradient — when the
  brief did not ask for it;
- the "hero metric" template: big number, tiny grey label, a few supporting stats, an accent;
- glass/blur, glow, gradient text or sparklines used as decoration rather than meaning;
- emoji or unicode glyphs standing in for icons (draw them as SVG in one stroke weight);
- grey text on a coloured surface; pure `#000` / `#fff` when the brief didn't pin them.

## One idea, one focal point per screen

A viewer gets ~1–3 seconds per screen on a phone, with the sound often off.

- Decide the single thing the eye must land on (the number, the key word, the button) and make it
  dominant by size **and** weight **and** colour together; de-emphasise everything else rather than
  boosting the hero further.
- Labels are a last resort. If the format says what it is ("$14,284 kept"), drop the label or fold
  it into the value.
- Two or three text colours and two weights per screen are enough.
- Read order follows motion order: the focal element arrives first or arrives last, never in the
  middle of a crowd.

## Type for screens that move

- Display sizes: line-height 0.9–1.05, tracking −0.02 to −0.03 em (never past −0.04 em); all caps
  get +0.02 to +0.08 em instead.
- Body/support text on 1080-wide video: not below ~34 px; labels not below ~26 px. A phone shows
  1080 px at ~390 pt, so divide by ~2.8 to feel the real size.
- Numbers that change: `font-variant-numeric: tabular-nums` and a fixed-width box, so the layout
  does not jump as digits roll.
- Balanced line breaks (`text-wrap: balance`) for headlines; break lines on meaning, not width.
- Self-host every face (`@font-face` to a local file). A system fallback in a render is a defect.

## Colour and surface

- **Stoa's palette is fixed.** Only charcoal `#264653`, teal `#2a9d8f`, saffron `#e9c46a`, sandy
  `#f4a261` and sienna `#e76f51`, plus black and white (and grays between them). No other hues,
  and do not tint neutrals toward a hue. Light text goes on charcoal; dark text on the other four.
- One accent, used for the one thing that matters on each screen. Two accents means neither wins.
- On coloured backgrounds, secondary text is a darker/lighter shade of that background hue, not grey.
- Contrast: support text ≥ 4.5:1, large text ≥ 3:1 — `npx hyperframes check` measures it. White
  on a mid green (e.g. `#22c55e`) fails; use dark text or a deeper green.
- Depth: pick one system. Either a two-part shadow (soft cast + tight contact, offset downward from
  an overhead light) **or** a 1 px border — not a 1 px border under a wide soft shadow. Hard
  zero-blur offset shadows belong only to a neobrutalist world such as Pop Bold.
- Card radii 12–40 px scaled to card size; pills are for small chips only. Don't nest cards.

## Composition

- Start with too much space around the focal element and remove it. Tight groups, generous gaps
  between groups.
- Centred layouts are fine for single-sentence screens; for anything with a UI or two pieces of
  information, an asymmetric split (copy left / object right, or a top-weighted stack on vertical)
  reads as designed.
- Vary scale between screens: a full-bleed word, then a small precise card, then a big number.
  Identical card after identical card is a slideshow, not motion design.
- Safe zones: text in the middle 80 % of width; on vertical social video keep the top ~12 % and the
  bottom third clear of key content (UI chrome and captions live there).

## Motion with a thesis

Before writing the timeline, write two lines in your head: what is the **focal moment** of the
whole piece, and what is the motion **character** (snappy / calm / imperfect / bouncy — the style
block decides). Then:

- Motion explains something: arrival of the idea, a change of state (0 → 100, unchecked → checked,
  before → after), a relationship (this card came from that number). Decoration without purpose is
  noise.
- One authored sequence per screen, not five simultaneous effects. Carry one material idea through
  the piece (a mask wipe, a blur-to-sharp focus pull, a scale punch) rather than mixing everything.
- Reach beyond transform + opacity when it carries meaning: `clip-path`/mask wipes for reveals,
  bounded `filter: blur()` for focus pulls, `box-shadow` growth for lift. Keep blur regions small.
- Easing: exponential ease-out for arrivals (`power3.out`/`power4.out`/`expo.out`, or
  `cubic-bezier(0.16,1,0.3,1)`); `power2.in` for exits. Exits take ~60–75 % of the entry time.
  Bounce/elastic only when the style asks for it (Pop Bold) — never by reflex.
- Durations for video: 0.25–0.4 s snappy hits, 0.5–0.8 s for a calm or focal entrance, ≥1.2 s of
  stillness for reading. Motion that never settles cannot be read.
- Stagger only things that are a list, at 0.06–0.15 s per item, total stagger under ~0.6 s.
- Give everything a resting state: after the entrance, hold. A tiny continuous drift (background
  blobs, sticker spin) is fine; jitter on text is not.
- Cut on the content's rhythm: screen changes on sentence ends, graphic entries on the spoken
  word, never on arbitrary round seconds.

## Lessons from the test renders

- A frosted card at 80 % white over a plain gradient reads as solid white. The blur only shows with
  colour shapes behind it and the card around 55–65 % white.
- White text on a mid colour fails contrast; every tester hit it. With the Stoa palette, white
  text belongs only on charcoal (#264653); on teal, saffron, sandy or sienna use black text.
- Testers liked restraint but called the cards "plain": give each screen one confident move — a
  colour block, an oversized number, a drawn line — rather than another neutral card.
- A material idea taken from the brand itself (for Dproz: the hand-drawn wordmark became a pen
  line that underlines, circles and finally draws the logo) ties a whole film together.

## Bounded verification

Build the whole thing, then inspect once: `check` + one contact sheet (and a full-size frame of
the busiest moment). Fix everything that round shows in one batch, re-render, look once more, and
stop. Polishing in an open loop costs the user time and rarely improves the result.

What to look for on the sheet: clipped or overflowing text, fallback fonts, text over the face or
captions area, two things competing for focus, a screen that is empty or mid-transition at its
midpoint, colours off-brief, and anything that would make the "AI made this" test pass.

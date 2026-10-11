# The four looks

Each look is a STYLE block. A user may paste one under any request, or just name it ("make it Pop
Bold"). Treat the block as the design spec: fonts, colours and motion character are fixed; layout
is yours. Font files come from `scripts/fetch-fonts.sh` (same names as below).

Pick a look when the user doesn't: Kinetic Type for hooks and short punchy scripts; Liquid Glass
for calm, product, explainer, overlays on footage; Editorial Grain for stories and opinions;
Pop Bold when the video has to stop the scroll. Never mix looks inside one video.

---

## Kinetic Type

```
STYLE: Kinetic Type
- The text is the whole video. No cards, no boxes.
- Font: Archivo Black (fonts/ArchivoBlack-400.woff2), all caps, huge. The main word fills most of the width.
- Colours: black background, white text, one accent colour #c6ff3d for the most important word on each screen.
- Motion: words slam in one by one, fast and snappy (power4.out, 0.25 to 0.4 seconds). Mix the moves: slide in from the side, stretch from squashed to full height, split the letters apart and back together. Each screen exits fast before the next one hits.
- Cut the screens on the rhythm of the words, like a beat.
```

Build notes:
- Stack 2–3 lines per screen; the key word is biggest and gets the accent. Size the key word so
  it spans ~80 % of the width (measure: Archivo Black caps ≈ 0.72 × font-size per letter).
- Be bolder than feels safe: fit **each line** to the 80 % safe width on its own, so the key word
  line is much bigger than the connective lines (testers rated evenly sized lines as "cautious").
- If you add any hold motion (a slow zoom on the screen), fit the text at the *largest* scale it
  will reach, or the zoom pushes lines past the safe width.
- "Stretch": `fromTo(word, {scaleY: 0.1, transformOrigin: "50% 100%"}, {scaleY: 1})`.
  "Split letters": wrap each letter in an inline-block span and tween `x` from ±spread to 0 with a
  small stagger.
- Hard exits (0.15–0.2 s, `power2.in`, y −40 + opacity 0) right before the next screen; no
  crossfades. Screen length tracks word count — short words, short screens — but never under ~1 s.

## Liquid Glass

```
STYLE: Liquid Glass
- Frosted glass cards: white at about 80% opacity, 30px background blur, thin white border, big rounded corners (32px), soft shadow.
- Background: soft light gradient with two or three blurred colour blobs (pale blue, lilac, peach) drifting slowly.
- Font: Inter (fonts/Inter-700.woff2 for headings, fonts/Inter-400.woff2 for small text). Dark grey text #1d1d1f, small uppercase grey labels above headings.
- Accent: green #34c759, only for ticks and checks.
- Motion: calm and smooth. Cards rise 30px and fade in with power3.out over 0.6 seconds, scaling up slightly from 0.96. Text arrives piece by piece. Nothing bounces.
```

Build notes:
- Blobs: big `border-radius: 50%` divs with `filter: blur(80–120px)`, drifting with a slow finite
  `yoyo` tween; mark them `data-layout-allow-overflow`.
- A small "01 / 06" counter + green dot above each card reads well and costs nothing.
- `backdrop-filter` needs something behind the card. Over transparent output it renders as a flat
  pale box — use a solid white card for overlays.

## Editorial Grain

```
STYLE: Editorial Grain
- It should look like a printed magazine page, not a screen.
- Background: warm paper colour #efe8dc with visible film grain over everything (an animated SVG noise layer at about 12% opacity).
- Font: Instrument Serif (fonts/InstrumentSerif-400.woff2 and fonts/InstrumentSerif-400-italic.woff2) for headlines, large, mixing upright and italic words. Small labels in Inter (fonts/Inter-400.woff2), uppercase, letter-spaced.
- Colours: ink black #1a1a1a and one deep red accent #c2412d.
- Shapes: cut-out paper rectangles behind key words, slightly rotated (1 to 3 degrees), thin rules, and small page numbers in the corners.
- Motion: unhurried and a bit imperfect. Staggered timings that are not perfectly even, gentle slides and wipes, no bounces.
```

Build notes:
- Grain must be deterministic: an SVG `feTurbulence` filter whose `seed` attribute you step from
  the timeline (e.g. a `onUpdate` that sets `seed = Math.floor(time*12)`), not `Math.random`.
- "Imperfect" stagger: hand-write offsets like `[0, 0.13, 0.31, 0.42]`, don't randomise.
- Grain inflates file size (one 15 s test: 124 MB → 69 MB with `--crf 23`). Render with
  `--crf 23` by default for this look and say so.

## Pop Bold

```
STYLE: Pop Bold
- Loud, playful, flat colour. No gradients, no glass.
- Font: Bricolage Grotesque ExtraBold (fonts/BricolageGrotesque-800.woff2), big and chunky.
- Colours: flat blocks of #c6ff3d (lime), #8a3cff (purple), #ff4fd8 (pink) and #111111, with 4px black outlines and hard 8px offset shadows with no blur.
- Extras: rotating star and circle stickers, little arrows, a few simple shapes drawn in CSS.
- Motion: bouncy and springy. Things pop in with back.out(2.5), overshoot, wobble a little, squash and stretch. Stickers spin slowly the whole time.
```

Build notes:
- Rotate the background colour per screen (purple → lime → pink …) and pick a contrasting card.
- Highlight the key word with an inline pill in a third colour, outlined.
- Stars: `clip-path: polygon(...)`; outline via a slightly larger black copy behind it, because
  `border` does not follow a clip-path.
- "Spin the whole time": one tween per sticker covering the whole duration
  (`rotation: 360*k, ease: "none"`), not `repeat: -1`.

---

## The user's own brand

If they give colours/fonts, map them onto the closest look's structure: background, card,
text, one accent. Keep one accent colour; more than one makes nothing stand out. Check text
contrast — `npx hyperframes check` reports WCAG AA failures.

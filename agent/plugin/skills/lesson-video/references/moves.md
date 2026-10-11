# Ten named moves

Users name these; build exactly the named one. Durations are defaults — the active style's motion
character (snappy / calm / imperfect / bouncy) overrides the ease. `tl` is the main paused
timeline; `t` is the position in seconds.

| Move | What the viewer sees | GSAP sketch |
|---|---|---|
| **Rise** | fades in while moving up a little | `tl.fromTo(el,{y:30,opacity:0},{y:0,opacity:1,duration:.6,ease:"power3.out"},t)` |
| **Pop** | scales up from small with a small overshoot | `tl.fromTo(el,{scale:.6,opacity:0},{scale:1,opacity:1,duration:.45,ease:"back.out(2)"},t)` |
| **Count-up** | a number rolls to its value | `const o={v:0}; tl.to(o,{v:500,duration:1.6,ease:"power2.out",onUpdate:()=>num.textContent=Math.round(o.v).toLocaleString("en-US")},t)` + `tabular-nums` |
| **Checklist tick** | lines get a green tick one by one | per row: circle `scale 0→1` (`back.out(2)`), then SVG check `stroke-dashoffset len→0` over .3 s, row text opacity .5→1; rows ~0.6 s apart (or on the spoken word) |
| **Typewriter** | text types itself | split into characters, `tl.set(char,{opacity:1},t+i*0.04)` per char, plus a caret that blinks with a finite repeat |
| **Slide-in** | comes in from the side | `tl.fromTo(el,{x:-120,opacity:0},{x:0,opacity:1,duration:.5,ease:"power3.out"},t)` |
| **Blur-in** | blurry to sharp | `tl.fromTo(el,{filter:"blur(24px)",opacity:0,scale:1.04},{filter:"blur(0px)",opacity:1,scale:1,duration:.7,ease:"power2.out"},t)` |
| **Punch-in** | the whole frame zooms in fast — for the line people should remember | wrap the whole scene in a non-timed `#cam` div; `tl.to("#cam",{scale:1.18,duration:.18,ease:"power4.out"},t)` then ease back or hold |
| **Reframe** | the user's video shrinks into a card and something new appears beside/above it | animate a non-timed wrapper around the `<video>` (never the video itself): `scale .9→.55`, `borderRadius 0→36px`, `y` up; reveal the new card in the freed space |
| **Bar fill** | a progress bar fills up | track + fill; `tl.fromTo(fill,{scaleX:0},{scaleX:pct,transformOrigin:"0 50%",duration:1.2,ease:"power2.inOut"},t)`; pair with a count-up of the % label |

Notes:

- Set initial states in `fromTo`, never with CSS `transform` on the same element.
- For Punch-in and Reframe on footage, the HyperFrames camera tooling (`/hyperframes-keyframes`)
  is the deeper reference if you need multi-step zooms.
- A "demo of every move" reel: 10 screens × ~1.4 s, each with a tiny label ("03 · Count-up") and the
  same sample card ("Weekly report") so the moves are what differs.

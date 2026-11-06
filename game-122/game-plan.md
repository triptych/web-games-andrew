# Rainglass

**Genre:** Cozy lo-fi relaxation / collection
**Engine:** Vanilla JS: Canvas 2D, no asset files
**Status:** v1.0.0

---

## Concept

A cozy lo-fi game on a rainy night train. At every station the window is misted over: you guide a single drop of rain across the glass to wipe it clear, uncover what is out there (a heron in a pond, a cat in a lit window, a campfire in the pines), and keep the view as a postcard. Eight stations make the journey to Dawn Terminus; after that the train runs back round through the small hours, past every station again, each with something rarer to find.

It is built for **flow, focus, peace and completion**:

- **Flow**: one continuous, tactile verb (steering a drop that wipes as it goes) and a soundtrack that grows around you while you keep wiping fresh glass. Every bit of glass you clear plays a note on the beat, in key.
- **Focus**: one window, one drop, no timer, no enemies, no fail state. Just a light rhythm of water in and water out.
- **Peace**: rain on the glass, a steaming mug on the sill, vinyl crackle, a soft electric piano.
- **Completion and collection**: a progress bar that always fills, a pane that melts clear at the end, a postcard stamped and added to a stack on the sill, an album of 8 postcards and 32 curios, gold seals for spotting everything yourself.

It borrows the "wipe to reveal" pleasure of scratch cards and fogged windows, the gentle resource rhythm of a watering can, and the album completionism of cozy collectors, but it is none of them: there is no game quite like it.

## Core loop

1. A pane: the station's view, misted. A fresh drop beads at the top.
2. Steer the drop. It wipes a soft-edged path and spends water on fresh mist (clear glass is free).
3. Roll over rain beads to drink them up. Tap the glass to roll the near ones in.
4. Water is the only thing to watch: too little and the drop dries and is replaced at the top; too much and it gets heavy and slides, eventually running off the sill (and wiping a clean streak as it goes). Neither is a failure; both are a breath between strokes.
5. Uncover the three curios. Each is written on the glass in handwriting as it is seen.
6. At 90% clear, the rest of the mist melts, every curio is revealed, and the pane becomes a postcard. A gold seal if you uncovered all three yourself before the melt.
7. Next station.

A pane takes one to five minutes (the bots: ~110 s for a perfect player, ~135 s for a wandering one), so the journey is about half an hour.

## Mechanics

### The pane and the mist
- The pane is 12 × 9 world units (4:3), y down. The mist is a 96 × 72 byte grid (`G.fog`, 255 = misted, 0 = clear). Each pane starts misted, with two or three old rain runs already streaked down it (seeded).
- `wipe(G, x, y, R)` clears a disc: fully inside `0.62 R`, a linear soft edge out to `R`. It returns the area cleared (square units, partial cells counted by how much mist left them) and keeps `G.fogSum` exact. `G.fogVer` increments on every change so the view re-uploads the mask only when needed.
- `clearedFrac(G) = 1 - fogSum / (255 · cells)`. At `PANE.complete` (0.9) the pane completes.

### The drop
- Water `m`, starting at `DROP.m0` (1.0). Wipe radius `R = 0.26 + 0.22 √m`.
- Steering speed `2.5 / (1 + 0.18 · (m − 1))`. Velocity eases toward the target (`9 /s`).
- Slide: `1.5 · max(0, m − 1.7)` units/s downward. A light drop clings anywhere; a heavy one creeps or runs.
- Spending: `m −= area wiped × 0.15`. Below `DROP.mMin` (0.42) it is spent (`dry`). Past the bottom edge it runs off (`runoff`). Either way a fresh drop beads at the top after 0.9 s, at the same x.

### Rain beads
- New beads land at 1.15 a second, up to 26, each 0.18 to 0.48 water, anywhere on the pane (seeded).
- A drop that touches a bead (`dist < 0.85 R + beadRadius`) absorbs it (`merge`).
- **Tap the glass** (Space / tap button / pad A): beads within 2.4 units roll to the drop at 3.2 units/s. Cooldown 2.5 s.

### Curios
- Each station lists three curios (and a rare fourth for the small hours) with a position and a radius ([scenes.js](js/sim/scenes.js)). The painter draws each at exactly that place.
- Every 0.2 s, a curio is **spotted** when at least 62% of its disc is clearer than 92/255. A peephole is not enough; you have to uncover the thing.
- Spotted by hand → `selfFound`. Revealed by the melt → `found` only. The seal needs every curio of the pane in `selfFound`.

### Flow and chimes
- In flow while wiping at least 0.55 square units of fresh mist a second. Flow rises 0.22/s in flow and falls 0.1/s otherwise, from 0 to 3. A level is reached as soon as the value gets there, and dropped only 0.35 below it (no flicker).
- Music layers follow the level: chords only at 0, drums at 1, bass at 2, a pad at 3. The lamp glows a little warmer too.
- A `chime` event for every 0.7 square units wiped; audio plays them one per free eighth note from the key's pentatonic.

### The journey
- Stations 1 to 8 in order. Finishing the 8th shows the Morning ending; staying aboard starts the small hours: the stations again in a shuffled order (no immediate repeat across rounds), each with its rare curio. It is endless.
- The album records, per station: visits, curios found (union), seal, the best time, and whether a late pass was made. `albumComplete` fires once when all 32 curios are in it.

## Content

| # | Station | Time | Curios | Small hours |
|---|---|---|---|---|
| 1 | Willow Halt | Dusk | a heron fishing, a fox in the long grass, a kite caught in the willow | a shooting star |
| 2 | Lantern Quay | Evening | a boat with a lantern, a cat on the windowsill, someone with a red umbrella | a sky lantern drifting up |
| 3 | Pinecrest | Night | an owl on a branch, a deer at the clearing, a campfire | the northern lights |
| 4 | Old Mill | Blue hour | the waterwheel, ducks asleep on the water, an angler on the bank | fireflies over the reeds |
| 5 | Harbor Lights | Night | the lighthouse, a sailboat coming home, a gull on a post | a whale's tail |
| 6 | Snowfield | Night | a snowman, a sled left out, a white hare | a reindeer on the ridge |
| 7 | Rooftops | Late night | someone reading by lamplight, a cat on the rooftop, an all-night café | a runaway balloon |
| 8 | Dawn Terminus | Dawn | the sun coming up, a hot-air balloon, birds heading out to sea | a moonbow |

## Controls

| Action | Keyboard | Mouse | Gamepad | Touch |
|---|---|---|---|---|
| Steer | Arrows / WASD | Hold the button: the drop follows the cursor | Stick / d-pad | Drag anywhere (relative, like a trackpad) |
| Tap the glass | Space / Z / T | | A / X | *tap* button |
| Album | M | ✉ | | ✉ |
| Pause | P / Esc | ❚❚ | Start | ❚❚ |

Touch steering is relative so the finger never covers the drop, and works from the empty space under the window on a portrait phone.

## Look and sound

- **Scenes** ([painter.js](js/view/painter.js)): painted once per pane at 480 × 360 (40 px a unit) from gradients, ridges, silhouettes, lit windows with glows and broken water reflections, then scaled up soft. The blacks are lifted and warmed a little for the lo-fi wash.
- **Mist**: the scene shrunk to 40 × 30 and back up (a blur that works everywhere, unlike `ctx.filter`), frosted with a pale tint and 2,600 baked condensation dots, then masked by the mist grid (96 × 72, upscaled with smoothing, so the wiped edge is soft).
- **Drops**: each bead and the drop is a little upside-down lens of the scene behind it (as real drops are), with a dark rim, a catchlight and a caustic. The drop stretches along its velocity and has a soft halo so it reads on any background. A wiping drop leaves a scatter of tiny beads behind it on the clear glass (baked into a trail layer).
- **The room**: a dark carriage wall with panelling, a reading lamp that warms with flow, a wooden frame and sill, a steaming mug, a plant, and the postcards so far in a stack. Rain (or snow at Snowfield) falls past outside. Film grain (optional) and a vignette.
- **Sound** ([audio.js](js/audio.js)): 74 BPM swung lo-fi from a look-ahead sequencer; a soft electric piano (sine + octave triangle + a touch of 3rd harmonic) on four progressions, one per station group, a step down for the small hours; a brushed kit; a round sine bass; a detuned saw pad; tape wobble on every oscillator's detune; a 3.4 kHz low-pass over the music; vinyl crackle; rain as looped filtered noise with the odd drip; bells with a dotted-eighth echo for chimes and spots.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title demo, play, postcard, ending), the fixed-step loop, pointer steering, input routing, debug hooks |
| `js/sim/game.js` | Pure simulation: the mist, the drop, beads, taps, spotting, flow, chimes, completion and melt, the album, the journey, saves |
| `js/sim/scenes.js` | Stations and curios (pure data) |
| `js/sim/bot.js` | Auto-player for tests, pacing and the title demo |
| `js/view/view.js` | Composites the room, the scene, the mist, the drops, labels, the sill and grain |
| `js/view/painter.js` | Paints the 16 scenes and 32 curios |
| `js/ui.js` | DOM screens, HUD, portrait journal, postcards, the album |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the data, every rule, the whole journey into the small hours and the full album, determinism and save round trips (mid-pane, mid-melt, on a postcard), and bots playing nine panes on several seeds. `browsertest.mjs` drives the real game on desktop through the whole journey, on touch-only phones in both orientations, and with storage blocked. `gallery.html` / `shot.mjs` show every scene with its curio circles.

## Balance notes

- The first skilled bot sat on a curio forever: its wipe disc never cleared 62% of a curio larger than itself. It now steers to the most misted cell inside the curio. A person does this naturally.
- The bot then dithered between two targets with a heavy drop that could not climb back up. It now commits to a patch of mist for 1.5 s, and lets a heavy drop run off when what is left is above it, which is the decision the slide is there to create.
- With those, a pane takes ~110 s (skilled) and ~135 s (wandering); a person, slower and less efficient, should take two to four minutes. Water rarely runs out with beads at 1.15/s; drying out happens mainly when a player ignores beads entirely.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and the game has only run in headless Chromium.
- More stations for the small-hours loop (it reuses the eight).
- A "free window" sandbox to sit at a finished postcard with the music.

## Changelog

### v1.0.0 (2026-11-06)
- First release: eight stations and their small-hours versions, 32 curios, the drop and its water, beads and taps, flow-driven lo-fi music with chimes on the beat, postcards with seals, the album, the Morning ending and the endless loop, keyboard, mouse, gamepad and relative touch steering, a portrait journal, tests.

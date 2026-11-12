# Starbase Spooky

**Genre:** Edutainment point-and-click adventure for young players (about 5–9)
**Engine:** Vanilla JS, Canvas 2D at 640×360 game pixels, no libraries. Art generated with fal, audio with ElevenLabs.
**Status:** v1.1.0

---

## Concept

An edutainment-style game with classic 16-bit graphics. You run a space station in the future: funny aliens
visit, parts of the station break down, you answer space questions, and you solve the mystery of the haunted space
station. It's for younger players, in the spirit of the 1990s CD-ROM adventures (Pajama Sam, Reader Rabbit) and
the friendly space games of the 80s.

**Kit**, the Junior Station Keeper, runs **Starbase Nine** for five days while Captain Ada Comet is away at Moon Base.
**Orby**, a floating robot, comes along and gives hints. Each day:
- a visitor docks and asks three space questions,
- something breaks and needs a small puzzle to fix it,
- something spooky happens.

The "ghost" leaves clues: glowing goo, an empty cookie jar, a nibbled power cable, a sad hum on the radio, tiny
glowing footprints, and a star chart of the Glimmer Nebula. On day five Kit solves the mystery. The ghost is
**Wisp**, a lost baby Glimmerling who has been eating cookies and electricity in the air vents. Kit makes her a
Glow Cookie, finds her nest, and plays her mama's song on the comms console. **Mama Glimmer**, a space whale made
of starlight, comes to the window to take her home.

Nobody can lose. Wrong answers get a gentle "try again", every puzzle accepts any number of wrong taps, and Orby
always knows the next job. Every line is voiced, so a child who can't read yet can play. The questions are read
aloud with their answers, in the order the buttons show them.

## Core loop

1. **Morning:** Captain Ada calls on the comms console with the day's jobs, and Orby announces what broke.
2. **Free roaming:** tap things to walk over and look. Orby comments on everything. Walk to the next room with
   the toolbar's ◀ ▶ buttons or the arrows at the picture's edges; the way to the next job glows. Or open the
   station map.
3. **Jobs:** greet the visitor, fix the breakdown, find the day's clue or clues. The 📋 list shows them, and
   🤖 or tapping Orby gives a voiced hint.
4. **Spooky moments** happen between jobs: a ghost drifts past, the lights flicker, something peeks in.
5. **Bed:** when the jobs are done, the bunk in Crew Quarters ends the day with a night card ("That night…").
6. Day five ends with the mystery, Wisp, the song and the certificate.

## The five days

| Day | Visitor (topic) | Breakdown → puzzle | Clues |
|---|---|---|---|
| 1 | Zorp, a tourist from Glorp (the planets) | Star Garden lights → **wires** (match colours) | glowing goo (only once the lights work) |
| 2 | Madame Gloobella, jelly opera diva (the Sun and stars) | Snack-O-Tron → **battery** (add up to a number) | cookie crumbs |
| 3 | Captain Snorkel, space walrus trucker (the Moon and comets) | telescope → **planets** (order from the Sun) | humming on the radio, nibbled cable |
| 4 | Professor Quasar, squid scientist (how space works) | fuse box → **sequence** (memory) | glowing footprints (needs his Glow-o-Meter), star chart |
| 5 | Blip & Blop, two-headed rocket fan (rockets and astronauts) | — | solve the mystery → Glow Cookie → the vents → **song** → home |

Jobs can have prerequisites (`after`): the goo waits for the lights, the footprints for the Glow-o-Meter, the
cookie for the solved mystery, the vent for the cookie, and calling home for finding Wisp.

## Mechanics

### Commands (`act(G, cmd)` in `js/sim/game.js`)
`tap` a spot (Kit walks to its `walk` x and then uses it), `walk` to a point on the floor, `go` to a room (map),
`next` (a line or the night card), `answer` i (a question), `pick` (a puzzle piece), `solve` (the Notebook's
mystery), `hint`. Nothing else changes the game. The bot and the tests use the same commands.

### The story queue
`G.queue` holds steps. **Blocking** steps wait for the player: `say`, `ask`, `ded`, `puzzle`, `night` and `end`.
**`do`** steps run at once: finish a job, give an item, add a clue, fix a system, change room, raise an event. Kit
can only walk while the queue is empty. `step(G, dt)` only moves Kit, runs the memory puzzles' light shows and counts
down to spooky moments.

### Questions
Each visitor knows four questions and asks three, chosen by the seed, so a replay differs. A first-try right
answer is worth 2 stickers; later it's worth 1. A wrong answer greys out that button and can't be picked again, so
a question takes at most three taps. Every right answer puts its fact in the Space Book and Orby reads it aloud.

### Getting around
The seven rooms form a ring round the hub, in the order the station map draws them (`RING` in `rooms.js`): Command
Deck, Observatory, Docking Bay, Crew Quarters, Engine Room, Galley, Star Garden. The `exit` command walks Kit to the
left or right edge and into the neighbouring room, entering at the opposite edge. `wayTo` picks the shorter way
round, and the toolbar button and the edge arrow pointing that way glow, so the next job is never more than three
rooms away. The air vents lead only back to Crew Quarters. The map's `go` jumps straight to any room.

### The toolbar
The toolbar is always under the picture. It holds ◀ (room) · *You are in the …* · (room) ▶, the backpack (gadgets,
then six clue slots), Day, stickers, 📋 jobs, 🤖 hint, 🗺️ map, 📓 Notebook and ❚❚. The job list fills the strip
under it whenever nobody is talking. On a short landscape phone it's one slim row at the bottom, and the backpack
folds into a 🎒 button.

### Puzzles (`js/sim/puzzles.js`)
- **wires:** four colours on the left, a shuffled column of plugs on the right, never already solved. Tap a wire,
  then its colour. A wrong plug gives a harmless zap.
- **battery:** the target is 6–10. There are six batteries of 1–5, built around a two- or three-cell solution, so
  every board has an answer. Tapping a battery toggles it, and going over says "Too much power!".
- **planets:** tap the eight planets in order from the Sun. A wrong one is just "not that one yet".
- **sequence / song:** three rounds of 3, 4 and 5 lights (4 fuses, or 5 stars for the song). Taps are ignored while
  the lights play, and a wrong tap replays the round.

### Stickers
First-try answer 2, retry 1, repair 2, clue 1, mystery solved 3, Wisp home 5. A perfect game earns 52.

### Spooky moments
A timer counts down all day: 18–32 s for the first, then every 40–70 s. A moment only fires when Kit is free and
nobody is talking. Kinds: a ghost drifts across, the lights flicker twice (at most two blinks a second, one with
`prefers-reduced-motion`), or a ghost peeks in from the edge. The day's first one gets a nervous line from Orby.
They stop once the mystery is solved.

## Content

Everything is data in `js/sim/data/`:
- `cast.js`: 12 characters, each with its fal `art` prompt and sprite height.
- `questions.js`: 20 questions. The right answer is spread over all three buttons.
- `rooms.js`: 8 rooms. Each has hotspots placed by eye on the generated backdrops, and the station map boxes.
- `story.js`: the days, jobs, clues, items, the mystery questions and all 154 lines.

## Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Walk and look | tap it (a tap on the floor just walks) | arrows to choose, Enter | d-pad, A |
| Next room left / right | ◀ ▶ on the toolbar, or the arrows at the picture's edges | Q / E | LB / RB |
| Backpack | tap a slot (🎒 on a short phone) | B | Back |
| Next line | tap the box or ▶ | Space / Enter | A |
| Answer | tap the answer | 1 2 3, or arrows + Enter | d-pad, A |
| Hint, map, Notebook, jobs | 🤖 or Orby, 🗺️, 📓, 📋 | H, M, N, J | X, Y |
| Pause | ❚❚ | Esc | Start / B |

## Look and sound

- **Art:** fal `nano-banana-2` under one shared "1990s 16-bit edutainment" system prompt. It covers 8 room
  backdrops, the title, the station map, 12 sprites cut from a key colour, and the item and planet icon sheets.
  Everything is exported to the 640×360 grid and drawn 1:1, so the whole canvas scales with nearest-neighbour. See
  `dev/art/README.md`.
- **Sound:** ElevenLabs provides 5 music themes, 14 effects and 154 voice lines in 9 voices. Music crossfades
  between themes (title, station, spooky in the vents and at night, fix-it during puzzles, ending). Effects and
  voices are decoded buffers, and the music ducks while someone talks. A synth stands in for any file that won't
  load. See `dev/audio/README.md`.
- **Text:** "Press Start 2P" for the pixel labels and Nunito for anything a child reads. Both have system fallbacks.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, layout, the fixed-step loop, input routing (pointer, touch, keys, gamepad), saves, debug hooks |
| `js/sim/game.js` | Pure rules: `newGame`, `act`, `step`, `objective`, `serialize` / `deserialize` |
| `js/sim/puzzles.js` | The puzzles: make, pick, tick, and a correct move (for the bot and tests) |
| `js/sim/bot.js` | An auto-player at any skill, through `act()` |
| `js/sim/data/*.js` | Cast, questions, rooms, story and lines |
| `js/view/view.js` | Canvas 2D: rooms, characters, effects, puzzles, map; builds the tappable `targets` |
| `js/view/assets.js` | Image loading and icon atlases |
| `js/ui.js` | DOM: HUD, jobs, dialogue, quiz, puzzle bar, Notebook, night card, certificate, settings |
| `js/audio.js` | Music, effects and voices (ElevenLabs files) with a Web Audio synth fallback |
| `js/save.js`, `js/rng.js`, `js/config.js` | Guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md).
- `simtest.mjs` (315 checks) covers:
  - purity
  - every line and clip existing
  - the rules, step by step through a whole game
  - every puzzle proved solvable on 300 seeds after random wrong taps
  - determinism and save round trips
  - whole games by the bot at two skills, with balance bands
- `browsertest.mjs` drives the real game with real keys, clicks and touches on desktop, two phones and blocked
  storage. It also checks that the sounds decode and the music plays.

## Balance notes

The bot (24 seeds, 2.5 s of "listening" per line) gives:

| skill | stickers | first try | taps | lines heard | wrong answers | spooky moments | minutes |
|---|---|---|---|---|---|---|---|
| 1 (knows everything) | 52 | 15 | ~222 | ~114 | 0 | 5 | 7 |
| 0.4 (guesses often) | ~46 | ~9 | ~290 | ~132 | ~9 | 6 | 9 |

The asserted bands:
- a perfect game earns 50–60 stickers and all 15 answers first try,
- a child who guesses still earns at least 60% of that,
- nobody gets more than two wrong answers on a question,
- every game has spooky moments.

A real child reads, explores and replays lines, so expect 25–45 minutes.

## Open questions / next steps

- A human pass on real hardware, with a real child. The bot is not a five-year-old, and the voices have only
  been checked by clip length, not by ear.
- A sixth visitor and a second mystery would make a good sequel.

## Changelog

### v1.1.0 (2026-11-12)
- A toolbar that's always under the picture:
  - ◀ ▶ walk to the neighbouring room round the ring, and the way to the next job glows
  - door arrows at the picture's edges do the same
  - a backpack shows the gadgets and the six clues; tap one for its card and voice line
  - the tools moved into it, and the job list fills the strip below it
- The sim gained the `exit` command; a bot that only uses side doors finishes the game.

### v1.0.0 (2026-11-12)
- First release:
  - five days, five visitors and 20 voiced space questions
  - four repair puzzles and the song
  - six clues, the mystery and the ending
  - fal art and ElevenLabs voices, music and effects
  - keyboard, mouse, touch and gamepad
  - sim and browser test harnesses

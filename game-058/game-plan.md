# Bumble Basket

**Genre:** Casual puzzle (trait-chain picking)
**Engine:** three.js r165 (ES modules, import map from unpkg), DOM HUD
**Target:** phones first (portrait and landscape), desktop with a mouse
**Status:** v1.0.0, playable

---

## Concept

A little bumblebee is filling a picnic basket. Fruit sits on a gingham picnic
blanket, and you collect it by dragging the bee along a trail from fruit to
fruit. Each fruit you hop to has to **share something with the one before
it**: the same kind, the same colour, the same size or the same family. So a
trail can wander: a red apple to a green apple (same kind), to a lime (same
colour), to a lemon (same family), to a banana (same colour), to a big banana
(same kind).

It plays like a word ladder made of fruit. Match-3 and Two Dots ask for runs
of identical pieces. Here pieces only have to be *related*, and how they can be
related grows as you play. That growth is the progression.

The tone is light: chubby fruit with faces, a wobbly bee, a gingham blanket in
a sunny meadow, soft plucky music and pops. Nothing is timed. Losing offers
five more moves for free.

---

## The pieces

Every fruit has four traits.

| Trait | Values |
|---|---|
| **Kind** | 16 kinds: apple, pear, peach, cherry · strawberry, blueberry, grape, raspberry · orange, lemon, lime, grapefruit · banana, pineapple, mango, dragon fruit |
| **Colour** | red, orange, yellow, green, blue, purple, pink (each kind has 1 to 3 natural colours) |
| **Size** | small, medium, large |
| **Family** | Orchard, Berry, Citrus, Tropical (four kinds each) |

There are 27 natural kind and colour pairs, which makes 81 variants once sizes
come in. Each variant has a stamp in the **Fruit Album**.

---

## Core mechanics

### 1. The trail (the novel part)
- Press a fruit and drag through its 8 neighbours. Release with 3 or more to
  harvest them. Each harvest costs one move.
- A hop is legal if the two fruit share at least one trait the bee can
  **sense**. Neighbours you can hop to light up, the rest dim. Dragging back
  over the previous fruit undoes a hop.
- The trail is drawn as a thick rope over the fruit, each hop coloured by
  the trait that linked it, with glowing discs under picked fruit, a rubber
  band to the finger, a tag naming each hop's trait ("same colour!") and a
  bubble counting the trail toward golden.

### 2. Bee Senses: the progression
The bee starts out sensing only **Kind**. Each garden teaches one more sense:

| Garden | Levels | Senses | What's new |
|---|---|---|---|
| Sunny Orchard | 1–7 | Kind | one colour per kind, medium only |
| Berry Patch | 8–15 | + Colour | apples come in red, green and yellow; berries, limes and lemons arrive |
| Giant's Garden | 16–23 | + Size | small, medium and large fruit; leaf piles |
| Tropic Tops | 24–30 | + Family | all 16 kinds; frosted fruit |

Each garden ends on a **Set level**: collect one of every fruit in the
garden. Finishing it teaches the next sense. More senses make linking easier,
so each garden makes up for it with more variety: more kinds, colours and
sizes on the blanket at once. That's how "collecting sets gets you power-ups to
collect more kinds of fruit" works over a whole run.

### 3. Set Jars: in-level power-ups
Under the blanket is one jar per sense. Each jar wants a set: "8 apples",
"10 red", "10 large", "12 citrus". Harvested fruit that fits pours in. A full
jar holds a power-up charge (up to 2), then asks for a new set.

| Jar | Power-up | Effect |
|---|---|---|
| Kind | 🍯 **Honey Dipper** | tap a fruit: collect every fruit of that kind |
| Colour | 🎨 **Paint Pollen** | tap a fruit: its neighbours take its colour |
| Size | 💥 **Buzz Bomb** | tap a spot: collect the 3×3 around it |
| Family | 🌈 **Rainbow Wings** | your next trail can hop between any fruit |

Power-ups never cost a move.

### 4. Golden fruit
A trail of **7 or more** leaves a golden fruit where it ended. Golden fruit
links to anything and scores a 100-point bonus when harvested.

### 5. Obstacles
- **Leaf piles** (Giant's Garden) fill a cell. Harvesting next to one rakes a
  layer off; big piles have two layers.
- **Frost** (Tropic Tops) locks a fruit in place. It can't join a trail until
  a harvest next to it thaws it.
- **Shaped blankets**: some levels have holes (heart, diamond, ring, and so on).

Fruit falls past fixed cells (holes, leaves, frost), so no column gets stuck.

---

## Game loop

Title, then the garden map, then a level card (goals, moves, a tip), then
play, then a win (stars, new stamps) or out of moves (+5 moves, or retry). A
garden finale adds a new sense, with a card that explains it with an example.

**Picnic** mode unlocks after the first garden. It has no move limit and uses
every sense you've learned. Every 40 fruit fills a basket and adds a new kind.
It keeps your best score.

---

## Goals (tickets in the top bar, up to 4)

- Collect N of a kind, colour, size or family (`kind | colour | size | family`)
- Grow N golden fruit (`golden`)
- Rake N leaf piles (`leaf`)
- Thaw N frosted fruit (`frost`)
- Collect any N fruit (`any`)

## Stars
Winning gives ★. Finishing with at least 20% of your moves left gives ★★, and
at least 40% gives ★★★. Taking the +5 moves caps the level at ★. Leftover moves
become "Sweet Finish" points. The thresholds are high because the casual
balance bot usually finishes with 35–50% of its moves left (see
`dev/README.md`).

## Score
A trail of n fruit scores 10·n². Each power-up fruit scores 20. A golden fruit
scores 100. Each leftover move scores 150.

---

## Controls

| Action | Touch | Mouse / keys |
|---|---|---|
| Make a trail | drag | drag |
| Undo a hop | drag back | drag back |
| Use a power-up | tap its jar, then tap the blanket | same |
| Cancel a power-up | tap the jar again | same, or Esc |
| Pause | ❚❚ button | P / Esc |
| Hint | wait a few seconds | H |

---

## Presentation

- **three.js scene**: a gingham blanket with a scalloped edge on a grassy
  meadow, rolling hills, round trees, drifting clouds, flowers and a wicker
  basket. Soft sun with shadows, hemisphere fill, ACES tone mapping.
- **Fruit**: built in code, with one merged, vertex-coloured mesh per kind and
  colour, so a whole blanket uses one material. Each fruit has a face (eyes
  and mouth) that blinks, beams while it's in your trail and looks worried
  when it can't join. Sizes scale 0.68, 0.86 and 1.06.
- **Bee**: a striped body, flapping wings and a bobbing flight. It follows
  your finger and then zips along the trail as each fruit pops off and arcs
  into the basket.
- **Effects**: juice splashes in the fruit's colour, sparkles, pollen dots,
  golden glints, and a ring of light on every fruit in the trail.
- **DOM HUD**: tickets with 3D-rendered fruit thumbnails, a moves counter,
  sense badges and jars that fill with liquid. Fredoka font.
- **Camera fit**: the board is fitted into the space the HUD leaves free,
  using `setViewOffset`, so it's never under a panel in portrait or
  landscape. On wide screens the basket moves beside the blanket so the
  blanket can be bigger.

## Sound (Web Audio, no files)

| Sound | Trigger | Style |
|---|---|---|
| Hop note | each hop | marimba-like note climbing a pentatonic scale |
| Undo | drag back | soft lower blip |
| Nope | illegal hop | muted bonk |
| Pop | each fruit harvested | bubbly sine drop |
| Basket | fruit lands | wicker thump |
| Jar full | power-up earned | sparkle arpeggio |
| Honey / Paint / Bomb / Rainbow | power-up use | slurp, splat, thud, glissando |
| Golden | golden spawns | bell chord |
| Win / Fail | level end | jingle / gentle "aww" |
| Buzz | while dragging | vibrato sawtooth through a low-pass filter |
| Music | always (toggle) | ukulele-style plucks over I–V–vi–IV, bass, shaker |

---

## Module overview

| File | Responsibility |
|---|---|
| `js/config.js` | Fruit, colour and family tables, senses, jars, power-ups, 30 levels, tunables |
| `js/sim/rng.js` | Seeded PRNG (mulberry32) |
| `js/sim/game.js` | Pure game rules: board, links, trail check, harvest, gravity, refill, obstacles, jars, power-ups, goals, stars. Returns event lists for the view |
| `js/sim/search.js` | Trail search: any-move check, hints, best trail for the bot |
| `js/sim/bot.js` | Greedy auto-player used for balance and tests |
| `js/view/scene.js` | Renderer, camera, board fit, meadow backdrop, lights |
| `js/view/fruit.js` | Fruit geometry factory (per kind and colour, merged, vertex colours) and faces |
| `js/view/board.js` | Fruit meshes on the blanket; plays sim events back as animations |
| `js/view/bee.js` | The bee |
| `js/view/fx.js` | Particles, pollen trail, selection rings, flying fruit |
| `js/view/thumbs.js` | Offscreen-rendered fruit thumbnails for the DOM |
| `js/audio.js` | Sound effects and generative music |
| `js/ui.js` | HUD, tickets, jars, overlays, map, album, settings |
| `js/main.js` | App state machine, input, saving, debug hooks |

The sim never imports three.js or touches the DOM. `dev/simtest.mjs` checks
that.

---

## Testing

- `node game-058/dev/simtest.mjs`: rules and invariants, plus bot runs on
  every level across many seeds (win rate and moves left).
- `node game-058/dev/browsertest.mjs`: real Chromium with WebGL. Desktop flow,
  a real drag-made trail, power-ups, win and fail, album, settings, then
  touch-only phones in portrait and landscape.

---

## Open questions

- A colour-blind mode (a pattern per colour) would help, since colour is one
  of the four link traits.
- Daily picnic seed?

## Changelog

### 1.1.0 (2026-10-04)
- The trail is much easier to see while dragging: a thick rope with a dark
  outline is drawn over the fruit, each hop coloured by the trait that linked
  it, with sparkles and a bright band flowing toward the newest fruit. Picked
  fruit sit on glowing discs (the newest pulses), a rubber band of dots runs
  from the last fruit to your finger, and a bubble over the newest fruit
  counts the trail ("1 more for golden!" at 6, gold at 7). Hop tags moved to
  the middle of each hop, and the bee hovers beside your finger instead of on
  top of the trail's end.

### 1.0.1 (2026-10-04)
- Fixed taps on phones landing one fruit too low. The canvas was stretched to
  `100vh`, which on phones with a URL bar is taller than the visible area, so
  the picture sat lower than where taps were mapped. The renderer now sizes
  the canvas to `innerWidth × innerHeight` in pixels, taps map through the
  canvas's on-screen box, and the browser test checks both.

### 1.0.0 (2026-10-04)
- Full game: 30 levels in 4 gardens, 4 senses, 4 power-ups, golden fruit,
  leaves and frost, Picnic mode, Fruit Album, music and sound, touch and mouse.

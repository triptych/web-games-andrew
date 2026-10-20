# Curio Cove

**Genre:** Casual match-3 with a cozy museum meta-game
**Engine:** three.js r165, no asset files (every model, texture, tune and sound is made in code)
**Status:** v1.1.2

---

## Concept

You are a newly graduated archaeologist. Your great-aunt Marigold ran the Curio Cove Museum on Puffin Isle for forty years, then bought a sailboat and set off round the world, leaving you her letter and the museum. The roof is half missing, sand has blown through the halls, a crab lives in the ticket booth, and the collection went off to be cleaned years ago and never came back.

So you dig. Every match-3 level is a dig at the site on the hill, and every first win turns up a find: a fisherman’s jug, a golden mask, a trilobite, a Triceratops skull. Stars from your digs pay for restoration tasks that bring the halls back to life, one scene at a time. Along the way you hire a small, gentle team: Moss the badger caretaker (and Duchess, his mop), Penny Quill the owl administrator, Tobias Ledger the tortoise accountant, Kit the fox tour guide and Rosa the raccoon restorer. Fill five halls and stand up three dinosaurs, and Aunt Marigold sails home for the Grand Reopening.

It riffs on Gardenscapes and Homescapes (a match-3 that pays for restoring a place, with a cast and a story) and Candy Crush (specials, combos, blockers, goals), in the warm, light tone of Animal Crossing. Nothing is ever lost: there are no lives and no timers, a lost dig can be retried at once, and the museum earns a little money while you are away.

## Core loop

1. **Museum.** Look round the island; collect the till; pick a task from the list.
2. **Dig.** Tap Dig to play the next level: reach its goals within its moves.
3. **Win.** Stars (1–3 by score), coins and, the first time, a find for the collection.
4. **Restore.** Spend stars on the chapter’s tasks. Each plays a short scene and changes the museum you see: a door opens, sand is swept away, a new hall fills with plinths, a skeleton goes up.
5. A chapter’s last task needs every other task and all twelve of its digs; it opens the next chapter, its dig site and a letter from Aunt Marigold.

Five chapters of twelve digs (60 story levels), then the endless **Night Digs**.

## The dig (js/sim/board.js)

A board of up to 9×9 cells in one of twelve shapes. Six kinds of find, each a different shape *and* colour: amphora, gold coin, leaf fossil, ammonite, amethyst, bone. Levels use four (the first three) or five (most) or six (some hard ones). Swap two neighbours to make a line of three or more, or a 2×2 square. A swap that makes nothing is refused and costs no move.

### Specials

| Make it with | Special | It does |
|---|---|---|
| 4 in a row | **Trowel** (row or column) | Sweeps its whole row or column |
| An L or a T | **Pickaxe** | Breaks a 3×3 block and one more cell out from each side |
| A 2×2 square | **Scarab** | Clears its four neighbours, then flies to the cell that helps the goals most and digs it |
| 5 in a row | **Sunstone** | Swap it with any find: every find of that kind goes |

A special is born where the swapped find landed, or where an L's lines cross. Specials go off when matched or when another special hits them.

### Combos (swap two specials)

| Pair | Result |
|---|---|
| Trowel + Trowel | A cross: the whole row and column |
| Trowel + Pickaxe | Three rows and three columns |
| Pickaxe + Pickaxe | A 5×5 blast |
| Scarab + Scarab | A flock of three scarabs |
| Scarab + Trowel / Pickaxe | The scarab carries the other special to its target and sets it off there |
| Sunstone + find | Clears every find of that kind |
| Sunstone + Trowel / Pickaxe / Scarab | Every find of that colour becomes that special, and they all go off |
| Sunstone + Sunstone | Clears the whole board |

### Goals and blockers

| Goal | On the board |
|---|---|
| Collect N of a find | — |
| **Dirt** | Cells with one or two layers of dirt under the find. A match on the cell, or a special hitting it, digs one layer |
| **Fossils** | Some dirt cells hide a fossil (a bone peeks out of the corner); dig the cell clean to uncover it |
| **Boulders** | Fill a cell (1 or 2 hits). Matches beside them and specials crack them. Nothing falls through a boulder |
| **Crust** | A find set in hard sand: it can't be swapped or fall. Match it (or hit it) to break the crust; the find stays |
| **Relics** | Treasures that fall like finds but never match. Bring one to the lowest cell of its column and it lifts out |

### Gravity

Finds fall straight down and are refilled from above. A cell whose column is blocked by a boulder or a crusted find is fed diagonally from the cell above-left or above-right. A cell with no way in at all is a *pocket*: it stays empty until its blocker breaks (as in other match-3 games). When no swap is left, the board shuffles itself for free.

### Ends

- **Win**: every goal met. **Treasure Rush**: each move left turns a find into a trowel, then every special on the board goes off for score. A **Skip** button (or a tap on the board, Space, Enter or Esc) jumps to the result; the sim has already settled it.
- **Out of moves**: buy five more (60 coins, then 120, 180…), retry or go back to the museum. No lives.
- **Boosters**: the Rock Hammer smashes one cell (a boulder, crust, a find); the Sieve Shake shuffles. Bought with coins; staff give some when they join.

### Scoring and stars

Matches score by size and kind (3: 60, 4: 140, 5: 260, L: 200, square: 120), more on cascades (+50% a step). Special hits, dirt, fossils, boulders, crust and relics score too. One star for a win; two and three stars for scores fitted to the bot's play (below).

## The museum (js/sim/game.js)

| Currency | Comes from | Pays for |
|---|---|---|
| ★ Stars | A first win: 1–3 by score. A replay: the improvement, and always at least one | Restoration tasks |
| Coins | Every win (10 a star, 20 more the first time); the till; Ledger's gift | Boosters, five more moves, decorations |

**Appeal** counts what visitors see: 1 per find on show (2 with Rosa), 8 per dinosaur standing, 3 per open hall, 5 for Moss, decorations, ×1.5 with Kit. Once the ticket booth is fixed, the till fills at appeal × 0.25 coins a minute (×1.25 with Penny), up to 200 (600 with Ledger), including up to eight hours away.

### Chapters and tasks (js/sim/data.js)

| Chapter | Hall | Tasks (★) | Staff | Dinosaur |
|---|---|---|---|---|
| 1 A Museum by the Sea | Entrance Hall | door 1, sweep 2, hire 2, roof 3, booth 2, cases 3, sign 2, open 3 | Moss (caretaker) | — |
| 2 The Hall of Ancients | Hall of Ancients | vines 2, hire 2, floor 2, permits 1, plinths 3, lanterns 2, garden 3, open 3 | Penny (administrator) | — |
| 3 Bones in the East Wing | Fossil Wing | unboard 2, hire 2, skylight 3, drawers 2, stand 2, build 3, mural 2, open 3 | Ledger (accountant) | Triceratops |
| 4 The Sea Gallery | Sea Gallery | glass 2, hire 2, waves 2, cabinets 2, dock 3, build 3, open 3 | Kit (tour guide) | Plesiosaur |
| 5 The Grand Reopening | Great Hall | rubble 3, hire 2, beams 3, build 3, lights 2, banners 2, grand 3 | Rosa (restorer) | Tyrannosaurus |

Only the next three of a chapter's tasks are on offer at a time. A "build" task needs all six of the dinosaur's bones (skull, neck, ribs and spine, front legs, back legs, tail); they are rewards in the same chapter, so the test checks no chapter can ask for a bone it hasn't handed out. Every chapter's tasks cost at most two stars per level, and replays always pay a star, so no one can be stuck short of stars.

### Finds

60 rewards, one per story level, in hall order: 12 artifacts each for the Entrance Hall and the Hall of Ancients, then 6 artifacts and the 6 bones of a dinosaur for each of the other three halls. Each artifact has a name, a line of history and a procedural model (40 kinds: vases, lamps, coins, bells, a compass, a clay puffin, a tide tablet, a mermaid figurehead, a driftwood throne, a star sapphire…). Finds go on show when their hall opens.

## Story

Told in short scenes after each task, in the voice of whoever was involved, with Aunt Marigold's letters at each chapter's end. The intro is the ferry ride over with Captain Gus the otter. The finale is the Grand Reopening: the whole village, three boatloads from the mainland, a sea-shanty choir, Barnaby the seal, and Aunt Marigold, home on the morning tide. Then the Night Digs open: endless levels by lantern light, a star a win.

## Controls

| Action | Mouse / touch | Keyboard | Gamepad |
|---|---|---|---|
| Swap | Drag a find onto a neighbour, or tap two | Arrows move the cursor, Space selects, an arrow swaps | D-pad, A |
| Hammer / Shuffle | Buttons | H / X | Y / X |
| Museum camera | Drag to turn, pinch or wheel to zoom | Arrows | — |
| Museum menus | Buttons | D dig, T tasks, J journal, S shop, C till | — |
| Pause / back | ☰ / ❚❚ | Esc / P | B / Start |
| Dialogue | Tap | Space / Enter, Esc skips | A |

## Look and sound

- **Stage** (js/view/stage.js): ACES tone mapping, PCF soft shadows, an environment map from RoomEnvironment for every metal and gem, then RenderPass → a NaN/Inf sanitiser → UnrealBloom at half size (threshold above 1, so only true glows bloom) → a grade pass (split toning, vignette, grain, a white flash and chromatic aberration the dig drives on big blasts) → OutputPass.
- **Dig** (js/view/board3d.js): an excavation pit on rippled sand (a patched MeshStandardMaterial), rounded dirt slabs raised by their layers, a wooden rim and white survey strings, corner stakes, a parasol, bucket, sieve, brushes and clipboard. Finds stand tilted to face the camera and bob; coins turn. Each chapter has its own sand and light; Night Digs are moonlit with lanterns. The view plays each move's script: swaps with lift, pops with sparkles and tumbling shards, matches converging into specials, beams, rings, a point-light flash, lightning, scarab flights, dust from dirt, cracking boulders, fossils rising, relics lifting out, falls with gravity and a landing squash, camera shake, praise ("Fossiltastic!"), score popups, and goal icons that fly to their counters.
- **Island** (js/view/island.js, museum3d.js): about 260 units across. The museum on its plateau above Curio Cove (village, pier, fishing boats, Gus's ferry); Driftwood Dunes; Lighthouse Point on a headland that rises to sea cliffs; the Old Ruins; Whispering Woods; Mirror Lake on a highland, its river falling over a waterfall to the west coast; Windmill Meadow; Jungle Hill; Sunset Quarry's terraces; Mount Ember with a churning lava crater (it blooms) and a plume of smoke. A sky dome with clouds; a sea that samples a baked height texture for shallows, depth colour and foam; instanced pines, oaks, palms, ferns, grass and rocks placed by region; dirt paths painted into the terrain colours. One dig camp per chapter in its region. The camera is a map camera, and the sun's shadow box follows the view. The museum is five rooms with the roof cut away, rebuilt from G when a task changes them; finds stand on plinths, dinosaurs on stands (missing bones as faint blue ghosts). Staff wander their halls; visitors (puffins, rabbits, bears, cats, seals, sheep) come up from the dock and stroll the open galleries, more as appeal grows.
- **Models** (js/view/models.js, artifacts.js, skeleton.js, animals.js, props.js): lathes, extrusions, variable-radius tubes, ribbons, noise-displaced rock, merged per material with vertex colours. `dev/gallery.html` shows every one on a neutral background.
- **UI**: warm paper sheets, Fredoka (system fallback), pills and badges, dialogue with portraits rendered from the 3D characters (js/view/thumbs.js), goal and journal icons rendered from the models.
- **Sound** (js/audio.js): a look-ahead sequencer with three tunes (marimba in the museum, plucks and brushes in the dig, a music box at night) over a pad and bass with generated reverb; chimes that climb the pentatonic scale with each cascade, zaps, thumps, crunches, cracks, a fossil arpeggio, a relic fanfare; waves and gulls in the museum; a voice blip per letter of dialogue, pitched by speaker.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, museum, dig), the fixed-step museum clock, routing input, events and scenes, debug hooks |
| `js/sim/board.js` | The match-3 engine: pure, JSON-able board with its own random state; every move resolves at once into a script of events |
| `js/sim/levels.js` | Level shapes, goals and blockers from a seed and a difficulty curve; the bot-fitted `TUNED` table |
| `js/sim/game.js` | The museum: currencies, tasks, staff, finds, appeal, the till, digs, saves |
| `js/sim/data.js` | Halls, finds, dinosaurs, people, tasks, decorations, every scene |
| `js/sim/bot.js` | The dig bot (look-ahead on a copy with scrambled refills) and a whole-game bot |
| `js/view/` | `stage` (renderer and post), `board3d` (the dig), `museum3d` (the island), `fx` (particles, shards, rings, beams, bolts), models and props, `thumbs` (DOM pictures) |
| `js/ui.js` | DOM screens, HUDs, tasks, journal, shop, results, dialogue, floating text |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Key and pad queue, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule and special and combo on hand-drawn boards, fuzzes thousands of random moves over 72 levels with the board checked after each, builds all 100 levels and checks their goals against their boards, the museum's rules, determinism and a mid-dig save round trip, and has bots play the whole story to the finale. `tune.mjs` fits each story level's moves and stars to the bot. `browsertest.mjs` drives the real game: desktop by mouse and keys from the title through a dig, a win, a task scene, the journal, the shop, a reload and a lost dig; touch-only phones in both orientations; blocked storage.

## Balance notes

- The first draft was far too easy: a half-skill bot cleared most levels in 3–20 moves (four colours cascade a lot). Goals grew (colour goals 20–60, more dirt, double layers from early on, more boulders and crust), five colours from level 4, and six on some hard levels without relics.
- Moves are not guessed: `dev/tune.mjs` plays each level 16–24 times with a skill-0.5 bot and no move limit, and takes the moves needed at a quantile that falls with difficulty (95% for the first levels, 60% for every fourth "hard" level), plus two. Star scores are the 35th and 80th percentiles of its winning scores.
- Relics were the slowest goal (one level needed 84 moves): at most four per level, no six-colour relic levels, never a boulder in a column's lowest cell, and the bot now values a relic's height on the board more.
- A chapter's finale task waits for its twelve digs, so the story never ends before the last find.
- Final table (simtest `story`): a perfect bot reaches the Grand Reopening in 61–62 digs with 1–2 losses; a skill-0.5 bot in 65–69 digs with 5–9 losses and about 20 move purchases, ending with about 4,000 coins (the decorations cost 7,600 in all).

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- More Night Dig variety (new blockers: ice over dirt, conveyor tiles), and a daily dig.
- A photo mode for the museum.

## Changelog

### v1.1.2 (2026-10-20)
- A Treasure Rush can be skipped: a Skip button, a tap on the board, Space, Enter or Esc jump to the final board and the result.
- Signs shrink their words to fit: the museum's sign read "JRIO COVE MUSEU".

### v1.1.1 (2026-10-20)
- Outlined text ("Great dig!", combo calls, score pops, the title) drew stray lines inside letters like t, d and k. The outline is now a ring of hard text shadows instead of `-webkit-text-stroke`.

### v1.1.0 (2026-10-20)
- A whole island: Curio Cove and its village, Driftwood Dunes, Lighthouse Point, the Old Ruins, Whispering Woods, Mirror Lake with its river and waterfall, Windmill Meadow, Jungle Hill, Sunset Quarry and Mount Ember (smoking, with a lava crater). One dig camp per chapter in its region; Night Digs at Ember Rim. A map camera (pan, pinch, twist), a 🗺️ overview button, place names and a ⛏ chip that points to the current dig. The sea's shallows and foam follow the coast from a baked height texture; forests are instanced.

### v1.0.1 (2026-10-20)
- Gold coins no longer flash: satin gold instead of mirror-polished, a ±0.08 rad sway instead of ±0.5 for every find. On a still board the screen share that swings by more than a quarter of full brightness fell from 4.8% to about 0.3%; the browser test now measures it.
- The white screen flash is capped and throttled (at most twice a second), the light flash too. New **Calm effects** setting (no screen flash, colour split or shake, half the glow), on by default when the system asks for reduced motion. The Screen shake setting works.
- Settings and How to Play opened from the pause menu now appear on top of it.

### v1.0.0 (2026-10-20)
- First release: the match-3 engine (four specials, eight combos, dirt, fossils, boulders, crust, relics, pockets, shuffles, Treasure Rush), 60 story levels in five chapters plus endless Night Digs, the museum with 38 tasks, five staff, 60 finds and three dinosaurs, the till and time away, decorations and boosters, a story told in 40 scenes, the 3D dig and island, procedural music and sound, and the dev harnesses.

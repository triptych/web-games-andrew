# Crown & Crumpet

**Genre:** Cosy isometric tactics RPG (Final Fantasy Tactics, pared down and softened)
**Engine:** Vanilla JS: Canvas 2D, no library, no asset files (the sim/view layout)
**Status:** v1.0.0 complete: six chapters, six playable students, one reluctant Dread Lord

---

## Concept

Princess Pippa ("Pip") of Brightmeadow is three weeks into her first term at Thistlewick Academy of Magic & Marching, where every future queen must prove herself. She is brave, determined and extremely clumsy. Across six chapters she makes friends who are stranded around the school (a shy knight, a footnote-obsessed mage, a calm herbalist, a prickly rooftop archer, a hungry clay golem) and leads them in turn-based tactical battles against dust bunnies, ink blots, hedges, crows and stale scones. Behind all of it is the Dread Lord Basil of the Underkitchens, who at the end turns out to be a very tired chef who never wanted the job. Pip talks him down, and the last scene is the opening day of the Thistlewick Cooking School.

The tone is gentle. Nobody dies (fainted students are back next chapter), the enemies are fluffy or ridiculous, there is no miss chance, and a lost battle is "tuckered out, try again". It riffs on Final Fantasy Tactics (isometric height, move-then-act, speed-based turns), Fire Emblem (a small party you come to love), and the cosy-game idea that the hardest enemy might just need a hug and an oven.

## Core loop

One chapter: story scene → choose a party and a snack → battle → victory banner → story scene → "chapter clear" sheet (who joined, what everyone learns next) → next chapter. Chapters 2 to 5 each have a stranded student on the map; walk up to them and they join mid-fight. If you win without reaching them they join anyway, so nobody is ever missed.

## Mechanics

### Turns (charge time)
Every unit has a charge `ct` that fills by its speed each tick; the party starts each chapter with 70-95 and the foes with 0-15, so the students always have the opening turns; the first to reach 100 acts, then spends 100. The strip along the top is `turnOrder(B, 8)`, the sim's own forecast. Fast units (Fenn, crows, sprites) act more often than slow ones (Pudge, scone knights, the boss). A sleeping unit loses its next turn.

### A turn
Move once and act once, in either order. Moving then acting (or acting then moving) ends the turn by itself; Wait ends it early; Undo takes back a move made before acting.

### Terrain
Height levels 0 to 2. A walker climbs one level per step (Fenn two); crows fly over gaps. Bushes cost 2 to enter and soften damage by 15%. Walls, tables and open air block walking. Attacking from higher ground adds 8% per level (up to two), from lower subtracts it.

### Damage
`power × ATK (or MAG) − 0.5 × DEF (or RES)`, times: height, cover 0.85, cheered ×1.25, guarded ×0.65, and +10% for each other ally next to the target (up to two). Minimum 1. No miss chance, no crits, except for Pip.

### Pip is clumsy
On her basic Wobbly Scepter, Pip fumbles `22% − 3% per level` (floor 4%) of the time. Half of those are a trip (no damage, but she curls up and is guarded for two turns) and half are a lucky stumble (double damage). It comes out of the sim's seeded RNG, so a save replays the same trips.

### Statuses and MP
Cheered (+25% damage), guarded (−35% damage taken), cosy (heals 3 + level at the start of each turn), sleepy (skip the next turn; any damage wakes it; bosses resist). Durations count the unit's own turns. MP comes back at 1 per turn.

### Rescues
A guest (neutral, immobile, never targeted) joins the party the moment any student ends a turn next to them, or steps in on her own if the last student faints. A rescue starts a short scene. All foes down also rescues anyone still waiting.

### Items
Each student packs Strawberry Jam (hp, `10 + 2 per level`), Mint Sprig (MP, `4 + 0.8 per level`) and, from chapter 4, a Sparkle Tonic (both), and can carry four. **Use** takes the action and works on yourself or a friend next to you (refused if it would do nothing); **Give** is free, once a turn, to a friend next to you with a free hand. Everyone repacks at the start of each battle. A defeated monster (never the Dread Lord) has a 35% chance to leave an item on its square (jam 5 : mint 3 : tonic 2); a student who stops on it picks it up if a hand is free, and Undo puts it back.

### Picnic basket
One snack before each battle for the whole party: Honey Scone (cheered 4 turns), Berry Tart (guarded 4 turns), Mint Tea (cosy 5 turns, +3 MP).

### The Dread Lord
Basil talks at 70% HP ("please don't make me do the big attack"). At 35% he surrenders instead of fainting: the battle ends as a win, with the reveal scene. His Gloom Gust costs MP; his Reluctant Smite hits two tiles.

### Levels
A unit's level is the chapter it fights in (chapter 1 = level 1). Everyone studies together, so nobody falls behind and a newcomer is never a liability. The outro sheet lists the skills the next level teaches.

## Content

### The students

| Student | Class | Joins | Skills (level learned) |
|---|---|---|---|
| Pip | Royal Apprentice | start | Wobbly Scepter (1), Royal Decree (2): cheer allies within 2; Crown Sparkle (4): magic burst |
| Bram | Shield Cadet | start | Sword (1), Shield Wall (2): guard self and neighbours; Hearty Smash (3) |
| Mina | Library Mage | ch 2 | Wand Zap (1), Sparkle Burst (2), Lullaby (4): sleep; Star Shower (6) |
| Juniper | Herb Healer | ch 3 | Herb Whack (1), Mend (1), Cup of Tea (3): heal + cosy in a circle; Blossom Bloom (6) |
| Fenn | Rooftop Archer | ch 4 | Bow (1), Quick Draw (4): two arrows; Volley (6) |
| Pudge | Clay Golem | ch 5 | Clay Slam (1), Stomp (5), Bake Hard (6) |

### Foes
Dust Bunny, Ink Blot (ranged), Thornling, Cheeky Crow (flies), Soot Sprite, Scone Knight, and Dread Lord Basil. Each has `hunt` (comes at you) or `guard` (waits until you are close) AI.

### Chapters

| # | Title | Map | Party slots | Foes | Rescue |
|---|---|---|---|---|---|
| 1 | First Day Jitters | practice yard, a hill and a pond | 2 | 3 bunnies | |
| 2 | The Library Incident | bookshelves, tables, a rug | 3 | 2 blots, 2 bunnies | Mina |
| 3 | Maze of Thistles | hedge garden with a gazebo | 4 | 3 thornlings, 2 blots | Juniper |
| 4 | Rooftops & Rascals | terracotta roofs, open air | 4 | 3 crows, 3 sprites | Fenn |
| 5 | Cellar of Crumbs | dim cellar, barrels, pillars | 4 | 2 scone knights, 4 sprites, thornling | Pudge |
| 6 | The Gloomy Kitchens | checkerboard kitchen, a dais | 5 | Basil, 2 scone knights, 2 sprites | |

## Story

Prologue: Pip falls into a flowerbed on arrival, and Headmistress Hazel sends her and Bram to the practice yard. Chapters 2 to 5 recruit one friend each and drop clues: the sky has a lid on it, the garden is oddly warm, the bell is the only thing that still rings clean, and there is a smell of cinnamon and warm bread from the cellars. Pudge says the boss is "sad". Chapter 6: a round door marked "Staff Only. Please Knock." The Dread Lord has been a chef all along; the Gloom is smoke from forty years of failed brioche venting through the hills, and "Overlord" is a family business. Pip offers him a cooking school. The ending is the school's first lesson, a charcoal brick Pip baked, and a note from Queen Maribel who would like the brick.

## Controls

| Action | Mouse | Keyboard | Gamepad | Touch |
|---|---|---|---|---|
| Select a tile | hover | arrows / WASD (move along the screen's own directions) | d-pad | tap |
| Confirm | click | Enter / Space / Z | A | tap the same tile again, or Go! |
| Back | | Esc / X | B | Back |
| Attack / Skills / Wait / Undo / Items | buttons | 1 / 2 / 3 / 4 / 5 or I | Y / X / B / R | buttons |
| Cycle units | | Tab | | |
| Pause | ❚❚ | P / Esc | Start | ❚❚ |
| Zoom | wheel | + − 0 | | pinch, drag to look round, ⤢ resets |

A mouse already hovers the tile, so one click confirms. Touch is select-then-confirm so a fat finger never walks the wrong way.

## Look and sound

An isometric diorama on a pastel sky, drawn in Canvas 2D: tiles are diamonds with side faces (grass over a dirt band, stone, hedges, bookshelves with spines, barrels, a checkerboard kitchen), drifting clouds and petals, one palette per chapter. Every character is a chibi built from ellipses and curves in `js/view/sprites.js` (a crown, a witch hat, a hood, a sprout, horns, an oven glove) with idle bob, hop, lunge, hurt flash and a faint-and-float-away. A dev gallery page renders them all. Music is a scheduled score in Web Audio: a music-box and ukulele arpeggio over four-bar progressions, a gentle waltz at camp, a brisker one in battle with soft percussion, a minor-leaning one for the Dread Lord, and a warm one for the ending. Each speaker has a pitched dialogue blip. All of it is made in code.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, phases (title / intro / battle / outro / ending), the frame loop, input routing, debug hooks |
| `js/sim/data.js` | Terrain, classes, skills, snacks, the six chapters (maps, foes, every line of story) |
| `js/sim/core.js` | Grid, stats, reach (Dijkstra with cost and jump), targeting, damage |
| `js/sim/game.js` | `newGame`, `beginBattle`, `act(G, cmd)`, `step` (paces the AI), turn order, rescues, the Dread Lord, saves |
| `js/sim/ai.js` | One brain for the enemy and the test bot |
| `js/sim/bot.js` | The bot, with a `skill` knob that makes it skip turns |
| `js/view/view.js` | Isometric renderer, an event-playback queue, particles, picking |
| `js/view/sprites.js` | All the characters and portraits |
| `js/play.js` | The battle controller: taps, clicks, keys → `act()`, and the highlighted tiles |
| `js/ui.js` | Screens, the turn strip, the unit card, dialogue, the chapter sheets |
| `js/audio.js`, `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Sound and music, keys and pad, guarded storage, seeded RNG, tuning |

The sim is pure (no DOM, no clock, no `Math.random`), so the bot plays the whole campaign in Node. The view keeps its own picture of each unit and only updates it as each event plays, so hp bars, positions and statuses match the animation while the sim is already ahead. `view.busy` and undrained `G.events` both gate input.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (700+ checks): purity, data (maps are rectangles, every start/foe/guest is walkable and connected, every skill and speaker exists), movement and targeting, damage modifiers, commands and their refusals, statuses and turn order, Pip's fumble rate by Monte Carlo, rescues, the Dread Lord's surrender, saves at five cut points, and the bot playing the whole story on `SEEDS` seeds with per-command invariants. `browsertest.mjs`: the real game on desktop, two touch-only phones, and blocked storage.

## Balance notes

The bot is the enemy's brain, so it plays the same game the player does. Tuned until a perfect bot wins every chapter on every seed with a few faints in chapters 2, 3 and 5, and a sloppy one (skips 40% of turns) mostly stalls in the library. Things the bot found: chapter 2 was unwinnable with the roster of two (five foes), so it has four; the cellar's thornling had been placed on a table; later chapters needed one more crow or scone each to be anything but a walk.

## Open questions / next steps

- A human pass on real devices: the bot is not a person, and the test browser has no speakers (the audio runs, but nobody has listened).
- Facing and back attacks, equipment, and a replayable "Tea Time" camp between chapters would all fit; none is needed for the story as it stands.
- A rotate-the-camera control for hidden units behind tall walls.

## Changelog

### v1.2.1 (2026-10-27)
- Rooftops rebalanced: the enemy was taking about 70% of turns. Crows speed 12 → 10, sprites 10 → 9, one crow fewer.

### v1.2.0 (2026-10-27)
- Defeated monsters drop items 35% of the time; walk onto one to pick it up.

### v1.1.0 (2026-10-27)
- Items (jam, mint, tonic) that students carry, use on themselves or a friend, or hand over; the party takes the opening turns of every chapter; the card's MP bar follows spells.

### v1.0.5 (2026-10-27)
- If the whole party faints while a stranded student is still waiting, she steps in and the battle continues instead of being lost.

### v1.0.4 (2026-10-27)
- Zoom: wheel / trackpad pinch on desktop, two-finger pinch on phones, drag to pan, + - 0 keys, and a reset button while zoomed.

### v1.0.3 (2026-10-27)
- Walls, hedges and tables that hide a character or a lit tile are drawn see-through on a student's turn, and clicks go through them.

### v1.0.2 (2026-10-27)
- Hit flash no longer uses `ctx.filter` (it halved the frame rate while a unit was hit); the shake is a clear horizontal shake in screen pixels.

### v1.0.1 (2026-10-27)
- Other characters turn see-through on a student's turn and clicks go to the floor under them, so bunched-up cells can be targeted.

### v1.0.0 (2026-10-27)
- First release: six chapters, six students, the Dread Lord's surrender, snacks, rescues, saves, a sim bot, and harnesses for desktop and phones.

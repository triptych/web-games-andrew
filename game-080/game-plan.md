# EMBERLEAF — The Lantern Library

**Genre:** Cozy top-down adventure with Metroid-style progression and gentle turn-based battles
**Engine:** Vanilla JS: Canvas 2D for the world and battles, DOM and CSS for every menu, Web Audio for every sound and note. No libraries, no asset files.
**Target:** any screen from a 360 px phone (portrait or landscape) to a desktop monitor; keyboard, gamepad or touch.
**Status:** v1.0.0

---

## Concept

You are Vellumvale's new magical librarian. On your first day the Mayor hands you the key to the Lantern Library and you find it empty: on the night it fell, all twelve of its grimoires flew out of the windows like starlings and scattered over the kingdom, and some of them went a little wild. In the cold hearth of the study lives **Wick**, a fussy, kind fire sprite who can't remember anything from before.

A true librarian can use the magic of any book in their library. So each grimoire you bring home lends you a power that opens more of the world: Metroid-style, most places can't be reached until you hold the right book. You calm the runaway books you meet in gentle squabbles, where nobody is hurt and every foe settles back into a book for your shelves. As the grimoires return to their lecterns the library wakes up lamp by lamp, and Wick starts to remember: she was Marigold Ashby, the librarian before you, and her body lies under a curse in the Undercroft, beneath the Rotunda floor.

Riffs on: *Zelda: Link's Awakening* (a world opened by items), *Metroid* (gating), *Stardew Valley* and *A Short Hike* (tone), *Earthbound* and *Undertale* (battles you win by understanding, not hurting).

## Core loop

Wick points at the next grimoire → walk there through a region you couldn't enter before, meeting people and calming the runaway books that chase you → the dungeon: chests, a key, locks opened with the powers you already have → the guardian, which *is* the grimoire, frightened and wild → calm it and it becomes the book → Wick takes you home → set it on its lectern: a memory, a lamp lights, the library tidies itself → its power opens the next region and secrets in old ones.

Around that: side quests and overdue books, shops and gear, books to reshelve, levels, and just walking about.

## The world

A 9 × 7 grid of zones, each 24 × 16 tiles, one big continuous map of 216 × 112 tiles ([js/sim/data/world.js](js/sim/data/world.js), built by [js/sim/worldgen.js](js/sim/worldgen.js)).

```
         0            1            2            3            4            5            6            7            8
  0  Abbey ‡       Mistmoor     Cinder Ridge  Frostmantle  Rime Summit  Frostmantle  Skyreach    Drifting     Observatory
                   Heights      (Kiln)        West         (Temple)     East         Ruins       Isles        Peak
  1  Mistmoor      Nettle       Mistmoor      Frostmantle  CASTLE       Royal        Skyreach    Windward     Gull's
     Fen           Hollow       Edge          Lodge        AUBADE       Gardens      Steps       Isles        Perch
  2  Whisperwood   Glimmer      Hearthfield   Shepherd's   AUBADE       Aubade       Eastern     Gullwing     Lighthouse
     North         Hollow       Hills         Rise         (town)       Market       Downs       Beach        Point
  3  Hollow Oak    Whisperwood  Hearthfield   Hearthfield  QUILLFORD    Orchard      Fennimore's SALTMERE     Saltmere
     Glade                      Mill                                    Lane         Downs                    Docks
  4  Ranger's      Mossy        Pumpkin       Southfield   LANTERN      Lakeside     Lumen Lake  Reed Isles   Shell
     Clearing      Brook        Patch                      SQUARE ★     Farm         North                    Strand
  5  Thornvale     Briar        Willowbank    Willowbank   Picnic       Lakeside     Lumen Lake  Archive      Tidepools
                   Hollow       West                       Meadow       Meadow                   Isle
  6  Stoneheart    Bramble      Willowbank    MOUSEHOLD    Burrow       Glasshouse   Lumen Lake  Misty        Wreck
     Quarry        End          South                      Gardens      Grounds      South       Shallows     Cove
```

**Zones** are either drawn by hand (the ten town zones: a 22 × 14 picture of letters, one per building) or grown from their biome: a border of the biome's wall (trees, hedges, cliffs, rocks, reefs, a drop into cloud), openings where the connection list says, features stamped first (dungeon entrances, cottages, people, chests, signs, ponds, *pockets*), then wandering paths from every doorway and feature to the zone's middle, then fields, flowers, ponds and clumps of scenery by noise on whatever isn't reserved. A final flood fill carves straight to anything a path missed. Lake zones are water with beaches and islands; coast zones have the sea along their east side.

**Connections** join neighbouring zones: a four-tile gap in the shared border, a whole open edge, or a gap filled with a lock. The river between the meadows and Mousehold is drawn as rapids (never passable), with calm-water gaps that the Frost Psalter freezes, so swimming can't skip it.

**Pockets** are 5 × 5 enclosures with a chest, closed by one lock: the Metroid backtracking that hides most Quilt Patches and Silver Inkwells.

**Interiors and dungeons** are drawn as text ([js/sim/data/maps.js](js/sim/data/maps.js)): the library and 29 other rooms (shops, houses, inns, the throne room, a mill, a lodge, huts); and thirteen dungeons, each with a key chest, a locked door, locks of the powers you already have, foes, chests and a guardian.

## The twelve grimoires

| # | Grimoire | Power (world) | Spell (battle) | Found in | Needs |
|---|---|---|---|---|---|
| 1 | The Lumen Primer | Pitch-dark places are walkable; Glimmer Caves open | Soft Glow: calm one (light) | The Hollow Oak, Whisperwood | — |
| 2 | Zephyr's Almanac | Blow away fog banks | Page Breeze: calm all (wind) | Glimmer Caves | Lumen |
| 3 | The Hearth Lexicon | Burn brambles | Hearthwarm: calm one, strong (fire) | The Cinder Kiln, Mistmoor | Gust |
| 4 | The Lithic Grammar | Roll boulders aside | Steady Stone: poise up 3 turns | Stoneheart Quarry, Thornvale | Ember |
| 5 | The Frost Psalter | Freeze streams into ice | Hush of Snow: calm one, may make it drowsy | The Rime Temple, Frostmantle | Stone |
| 6 | The Tidal Hymnal | Swim deep water | Tidewash: restore composure | Saltmere Lighthouse | Stone |
| 7 | The Diminutive Grammar | Slip through mouse doors | Pocket Spell: shrink a foe | The Great Burrow, Mousehold | Frost |
| 8 | Herbarium Verdant | Grow vines up cliffs | Bloom: composure each turn | The Glasshouse of Verdure | Small |
| 9 | The Echo Codex | Part ghostly gates | Lullaby Echo: calm all (echo) | The Sunken Archive, Lumen Lake | Tide |
| 10 | The Locksmith's Lexicon | Open rune seals | Unbind: calm one, strip its guard | Gloaming Abbey | Echo |
| 11 | The Featherfall Folio | Float over chasms | Featherlight: the next antic misses | The Old Keep, Castle Aubade | Key |
| 12 | The Starlight Atlas | Open the star seal to the Undercroft | Starlit Story: calm all, huge | Skyreach Observatory | Verdant, Feather |

After Stone the path branches (Frost → Small → Verdant, and Tide → Echo → Key → Feather) and joins again at Stars. Locks of two kinds: **clear** locks (fog, brambles, boulders, streams, sprouts, ghost gates, rune seals, the star seal) are faced and opened with Action, and stay open; **pass** locks (deep water, chasms, mouse doors, darkness) can simply be walked through while you hold the book. Each dungeon also has one locked door and the key that opens it.

The star seal opens only when all twelve are home on their lecterns, and leads to the Undercroft, where the Blot waits.

## Squabbles

Foes wander the wild zones and dungeons (towns have none), notice you within a few tiles, and chase a little slower than you walk. Touch one and a squabble begins, with up to two friends once you're past level 2. [js/sim/battle.js](js/sim/battle.js):

- **Your turn:** *Shush* (calm one by your focus against its poise), *Read* (learn its soft spots and resistances; it's then *understood*, +25 % from Shush), a **grimoire spell** (costs ink; light, wind, fire, frost… against each foe's weaknesses ×1.75 and resistances ×0.5), a **treat** (tea, biscuits, cocoa, ink, a story candle to leave), *Tidy up* (guard, +3 ink), or *Slip away* (70 %; never from a guardian).
- **Wick's turn:** a warm crackle at a foe, or, when you're frazzled, fussing over you. Wick's warmth grows with every grimoire restored.
- **Their turn:** antics: flaps, nips, ink splashes that *smudge* (a little composure each turn), dust and scattered pages that *muddle* (Shush weaker), guarding, tidying themselves up, calling friends, and winding up for a big THUMP you can see coming.
- **Calmed:** mischief at zero, the foe settles back into what it was: a common book of its genre (sure at first, then 42 %), sometimes a treat, and coins and wisdom (experience).
- **Overwhelmed:** composure at zero. Wick leads you home to your last bed, restored. Nothing is lost.

Each guardian is its grimoire gone wild (the Flickering Primer, the Howling Almanac … the Dimming Atlas); calming it *is* finding the book. The Blot is every story the kingdom stopped telling, and you calm it by telling it the stars.

**Numbers** ([js/sim/data/enemies.js](js/sim/data/enemies.js), [js/sim/rules.js](js/sim/rules.js)): a foe of tier *t* has 18·t^1.3 mischief, 3 + 4.4t + 0.2t² power, 2 + 2t poise. You have 34 + 6·level composure (+ cardigan, + 5 per Quilt Patch), 8 + 2·level ink (+ 4 per Silver Inkwell), focus 6 + 2.5·level + bookmark, poise 1 + level + cardigan. Damage is power × 25/(25 + poise); Shush is focus × 20/(20 + foe poise).

## Content

- **People:** about 80, each with dialogue that changes with the story ([js/sim/data/npcs.js](js/sim/data/npcs.js)): the Mayor, Dot the postmistress, Pip and Mabel, Bramwell the baker, Queen Isolde and Princess Wren, Sir Percival and Lark the bard, Granny Nettle the moor witch, Brother Cairn (mostly fog with opinions), Mayor Whiskerton of Mousehold, Orrin the hermit, a shivering snowman, a heron that reads.
- **Side quests** ([js/sim/data/quests.js](js/sim/data/quests.js)): Overdue! (eight borrowers), a baker without flour, a lost cat, a letter to Saltmere, a knight's poem, a cold snowman, the Mouse Mayor's cheese, the Queen's moon pearls, glass-flower seeds, a lens for a hermit, the Abbey's silent bell.
- **Shops** (10), **inns** (5) and the library bed. **Gear:** bookmarks (focus), cardigans (poise, composure) and one charm (reading glasses, a lucky acorn, a teacup, a quill pin, a locket, an owl feather, a compass, a music box).
- **Collectibles:** 12 Quilt Patches and 8 Silver Inkwells, mostly behind locks you can't open yet; 48 common books in eight genres, returned at the Returns Cart, a gift for each full shelf.

## Story

1. **Arrival.** The Mayor's welcome and the key. Inside, the library is cold, loose pages everywhere. Wick wakes.
2. **Twelve grimoires**, in roughly the order above. At each lectern Wick remembers something: cocoa and a long desk; the north window left open so the books could breathe; toasting bread on *her* hearth; a ledger in green ink; winter story hour; an apprentice she waited years for; the mice and their tiny library cards; marigolds on a windowsill (six); the night the ink rose out of the Undercroft (nine); her name, Marigold Ashby; the Queen reading under the big table; "come and get me, apprentice, I'll put the kettle on" (twelve).
3. **The Undercroft.** All twelve home, the star seal opens. At the bottom, the Blot: every story Vellumvale stopped telling. Calmed, it becomes the Chronicle of Vellumvale, and Wick becomes Marigold again.
4. **After.** The library is open; Marigold lives in the study and would very much like her teapot back (it's in the Undercroft). The world stays open to finish shelves and quests.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Walk | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Talk, read, open, use a power; next line | Space / Z / Enter | A | A button, or tap the dialogue |
| Menus | Arrows, Enter, Esc | d-pad, A, B | Tap |
| Satchel | I / Tab / X (M for the map) | X (Y for the map) | 🎒 |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

Pixel art at a whole-number scale (about 13 tiles on the short side of the screen), painted in code: tiles that know their neighbours (wall faces, water foam), y-sorted scenery, characters built from parts (4 facings × 3 frames), foes from body plans (books, moths, bats, blobs, serpents, clouds, tortoises, crabs, frogs, ghosts, knights, cranes, a comet cat), buildings fitted to their footprint (a windmill that turns, a lighthouse that sweeps, an observatory), all outlined. A day passes every ten minutes: sunset blush, night with lamp-lit windows and fireflies; caves are dark except for your light and Wick's. Weather per biome: leaves, snow, mist, petals, clouds, library dust motes.

Every area has its own little tune ([js/audio.js](js/audio.js)): a seeded melody over a chord progression, played by a look-ahead scheduler with plucks, music box, flute, bells, pads and a noise-impulse reverb. The library's theme gains a layer as grimoires return. Squabbles, guardians and the Blot have driving themes with soft drums. Every action has a sound: a "shh", chimes for each power, a fanfare for each grimoire, a lullaby for resting, Wick's crackle.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing for world/dialogue/battle/screens, music, autosave, debug hooks |
| `js/sim/game.js` | `newGame`, `step` (walking, doors, locks, foes), `act` (dialogue, battle, shop, items, gear), the dialogue runner, saving |
| `js/sim/battle.js` | Squabbles: turns, spells, antics, statuses, Wick, rewards |
| `js/sim/rules.js` | What a tile is now, what's walkable, stats, items |
| `js/sim/worldgen.js` | Builds every map from data, cached |
| `js/sim/story.js` | Objectives, the intro, Wick, restorations, the ending; the grimoire requirements table |
| `js/sim/nav.js`, `plan.js` | Path finding across every map; the planner over grimoire sets |
| `js/sim/bot.js` | The auto-player |
| `js/sim/data/` | Tiles, grimoires and books, foes, items and shops, the world, interiors and dungeons, people, quests |
| `js/view/` | `view.js` (canvas sizing, events), `world.js` (map drawing, light, weather), `battle.js`, `tiles.js`, `sprites.js`, `buildings.js`, `paint.js` |
| `js/ui.js` | HUD, dialogue box, battle director and menus, satchel, shops, toasts |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound and music, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, that every door and map lines up, proves with the planner that the kingdom can be finished and that each grimoire is needed exactly where the story says, runs every person's script at four points in the story, the rules of every power, determinism and save round trips, and has the bot play the whole game from the title to the ending at two skills. `browsertest.mjs` drives the real game by keys, clicks and real touches on desktop and phones. `tour.mjs` screenshots 36 places.

## Balance notes

- The first bot couldn't win a level-1 fight against two foes: early foes lost a third of their power, groups only start at level 3, and Wick helps from the first squabble.
- With power growing as 0.4·t², the Undercroft overwhelmed the bot three times in a row at level 20; now 0.2·t² and the Undercroft is tier 6.9. The bot is overwhelmed 0–6 times a game.
- The bot reaches each guardian at levels 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18 and 20, and finishes in about 25 game-minutes (it reads nothing, never gets lost, and walks into every foe). A person should take a few hours.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- More side quests for the later regions; a bestiary page in the satchel.

## Changelog

### v1.0.0 (2026-10-15)
- First release: the 63-zone kingdom, 30 interiors and 13 dungeons; twelve grimoires with powers and spells; squabbles; about 80 people, eleven side quests, eight overdue books; ten shops; the library that restores itself; day and night; music and sound; keyboard, gamepad and touch; tests.

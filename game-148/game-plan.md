# Glimmerglade

**Genre:** casual sorting puzzle (ball-sort family) with a cozy fantasy story and a collection
**Engine:** Vanilla JS: Canvas 2D board, DOM screens; art, music, sound and voices generated with ElevenLabs
**Status:** v1.0.1

---

## Concept

The Tumble Wind blew through Grandmother Willow's glade overnight, and every wisp of light (each one the heart-light
of a sleeping magical creature) landed in the wrong glass bell-flower. Lumi, a young lantern fairy, tips the wisps
from blossom to blossom until each holds four of one colour. Then the flower **blooms**, and its creature wakes and
sits on top of it, so a finished level is a row of glowing flowers with nine little friends perched on them.

Light, ethereal and casual: no timer, no fail state, free undo, a hint when you want one, and a story you can tap
through. One level takes one to four minutes, so it fits a bus stop.

### Why this genre (the research)

Sort puzzles grew fastest of the casual puzzle subgenres in 2025–26: by early 2026 they had passed Blast games to
become the third-largest puzzle subgenre by in-app revenue (AppMagic, via Deconstructor of Fun and Mobidictum). Hexa
Sort's appeal is that it is a calm, tidy-up loop; screw and sort games retain best. Puzzle players are the most loyal
mobile audience (Mistplay loyalty index), skew female, and cite stress relief as the main reason to play cozy games.
Narrative and collection meta (merge games with stories, Royal Match's world) retain better than bare puzzles, as
long as the world keeps changing. So Glimmerglade is:

- **a sort puzzle** (the fast-growing, calm core loop), with one-tap input that works one-handed on a phone;
- **a collection** (each colour is a creature; the journal fills; finished boards are full of creatures);
- **a world that changes** (five painted glades, each bringing one new idea, and Willow telling the story);
- **a daily ritual** (the Daily Dewdrop, the same puzzle for everyone that day, with a streak);
- **gentle by design**: free undo, no lives, no timers, no ads, colour-blind symbols on every wisp, a calm-motion setting.

It riffs on ball-sort and water-sort games (the pour rule) and on Royal Match / Gardenscapes (story and collection
around a puzzle). The fairy-garden world, the creatures, the three twists and everything you see and hear are its own.

## Core loop

1. Tap a blossom: its top run of same-coloured wisps lifts and bobs above the rim.
2. Tap another blossom (or drag there): the run flies over in an arc, as many as fit.
3. Four of a colour blooms: petals open, the creature pops up and perches, Lumi cheers.
4. Every wisp home: the creatures hop, stars are counted against Willow's pours, next level.

## Mechanics

All rules live in `js/sim/rules.js` and are tested in `dev/simtest.mjs`.

### Pouring
- A blossom holds 4 wisps (an acorn cup, 2). The **top run** is the wisps of one colour sitting together on top.
- A pour moves the top run of the source into the target if the target is open, not full, and empty or topped with
  the same colour. As many as fit move; the rest stay.
- A blossom that holds four of one colour **blooms** and is sealed for good. A level is won when every wisp is in a
  bloomed blossom.
- A pour that can't happen is a gentle "nope" (a shake and a soft sound), never a penalty.

### Mist (Mushroom Hollow onward)
Wisps under the mist are hidden (`A`–`I` in the sim). The top wisp is always visible; when a pour uncovers a hidden
wisp it is revealed. A run never extends into a hidden wisp, even one of the same colour.

### Brambles (Moonpond onward)
A wrapped blossom can't be poured from or into until `lock` blossoms have bloomed. Its badge counts down. Early
Moonpond levels wrap an empty blossom (extra room later); later ones wrap a mixed one.

### Acorn cups (Crystal Grotto onward)
Hold two wisps, never bloom. Parking space only.

### Help
- **Undo**: free and unlimited, back to the last bloom (a bloom is forever; that also keeps undo cheap to store).
- **Firefly**: three per level. The solver finds a winning line from the current position and the firefly flies the
  first pour. If the position can no longer be won, it says so and costs nothing.
- **Sprout**: once per level, grows one more empty blossom; the level's stars are capped at two.
- **Restart**: back to the start (hints already used stay used). Needs a second tap within 2.5 s.
- **Stuck**: when no pour is legal, a banner suggests undo, sprout or restart and the tools pulse.

### Stars
Par is the solver's winning line, tightened (`tighten()` drops pours that aren't needed). Three stars at or under
par, two up to ⌈1.35 × par⌉ + 2, else one; a sprout caps at two. The solver isn't optimal, so a clever player can
beat par.

## Content

### Chapters (`CHAPTERS` in `js/config.js`, `levelSpec()` in `js/sim/levels.js`)

| # | Glade | Levels | Colours | New idea |
|---|---|---|---|---|
| 1 | Dawnpetal Meadow | 1–10 | 3 → 7 | plain sorting, two empty blossoms |
| 2 | Mushroom Hollow | 11–20 | 4 → 8 | mist, 1–3 deep |
| 3 | Moonpond | 21–30 | 5 → 8 | brambles (an empty one, then mixed ones, then two) |
| 4 | Crystal Grotto | 31–40 | 5 → 9 | acorn cups (one empty blossom + two cups, then two + one) |
| 5 | Starfall Canopy | 41–50 | 6 → 9 | everything mixed |

Daily Dewdrop: `freeSpec(YYYYMMDD)`, 6–8 colours and one random twist. Endless Dreams (after level 10): the same with
a random seed.

### Wisps and creatures (`WISPS`)

| Wisp | Symbol | Creature |
|---|---|---|
| Rose | heart | Petal Fox, a fox kit with a rose-petal tail |
| Gold | sun | Amberwing, a plum-sized baby dragon |
| Mint | leaf | Dewdrop Frog, in a lily-pad hat |
| Sky | cloud | Cloud Hare |
| Lilac | moon | Moonmoth |
| Coral | flame | Ember Newt |
| Teal | wave | Ripple Otter |
| Pearl | star | Starfoal, a unicorn foal |
| Indigo | diamond | Hush Owlet |

Plus **Bramble**, Lumi's hedgehog friend, in the journal from the start.

### Level generation and proof
`buildPuzzle(spec)`: shuffle `colours × 4` wisps into full blossoms (rejecting a blossom that starts sorted or with
three of a kind on top), add mist, brambles, empties and cups, shuffle the order, then **solve** with the game's own
`pour()`. A layout the solver can't finish within 60 000 positions, or one it finishes in fewer than `2 × colours − 1`
pours, is thrown away and the next attempt (seed + a) is tried; after 40 failures the spec gets one more empty blossom.
Deterministic: the same number always gives the same proven level. All 50 build in under 0.1 s.

## Story

Told on story cards (portrait, name, line, voice):
- Each chapter opens with **Grandmother Willow** (an ancient willow tree spirit) explaining what is new.
- Level 1 adds Lumi's promise: "Leave it to me, Grandmother Willow. I'll bring every wisp home!"
- Level 50 ends with Willow's thanks, Lumi's goodnight and the ending painting: the whole glade lit at night, Lumi
  dancing, all ten creatures around her.

Lumi talks during play (captioned): first bloom, a new creature, mist lifting, brambles letting go, a hint, a sprout,
being stuck, "almost there", the win, three stars. One line at a time, at most one every five seconds, each at
most once per level.

## Controls

| Action | Touch / mouse | Keyboard | Gamepad |
|---|---|---|---|
| Lift / pour | tap a blossom, then another; or drag | arrows + Space; digits 1–9, 0 | d-pad + A |
| Undo | Undo tool | Z, U, Backspace | B |
| Firefly | Firefly tool | H | X |
| Sprout | Sprout tool | G | Y |
| Restart | Restart tool (twice) | R (twice) | — |
| Pause | ❚❚ | P, Esc | Start |

## Look and sound

- **Board** (`js/view/view.js`): glass bell-flowers on curling stems with a pool of light beneath, a petal crown
  that opens in the wisp colour when it blooms, wisps baked once per size into glowing sprites with a symbol, mist
  puffs, bramble vines with tiny roses and a count badge, an acorn rim on cups, pours that follow the glass (a
  lifted run slides up the middle of its blossom; a pour rises out of the mouth, arcs over at the height of the
  higher mouth, comes down to just above the target and drops down its middle; anywhere outside the glass that it
  overlaps a blossom it is drawn behind it, so a top-row-to-bottom-row pour passes behind the flowers in between),
  sparkle trails,
  petal bursts, the creature perched on its flower (hopping when the level is won), a hint firefly, drifting motes.
- **Backdrops**: one painted glade per chapter, cross-faded behind the canvas with a slow drift.
- **UI**: frosted-glass sheets and pills (Quicksand, Cinzel Decorative for headings), Lumi floating in the corner on
  wide screens with cheer and think poses, a right-hand tool rail on landscape phones.
- **Sound**: four Eleven Music themes (title, meadow, moonlit, starfall), a win jingle, 13 effects and a dawn
  ambience loop; voices for Lumi and Willow. A Web Audio synth stands in if a file fails.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, taps/drags/keys → commands (one per frame, never while wisps fly), events, progress, debug hooks |
| `js/sim/rules.js` | The pour rule, bloom, reveal, locks, legal and useful moves, the solver and `tighten()` |
| `js/sim/levels.js` | Level specs per chapter, free-play specs, generation and proof |
| `js/sim/game.js` | `newGame`, `act` (pour, undo, hint, sprout, restart), stars, save round trip |
| `js/sim/bot.js` | Perfect bot (solver line) and casual bot (greedy, memory, undo, hints, sprout, restart) |
| `js/view/view.js` | Canvas board, layout in 1–3 rows, flights, effects, hit-testing |
| `js/ui.js` | Screens, HUD and tools, map, journal, win sheet, story cards, captions |
| `js/audio.js` | Generated music, effects, ambience and voices with a synth fallback |
| `js/input.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Keys and gamepad, guarded storage, seeded RNG, tables |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs`: purity, every rule, all 50 levels replayed through `act()`,
determinism and saves, both bots on every level, free-play seeds. `browsertest.mjs`: desktop by real clicks, a drag,
keys and tools; touch-only phones in both orientations; blocked storage; the generated audio decodes and plays.

## Balance notes

- First pass: the casual bot (random pours) needed ~560 pours a level and failed late levels. Making it remember
  positions it had seen and prefer matching pours (as a person does) brought it to ~29 pours for a par of 24.
- Casual bot: about 2 stars a level on average, 2.0 / 2.3 / 1.9 / 1.9 / 2.0 by chapter: the twists keep the
  difficulty flat while the colour count rises, which suits a casual game. The perfect bot 3-stars every level.
- Mist levels need more care than they look: the solver plays with full knowledge, so par on mist levels is a
  little tight for a player who has to uncover first.

## Open questions / next steps

- A human pass on a real phone: haptics, the feel of the lift height, whether hints should refill on a new day.
- More chapters (the generator takes any spec); a gentle "Willow's garden" scene that fills with creatures.

## Changelog

### v1.1.0 (2026-11-26)
- Added: cloud saves. **☁️ Cloud Save** on the title screen and in the menu opens the shared dialog
  ([lib/core/cloud-ui.js](../lib/core/cloud-ui.js)): sign in with an emailed link (one sign-in for every game on the
  site), save this game online and load it on another device. Everything stored under the game's save key goes up
  (settings stay on the device); loading writes it back and restarts the game. It also saves to the cloud by itself
  while signed in. See [docs/generic/cloud-saves.md](../docs/generic/cloud-saves.md).

### v1.0.1 (2026-11-24)
- Wisps no longer fly through the glass: a pour was one curve from slot to slot, so wisps left and entered their
  blossoms diagonally through the walls, and lifting snapped them above the rim. Pours now go up, over and down the
  middles, cross other blossoms behind them, and lifting slides. `browsertest.mjs` audits every possible pour's path
  on desktop and both phone layouts (it finds 376 problems with the old curve).

### v1.0.0 (2026-11-24)
- First release: 50 proven levels in five glades with mist, brambles and acorn cups; undo, fireflies, sprout,
  stars; creature journal; Daily Dewdrop with a streak; Endless Dreams; a voiced story and ending; ElevenLabs art,
  music, effects and voices; sim and browser harnesses.

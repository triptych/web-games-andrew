# Hemlock Hollow

**Genre:** Gothic mystery text adventure (Sierra On-Line style: typed parser, one picture per room)
**Engine:** Vanilla JS: Canvas 2D (a 320×136 one-bit picture), DOM text, Web Audio, no asset files
**Status:** v1.0.0

---

## Concept

You are Elspeth Thorne, a hedge witch's apprentice. One night something breaks down the cottage door, and your mentor, Old Marga Thistle, is gone. A note, a brass crow button on the floor and a trail of cart-ruts lead you to a second apprentice, Bryony Wick, whose own mistress has also been taken. Together you learn herbs, healing and a handful of spells, and uncover the truth: Governor Aldous Cray, with Dr. Cordelia Vesper of the Cray Infirmary and the apothecary Master Pell, has been kidnapping every hedge witch and healer in the county and forcing them to brew the Governor's "Tonic No. 9" in the old salt mines under Gallows Hill. When the Healing Edict takes effect on the Hollow Moon, every farmer and townsman will have to pay the Infirmary and the Governor's shop for every cure. As your craft grows you gather proof, break into the Infirmary, walk the forgotten Salt Road and free the captives before midnight.

The look is black and white and nothing else: a dithered one-bit picture at the top (a witch's-eye view in the manner of King's Quest and Gabriel Knight, with a hand-made blackletter-and-candlelight page below it), a typed parser for the purist, and tap shortcuts for a phone. The tone is gothic and suspenseful, with a dry Sierra narrator and a good number of absurd deaths.

## Core loop

Look, take, talk, brew, cast, hide, repeat. Each chapter is a small region with one or two puzzles whose answers are herb-craft, magic, or knowing when the boots will come round.

## Mechanics

### The parser
`js/sim/parser.js` turns a typed line into a verb and up to two noun phrases ("use salve on bryony", "ask moll about marga", "pour draught in flask", "brew yarrow and plantain"). Synonyms and particles are normalised ("pick up", "look at", "put on"). `js/sim/game.js` resolves nouns against what is in reach (inventory, satchel stock, scenery, plants, people, exits), preferring the right kind for the verb, and asks "Which do you mean?" on a tie. In the dark you can only reach what you carry.

### Herbs and brewing
Plants are picked into the satchel (`STOCK`, in `data/lore.js`). SMELL and STUDY (with Marga's Herbal) teach what a plant does; TASTE is for the foolish (nightshade and hemlock kill). BREW with the kettle by recipe name or by naming the herbs: experimenting finds the recipes you were not told (sleeping draught, fever tea, eyewash, waking tea). Eight recipes: salve, sleeping draught, fever tea, eyewash, waking tea, unbinding tincture, monkshood antidote, and black dew (poison, which only ever gets you killed).

### Spells and ember
Five spells, each learned from a person: Kindle (start), Loosen (Bryony), Sight (the ghost of Mother Gammer), Veil (Sexton Moll, for a sprig of mugwort), Unbind (Marga's torn pages, found in Vesper's desk). Ember is the cost: max = 2 + craft level; REST restores two. Spells cast in public add a little dread.

### Dread, patrols and hiding
Dread (0-100) rises when you are noticed and falls while you are somewhere safe. At 100 the Crows take you. Dangerous rooms have a patrol that arrives every N moves; a line warns you one move before ("Hobnailed boots on the cobbles"), and HIDE (in a room that has a place) or a Veil makes you invisible to it. A nurse's apron and cap fool the orderlies in the Infirmary hall and ward, but not the dispensary's night man.

### The clock
When you step into the Brine Vaults a 90-move clock starts: the wagons come at midnight. Breaking the ward-stone cuts it to 14. Anyone you have not freed is carried off; if the wagons find you inside the Vaults you are taken too.

### Evidence and endings
Five pieces of proof: the tonic seen with Sight, the delivery slip in Pell's storeroom, Mr. Alder's chart, the Acquisitions Ledger page, the Governor's letter. Four captives (Marga, Granny Dunmore, Widow Harrow, the Pennywhistle sisters), each needing a different cure. Three endings: **Dawn Over Ashwick** (all freed, four pieces of proof or more), **Ash and Salt** (two freed, three proofs), **The Long Winter** (anything less).

## Story: chapters

| | Chapter | Where | What happens |
|---|---|---|---|
| I | The Empty Cottage | Marga's cottage, stillroom, garden | The note, the button, the hearth purse, the Herbal; Kindle; the first salve |
| II | The Road to Foxglove | Lane, Whisperwood, crossroads, the Mill, the Hanged Oak | Bryony's password and her wound; Loosen; the ghost of Gammer and Sight; herbs |
| III | The Town of Ashwick | Gate, square, inn, Pell's, Tanner's Row, St. Agnes's | A sleeping draught for Dray's flask; the tonic; Tobias's fever; the uniform; Moll and Veil |
| IV | The Cray Infirmary | Hall, ward, dispensary, office, cellar | Patrols; chart, ledger, letter; the Wintergreen pages (Unbind); the iron key |
| V | The Salt Road | Tunnel, crypt | The trapped vault door: Sight, the brass crow button, or the antidote |
| VI | Under Gallows Hill | Vaults, cells, Works | The clock; four cures; Veil, Vesper's tea; the ward-stone; the flight; the bell |

Twist: Vesper was Marga's first apprentice ("a cure ought to cost something"). The brass crow button from chapter I is what jams the trap in chapter V.

## Controls

Type commands in the box and press Enter (Up recalls). The ☰ button by the box shows tap shortcuts: pick a verb, then a thing; exits are single taps. Esc pauses. HELP, HINT, SAVE, RESTORE, RESTART and QUIT work as commands. Gamepad is not supported (a text game).

## Look and sound

One-bit black and white. Every picture is drawn at 320×136 from polygons, arcs and four-by-four Bayer dither patterns, then thresholded to pure black and white so canvas's anti-aliasing cannot leak a grey. Scenes animate (flames, stars, fog, water, a ghost); the black creeps in at the edges as dread rises and eyes open in it above 60. Rooms change with a dither dissolve. The page is blackletter titles (UnifrakturCook, with a system fallback), IM Fell English body text, a typewriter transcript, double-ruled frames.
Sound is Web Audio: a wind-and-drone bed, a sparse music-box figure in A harmonic minor, bells, a heartbeat that quickens with dread, and cues for spells, clues, patrols and the death sting.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, play, dead, over), command routing, event handling, debug hooks |
| `js/sim/game.js` | newGame, act (verbs, scope, brewing, casting, movement, time, patrols), serialize |
| `js/sim/story.js` | Every puzzle as a rule, chapters, timers, the clock, the three endings |
| `js/sim/parser.js` | Sentence to verb and nouns |
| `js/sim/core.js` | Shared helpers (say, flags, points, kill, moveTo) |
| `js/sim/data/` | rooms, items, npcs (with dialogue), lore (herbs, recipes, spells), objectives (hints) |
| `js/sim/bot.js` | The walkthrough bot |
| `js/view/art.js`, `view.js` | The one-bit pictures and the pane that shows them |
| `js/ui.js`, `audio.js`, `save.js`, `config.js`, `rng.js` | DOM layer and chips, sound, guarded storage, constants, seeded RNG |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` has the bot play the whole game and checks each puzzle, every death and the endings; `browsertest.mjs` drives the real game on desktop, two touch-only phones and with storage blocked.

## Balance notes

The bot, a careful player, wins in about 160 moves with dread never above 12, and has 9 moves of the vault clock to spare after the stone breaks (it needs 4). A player who never hides dies of dread in the Infirmary. Ember is tight in chapter V: the walkthrough rests in the tunnel to refill it before entering the Vaults, because Veil (2) and Unbind (3) must both be cast inside the clock.

## Open questions / next steps

- A human pass: the prose, the difficulty of the herb experiments, and the patrol timings are tuned by a bot, not a person.
- Nobody has listened to the audio.
- Scenes are drawn from primitives and are hand-judged; a few (the ward, the chapel pews) are plainer than the rest.

## Changelog

### v1.0.0 (2026-10-27)
- First release: 26 rooms, 6 chapters, 16 characters, 8 recipes, 5 spells, 5 pieces of evidence, 3 endings, a typed parser with tap shortcuts, one-bit pictures, procedural sound, saves with checkpoints.

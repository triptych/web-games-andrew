# SOLITAIRE FROM OUTER SPACE

**Genre:** Solitaire roguelike deckbuilder (TriPeaks meets a branching-path deckbuilder)
**Engine:** Vanilla JS: Canvas 2D for the table and the map, DOM for menus and panels, no libraries, no asset files
**Status:** v1.0.0

---

## Concept

A TriPeaks solitaire roguelike deckbuilder told as a 1950s B-movie in three reels. Something fell out of the sky over Gila Flats, Nevada, and the visitors have one law: a planet is won or lost at the card table. You are the Professor. Every creature deals its own table of cards; your deck is the stock. Chain cards one rank up or down onto **the beam** to blast giant ants, tin troopers, brains in jars and the Overlord himself.

Minute to minute it is solitaire: read the table, find the longest run, decide when to spend a draw. Run to run it is a deckbuilder: the cards you add to your stock decide which ranks you can chain from, and what fires when they land. The tone is drive-in sci-fi: theremin music, film grain, poster colours, monsters with googly eyes.

It riffs on TriPeaks solitaire for the table and on branching-path roguelike deckbuilders for the intents, the map, rewards, shops and relics. Everything (the names, the art, the music) is original.

## Core loop

1. **Reel card.** Each of the three reels opens with a title card and a short story beat.
2. **The map.** Seven rows of stops plus a boss, built from non-crossing walks. Pick a road up: fights, elites (☢), the diner, the Army Surplus store, strange broadcasts, treasure (always on row 4), and the diner again just before the boss.
3. **A fight.** Turn by turn until the creature or you hit 0 HP.
4. **Rewards.** Bucks, a choice of three cards (or none), sometimes a gadget; elites add a souvenir; bosses offer a choice of two.
5. Beat the third boss to win. HP carries between fights; between reels you heal 60% of what is missing.

## Mechanics

### The table (TriPeaks)
- A layout from [data.js](js/sim/data.js) `LAYOUTS` (peaks, saucer, rocket, towers, diamond, pyramid), dealt from a shuffled 52-card alien deck. Positions are rows of half-card columns; a card is **covered** while any card in the row below sits within one half-column of it. Covered cards lie face down; a card turns face up the moment nothing covers it.
- A face-up card **fits** when its rank is one above or below the beam's (K and A wrap round). Playing it puts it on the beam.
- **Clean Sweep:** clearing the table deals 10 damage (20 with the Moon Rock) and deals a fresh table.

### The four suits and the chain
The chain `c` counts every table card played this turn (plus any Chain Reaction or Fuzzy Dice bonus). A table card does what its suit does:

| Suit | Effect |
|---|---|
| Ray | 2 + c damage (soaked by the creature's shield) |
| Rocket | 1 + c damage that ignores shields |
| Shield | 2 + c block |
| Atom | +1 charge, +2 from the 4th card of a chain on (charge caps at 9) |

### A turn
- The turn starts by turning the top of your stock onto the beam for free; its effect fires.
- Then you have **2 draws** (`DRAWS_PER_TURN`). A drawn card covers the beam and fires its effect. **Quick** cards give the draw back.
- **End Turn**: the creature makes the move on its badge, frozen cards thaw, the creature's block resets before its move, your block resets at the start of your next turn.
- When the stock runs out, the discard is reshuffled. Junk the creatures jam into your stock burns up when covered.

### Your cards (the stock)
Starting deck: eight plain cards across the ranks, a Death Ray (7) and a Force Field (J). Every special card has a fixed rank, so adding one changes which ranks you can chain from. Upgrades (at the diner) raise the numbers; a plain card upgraded becomes Quick.

| Card | Rank | Effect (upgraded) |
|---|---|---|
| Death Ray | 7 | 6 damage (10) |
| Force Field | J | 7 block (11) |
| Atomic Pile | 5 | +2 charge (+3) |
| Jet Boots | 9 | Quick, 3 block (7) |
| Space Ration | 2 | heal 3 (6) |
| Reflector | 8 | 5 block and 5 damage (8 / 8) |
| Wild Card | ★ | anything fits on it (and +1 charge) |
| Meteor Shower | K | 3 damage × 3 (× 5) |
| Ray Booster | 4 | Rays and Rockets +2 this turn (+3, Quick) |
| Chain Reaction | 6 | the chain jumps by 2 (4) |
| Radar Dish | 3 | Quick, X-ray the table (and +1 charge) |
| Rocket Fuel | Q | Quick, +1 charge (+2) |
| Hypno-Spiral | 10 | Daze the creature 2 turns (3, Quick) |
| Shrink Ray | A | creature −2 strength, 4 damage (−3, 7) |
| Flying Saucer | ★ | wild, Quick, 6 damage (10) |
| Martian Static (junk) | — | nothing fits on it |
| Space Slime (junk) | random | you take 3 damage |

### Gadgets (charge)
Three slots; a fourth must swap one out. Ray Pistol (3: 8 damage), Wild Beam (2: the beam card turns wild), Force Bubble (2: 9 block), Disintegrator (2: vaporize a face-up card, uncovering what is under it), Jetpack (1: a free draw), Freeze Ray (5: the creature skips a move), X-Ray Specs (1: see face-down cards), Hypno Gun (2: Daze 2 turns), Heat Lamp (1: thaw, 3 block), Atomic Bomb (7: 26 damage).

### Creatures
Moves cycle in order from a random start (bosses start at the top): attack (× hits), attack + shield, shield, grow (+strength, maybe shield), jam (Static or Slime into your stock), freeze (face-up cards can't be played until the creature's next move), drain (heals what gets through), wind up. Strength adds to every hit; Dazed takes a quarter off. HP and hits scale by reel and tier (`SCALE` in [config.js](js/config.js)).

### Souvenirs (relics)
Lucky Rabbit's Foot (starter: 2 charge at the start of a fight), Lead Apron, Ruby Ray Lens, Rocket Fins, Tin Shield, Jukebox, Slide Rule, Piggy Bank, Atomic Wristwatch, Tin Foil Hat, Moon Rock, Pocket Robot, Sheriff's Badge, Saucer Shard; boss souvenirs Golden Theremin, Atomic Coffee, Fuzzy Dice.

## Content

| Reel | Place | Fights | Elites | Boss |
|---|---|---|---|---|
| 1 IT CAME FROM GILA FLATS | Gila Flats, Nevada, 1957 | Giant Ant, Tin Trooper, The Little Blob, Saucer Scout | Atomic Scorpion, Robot Man | The Colossal Gila |
| 2 ROCKET TO TRANQUILITY | Tranquility Moon Base, 1959 | Crater Crab, Lunar Moth, Brain Leech, Space Ape | The Cyclops, Robo-Sentinel | The Brain from Planet X |
| 3 THE MOTHERSHIP | The Mothership, 1961 | Saucer Man, Tentacle Horror, Ray Gunner, Martian Soldier | The Queen of Venus, The Robot King | The Overlord |

Strange broadcasts: the Mad Scientist's Lab, a Double Feature at the Drive-In, the Crashed Saucer, the Army Recruiter, Teenagers at Lookout Point, the Fortune Machine, a Voice on the Radio. A broadcast can hurt you but never kills.

## Story

Three reels with an intro card each and an outro line on the next: the Gila's belly holds a beacon pointed at the Moon; the Brain's jar holds a star chart; the star is the Mothership; the Overlord folds and the radio plays the hit parade again. THE END... OR IS IT? The run ends at the third boss; there is no endless mode.

## Controls

| Action | Keyboard | Gamepad | Touch / mouse |
|---|---|---|---|
| Play a card, use a gadget, pick a stop | ← → ↑ ↓ to move the cursor, Enter / Space | d-pad, A | tap / click it |
| Draw (End Turn when out of draws) | D | B | the stock or the DRAW button |
| End Turn | E | X | the END TURN button |
| Gadgets | 1 2 3 | — | tap |
| Pause | P / Esc | Start | ❚❚ |

Panels (rewards, store, diner, broadcasts) are real buttons: Tab or the arrows move focus, Enter or Space presses.

## Look and sound

- **Look:** a 1950s poster palette (teal, atomic orange, cream, red on deep purple), Bungee for headings and Space Mono for numbers (system fallbacks). Everything is drawn in code ([art.js](js/view/art.js)): cards with four suit glyphs, a teal saucer card back, 21 creatures from fifteen drawers of ellipses and polygons with a fat ink outline and googly eyes, three backdrops (a desert at dusk with mesas, saguaros and a drive-in screen; the Moon with Earth in the sky and a dome base; the Mothership's riveted interior with a porthole), map icons. Film grain, gentle exposure wobble and rare scratches over everything ("Calm" and "Off" in Settings; reduced motion calms it).
- **Sound:** Web Audio only ([audio.js](js/audio.js)). A theremin (sine plus a little triangle, with vibrato, gliding between notes) over an organ pad, a walking bass and, in fights, bongos; four tunes (title, map, fight, boss). Effects for every event: a chain blip that climbs a pentatonic scale, ray zaps, rocket booms, shield hums, Static hiss, freeze glissandos, a sweep arpeggio, fanfares.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, routing taps, keys and panel clicks into commands, feeding events to the view, debug hooks |
| `js/sim/game.js` | `newGame`, `act(G, cmd)`, `step`, `score`, `serialize`/`deserialize` |
| `js/sim/battle.js` | The table, the beam, chains, draws, gadgets, the creature's turn; `emit()` puts a HUD snapshot on every event |
| `js/sim/run.js` | Maps, travel, rewards, the store, the diner, broadcasts, deck picks, reels |
| `js/sim/data.js` | Every table: suits, layouts, cards, gadgets, souvenirs, creatures, reels, broadcasts |
| `js/sim/text.js` | Descriptions made from the same numbers the rules use |
| `js/sim/bot.js` | The auto-player: a chain planner that sees only face-up cards, gadget rules, map and shop choices |
| `js/view/view.js` | Plays events back one at a time with its own picture of the table; the battle, the map, the title; hit test and keyboard cursor |
| `js/view/art.js` | Every drawing |
| `js/ui.js` | DOM screens, HUD, phase panels, the deck viewer, toasts |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Key queue and gamepad, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the data tables, every rule (beam, cover, suits, chain, draws, Quick, every creature move, Static and Slime, freeze, sweeps, gadgets, winning and losing), maps over 300 seeds × 3 reels, the store, the diner, every broadcast option, reel changes, determinism and save round trips, and has the bot play whole runs at two skill levels. `browsertest.mjs` drives the real game on desktop (mouse and real keys), on touch-only phones in both orientations and with storage blocked.

## Balance notes

- The first version ended your turn on every draw. The bot played **1.5 cards a turn** and lost every run: a single beam card rarely chains far in TriPeaks (with seven cards showing, about a third of beam cards fit nothing). A turn is now a free beam card plus two draws, with the chain counting every table card of the turn, which gives the bot about four plays a turn in reel 1.
- Jammed junk used to go to the discard and pile up for the rest of the fight; with two Static a turn the Brain from Planet X made fights unwinnable (1.4 plays a turn). Junk now burns up when it is covered.
- Then hallway fights were trivial (2 HP lost) and runs snowballed after reel 1. Creatures now scale by reel and tier (`SCALE`).
- With 60 seeds: the careful bot wins **47%**, the careless one (30–40% random plays, skipped gadgets, wandering map choices) **23%**. Runs end at bosses most often: the Colossal Gila is the careless bot's wall (20 of 46 losses), the Brain from Planet X the careful bot's. HP lost per hallway fight: about 4–6 (careful) and 5–11 (careless); per boss 13–26.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and it has only run in headless Chromium.
- A harder mode (ascension-style) and more creatures per reel; card removal at the diner as a third choice.
- Nobody has listened to the theremin score on real speakers yet.

## Changelog

### v1.0.0 (2026-11-04)
- First release: TriPeaks tables in six layouts, four suits with a turn-long chain, Clean Sweeps, a free beam card plus two draws a turn, 17 stock cards with upgrades, 10 gadgets, 17 souvenirs, 21 creatures (four fights, two elites and a boss per reel) with telegraphed moves, three reels of branching maps with the store, the diner, seven broadcasts and treasure; theremin music, film grain, keyboard, gamepad and touch; a bot that plays whole runs, and sim and browser tests.

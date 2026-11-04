# Hearthwick

**Genre:** cozy town builder with idle progress and a hero economy
**Engine:** three.js r165, no asset files (every sprite, tile, sound and tune is made in code)
**Status:** v1.0.0

---

## Concept

You start with one small hut, one neighbour and a lot of trees. Tap the trees and boulders to gather
wood and stone, build a Woodshed, give villagers jobs, and follow the **Town Journal** from one
chapter to the next: every finished entry pays out, and with enough Renown it lets you upgrade the
Hall, which opens more buildings and more land. Build a Tavern and an Adventurers' Lodge, hire
**heroes**, and let them go on quests for you. There is no combat on screen: heroes come home
hungry, tired and a bit hurt, eat at your Tavern, sleep at your Inn and spend what they earned at your
Item Shop, which you stock with gear you crafted. Raiders come at dusk now and then, and the heroes
at home defend the town. The whole thing is idle-friendly: buildings, crafters and heroes keep working
while you are away, and when you come back a "welcome back" sheet says what the town got up to.

Tone: warm, small, a little wry. It riffs on Stardew Valley's pace, Dragon Quest Builders' town
growth, Recettear's hero-and-shop loop and Kingdom Rush's heroes who run themselves.

## Core loop

1. **Gather** by hand (tap trees, boulders, bushes) until a Woodshed and a Stone Yard do it for you.
2. **Staff** buildings: each has worker slots; a villager's skill and trait set how fast they work.
3. **Craft and cook**: crafters make goods from a queue or a stock target ("keep 20 planks").
4. **Heroes** quest on auto (or you send parties), earn gold and loot, spend gold in your town.
5. **Claim** journal rewards and Renown, **upgrade** the Hall, repeat with a bigger town.
6. End: the Dragon's Roost quest (Hall 6, Lodge 5, two Harvest Feasts, four geared heroes). After it,
   the game carries on as a sandbox.

## Mechanics

### Time and seasons
A day is 240 s at 1×; the sim runs at 10 steps a second and every system copes with a much longer step.
Dawn is 06:00. Work goes at 35% at night (65% with *Lantern Shifts*). A season is 6 days; the last day
is a festival (tavern prices ×1.5, heroes cheer up, +2 Renown). Weather (clear, rain, snow) is rolled
at dawn and nudges farms and fishing.

### Land
A 40×28 map with a river on the east side (one bridge). Owned land grows with the Hall: 16×12 tiles at
level 1 up to 38×27 at level 6. Wild forest and boulders outside it; a building placed on trees clears
them (and pays 2 wood each). The Dock must touch the river.

### Buildings
32 types in `js/sim/data/buildings.js`. A type unlocks at a Hall level and level *L* of it needs Hall
level `unlock + L - 1`. Costs come from a table by the Hall level a level needs; a building's first
level is priced from the tier below so it never asks for a material only its own tier can make
(`simtest.mjs` proves there are no such loops). Construction takes time; the number of builders is set
by the Hall (1 to 3, +1 from the *Builders' Guild*). Gatherers produce per worker; crafters run a queue
and standing "keep N" targets, picking the recipe furthest below its target; services (Tavern, Inn,
Item Shop, Market, Healer, Guild, Stables, Watchtower) are what heroes and the town use.

### Townsfolk
Newcomers arrive at the gate at a rate set by housing room and *coziness* (flower beds, lanterns,
benches, wells, fountains, taverns, etc.). Each has skills (13 kinds, levels 1–10 that grow with work)
and a trait (hardy, nimble, cheerful, studious, night owl, lucky, gentle, strong). Six **special**
townspeople arrive from journal rewards and bring a town-wide perk (Brenna's potions, Thorne's forge
speed, Pip's prices, Tuck's mood, Orla's Lore, Fenn's fish).

### Heroes
Five classes (warrior, archer, mage, rogue, cleric), four qualities, nine traits. A hero is a small
state machine: they eat (tavern dish, or berries, or free gruel so no one starves for good), sleep (inn
bed, or by the hearth), heal (chapel, inn, hearth), shop (buy better gear and carry up to two potions)
and quest. Needs come first: hungry below 45, hurt below 55%, tired below 32 (or in the evening). They
keep 70% of quest gold (traits move that) and the rest is the town's; what they spend at your Tavern,
Inn, Chapel and Shop comes back to you. No hero ever dies: a failed quest hurts and costs a rest.

### Quests
Seven regions (Woods, Quarry, Marsh, Caves, Ruins, Frostpeak, the Dragon's Roost), 27 job templates
(gather, hunt, escort, explore, delivery, boss). Each morning the board is refilled. A party's power
(attack + 0.8 defense + 0.12 hp + 0.3 luck, scaled by mood, hunger, energy, health, buffs and gear)
against the job's need gives the odds: `(power/need − 0.5)/0.7`, plus potions. Win, scrape through
(half the loot) or fail (hurt, nothing). Heroes on **auto** take the richest job their idle party can
do at 62% or better.

### Crafting, cooking, gear
76 items and 57 recipes. Goods → materials (planks, flour, cloth, ingots, steel) → dishes (13, from ale to
the Harvest Feast, some with buffs) → potions (4) → gear: a five-tier ladder of weapons by class, armor
and charms. Gear needs a hero level. The Item Shop sells what is on its shelves, at a price you set;
heroes buy gear they can wear and are not yet wearing something as good.

### Upgrades
34 town upgrades in four branches (gathering, crafting, heroes, town), bought with gold, goods and
Lore. They include *Time-Keeper's Clock* and *Silver Lining*, which stretch offline progress.

### Raids
From day 5, every 4–6 days: scouts warn at dawn, the raid arrives at dusk. Defense is the heroes at
home (sleeping ones count less), watchtowers, townsfolk and *Night Watch* against `14 + 2.3·(day−4)^1.1`.
Win: loot, Renown, hero XP. Lose: a slice of gold and a few raw goods (half as much if you were away).

### Idle and offline
`offline(G, secondsAway)` caps the time away (6 h, more with upgrades), scales it by an efficiency
(25%, more with upgrades) and **really simulates** that much time in coarse steps, so heroes eat,
sleep, quest and get raided exactly as they would online. It returns a summary for the welcome-back
sheet. Crafters keep their stock targets, newcomers are welcomed automatically, and storage caps are
what stop a long absence from being infinite, which is why Storehouses matter.

## Content

See the data tables: [items](js/sim/data/items.js), [buildings](js/sim/data/buildings.js),
[people](js/sim/data/people.js), [quests](js/sim/data/quests.js), [upgrades](js/sim/data/upgrades.js),
[journal](js/sim/data/journal.js) (51 entries in 6 chapters).

## Story

Six chapters: *A Small Beginning*, *Neighbours*, *Hands and Hammers*, *Forge and Fortune*, *Renown*,
*The Dragon's Roost*. The ending: you send four heroes and a Harvest Feast up the mountain, and the
dragon sits down. After the ending the town is a sandbox.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Look around | Drag, WASD / arrows | Left stick | One finger drag |
| Zoom | Wheel, + − | | Pinch |
| Gather / select | Click | A | Tap |
| Panels | B T H Q J U I | | The dock |
| Pause | Space (or ☰ / Esc) | Start | ☰ |
| Speed | 1 2 3 | LB RB | The ▶ button |
| Place a building | Click, Enter | | Drag the ghost, tap ✔ |

## Look and sound

A perspective camera at 50° looks down on a painted ground (grass, flowers, roads, a river with
ripples). Buildings, trees and boulders are **painted in code** as sprites that lean 30° to face the
camera; people are **pixel art** drawn pixel by pixel with an ink outline, in front of painted
scenery: the HD-2D mix. The light follows the clock (dawn pink, noon white, dusk orange, night blue),
windows, forges and lanterns glow at night through an emissive layer and bloom, and the frame gets a
tilt-shift blur and a vignette. Rain, snow, falling chips, smoke and fireflies are small effects. The
music is a generated music-box melody over a slow chord loop that slows and drops at night; birds by
day, crickets at night, rain when it rains. All of it is Web Audio.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the fixed-step loop, speed, input routing, saves, away-time, debug hooks |
| `js/sim/` | Pure simulation: no DOM, renderer, `Math.random` or clock. `game.js` (`newGame`, `step`, save, `offline`), `commands.js` (`act`), `world.js`, `production.js`, `townsfolk.js`, `heroes.js`, `quests.js`, `events.js`, `journal.js`, `bot.js`, `data/*` |
| `js/view/` | Reads the sim and answers its events: `stage.js` (camera, light, post), `terrain.js`, `town.js`, `fx.js`, `nav.js`, `buildings.js`, `chars.js`, `nature.js`, `view.js` |
| `js/ui.js`, `js/panels.js` | DOM screens, HUD, the working sheet (morphed in place), placing buildings |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Pointer/keys/pad, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, data integrity, the rules,
determinism, saves, offline progress and has a bot play whole campaigns to the dragon.
`browsertest.mjs` drives the real game on desktop, two touch-only phones and with storage blocked.

## Balance notes

The bot (a competent, not perfect, player) reaches Hall 2 in about a minute, Hall 3 around day 3,
Hall 4 around day 10, Hall 5 around day 30, Hall 6 around day 70 and the dragon around day 75–120:
roughly five to eight hours at 1×. Things the bot found: a villager shortage at crafters (fixed with a
smarter auto-assign that fills every busy station before doubling up gatherers), a circular cost (the
Smithy's second level asked for steel that only it can make), recipes that starved each other (the
tavern's last recipe never ran: now the one furthest below target goes first), heroes who could not
afford gear (quest gold share 60% → 70%) and an unreachable boss (a hero's kit must be bought *or*
given). The bot also hoards: heroes need to be given their gear when they cannot pay.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- Pacing is tuned by a bot; a person will play slower early and faster later (they will use the merchant and market better).
- The Garden preview is a screenshot of one moment.

## Changelog

### v1.0.0 (2026-11-04)
- First release: the town, 32 buildings, townsfolk with skills, five hero classes, quests in seven
  regions, crafting, cooking, gear, shops, raids, seasons, upgrades, the journal and ending, offline
  progress, three.js HD-2D look, touch/keyboard/gamepad, tests and a bot.

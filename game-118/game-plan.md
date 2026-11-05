# The Kids Table

**Genre:** Hybrid merge puzzle: a persistent merge board with generators, guest orders and a five-course goal plan
**Engine:** three.js r165, no asset files (models, portraits, icons and sound are all made in code)
**Status:** v1.0.0 complete, balanced by a bot, not yet played by people on real hardware

---

## Concept

Thanksgiving, and you are at the kids' table. Grandma says the big table is full this year. You build your way
to a seat at it by merging pumpkins into pies, eggs into a roast turkey, wheat into a horn of plenty and crayons
into a thankful tree, serving the guests who come by with orders, and finishing the five courses of the Dinner Plan.

It follows the design in the merge-games primer this was built from (*How Do Merge Games Work*): a **hybrid
progression** merge game, which the primer describes as "merging feeds external objectives" (quests, unlocks),
with **pair merge** (2 → 1) and an **idle** element (generators earn charges back while you are away). The board
is not decoration; it is pressure.

## Core loop

The primer's six steps, as they are in this game:

1. **Generate**: tap a generator (the Pumpkin Patch, Turkey Coop, Wheat Barrel, Craft Box). Each holds 8 charges and
   earns one back every 12 seconds, on the board and while the game is closed (up to 3 hours).
2. **Combine**: drag two identical items of one chain and tier together, or tap one and then the other.
3. **Receive a higher-tier item**: six tiers per chain, so the top item is worth 32 base items.
4. **Spend it on goals**: serve a guest's order, or make the item a goal of the Dinner Plan asks for.
5. **Progress**: coins, stars, bigger tables with new generators, the next course.
6. **Loop**: a new guest sits down three and a half seconds after you serve one.

## Mechanics

### The board and the tables
A 6 × 7 board. The **Kids Table** is the 4 × 5 middle of it; the rest is covered (padlocked). Stars buy the next
table: the **Card Table** (3 stars, 6 × 5, brings the Turkey Coop), the **Dining Table** (6 stars, 6 × 6, brings the
Wheat Barrel) and **the Head of the Table** (10 stars, the whole 6 × 7). A newly opened table is the primer's
"unlock more space".

### Merging (`act` → `move`)
Dropping an item on an empty cell moves it. On an identical item (same chain, same tier, below tier 6) it
merges into the next tier **where it was dropped**. On anything else the two swap places. A top-tier item never
merges (it is for serving, or for a goal). Generators can be moved and swapped like anything else, which is the
primer's **Generator Zoning**: put them where their output is easy to reach.

### Generators (`tap`)
A tap spends a charge and puts a tier 1 item (15% of the time tier 2) on the free cell **nearest** the generator,
with a hop. No free cell, or no charge, and nothing happens (the generator shakes and a toast says why).

### Guests and orders (`serve`)
Three guests sit at a time, each wanting one or two dishes (sometimes two of a cheap one). The reward is
`0.45 × the base-item cost + 3` coins and 1 star for a cost of 8 or more (a tier 4 dish), 2 for 32. Orders only ever
name chains whose generator you have, and only tiers the current table can reasonably make
(top tier 4, 5, 6, 6 by table). Tap a ready card (it glows) and the dishes are found and taken for you, or drag a
dish onto a card. Tapping a card that is not ready says what the guest said and what is missing.

### The Dinner Plan (goals)
Five courses of three goals each (make an item, serve N guests, merge N times, reach a table). Each course pays
coins and stars, and finishing all five **wins the game**: the ending sheet opens and play goes on endlessly
("Seconds, please!"). Goals count progress that is already made, so a dish a guest asked for may complete a goal.

### Coins and the shop
Coins come from merges (small, by tier), from guests, from composting a good item, from courses and from
combos (three merges within 2.5 s earn +1, five +2). They buy a **refill** of every generator (6 coins per missing
charge, at least 30: the primer's "Boost Window" idea, a way to spend what you have saved on a burst of merging)
and a **mystery basket** (15 coins: a tier 2 or 3 item of a chain you have).

### Board lock and orphans
`boardLocked(G)` is a full board with no merge available. It raises a `locked` event (a toast) and the way out is
always the **compost bin**, which is a drop target on the dock. The view also hints (a pulsing ring on the best merge,
or on a generator with charges) when you have been still for seven seconds.

## The primer's strategies, and where each lives

| Strategy (from the primer) | In the game |
|---|---|
| The Corner Rule | The covered cells and the board edge are the quiet places; the tip bar and the Cookbook say to keep rare tiers out of the middle. |
| Staged Merging | Merge three or four of a tier in a row for a combo bonus; the bot and the How to Play page both do it. |
| The Deliberate Bottleneck | Top-tier items (a gold aura) are for serving and goals; the smart bot refuses to merge past the tier anyone wants. |
| Generator Zoning | Generators are movable pieces; the tip bar says so. |
| Objective-First Merging | Orders and the current course sit on screen all the time; cards show how many of each dish you hold. |
| Chain Preview | The Cookbook draws all four chains tier by tier from the real models; a chain you do not have yet is dimmed and says what unlocks it. |
| Boost Window Merging | Refills are bought with saved coins and spent when a combo is lined up. |
| Board lock / orphans | Detection, a toast, the compost bin, free cells as the main resource. |

## Content

**Chains** (six tiers each, two of a tier make the next; [items.js](js/sim/data/items.js))

| Chain | Generator | Tiers |
|---|---|---|
| Craft Box | start | Crayon, Paper Leaf, Place Card, Handprint Turkey, Pilgrim Hat, Thankful Tree |
| Pumpkin Patch | start | Pumpkin Seed, Sprout, Mini Pumpkin, Pumpkin, Pumpkin Pie, Blue-Ribbon Pie |
| Turkey Coop | Card Table | Egg, Chick, Poult, Gobbler, Roast Turkey, Feast Platter |
| Wheat Barrel | Dining Table | Wheat, Flour Sack, Dough, Dinner Roll, Bread Basket, Cornucopia |

**Guests:** Grandma Rose, Grandpa Joe, Uncle Bob, Aunt Linda, Cousin Timmy, Little Ava, Pilgrim Pete and Tess the Turkey,
each with a drawn face and a line for what they ask for.

**The Dinner Plan** ([chapters.js](js/sim/data/chapters.js)): Set the Table (craft), Pumpkin Season (pie, a bigger table),
The Bird (gobbler, 120 merges, 10 guests), Bread and Trimmings (the Dining Table, bread basket, roast turkey), The Big
Dinner (feast platter, blue-ribbon pie, thankful tree).

## Story

Grandma Rose says the big table is full. Five courses later the kids have set it, grown the pie, hatched and roasted the
bird, baked the bread and made the centrepiece, and the whole family makes room. After that there is no more story, only
more guests.

## Controls

| Action | Mouse | Keyboard | Touch |
|---|---|---|---|
| Harvest a generator | Click it | Space/Enter on the cursor | Tap it |
| Select / move / merge | Click, then click the target; or drag | Space to pick up and drop | Tap, then tap the target; or drag (the dish rides above your finger) |
| Serve a guest | Click the card, or drag a dish on it | Click the card | Tap the card, or drag |
| Compost | Drag to the bin | Delete or C | Drag to the bin |
| Cursor | | Arrows / WASD | |
| Pause | ❚❚ | P / Esc | ❚❚ |
| Gamepad | | d-pad, A (Enter), B (Esc), X (compost), Start | |

## Look and sound

**Look.** A warm autumn dining room seen from above: a wooden table (grain painted on a canvas), a gingham cloth, a
board of cream plates, covered cells with a flat gold padlock, and a centrepiece of candles and gourds along the far
edge that fills the table on a tall phone. Every dish is built from primitives with soft shadows (a ridged sphere
for a pumpkin, a fan of seven feather ellipsoids for the Gobbler, a wicker horn of overlapping spheres for the
Cornucopia); the Pilgrim Hat's buckle and the Handprint Turkey's thumb are modelled. Generators stand on gold plates
with a row of charge pips. A top-tier item gets a slow gold ring. Merges send a confetti of leaves, sparks and a shock
ring from the cell, the two halves fly in first, and the top tiers shake the camera a little (not in calm mode).
Leaves drift down through the light all the time. The camera is **fitted to the free rectangle** the HUD leaves
(portrait: below the guests, above the dock; wide: between the guest column and the tool column), so the whole board is
always on screen and never covered.

**Sound.** Everything is Web Audio. A warm score: a four-bar loop (C, Am, F, G) of triangle-wave arpeggios, a sine bass
and a pad, with a short tune every other time round, through a small reverb. Effects answer events: a pop for a harvest,
a pentatonic bell per merge that rises with the tier and with the combo, a till-and-bells for serving, a whoosh for the
compost bin, fanfares for goals, courses, tables and the dinner.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the title/play modes, the sim clock, input routing, autosave and offline recharge, debug hooks |
| `js/config.js`, `js/rng.js` | Tuning (board, generators, tables, economy), seeded RNG |
| `js/sim/game.js` | The pure sim: board, `act()` commands, `step()` time, guests, goals, save/load, offline |
| `js/sim/bot.js` | An auto-player at two skill levels (also the title screen's attract mode) |
| `js/sim/data/` | The chains and guests; the Dinner Plan |
| `js/view/view.js` | Scene, board, items, ghosts, camera fit, picking, drag visuals, icons |
| `js/view/models.js` | Every dish, generator and prop, built from primitives |
| `js/view/fx.js` | Confetti, sparks, shock rings, drifting leaves |
| `js/board-input.js` | Mouse, touch and keyboard on the board, turned into commands |
| `js/ui.js`, `js/portraits.js` | The DOM: HUD, guest cards, sheets, floats; the drawn faces |
| `js/input.js`, `js/audio.js`, `js/save.js` | Key queue, sound, guarded storage |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule, the content (orders and goals reachable,
hints valid), determinism and save round trips, and plays whole games with a bot. `browsertest.mjs` drives the real game
with real mouse, keyboard and touch on desktop, two phone orientations and with storage blocked. `models.html` shows
every model on a neutral background.

## Balance notes

The bot set the numbers. A first pass finished the Dinner Plan in 6 minutes and ended with a thousand coins unspent, so:

- **Combo bonus capped at +2.** A bot merging every half-second kept a combo alive for the whole game; the bonus was
  most of its income.
- **Refills priced per missing charge** (6 each, at least 30) instead of a flat price: a flat refill was three times
  better value than waiting.
- **Generators recharge every 12 s** (it was 7): the dinner is limited by charges, so this sets the length.
- **The first table costs 3 stars, and Kids Table orders ask for tier 4 more often.** With 5 stars the bot sat for ten
  minutes between courses 1 and 2 waiting for a one-star order.
- Result (6 seeds): the skilled bot finishes in about 14 minutes (spending its coins on refills) and the sloppy
  bot, which never spends and merges anything, in about 24. A person is slower than either, so expect 25 to 40
  minutes. The skilled bot never board-locks.

## Open questions / next steps

- A human pass on real phones: the balance is a bot's, and it has only run under SwiftShader (a few frames a second).
- More generators per chain (a second tier of generator that is upgraded by merging), a seasonal event window, and
  chests from top-tier merges are the obvious next layers of the primer's idle/progression loop.
- Music is one loop. A second section would help a 30 minute session.

## Changelog

### v1.0.0 (2026-11-05)
- First release: four chains of six tiers, four generators, three guest orders at a time, the five-course Dinner Plan
  with an ending, four tables, a shop, the Cookbook, hints, offline recharge, autosave, mouse/touch/keyboard/gamepad,
  a calm-motion setting, and a bot-run test suite.

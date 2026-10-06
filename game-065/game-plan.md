# Worldroot

**Genre:** Idle / incremental clicker
**Engine:** three.js r165 (ES modules, import map), no asset files
**Target:** any screen; desktop side panel, phone bottom sheet, landscape phone side panel
**Status:** v1.0.0 — complete

---

## Concept

A seed of light lies in a sleeping forest clearing. Touch it to gather motes of light, and spend them to
grow the seed, level by level, into the World Tree. Spirits of the forest join you and gather light on
their own, all the time, even while you are away. The tree is the progress bar: it really grows on
screen, from a glowing seed in the grass to a tree whose crown holds up the night.

The tone is cozy and magical: a night forest, warm gold light, mint-green glow, soft chimes.

---

## What the best incremental games do, and where it lives here

| Idea | Borrowed from | In Worldroot |
|---|---|---|
| Click for currency, buildings for income, ~15% cost growth | Cookie Clicker | Touch the tree; twelve spirits (`GENERATORS`) on the classic ×11 cost / ×6 rate ladder, `COST_RATIO = 1.15` |
| Buy ×1 / ×10 / ×100 / max | AdVenture Capitalist | Grove tab segment; bulk cost by geometric series (`genCost(i, n)`) |
| Milestones: owning N doubles output | AdVenture Capitalist | ×2 at 50, 100, 150… owned (`MILESTONES`) |
| Tiered upgrades unlocked by count | Cookie Clicker | Eight per spirit at 1/5/25/50/100/150/200/250 owned |
| Synergies between buildings | Cookie Clicker (grandma types) | Each spirit +1% per one of the tier below |
| Clicks scaling with income | Cookie Clicker (mouse upgrades) | Click upgrades: +1% of motes/s per touch each |
| Achievements that boost output | Cookie Clicker (milk + kittens) | 138 achievements; eight Radiance upgrades ×(1 + k × achievements) |
| Random golden bonuses you have to catch | Cookie Clicker (golden cookies) | Golden wisps: Lucky, Wild Bloom ×7, Kinship, Spark Storm ×777, Sap Spring |
| Spells on a regenerating resource | Realm Grinder, Cookie Clicker's Grimoire | Five spells on sap (Verdant Surge, Moonlit Hands, Call the Wisp, Quicken Time, Starfall) |
| Seasons that change the rules | Kittens Game | Spring (touch ×2), Summer (spirits ×1.25), Autumn (wisps ×2), Winter (sap ×2); five minutes each |
| A second progress track that gates content | Egg, Inc. (habitats), Trimps | The tree: 100 Nourish levels, ten stages; each level ×1.03, each stage unlocks spirits, spells, wisps and rebirth |
| Prestige with a permanent multiplier | Cookie Clicker, Clicker Heroes | Rebirth for heartwood: +1% production per heartwood ever earned |
| A prestige shop | Cookie Clicker (heavenly upgrades) | Thirteen heartwood gifts |
| Automation as a reward | AdVenture Capitalist (managers), Antimatter Dimensions (autobuyers) | Grove Keepers, Rune Scribes, Gardener's Will, Spirit Hands, Wisp Catcher |
| Challenges with permanent rewards | Antimatter Dimensions | Six trials |
| A second prestige layer | Antimatter Dimensions (Eternity), Realm Grinder | The nine realms, bound at the World Tree |
| Offline progress | almost all of them | Chunked catch-up through the real `tick()`, automation included |

Sources: Anthony Pecorella's *The Math of Idle Games* (Kongregate, parts I–III) and GDC talk *Quest for Progress* for the cost and
prestige maths; the genre round-ups that informed which games to study (Cookie Clicker, Antimatter Dimensions, AdVenture Capitalist,
Clicker Heroes, Kittens Game, Realm Grinder, Egg, Inc.).

---

## Core mechanics

### 1. Touch
A touch gathers `click × buffs × season + clickPct × motes/s`. Spring doubles it, Moonlit Hands ×20, a Spark Storm ×777.
Spirit Hands (heartwood) touch the tree for you. In the Silent Grove trial touches do nothing.

### 2. Spirits
Twelve generators, each with a creature in the clearing that appears as you buy it (see `js/view/creatures.js`). A spirit is listed once
the tree is old enough and you have held half its price. Hold a row to keep buying.

### 3. The tree
Nourish costs `30 × 1.5^L × 4^stage × e^(0.005 (L−50)²)`: exponential, with a step at each new stage and a super-exponential term past
level 50 that makes the late game plateau instead of exploding. Each level multiplies all production by 1.03, each stage opens a ×1.3
upgrade and new content. Level 100 is the World Tree.

| Stage | Level | Unlocks |
|---|---|---|
| Seed | 0 | Fireflies, Glowcaps, Dew Sprites |
| Sprout | 10 | Lantern Moths, Fox Spirits, golden wisps |
| Seedling | 20 | Moonwells, sap, Verdant Surge, Moonlit Hands |
| Sapling | 30 | Standing Stones, Call the Wisp |
| Young Tree | 40 | Treants, Quicken Time |
| Grove Tree | 50 | White Stags, rebirth |
| Elder Tree | 60 | Aurora Looms, Starfall, the aurora |
| Ancient Tree | 70 | Dryad Court |
| Great Tree | 80 | Star Seeds |
| Sky Tree | 90 | — |
| World Tree | 100 | binding realms |

### 4. Wisps, spells, seasons
A golden wisp comes every 2–5 minutes (faster with upgrades, heartwood, Autumn and Alfheim) and lingers 14 s. Sap regenerates (0.12/s
before upgrades), up to 50 + 15 per stage. A spell that is running can't be recast.

### 5. Rebirth, trials, realms
Rebirth needs a Grove Tree and pays `40 × 1.12^(L−50)` heartwood: the taller the tree, the more. Trials open after the first rebirth and
each needs some heartwood earned. Realms need the World Tree; binding one is a rebirth and makes every later tree ×30 costlier.

---

## Balance

Measured by `dev/pace.mjs` and asserted by `dev/simtest.mjs` (a bot that compares the payback time of every purchase):

| Milestone | Active (4 touches/s, catches wisps, casts) | Casual (1/s, shops every 10 s) | Idle (0.3/s, shops every 5 min) |
|---|---|---|---|
| Sprout | 5 min | 11 min | 25 min |
| Sapling | 16 min | 27 min | 1h 30m |
| First rebirth | 48 min | 56 min | 5h 25m |
| Elder Tree | 2h 14m | 2h 47m | 1d 5h |
| World Tree, first realm | 3h | 4h 13m | 1d 21h |
| Realms | 5 in 48 h | 4 in 48 h | 3 in 72 h |

Three tuning lessons are recorded in `docs/generic/learnings.md`: the first draft finished the whole game in 17 minutes; heartwood based on
total motes ran away; and heartwood based on tree height plus a super-exponential tree cost is what made it plateau.

---

## Controls

| Action | Mouse / keyboard | Touch |
|---|---|---|
| Gather motes | Click the tree · Space | Tap the tree |
| Catch a wisp | Click it · W | Tap it |
| Nourish | Nourish button (hold to repeat) · N | Nourish button |
| Spells | Magic tab · 1–5 | Magic tab |
| Look around | Drag · wheel to zoom | Drag · pinch |
| Music | M | Settings |

---

## Module overview

| File | Responsibility |
|---|---|
| `js/sim/data.js` | Every number and name: spirits, upgrades, stages, spells, wisps, seasons, heartwood, realms, trials, achievements |
| `js/sim/game.js` | `Grove`: the pure simulation (no DOM, three.js, `Math.random` or clock); events with sequence numbers; `offline()` |
| `js/sim/rng.js` | Seeded PRNG kept in the save |
| `js/sim/bot.js` | The balance bot (also `?debug=1` → `__wr.autoplay()`) |
| `js/view/stage.js` | Renderer, bloom, camera rig that frames the tree inside the uncovered part of the screen, quality tiers |
| `js/view/tree.js` | The World Tree: skeleton, growth shader, leaves, fruit, sprout, seed, hit-testing |
| `js/view/ground.js` | Clearing, grass, flowers, ferns, rocks, forest that dissolves near the camera |
| `js/view/creatures.js` | One presence per spirit |
| `js/view/fox.js` | The Fox Spirit model and its trot / pause animation |
| `js/view/particles.js` | Ambient motes, bursts, seasonal fall, the wisp, realm islands |
| `js/view/sky.js` | Sky dome, stars, moon, aurora, season palettes |
| `js/view/world.js` | Builds the view, reacts to sim events, per-frame sync |
| `js/ui/ui.js` | HUD, tabs, lists patched in place, modals, toasts, lore |
| `js/ui/format.js` | Number and time formatting |
| `js/audio.js` | Synthesised sound and generative music |
| `js/save.js` | Guarded localStorage, save codes |
| `js/main.js` | Boot, input, loop, offline, autosave, debug hooks |

---

## Changelog

### v1.0.3 (2026-10-06)
- A new, polished Fox Spirit (`js/view/fox.js`): smooth fur with vertex colours and sheen, shaped head, glowing eyes, bushy white-tipped tail with foxfire, a diagonal-pair trot, pauses to look at the tree. Foxes, treants and stags now face the way they walk.

### v1.0.2 (2026-10-06)
- Click sparks no longer leave a still cloud of one-pixel dots where they faded: dead sparks are clipped, not drawn at size 0, and they really fade out.

### v1.0.1 (2026-10-06)
- The ground is a polar grid instead of a triangle fan, so the hills under the forest are real and the trees stand on them instead of hovering.

### v1.0.0 (2026-10-06)
- First release: everything above, with `dev/simtest.mjs`, `dev/browsertest.mjs` and `dev/pace.mjs`.

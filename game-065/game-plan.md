# Worldroot

**Genre:** Idle / incremental clicker
**Engine:** three.js r165 (ES modules, import map), no asset files
**Target:** any screen; desktop side panel, phone bottom sheet, landscape phone side panel
**Status:** v1.2.0 — complete

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
| Mastery that grows with time spent | Melvor Idle (mastery), NGU Idle | Kinship: every kind of spirit you own levels up on its own (√owned xp per second, offline too), +1.5% per level, up to 20 |
| Timed expeditions that run while away | Egg, Inc. (artifact ships), AFK Arena | Expeditions to four Deepwood sites, 10 minutes to 8 hours, for amber, light and relics |
| Collectible artifacts with set bonuses | Realm Grinder (artifacts), Egg, Inc. | 24 relics in four sets of six; each a small lasting bonus, each set a blessing; duplicates become amber |
| A garden of timed plants | Cookie Clicker (garden) | The moonpetal garden: eight herbs, 5 minutes to 12 hours, 2–6 beds, a 6% glimmering variant |
| Rotating small goals | Egg, Inc. and most mobile idlers (missions) | Whispers: three (or four) goals at a time, scaled to how far you've grown, for amber |
| A side currency and its shop | Egg, Inc. (golden eggs), Leaf Blower Revolution | Amber, spent at Mab's stall: more parties and beds, faster herbs and trips, Bottled Starlight, spark colours |
| Badges, titles and cosmetics | Steam-style badge tiers, Melvor Idle | Fourteen badges in bronze, silver, gold and starlit; gold and starlit grant 28 titles to wear |
| Achievements beyond the core | Antimatter Dimensions (achievement rows) | 97 feats for the wider wood, each worth amber, counted apart so Radiance is unchanged |
| A bestiary that fills in as you play | Kittens Game, Melvor Idle | The Codex: three pages of lore per spirit, opened by kinship, plus every wisp kind caught |
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

### 6. The Wilds (v1.2.0)
Everything around the core loop, in `js/sim/wilds.js` (logic, mixed into `Grove`) and `js/sim/wilds-data.js` (numbers). It opens at the
Sprout stage, never resets on rebirth, and runs on the game clock, so it all keeps going offline. None of it is needed to grow the tree.

- **Kinship.** Each kind of spirit you own gains √owned xp per second; level L→L+1 costs `600 × 1.6^L`. Each level: that spirit ×1.015.
  Kinship 1, 5 and 10 open the spirit's three Codex pages.
- **Expeditions.** One party at first (three with Mab's help) to Mossy Hollow (Sprout), Mirror Mere (Sapling), Barrow Hills (Grove Tree)
  or Starfall Crater (Ancient Tree), for a stroll (10 min), journey (1 h), quest (4 h) or odyssey (8 h). Home with amber, a minute of
  production per hour away, and an 8 / 30 / 65 / 90% chance of a relic from that site (60% of the time one you haven't found).
- **Relics.** Six per site, each a small lasting bonus (+2–3% production, +15% to two spirits, wisps, sap, offline, amber, kinship,
  herbs, trips). All six from a site: a set blessing. A duplicate is traded for amber.
- **The garden.** Pick a seed, tap a bed. Eight herbs from Moonpetal (5 min) to Worldbloom (12 h), opened by harvests and tree stage;
  gifts of light, short blessings (touches ×3, production ×1.5), sap, a wisp or a relic chance. 6% come up glimmering: double gift.
- **Whispers.** Three small goals (touches, wisps, spells, spirits, upgrades, nourishes, harvests, expeditions, minutes, motes), sized
  by the best stage reached, for amber. A new one comes when you claim; one amber asks for a different one.
- **Mab's stall.** Amber buys another party (×2), garden beds (×4), a fourth whisper, Long-Burning Wick and Barrow Candle (herb blessings
  and bottles only), Black Loam (herbs faster), Moth Compass (trips faster), Bottled Starlight (×2 for 15 min) and four spark colours.
- **Badges and titles.** Fourteen tracks in four tiers; gold and starlit each grant a title, worn under the counter.
- **Feats.** 97 achievements of the wider wood (every wisp kind, every spell, kinship, sites, relics, herbs, whispers, amber, badges,
  nourishes, spirits, upgrades, play time, seasons). Each pays 2 amber. `achCount()` skips them (ids `f_…`), so Radiance is unchanged.

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

The Wilds were tuned so a player who tends all of it is only a little ahead of one who ignores it. The bots tend the Wilds too (they
send parties, replant, claim whispers and shop at Mab's), and the medians over twelve seeds, before → after v1.2.0, are:
active World Tree 177 → 183 min, casual World Tree 316 → 288 min, idle first rebirth 325 → 310 min. The first draft was 30% faster:
anything that lengthens or feeds spells and wisp gifts (Starfall ×10, Wild Bloom ×7) is worth far more than it reads, so the wick and
candle only stretch herb blessings and bottles, and herb gifts of light are about 5% of the time grown.

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
| `js/sim/bot.js` | The balance bot (also `?debug=1` → `__wr.autoplay()`); it tends the Wilds too |
| `js/sim/wilds.js` | Kinship, expeditions, relics, the garden, whispers, the peddler, badges, titles and feats, mixed into `Grove` |
| `js/sim/wilds-data.js` | Their numbers, names and lore, and the Codex |
| `js/view/stage.js` | Renderer, bloom, camera rig that frames the tree inside the uncovered part of the screen, quality tiers |
| `js/view/tree.js` | The World Tree: skeleton, growth shader, leaves, fruit, sprout, seed, hit-testing |
| `js/view/ground.js` | Clearing, grass, flowers, ferns, rocks, forest that dissolves near the camera |
| `js/view/creatures.js` | One presence per spirit |
| `js/view/fox.js` | The Fox Spirit model and its trot / pause animation |
| `js/view/models.js` | Treant, White Stag, Dryad, Moonwell, standing stone, glowcap and crystal geometry, realm island, and their animation |
| `js/view/kit.js` | Shared model parts: tubes, blobs, lathes, rocks, eyes, the glowing vertex-colour material, `bake()` |
| `js/view/particles.js` | Ambient motes, bursts, seasonal fall, the wisp, realm islands |
| `js/view/sky.js` | Sky dome, stars, moon, aurora, season palettes |
| `js/view/world.js` | Builds the view, reacts to sim events, per-frame sync |
| `js/ui/ui.js` | HUD, tabs, lists patched in place, modals, toasts, lore |
| `js/ui/wilds-ui.js` | The Wilds tab, and the Journal's Badges and Codex pages |
| `js/ui/format.js` | Number and time formatting |
| `js/audio.js` | Synthesised sound and generative music |
| `js/save.js` | Guarded localStorage, save codes |
| `js/main.js` | Boot, input, loop, offline, autosave, debug hooks |

---

## Changelog

### v1.2.0 (2026-10-06)
- The Wilds: ten new systems around the core loop, none of them needed to grow the tree, all of them running while you are away. Spirit
  kinship; expeditions to four Deepwood sites; 24 relics in four sets; the moonpetal garden with eight herbs and glimmering variants;
  whispers (rotating small goals); amber and Mab's stall (upgrades, Bottled Starlight, spark colours); fourteen badges in four tiers;
  28 titles; 97 feats; the Codex. A new Wilds tab, Badges and Codex pages in the Journal, kinship hearts on the spirit rows, and the
  away summary reports parties home, herbs ready and whispers answered.

### v1.1.1 (2026-10-06)
- Fixed a box-shaped blink over the right-hand panel, worst when moving the mouse quickly over it: no `backdrop-filter` over the WebGL canvas (panel and HUD chips use a more opaque tint instead), `layout()` only on the panel's own transition, and `resize()` reallocates the canvas and render targets only when width, height, pixel ratio or quality change.

### v1.1.0 (2026-10-06)
- Every spirit and structure remodelled with smooth, vertex-coloured, softly glowing parts and new animation: Treant, White Stag, Dryad, Moonwell, Standing Stones, Glowcaps, Star Seed crystals and realm islands (`js/view/models.js`, shared parts in `js/view/kit.js`). Rigid parts are merged per material, so a full grove draws fewer calls than before.

### v1.0.3 (2026-10-06)
- A new, polished Fox Spirit (`js/view/fox.js`): smooth fur with vertex colours and sheen, shaped head, glowing eyes, bushy white-tipped tail with foxfire, a diagonal-pair trot, pauses to look at the tree. Foxes, treants and stags now face the way they walk.

### v1.0.2 (2026-10-06)
- Click sparks no longer leave a still cloud of one-pixel dots where they faded: dead sparks are clipped, not drawn at size 0, and they really fade out.

### v1.0.1 (2026-10-06)
- The ground is a polar grid instead of a triangle fan, so the hills under the forest are real and the trees stand on them instead of hovering.

### v1.0.0 (2026-10-06)
- First release: everything above, with `dev/simtest.mjs`, `dev/browsertest.mjs` and `dev/pace.mjs`.

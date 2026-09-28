# GLIMMERGLEN — Game Design Document

**Genre:** cozy village builder / farming sim crossed with a top-down Zelda-style adventure and turn-based battles
**Tech:** vanilla HTML / CSS / ES modules, Canvas 2D for the world, DOM for menus, Web Audio. No libraries, no build step, **no asset files**
**Status:** implemented (v1, 2026-09-25). Verification: see [dev/README.md](dev/README.md).
**Target:** phones first (portrait and landscape, one or two thumbs), keyboard equally supported
**Tone:** warm, gentle, a little bit magical. Monsters are "wild" rather than evil; losing a fight means waking up at home a bit poorer.
**Seed rule:** everything that is generated — the land, its regions and their names, dungeons and caves, monsters, villagers, their faces and stories, job-board postings, the weather, every sprite and every song — comes from one **world seed** entered (or rolled) in the character creator. The same seed always makes the same world.

---

## 1. Pitch

You inherit a deed from a great-aunt you barely remember: *"The Glen is yours. It was a village once. Wake it up."*

The Glen turns out to be a clearing in a vast, silent forest. There is an overgrown cabin, a split and
leafless giant tree — **the Heartwood** — and exactly one resident: an elderly former villager, now
**the Mayor** of a village of one, living in a tent beside the stump. A small light drifts around the
Heartwood's roots. It is **Glim**, the last wisp of the Glen's magic.

Forty years ago the Heartwood's heart shattered into **five Heart Shards**, which fell into the five
wild lands around the Glen and were swallowed by the old places there. Without the Heartwood, the
Glen's magic went to sleep, and so did everything magical in the land: fairy rings, shrines,
moonwells and hidden caches are all still out there, faded to nothing.

Farm. Build. Invite people to live here. As the village grows, its warmth wakes the Glen's magic back
up — faded things start to shimmer back into sight, sealed dungeon doors unlock, and the road to each
Heart Shard opens. Bring all five home and the Heartwood blooms.

| Borrowed from | What it gives GLIMMERGLEN |
|---|---|
| **Stardew Valley** | days and seasons, crops that need watering, animals, foraging, mining, a shipping bin, cooking, villagers with hearts, gifts and stories |
| **Zelda** | a hand-made-feeling overworld cut into regions, each region's dungeon holding a relic that opens the **next** region's gate, hidden secrets, heart containers |
| **Village builders** | lots to clear and build on, applicants who need a specific building, a mayor, a village level, a job board of quests you can do yourself **or** delegate |
| **JRPGs** | turn-based battles with telegraphed enemy intents, elements, skills, a companion |

The linking idea: **the village is the key to the adventure, and the adventure feeds the village.**
Dungeon seals open with village level; villagers need materials only the wilds provide; the Heart
Shards you bring back wake hidden magic that makes both halves easier.

---

## 2. Core loops

```
          ┌────────────── one day (6:00 → 2:00) ──────────────┐
morning:  │ crops grew · animals produced · villagers left     │
          │ gifts in the Storehouse · board has new postings  │
day:      │ water / harvest · feed & pet · visit Mayor & Board │
          │ → go gathering / exploring / dungeon-diving        │
          │ → cook, refine, build, sell                        │
night:    │ wild monsters roam more · go home and sleep (save) │
          └────────────────────────────────────────────────────┘

village level ─► applicants arrive ─► build their home/shop ─► they move in ─► they contribute
     ▲                                                                              │
     └──────────── coziness (buildings, happy villagers, quests, shipping) ◄────────┘

village level N ─► seal on dungeon N opens ─► clear it ─► Heart Shard + Relic
     ▲                                             │           │
     │         shard → Heartwood grows ─► hidden   │           └─► relic opens gate to region N+1
     └──────── magic tier N revealed ◄─────────────┘
```

* **Minute to minute:** walk, chop, mine, till, water, talk; bump into a monster → turn-based battle.
* **Day to day:** plan the day around energy, the clock, the weather and the board.
* **Week to week:** grow the village a level, open the next region, clear its dungeon.
* **Across the game:** five chapters, five regions, five dungeons, twelve villagers with their own
  three-part stories, a finale festival, and a post-game where everything keeps running.

---

## 3. Character creator

Before the first day the player makes their character and their world:

| Field | Options |
|---|---|
| Name | free text (1–14 chars) |
| Pronouns | they/them · she/her · he/him (used by every villager's dialogue) |
| Skin tone | 8 |
| Hair style | 8 (short, bob, long, spiky, bun, curly, ponytail, shaved) |
| Hair colour | 10 |
| Eye colour | 6 |
| Outfit top / bottom | 10 colours each |
| Accessory | none, straw hat, flower, glasses, scarf, beanie |
| Village name | free text (default is generated from the seed) |
| World seed | free text or 🎲; hashed to 32 bits. Shown in the pause menu so a world can be shared |

A live preview canvas shows the character turning through all four directions with a walk cycle.

---

## 4. Time, weather, energy

* A day runs **6:00 → 2:00**. The clock moves **2 game-minutes per real second** (a full day ≈ 10 minutes of play) and stops in menus, dialogue and battles.
* **Seasons**: Spring, Summer, Fall, Winter, **12 days each** (48-day year).
* **Weather** is rolled per day from the seed: sunny, rain (waters every crop), storm (rain + more monsters), snow (winter only). Tomorrow's forecast is on the Mayor's noticeboard.
* **Energy** (100, +10 per Star Fruit) is spent by tools (2–5 depending on tool tier and skill). At 0 you can still walk and talk but not work.
* **Sleep** in your cabin bed to end the day and **autosave**. Before midnight: full energy. After midnight: 75%. Still awake at 2:00: you pass out, wake at home, lose 10% of your gold (max 250).

---

## 5. The land

### 5.1 Overworld

A 160 × 160 tile map (16px tiles). **The Glen** — village, your cabin and farm plot, the Heartwood
— sits in the middle. Five **regions** fan out around it as sectors of a circle whose angles are
chosen by the seed. Region borders are cliffs and deep thickets, so each region is entered through
exactly one **gate** on the road from the Glen.

| # | Biome | Element | Gate (needs) | Dungeon relic (opens next gate) |
|---|---|---|---|---|
| 1 | Deep forest | leaf | open | **Thornbreaker** — cuts thornwalls |
| 2 | Rolling downs | storm | thornwall | **Stonebreaker** — shatters boulders |
| 3 | Lake & marsh | frost | boulders | **Lilypad Charm** — walk across shallows |
| 4 | Volcanic crags | ember | shallows | **Glow Lantern** — see in the dark |
| 5 | Frozen heights | shadow | dark hollow | *(the last shard)* |

Each biome has its own ground palette (hue-shifted per seed), trees, forage, ore, monsters and music.
Region names (e.g. *Whisperbrook Wood*, *Sunhollow Downs*) are generated from syllable tables.

Per region the generator places, along a carved road network so everything is reachable:

* the **dungeon** entrance (sealed until the village reaches that level),
* an optional **cave** (a mine: 6 floors of ore and gems, harder ores in later regions),
* forage patches, trees, rocks, grass tufts (scythe → hay), ponds,
* monster roaming zones,
* **faded things** (see §5.3).

### 5.2 Dungeons and caves

Generated per floor from `seed + site + floor`.

* **Dungeons**: rooms-and-corridors, 4 floors + a boss floor. Locked doors with keys found on the same floor, chests (materials, gear, recipe scrolls), monsters that wander and give chase, a darkness radius around the player (bigger with the Glow Lantern).
* **Caves**: cellular-automata caverns, 6 floors. Ore nodes (copper → iron → silver → gold → glimmerite by region tier), gem nodes, fewer monsters. The stairs down are sometimes hidden under a rock.
* An exit stair on every floor, and each cleared dungeon gets a **return rune** at its entrance so you can drop straight to its deepest floor.

### 5.3 Faded magic ("glimmers")

Hidden objects placed across the overworld with a **tier 0–5**. A tier-*t* object is invisible until
the Heartwood has grown *t* stages (i.e. *t* Heart Shards returned). Standing within two tiles of one
that is still faded shows a faint shimmer and the line *"Something magical sleeps here…"* — so the
player learns early that the land is full of secrets they can't reach yet.

| Glimmer | Effect |
|---|---|
| **Heart Acorn** | +10 max HP (Zelda heart container) |
| **Star Fruit** | +10 max energy |
| **Recipe Scroll** | learn a cooking recipe |
| **Glimmer Cache** | gold, gems, rare materials |
| **Fairy Ring** | fast-travel point (tap on the map to warp between awakened rings) |
| **Old Shrine** | a blessing (+1 ATK / DEF / SPD permanently) and a line of lore |
| **Moonwell** | once per day fully restores HP, SP and energy |

The Scholar villager reveals one faded object on the map each week regardless of tier.

---

## 6. Farming, animals, gathering

### 6.1 Crops

Hoe → till, seeds → plant, watering can → water. A watered crop grows one stage overnight; rain
waters everything. Crops out of season die at the season change unless in the **Greenhouse**.
Regrowing crops produce again every *n* days.

| Crop | Season | Days | Regrow | Seed | Sells |
|---|---|---|---|---|---|
| Turnip | Spring | 4 | – | 20 | 35 |
| Potato | Spring | 6 | – | 40 | 80 |
| Strawberry | Spring | 8 | 4 | 80 | 60 |
| Cauliflower | Spring | 10 | – | 70 | 175 |
| Tomato | Summer | 9 | 4 | 50 | 60 |
| Corn | Summer/Fall | 12 | 4 | 60 | 50 |
| Melon | Summer | 10 | – | 80 | 250 |
| Blueberry | Summer | 11 | 4 | 80 | 50 (×3) |
| Pumpkin | Fall | 11 | – | 100 | 320 |
| Yam | Fall | 8 | – | 60 | 150 |
| Cranberry | Fall | 7 | 5 | 120 | 75 (×2) |
| Wheat | Spring–Fall | 4 | – | 10 | 25 |
| Beet | Fall | 6 | – | 20 | 60 |
| Snowroot | Winter | 7 | – | 60 | 140 |
| Frostberry | Winter | 9 | 4 | 90 | 70 |
| Starbloom | any (magic) | 12 | – | glimmer only | 600 |

Sprinklers (crafted) water adjacent tiles every morning. The Farmer villager waters up to 12 of your
tiles each morning.

### 6.2 Animals

Build a **Coop** (chickens, ducks) and a **Barn** (cows, sheep, goats); buy animals from the Rancher.
Animals wander their yard by day. Each needs 1 **hay** a day (scythe grass tufts, or buy); fed animals
produce daily (sheep every other day). **Pet** them daily for affection; high affection gives large
/ golden produce. The Rancher feeds them from the hay store if you forget.

| Animal | Produce | Hi-affection produce |
|---|---|---|
| Chicken | Egg | Large Egg |
| Duck | Duck Egg | Golden Feather (rare) |
| Cow | Milk | Large Milk |
| Goat | Goat Milk | Large Goat Milk |
| Sheep | Wool (2 days) | Fine Wool |

### 6.3 Gathering

Axe (trees → wood, hardwood; stumps), pickaxe (rocks → stone, clay, coal, ore, gems), scythe (grass
→ fiber, hay), hand (forage). Trees and rocks regrow over days; forage respawns each season. Tool
tiers (Copper → Iron → Gold → Glimmer, upgraded by the Blacksmith) lower energy costs and let the
pickaxe break harder ore.

### 6.4 Skills

Farming, Foraging, Mining, Cooking, each level 1–10 from use. Every level lowers that skill's energy
cost and raises the chance of a double yield; Cooking raises dish potency.

---

## 7. Crafting, refining, cooking

* **Workbench** (in the cabin): sprinklers, chests, fences, lamp posts, flower planters, benches, scarecrows, the Clay Furnace, the Preserves Jar, bait for the job board, repair kits.
* **Refining** takes game time. Put materials in, come back later.
  | Station | Where | Recipes |
  |---|---|---|
  | Clay Furnace | crafted, in your yard | copper/iron ore + coal → bars |
  | Forge | Blacksmith | all ores → bars (faster), gems → **elemental gems** |
  | Sawmill | Carpenter | wood → planks, hardwood → beams |
  | Mill | Farmer | wheat → flour, beet → sugar |
  | Loom | Tailor | wool → cloth, fiber → rope |
  | Dairy | Rancher | milk → cheese, egg → mayo, goat milk → goat cheese |
  | Preserves Jar | crafted, yard | fruit → jam, vegetable → pickles |
  | Still | Herbalist | herbs → tonics and potions |
* **Cooking** at the cabin kitchen. **Recipes must be discovered**: 32 recipes, found as scrolls in
  chests and glimmers, taught by villagers at heart levels, bought from the Scholar, rewarded by
  quests. Dishes restore HP and energy and many give a buff for the day (ATK, DEF, SPD, luck,
  farming, speed). Ingredient slots can be exact items or **tags** ("any fruit", "any fish-free
  vegetable", "any mushroom").

---

## 8. The village

### 8.1 Lots

The Glen has **18 lots** around a plaza. Each starts overgrown (trees, thornbrush, rocks). A lot is
usable once cleared. Lots unlock in rings: 6 at level 1, +3 per level.

### 8.2 Buildings

| Building | Level | For | Notes |
|---|---|---|---|
| Job Board | 1 | village | prologue build |
| Carpenter's Workshop | 1 | Carpenter | Sawmill, −20% build costs, decor shop |
| Farmhouse & Mill | 1 | Farmer | Mill, seed shop |
| Forge | 2 | Blacksmith | Forge, tool/weapon upgrades |
| Ranch House | 2 | Rancher | Dairy, animals, hay |
| Café | 2 | Cook | dishes, recipes |
| Coop | 2 | your animals | 6 birds |
| Apothecary | 3 | Herbalist | Still, potions |
| General Store | 3 | Merchant | wide stock, +15% shipping prices |
| Tailor's Loft | 3 | Tailor | Loom, armour, outfits |
| Barn | 3 | your animals | 6 beasts |
| Miner's Lodge | 4 | Miner | daily ore, cave expeditions |
| Watchtower | 4 | Guard | best companion, fewer monsters |
| Library | 4 | Scholar | reveals glimmers, sells scrolls |
| Greenhouse | 4 | your crops | 24 tiles, any season |
| Tavern | 5 | Bard | daily buff, happiness |

Costs mix wood/stone/planks/bars/cloth and gold and are listed in the build menu; the Carpenter
takes 20% off everything.

### 8.3 Villagers

Twelve **jobs** (Carpenter, Farmer, Blacksmith, Rancher, Cook, Herbalist, Merchant, Tailor, Miner,
Guard, Scholar, Bard). Each villager is generated: name, pronouns, face/hair/clothes, personality
(cheerful, shy, grumpy, dreamy, bookish, bold), loved/liked/disliked gifts, and a hometown.

* **Applicants** arrive when the village levels up (level 1: Carpenter & Farmer; 2: Blacksmith,
  Rancher, Cook; 3: Herbalist, Merchant, Tailor; 4: Miner, Guard, Scholar; 5: Bard). They wait on the
  plaza and tell you what building they need. The Mayor keeps the list.
* **Build it on a cleared lot** and the applicant moves in the next morning.
* **Every villager contributes**:
  * a daily gift into the **Storehouse** (the Mayor's hall chest) — produce of their trade,
  * a passive effect (auto-watering, feeding, price boosts, monster suppression, revealing glimmers…),
  * a shop and/or refining station,
  * they can be **sent on job-board quests**,
  * one can come adventuring with you as a **companion** (joins battles with a job-based skill).
* **Friendship** 0–10 hearts: talk daily (+), gifts (loved ++, liked +, disliked −), finishing their requests.
* **Happiness** (0–100): home built, friendship, decorations nearby, not overworked, tavern.
  Happiness scales their daily contribution and adds coziness.
* **Stories**: every job has a three-chapter storyline (at 2, 5 and 8 hearts) whose details — the
  lost item, the place it was lost, the rival, the old friend — are filled in from the seed. Each
  chapter is a quest ending in a reward (a recipe, gear, a unique item, a relic upgrade).

### 8.4 Village level

**Coziness** points level the village:

| Level | Title | Coziness |
|---|---|---|
| 1 | Overgrown Glen | 0 |
| 2 | Hamlet | 120 |
| 3 | Village | 360 |
| 4 | Town | 800 |
| 5 | Glimmerglen | 1500 |

Sources: building (+30–80), a villager moving in (+25), each morning Σ villager happiness ÷ 20, job
board quests (+10–40), first harvest of each crop (+5), decorations (+4, max 40), dungeon cleared (+60).

At a threshold the Mayor holds a small ceremony (talk to them): new lots, blueprints, applicants,
the next dungeon seal breaks, and the Mayor's hall grows.

### 8.5 The Mayor

Generated name and look, fixed role. The Mayor carries the main-quest thread (each step's lines are
said once), and their talk menu offers: **Village celebration** (when a level is ready), **How is the
village?** (level, coziness, residents, happiness), **Newcomers** (applicants and what they need),
**Storehouse**, **Buy seeds** (until a Farmer arrives, so day 1 always works) and **Tomorrow's
weather**. Building itself happens at each lot's sign.

### 8.6 The Job Board

Refreshes each morning with up to 5 postings (seeded by day), each with type, difficulty ★1–5,
reward (gold, items, coziness) and a deadline:

| Type | Objective |
|---|---|
| Gather | bring N of an item |
| Hunt | defeat N of a monster species |
| Deliver | bring a dish or refined good to a villager |
| Delve | reach floor N of a dungeon or cave |
| Expedition | *villagers only*: go to a region for D days and bring back what you find |

For each posting you can **take it yourself** (it enters your journal) or **assign villagers**
(1–2 of them). Success chance comes from villager level, job fit (Miner for ore, Guard for hunts…)
and difficulty, shown before you confirm. Assigned villagers are away for 1–3 days (their daily
contribution pauses); they return with the reward in the Storehouse and gain XP. A failed
assignment returns partial loot and a tired villager.

---

## 9. Combat

Wild monsters roam the regions (more at night and in storms) and every dungeon floor. Touching one
starts a battle; monsters within a few tiles join in, up to 1 while you are below level 3, 2 below
level 6, then 3. **Swinging the sword** at a monster before it touches you gives the **first strike**
(a free turn). Monsters in the Glen: never.

### 9.1 Battle rules

* Side view: you (+ a companion) on the right, up to 3 monsters on the left, backdrop from the region.
* Turn order by SPD. On your turn: **Attack**, **Skill** (costs SP), **Item**, **Guard** (halve damage, +2 SP), **Flee** (not from bosses).
* Every monster shows its **intent** for its next action above its head: ⚔ attack, 💢 heavy (charging, hits next turn for 2.2×), 🛡 guard, ✦ elemental (hits everyone), ✚ heal, ↯ debuff. Guarding into a heavy hit is the main tactical read.
* **Elements**: ember › leaf › storm › frost › ember (1.5× / 0.66×), shadow ⇄ light (1.5× both ways). Weapons pick up an element from an elemental gem set at the Forge.
* Damage = `max(1, (ATK × power − DEF × 0.5) × elem × crit × (0.9–1.1))`. Crit 6% (+luck), ×1.6.
* Win: XP, gold, drops (monster materials used in recipes and quests), hunt-quest progress.
* Lose: you wake up at home the next morning with 10% less gold; nothing else is lost.

### 9.2 Player skills (by level)

| Lv | Skill | SP | Effect |
|---|---|---|---|
| 1 | Strike | – | 1.0× |
| 2 | Power Strike | 3 | 1.8× one foe |
| 4 | Whirl | 5 | 1.0× all foes |
| 6 | Glimmer Bolt | 4 | 1.6× light (or weapon element), ignores half DEF |
| 8 | Mend | 6 | heal 40% max HP, cleanse |
| 10 | Starfall | 10 | 2.0× light to all foes |

Player stats: HP 50 + 8/lv, SP 10 + 2/lv, ATK 5 + 1.5/lv, DEF 2 + 1/lv, SPD 5 + 0.5/lv, plus gear,
shrine blessings and food buffs. XP to next level: `20 × lv^1.6`.

### 9.3 Companions

Ask a befriended (2+ hearts) villager to come along for the day. They join battles with a job skill:
Guard (*Taunt* + strong hits), Herbalist (*Heal*), Blacksmith (*Smash*), Miner (*Rockfall*, all foes),
Scholar (*Spark*, elemental), Bard (*Rally*, +ATK buff), Cook (*Snack*, heals + SP), everyone else
(*Help*, a plain hit). Companion stats scale with the villager's level.

### 9.4 Monsters

Each region has four generated **species** and one **boss**. A species is an archetype
(slime, beast, bird, plant, bug, spirit, golem, fungus, serpent, construct) × the region's element
× a seeded palette and silhouette. Sprites come from a mirrored pixel generator with archetype
templates (slimes are domes, birds have wings, golems are blocky…). Names are element word +
archetype noun (*Bramble Slime*, *Cinder Moth*). Each archetype has a signature move pattern
(slimes split into intents of guard/attack, birds are fast, golems charge heavy hits, spirits cast
elementals, plants heal allies). Bosses are 2× sprites with three-phase intent scripts.

---

## 10. Items and inventory

* **Backpack** 24 slots (36 after the Tailor's Big Pack). Stack size 99. The first 8 slots are the **hotbar**; tools live there like any item.
* **Storage chest** in the cabin (48 slots), and the village **Storehouse** (villager deliveries).
* **Shipping bin** beside the cabin: items dropped in are sold overnight.
* Item categories: tool, seed, crop, animal product, forage, material, ore, bar, gem, monster part, refined good, dish, potion, weapon, armour, charm, relic (key items), scroll, decoration.
* Every item icon is drawn procedurally from a category template and a seeded palette.

**Smart action (mobile-friendly):** the action button looks at the tile you face: tree → axe, rock →
pickaxe, grass tuft → scythe, ripe crop → harvest, animal → pet, NPC → talk, door/sign/chest →
interact, monster → sword. Only farming actions (till, plant, water) and placing items use the
currently selected hotbar item.

---

## 11. Main quest — "The Heartwood"

| Chapter | Steps |
|---|---|
| **Prologue — A Letter in the Leaves** | talk to the Mayor · meet Glim · clear the weeds by your cabin · plant 5 seeds · gather 15 wood and build the Job Board · sleep |
| **1 — The First Light** | welcome your first villager · explore region 1 · clear its dungeon · return the Heart Shard |
| **2 — Thorns and Thunder** | reach village level 2 · cut through the thornwall with the Thornbreaker · clear dungeon 2 · return the shard |
| **3 — The Mirror Water** | reach level 3 · break the boulders · clear dungeon 3 · return the shard |
| **4 — Ember and Ash** | reach level 4 · cross the shallows · clear dungeon 4 · return the shard |
| **5 — The Starlit Spire** | reach level 5 · light the dark hollow · clear the spire · return the last shard |
| **Finale — The Festival of Glimmering** | gather everyone at the Heartwood at dusk → the tree blooms → a festival night with every villager → credits → post-game |

Each returned shard grows the Heartwood a visible stage, raises the glimmer tier, and grants a
village-wide blessing (crops +10% speed, +20 max energy, cheaper upgrades, +1 companion skill, …).
The Mayor and Glim carry the story dialogue; each chapter also has scenes with whichever villagers
have moved in.

---

## 12. Procedural generation summary

| Thing | Seeded from | Method |
|---|---|---|
| Region layout | seed | sector angles with jitter; fBm value noise for ground; cliff borders |
| Roads | seed | A* on a cost field from the Glen to each gate, POI and dungeon |
| Region / dungeon / villager names | seed, index | syllable grammars per biome/culture |
| Palettes | seed, region | HSL shifts of the biome base palette |
| Dungeon floors | seed, site, floor | BSP rooms + corridors / cellular automata + flood-fill repair |
| Monsters | seed, region | archetype × element × mirrored pixel grid × palette |
| Villagers | seed, job | look, personality, gifts, story fill-ins |
| Job board | seed, day | weighted posting table by village level and unlocked regions |
| Weather | seed, day | season-weighted |
| Music | seed, mood | seeded AABA composer (§14) |
| Sprites & tiles | seed | pixel painters per category; cached to offscreen canvases |

A Node harness regenerates worlds across many seeds and proves: the world is identical for the same
seed; every POI and gate is reachable from the Glen with the relics available at that point of the
story (and a gate is **not** passable without its relic); every dungeon floor's stairs are
connected; no object spawns on a road.

---

## 13. Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrows | left thumb: floating joystick (appears where you touch) |
| Action (smart) | Space / E / J | **A** button |
| Cancel / run (hold) | Shift / K / X | **B** button |
| Hotbar | 1–8, Q/R cycle | tap the hotbar |
| Inventory / menu | I / Tab / Esc | ☰ button |
| Map | M | 🗺 button |
| Journal | L | in the menu |

All touch targets ≥ 44 css px. Menus are DOM panels (scrollable, big buttons). In portrait the
controls float over the lower third; in landscape they sit in the corners. The launcher's "← Games"
link hides during play and lives in the pause menu.

---

## 14. Audio

Everything synthesised with Web Audio:

* **Composer**: from `seed + mood` it writes a 16-bar AABA tune — chord progression from a mode's
  pool, a motif-based melody landing on chord tones on strong beats, a bass line, an arpeggio or
  music-box counter-line, soft percussion by mood.
* **Instruments**: warm pad (detuned triangles through a lowpass), music box (sine + 3rd harmonic
  with a fast decay), flute (sine with vibrato and breath noise), plucked bass, shaker and soft
  kick from filtered noise.
* **Moods**: title, glen day, glen night, each biome, dungeon, cave, battle, boss, festival. Moods
  crossfade on change. Rain adds a filtered-noise rain bed.
* ~40 SFX: steps, tools per material, harvest, pickups, UI, level up, battle hits per element.

---

## 15. Save and load

* **Autosave** every time you sleep (and on entering the Glen from a dungeon).
* **Three manual slots** from the menu, each showing name, village, day, season and play time.
* **Export** a save as a `.json` file and **Import** one back (menu → Save & Load).
* The save stores the seed plus state deltas (world edits, farm, village, villagers, quests,
  inventory…) — the land itself is regenerated from the seed on load.
* `localStorage` access is guarded; the game plays fine without it.

---

## 16. Rendering

* One canvas; the backing store is the game's pixel buffer sized so CSS scales it by a **whole
  number of device pixels** (crisp pixels on every phone). The view shows ~12 tiles across the
  short side of a phone and ~26 on a desktop.
* Ground is pre-rendered into 16×16-tile chunk canvases; objects, characters and monsters are y-sorted.
* Day/night tint, lamp glows at night, rain/snow particles, darkness with a light radius
  underground, a gentle bob on glimmers and forage.
* The battle scene is drawn on the same canvas; menus and HUD are DOM.

---

## 17. Architecture

```
js/
  main.js            boot, loop, screen state machine
  core/              rng + noise, event emitter, small utils
  data/              items, crops, recipes, buildings, jobs, monsters, story, dialogue templates
  gen/               world, dungeon, names, villagers, monsters, job postings, art (sprites)
  sim/               Game class + systems: time, farm, animals, inventory, craft, shop, village,
                     board, quests, combat, dungeon runtime, movement, save
  render/            view scaling, world/dungeon renderer, battle renderer, minimap
  ui/                HUD, panels (inventory, craft, shop, build, board, mayor, journal, map,
                     settings, save/load), dialogue box, battle menu, character creator, title
  input.js           keyboard + touch joystick/buttons
  audio.js           composer, sequencer, SFX
```

The **sim** never touches the DOM or `Math.random`; it runs in Node. UI and renderer read the Game
and call its methods; the Game emits events (`toast`, `sfx`, `dialog`, `battle`, `levelup`…) that
the UI turns into feedback.

---

## 18. Verification plan

* `dev/gentest.mjs` — determinism; reachability with/without each relic; dungeon connectivity; over 20 seeds.
* `dev/simtest.mjs` — farming, animals, crafting/refining/cooking, shop, village levels, applicants and building, job board assignment, combat math and a bot winning fights, quest progression through the whole main quest via the sim API, save/load round-trip.
* `dev/mobiletest.mjs` — emulated phone driven only by touch: creator → game → joystick walk → A button chops → menus → battle → save; control sizes and overlap; portrait and landscape.
* `dev/shots.mjs` — screenshots of every screen at phone and desktop sizes; fails on console errors.

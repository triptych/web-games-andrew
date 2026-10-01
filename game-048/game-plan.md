# Lanterndeep — The Hundred Stairs

**Genre:** Turn-based roguelike dungeon crawler (Pixel Dungeon / DCSS lineage) with a 3D presentation
**Engine:** three.js r165 (ES modules via import map) over a pure, seeded JavaScript simulation
**Target:** desktop (keyboard / mouse) and phones in portrait or landscape (tap-to-move, buttons ≥ 44 px)
**Assets:** none — every texture, model, sound and song is generated in code
**Status:** v1.0 — design below, implementation in `js/`

---

## 1. Pitch

Lastlight is a mountain town built on the rim of the Deep, a shaft that drops through ten buried
worlds. At the bottom hangs the **First Lantern**, and its light, rising up the shaft, is the only
thing that keeps the **Hush** — a living, patient darkness — from climbing out.

A year ago the Lantern began to gutter. **Maren**, the town's Keeper and your teacher, went down to
tend it and never came back. Tonight the lamps of Lastlight went out one street at a time. You take
the spare lantern from her workshop and start down the Hundred Stairs.

Each step is a turn. Each floor is new. Your lantern is your light radius, your clock and your
lifeline — and it is running out of oil.

**100 floors** in **10 worlds** of 10 floors each. Every 10th floor is a **Warden** fight: a
multi-phase boss who guards one of the ten **Embers** the Hush stole from the First Lantern.
Every Ember you take back makes your own lantern burn wider.

---

## 2. Story — *The Hundred Stairs*

### Frame
- **Prologue** (title → first floor): Lastlight going dark; Maren's empty workshop; her lantern.
- **Each world** opens with a chapter card (title + a paragraph of narration).
- **Maren's journal**: one page hidden on a random floor of every world (never a Warden floor).
  Pages are written in her voice and tell her descent one world ahead of yours. Collecting all
  ten unlocks the true ending.
- **Each Warden** speaks before the fight and after defeat. Every Warden was once something the
  Deep loved — a guardian, a keeper, a creature of light — that the Hush hollowed out.
- **Wayfarers** (quest-givers) are other people the Deep swallowed; their lines are templated
  per world so they always fit where you are.

### Worlds

| # | Floors | World | Look | Warden |
|---|--------|-------|------|--------|
| 1 | 1–10 | **The Rootcellars** | earthen tunnels and old cellar vaults under Lastlight, tree roots through the ceiling | **Gnawbone, the Rat King** — a crown of rats tangled by their tails |
| 2 | 11–20 | **Mirelight Grotto** | bioluminescent fungus caves, still pools | **Mother Mycel** — a fungal matriarch the size of a house |
| 3 | 21–30 | **The Drowned Library** | flooded archive, shelves, ink-dark channels | **The Archivist** — a librarian who catalogued the dark until it catalogued him |
| 4 | 31–40 | **The Ember Forge** | dwarven forge halls split by lava | **Forgemaster Brann** — the last smith, welded into his own armour |
| 5 | 41–50 | **Crystal Hollows** | geodes, prisms, light that bends | **The Prism Wyrm** — a dragon of living glass that eats light |
| 6 | 51–60 | **The Ossuary** | bone catacombs, sarcophagi, candle niches | **Lady Vesper** — the queen of the dead, who keeps singing their names |
| 7 | 61–70 | **Clockwork Depths** | brass halls of a machine that measures the dark | **The Grand Orrery** — a planetarium that forgot which way is up |
| 8 | 71–80 | **Frostveil Abyss** | black ice, frozen falls, aurora | **Queen Isolde of the Rime** — who froze her court so nothing would change |
| 9 | 81–90 | **The Starfall Vault** | ruins adrift in a starfield, void chasms | **The Watcher Between** — an eye that has seen what lies under the Deep |
| 10 | 91–100 | **The Heart of Night** | obsidian, black fire, the First Lantern's cage | **The Hush** — three phases |

### The turn
From world 6 Maren's pages change: she found the Hush is not an invader but the Lantern's own
shadow — every light casts one, and the brighter the Lantern burned, the longer its shadow grew.
At the Heart of Night the Hush wears Maren's shape (phase 1), then the town's (phase 2), then its
own (phase 3). Maren is alive inside the Lantern's cage, burning as its wick.

### Endings (chosen after the Hush falls)
- **The Keeper's Vigil** — you take Maren's place as the wick. She climbs home; you burn.
- **Maren's Rest** — Maren stays; you carry her last words up the Hundred Stairs.
- **The Long Dawn** *(needs all ten journal pages)* — Maren's pages taught you that ten Embers
  are enough to light the Lantern without a wick. You set them in the cage; you climb home
  together, and the sun over Lastlight comes up for the first time in a year.

---

## 3. Core rules

### Turns & time
- Grid-based, 8-directional movement. Every action costs **energy**; normal actions cost 100.
- Actors have a **speed** (100 normal, 50 slow, 200 fast). After the player acts for `c`
  energy, each monster gains `speed × c / 100` energy and acts once per 100 it holds.
- Haste halves the player's action cost; slow doubles it.

### The Lantern (resource clock)
- **Oil** 0–100 (max raised by perks/items). Drains 0.1 per turn (≈ 1,000 turns per full lamp).
- **Light radius** = 3 + one per two Embers (max 8), −1 below 25 % oil, = 1 at 0 oil.
- Out of oil, the **Hush gathers**: 1 damage every 6 turns and monsters gain +15 % accuracy.
- Oil flasks restore 40. Braziers you light stay lit for the floor.

### Field of view
- Recursive shadowcasting to radius 12. A tile is **visible** if it is in line of sight and
  either within the lantern radius **or** lit by a static light (brazier, lava, crystal,
  glowing fungus). Lit rooms can be seen from across a hall; dark corridors cannot.
- Tiles become **remembered** once seen (drawn dim and desaturated); unseen tiles are black.

### Combat
- Accuracy vs evasion: `hit = clamp(75 + acc − eva, 10, 97) %`.
- Damage roll from the weapon range × (1 + might bonus), minus armor (min 1).
  Crits (5 % + bonuses) deal ×1.75.
- Status effects: **burn** (dot, spreads to grass), **poison** (stacking dot), **bleed**,
  **frozen** (skip turns), **stunned**, **rooted**, **weakened** (−30 % damage),
  **marked** (+50 % damage taken), **haste**, **regen**, **shielded** (damage reduction),
  **invisible**.
- Ranged weapons (bow, crossbow, staff) attack any visible enemy in range with line of fire.

### Death
Two modes chosen at a new run:
- **Lantern** (default): death offers *Rekindle* — restart at the first floor of the current
  world with the hero as they were when they entered it (a checkpoint snapshot).
- **Ironwick**: permadeath. The save is deleted.

---

## 4. Heroes

| Class | HP | Start gear | Skills (unlock at level 1 / 3 / 6 / 10) |
|---|---|---|---|
| **Warden** — shield and steel | 42 | Sword, chain shirt | **Cleave** (hit all adjacent) · **Shield Bash** (stun 2, knock back) · **War Cry** (weaken + fear foes within 3) · **Bulwark** (−70 % damage for 4 turns) |
| **Ranger** — eyes in the dark | 32 | Shortbow, leather | **Volley** (shoot up to 3 targets) · **Pinning Shot** (damage + root 3) · **Tumble** (leap up to 3 tiles) · **Mark Prey** (+50 % damage taken, reveals map around it) |
| **Emberwitch** — fire kept in a jar | 26 | Ember staff (bolt range 5), robe | **Firebolt** (damage + burn) · **Frost Nova** (freeze radius 2) · **Blink** (teleport to a visible tile ≤ 5) · **Meteor** (3×3 blast, 1-turn telegraph) |

Skills have cooldowns in turns and scale with level and spell power. Targeted skills enter a
**targeting mode** (tap a monster/tile, or press the skill key again for the nearest enemy).

### Levelling
XP from kills and quests. Each level: +HP and stats by class, plus a choice of **one of three
perks** from a pool of ~30 (e.g. *Thick Skin* +2 armor, *Lamplighter* oil drains 30 % slower,
*Vampiric* heal on kill, *Quick Hands* −1 cooldown, *Second Wind*, *Treasure Sense*, *Keen Edge*
crit, *Pyromaniac* burns last longer, *Pathfinder* see traps…). Perks can stack where it makes
sense (ranks).

---

## 5. Items & treasure

- **Slots:** weapon, armor, ring, amulet. **Pack:** 20 slots, consumables stack.
- **Rarity:** Common (no affix) · Magic (1 affix) · Rare (2–3 affixes, generated name) ·
  **Relic** (authored uniques, one per world, guaranteed from that world's Warden).
- **Weapons:** dagger, sword, axe, mace, spear, greatsword, bow, crossbow, staff — base damage
  scales with item level (= floor).
- **Armor:** robe, leather, chain, plate (plate costs evasion). **Trinkets:** ring, amulet.
- **Affixes (~22):** +damage %, +accuracy, +crit, lifesteal, burn/freeze/poison on hit,
  +max HP, +armor, +evasion, regen, +light radius, oil efficiency, +spell power, −cooldowns,
  thorns, +gold find, fire/frost/poison resist, +XP.
- **Consumables:** healing draught, greater healing, oil flask, antidote, haste potion,
  potion of might (permanent +1 might), scroll of mapping, teleport, warding (shield),
  fire bomb (thrown 3×3), frost bomb, vault key.
- **Treasure:** gold piles, chests (some are **mimics**), and one **vault** on some floors —
  a room behind a sealed door whose key is elsewhere on the floor, holding better loot.
- **Merchants** appear on floor 5 of every world and sometimes elsewhere: buy, sell, and refill
  oil.
- **Shrines** (pray: random blessing, rarely a curse) and **fountains** (heal once).

---

## 6. Monsters

Every world has a bestiary of 6–7 species built on behaviour **archetypes**:

| Archetype | Behaviour |
|---|---|
| brute | slow, hits hard |
| skirmisher | fast, weak, flanks |
| pack | spawns in groups of 3–5 |
| archer | keeps 3–5 tiles away, shoots |
| caster | ranged spell that applies a status |
| bomber | runs at you, fuse telegraphs a 3×3 blast next turn |
| tank | high armor, slow |
| summoner | calls minions every few turns |
| ambusher | dormant (mimic, burrower) until you are adjacent |
| charger | telegraphs a line, then charges along it |
| healer | heals wounded allies |

**Procedural variation:** each monster rolls size, tint and stat jitter from its species
genome; from floor 3, ~10 % are **elites** with 1–2 affixes (*Swift, Vampiric, Armored, Burning,
Frostbound, Thorned, Splitting, Regenerating, Volatile, Phasing*) and a generated name
("Skrell the Volatile"). Monster level = floor; HP and damage scale with depth.

**Models** are built from primitives by body plan (quadruped, biped, blob, floater, serpent,
spider, skeleton, construct, eye) and the species palette — no two worlds share a look.

---

## 7. Wardens (every 10th floor)

All Warden attacks are **telegraphed**: marked tiles glow red one turn before they resolve,
so every fight is a dance on a grid. Phases change at 66 % and 33 % HP.

| Floor | Warden | Signature |
|---|---|---|
| 10 | Gnawbone, the Rat King | summons rat swarms; burrows and erupts under a marked 3×3 |
| 20 | Mother Mycel | spore bursts (rings), spore-pod bombers, lingering poison tiles |
| 30 | The Archivist | blinks around the hall; rune lines along rows/columns; animated tomes |
| 40 | Forgemaster Brann | hammer cross-slams; molten floor that spreads; heat haste in phase 3 |
| 50 | The Prism Wyrm | full-length beams on rows and columns, then diagonals |
| 60 | Lady Vesper | raises skeletons from bone piles; life-drain bolt; rings of the danse macabre |
| 70 | The Grand Orrery | rotating beam arms from the centre; drone summons; arms multiply |
| 80 | Queen Isolde | ice patches that freeze; blizzard scatter; ice wolves |
| 90 | The Watcher Between | gaze beam aimed at you; blink; void-collapse ring with a safe heart |
| 100 | The Hush | phase 1 Maren's shape (mirrors your class skills); phase 2 the dark (radius 2, shades); phase 3 all patterns |

The stairs down only appear when the Warden falls. A Warden drops its world's **Ember**
(+light) and **Relic**.

---

## 8. Floors (procedural generation)

- Size grows with depth: 44×32 at floor 1 → 64×46 at floor 99.
- Generators, weighted per world: **rooms** (rooms + corridors + loops + doors),
  **caves** (cellular automata, largest region kept, pockets tunnelled in), **halls**
  (a grid of rooms — library, catacomb, clockwork), **mixed** (rooms carved into caves).
- Features: shallow water, deep water, lava, chasms, bridges, pillars, decor props per world,
  braziers, wall torches, glowing fungus/crystals (static lights).
- **Traps** (hidden until spotted; search or *Pathfinder*): spikes, fire vent, poison gas,
  alarm, teleport.
- Placement: stairs up/down far apart (BFS), monsters away from the start, items/chests/gold,
  braziers, one quest giver on ~45 % of floors, a shrine or fountain, a vault on ~20 %.
- **Validation:** every floor tile reachable from the start, stairs reachable without keys;
  re-roll on failure.
- **Warden arenas** are authored shapes with procedural dressing.

---

## 9. Quests (procedural)

A **Wayfarer** on a floor offers one quest when bumped. Types:

| Quest | Goal | Notes |
|---|---|---|
| **Bounty** | slay a named elite on this floor | spawns the elite |
| **Cull** | kill N of a species | counts from acceptance (baseline snapshot) |
| **Lost Heirloom** | find an item and bring it back | or keep it — it's good |
| **Rescue** | free a captive, who then fights beside you; reach the stairs with them alive | an ally AI |
| **Kindle** | light every unlit brazier on the floor | lighting expands lit areas |
| **Purge** | destroy monster nests | nests spawn until destroyed |

Rewards: gold, XP, an item one rarity tier up, oil, or (rarely) a perk.
The **Journal** lists active/finished quests and the main story objective.

---

## 10. Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Move / attack | arrows, WASD, numpad, QEZC diagonals, vi-keys | tap a tile (walks there step by step; stops when a monster appears) · tap an enemy to attack/shoot |
| Wait / search | `Space`, `.`, `5` | ⏳ button |
| Auto-explore | `X` | 🧭 button |
| Descend / travel to stairs | `>` or `Enter` on stairs | ⤵ button |
| Skills | `1`–`4` | skill buttons |
| Fire ranged | `F` (nearest) / `Tab` cycle | tap enemy |
| Inventory / map / journal | `I` / `M` / `J` | 🎒 / 🗺 / 📜 |
| Pause | `Esc` / `P` | ❚❚ |
| Zoom | wheel | pinch |
| Inspect | right click / hover | long-press |

---

## 11. Architecture

```
game-048/
├── index.html            import map, DOM HUD/screens
├── style.css
├── js/
│   ├── main.js           boot, mode machine, frame loop, event drain
│   ├── input.js          keyboard, tap/long-press/pinch → actions
│   ├── audio.js          procedural SFX + per-world generative music
│   ├── save.js           localStorage run save / checkpoint / records
│   ├── sim/              PURE: no three, no DOM, no Math.random
│   │   ├── rng.js        seeded mulberry32 whose state lives in the save
│   │   ├── worlds.js     ten worlds, palettes keys, bestiaries, story text
│   │   ├── monsters.js   species, archetypes, elite affixes, spawning
│   │   ├── items.js      bases, affixes, rarity, loot tables, relics, names
│   │   ├── classes.js    heroes, skills, perks
│   │   ├── dungeon.js    floor generators, features, placement, validation
│   │   ├── fov.js        shadowcasting + static light map
│   │   ├── path.js       BFS, A*, Dijkstra maps, auto-explore
│   │   ├── game.js       run state, turn engine, combat, statuses, items
│   │   ├── ai.js         monster behaviours
│   │   ├── bosses.js     ten Wardens
│   │   ├── quests.js     quest generation and tracking
│   │   └── bot.js        autoplayer for tests
│   ├── view/             three.js
│   │   ├── scene.js      renderer, camera rig, lights, post (bloom + grade)
│   │   ├── textures.js   canvas-painted floor/wall/prop textures per world
│   │   ├── level.js      instanced tiles, liquids, props, fog-of-war shader patch
│   │   ├── actors.js     hero + procedural monster/boss models, animation
│   │   └── fx.js         particles, projectiles, telegraphs, damage numbers
│   └── ui/
│       ├── hud.js        bars, skill buttons, log, boss bar
│       ├── screens.js    title, class pick, story cards, level-up, death, ending
│       ├── panels.js     inventory, shop, quest dialogue, journal
│       └── minimap.js    canvas minimap
└── dev/
    ├── simtest.mjs       bot plays whole runs headlessly; invariants; determinism; purity
    └── browsertest.mjs   Playwright walk of every screen, desktop + phones
```

**Rules (from the collection's learnings):**
- `js/sim/` is pure and seeded; a node bot can play it. The view reads state and plays back the
  sim's event queue; animation never decides outcomes.
- RNG state is part of the run, so a save resumes the exact same dungeon.
- Story effects live in the sim (journal pages, Embers, endings), not in the UI.
- The event queue is bounded. `[hidden]{display:none!important}`. Game-prefixed storage keys.
- `Math.min(dt, 0.05)` frame cap, `updateProjectionMatrix()` on resize, pixel ratio ≤ 2,
  quality tiers with auto-downgrade (disabled under `?debug=1`).
- Fog of war is a `DataTexture` sampled by every level material (smooth reveal) — one
  `onBeforeCompile` patch shared by floor, wall and prop materials.
- Walls between the camera and the hero are cut down in the vertex shader so the hero is never
  hidden.

---

## 12. Phases

1. ✅ Design (this document)
2. ✅ Simulation: generators, FOV, turns, combat, items, monsters, quests, Wardens, bot + simtest
3. ✅ View: textures, instanced level, fog shader, actors, fx, post-processing
4. ✅ UI, input (keyboard, tap, pinch), audio, save/checkpoints, story screens
5. ✅ Browser test on desktop and phones, launcher entry, docs

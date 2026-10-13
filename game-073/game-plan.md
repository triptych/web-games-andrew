# RUNEBORE — The Delve of Old Thimble

**Genre:** Mining / exploration with a full story (Motherload-style digging, high fantasy)
**Engine:** three.js r165 (ES modules via import map); everything else vanilla JS, DOM and Web Audio
**Target:** any screen from a 360 px phone (portrait or landscape) to a desktop monitor
**Status:** Complete — v1.0.2

---

## Concept

You arrive in the hill-town of Emberwick with the key to your grandmother's shed. Maren Ashdown was the finest delver the Guild ever knew; nine years ago she went into the Hollowdeep and never came back. In the shed you find her digging automaton, **Thimble** — a brass barrel on treads with an auger for a nose and a cracked rune-core for a heart — and it wakes.

The Lumen Spire, the beacon that has kept the frost-dark out of the north for nine hundred years, is fed by the Wyrmheart at the root of the world, and it is dimming. Dig down through six strata, sell what you find, upgrade Thimble at the Forge, and recover the **seven relics** the dwarves scattered when Kharadun fell. Each relic slots into Thimble's heartcore, wakes a new power, and restores a memory — until you learn who is really inside the automaton, open the Rune Gate, and free the wyrm that has been eating the Heart's light.

Everything — tiles, models, portraits, music and sound — is generated in code at load. No image or audio files.

---

## Core mechanics

### 1. Digging (Motherload rules)
- Push **down** to drill the tile below, **sideways into a wall** to bore through it. You can't drill **up**: fly up the shafts you dig with the vanes.
- Thimble must be standing on something to drill. Drilling takes time by the rock's hardness and the auger's speed; an auger can only cut rock up to its power + 1.
- Ore goes into a cargo hold of limited size. A full hold loses whatever you dig next.

### 2. Aether and hull
- **Aether** (fuel) burns while underground, faster when flying or drilling. Run dry and Thimble stops.
- **Hull** takes damage from falls, bogwind explosions, magma, falling boulders, the Emberdeep's heat, gloam-wisps and the wyrm.
- Either failure calls the **Guild crane**: you're hauled to the surface, lose your cargo and 15% of your crowns. Never a game over.

### 3. Strata (36 × 400 tile world, generated from a seed)
| Depth | Stratum | Hardness | Character |
|---|---|---|---|
| 0–39 | The Rootloam | 1 | soft soil, copper and tin, fairy mushrooms |
| 40–89 | The Greystone Halls | 2 | slate, dwarf watch-halls, iron and silver, warded runestone |
| 90–149 | The Glimmerdeep | 3 | crystal caverns, moonquartz |
| 150–219 | Sunken Kharadun | 4 | the drowned dwarf-city: brick halls, coffers, gold, sapphire, a waystone |
| 220–289 | The Emberdeep | 5 | basalt, magma pools, heat that cooks an unwarded hull |
| 290–367 | The Gloam | 6 | black rock, gloam-wisps that drain aether, the second waystone |
| 368 | The Rune Gate | — | opens only to the Starforged Lance |
| 369–396 | The Wyrmheart | — | the final chamber |

Hazards: **bogwind** pockets explode (and chain), **boulders** fall when undermined, **runestone** only yields to blast runes, **magma** burns, **heat** below 220.

### 4. Relics — the magical treasures
Each sits in a brick vault at a known depth and upgrades Thimble's heartcore:

| Relic | Depth | Power |
|---|---|---|
| The Lumen Lens | 30 | Ore-sight: ores, relics and bogwind glimmer through the dark nearby |
| The Featherfall Sigil | 76 | No fall damage, stronger vanes |
| The Dwarven Heartgear | 126 | Drill 40% faster |
| The Hollowing Satchel | 186 | Cargo ×1.5 |
| The Salamander Scale | 252 | Immune to heat, magma halved |
| The Heart of Kharadun | 316 | Hull mends itself, aether burns slower, wisps flee the light |
| The Starforged Lance | 356 | +1 drill power; opens the Rune Gate and breaks the wyrm's heart-shards |

Every relic is visible on the model (a lens hood, silver feathers, a spinning red-gold gear, a purple pouch, a red scale plate, a pink heart in the dome, a golden lance).

### 5. The town of Emberwick
| Building | Who | What |
|---|---|---|
| The Aether Well | — | refuel |
| Sedge's Assay House | Sedgewick Thorne, elf assayer | sell ore; appraise finds |
| Fennick's Forge | Pell Fennick, gnome tinker (who built Thimble) | repairs; 7 upgrade lines (auger, hull, tank, vanes, cargo, lantern, frostward), 5–6 tiers each |
| The Lumen Spire | Brother Ansel, Lamplighter | waystone travel; the Spire's light follows your progress |
| The Delvers' Guild | Orla Brask, dwarf Guildmistress | the main story; the contract board |
| Runes & Remedies | Mirabel Hask, hedge-witch | blast rune, great blast rune, recall scroll, mending draught, aether flask |

Two deep **waystones** (Kharadun, 200; the Gloam, 338) wake when you stand on them: refuel and repair at a markup, and travel to and from the Spire.

### 6. The Gloamwyrm
Below the Gate, the wyrm Ysmereth, possessed by the Gloam, prowls a 28-row chamber: it **winds up and lunges**, **spits homing orbs**, and its body hurts on contact. Four **heart-shards** are set in the chamber walls; drill each with the lance. A blast rune to the head stuns it. Each broken shard makes it faster. When all four break, the shadow burns off, the wyrm turns gold, and the Wyrmheart appears on the floor.

---

## Story

Eleven chapters, told through dialogue scenes with procedurally painted portraits, Thimble's "barks" while you dig, Maren's journal pages found in the rock, and a Codex.

0. **The Letter** — Thimble wakes; Orla grants your license.
1. **First Delve** — dig 15 fathoms, sell ore.
2. **A Glint in the Loam** — the Lumen Lens. Thimble's first clear memory: two girls at a shaft, sixty years ago.
3. **The Grey Halls** — the Featherfall Sigil. Corvin Dask, a rival in a steam rig, sneers. A memory of a baby — your mother.
4. **Glimmer and Gloom** — Brother Ansel and the legend of the Heart; the Heartgear; Thimble remembers being built by Pell.
5. **Sunken Kharadun** — the Hollowing Satchel and the waystone; Orla confesses she turned back at Kharadun's gate and found Thimble alone at the shaft nine years ago.
6. **Ember and Ash** — rescue Corvin from his wreck; the Salamander Scale and Maren's unsent letter to you.
7. **Into the Gloam** — the Heart of Kharadun. **Thimble is Maren**: she bound her spirit into the automaton so the knowledge of the keys would reach home. You choose how to greet her. Orla and Maren meet again.
8. **Starforged** — the Lance; the Rune Gate falls.
9. **The Gloamwyrm** — break the four shards.
10. **The Wyrmheart** — Ysmereth, freed, offers Maren a choice: rest, or stay in the brass shell. You choose together. The Spire blazes.
11. **Epilogue** — cards for the ending you chose, a ledger of your delve, then free delving.

Side content: 12 Guild contracts, 13 finds (7 artifacts with Sedge's appraisals, 6 journal pages), 30 Codex entries, idle chatter for every townsperson that changes with the chapter.

---

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Drive / bore sideways | ← → / A D | stick, d-pad | drag the stick sideways |
| Fly (vanes) | ↑ / W / Space | stick up, d-pad up, RT | drag up |
| Drill down | ↓ / S | stick down, d-pad down, LT | drag down |
| Enter a building / waystone | E / Enter | A | the glowing Enter button |
| Items | 1–5 | X blast, Y mend, LB recall, RB flask | rune buttons |
| Journal / map | J (M for the map) | Back | ❦ button |
| Pause | P / Esc | Start | ❚❚ button |

The touch stick is a floating stick on the left 58% of the screen; the rune buttons sit at bottom right for the right thumb. The Enter button moves above them on touch layouts.

---

## Rendering (three.js)

- **Tiles**: one `InstancedBufferGeometry` box per visible tile (≈500–1200 instances), with a custom `ShaderMaterial`. Per-instance attributes give the atlas cells (rock and an overlay), glow, crack progress, ambient and flags. The shader lights everything with Thimble's lantern (radius from the Lantern upgrade), adds emissive glow for gems, the Lens's ore-sight halo, and drill cracks. Only the rows in view are written each frame.
- **Back wall**: one plane behind the tunnels whose shader picks each cell's stratum from a `DataTexture`.
- **Atlas**: 1024² canvas, 64 px cells: 7 strata × 4 variants of rock, back walls, grass, 13 ores, hazards, relic vaults, bricks, the gate, shards, coffers, waystones, the wreck, the Heart and a crack mask.
- **Thimble**: ~40 primitives with a riveted brass canvas texture, spinning auger that points down when drilling, vanes that spin up with thrust, a swinging lantern with a `PointLight`, and a part for each relic.
- **Emberwick**: timber-framed and stone buildings, a 12-unit Spire whose crystal and sky-beam brighten with each relic, a guild headframe, townsfolk, signs, smoke, a gradient sky with sun and stars, three ranges of hills, drifting clouds.
- **FX**: pooled additive and soft particle `Points` (dust, sparks, aether exhaust, explosions, smoke) and instanced lit debris cubes.
- **The wyrm**: instanced body segments and fins along a distance-sampled trail, a head with jaw, horns and eyes, a halo and its own light; shadow-violet to gold as it dies.
- **Post**: `EffectComposer` → `UnrealBloomPass` (half resolution) → `OutputPass`; a "Fast" setting turns it off.

## Sound (Web Audio)

Loops follow Thimble: a grinding auger (band-passed noise + wobbling saw, pitched by hardness), the vanes' whoosh and hum, heat sizzle, surface wind and a cave rumble. One-shots for every event (ore bells pitched by ore value, coffers, explosions, boulders, the relic choir swell, the wyrm's roars, shards shattering). A look-ahead sequencer generates music per zone — a lute-and-flute Dorian tune in town, a different mode, tempo and timbre per stratum (glassy Lydian bells in the Glimmerdeep, horns in harmonic minor in Kharadun, whole-tone drones in the Gloam), a 132 BPM drum-driven fight, and a major hymn for the ending. Dialogue lines tick with a voice pitch per speaker.

---

## Module overview

| File | Responsibility |
|---|---|
| `js/config.js` | all data: strata, ores, relics, artifacts, upgrades, items, buildings, physics |
| `js/rng.js` | seeded PRNG and value noise |
| `js/sim/world.js` | world generation and tile queries |
| `js/sim/game.js` | physics, drilling, hazards, wisps, items, shops, rescue, save format |
| `js/sim/boss.js` | the Gloamwyrm |
| `js/sim/story.js` | cast, scenes, chapters, contracts, codex, barks, epilogue |
| `js/sim/bot.js` | an autoplayer that plays the whole story (tests and `?debug=1`) |
| `js/view/*.js` | three.js: textures, terrain, Thimble, town, FX, wyrm/wisps/boulders, view |
| `js/audio.js` | procedural sound and music |
| `js/input.js` | keyboard, gamepad and touch stick |
| `js/ui.js` | HUD, dialogue, shops, journal and map, screens |
| `js/save.js` | guarded `localStorage` saves and settings |
| `js/main.js` | modes, the fixed-step loop (1/120 s), event routing, autosave, debug hooks |

`js/sim/` and `js/rng.js` are pure: no DOM, no three.js, no `Math.random`.

---

## Balance

Measured with the bot (`dev/simtest.mjs`, which knows where the relics are and never wastes a trip): the whole story takes it **39–47 sim-minutes** with 0–1 crane rescues and ~200k crowns earned; the wyrm takes it ~2.5 minutes. A person exploring blind should take roughly 2–3 hours. Upgrade prices were raised ×1.6 and ore density cut after the first bot runs finished in 19 minutes.

---

## Changelog

### 1.0.2 (2026-10-13)
- Portraits: beards are a full beard and moustache instead of a crescent that read as a giant grin (Orla, Ansel); one smaller, gentler smile for everyone.

### 1.0.1 (2026-10-12)
- The auger spins about its own axis while Thimble drives; it used to swing round the vertical axis (rotation and spin on one mesh, Euler XYZ order). Covered by the browser test.

### 1.0.0 (2026-10-12)
- First release: the full game as described above.
- `dev/simtest.mjs`, `dev/browsertest.mjs`, `dev/play.mjs`.

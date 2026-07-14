# Wayfarer's Path

**Genre:** Endless walker / action RPG with procedural loot
**Engine:** three.js r165 (ES6 modules via import map)
**Target Resolution:** Fullscreen (responsive, `renderer.setSize(innerWidth, innerHeight)`)
**Status:** Phase 2 complete — Phase 3 in progress (pacing + scenery pass done)

---

## Concept

Travel an endless, procedurally generated road on foot. Monsters appear along
the path and are fought in real time with your equipped sword. Defeating them
drops coins and, occasionally, new weapons or armor. New gear is presented
next to your currently equipped item in a side-by-side comparison panel —
each attribute shows an up or down arrow versus what you're currently
wearing — and you choose to equip it or convert it straight to coins.

The road starts easy, with weak, low-level monsters near the start, and gets
harder the farther you walk. Periodically the path leads into a town: a safe
rest stop with a shop where you can cash in coins, sell unwanted gear, and
(later) buy upgrades before setting back out onto the road. Every road
segment, every monster, every item, and every town is procedurally generated
— no two runs look the same.

---

## Core Mechanics

### 1. Endless Procedural Path
The world streams forward in fixed-length chunks (`CHUNK_LENGTH` in
`config.js`). Each chunk is either a **road segment** (open ground, monster
spawns, scenery variation) or a **town segment** (safe zone, shop trigger).
Chunks are generated just ahead of the player and recycled/disposed once far
behind the camera, so the world has no memory limit.

### 2. Auto-Walk / Steering
The player character walks forward automatically along the path at
`WALK_SPEED`; left/right input steers within the road's width to dodge or
approach monsters, rather than controlling forward speed directly — *except*
while combat-locked (see Mechanic 3), when forward auto-walk halts entirely.

### 3. Real-Time Sword Combat & the Combat Arena
Originally monsters were static in world space while the player
auto-walked straight through them — the player couldn't out-swing the
0.35s-cooldown sword against a target that only stayed in range for a
fraction of a second, so most encounters were unwinnable by design. Combat
now locks into an arena: once the player's forward position comes within
`ARENA_LOCK_RANGE` of a live encounter (`main.js` checks
`findEncounterAhead()` every frame), forward auto-walk halts completely
(`state.distance` freezes) and the player gains forward/back movement
(W/S or Up/Down) in addition to left/right steering, confined to
`ARENA_Z_RADIUS` around the lock point (`player.js`'s `setCombatLock()`).
Monsters in an active arena actively chase the player's exact (x, z)
instead of just drifting toward their lane (`MONSTER_CHASE_SPEED` in
`config.js`). The lock releases and forward walking resumes automatically
once every monster spawned in that encounter's chunk is dead
(`isEncounterClear()`). All monsters from one spawn roll cluster tightly
around one point in the chunk (rather than scattering across the full
40-unit chunk length) so every member of an encounter stays reachable
within the arena's fixed radius.

Pressing the attack key swings the equipped sword in an arc; monsters
within range (now checked symmetrically fwd/back, since arena monsters can
end up behind the player) and swing timing take damage. Monsters attack
back on contact/cooldown. Player HP is shown in the HUD; hitting 0 HP ends
the run.

### 4. Procedural Loot & the Comparison UI
Monster kills roll for a coin drop and a chance at an equipment drop (see
`RARITY` in `config.js`). When gear drops, gameplay pauses and
`showLootComparison()` (in `ui.js`) renders the new item next to the
currently equipped item in the same slot, attribute by attribute, with a ▲
(green, better) or ▼ (red, worse) arrow per stat. The player picks **Equip**
or **Sell for N coins** — there is no inventory to manage, keeping the loop
fast.

### 5. Leveling Difficulty
Monster tier is a function of distance travelled (`MONSTER_TIERS` in
`config.js`): higher tiers have more HP, deal more damage, and drop better
coin/loot rewards. The road literally gets more dangerous the farther you
walk from the last town.

### 6. Towns & the Shop
Every `CHUNKS_BETWEEN_TOWNS` road chunks, the path opens into a town — a
guaranteed-safe zone with no monster spawns. Walking into the shop trigger
opens the shop modal, where coins are the only currency: sell any unwanted
gear you're still holding, then continue down the road. (Buying new
gear/upgrades from the shop is a stretch goal — see Open Questions.)

---

## Game Loop

1. Splash screen → press any key / click to start.
2. Player auto-walks forward along the generated road.
3. Monsters appear; player fights them with the sword (steer + attack).
4. Kills drop coins (auto-collected) and sometimes gear (comparison modal,
   game paused while the player decides).
5. Every few chunks, the player reaches a town: shop modal to cash in/sell.
6. Repeat, with monsters scaling up, until player HP reaches 0.
7. Game over screen shows total distance walked and coins collected; press R
   to restart from a fresh seed.

---

## Player Controls

| Action        | Key(s)              |
|---------------|----------------------|
| Steer left/right | A/D or Left/Right Arrow |
| Move fwd/back (combat arena only) | W/S or Up/Down Arrow |
| Attack (swing sword) | Space |
| Pause         | P |
| Restart       | R (from game-over screen) |

Fwd/back movement only does anything while combat-locked (see Combat
Arena below) — outside combat the player auto-walks forward and only
steers laterally.

---

## Progression / Difficulty

- Monster level scales with total distance walked (`MONSTER_TIERS`).
- Item rarity/quality also trends upward with distance (higher-tier
  monsters roll better base stats before the rarity multiplier is applied).
- Towns act as natural checkpoints/breathers between escalating stretches
  of road.

---

## UI / HUD

- **Top-left:** HP (current / max)
- **Top-center:** Distance walked (meters)
- **Top-right:** Coins
- **Loot comparison modal:** two-column panel (Equipped vs. New), attribute
  rows with ▲/▼ arrows, Equip / Sell buttons.
- **Shop modal:** coin balance, sell list (Phase 2), leave button.
- **Game over overlay:** final distance + coins, restart prompt.

---

## Sound Design

Web Audio API only — no file assets.

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Button press / start | Short sine blip |
| Sword Swing | Attack key pressed | Sawtooth sweep, high→mid |
| Sword Hit | Sword connects with monster | Square sweep + noise burst |
| Monster Death | Monster HP reaches 0 | Sawtooth sweep down |
| Player Hurt | Player takes damage | Square sweep, short |
| Coin Pickup | Coin collected | Two-note sine chime |
| Loot Found | Equipment drop appears | Four-note ascending sine arpeggio |
| Game Over | Player HP reaches 0 | Long sawtooth sweep + noise |

---

## Phases

### Phase 1 — Foundation (complete)
- [x] Scaffold: index.html, config, events, state, sounds, scene, ui, main
- [x] Loot comparison modal (generic, slot-aware, works for weapon/armor)
- [x] Shop modal stub
- [x] Procedural path generation (`path.js`) — chunk streaming (ahead/behind
      window), road width + edge markers, town chunk layout with placeholder
      buildings, `chunkSpawned`/`townEntered`/`townExited` events
- [x] Player module (`player.js`) — A/D + arrow-key steering clamped to road
      width, Space to swing sword (arc animated via sword mesh rotation),
      per-swing hit tracking so one swing can't multi-hit a monster,
      camera-follow
- [x] Monster module (`monsters.js`) — spawns per road chunk (chance +
      count from config), tier chosen by distance, simple drift-toward-player
      AI, contact damage on cooldown, death → coin + 25% loot roll
- [x] Loot generation (`loot.js`) — rarity roll from `RARITY` weights, base
      weapon/armor stats scaled by monster tier level and rarity multiplier,
      sale value formula from summed attributes
- [x] Town/shop flow — no separate `town.js`; `path.js` emits
      `townEntered`/`townExited` directly and `main.js` awaits `showShop()`
      from `ui.js` (kept it inline since there was no non-UI shop logic yet)

### Phase 2 — Combat & Loot Loop (complete)
- [x] Sword swing hitbox + monster contact damage
- [x] Coin drop + auto-collect
- [x] Equipment drop → comparison modal → equip/sell wired end-to-end
- [x] Equipped stats actually affect player damage/defense/speed —
      weapon `critChance` rolls a 2x damage crit per hit, weapon
      `attackSpeed` scales the swing cooldown, armor `defense` reduces
      incoming contact damage (floored at 1), armor `maxHp` resizes
      `state.maxHp` on equip (via new `state.equip()`), armor `moveSpeed`
      adds to lateral steer speed
- [x] Pause (P key) — was in the controls table since Phase 1 but never
      wired; now toggles `state.isPaused` and freezes the update loop
- [x] Combat arena — fixed a design bug where monsters were static in
      world space and the player auto-walked straight through them,
      making most encounters unwinnable; see Mechanic 3 above

### Phase 3 — Towns, Shop, Polish
- [ ] Town chunk with distinct visuals (buildings/props) vs. road chunk
- [ ] Shop: sell inventory, maybe buy potions/upgrades
- [ ] Monster variety (2-3 silhouettes/behaviors per tier)
- [ ] Camera polish, hit particles, screen shake on hit/hurt

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `hpChanged` | hp, maxHp | state | ui |
| `coinsChanged` | coins | state | ui |
| `distanceChanged` | distance | state | ui |
| `gameOver` | — | state | ui, main |
| `chunkSpawned` | chunk | path.js | main (drives monster spawn roll) |
| `townEntered` | town | path.js | main (opens shop modal) |
| `townExited` | — | path.js | main |
| `swordSwing` | — | player.js | (unused so far — available for VFX/SFX hooks) |
| `lootFound` | item, saleValue | monsters.js | main (drives comparison modal) |
| `itemEquipped` | slot, item | TODO: equip flow | ui, player stats |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`   | Game state machine (`splash`/`playing`/`gameover`), `animate()` loop, module orchestration |
| `scene.js`  | Renderer, scene, camera, clock, fog, lights — exports live bindings |
| `config.js` | Constants: path chunking, monster tiers, rarity table, equipment slots/attrs |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton — HP, coins, distance, equipped gear |
| `sounds.js` | Web Audio API sound effects |
| `ui.js`     | DOM HUD bindings, loot comparison modal, shop modal |
| `path.js`   | Procedural chunk generation/streaming, town cadence, `chunkSpawned`/`townEntered`/`townExited` events |
| `player.js` | Steering, combat-lock fwd/back movement, sword swing arc/hitbox, per-swing hit tracking, camera-follow |
| `monsters.js` | Spawning (via `chunkSpawned`), chase AI, encounter lock queries, combat, death → loot roll |
| `loot.js`   | Item generation, rarity, sale value |

Town/shop flow has no dedicated `town.js` — `path.js` owns the trigger
(town chunk enter/exit) and `main.js`/`ui.js` own the modal. Revisit this
split if the shop grows real buy logic in Phase 3.

---

## Open Questions

- [x] Fully auto-walk (only steer + attack) vs. WASD forward movement?
      Resolved as a hybrid: auto-walk + steer between encounters (keeps the
      endless pacing), but forward/back (WASD) unlocks during a combat
      arena so the player can actually chase/dodge monsters instead of
      auto-walking straight through them — see Mechanic 3.
- [ ] Should the shop allow *buying* new gear/potions, or stay sell-only?
- [ ] Cap on how many pending loot drops can queue up if the player declines
      to stop (probably: combat pauses immediately on drop, so no queue
      needed).
- [ ] Should unequipped-but-kept items be possible (a small inventory), or is
      "equip or sell, no bag" the whole design (current assumption, per the
      request)?

---

## Changelog

### Phase 1 — Scaffold (2026-07-11)
- Initial scaffold: index.html, config, events, state, sounds, scene, ui, main
- Built out the loot comparison modal and shop modal as functional
  components (not just stubs) since they're central to the concept
- game-plan.md fleshed out with path/monster/loot/town design ahead of
  implementation

### Phase 1 — Foundation complete (2026-07-12)
- `path.js`: chunk streaming (generate-ahead/dispose-behind window), road
  width + edge markers, town chunks every `CHUNKS_BETWEEN_TOWNS` with
  placeholder buildings; emits `chunkSpawned`/`townEntered`/`townExited`
- `player.js`: A/D + arrow-key lateral steering clamped to the road,
  Space-to-swing sword with an animated arc and per-swing hit tracking
  (a `Set` of already-hit monster refs, cleared each swing) so a single
  swing can't tick damage across multiple frames — caught and fixed this
  as a real bug during review, not just a hypothetical
- `monsters.js`: spawns off `chunkSpawned` (road chunks only), tier chosen
  by the chunk's distance, simple drift-toward-player-lane AI, contact
  damage on a cooldown, death rolls coins + 25% chance of `loot.js` gear
  via `lootFound`
- `loot.js`: rarity roll from `RARITY` weights, weapon/armor base stats
  scaled by monster tier level and rarity multiplier, sale value from
  summed attributes
- Removed the placeholder ground plane from `scene.js` — `path.js` now
  owns all ground/road geometry per chunk
- `main.js` wired end-to-end: `chunkSpawned` → monster spawn roll,
  `townEntered` → await shop modal, `lootFound` → await comparison modal
  and equip/sell, render loop now calls `updatePath`/`updatePlayer`/
  `updateMonsters` every frame while `mode === 'playing'`
- Did not add a separate `town.js` — town trigger logic lives in
  `path.js` (it already tracks which chunk the player occupies) and the
  shop modal itself lives in `ui.js`; revisit only if buy-logic in
  Phase 3 needs a home
- Not yet verified live in a browser this session (no headless browser
  driver available); user runs via VS Code Live Server at
  `http://127.0.0.1:5501/game-029/index.html` — needs an eyeball pass

### Phase 2 — Combat & loot stat wiring (2026-07-13)
- Turned out most of Phase 2's checklist (sword hitbox, contact damage,
  coin drop, comparison-modal equip/sell) was already built during the
  Phase 1 pass — the real gap was that equipped items' stats were inert.
  `state.equipped.weapon/armor` got set on equip but nothing ever read
  `critChance`, `attackSpeed`, `defense`, `maxHp`, or `moveSpeed`.
- `state.js`: added `equip(item)` — re-derives `maxHp` from
  `STARTING_HP + armor.maxHp` on every armor equip (not incremental, so
  swapping armor can't double-count a previous bonus); `takeDamage()`
  now subtracts armor `defense` from incoming damage, floored at 1 so
  defense can't fully negate a hit.
- `monsters.js`: replaced the flat `_currentWeaponDamage()` with
  `_rolledWeaponDamage()` — rolls the equipped weapon's `critChance` for
  a 2x damage crit per swing hit.
- `player.js`: swing cooldown now divides by weapon `attackSpeed`
  (bare-handed baseline 1.0); lateral steer speed adds armor
  `moveSpeed` on top of `PLAYER_STEER_SPEED`.
- Added the Pause control (P key) — it had been sitting in the controls
  table since Phase 1 planning but nothing implemented it. Toggles
  `state.isPaused` and a `'paused'` mode that the render loop already
  treated as "don't update" (only `mode === 'playing'` drives updates);
  `ui.js` gained `showPaused()`/`hidePaused()` reusing the splash/game-
  over message overlay.
- Did not add crit/defense visual or sound feedback (e.g. a distinct
  crit hit sound) — deferred to Phase 3 polish pass alongside hit
  particles and screen shake.
- Not verified live in a browser this session per user request (skipped
  Playwright setup) — still needs an eyeball pass via Live Server at
  `http://127.0.0.1:5501/game-029/index.html`, specifically: equip a
  crit-chance weapon and confirm occasional bigger hits, equip
  high-defense armor and confirm reduced damage taken, and confirm P
  pauses/resumes cleanly mid-fight.

### Combat arena redesign (2026-07-13)
- User-reported bug: monsters were static in world space while the player
  auto-walked straight through them at `WALK_SPEED`, so the ~0.25s sword
  hitbox on a 0.35s cooldown almost never landed enough hits to kill
  anything before the player had already walked past — most encounters
  were effectively unwinnable.
- Redesigned combat as an arena lock rather than a drive-by: `main.js`
  now calls `monsters.js`'s `findEncounterAhead(state.distance,
  ARENA_LOCK_RANGE)` every frame; when it returns a chunk index,
  `state.distance` stops advancing and `player.js`'s `setCombatLock()`
  freezes the player's world Z to that moment (`_lockedZ`) while granting
  a new bounded fwd/back offset (`_zOffset`, ±`ARENA_Z_RADIUS`) driven by
  new W/S + Up/Down input. The lock releases via `clearCombatLock()` once
  `monsters.js`'s `isEncounterClear(chunkIndex)` is true (every monster
  spawned in that chunk is dead), and `state.distance` resumes advancing
  from wherever it was frozen.
- `monsters.js` monster AI changed from "drift toward the player's lane"
  to actively chasing the player's exact (x, z) via `MONSTER_CHASE_SPEED`
  once `updateMonsters(dt, inCombat)` is told combat is locked — otherwise
  a stationary/slow monster could just be walked past again inside the
  arena.
- Encounter identity is tracked by `chunkIndex` (which chunk a monster's
  spawn roll belongs to), not distance-to-player, specifically so a
  monster that gets chased away from its spawn point can't cause the lock
  to spuriously release early or fail to re-trigger. `spawnZ` (fixed at
  spawn time) is what `findEncounterAhead` checks against, never the
  monster's live position.
- Caught during implementation, not just hypothetically: with the
  original spawn logic monsters in the same chunk could land up to 40
  units apart (`CHUNK_LENGTH`), which could put one monster outside the
  arena's reachable radius and make an encounter unclearable. Fixed by
  clustering every monster from one spawn roll within ±2 units of a
  single random point in the chunk, and sized `ARENA_Z_RADIUS` (14) with
  margin over `ARENA_LOCK_RANGE` (6) + the cluster spread so every member
  of an encounter is always reachable from the lock point.
- `player.js`'s `trySwordHit` reach was `dz >= 0` (forward-only) since the
  player previously only ever approached monsters from behind while
  walking; changed to `Math.abs(dz)` since arena monsters can end up on
  either side of the player.
- Added a HUD "⚔ In Combat" indicator (`index.html`/`ui.js`'s
  `setCombatIndicator()`) so the player understands why forward movement
  stopped and that W/S now do something.
- Did not add visual arena bounds (fence/glow ring) — went with the
  simpler auto-lock-on-proximity design per user's answer rather than the
  visible-boundary variant; revisit if playtesting shows the arena extent
  isn't legible without it.
- Not verified live in a browser this session (skipped Playwright setup
  per user request) — needs an eyeball pass specifically on: does the
  lock trigger reliably before the player overlaps the monster, can every
  monster in a 2-monster encounter actually be reached and killed, does
  the indicator show/hide at the right moments, and does forward walking
  resume smoothly (no camera pop) once the arena clears.

### Pacing + scenery pass (2026-07-14)
- User-reported: first encounter took too long to reach, and the path was
  visually plain (flat color ground, two edge boxes, nothing else).
- `monsters.js`/`config.js`: chunk 0 now always spawns its encounter
  (`FIRST_ENCOUNTER_DISTANCE` = 10 world units in) instead of rolling
  `MONSTER_SPAWN_CHANCE_PER_CHUNK` like every other chunk — at
  `WALK_SPEED` that's under 2 seconds to first contact, and it can no
  longer be pushed out further by a bad RNG roll on top of a bad roll.
- `scene.js`: `scene.background` is now a vertical-gradient sky baked to a
  `CanvasTexture` (zenith → mid-sky → horizon, horizon color matches the
  existing fog/bg color so the join is invisible) instead of a flat clear
  color.
- `path.js`: each chunk now also builds a wide grass/dirt terrain strip
  under the road (so the world doesn't cut to void past the road edges),
  a scattered flanking forest (cone+cylinder trees, 3-5 per side, road
  chunks only — towns keep their placeholder buildings instead), and two
  low-poly background hills per side per chunk for depth.
- Trees and hills share cached geometries (`_treeGeoCache`,
  `_hillGeoCache`) across every chunk instead of allocating new geometry
  per spawn, since dozens of chunks' worth of trees/hills can be live at
  once; `_disposeChunk` was updated to skip disposing shared geometries
  (only per-chunk materials + non-shared geometry like the terrain/road
  planes get disposed) — missing this would have freed a geometry still
  in use by a neighboring chunk and corrupted rendering.
- Not yet verified live in a browser this session — needs an eyeball
  pass on: time-to-first-fight feel, whether the forest density/hill
  placement reads well at the default camera angle, and whether the
  gradient sky's horizon band actually matches the fog color seamlessly.

### Fantasy road texture (2026-07-14)
- User-reported: the first scenery pass gave the road a flat green fill
  plus a dashed centerline, which read as a modern painted asphalt road
  rather than a fantasy dirt/cobblestone trail.
- `path.js`: replaced the flat `ROAD_COLOR` fill + dashed centerline with
  `_getRoadTexture()` — a 128x128 `CanvasTexture` baked once (irregular
  cobblestone/dirt blotches + two worn travel-groove lines, no straight
  painted markings), tiled via `RepeatWrapping` and cloned per road chunk
  so each chunk can set its own `repeat` without fighting over one shared
  texture instance. Town chunks keep a flat packed-earth color
  (`TOWN_COLOR`) so the safe zone still reads as visually distinct from
  the road.
- Road edge curbs changed from a bright accent-blue box (read as a
  reflective modern lane marker) to a dull stone-gray (`0x6b6558`); town
  edges keep the gold accent as the "this is safe" visual cue.
- Caught during implementation, not hypothetically: `material.dispose()`
  does not free textures attached to a material — since each road
  chunk clones its own texture instance, `_disposeChunk` now also calls
  `material.map.dispose()` before disposing the material itself, or every
  passed/disposed chunk would leak a texture on the GPU over a long run.
- Not yet verified live in a browser this session — needs an eyeball
  pass on how the cobblestone tiling reads at the player's camera angle/
  distance (may need bigger cobblestones or a coarser repeat if it looks
  too noisy/small from behind-camera).

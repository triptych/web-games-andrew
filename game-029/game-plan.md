# Wayfarer's Path

**Genre:** Endless walker / action RPG with procedural loot
**Engine:** three.js r165 (ES6 modules via import map)
**Target Resolution:** Fullscreen (responsive, `renderer.setSize(innerWidth, innerHeight)`)
**Status:** Phase 1 complete — starting Phase 2

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
approach monsters, rather than controlling forward speed directly. (Open
question below: fully automatic vs. WASD-driven forward movement — see Open
Questions.)

### 3. Real-Time Sword Combat
Monsters spawn on the path ahead. Pressing the attack key swings the
equipped sword in an arc; monsters within range and swing timing take
damage. Monsters attack back on contact/cooldown. Player HP is shown in the
HUD; hitting 0 HP ends the run.

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
| Attack (swing sword) | Space |
| Pause         | P |
| Restart       | R (from game-over screen) |

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

### Phase 2 — Combat & Loot Loop
- [ ] Sword swing hitbox + monster contact damage
- [ ] Coin drop + auto-collect
- [ ] Equipment drop → comparison modal → equip/sell wired end-to-end
- [ ] Equipped stats actually affect player damage/defense/speed

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
| `player.js` | Steering, sword swing arc/hitbox, per-swing hit tracking, camera-follow |
| `monsters.js` | Spawning (via `chunkSpawned`), AI, combat, death → loot roll |
| `loot.js`   | Item generation, rarity, sale value |

Town/shop flow has no dedicated `town.js` — `path.js` owns the trigger
(town chunk enter/exit) and `main.js`/`ui.js` own the modal. Revisit this
split if the shop grows real buy logic in Phase 3.

---

## Open Questions

- [ ] Fully auto-walk (only steer + attack) vs. WASD forward movement? Auto-walk
      keeps the "endless" pacing consistent; WASD gives more player agency.
      Leaning auto-walk + steer for now.
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

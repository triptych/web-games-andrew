# Petal & Purse

**Genre:** Cozy Idle / Shop Sim
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Planning — Phase 3

---

## Concept

A cozy flower shop sim where you buy seeds, grow flowers in pots, and sell blooms for gold. Reinvest your earnings into better seeds, nicer pots, and richer soil to grow more valuable flowers faster.

Low-stakes and relaxing — there are no fail states, no timers bearing down on you, and no enemies. Progress is purely through gentle economic loops: plant → wait → harvest → upgrade → repeat. The art direction leans into a soft, warm palette with emoji flowers and earthy pot textures. Perfect for unwinding.

---

## Core Mechanics

### 1. Seed Purchasing
Visit the Seed Shop (press S or click an empty pot) to browse four seed types: Daisy, Tulip, Sunflower, and Rose. Each seed has a buy cost, a sell value after growing, and a grow time. Seeds can also be stockpiled in the player's bag and planted later.

### 2. Growing
Each of the five pot slots can hold one plant at a time. A progress bar fills over real time. Pots and soils each provide speed bonuses, so upgrading reduces wait times. Four visual growth stages (seedling → sprout → bud → bloom) give satisfying feedback.

### 3. Harvesting
Once the progress bar is full, click the pot to harvest. The flower is sold automatically and the gold lands in your wallet with a satisfying pop-up. The slot resets and is ready for the next seed.

### 4. Pot & Soil Upgrades
Each slot can be independently upgraded to a better pot (Clay → Glazed → Terracotta) and better soil (Basic → Rich Compost → Enchanted). Both improve grow speed and add a gold bonus per harvest, creating a meaningful progression ladder.

### 5. Day Cycle
Days advance automatically (or can be triggered manually in a later phase). Each day a small gold bonus may arrive, and seasonal events can affect flower prices.

### 6. Economy Balance
The core loop: buy cheap seeds early, reinvest in upgrades, then buy premium seeds as the economy scales. There is no gold debt — you simply can't buy what you can't afford.

---

## Game Loop

1. Start with 15g. Buy a Daisy Seed (3g) and plant it.
2. Wait ~8 seconds for it to bloom. Harvest for 7g.
3. Repeat a few times until you can afford a Tulip Bulb or a Glazed Pot upgrade.
4. Expand to multiple slots, upgrade soils, move up to Roses.
5. Enjoy the compounding returns as all five slots run in parallel with enchanted soil and terracotta pots.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Click empty pot | Open shop / plant seed |
| Click ready pot | Harvest flower |
| Shop | S |
| Restart | R |
| Menu | Escape |
| Pause | P |

---

## Progression / Difficulty

There is no "difficulty" — the game is intentionally cozy. Progression comes from:
- Unlocking more expensive seeds as gold accumulates
- Upgrading pots and soils on each slot
- Running all five slots in parallel at peak efficiency
- Future: seasonal events, rare seeds, decorations

---

## UI / HUD

- **Top-left**: Gold counter (updates live)
- **Top-right**: Day counter
- **Centre**: Five pot slots in a row with progress bars, stage emojis, and harvest prompts
- **Shop overlay**: Seed grid with cost/sell/grow info; bag section if seeds are stockpiled
- **Bottom**: Persistent controls hint
- **Floating popups**: +Ng gold labels drift up on harvest

---

## Sound Design

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Button press / start | Short sine blip |
| Plant | Seed planted | Two-tone soft chime |
| Bloom | Flower finishes growing | Four-note ascending sparkle |
| Harvest | Flower sold | Triple triangle coin drop |
| Buy | Seed purchased from shop | Short sine sweep up |
| No Gold | Can't afford purchase | Sine sweep down |
| Day End | Day advances | Four-note descending chime |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] Five pot slots with grow loop and progress bars
- [x] Seed shop overlay (buy & plant in one step)
- [x] Harvest on click when bloom complete
- [x] Gold popups
- [ ] Pot upgrade UI per slot
- [ ] Soil upgrade UI per slot

### Phase 2 — Upgrades & Polish
- [x] In-slot upgrade panel (right-click pot to open upgrades)
- [x] Animated bloom effect (petal burst particles)
- [x] "Bag" inventory properly surfaced in HUD (top-centre)
- [x] Day cycle with manual "End Day" button (D key) + gold bonus
- [x] Ambient background music loop (Web Audio pentatonic arpeggios)

### Phase 3 — Content & Depth
- [x] Two additional seed tiers (Orchid, Moonflower)
- [x] Seasonal events (spring bonus, winter slowdown)
- [x] Decorations that passively boost shop income
- [x] Save/load via localStorage
- [x] Achievements panel

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `goldChanged` | newGold | state | ui, shopPanel |
| `flowerPlanted` | slotIndex, seedKey | state | main (visuals) |
| `flowerHarvested` | slotIndex, seedKey, goldEarned | state | ui (popup) |
| `shopOpened` | — | main | — |
| `shopClosed` | — | main | — |
| `potUpgraded` | slotIndex, potKey | state | main (visuals) |
| `soilUpgraded` | slotIndex, soilKey | state | main (visuals) |
| `dayAdvanced` | dayNumber | state | ui |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`   | Kaplay init, scene definitions, grow loop, shop overlay |
| `config.js` | Seed, pot, soil definitions; layout constants |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton — gold, slots, seed bag |
| `sounds.js` | Web Audio API sound effects |
| `ui.js`     | HUD (gold, day), gold popup helper |

---

## Open Questions

- [ ] Should upgrading a pot/soil cost gold one-time, or be a recurring maintenance cost?
- [ ] Should there be a "prestige" reset mechanic for replayability?
- [ ] How long should a typical session feel? (Target: 10–20 relaxing minutes)
- [ ] Should seeds ever "wilt" if left too long after blooming, to add mild tension?

---

## Changelog

### Phase 3 — Content & Depth (2026-03-06)
- Orchid (40g/100g/60s) and Moonflower (80g/220g/120s) seed tiers added to shop
- Seasonal cycle: Spring/Summer/Autumn/Winter — each 7 days; speed and price mods apply
- Season HUD shown bottom-left with emoji, name, and day-in-season counter
- Decorations shop (G): Garden Gnome / Stone Fountain / Magic Lantern — one-time purchase, +gold per harvest
- Save/load via localStorage — persists gold, slots, upgrades, decorations, achievements, season; R key starts a new game
- Achievements panel (A): 12 achievements with unlock toasts; checks on harvest, upgrade, day, season, decoration
- Controls hint updated; splash version tag → Phase 3

### Phase 2 — Upgrades & Polish (2026-03-05)
- Upgrade panel: right-click any pot to upgrade its pot type or soil (per-slot, stacked costs)
- Petal burst: 14 colored particles fan out on bloom (seed-color themed)
- Bag HUD: seed inventory shown in top-centre, updates live on plant/harvest
- Day cycle: "End Day" button + D key; awards scaling daily gold bonus (3+day)
- Ambient music: auto-starts on game enter; pentatonic arpeggios via Web Audio
- Controls hint updated; splash version tag → Phase 2

### Phase 1 — Scaffold (2026-03-05)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Five pot slots with real-time grow loop and four growth stages
- Seed shop overlay with buy-and-plant flow and seed bag support
- Harvest-on-click with floating gold popups
- Full audio set: plant, bloom, harvest, buy, no-gold, day-end
- Fixed: harvest gold popup crash (`entity.onUpdate` → `k.onUpdate` with `exists()` guard)
- Shop seed buttons dim to 35% opacity when unaffordable; update live on `goldChanged`

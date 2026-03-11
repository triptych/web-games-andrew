# Tamagoji

**Genre:** Virtual Pet / Idle Sim
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 480 × 720 (portrait, mobile-first)
**Status:** Planning — Phase 1

---

## Concept

An emoji-based Tamagotchi-style pet raising game where players hatch, nurture, and grow a virtual pet through four life stages — Baby → Child → Teen → Adult. Pets are represented entirely by emojis, which change as they evolve. Players feed, play with, bathe, and cuddle their pet to keep it healthy and happy, while managing four core stats: Hunger, Happiness, Energy, and Health.

The game features five distinct pet species (Dinofriend, Spirit, Dragonlet, Aquapup, Bunbun), each with a unique emoji progression. Players earn gold passively to buy eggs from the shop, building a reserve of future companions. The tone is warm, cozy, and satisfying — a pocket companion experience that rewards consistent attention.

---

## Core Mechanics

### 1. Pet Stats
Four stats decay over time (Hunger fastest, Energy slowest). If Hunger or Happiness drop critically low, Health begins to erode. Health slowly recovers when stats are healthy. Death occurs when Health reaches zero.

### 2. Life Stages
Pets evolve through: Egg → Baby → Child → Teen → Adult. Each stage uses a different emoji and has a time-gated duration. The egg stage is brief (8 seconds) for satisfying immediate feedback; later stages take minutes.

### 3. Feeding
Players tap the Feed button to open a 4-item food menu (Berry, Meal, Cake, Veggie). Each food type restores different amounts of Hunger, Happiness, and Energy — some trade-offs included (Veggie gives great energy but lowers happiness slightly).

### 4. Interactions
The Play button opens 4 interaction types: Play (raises happy/drains energy), Sleep (restores energy), Bath (boosts health), Cuddle (gentle happy + energy boost). Each triggers a floating reaction emoji on the pet.

### 5. Egg Collection & Shop
Players earn 10 gold every 30 seconds. The Shop sells eggs for 30 gold each — one per species. Purchased eggs are stored in the Eggs menu and can be hatched at any time to start a new pet run.

### 6. Mood System
The pet displays a mood string derived from current stats: Happy, Content, Sad, Hungry, Tired, or Sick. Mood changes trigger audio cues.

---

## Game Loop

1. Player opens the game and selects a species on the splash screen.
2. Egg appears on screen and hatches after 8 seconds (fanfare plays).
3. Pet stats decay continuously — player tends to the pet by feeding and interacting.
4. Pet evolves through 3 more stages over several minutes; each stage-up plays a jingle.
5. Player earns gold passively; they may buy new eggs from the Shop.
6. If the pet dies (health = 0), a death screen appears; player taps to return to species select.
7. Purchased eggs in reserve can be hatched immediately for the next run.

---

## Player Controls

| Action | Key / Tap |
|--------|-----------|
| Select species | Tap egg icon on splash |
| Hatch egg | Any key / tap |
| Open Feed menu | Tap Feed button |
| Open Interact menu | Tap Play button |
| Open Eggs reserve | Tap Eggs button |
| Open Shop | Tap Shop button |
| Close menu | Tap same button again / Escape |
| Restart after death | Tap screen / R |
| Back to splash | Escape |

---

## Progression / Difficulty

- Stats decay faster in later life stages (to be tuned in Phase 2)
- Gold costs for rarer species eggs may increase in Phase 2
- Possible Phase 3 feature: personality traits that modify stat decay rates based on care history

---

## UI / HUD

- **Top bar**: Game title, gold counter (top-right), species + stage label (top-left), mood label
- **Pet display**: Large emoji centered on screen, idle bounce animation, floating reaction emoji on feed/interact
- **Stat bars**: Four color-coded progress bars (Hunger=orange, Happy=yellow, Energy=blue, Health=green) with emoji icons and numeric values. Turn red/yellow at low thresholds.
- **Action bar**: Four circular tap buttons at bottom (Feed, Play, Eggs, Shop)
- **Menus**: Slide-up overlay grids for food, interaction, eggs, and shop selections

---

## Sound Design

All sounds via Web Audio API — no file assets.

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Button tap | Short sine blip |
| Feed | Food selected | 3-note ascending sine |
| Happy | Play/cuddle interaction | Cheerful ascending chord |
| Hatch | Egg hatches | Crack sweep + fanfare |
| Stage Up | Life stage advance | 4-note level-up jingle |
| Sad | Mood → sad/hungry | Descending triangle sweep |
| Death | Health reaches 0 | Mournful sawtooth descent |
| Egg Get | Egg purchased from shop | 3-note ascending triangle |
| Sleep | Sleep interaction | Soft descending sweeps |
| Bath | Bath interaction | Bubbly random sine blips |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] All 5 pet species with 5-stage emoji progressions
- [x] Four stat bars with decay and health consequences
- [x] Feeding system with 4 food types
- [x] Interaction system (Play, Sleep, Bath, Cuddle)
- [x] Life stage progression (Egg → Baby → Child → Teen → Adult)
- [x] Gold economy + Egg shop
- [x] Mood system with 6 mood states
- [x] Pet reaction floating emoji
- [x] Death + restart flow
- [x] Full sound suite (10 effects)

### Phase 2 — Polish & Balance
- [ ] Per-stage stat decay tuning
- [ ] Personality trait system based on care history
- [ ] Animated particle effects on hatch/stage-up
- [ ] Pet happiness animations (jumping, spinning)
- [ ] Rare species unlock system
- [ ] High score / longest survival tracking (localStorage)

### Phase 3 — Extended Content
- [ ] Mini-games (simple tap/timing games) for bonus happiness
- [ ] Collectible items (toys, decorations) from shop
- [ ] Pet journal / diary
- [ ] Multiple simultaneous pets

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|------------|-------------|
| `petStatsChanged` | { hunger, happy, energy, health } | state | ui |
| `petStageChanged` | newStage | state | ui, main |
| `petDied`         | —        | state | ui, main |
| `petHatched`      | species  | state | ui, main |
| `newEggReady`     | —        | state | main |
| `feedStart`       | foodId   | state | main |
| `interactStart`   | actionId | state | main |
| `moodChanged`     | moodKey  | state | ui, main |
| `goldChanged`     | amount   | state | ui |
| `uiModeChanged`   | mode     | state | ui |

---

## Module Overview

| File | Responsibility |
|------|----------------|
| `main.js`   | Kaplay init, scene definitions, sound wiring, game loop tick |
| `config.js` | All constants: stat rates, stage durations, species defs, colors, layout |
| `events.js` | EventBus singleton |
| `state.js`  | GameState: pet lifecycle, stat decay, feed/interact, mood derivation |
| `sounds.js` | Web Audio API — 10 procedural sound effects |
| `ui.js`     | HUD, stat bars, action buttons, menus (feed/interact/eggs/shop), overlays |

---

## Open Questions

- [ ] Should stat decay increase with life stage, or stay constant?
- [ ] Should the shop offer consumable items (one-use toys, medicines) in addition to eggs?
- [ ] Is a day/night cycle worth adding for the energy/sleep loop?
- [ ] Should age be displayed explicitly to the player?

---

## Changelog

### Phase 1 — Scaffold (2026-03-11)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Full pet lifecycle with 5 species × 5 emoji stages
- Stat decay, health consequences, mood system
- Feed menu (4 foods), interaction menu (4 actions)
- Gold economy, egg shop, egg reserve
- 10 Web Audio sound effects

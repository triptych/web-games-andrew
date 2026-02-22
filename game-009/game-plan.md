# Chronicles of the Ember Crown

**Genre:** Turn-Based RPG (Early Final Fantasy style)
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Active — Phase 2

---

## Concept

A classic turn-based RPG in the vein of early Final Fantasy titles. Lead a party of four heroes — Warrior, Mage, Healer, and Rogue — through a darkening land, battling monsters in encounter-based combat. Collect gold, purchase items, gain XP, and level up your party across a series of escalating battles culminating in two boss encounters: the Dragon and the Lich King.

The game emphasises strategic party management: each class has unique abilities, MP constraints force decision-making between spells and basic attacks, and status effects create tension. There is no overworld exploration — the game is a curated sequence of battles with shop breaks in between, letting the design focus on combat depth and satisfying progression.

---

## Core Mechanics

### 1. Turn-Based Combat (ATB-Lite)
Battle order is determined by SPD stat at the start of each encounter. Combatants take turns in order; each turn the active member chooses an action from a menu. After all combatants have acted, the round repeats.

### 2. Action Menu
On a party member's turn:
- **Attack** — basic physical strike
- **Magic / Skills** — class-specific abilities (costs MP)
- **Item** — use a consumable from shared inventory
- **Defend** — skip action, halve incoming damage this round
- **Run** — attempt to flee (50% success chance; fails against bosses)

### 3. Damage Formula
```
Physical DMG = max(1, ATK × power - DEF × 0.5) × (0.85 + random × 0.3)
Magical  DMG = max(1, MAG × power - MAG_RES × 0.3) × (0.85 + random × 0.3)
Heal     HP  = max(1, MAG × power) × (0.9 + random × 0.2)
```
Elemental weaknesses (fire vs ice, etc.) multiply damage by 1.5×.

### 4. Status Effects
| Status  | Effect | Applied By |
|---------|--------|-----------|
| Poison  | Lose 5% maxHP per turn | Dark Elf, Lich King |
| ATK Up  | +50% ATK for N turns | War Cry |
| DEF Up  | +40% DEF for N turns | Protect |
| ACC Down| 30% miss chance | Smoke Screen |

### 5. XP & Levelling
XP is split equally among surviving party members. Level-up fully restores HP/MP and randomly improves stats based on class growth rates. Each class has a unique growth profile (e.g., Warriors gain HP fast; Mages gain MAG fast).

### 6. Economy & Shop
Between battles, a travelling merchant appears (every 2–3 encounters). Spend gold on Potions, Hi-Potions, Ethers, Revives, and Antidotes. Gold is earned from every victory. Strategic inventory management — too few Revives is a real risk in later battles.

---

## Game Loop

```
Splash Screen
    ↓
Start Game (party initialised at level 1)
    ↓
[Battle] ← encounter from ENCOUNTERS list
    ↓
Victory screen (XP + Gold awarded) — or — Game Over (party wiped, lose 1 life)
    ↓
[Shop] (every 2–3 encounters) — optional spending
    ↓
Next encounter (repeat until all 12 encounters complete)
    ↓
Win screen (you defeated the Lich King)
```

If the party is wiped and lives reach 0 → Game Over with final score.

---

## Player Controls

| Action          | Key(s)                      |
|-----------------|-----------------------------|
| Navigate menus  | Arrow Keys / WASD           |
| Confirm         | Space / Enter               |
| Back / Cancel   | Escape / Backspace          |
| Pause           | P                           |
| Restart         | R                           |
| Return to menu  | Escape (from pause)         |

---

## Progression / Difficulty

| Encounter | Enemy(ies)               | Region            | Difficulty |
|-----------|--------------------------|-------------------|-----------|
| 1         | Goblin                   | Forest Path       | Easy      |
| 2         | Goblin × 2               | Forest Path       | Easy      |
| 3         | Skeleton                 | Old Ruins         | Easy      |
| 4         | Skeleton + Goblin        | Old Ruins         | Medium    |
| 5         | Orc                      | Mountain Pass     | Medium    |
| 6         | Orc + Skeleton           | Mountain Pass     | Medium    |
| 7         | Dark Elf                 | Shadow Vale       | Hard      |
| 8         | Dark Elf + Goblin × 2    | Shadow Vale       | Hard      |
| 9         | Stone Golem              | Ancient Fortress  | Hard      |
| 10        | Orc + Dark Elf           | Ancient Fortress  | Hard      |
| 11        | **Dragon** (Boss)        | Dragon's Peak     | Boss      |
| 12        | **Lich King** (Boss)     | Throne of Ash     | Boss      |

Difficulty increases through: higher enemy HP/ATK/DEF, multi-enemy encounters, and enemies gaining new abilities at boss tier.

---

## UI / HUD

```
┌─────────────────────────────────────────────────────┐
│ SCORE  0              [Top bar]         GOLD  120   │
├───────────────────────┬─────────────────────────────┤
│                       │                             │
│   Enemy sprites       │  Background art / region    │
│   (right side)        │  (center/left)              │
│                       │                             │
├───────────────────────┴─────────────────────────────┤
│ [Command Panel]       │ [Status Panel]              │
│ > Attack              │ Warrior Lv1  HP ████░  80%  │
│   Magic               │ Mage    Lv1  HP ████░  80%  │
│   Item                │ Healer  Lv1  HP ████░  80%  │
│   Defend   Run        │ Rogue   Lv1  HP ████░  80%  │
│                       │                             │
│ [Message log]         │                             │
└───────────────────────┴─────────────────────────────┘
```

- **Command panel** (bottom-left): current actor's action choices; cursor highlights active option
- **Status panel** (bottom-right): all party members with HP/MP bars; KO shown in red
- **Battle message log**: one-line text descriptions of actions ("Warrior attacks! 28 damage.")
- **Enemy area** (upper-right): enemy sprites with HP bars shown when damaged
- **Victory / defeat overlays**: full-screen dim with stats

---

## Sound Design

| Sound           | Trigger                        | Style                       |
|-----------------|--------------------------------|-----------------------------|
| Menu navigate   | Cursor moves in menu           | Short sine blip 440 Hz      |
| Menu confirm    | Action selected                | Two-note sine chord          |
| Physical hit    | Attack lands                   | Noise burst + sweep down     |
| Magic cast      | Spell begins                   | Rising sine arpegio          |
| Fire spell      | Fireball                       | Sawtooth sweep + noise       |
| Ice spell       | Blizzard                       | Triangle oscillator + noise  |
| Heal            | Cure / Cure All                | Major chord arpeggio         |
| Enemy attack    | Enemy strikes                  | Low sawtooth sweep           |
| Damage taken    | HP reduced                     | Noise burst                  |
| Party member KO | HP reaches 0                   | Long descending sweep        |
| Enemy death     | Enemy HP reaches 0             | Sawtooth sweep down          |
| Victory fanfare | Battle won                     | 7-note ascending melody      |
| Level up        | Party member gains level       | 5-note ascending arpeggio    |
| Item use        | Consumable used                | Mid sine blip                |
| Game over       | All lives lost                 | Long sad sweep + noise       |

---

## Phases

### Phase 1 — Foundation ✅ COMPLETE (2026-02-22)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] Party definitions: Warrior, Mage, Healer, Rogue (stats, abilities, level-up growth)
- [x] Ability definitions: 11 abilities across 4 classes
- [x] Enemy definitions: 7 enemies including 2 bosses
- [x] Encounter list: 12 battles with region metadata
- [x] Shop item definitions and economy constants
- [x] Sound stubs: 20+ procedural sounds
- [x] Status panel UI with HP/MP bars
- [x] Static analysis clean — no Kaplay gotchas in generated code
- [x] Fix: border entity used `opacity(0)` which hides outline; changed to opaque panel fill
- [x] Launcher entry added to gamedata.js

### Phase 2 — Battle System Core (current)
- [ ] `battle.js` — turn management, action resolution, damage formula
- [ ] `battleRenderer.js` — draw party sprites, enemy sprites, HP bars
- [ ] `commandMenu.js` — keyboard-navigable action menu
- [ ] Basic `Attack` action fully playable
- [ ] Enemy AI: attack pattern (basic, random target)
- [ ] Victory detection (all enemies dead) → award XP + gold
- [ ] Defeat detection (all party KO) → lose life → restart or game over

### Phase 3 — Abilities & Status Effects
- [ ] All 11 party abilities implemented
- [ ] Status effects: Poison, ATK Up, DEF Up, ACC Down
- [ ] Enemy unique abilities (Dark Elf poison, Golem armor, Dragon fire breath)
- [ ] `Item` action — use consumables from inventory
- [ ] `Defend` action — half damage for one round
- [ ] `Run` action — 50% flee chance (disabled vs bosses)

### Phase 4 — Progression & Economy
- [ ] XP distribution and level-up animation
- [ ] Stat growth on level-up (random within growth table)
- [ ] Shop overlay between encounters (every 2–3 fights)
- [ ] Inventory management in shop

### Phase 5 — Polish & Feel
- [ ] Battle animations: hit flash, shake, floating damage numbers
- [ ] Transition effects: battle start flash, victory fanfare delay
- [ ] Region/background art per area (drawn with Kaplay primitives)
- [ ] Enemy and party sprite art (Kaplay primitive shapes, distinct silhouettes)
- [ ] Boss intro text cards
- [ ] Sound trigger integration for all actions

### Phase 6 — End Game & Ship
- [ ] Win screen after Lich King defeat
- [ ] Final score calculation (enemies defeated × level + gold remaining)
- [ ] High-score display
- [ ] Register in launcher (gamedata.js)
- [ ] Final balance pass across all 12 encounters

---

## Event Catalog

| Event               | Payload                      | Emitted by    | Consumed by        |
|---------------------|------------------------------|---------------|-------------------|
| `scoreChanged`      | newScore                     | state         | ui                |
| `goldChanged`       | newGold                      | state         | ui                |
| `livesChanged`      | newLives                     | state         | ui                |
| `gameOver`          | —                            | state         | ui, main          |
| `gameWon`           | —                            | battle        | ui, main          |
| `battleStart`       | enemies[]                    | overworld     | battle, renderer  |
| `battleEnd`         | result ('victory'\|'flee'\|'defeat') | battle | overworld, ui  |
| `turnStart`         | actor                        | battle        | commandMenu       |
| `actionChosen`      | actor, action                | commandMenu   | battle            |
| `animateAction`     | data                         | battle        | renderer          |
| `combatantDied`     | combatant                    | battle        | renderer, ui      |
| `partyMemberDied`   | member                       | battle        | ui                |
| `levelUp`           | member, newLevel, gains      | state         | ui                |
| `statusApplied`     | target, status               | battle        | renderer, ui      |
| `showMessage`       | text, color                  | battle        | ui                |

---

## Module Overview

| File                | Responsibility                              |
|---------------------|---------------------------------------------|
| `main.js`           | Kaplay init, scene definitions              |
| `config.js`         | Constants: party, enemies, abilities, shop  |
| `events.js`         | EventBus singleton                          |
| `state.js`          | GameState: party, gold, inventory, XP       |
| `sounds.js`         | Web Audio API sound effects (20+ stubs)     |
| `ui.js`             | HUD, status panel, overlays                 |
| `battle.js`         | Turn management, action resolution (Phase 2)|
| `battleRenderer.js` | Sprite drawing, damage numbers (Phase 2)    |
| `commandMenu.js`    | Keyboard-navigable action menu (Phase 2)    |
| `overworld.js`      | Encounter sequencer, shop trigger (Phase 4) |

---

## Open Questions

- [ ] Should enemies have named special abilities shown in the log, or just flavor text?
- [ ] Should the party have fixed names or user-chosen names?
- [ ] Should levelling up mid-battle heal the party, or only apply stat gains?
- [ ] Boss phase 2: does the Dragon/Lich King change behavior at 50% HP?

---

## Changelog

### Phase 1 — Scaffold (2026-02-22)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Full party system in state.js with XP/levelling
- 11 abilities defined in config.js
- 7 enemies + 12 encounters defined
- Shop items and economy constants defined
- 20+ procedural sound effects stubbed in sounds.js
- Status panel UI with HP/MP bars and color-coded health

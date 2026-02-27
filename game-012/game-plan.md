# Arcana Pull

**Genre:** Card-Based Auto Battler / Gacha
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Planning — Phase 1

---

## Concept

A card-based auto battler where you collect tarot cards through a gacha pull system and field them as fighters in wave-based combat. Cards are drawn from the 78-card tarot deck — the four suits (Wands, Cups, Swords, Pentacles) form your common fighters, while the 22 Major Arcana cards are rare, powerful units with unique abilities.

Between waves you spend Gems earned in combat to pull from the gacha banner. Pity mechanics guarantee a Legendary Major Arcana card after 90 pulls. Your goal is to build a four-card party capable of surviving all 10 enemy waves and defeating the final boss — The World.

---

## Core Mechanics

### 1. Gacha Pull System
Spend Gems to pull random tarot cards. Single pull costs 60 Gems; 10-pull costs 500 (discount). Rarity weights: Common 60%, Uncommon 25%, Rare 12%, Legendary 3%. A pity counter guarantees a Legendary after 90 consecutive non-Legendary pulls.

### 2. Tarot Card Roster
Cards are defined by their tarot identity. Each card has: name, suit, rarity, HP, ATK, SPD, and a special ability. Minor Arcana cards (suits) are the backbone — Wands deal high damage, Cups heal, Swords attack fast with control effects, Pentacles tank and shield. Major Arcana (The Fool, The Magician, etc.) have unique active abilities.

### 3. Party Building
After pulling cards you assign up to 4 cards to your active party in the Collection screen. Cards can be freely swapped between waves. Duplicate cards can be sacrificed to power up (star up) existing copies, increasing their base stats.

### 4. Auto Battle
Combat is fully automatic and tick-based (one action every 1.2 seconds). Each card attacks the front enemy. SPD determines how often a card gets to act per cycle. Special abilities trigger on cooldown or at HP thresholds. The player watches and plans between waves.

### 5. Wave Progression
10 escalating waves of enemies, each themed around a tarot archetype (e.g. Wave 5 "The Hanged Man" brings enemies that reverse buff/debuff). Each wave cleared earns Gems. Losing all party HP costs a life; losing all 3 lives ends the run.

### 6. Star-Up (Duplicate Fusion)
Feed duplicate cards into an existing copy to raise its star level (1–5). Each star level grants a fixed stat bonus and at 5 stars upgrades the card's special ability.

---

## Game Loop

1. **Pull** — Spend Gems on the gacha banner to add cards to the collection.
2. **Build** — Arrange your best 4 cards into the active party in the Collection screen.
3. **Battle** — Watch the auto battler resolve Wave N. Earn Gems if you win; lose a life if all party cards are defeated.
4. **Repeat** — Spend earned Gems to strengthen the roster, then tackle the next wave.
5. **Endgame** — Defeat Wave 10 / The World boss to win the run.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Navigate menus | Mouse click / Arrow keys |
| Single Pull | G |
| 10-Pull | T |
| Open Collection | C |
| Start Battle | B |
| Pause / Resume | P |
| Restart | R |
| Back / Menu | Escape |

---

## Screens / Scenes

| Scene | Purpose |
|-------|---------|
| `splash` | Title screen with lore tagline |
| `game` | Hub: shows current wave, gems, party summary; links to other scenes |
| `gacha` | Pull animation, card reveal, pity meter |
| `collection` | Grid of owned cards; drag-to-party slot assignment |
| `battle` | Auto battle visualisation with timeline and HP bars |

---

## Progression / Difficulty

- Enemies scale HP and ATK by ~15% per wave.
- Every 3rd wave introduces an elite enemy with a passive ability (heal, shield, enrage).
- Wave 10 boss (The World) has 3 phases and mirrors one of the player's card abilities each phase.
- Gem income is fixed per wave win; no grinding — every pull decision matters.

---

## UI / HUD

**Hub / in-battle HUD (top bar):**
- Score (top-left)
- Gems (top-center, gold)
- Wave (top-right)

**Battle screen:**
- Party lane (left side): 4 card portraits with HP bars
- Enemy lane (right side): enemy sprites with HP bars
- Action log (bottom): last 4 actions in text
- Pity counter: small meter below gem count

**Gacha screen:**
- Pull button (single / 10-pull)
- Animated card flip reveal
- Rarity flash (colour-coded glow)
- Pity meter (0–90)

**Collection screen:**
- Scrollable card grid
- Party slots (4 highlighted slots at top)
- Card detail panel on hover/select

---

## Sound Design

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Any button press | Short sine blip |
| Card Flip | Gacha reveal | Triangle sweep up |
| Pull Common | Common card reveal | Two-note sine chord |
| Pull Rare | Rare card reveal | Three-note ascending |
| Pull Legendary | Legendary reveal | Five-note fanfare + noise burst |
| Attack | Card attacks enemy | Square sweep down + noise |
| Spell | Magic ability fires | Sine sweep up + triangle |
| Heal | Heal card acts | Three-note ascending sine |
| Enemy Hit | Enemy takes damage | Sawtooth sweep down |
| Wave Cleared | Wave win | Four-note fanfare |
| Game Over | All lives lost | Sawtooth sweep + noise |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] Scene stubs: splash, game hub, gacha, collection, battle
- [ ] Define full card roster in `cards.js` (all 78 tarot cards with stats)
- [ ] Define enemy roster in `enemies.js` (10 wave definitions)

### Phase 2 — Gacha System
- [ ] Implement pull logic with rarity weights and pity counter in `gacha.js`
- [ ] Build gacha scene: pull button, card flip animation, reveal screen
- [ ] Duplicate detection and star-up fusion flow
- [ ] Persist collection to `localStorage`

### Phase 3 — Collection & Party Builder
- [ ] Scrollable card grid in `collection.js`
- [ ] Party slot assignment (drag or click-to-assign)
- [ ] Card detail panel (stats, ability description, star level)
- [ ] Star-up (fusion) interface

### Phase 4 — Auto Battler
- [ ] Implement tick-based battle loop in `battle.js`
- [ ] Party vs enemy lane rendering with HP bars
- [ ] Ability triggers (Cups heal, Swords debuff, Major Arcana actives)
- [ ] Action log display
- [ ] Wave win/loss resolution + gem award

### Phase 5 — Polish
- [ ] Wave escalation + elite enemies
- [ ] Final boss (Wave 10 / The World) with 3 phases
- [ ] Splash screen art (procedural card borders using canvas)
- [ ] Sound pass — verify all triggers working
- [ ] Balance tuning pass

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `gemsChanged` | newGems | state | ui |
| `livesChanged` | newLives | state | ui |
| `cardPulled` | cardDef | state | gacha scene |
| `partyChanged` | partyArray | state | collection, battle |
| `battleStart` | enemyWave | battle | ui |
| `battleTick` | battleState | battle | battle scene |
| `battleEnd` | { won: bool } | battle | game hub |
| `waveCleared` | waveNumber | battle | state, ui |
| `gameOver` | — | state | ui |
| `gameWon` | — | battle | ui |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`       | Kaplay init, scene definitions and stubs |
| `config.js`     | Constants, rarity defs, gacha costs, suit types |
| `events.js`     | EventBus singleton |
| `state.js`      | GameState singleton (score, gems, lives, collection, party, pity) |
| `sounds.js`     | Web Audio API sound effects |
| `ui.js`         | HUD rendering and game-over screen |
| `cards.js`      | (Phase 2) Full tarot card roster and stat definitions |
| `enemies.js`    | (Phase 2) Enemy definitions and wave compositions |
| `gacha.js`      | (Phase 2) Pull logic, pity, animation controller |
| `collection.js` | (Phase 3) Card grid, party assignment, fusion UI |
| `battle.js`     | (Phase 4) Auto battler tick loop, ability resolver |

---

## Open Questions

- [ ] Should cards be animated sprites or stylised text/rect cards?
- [ ] Is localStorage persistence required, or is each session a fresh run?
- [ ] Should duplicate handling show a "NEW" badge on first pull of each card?
- [ ] Wave enemy theme: random creatures, or tarot-themed archetypes for each wave?
- [ ] Does the player have any real-time input during battle (e.g. use a stored item)?

---

## Changelog

### Phase 1 — Scaffold (2026-02-27)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Four scene stubs: splash, game hub, gacha, collection, battle
- Tarot-specific config: SUITS, RARITY, gacha costs, pity threshold, gem economy
- State extended with gems, pity counter, collection array, and party array
- sounds.js extended with card flip, pull reveals (common/rare/legendary), attack, spell, heal sounds

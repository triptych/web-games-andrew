# Arcana Pull

**Genre:** Card-Based Auto Battler / Gacha
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Phase 5 Complete — Phase 6 next

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

### 7. The Reading (Every 5 Waves)
After every 5th wave cleared, the game performs a **Reading** — a tarot spread drawn from your current collection. One card is flipped face-up and its omen (positive or negative) is applied for the next 5 waves.

**Positive readings** grant a consumable item or buff:
| Card Type | Blessing |
|-----------|---------|
| Major Arcana | Legendary item (e.g. "The Star" restores all HP; "The Sun" doubles Gem income next wave) |
| Cups | Heal: restore 30% max HP to all party members |
| Wands | Blaze: all party ATK +20% for 5 waves |
| Swords | Clarity: all party SPD +1 for 5 waves |
| Pentacles | Ward: all party gains a one-hit shield at the start of each battle for 5 waves |

**Negative readings** (drawn when the flipped card is reversed — 30% chance) inflict a condition for the next 5 waves:
| Condition | Effect |
|-----------|--------|
| Poisoned | Party loses 5% max HP at the start of each battle tick |
| Weakened | All party ATK −20% |
| Slowed | All party SPD −1 (minimum 1) |
| Cursed | Pity counter is frozen (does not increase) for 5 waves |
| Hexed | Gem income from the next 5 waves is halved |

The flipped card and its omen are shown in a dedicated **Reading Screen** between the wave-cleared screen and the hub. The active blessing or condition is displayed as a small status icon in the HUD for the duration.

Items/buffs granted by positive readings are stored as consumables in a new **Items** inventory (max 3 slots). Consumables can be used manually from the Hub before starting the next wave.

---

## Game Loop

1. **Pull** — Spend Gems on the gacha banner to add cards to the collection.
2. **Build** — Arrange your best 4 cards into the active party in the Collection screen.
3. **Battle** — Watch the auto battler resolve Wave N. Earn Gems if you win; lose a life if all party cards are defeated.
4. **Reading** — Every 5 waves, a card is drawn from your collection and an omen (buff or curse) is applied for the next 5 waves.
5. **Repeat** — Spend earned Gems to strengthen the roster, then tackle the next wave.
6. **Endgame** — Defeat Wave 10 / The World boss to win the run.

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
| `game` | Hub: shows current wave, gems, party summary, active omen icon; links to other scenes |
| `gacha` | Pull animation, card reveal, pity meter |
| `collection` | Grid of owned cards; drag-to-party slot assignment |
| `battle` | Auto battle visualisation with timeline and HP bars |
| `reading` | Post-wave-5/10 tarot spread; reveals omen card and applies blessing or curse |

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
| Reading Flip | Omen card revealed | Slow triangle sweep + reverb tail |
| Omen Blessing | Positive reading resolved | Ascending five-note sine arpeggio |
| Omen Curse | Negative (reversed) reading resolved | Descending tritone + low rumble |
| Item Used | Consumable activated | Quick sine blip + ascending chord |
| Game Over | All lives lost | Sawtooth sweep + noise |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] Scene stubs: splash, game hub, gacha, collection, battle
- [x] Define full card roster in `cards.js` (all 78 tarot cards with stats)
- [x] Define enemy roster in `enemies.js` (10 wave definitions)

### Phase 2 — Gacha System
- [x] Implement pull logic with rarity weights and pity counter in `gacha.js`
- [x] Build gacha scene: pull button, card flip animation, reveal screen
- [x] Duplicate detection and star-up fusion flow
- [x] Persist collection to `localStorage`

### Phase 3 — Collection & Party Builder
- [x] Scrollable card grid in `collection.js`
- [x] Party slot assignment (drag or click-to-assign)
- [x] Card detail panel (stats, ability description, star level)
- [x] Star-up (fusion) interface

### Phase 4 — Auto Battler
- [x] Implement tick-based battle loop in `battle.js`
- [x] Party vs enemy lane rendering with HP bars
- [x] Ability triggers (Cups heal, Swords debuff, Major Arcana actives)
- [x] Action log display
- [x] Wave win/loss resolution + gem award

### Phase 5 — The Reading
- [x] Add `readingTriggered` event emission in battle after wave 5 and wave 10
- [x] Build `reading.js` scene: animated card flip, reversed/upright detection, omen text reveal
- [x] Implement all 5 blessings and 5 curses in `reading.js` / `state.js`
- [x] Items inventory (max 3 slots) with use-before-battle UI in hub
- [x] Omen status icon in hub (shows active blessing or curse + waves remaining)
- [x] Apply omen modifiers in `battle.js` tick loop and `_makePartyCombatant`

### Phase 6 — Polish
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
| `readingTriggered` | — | state | reading scene |
| `readingResolved` | { card, reversed, effect } | reading scene | state, ui |
| `omenApplied` | omenDef | state | ui, battle |
| `omenExpired` | omenId | state | ui |
| `itemUsed` | itemDef | state | battle, ui |
| `gameOver` | — | state | ui |
| `gameWon` | — | battle | ui |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`       | Kaplay init, scene definitions and stubs |
| `config.js`     | Constants, rarity defs, gacha costs, suit types |
| `events.js`     | EventBus singleton |
| `state.js`      | GameState singleton (score, gems, lives, collection, party, pity, activeOmen, items) |
| `sounds.js`     | Web Audio API sound effects |
| `ui.js`         | HUD rendering, omen status icon, game-over screen |
| `cards.js`      | (Phase 2) Full tarot card roster and stat definitions |
| `enemies.js`    | (Phase 2) Enemy definitions and wave compositions |
| `gacha.js`      | (Phase 2) Pull logic, pity, animation controller |
| `collection.js` | (Phase 3) Card grid, party assignment, fusion UI |
| `battle.js`     | (Phase 4) Auto battler tick loop, ability resolver, omen effect application |
| `reading.js`    | (Phase 5) Reading scene: card flip, omen reveal, item/curse assignment |

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
- cards.js: full 78-card tarot roster (22 Major + 56 Minor) with stats, keywords, elements, rarity
- enemies.js: 10 wave definitions themed on Major Arcana (The Fool → The World), with elite enemies on waves 3/5/7/9 and a 3-phase final boss on wave 10

### Phase 2 — Gacha System (2026-02-27)
- gacha.js: weighted random pull, pity counter (guaranteed Legendary at 90), duplicate detection
- Gacha scene: left banner info panel, centre card flip animation, right pull-history list
- Pull buttons (single/10-pull) with hover states; key bindings G/T
- Star-up fusion logic (fuseCard, getStarUpCost) ready for Phase 3 UI
- localStorage persistence: saveCollection / loadCollection / clearSave
- Hub scene: clickable + keyboard menu buttons (G/C/B), status strip, new-run reset guard

### Phase 4 — Auto Battler (2026-02-28)
- battle.js: tick-based (1.2s) auto-battle loop with party vs enemy lane rendering
- Party lane: card portraits, rarity border, HP bars, shield/debuff indicators, KO overlay
- Enemy lane: HP bars, elite/boss badges, ability name display, phase threshold markers
- Ability resolver: Cups=heal ally, Swords=attack+slow, Pentacles=attack+self-shield, Wands=high dmg
- Major Arcana abilities: 11 unique card abilities (Fool, Magician, Empress, Tower, Star, Moon, Sun, Judgement, World, etc.)
- Enemy abilities: onEngage, onTick, onHit, onDeath, passive — all 10 waves implemented
- Boss phases: The World triggers Mirror of Suits at 66% HP, World Dominion at 33% HP
- Wave scaling: enemy stats scale +15% per wave beyond their base wave
- Action log: 6-line scrolling log with color-coded entries per action type
- Tick progress bar in log panel; result overlay with gem award + continue/retry prompts
- Win: awards wave gem reward, advances wave, saves; Loss: deducts life, consolation gems

### Phase 3 — Collection & Party Builder (2026-02-28)
- collection.js: scrollable 5-column card grid with thumbnail art, star rating, dupe count badge, in-party indicator
- Click-to-assign: clicking a grid card auto-fills the next empty party slot; clicking a filled slot removes it
- Card detail panel: art, name, rarity, suit, stars, HP/ATK/SPD/DEF stats, keywords, ability text
- Fusion UI: shows dupe count vs. cost; Fuse button (F key or click) when dupes are sufficient
- Mouse wheel + arrow key / Page Up/Down scrolling on the card grid
- Party slots rebuild on every change; selection state clears correctly on assign/remove

### Phase 5 — The Reading (2026-03-03)
- reading.js: animated card flip (enter → shake → reveal), reversed/upright detection (30% reversed)
- 5 blessings: Blaze (ATK+20%), Clarity (SPD+1), Ward (shield), Mending (instant heal), Fortune (legendary item)
- 5 curses: Poisoned (5% HP/tick), Weakened (ATK-20%), Slowed (SPD-1), Cursed (pity frozen), Hexed (gems halved)
- state.js: activeOmen, omenWavesLeft, items (max 3), pityFrozen, applyOmen/tickOmen/isReadingWave/addItem/useItem
- config.js: BLESSINGS, CURSES, LEGENDARY_ITEMS, READING_WAVES, MAX_ITEMS, REVERSED_CHANCE
- sounds.js: playReadingFlip, playOmenBlessing, playOmenCurse, playItemUsed
- battle.js: hexed gem-halving in _resolveBattle, poison tick in _runTick, stat modifiers in _makePartyCombatant
- battle.js: reading-wave redirects ENTER key and result overlay to 'reading' scene after waves 5/10
- main.js: hub shows active omen banner + items inventory with click-to-use buttons
- ui.js: nav bar gains '(X) Reading' button

### Battle UX fixes (2026-02-28)
- Battle no longer starts automatically; a "Start Battle" overlay is shown with matchup info and a (Space) button
- Start Battle button is disabled (greyed, no interaction) when the party has no cards assigned
- Nav bar is now rendered unconditionally before any early-return error checks, so it is always present on the battle screen

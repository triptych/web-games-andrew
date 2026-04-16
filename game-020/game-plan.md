# The River

**Genre:** Narrative RPG / Roguelite
**Engine:** Phaser 4.0.0
**Target Resolution:** 1280 × 720
**Status:** Phase 3 Complete

---

## Concept

You are a retired warrior who has bought a boat and is sailing down the river on your "last adventure." Along the way you encounter many different folks who are also at the end of their journeys, and you invite some to come along with you. At the end of the river is a tower of an old dark lord who invites you all to a big dinner. Your success is based on the type of people you've brought, the ingredients collected, and the combined cooking and decorating skills assembled. Every run is slightly different, and hints about what you need arrive via a daily magical news update from the dark tower.

The tone is warm and bittersweet — late-autumn, end-of-era. Nobody is young. Everyone has a story. The dark lord is more lonely than threatening. The river is a journey toward acceptance, community, and one last good meal.

---

## Core Mechanics

### 1. River Journey
The river is divided into `RIVER_SEGMENTS` (10) stops. At each stop you receive an encounter card: a traveler seeking passage, an ingredient spotted on the bank, or a random river event. You choose to invite/take or pass. After all stops, the game transitions to the dinner evaluation.

### 2. Companion System
Up to 6 travelers can join the boat. Each companion has one or more skills: `cooking`, `decorating`, `music`, `stories`, `wisdom`, `strength`. Skills contribute directly to the dinner score. Rare companions are hard to find but multiply contribution.

### 3. Ingredient Collection
8 ingredient types across two categories — `cooking` and `decorating`. Ingredients stack and add flat bonuses at the dinner. Choosing companions vs. ingredients is the core tension each stop.

### 4. Dinner Evaluation
At the tower, a weighted score is calculated from companion skills + ingredient counts. The outcome ranges from Catastrophe to Legendary Feast, with flavor text narrating what went right or wrong.

### 5. Tower News Broadcasts
Every ~30–45 seconds of play, the dark tower sends a "broadcast" hinting at what the lord particularly values that run. This nudges strategy mid-journey without locking it in.

### 6. Run Variance
Each run uses a seeded random number generator keyed to a random seed. The encounter order, companion pool weighting, and ingredient placement vary per run, keeping repeat playthroughs fresh.

---

## Game Loop

1. **Splash** — read the daily tower dispatch (a broad hint), press any key to begin
2. **River Journey** — 10 encounter cards in sequence; choose Invite/Take or Pass for each
3. **Tower Broadcast** — mid-journey hints prompt strategy adjustments
4. **Dinner Evaluation** — score tallied, outcome narrated with flavor text
5. **Restart or Title** — press R to sail again with a new seed

A single run takes roughly 3–6 minutes.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Choose option A (Invite / Take) | Left Arrow or Space |
| Choose option B (Pass / Leave)  | Right Arrow |
| Click choice | Mouse (buttons are interactive) |
| Restart | R |
| Return to title | Escape |

---

## Progression / Difficulty

- No explicit difficulty slider — variance comes from encounter luck and player choices.
- Rare companions appear with roughly 1-in-4 probability; they confer larger skill bonuses.
- The tower's secret preference (revealed by news broadcasts) shifts the optimal companion/ingredient balance each run.
- Future phases can add "relationship" depth (some companion combinations are incompatible) or adverse weather events that reduce available choices.

---

## UI / HUD

- **Top-right**: Companion count / Ingredient count
- **Top-left**: "Joined: [emoji] [name]" flash on new companion
- **Center**: Encounter card (emoji, name, skills, flavor text, two choice buttons)
- **Bottom strip**: Companion emoji parade (all current passengers)
- **Progress bar**: River segment progress (0 → 10)
- **Bottom ticker**: Latest tower news broadcast in gold text
- **Location label**: Name of current river stop above the card

---

## Sound Design

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Any button press | Short sine blip |
| River Move | Advancing to next segment | Gentle sine sweep, water feel |
| Companion Join | Traveler invited | Warm three-note chord |
| Companion Decline | Traveler passed | Short descending sine |
| Ingredient Pickup | Item collected | Two-tone sparkle |
| News Alert | Tower broadcast received | Ominous bell / slight detune |
| Success | Great/Legendary dinner | Four-note ascending fanfare |
| Failure | Poor/Catastrophe dinner | Descending sawtooth + noise |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, main
- [x] SplashScene with random tower dispatch flavor
- [x] GameScene: river journey loop, encounter cards, companion/ingredient choices
- [x] UIScene: companion count, ingredient count, news ticker
- [x] Dinner evaluation with weighted score and outcome text
- [x] Tower news broadcasts (timed mid-journey)
- [x] Launcher entry (gamedata.js)

### Phase 2 — Polish & Depth
- [x] Visual river animation (scrolling water parallax)
- [x] Companion interaction text (brief unique dialogue for each type)
- [x] Incompatible companion pairs (e.g., Knight and Merchant clash)
- [x] 3–5 additional event card types (storms, floating debris, foraging, fog, river festival, tower raven)
- [x] Tower news tied to run seed (same seed → same hints)
- [x] Simple music track (procedural ambient drone via Web Audio)

### Phase 3 — Content Expansion
- [x] 22 companion types (8 common, 8 uncommon, 6 rare — wider skill spread)
- [x] Ingredient crafting: combine two ingredients at a foraging stop for a rarer one (4 recipes)
- [x] Lord's secret preference (hidden 1.5× multiplier revealed only at dinner; raven hint at segment 5)
- [x] Persistent high-score log across runs (localStorage, top 5 runs shown on splash)
- [x] Alternate endings (5 special endings based on party composition and crafted items)

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | UIScene |
| `livesChanged` | newLives | state | UIScene |
| `gameOver` | — | state | UIScene, GameScene |
| `companionInvited` | companionDef | state | UIScene |
| `companionDeclined` | companionDef | GameScene | (future) |
| `ingredientCollected` | ingredientDef | state | UIScene |
| `riverAdvanced` | segmentIndex | state | UIScene |
| `newsReceived` | { text, turn } | state | (log / future) |
| `dinnerScored` | { score, outcome } | state | (future results screen) |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Phaser.Game init, scene boot |
| `config.js` | Constants: companions, ingredients, thresholds, colors |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (companions, ingredients, river position) |
| `sounds.js` | Web Audio API sound effects |
| `SplashScene.js` | Title screen with tower dispatch flavor |
| `GameScene.js` | River journey loop, encounter cards, dinner evaluation |
| `UIScene.js` | HUD overlay (companion count, ingredient count, news ticker) |

---

## Open Questions

- [ ] Should the lord's secret preference be hidden until the dinner reveal, or partially hinted via news? (Currently: hinted via news, not locked)
- [ ] Should companions be able to leave (disagree with each other) or is the boat always safe?
- [ ] Do we want a soft "morale" system — traveler happiness affecting skill output?
- [ ] Should rare ingredients be a separate rarity tier from common ones?
- [ ] What's the target replayability loop — endless or a "complete" arc over N runs?

---

## Changelog

### Phase 1 — Scaffold (2026-04-15)
- Initial scaffold: index.html, config, events, state, sounds, main
- SplashScene with rotating tower dispatch hints
- GameScene with seeded encounter queue, companion + ingredient cards, dinner score
- UIScene HUD overlay
- Launcher entry added to gamedata.js

### Phase 3 — Content Expansion (2026-04-16)
- 22 companion types (added farmer, innkeeper, weaver, fisherman, scribe, candlemaker, hunter, monk, brewmaster, mapmaker)
- 3 new incompatible pairs (monk/brewmaster, scribe/sailor, hunter/gardener)
- 4 crafting recipes at foraging stops (herb+spice→tincture, fish+wine→stew, flower+ribbon→garland, candle+gem→centrepiece); CRAFT button replaces A button when inputs are held
- Lord's secret preference system: seed-derived skill (cooking/decorating/music/stories/wisdom/strength) with 1.5× multiplier; raven hint delivered after segment 4; revealed at dinner with label
- Crafted ingredient bonus: +6 score each; shown in breakdown
- 5 alternate endings checked at dinner (all_music, all_wisdom, full_boat, lone_traveler, legendary_crafter)
- Persistent high-score log (localStorage): best score + last 3 runs shown on splash screen
- Dinner screen reworked: alternate ending label/text takes precedence over standard outcome; high-score comparison shown inline
- Score cap raised from 120 to 150

### Phase 2 — Polish & Depth (2026-04-15)
- Scrolling 3-layer river parallax (far/mid/near water strips with ripple lines)
- Unique dialogue line per companion archetype (12 types covered)
- 4 incompatible companion pairs with warning text on card and dinner score penalty (-8 per clash)
- 7 event card types: Calm Waters, Sudden Storm, Floating Debris, Foraging Stop (grants bonus ingredient), River Festival, Morning Fog, Tower Raven
- Tower news broadcasts now seed-derived (same seed → same hint order per run)
- Procedural ambient drone music: 3-layer Web Audio (low detuned sine pair, mid sine, shimmer with slow LFO)

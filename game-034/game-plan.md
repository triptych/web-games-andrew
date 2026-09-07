# Idle Delve

**Genre:** Idle / incremental dungeon crawler
**Engine:** Vanilla HTML/CSS/JS — raw Canvas 2D, no libraries, no image assets (fully procedural graphics)
**Target Resolution:** Responsive, canvas targets 960 × 540 internally
**Status:** Phases 1–3 complete

---

## Concept

A party of heroes automatically delves into a procedurally generated dungeon, fighting monsters room by room, even while you're not looking. Gold and loot drop from kills; spend it between (or during) runs on permanent upgrades — more heroes, better stats, faster delve speed, deeper starting floors. When the party wipes, they return to town, bank their gold, and you send them back down stronger. The loop rewards checking in occasionally rather than constant input — the core idle promise.

Fills gap **#8** from [future_games.md](../future_games.md): "idle/incremental with a dungeon theme" — ties the idle-genre gap flagged in `docs/generic/suggestions.md` (#11) to this repo's large dungeon-crawler cluster (game-003/006/008/021/025/026/030/031/032), giving the idle mechanic a strong thematic identity instead of being a generic clicker.

---

## Core Mechanics

### 1. Procedural dungeon generation
Each "delve" generates a fresh linear sequence of rooms (a "floor path") using simple procedural rules: room count scales with depth, each room gets a randomized monster encounter (type + count scaled to depth), occasional treasure rooms (bonus gold, no fight) and rest rooms (free heal). Floor layout is drawn procedurally as a scrolling corridor of rooms on canvas — no tile art, just generated rectangles/patterns per room type and depth-based color palette shift (darker/redder the deeper you go).

### 2. Auto-battle combat
No direct control during combat. Party (1–4 heroes) vs a room's monster group resolves automatically tick-by-tick: heroes and monsters take turns dealing damage based on stats (ATK, DEF, HP, SPD-derived turn order) with a bit of randomness (crit chance, variance band). Combat plays out visually — simple procedural stick/blob sprites bob and flash on hit, floating damage numbers, HP bars over each combatant.

### 3. Idle progression while away
The game simulates elapsed time on load (and on an interval while open) — if the tab was closed/backgrounded, catch-up simulation fast-forwards through however many rooms/floors would have completed, then reports a summary ("While you were away: cleared 3 floors, earned 420 gold, party wiped once"). Uses `localStorage` for persistence and `Date.now()` deltas, capped at a reasonable max offline duration (e.g. 12h) to avoid absurd catch-up loops.

### 4. Town / upgrade hub
Between-room (or anytime, non-blocking) UI panel to spend banked gold on permanent upgrades: recruit additional heroes (up to 4), upgrade a hero's class tier (better base stats), buy stat multipliers (ATK/DEF/HP/gold-find), unlock deeper starting floor (skip early floors on new delves), buy auto-revive charges. Costs scale up per purchase (typical idle-game exponential cost curve).

### 5. Death & floor reset loop
When the whole party dies, the run ends: gold earned this run is banked (with a small "keep going" bonus for surviving deeper), and a new delve starts automatically from the upgraded starting floor. No punishing full loss — pure forward progress, the idle-genre hallmark.

### 6. Procedural visuals (no image assets)
Everything drawn with Canvas 2D primitives: gradient-filled rects for room backgrounds keyed by depth/type, simple geometric "sprites" for heroes (colored blob + weapon-line shapes per class) and monsters (color/shape families per monster tier), particle bursts (small squares) on hits/deaths/gold pickups, procedural torch-flicker lighting via radial gradients.

---

## Game Loop

1. Page loads → restore saved state from `localStorage` (party, upgrades, gold, floor progress) → simulate offline catch-up → show "While you were away" summary if applicable.
2. Party is walking the current floor's room sequence. Each room: short "approach" beat → auto-battle resolves → victory (loot/gold, flash) or the rare full-party wipe → advance to next room or next floor.
3. Player can, at any time, open the Town panel to spend gold on upgrades — this doesn't pause the delve, it runs concurrently (idle games shouldn't force a stop-and-shop screen).
4. On full party wipe: run summary toast, gold banked, delve restarts from configured starting floor with current roster/upgrades.
5. Session auto-saves to `localStorage` periodically and on `visibilitychange`/`beforeunload`.

---

## Player Controls

| Action | Input |
|--------|-------|
| Open/close Town (upgrades) panel | Click "Town" tab / button |
| Buy upgrade | Click upgrade card (disabled if unaffordable) |
| Toggle speed (1x/2x/4x) | Click speed button |
| Mute/unmute sound | Click speaker icon |
| Manually dismiss "away" summary | Click / any key |

Fully mouse/click driven — no keyboard requirement, matching idle-genre conventions (must also work reasonably on mobile touch).

---

## Progression / Difficulty

- **Depth scaling**: monster HP/ATK and room count per floor scale with an exponential-ish curve against floor number; gold reward scales similarly so later floors are proportionally more lucrative but riskier.
- **Upgrade cost curve**: each upgrade tier costs `base * growth^level` (growth ~1.15–1.3 depending on upgrade), standard idle-game shape.
- **Starting floor unlock**: a specific high-cost upgrade path lets new delves begin deeper, which is the main long-term lever once low floors are trivial.
- **Soft prestige-lite**: not a full prestige system for v1 — noted as a possible Phase 3+ stretch goal (reset run for a permanent multiplier) if time allows.

---

## UI / HUD

- **Top bar**: gold counter (animated count-up), current floor/room indicator, speed toggle, mute toggle.
- **Main canvas**: procedural dungeon corridor view — current room drawn center-stage, combatants, HP bars, floating combat text, particles.
- **Party strip**: small portraits (procedural) with HP bars for each active hero, along the bottom of the canvas or a side panel.
- **Town panel**: slide-in/overlay panel — list of upgrade cards (icon, name, current level, effect description, cost, buy button), tabs for Heroes / Stats / Delve.
- **Away-summary toast**: shown once on load if offline time elapsed, auto-dismiss or click-to-dismiss.
- **Combat log** (optional small scrolling text feed): "Aldric hits Goblin for 12", "Party defeated Slime Pack!" — reinforces what the auto-battle is doing.

---

## Sound Design

Web Audio API, procedural, no files:

| Sound | Trigger | Style |
|-------|---------|-------|
| Hit (hero attacks) | Damage dealt | Short square-wave thock, pitch varies with damage |
| Crit hit | Critical damage roll | Sharper/louder version of hit + tiny noise burst |
| Monster death | Enemy killed | Downward sweep + noise puff |
| Hero down | Hero HP hits 0 | Low sawtooth sweep |
| Party wipe | Full wipe | Longer descending sweep, game-over style |
| Gold pickup | Gold awarded | Bright ascending sine blips (reuse `playPickup`-style) |
| Room clear | Room fully cleared | Short triumphant 3-note sine arpeggio |
| Floor advance | New floor reached | Slightly grander chime, more notes |
| UI click | Buttons/upgrade buys | Short neutral blip |
| Upgrade purchased | Successful buy | Rising two-note confirm |

All sounds gated behind a mute toggle and an `initAudio()` call on first user gesture (browser autoplay policy).

---

## Phases

### Phase 1 — Foundation (complete)
- [x] game-plan.md
- [x] Scaffold: index.html, css, config.js, events.js, state.js, sounds.js
- [x] Basic canvas render loop + procedural room drawing
- [x] Static single-room combat proof of concept (no depth scaling yet)

### Phase 2 — Core Loop (complete)
- [x] Full room/floor progression + procedural dungeon generation
- [x] Auto-battle system (turn order, damage, crit, floating text)
- [x] Gold economy + Town upgrade panel with 6 upgrade types (recruit, revive, atk, def, hp, goldfind, startFloor)
- [x] Party wipe / floor reset loop (with auto-revive charges before a full reset)

### Phase 3 — Idle Persistence & Polish (complete)
- [x] `localStorage` save/load + offline catch-up simulation + away-summary toast
- [x] Speed toggle (1x/2x/4x), combat log feed, particle polish
- [x] Full sound pass
- [ ] Dedicated mobile/touch pass — responsive CSS breakpoints are in place; not yet verified on a real touch device

### Phase 4 — Stretch (not started)
- [ ] Prestige-lite reset multiplier
- [ ] More hero classes / monster variety beyond the current 4 hero classes + 6 monster tiers + boss tier

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `goldChanged` | newGold | state | ui |
| `floorChanged` | newFloor | state | ui |
| `roomChanged` | roomIndex, roomDef | dungeon | ui, combat |
| `combatLog` | message | combat | ui |
| `heroDamaged` | heroId, amount, isCrit | combat | ui, sounds |
| `monsterDamaged` | monsterId, amount, isCrit | combat | ui, sounds |
| `heroDied` | heroId | combat | ui, sounds |
| `monsterDied` | monsterId | combat | ui, sounds |
| `roomCleared` | roomIndex | combat | dungeon, ui, sounds |
| `partyWiped` | floor, goldEarned | combat | state, ui, sounds |
| `upgradePurchased` | upgradeId, newLevel | shop | state, ui, sounds |
| `awaySummary` | { elapsedMs, floorsCleared, goldEarned, wipes } | main (on load) | ui |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `index.html` | DOM shell — canvas, top bar, party strip, town panel, toasts |
| `css/style.css` | All visual styling (layout, panels, procedural-friendly dark dungeon theme) |
| `js/main.js` | Boot sequence, render loop (`requestAnimationFrame`), tick scheduler, offline catch-up |
| `js/config.js` | Balance constants — monster tiers, upgrade cost curves, hero class defs |
| `js/events.js` | EventBus singleton (same pattern as other games in repo) |
| `js/state.js` | GameState singleton — gold, floor/room index, roster, upgrade levels; `save()`/`load()` |
| `js/dungeon.js` | Procedural floor/room generation |
| `js/combat.js` | Auto-battle resolution, turn order, damage math |
| `js/heroes.js` | Hero class defs, roster management, stat computation from upgrades |
| `js/monsters.js` | Monster tier defs, scaling by floor |
| `js/shop.js` | Upgrade catalog, cost curve, purchase logic |
| `js/render.js` | Canvas 2D procedural drawing — rooms, combatants, particles, HP bars |
| `js/ui.js` | DOM HUD bindings (gold counter, town panel, toasts, combat log) |
| `js/sounds.js` | Web Audio API procedural sound effects |

---

## Open Questions

- [ ] Exact hero class roster for v1 (planning: Fighter, Archer, Mage, Cleric — melee/ranged/burst/healer covers auto-battle variety without needing player micromanagement)
- [ ] Whether boss rooms (every 5th floor) ship in Phase 2 or Phase 4 stretch
- [ ] Offline cap: defaulting to 12h capped catch-up to keep numbers sane; revisit if playtesting feels off

---

## Changelog

### Phases 1–3 (2026-09-03)
- Initial game-plan written
- Full vanilla JS implementation: `index.html`, `css/style.css`, `js/{config,events,state,heroes,monsters,dungeon,combat,render,shop,ui,sounds,main}.js`
- Procedural dungeon generation, auto-battle engine, Town upgrade shop (6 upgrade types), gold economy
- `localStorage` persistence + offline catch-up simulation with away-summary toast
- Fixed a bug where the offline catch-up simulation could land exactly on a floor boundary (`roomIdx === rooms.length`), leaving the live tick scheduler reading past the end of the room array — caught via a Playwright smoke test that rewound `lastSeenAt` by 2 hours and reloaded
- Added to launcher (`js/gamedata.js`) and themed play-button color (`css/styles.css`); README/CHANGELOG/backlog docs updated

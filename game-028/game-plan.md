# Echoes of Aethermoor

**Genre:** Visual Novel / Fantasy RPG
**Engine:** Phaser 4.0.0 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Phase 2 complete

---

## Concept

A Phaser 4 visual novel fantasy RPG with branching dialogue, turn-based battles, a cast of fantasy characters, explorable tile-based maps, quests, items, and a deep multi-chapter storyline. The player leads a party of four heroes — a wandering mage, an exiled knight, an elven ranger, and a reformed warlock — through four chapters as they uncover the truth behind the awakening of the Lich of Aethermoor.

The game blends classic JRPG mechanics (SPD-ordered turn-based combat, ability costs, status effects) with visual novel presentation (typewriter dialogue, portrait art, narrative choices that set story flags and open new quests).

---

## Core Mechanics

### 1. Tile-based Exploration (MapScene)
Player moves tile by tile on hand-authored maps. Each map has NPCs, exits to other maps, random encounter zones, and event tiles (lore, treasure, boss triggers). Maps are chapter-gated via condition checks on exits and NPCs.

### 2. Branching Dialogue (DialogScene)
Typewriter-speed text, speaker portraits, and choice menus. Choices can trigger side-effects: accepting quests, giving items, setting story flags, joining party members, opening shops, resting at inns.

### 3. Turn-based Battle (BattleScene)
Combatants are sorted by SPD. Player chooses actions (Attack / Abilities / Item / Flee) from a menu. Abilities cost MP. Enemy AI picks random abilities. Status effects planned (poison, stun, weaken, taunt, guard, lifesteal). Win → XP + gold + loot. Lose → game over.

### 4. Party & Progression
Four recruitable party members each with unique ability kits. Global XP shared across party — levelling raises max HP/MP (8%/6% per level) and ATK/DEF/SPD (5% per level). Orin recruits in Thornhaven (Ch2), Sera in Thornwood (Ch2), Thane in the Ruins (Ch3). Gold buys items from shops.

### 5. Quests
Quests are accepted via NPC dialogue and tracked in state. Objectives include: defeat N enemies, collect N items, talk to NPC, visit map, trigger story flag. Completions grant XP, gold, and items.

### 6. Inventory & Items
Consumables (heal HP/MP, cure status, revive), weapons (+ATK), armor (+DEF). Items are looted from enemies, bought from shops, or given by quests. In-game Menu (M key) shows Party, Items, Quests, Map tabs.

---

## Game Loop

1. Start in **Thornhaven Village** → talk to Elder Varec → accept first quest
2. Explore the **Thornwood Forest** → fight random encounters → find Borin
3. Return to village → complete quest → buy gear at blacksmith → rest at inn
4. Story progresses through **Chapter 2** (Orin's arc, World Tree) and **Chapter 3** (sealing the ruins)
5. **Chapter 4** final boss — the Lich of Aethermoor — in the ruins depths
6. Victory screen → credits

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move   | Arrow Keys / WASD |
| Interact / Confirm | Space / Enter |
| Open Menu | M |
| Back / Close | Escape |
| Battle: navigate | Arrow Keys |
| Battle: confirm | Space / Enter |
| Dialog: advance | Space / Enter |
| Dialog: navigate choices | Arrow Keys |

---

## Characters

### Party Members
| Character | Class | Role | Unlock |
|-----------|-------|------|--------|
| Lyra | Wandering Mage | Magic DPS + Healer | Start |
| Orin | Iron Vanguard | Tank | Chapter 2 |
| Sera | Thornwood Ranger | Physical DPS + Debuffer | Chapter 2 |
| Thane | Soulbrand Warlock | Magic DPS + Debuffer | Chapter 3 |

### Key NPCs
- Elder Varec — Village Elder, quest giver
- Farmer Holt — quest giver
- Borin — missing merchant, story witness
- Marta (Blacksmith) — shop
- Aldric (Innkeeper) — rest/restore
- Sylvara (Dryad) — Chapter 2 quest giver
- Scholar Aneth — Chapter 3 quest giver

### Enemies
Slimes, Forest Wolves, Thornwood Bandits, Stone Golems, Lich Shards, and the Lich of Aethermoor (final boss).

---

## Story / Chapters

### Chapter 1 — The Road to Thornhaven
Lyra arrives in Thornhaven, a village on the edge of the corrupted Thornwood. She hears of missing merchants and slime infestations, and discovers the Academy ruins that hold the scroll behind her exile.

### Chapter 2 — Roots and Oaths
Orin and Sera join the party. An ancient dryad reveals the lich-shards are poisoning the World Tree. Orin confronts the corrupted paladin Korvas who exiled him.

### Chapter 3 — The Third Shard
Scholar Aneth reveals that three lich shards power the seal on the Aethermoor ruins. The party destroys them and breaks the seal, with Thane joining before the final descent.

### Chapter 4 — Echoes End
The party enters the Aethermoor ruins and faces the Lich of Aethermoor. Victory reveals the prophecy Lyra carried: she was always the key to the Lich's defeat — or awakening. The choice is hers.

---

## Maps

| Map | Description |
|-----|-------------|
| thornhaven | Village — shops, inn, quest givers, NPCs |
| thornwood | Forest — random encounters, boss encounter, dryad, Borin |
| map_ruins | Aethermoor Ruins — chapter 3+, lich shards, scholar, final boss |

---

## Progression / Difficulty

- Chapter 1: slimes, wolves, bandits (weak)
- Chapter 2: wolves + bandits (medium), stone golem boss
- Chapter 3: lich shards + bandits (hard), ruins mobs
- Chapter 4: lich shards + golems + final boss (very hard)
- Difficulty gates via story flags — you cannot reach the ruins until chapter 3

---

## UI / HUD

- Top-right: gold counter
- Top-center: chapter label
- Bottom: XP bar strip
- Toast notifications: level up, quest accepted/completed, item received
- Menu (M): Party / Items / Quests / Map tabs
- Battle: combatant portraits, HP/MP bars, action menu, battle log

---

## Sound Design

All sounds are procedural Web Audio API — no file assets.

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Menu navigation | Short sine blip |
| Menu Open | Open pause menu | Rising triangle chord |
| Dialog Advance | Next dialog line | Soft sine blip |
| Dialog End | Dialog tree closes | Two-note chime |
| Footstep | Player movement | Short noise burst |
| Battle Start | Encounter triggers | Rising sawtooth fanfare |
| Sword Swing | Physical attack | Sawtooth sweep + noise |
| Magic Cast | Spell use | Sine sweep + triangle |
| Heal | Heal ability | Rising triangle chord |
| Hit | Damage received | Square sweep + noise |
| Death | Entity dies | Sawtooth fall + noise |
| Victory | Battle won | Ascending sine fanfare |
| Item Pickup | Item received | Double sine blip |
| Quest Complete | Quest finished | Ascending triangle fanfare |
| Level Up | Level gained | Rising sine fanfare |
| Game Over | Party wiped | Sawtooth fall + noise |

---

## Phases

### Phase 1 — Foundation ✅ (2026-06-27)
- [x] Scaffold: index.html, config, events, state, sounds, main
- [x] SplashScene with lore blurb and star field
- [x] MapScene: tile rendering, player movement, NPC detection, random encounters, map exits, event tiles, condition checks
- [x] BattleScene: turn-order by SPD, ability system, player menus, enemy AI, damage calc, loot/XP/gold rewards
- [x] DialogScene: typewriter text, speaker portraits, choice menus, action handlers (quests, items, flags, rest, shop hooks)
- [x] MenuScene: Party / Items / Quests / Map tabs
- [x] UIScene: gold, chapter, XP bar, toast notifications
- [x] characters.js: 4 party members + 6 enemy types with abilities and loot tables
- [x] items.js: 16 items across consumable/weapon/armor/key categories
- [x] quests.js: 8 quests across 4 chapters
- [x] dialog.js: 7 NPCs + 7 dialog trees
- [x] maps.js: 3 tile-based maps (thornhaven, thornwood, map_ruins)

### Phase 2 — Content & Systems ✅ (2026-06-27)
- [x] Per-character HP/MP persistence across battles (state._partyHp/Mp maps, written back on battle end)
- [x] Status effects: poison (6% maxHP/turn for 3 turns), stun (skip 1 turn) — applied by abilities, shown as ☠/💫 icons; enemies can inflict too
- [x] Item use in battle — new `item` phase in action menu; heals lowest-HP ally, restores MP, revives fallen
- [x] Inn rest: full HP/MP restore for 30 gold, "not enough gold" message if broke (DialogScene `rest` action)
- [x] Party member recruitment: Orin dialog tree in Thornhaven (Ch2+), Sera in Thornwood (Ch2+), Thane in Ruins (Ch3+); NPCs removed from map after joining
- [x] Character-level stat scaling: maxHP +8%/level, maxMP +6%/level, ATK/DEF/SPD +5%/level; HP healed for gained portion on level-up
- [x] MapScene blocked exit message: floating tooltip shows chapter requirement when player hits a gated exit
- [x] MenuScene Party tab: shows live HP/MP from state with color-coded bars (red <30%, yellow <60%, green), scaled stats

### Phase 3 — Maps & Story
- [ ] Chapters 3 and 4 full story flow (chapter advancement gating via NPC dialog actions)
- [ ] map_ruins enemy encounters and final boss trigger (flag_seal_broken → boss event at tx:10, ty:18)
- [ ] Ending screen (victory cutscene text after defeating Aethermoor Lich)
- [ ] Shop system (blacksmith_stock, general_stock) — dialog `shop` action currently a stub
- [ ] Save/load via localStorage

### Phase 4 — Polish
- [ ] Map tile art (colored shapes → sprite frames or emoji tiles)
- [ ] Battle background art (map-specific)
- [ ] Party member portrait frames per character
- [ ] Map parallax or atmospheric effects
- [ ] Menu sound feedback tuning
- [ ] Mobile / touch input

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `goldChanged` | newGold | state | UIScene |
| `xpChanged` | newXP | state | UIScene |
| `levelUp` | newLevel | state | UIScene (toast) |
| `hpChanged` | { member, hp } | battle | UIScene |
| `partyChanged` | party[] | state | MenuScene |
| `questAccepted` | questId | state | UIScene (toast) |
| `questCompleted` | questId | state | UIScene (toast) |
| `itemAdded` | item | state | UIScene (toast) |
| `battleStart` | enemyGroup | MapScene | BattleScene |
| `battleEnd` | { won, fled, xpGained, goldGained, loot } | BattleScene | MapScene, UIScene |
| `dialogStart` | npcId | MapScene | DialogScene |
| `dialogEnd` | npcId | DialogScene | MapScene |
| `partyRestored` | — | state.restorePartyFull() | (UIScene future toast) |
| `gameOver` | — | state | MapScene |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Phaser.Game init, scene boot |
| `config.js` | Constants and definitions |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (score, gold, XP, party, inventory, quests, flags) |
| `sounds.js` | Web Audio API sound effects |
| `characters.js` | Party member and enemy definitions, encounter groups |
| `items.js` | Item definitions and loot roll helper |
| `quests.js` | Quest definitions |
| `dialog.js` | NPC definitions, dialog trees, shop stocks |
| `maps.js` | Tile map definitions, walkability |
| `SplashScene.js` | Title screen |
| `MapScene.js` | Tile-based overworld exploration |
| `BattleScene.js` | Turn-based combat |
| `DialogScene.js` | Visual novel dialogue overlay |
| `MenuScene.js` | Party / inventory / quest / map menu |
| `UIScene.js` | HUD overlay (gold, chapter, XP bar, toasts) |

---

## Open Questions

- [x] **Chapter progression**: Linear — talk to the right NPC to advance (decided: no quest-completion gating)
- [x] **Battle party size**: All recruited members fight, max 4 (decided)
- [x] **Permadeath vs. retry**: Retry-from-inn system — defeat returns to SplashScene; inn rest restores full HP/MP (decided)
- [ ] **Tile visual style**: Colored rectangles + emoji icons (current); sprite art deferred to Phase 4
- [x] **Dialog choices**: Affect quest unlocks, party recruitment, and story flags; ending variations planned for Chapter 4

---

## Changelog

### Phase 1 — Scaffold (2026-06-27)
- Initial scaffold: index.html, config, events, state, sounds, main
- SplashScene with atmospheric star field and lore intro
- MapScene: tile renderer, player movement, NPC interaction, random encounters, map transitions, event tiles
- BattleScene: SPD-sorted turns, ability menu, enemy AI, damage formula, loot/XP/gold on victory
- DialogScene: typewriter effect, choice menus, 7 NPCs, 7 dialog trees
- MenuScene: 4-tab pause menu (Party, Items, Quests, Map)
- UIScene: HUD with gold, chapter label, XP bar, toast notifications
- characters.js: Lyra, Orin, Sera, Thane + 6 enemy types
- items.js: 16 items (consumables, weapons, armor, key items)
- quests.js: 8 quests across 4 chapters
- dialog.js: Elder Varec, Farmer Holt, Borin, Blacksmith, Innkeeper, Sylvara, Scholar Aneth
- maps.js: thornhaven (village), thornwood (forest), map_ruins (Aethermoor ruins)

### Phase 2 — Content & Systems (2026-06-27)
- state.js: per-character HP/MP maps (_partyHp/_partyMp); getMaxHp/Mp (level-scaled), getScaledStat, restorePartyFull, _applyLevelUpStats
- BattleScene: reads persisted HP/MP + scaled stats on entry; writes back on exit; item menu phase (heal/MP/revive); poison + stun status effects applied from abilities and shown as icons; lifesteal and MP drain effects for enemy abilities; enemy attacks use correct sound (magic vs physical)
- DialogScene: inn rest calls state.restorePartyFull(); "not enough gold" fallback message
- dialog.js: added orin, sera, thane NPC defs; orin_recruit, sera_recruit, thane_recruit dialog trees with branching join/refuse choices
- maps.js: Orin placed in Thornhaven (Ch2+, tx:9 ty:6), Sera in Thornwood (Ch2+, tx:3 ty:8), Thane in Ruins (Ch3+, tx:5 ty:10)
- MapScene: recruited party members no longer appear as NPCs on map; _showBlockedMessage() displays chapter requirement tooltip on gated exits
- MenuScene: Party tab shows live HP/MP from state with color-coded bars and level-scaled ATK/DEF/SPD values

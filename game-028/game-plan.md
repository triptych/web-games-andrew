# Echoes of Aethermoor

**Genre:** Visual Novel / Fantasy RPG
**Engine:** Phaser 4.0.0 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Phase 4 complete

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
Slimes, Forest Wolves, Thornwood Bandits, Academy Wisps, Corrupted Knights, Stone Golems, Lich Shards, Korvas the Fallen Paladin (Chapter 2 mini-boss), and the Lich of Aethermoor (final boss).

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

| Map | Description | Reachable |
|-----|-------------|-----------|
| thornhaven | Village exterior — quest givers, doors to forge/inn | Ch1+ |
| blacksmith_interior | Marta's forge — shop | Ch1+ |
| inn_interior | Ember Hearth Inn — rest, general goods (Aldric) | Ch1+ |
| thornwood | Forest hub — random encounters, Borin, Sera, exits to all forest side-locations | Ch1+ |
| academy_ruins | Lyra's old Academy — `lyras_past` quest (elder_scroll), academy wisps | Ch1+ |
| world_tree_grove | Sylvara's real home — 3 corrupted anchor points cleansed with soul gems | Ch2+ |
| korvas_chapel | Shattered chapel — Orin confronts Korvas (mini-boss) | Ch2+, after grove anchors cleansed |
| aethermoor_ruins | Outer ruins — Scholar Aneth, lich shard grinding, seal-breaking | Ch3+ |
| aethermoor_sanctum | True final dungeon — the Lich of Aethermoor | after `flag_seal_broken` |

Each map's tile grid, NPC positions, exits, and events are validated at build time (dimensions match, every NPC/exit/event tile is walkable, every exit lands on a walkable destination tile) — see the Phase 4 changelog.

---

## Progression / Difficulty

- Chapter 1: slimes, wolves, bandits, academy wisps (weak)
- Chapter 2: wolves + bandits (medium), forest wolves in the grove, corrupted knights + Korvas (chapel mini-boss, hard)
- Chapter 3: lich shards + bandits (hard), outer ruins mobs
- Chapter 4: sanctum mobs (lich shards, golems, corrupted knights) + final boss (very hard)
- Difficulty gates via story flags and chapter checks — the World Tree Grove needs Ch2, the chapel needs all 3 grove anchors cleansed, the outer ruins need Ch3, and the sanctum needs `flag_seal_broken`

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

### Phase 3 — Maps & Story ✅ (2026-07-11)
- [x] Chapters 3 and 4 full story flow (chapter advancement gating via NPC dialog actions)
- [x] map_ruins enemy encounters and final boss trigger (flag_seal_broken → boss event at tx:10, ty:18)
- [x] Ending screen (victory cutscene text after defeating Aethermoor Lich)
- [x] Shop system (blacksmith_stock, general_stock) — dialog `shop` action now opens a real buy UI
- [x] Save/load via localStorage

### Phase 4 — Map Overhaul ✅ (2026-07-12)
- [x] Replaced narrated story-compromises with real, walkable locations: `academy_ruins` (Lyra's past), `world_tree_grove` (Sylvara + 3 anchor points), `korvas_chapel` (Orin vs. Korvas mini-boss), split `map_ruins` into `aethermoor_ruins` (outer, Scholar Aneth) + `aethermoor_sanctum` (true final dungeon)
- [x] Real interiors for Marta (`blacksmith_interior`) and Aldric (`inn_interior`) — no more NPCs standing on village grass
- [x] Generic boss-win side-effect system (`onWin`/`onTrigger`: setFlag/giveItem/completeQuest/setChapter) shared by boss events and lore events, replacing one-off `isFinalBoss` special-casing
- [x] Fixed pre-existing softlock: `once` map events (boss fights) were marked triggered before the battle resolved, permanently blocking retry after a flee/loss
- [x] Fixed pre-existing bug: fleeing ANY battle (not just bosses) sent the player to the SplashScene as if defeated
- [x] Unified condition checking between MapScene and DialogScene (`quest_done_`, `has_item_`, `has_qty:`, `not_flag_`, `party_has_`, new `all_flags:`)
- [x] Every quest now has a real, reachable completion path — fixed two quests (`lyras_past`, `slime_infestation`) that were defined in data but never actually completable
- [x] Build-time map validator: dimensions match, every NPC/exit/event tile is walkable, every exit lands on a walkable destination tile, every dialog node reference resolves, every quest is both given and completed somewhere

### Phase 5 — Polish
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
| `battleEnd` | { won, fled, xpGained, goldGained, loot, isFinalBoss } | BattleScene | MapScene, UIScene |
| `dialogStart` | npcId | MapScene | DialogScene |
| `dialogEnd` | npcId | DialogScene | MapScene |
| `partyRestored` | — | state.restorePartyFull() | (UIScene future toast) |
| `gameOver` | — | state | MapScene |
| `anchorCleansed` | anchorId | MapScene (world_tree_grove anchor event) | (available for future UIScene toast) |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Phaser.Game init, scene boot |
| `config.js` | Constants and definitions |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton (score, gold, XP, party, inventory, quests, flags) |
| `sounds.js` | Web Audio API sound effects |
| `save.js` | localStorage save/load helpers (serialize/deserialize state) |
| `characters.js` | Party member and enemy definitions, encounter groups |
| `items.js` | Item definitions and loot roll helper |
| `quests.js` | Quest definitions |
| `dialog.js` | NPC definitions, dialog trees, shop stocks |
| `maps.js` | Tile map definitions, walkability |
| `SplashScene.js` | Title screen (Continue from save / New Game) |
| `MapScene.js` | Tile-based overworld exploration |
| `BattleScene.js` | Turn-based combat |
| `DialogScene.js` | Visual novel dialogue overlay, conditional routing, shop UI |
| `MenuScene.js` | Party / inventory / quest / map menu, save game |
| `UIScene.js` | HUD overlay (gold, chapter, XP bar, toasts) |
| `EndingScene.js` | Victory cutscene after defeating the Aethermoor Lich |

---

## Open Questions

- [x] **Chapter progression**: Linear — talk to the right NPC to advance (decided: no quest-completion gating)
- [x] **Battle party size**: All recruited members fight, max 4 (decided)
- [x] **Permadeath vs. retry**: Retry-from-inn system — defeat returns to SplashScene; inn rest restores full HP/MP (decided)
- [ ] **Tile visual style**: Colored rectangles + emoji icons (current); sprite art deferred to Phase 5
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

### Phase 3 — Maps & Story (2026-07-11)
- DialogScene: nodes now support `routes` (silent conditional jump, first matching condition wins) and choice-level `condition`; added `_checkCondition` (chapter_/quest_done_/quest_active_/has_item_/has_qty:id:n/flag_/not_flag_/party_has_) so trees can branch on live game state instead of being purely linear
- DialogScene: new action types `setChapter`, `turnInItems` (consume N of an item + complete a quest), `multi` (run several actions off one node), and `shop` (opens a real buy UI instead of the old stub)
- New shop UI in DialogScene: `_openShop`/`_drawShop`/`_buyItem`/`_closeShop` — lists SHOP_STOCKS items with buy price, gold-gated purchase, item description; wired to Marta (blacksmith_stock) and Aldric (general_stock, new "traveling goods" choice)
- dialog.js: Elder Varec, Sylvara, and Scholar Aneth now route on revisit — turning in quest proof (Borin found / 3 soul gems / 2 soul gems) completes the relevant quest and advances the chapter (1→2→3→4) as part of the conversation; Orin's `broken_oath` resolves narratively through Sylvara once he's in the party; Scholar Aneth's turn-in sets `flag_seal_broken` and starts `echoes_end`
- characters.js: added `lich_shard` to the `thornwood_hard` encounter group so `soul_gem` (needed for Sylvara's and Aneth's turn-ins) is actually farmable before the ruins are reachable
- state.js: added `getItemQty(id)` and `serialize()`/`deserialize()` for save/load
- save.js (new): `hasSave()`, `saveGame()`, `loadGame()` — JSON snapshot of state in localStorage under `echoes_of_aethermoor_save`
- SplashScene: shows "Continue" vs "New Game" prompt when a save exists; continuing calls `loadGame()` before entering MapScene
- MenuScene: Map tab shows a "Press S to save" hint and a save confirmation toast
- BattleScene/MapScene: boss encounters can be tagged `isFinalBoss`; on victory the flag flows through `battleEnd` so MapScene routes to the new EndingScene instead of resuming exploration; defeating the final boss also completes `echoes_end`
- EndingScene.js (new): victory cutscene with closing narration and run stats (level/gold/party size), returns to a fresh SplashScene on input
- maps.js: map_ruins final boss event now passes `isFinalBoss: true`

### Phase 4 — Map Overhaul (2026-07-12)
Phase 3 resolved several story beats through narration instead of real locations (Korvas's chapel, the World Tree, a distinct Academy for Lyra's scroll, the final sanctum) because those maps didn't exist yet. This phase builds them properly and rewires every dependent quest/dialog flow onto real places.

- maps.js: renamed `map_ruins` → `aethermoor_ruins` (outer ring, unchanged content) and split off `aethermoor_sanctum` (new, the true final dungeon — short crawl + the Lich of Aethermoor boss event, reachable only after `flag_seal_broken`)
- maps.js: added `academy_ruins` (Lyra's Academy — distinct from Aethermoor; `lyras_past` quest lives here: lore beats + elder_scroll treasure event + completion lore event), `world_tree_grove` (Sylvara's actual home, with 3 real "anchor point" event tiles that consume a soul gem each), `korvas_chapel` (Orin vs. Korvas mini-boss), `blacksmith_interior` and `inn_interior` (real rooms for Marta/Aldric instead of NPCs standing on village grass)
- characters.js: new enemies `academy_wisp`, `corrupted_knight`, and mini-boss `korvas`; new encounter groups `academy_easy`, `grove_easy`, `chapel_hard`, `sanctum_hard`, `boss_korvas`; `lich_shard` added to `thornwood_hard` (unchanged from Phase 3, still needed for soul gem farming)
- MapScene: new `anchor` event type — consumes a soul gem and sets a per-anchor flag (`flag_grove_anchor_N`) when stepped on with a gem in inventory, otherwise shows a non-consuming hint
- MapScene/maps.js: boss and lore events now carry a generic `onWin`/`onTrigger` payload (`{ setFlag, giveItem, completeQuest, setChapter }`) applied by a shared `_applyOnTrigger` helper — replaces the old `isFinalBoss`-only special case, used by Korvas's fight (sets `flag_korvas_confronted`, completes `broken_oath`, grants chain_mail, advances to chapter 3) and by Lyra's scroll-discovery lore beat (completes `lyras_past`)
- **Fixed softlock**: `once` map events were marked `_triggered = true` before the battle even started — fleeing or losing a boss fight (Korvas, the final boss) permanently blocked retrying it. Boss events now only mark triggered on an actual win.
- **Fixed bug**: fleeing any battle (not just bosses) sent the player to the SplashScene as if the party had been wiped. `MapScene._setupEvents` now only routes to SplashScene on a genuine loss (`!won && !fled`).
- MapScene: `_checkCondition` unified with DialogScene's (`quest_done_`, `has_item_`, `has_qty:id:n`, `not_flag_`, `party_has_`, new `all_flags:name1,name2,...`); `_showBlockedMessage` accepts a custom `blockedMsg` per exit instead of only a generic chapter-gate message
- dialog.js: Sylvara's tree reworked around the 3 real anchor flags instead of directly handing her 3 gems; her Korvas-thread routing now checks `party_has_orin` on every visit (via a `flag_broken_oath_offered` guard) so the quest is still offered even if Orin joins after the grove is already cleansed — closing a real ordering bug in the original design
- dialog.js: Farmer Holt's `slime_infestation` and the auto-active `lyras_past` quest were defined in quests.js but had **no completion path anywhere** in the original build; Farmer Holt now has a full revisit/turn-in flow, and `lyras_past` completes via the new Academy Ruins lore event
- state.js: `lyras_past` is now active from `reset()` — Lyra already knows about her own past, so there's no NPC to "give" her the quest
- quests.js: rewrote `broken_oath` (giver is now Sylvara, objective is defeating Korvas directly — the old "defeat a golem guardian" objective never matched any actual encounter), `spirit_of_the_wood` (references the real grove + anchor points), `the_third_shard` (fixed a text mismatch where the description said "destroy 5 shards" but the actual mechanic was always "turn in 2 soul gems"), `lyras_past` (points at `academy_ruins`, not the final dungeon)
- MenuScene: Map tab now shows the map's display name (`getMap(id).name`) instead of the raw map id string
- Build-time validation (not shipped code, used to verify this phase): every map's `tiles.length` matches `width*height`; every NPC/exit/event tile is walkable and in-bounds; every exit's destination tile is walkable and in-bounds; every dialog node reference (`next`/`choices[].next`/`routes[].next`) resolves to a real node or `'end'`; every quest in quests.js is both given and completed by some reachable action. Caught and fixed 2 out-of-bounds NPC/exit placements and 2 unreachable quests before they shipped.

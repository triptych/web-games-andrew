# Hearthbound

**Genre:** Cozy fantasy visual novel with light RPG mechanics
**Engine:** Custom vanilla JS engine — DOM+CSS for the VN layer, `<canvas>` for battle. No Kaplay/Phaser/three.js.
**Target Resolution:** Responsive (fills viewport)
**Status:** Planning — Phase 2

---

## Concept

You've inherited your late aunt's rundown countryside apothecary shop, tucked at the edge of a small fantasy village. Rather than sweeping adventure, this is a slow, cozy story about restocking shelves, learning herblore, and getting to know your neighbors — the frazzled assistant Mira, a retired adventurer-turned-baker, a reclusive forest witch, and others yet to come.

Occasionally the quiet is interrupted — a slime infestation in the cellar, a wolf too close to the herb patch — and you handle it yourself with a satchel of tonics and whatever nerve you've got. Choices shape how townsfolk feel about you and which parts of their lives open up to you; leveling and inventory exist to make those moments of light danger feel earned rather than as the main event.

---

## Core Mechanics

### 1. Branching dialogue
Every scene is a node in a story graph (`story.js`) with one or more lines of text followed by choices. Choices can be gated by story flags, item possession, or NPC affinity, and each choice can trigger effects (set a flag, change affinity, grant an item, grant XP, or start a battle).

### 2. NPC affinity
Each named NPC has a hidden affinity counter nudged up or down by dialogue choices. Certain choices and whole story branches only unlock once affinity with a character crosses a threshold — a lightweight relationship system that rewards paying attention to what people say they want.

### 3. Inventory & equipment
The player carries ingredients, quest items, and consumables. A single "trinket" equip slot holds one wearable item (found through the story) that grants a small permanent stat bonus (e.g. +2 Wit). Consumables like Honey Tonic can be used mid-battle to heal.

### 4. Leveling
Battles and certain story milestones grant XP. Leveling up raises max HP automatically and grants a stat point the player can spend on Strength, Wit, or Charm — Strength affects battle damage, Wit affects flee chance and gates some dialogue, Charm affects how much affinity certain choices grant. (Stat point spending UI is a Phase 3 follow-up; the state layer already supports it via `state.spendStatPoint()`.)

### 5. Light turn-based battles
A handful of story nodes trigger a battle instead of continuing straight to the next line. Battle is a simple three-option menu (Attack / Use Item / Flee) resolved over a few turns against a single enemy, rendered on a `<canvas>` overlay with HP bars. Winning or losing branches the story to a different next node — losing is rarely a hard fail, just a different (often funnier or humbler) continuation.

### 6. Save / Continue
The full game state (stats, inventory, equipment, flags, affinity, current story position) serializes to `localStorage`. The title screen offers "Continue" once a save exists.

---

## Game Loop

1. Title screen — New Game or Continue (if a save exists).
2. Story screen: read dialogue (typewriter effect, click/space to advance), pick from available choices.
3. Occasionally, a story node triggers a battle overlay; resolve it, then control returns to the story at a branch determined by the outcome.
4. Progress accumulates inventory, affinity, and levels along the way; the player can save at any time via the HUD.
5. Reaching an "ending" node shows the ending screen with a "Return to Title" option.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Advance dialogue | Click textbox / Space / Enter |
| Pick a choice | Click the choice button |
| Open/close bag | 🎒 Bag button |
| Save | 💾 Save button |
| Mute/unmute | 🔊 button |
| Battle actions | Click the battle menu buttons |

No keyboard-only path is required for Phase 1 — this is a mouse-first, click-through experience by design (matching the VN genre), with space/enter as a convenience for advancing text.

---

## Progression / Difficulty

- XP curve: `20 + (level - 1) * 15` XP to reach the next level (see `config.js: xpToNextLevel`).
- Leveling grants +4 max HP automatically, plus 1 free stat point.
- Battle difficulty is currently flat (two enemy defs: Cellar Slime, Hedge Wolf) — Phase 3+ should scale enemy stats or introduce new enemies as the story progresses further into the Whisperwood.

---

## UI / HUD

- Top bar: level, HP bar + numeric label, XP bar, Bag/Save/Mute buttons.
- VN stage: background gradient (stand-in for painted backgrounds), a large emoji "portrait" (stand-in for character art), speaker name, dialogue box with typewriter text, choice buttons that fade in once the current line(s) finish.
- Inventory: modal overlay listing item icon/name/description, with an Equip/Unequip button on wearable items.
- Battle: canvas showing player/enemy emoji sprites with HP bars, a scrolling battle log, and a menu of actions below.
- Ending: dedicated screen with closing text and a restart button.

---

## Sound Design

All Web Audio API procedural — no file assets.

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Button press, new game/continue | Short sine blip |
| Page Blip | Each typewriter character (throttled) | Very short soft sine tick |
| Choice Select | Picking a dialogue choice | Two-note sine chime |
| Level Up | XP threshold crossed | Ascending triangle arpeggio |
| Hit | Battle attack lands (either side) | Square wave downsweep |
| Success | Battle won | Sine chord arpeggio |
| Failure | Battle lost | Sawtooth downsweep + noise burst |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Custom engine scaffold: index.html (DOM+CSS VN layer, canvas battle layer), config, events, state, sounds
- [x] Dialogue engine: node traversal, condition evaluation, effect application
- [x] VN renderer: backgrounds, portraits, typewriter text, choice buttons with gating
- [x] Opening story slice: shop intro → Mira → cellar → slime battle → resolution → ending
- [x] Inventory panel with equip/unequip
- [x] Light turn-based battle system (Attack / Item / Flee) on canvas
- [x] Leveling (XP, level-up toast, stat points tracked in state)
- [x] Save/Continue via localStorage
- [x] HUD (level, HP, XP, bag, save, mute)

### Phase 2 — More Story (current)
- [x] Additional chapters: the village square (hub), the baker (Bramwell), the forest witch (Hollow)
- [x] More affinity-gated branches and a real forecloser: choosing to send for the watch (Bramwell's "safer" option) locks out Hollow's entire wolf-hunt questline — she turns you away instead of sending you after the hedge wolf, so `hollow_sends_you`, the Silver Thimble, the Hedge Wolf battle, and the deep-affinity ending are all skipped for that playthrough
- [x] A proper stat-point spending UI: `statsPanel.js` + a HUD badge (`#hud-statpoints-badge`) that appears whenever `state.stats.statPoints > 0`, opening a modal with +buttons wired to `state.spendStatPoint()`

### Phase 3 — RPG Depth
- [ ] More enemy variety and a scaling difficulty curve
- [ ] More equip slots / items with trade-offs (not just flat bonuses)
- [ ] A simple crafting or brewing mechanic using material items (mintleaf, etc.) tying inventory to dialogue outcomes

### Phase 4 — Polish
- [ ] Replace emoji stand-ins with real portrait/background art (or a distinct painterly CSS treatment)
- [ ] Multiple distinct endings reflecting major branch choices
- [ ] Settings: text speed slider, volume slider
- [ ] Accessibility pass (keyboard-only navigation through choices)

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `nodeEntered` | node object | dialogueEngine | vnRenderer |
| `nodeChanged` | nodeId | state | (currently unused externally; available for e.g. a log/history feature) |
| `storyEnded` | node object | dialogueEngine | main |
| `battleRequested` | { enemyId, onWin, onLose } | dialogueEngine | battle |
| `battleWon` / `battleLost` | enemy object | battle | (currently just logged; dialogueEngine branches via goToNode directly) |
| `itemReceived` | itemId, count | dialogueEngine | (available for a future pickup toast) |
| `inventoryChanged` | inventory array | state | inventory |
| `equipmentChanged` | equipped map | state | inventory, battle (reads effectiveStats directly) |
| `flagChanged` | flagName, value | state | (available for future conditional UI) |
| `affinityChanged` | npcId, newValue | state | (available for future relationship UI) |
| `xpChanged` | newXp | state | ui |
| `levelUp` | newLevel | state | ui, progression |
| `statsChanged` | stats object | state | ui |
| `hpChanged` | hp, maxHp | state | ui |
| `gameSaved` / `gameLoaded` | — | state | (available for a save-confirmation toast) |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Boot sequence, title/game/ending screen switching |
| `config.js` | Constants: starting stats, XP curve, item defs, enemy defs, colors |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton: stats, inventory, equipment, flags, affinity, save/load |
| `sounds.js` | Web Audio API procedural sound effects |
| `story.js` | The story graph data (nodes, portraits, backgrounds) — all the writing lives here |
| `dialogueEngine.js` | Generic story-graph traversal: condition checks, effect application, node transitions |
| `vnRenderer.js` | DOM rendering of the VN screen: background, portrait, typewriter text, choices |
| `inventory.js` | Inventory panel DOM rendering + equip/unequip |
| `progression.js` | Level-up feedback (sound + toast); XP math itself lives in state.js |
| `battle.js` | Canvas-rendered light turn-based battle system |
| `ui.js` | Persistent HUD chrome: level/HP/XP readout, save, mute |
| `statsPanel.js` | Stat-point spending UI: HUD badge + modal, wired to `state.spendStatPoint()` |

---

## Open Questions

- [ ] Should losing a battle ever be a real setback (lost items, reduced affinity) rather than just a different flavor branch, to give battles more weight?
- [ ] How many distinct NPCs/chapters before the "cozy but not shallow" balance feels right?
- [ ] Should the stat-point spend UI live in the HUD, the inventory panel, or its own screen?

---

## Changelog

### Phase 2 — More Story (2026-08-29)
- Added `village_square` hub node plus two new NPC chapters: Bramwell the baker (`bramwell_*` nodes) and Hollow the forest witch (`hollow_*` nodes)
- Added a real consequence branch: choosing to send for the watch instead of seeking out Hollow sets `calledTheWatch`, which routes `whisperwood_first_look` to a cold, foreclosed version of the Hollow meeting (`hollow_intro_cold` → `hollow_cold_end`) instead of her full questline
- Added `negate` support to `choiceIsAvailable`'s flag check so a choice/route can require a flag be *unset*
- Added a Hedge Wolf battle (`hedge_wolf_fight`) reachable only via Hollow's questline, granting the Silver Thimble (+2 Wit) beforehand and XP on resolution
- New backgrounds (`bakery`, `whisperwood_edge`, `witch_cottage`) and portraits for Bramwell and Hollow in `story.js`
- Added `statsPanel.js`: a HUD badge that appears when `state.stats.statPoints > 0`, opening a modal to spend points on Strength/Wit/Charm via `state.spendStatPoint()`

### Phase 1 — Scaffold (2026-08-28)
- Initial custom-engine scaffold: DOM+CSS VN layer, canvas battle layer, config/events/state/sounds
- Dialogue engine with condition/effect system; opening story slice (shop → Mira → cellar slime battle → resolution)
- Inventory panel, leveling with level-up toast, save/load via localStorage, persistent HUD

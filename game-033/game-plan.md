# Hearthbound

**Genre:** Cozy fantasy visual novel with light RPG mechanics
**Engine:** Custom vanilla JS engine — DOM+CSS for the VN layer, `<canvas>` for battle. No Kaplay/Phaser/three.js.
**Target Resolution:** Responsive (fills viewport)
**Status:** Phase 6 complete

---

## Concept

You've inherited your late aunt's rundown countryside apothecary shop, tucked at the edge of a small fantasy village. Rather than sweeping adventure, this is a slow, cozy story about restocking shelves, learning herblore, and getting to know your neighbors — the frazzled assistant Mira, a retired adventurer-turned-baker, a reclusive forest witch, and others yet to come.

Occasionally the quiet is interrupted — a slime infestation in the cellar, a wolf too close to the herb patch — and you handle it yourself with a satchel of tonics and whatever nerve you've got. Choices shape how townsfolk feel about you and which parts of their lives open up to you; leveling and inventory exist to make those moments of light danger feel earned rather than as the main event.

Underneath the season (Phase 6) there is one long question the early chapters only gesture at: your aunt Wisteria walked out to a stone at the heart of the Whisperwood every spring for forty years and lit a fire in it, and she died in June before she could go, and nobody has been since. The wood is coming unbound — which is why there is a hedge wolf against a village fence, a boar where a boar shouldn't be, and something enormous and grieving in a clearing nobody has visited in four months. You can fix that, or you can run a very good shop and let it wait for spring; both are endings the game means.

---

## Core Mechanics

### 1. Branching dialogue
Every scene is a node in a story graph (`story.js`) with one or more lines of text followed by choices. Choices can be gated by story flags, item possession, or NPC affinity, and each choice can trigger effects (set a flag, change affinity, grant an item, grant XP, or start a battle).

### 2. NPC affinity
Each named NPC has a hidden affinity counter nudged up or down by dialogue choices. Certain choices and whole story branches only unlock once affinity with a character crosses a threshold — a lightweight relationship system that rewards paying attention to what people say they want.

### 3. Inventory & equipment
The player carries ingredients, quest items, and consumables. Two equip slots hold wearable items found through the story: "trinket" (flat stat bonus, e.g. +2 Wit) and, as of Phase 3, "charm" (a trade-off item — a bonus in one stat paired with a penalty in another, e.g. +3 Strength/-1 Wit). Consumables with a `heal` value (Honey Tonic, and the Phase 3 brewed teas/tonics) can all be used mid-battle to heal; some also grant a guaranteed flee that turn.

### 4. Leveling
Battles and certain story milestones grant XP. Leveling up raises max HP automatically and grants a stat point the player can spend on Strength, Wit, or Charm — Strength affects battle damage, Wit affects flee chance and gates some dialogue, Charm affects how much affinity certain choices grant. Stat point spending has a dedicated UI (`statsPanel.js`) wired to `state.spendStatPoint()`.

### 5. Light turn-based battles
A handful of story nodes trigger a battle instead of continuing straight to the next line. Battle is a menu of Attack, one button per carried healing consumable, and Flee (when the enemy allows it), resolved over a few turns against a single enemy, rendered on a `<canvas>` overlay with HP bars. Enemy base stats scale with the player's level (Phase 3) so later encounters stay a real threat. Winning or losing branches the story to a different next node — losing is rarely a hard fail, just a different (often funnier or humbler) continuation.

### 6. Save / Continue
The full game state (stats, inventory, equipment, flags, affinity, current story position) serializes to `localStorage`. The title screen offers "Continue" once a save exists.

### 7. Brewing
Once the player learns to brew (a story flag set by an early Mira dialogue), a Brew button appears in the HUD. Brewing (`brewing.js` + `BREW_RECIPES` in `config.js`) consumes material items — Dried Mintleaf, River Root, Thornback Quill, Moonpetal, Beeswax, Ashen Bark, Spice Root, gathered from the shop, battle loot, foraging, the peddler, and the deep Whisperwood — to produce brewed consumables (Vigor Draught, Steady-Hand Tea, Burn Salve, Deep-Wood Cordial, Hearthbound Tea) or craftable charm-slot items. Recipes with insufficient materials show a disabled Brew button rather than being hidden, so the player can see what they're working toward.

As of Phase 6 a recipe can also carry a `flag`, in which case it stays off the list entirely until the story teaches it (the journal teaches Burn Salve, Mira teaches the Cordial, Hollow teaches Hearthbound Tea). `state.knowsRecipe()` / `recipeIsKnown()` enforce this on both the panel and `state.brew()`, so the list grows over the season instead of showing eight things you have no idea how to make.

### 8. The season: days, coin, and the shop as a job

The game runs on a day counter (`state.day`, shown in the HUD). Sleeping at the shop advances the day and restores HP; foraging the creek bank or the deep-wood shade costs a day and yields materials. A few beats are day-gated — Peddler Ock's cart arrives from Day 2, the county watch rides in on Day 3 if you sent for them.

Coin (`state.coin`, also in the HUD) comes from customers at the shop counter, who ask for a *specific* brewed item and pay for it, and is spent at Ock's cart (`trade.js`) on materials you can't forage yet. That closes the loop the premise always implied: forage → brew → sell or deliver → buy better materials. `ITEM_DEFS` entries carry a `value`; sell price is half of it, so the margin is in brewing rather than arbitrage.

### 9. Quests and lore (the Journal)

`journal.js` is a HUD panel, gated behind actually finding Wisteria's journal in her sealed workroom. It holds two lists: every quest the story has started, split into open and settled (`state.startQuest`/`completeQuest`, `QUEST_DEFS`), and every lore entry collected (`state.addLore`, `LORE_DEFS`) — journal pages and the things Granny Sessily and Hollow tell you about the hearth-stone. The story graph still gates everything on flags and items; the journal is a tracker, and it exists because an hour-long season is hard to pick back up otherwise.

### 10. Hubs

Three re-enterable hub nodes (`shop_hub`, `village_hub`, `whisperwood_gate`) plus per-character hubs (`mira_hub`, `bramwell_hub`, `hollow_hub`, `sessily_hub`, `tobin_hub`, `ock_hub`, `dorne_hub`) replace the one-way corridor the story used to be. Hub nodes must never grant items, coin or XP in their node-level `effects`, since those re-apply on every visit — there's a unit test for exactly that.

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
| Pick a choice | Click the choice button, or Tab/Arrow Up/Arrow Down to move focus + Enter/Space to select |
| Open/close bag | 🎒 Bag button, or Escape to close |
| Open/close brewing panel | 🍵 Brew button (visible once brewing is learned), or Escape to close |
| Open/close journal | 📔 Journal button (visible once the journal is found), or Escape to close |
| Open/close the peddler's cart | 🧳 Trade button (visible only at the cart), or Escape to close |
| Open/close stat-point panel | HUD badge (visible when stat points are unspent), or Escape to close |
| Open/close settings | ⚙️ button, or Escape to close |
| Save | 💾 Save button |
| Mute/unmute | 🔊 button |
| Battle actions | Click the battle menu buttons |

Phase 1 shipped mouse-first with space/enter as a convenience; Phase 4 added a full keyboard-only path for dialogue and choices (auto-focus on render, arrow-key roving focus between choice buttons, Escape to close any modal, and focus is restored to the current choice/textbox when a modal closes) as part of its accessibility pass. Phase 5 confirmed the whole game is touch-friendly on top of that: every action above already fires on tap (all handlers use `click`, which browsers dispatch for taps with no separate touch wiring needed), and tapping a modal's dimmed backdrop now closes it too, standing in for Escape on devices with no keyboard.

---

## Progression / Difficulty

- XP curve: `20 + (level - 1) * 15` XP to reach the next level (see `config.js: xpToNextLevel`).
- Leveling grants +4 max HP automatically, plus 1 free stat point.
- Seven enemy defs as of Phase 6: Cellar Slime, Hedge Wolf, Thornback Boar, Deep-Wood Stalker, Thorn Hound (driven into the village lane by the watch), Bramble Wight (guards the hearth-stone, not fleeable) and The Thorn-Crowned (the climax, not fleeable). Base stats scale multiplicatively with the player's level via `enemyScaleForLevel`/`scaledEnemy` in `config.js`, applied when `battle.js` starts an encounter — so the same enemy id hits harder and has more HP at level 10 than at level 1.
- Phase 6 deliberately keeps the battle count low relative to the story: of the eight battle nodes, exactly one (the Cellar Slime) is unavoidable. The hedge wolf can be fed or waited out instead of fought, the stalker can be backed away from, and the climax has a brewed and a spoken solution alongside the fight — in keeping with a design doc that calls its own battles "light danger" rather than the point.
- Days and coin are the other two resources. A full run to the deepest ending takes roughly four to eight in-game days depending on how much foraging and shopkeeping the player does.

---

## UI / HUD

- Top bar: level, day-of-season chip, coin chip, HP bar + numeric label, XP bar, Journal/Trade/Brew/Bag/Save/Mute/Settings buttons (Journal, Trade and Brew stay hidden until earned).
- VN stage: painterly gradient background with a vignette overlay (stand-in for painted backgrounds; see `image_prompts/` for real-art prompts), a large emoji portrait framed in a glowing medallion (stand-in for character art), speaker name, dialogue box with typewriter text, choice buttons that fade in once the current line(s) finish and auto-focus for keyboard play.
- Inventory: modal overlay listing item icon/name/description, with an Equip/Unequip button on wearable items (equipping into whichever of the two slots — trinket or charm — the item declares).
- Brewing: modal overlay listing each known recipe's icon/name/required materials, with a Brew button that's disabled (not hidden) until the player holds enough materials.
- Journal: modal overlay listing open quests, settled quests, and collected lore entries; its HUD button pulses briefly when a quest starts or finishes rather than interrupting the scene with a toast.
- Trade: modal overlay with Buy/Sell tabs, the purse in the header, and one row per item — the peddler's stock on Buy, everything in the bag with a trade `value` on Sell (equipped items excluded so you can't sell what you're wearing).
- Settings: modal overlay with a text-speed slider (Slow/Normal/Fast/Instant) and a volume slider, both applied live.
- Battle: canvas showing player/enemy emoji sprites with HP bars, a scrolling battle log, and a menu of actions below (Attack, one button per carried healing consumable, Flee).
- Ending: dedicated screen with closing text (one of thirteen distinct endings) and a restart button.

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

### Phase 3 — RPG Depth (current)
- [x] More enemy variety (Thornback Boar, Deep-Wood Stalker) and a scaling difficulty curve (`enemyScaleForLevel`/`scaledEnemy` in `config.js`, applied in `battle.js`)
- [x] A second equip slot ("charm") with items that trade a bonus in one stat for a penalty in another, alongside the original flat-bonus "trinket" slot
- [x] A brewing mechanic (`brewing.js` + `BREW_RECIPES` in `config.js`) turning material items (Dried Mintleaf, River Root, Thornback Quill, Moonpetal) into brewed consumables and a craftable charm item, gated behind a new `canBrew` story flag Mira sets

### Phase 4 — Polish (complete)
- [x] Replace emoji stand-ins with real portrait/background art (or a distinct painterly CSS treatment) — painterly CSS treatment applied now (no image-generation tool available in this environment); prompts for real art saved to `image_prompts/` for later
- [x] Multiple distinct endings reflecting major branch choices — five endings (`ending_cold`, `ending_humbled_wolf`, `ending_cautious`, `ending_triumphant`, `ending_bested`)
- [x] Settings: text speed slider, volume slider (`settings.js` + `settingsPanel.js`)
- [x] Accessibility pass (keyboard-only navigation through choices)

### Phase 5 — Mobile Pass (complete)
- [x] Layout audit at small viewport widths (~360–414px) and short heights (landscape phones, browser chrome eating vertical space): HUD, VN stage, dialogue box, and choice buttons all reflow via new media queries instead of clipping/overlapping.
- [x] Touch input pass: audited — every interactive element already used `click` handlers (which fire correctly on tap) with no hover-dependent affordances; added a "tap the dimmed backdrop to close" handler to the inventory/brewing/stats panels (settings already had it) as the touch-only equivalent of Escape.
- [x] Tap target sizing: base `button` rule now sets a 44×44px `min-height`/`min-width` (via padding, not shrunk visuals); HUD buttons keep a slightly tighter 40px min-width to stay compact; range sliders get invisible vertical padding so their tappable box also clears ~44px despite a thin visual track.
- [x] Modal usability on small screens: inventory/brewing modals already clamped `max-height`; extended that to `dvh` units and added it to the stats/settings modals too, plus 16px outer padding on every modal backdrop so a box never touches the screen edge.
- [x] Battle canvas scaling: canvas now scales via CSS (`width: 100%; max-width: 640px; aspect-ratio: 640/320`) instead of a fixed pixel size, with a shorter max-width and tighter spacing on short/landscape viewports; battle screen scrolls as a last resort instead of clipping the menu.
- [x] Viewport meta + responsive CSS check: added `viewport-fit=cover` for notch/safe-area support; fixed two more clipping risks found during the audit — the title screen's `h1` (fixed 56px was clipping "Hearthbound" at 390px wide) and the ending screen's `h1`/padding — both now fluid via `clamp()`.
- [x] Manual test pass via Playwright device emulation (`devices['iPhone 13']`, tap-driven) through the opening slice, a battle, and the inventory/settings modals, plus a manual screenshot check of a short landscape viewport (780×360) during battle. New `tests/smoke-mobile.playwright.mjs`.

---

### Phase 6 — The Long Season (complete)

The problem this phase set out to fix: the story was cut short in several
specific places, and its own text kept admitting it. Every one of the five
Phase 4 endings closed on the line *"this is where this slice of your story
ends — for now."* Hollow said *"something in the deep wood is changing what
lives there. I don't know what yet"* and the game never found out. The Cellar
Key was handed over and never used again. Mira was a tutorial with a face. The
"send for the watch" branch — the safe, sensible choice — ended the game in
about six minutes. And the premise ("you inherited an apothecary") was never
actually played: nobody ever walked in and asked for a remedy.

- [x] **The aunt has a story.** Wisteria Ashgrove's sealed workroom opens with the Cellar Key that had no other use; her journal is in it, and the journal is what unlocks the Journal panel, the Burn Salve recipe, and the hearth-stone plot that the last act turns on.
- [x] **The apothecary is a job.** A shop counter with customers who ask for a specific brewed item and pay for it (Tobin's mother's burn, Widow Pell's knees, the carter's girl's cough), coin, a day counter, sleeping, foraging, and a travelling peddler to buy from and sell to.
- [x] **Real hubs.** `shop_hub` / `village_hub` / `whisperwood_gate` plus a hub per character, replacing a one-way corridor with somewhere you come back to between days.
- [x] **Three new neighbours and a fourth on one branch:** Granny Sessily (who remembers what the stone was for), Tobin (whose dog is in the wood, and who follows you into it), Peddler Ock (the economy), and Sergeant Dorne of the county watch.
- [x] **Mira and Bramwell finish their arcs.** Mira's four months of covering the shop's costs out of her own wages, and what she actually wants; Bramwell's Ninebark Nine, the loaf he can't bring himself to bake, and the oven that turns out to be the only other hearth old enough to light the stone from.
- [x] **The wolf is not just a fight.** It can be fought, fed, or waited out; it has a den, and cubs, and a reason; losing has a rematch instead of a shrug.
- [x] **Hollow gets her thirty years.** Apprentice to your aunt for eleven years, blamed by the village for a death in a bad autumn, never defended out loud, and keeping the wood off the village anyway ever since.
- [x] **The watch branch stops being a punishment.** The spears actually arrive, beating the hedgerows pushes something into the village lane, and the wreckage of that is what brings Hollow across a hundred yards of cobbles she hasn't crossed in thirty years. The branch rejoins the main plot with its own scenes rather than dead-ending.
- [x] **The deep wood has a middle.** The Hollow Heart, the cold hearth-stone, and the three things it needs — an ember from a hearth someone still keeps, a boundary rune cut fresh, and a gift the wood gives you rather than one you take. Each has at least one route that no earlier choice can lock out.
- [x] **A climax with three solutions.** The Thorn-Crowned can be fought, quieted with your aunt's last recipe, or spoken to — the last only if you brought somebody and meant what you said at the fire.
- [x] **Eight new endings** (thirteen total) turning on whether the ward got lit, how you met the thing that came for it, and whether anyone was with you — plus a genuine cozy off-ramp (`ending_shopkeeper`) for the player who came for the shop. All five Phase 4 endings stay reachable as deliberate early outs.
- [x] **Length:** the graph went from 47 nodes to 195, and from ~2,200 words of dialogue to ~15,800. A single completionist route reads about 13,500 of them across ~160 choices, which is comfortably over an hour of play at the default text speed before counting battles, brewing, and shop days.
- [x] Test coverage: new `tests/phase6.test.js` (44 cases) and a new browser driver, `tests/smoke-season.playwright.mjs`.

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
| `flagChanged` | flagName, value | state | brewing (watches `canBrew` to reveal its HUD button) |
| `affinityChanged` | npcId, newValue | state | (available for future relationship UI) |
| `xpChanged` | newXp | state | ui |
| `levelUp` | newLevel | state | ui, progression, statsPanel |
| `statsChanged` | stats object | state | ui, statsPanel |
| `hpChanged` | hp, maxHp | state | ui |
| `itemBrewed` | recipeId, resultItemId | state | brewing (re-renders the recipe list) |
| `gameSaved` / `gameLoaded` | — | state | (available for a save-confirmation toast) |
| `settingsChanged` | settings values object | settings | (available for future UI that mirrors current settings elsewhere) |
| `coinChanged` | newCoin | state | ui, trade |
| `dayChanged` | newDay | state | ui |
| `questChanged` | questId, 'active' \| 'done' | state | journal |
| `loreAdded` | loreId | state | journal |
| `openTrade` | — | dialogueEngine (`openTrade` effect) | trade |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Boot sequence, title/game/ending screen switching |
| `config.js` | Constants: starting stats, XP curve, item defs, enemy defs + level-scaling, brew recipes, colors |
| `events.js` | EventBus singleton |
| `state.js` | GameState singleton: stats, inventory, equipment (2 slots), flags, affinity, brewing, save/load |
| `sounds.js` | Web Audio API procedural sound effects |
| `story.js` | Portraits, backgrounds, the Phase 1–4 story spine, and the merge point for the chapter modules below |
| `story/chapter_workroom.js` | Act I expansion: the sealed workroom, the journal, the hearth lamp |
| `story/chapter_shop.js` | The shop hub: the counter's brew-to-order customers, sleeping, and Mira's arc |
| `story/chapter_village.js` | The village hub, the notice board, foraging, Granny Sessily, Tobin, Peddler Ock |
| `story/chapter_bramwell.js` | The baker expanded: the Ninebark Nine, the captain's loaf, the oven's ember |
| `story/chapter_hollow.js` | Tracking the wolf (fight/feed/ward), the den, Hollow's thirty years, the ward reveal |
| `story/chapter_watch.js` | The "called the watch" branch: Sergeant Dorne, the thorn hound, Hollow crossing the cobbles |
| `story/chapter_deepwood.js` | The deep wood as a place: gathering, the three ward components, the Hollow Heart, the long night's companion scenes |
| `story/chapter_longnight.js` | The climax — fight, quiet, or speak to the Thorn-Crowned — plus the "call it a season" off-ramp |
| `story/endings.js` | The eight Phase 6 endings (the five Phase 4 ones stay in `story.js` as early outs) |
| `dialogueEngine.js` | Generic story-graph traversal: condition checks, effect application, node transitions |
| `vnRenderer.js` | DOM rendering of the VN screen: background, portrait, typewriter text, choices |
| `inventory.js` | Inventory panel DOM rendering + equip/unequip (slot-aware) |
| `progression.js` | Level-up feedback (sound + toast); XP math itself lives in state.js |
| `battle.js` | Canvas-rendered light turn-based battle system; scales enemies to player level, lists all carried healing consumables |
| `ui.js` | Persistent HUD chrome: level/HP/XP readout, save, mute |
| `statsPanel.js` | Stat-point spending UI: HUD badge + modal, wired to `state.spendStatPoint()` |
| `brewing.js` | Brewing panel: HUD button (gated by the `canBrew` flag) + modal listing `BREW_RECIPES`, wired to `state.brew()` |
| `settings.js` | User preferences (text speed, volume), persisted separately from the save file; applies volume to `sounds.js` immediately |
| `settingsPanel.js` | Settings modal: text speed + volume sliders, wired live to `settings.js` |
| `journal.js` | Journal panel: quests + lore, gated behind the `hasJournal` flag |
| `trade.js` | Peddler Ock's cart: buy/sell against `TRADE_STOCK` and item `value`, gated behind the `tradeOpen` flag |

---

## Open Questions

- [x] Should losing a battle ever be a real setback rather than just a different flavor branch? — Phase 6 answer: a *setback*, not a punishment. Losing the cellar slime costs you the key until you go back down for it; losing the hedge wolf leaves the problem unsolved and offers a rematch; losing at the hearth-stone changes which ending you get rather than ending the run. Nothing is ever confiscated, because a cozy game that eats an hour of your inventory is not cozy.
- [x] How many distinct NPCs/chapters before the "cozy but not shallow" balance feels right? — Phase 6 answer: seven named characters (Mira, Bramwell, Hollow, Sessily, Tobin, Ock, Dorne) plus a dog, across six chapters. Three of them (Mira, Bramwell, Hollow) can come with you to the last scene, which is what the affinity system was always for.
- [x] Should the stat-point spend UI live in the HUD, the inventory panel, or its own screen? — Settled in Phase 2 and unchanged since: a HUD badge that only appears when points are unspent, opening its own modal.
- [ ] Days are currently free — nothing bad happens if you take twenty of them foraging. Should the season have a soft deadline (the wood getting measurably worse each week) or does that stop it being cozy?
- [ ] Only three of the seven characters can be brought to the hearth-stone. Should Sessily, Tobin, Ock and Dorne get companion scenes too, or does that dilute the ones that exist?
- [ ] The Journal is read-only. Should the player be able to *write* in it — a New Game+ where next spring's walk starts from the notes you left?

---

## Changelog

### Phase 6 — The Long Season (2026-09-02)
- **Story graph quadrupled**: 47 nodes → 195, ~2,200 words of dialogue → ~15,800, split out of one file into `js/story/*.js` chapter modules merged into `STORY` by `story.js` (which keeps the Phase 1–4 spine, `PORTRAITS` and `BACKGROUNDS`). A completionist route now reads ~13,500 words over ~160 choices.
- **The aunt's workroom**: the Cellar Key — handed over in Phase 1 and then never used for anything — now opens the room Wisteria locked the week she got ill, containing her journal, the brass hearth lamp, her worry stone, and the diagram the whole last act turns on.
- **The apothecary is finally a job**: a shop counter with three brew-to-order customers, coin (`state.coin`), a day counter (`state.day`) advanced by sleeping and foraging, two forage sites, and Peddler Ock's cart (`trade.js`) to buy materials from and sell brewed goods to.
- **New modules**: `journal.js` (quests + collected lore, gated behind finding the journal) and `trade.js` (buy/sell, gated behind standing at the cart). New HUD chips for day and coin.
- **Hubs**: `shop_hub`, `village_hub`, `whisperwood_gate` and a hub per character, replacing the one-way corridor the story used to be.
- **Four new characters**: Granny Sessily (who remembers what the hearth-stone was for, and what your aunt said in the spring), Tobin (whose dog went into the wood, and who follows you in after it), Peddler Ock, and — on the watch branch — Sergeant Dorne of the county watch.
- **Mira and Bramwell finished**: Mira's ledger with four months of her own wages in it and what she actually wants out of the nine years she's given this shop; Bramwell's Ninebark Nine, Ivar Bell's loaf, and the oven that turns out to be the only other hearth in the valley old enough to light the stone from.
- **The hedge wolf is a situation, not a fight**: tracked, then fought *or* fed *or* out-waited, with a den and cubs behind it that recontextualise whichever you chose; losing offers a rematch.
- **Hollow's thirty years**: apprentice to your aunt for eleven of them, blamed by the village for a death in a bad autumn, never defended out loud, and keeping the wood off the village on her own ever since.
- **The watch branch stops being a punishment**: choosing the "safer" option used to foreclose Hollow's questline and point straight at an ending six minutes later. The spears now actually arrive, beating the hedgerows drives a Thorn Hound into the village lane, and that is what finally walks Hollow across a hundred yards of cobbles she hasn't crossed in thirty years. The branch rejoins the main plot with scenes of its own.
- **The deep wood has a middle**: the Hollow Heart and its cold hearth-stone, and the three things it needs — an ember from a kept hearth (the shop stove or Bramwell's oven), a boundary rune cut fresh (Hollow, your own trained hand, or a bad night with the journal and a root knife), and a gift the wood gives you rather than one you take (the wolfmother, the stalker, the dog, or simply waiting). Every component has a route no earlier choice can lock out.
- **The long night**: the ward is lit and then you sit up with it, in one of four companion scenes (Hollow, Bramwell, Mira, or alone) — and then the Thorn-Crowned arrives, and can be fought, quieted with your aunt's last recipe, or spoken to.
- **Eight new endings** (thirteen total), turning on whether the ward got lit, how you met the thing that came for it, and whether anybody was with you — plus `ending_shopkeeper`, a genuine cozy off-ramp for a player who came for the shop and not the wood. All five Phase 4 endings remain reachable as deliberate early outs, so nothing that used to be an ending stopped being one.
- **New content**: 7 new items → 31, 3 new recipes → 7 (with flag-gated recipe knowledge so the brewing list grows over the season), 3 new enemies → 7, 12 quests, 8 lore entries, 7 new backgrounds and 11 new portrait entries.
- **Engine**: `requires` gained `allFlags`/`anyFlags`/`noneFlags`/`minStat`/`minCoin`/`minDay`/`questActive`/`questDone`/`notItem`/`visited`; effects gained `giveCoin`/`takeCoin`/`advanceDay`/`rest`/`healFull`/`heal`/`startQuest`/`completeQuest`/`addLore`/`learnRecipe`/`openTrade`.
- **Bug fixed while wiring the hubs**: losing the cellar slime left the player permanently without the Cellar Key, which (once Phase 6 hung the workroom, the journal and the hearth lamp off it) would have silently locked out the entire last act. There is now a rematch and a standing route back down from the shop, with a unit test for it.
- **Tests**: new `tests/phase6.test.js` (44 cases) — coin/days/quests/lore, recipe gating, trade pricing, the new gate vocabulary, and graph invariants (no orphans, no dead ends, all thirteen endings reachable and terminal, no hub granting items on entry, every referenced quest/lore/recipe id defined, the lock-out invariants). New `tests/smoke-season.playwright.mjs` drives the workroom, journal, counter orders, brewing, sleeping and trading in a real browser. Existing Playwright drivers gained a `PW_CHROMIUM_PATH` override and stub the favicon 404 that a bare static server produces.

### Phase 5 — Mobile Pass (2026-08-29)
- Narrow-viewport media queries (`max-width: 480px` and `max-height: 480px`) reflow the HUD (wraps onto extra rows instead of squeezing), shrink the VN portrait medallion and dialogue box padding, and tighten battle-screen spacing so short/landscape viewports don't need to scroll.
- Every `button` now has a 44×44px minimum touch target via padding (WCAG/Apple/Material guidance), and settings' range sliders get invisible vertical padding so their tappable box clears the same minimum despite a thin visual track.
- Tapping a modal's dimmed backdrop now closes it on the inventory, brewing, and stats panels (matching the pattern `settingsPanel.js` already had) — the touch-only equivalent of pressing Escape, since there's no on-screen key for that.
- Battle canvas (`battle.js` still draws at a fixed 640×320 internal resolution) now scales down via CSS `width/max-width/aspect-ratio` instead of rendering at a fixed pixel size, so it fits phone-width and short-landscape viewports without clipping.
- Fixed two pre-existing clipping bugs found during the mobile audit: the title screen's `h1` was a fixed 56px and clipped "Hearthbound" at ~390px wide; the ending screen's `h1`/outer padding had the same risk. Both are now fluid via `clamp()`.
- Added `viewport-fit=cover` to the viewport meta tag plus `env(safe-area-inset-*)` padding on the HUD and battle screen, `touch-action: manipulation` + `overscroll-behavior: none` on `html, body` to stop double-tap-zoom and pull-to-refresh from fighting rapid taps through dialogue.
- New `tests/smoke-mobile.playwright.mjs`: drives the real page under Playwright's `devices['iPhone 13']` emulation using `.tap()`, and asserts no horizontal overflow, every button/slider meets the touch-target minimum, the battle canvas fits the viewport, and backdrop-tap-to-close works.

### Phase 4 — Polish (2026-08-29)
- Five distinct endings (`ending_cold`, `ending_humbled_wolf`, `ending_cautious`, `ending_triumphant`, `ending_bested`) replace the single shared `end_preview` node; a new `lostToHedgeWolf` flag and a new choice on `hollow_thanks` make the hedge-wolf-loss ending reachable without forcing every playthrough into the deep wood.
- New `settings.js` module (preferences persisted separately from the save file, under their own localStorage key) and `settingsPanel.js` (HUD-accessible modal): a text-speed slider (Slow/Normal/Fast/Instant, applied live to `vnRenderer.js`'s typewriter) and a volume slider (applied live via new `sounds.js` exports `setVolume()`/`getVolume()`).
- Accessibility pass: choice buttons auto-focus on render, Arrow Up/Down move focus between them, Enter/Space activate the focused choice without double-firing the global advance handler, every modal (inventory/brewing/stats/settings) closes on Escape and hands focus back via a new shared `restoreStageFocus()` in `vnRenderer.js` rather than stranding it on a HUD button, and a visible `:focus-visible` ring was added.
- Painterly CSS treatment in place of real art, since no image-generation tool is available in this environment: richer multi-stop gradients for every background in `story.js`, a vignette overlay on the VN stage, and a framed glow around portraits.
- New `image_prompts/` directory: one Nano-Banana-2-ready prompt file per portrait and background plus a README with wiring instructions, so real art can be generated and dropped in later.
- Test coverage: new `tests/settings.test.js`, new "Phase 4 endings" cases in `tests/story.test.js`, and extended Playwright smoke coverage (`tests/smoke.playwright.mjs` now also drives the settings modal and keyboard-only choice navigation; new `tests/smoke-ending.playwright.mjs` plays the full "called the watch" branch to its distinct ending in a real browser).

### Phase 3 — RPG Depth (2026-08-29)
- Enemy scaling: `enemyScaleForLevel(level)` / `scaledEnemy(enemyId, level)` in `config.js` scale an enemy's hp/strength/xp multiplicatively based on the player's current level; `battle.js` calls `scaledEnemy` instead of reading `ENEMY_DEFS` directly, and strength scaling is clamped so it never drops below the base value.
- Two new enemies: Thornback Boar and Deep-Wood Stalker (the latter not fleeable), reached via a new deep-Whisperwood chapter.
- Second equip slot ("charm") alongside the original "trinket" slot — `state.effectiveStats` now applies both a `bonus` and a `penalty` object per equipped item; three new charm items (Thornback Bracer, Moonpetal Locket, Baker's Locket) each trade a bonus in one stat for a penalty in another. `inventory.js` reads each item's own `slot` instead of hardcoding `'trinket'`.
- Brewing mechanic: `state.brew()` / `state.canBrew()` consume `BREW_RECIPES` material requirements (config.js) to produce a result item; new `brewing.js` module renders a HUD-gated panel (button hidden until the `canBrew` story flag is set). Emits a new `itemBrewed` event.
- New material items (River Root, Thornback Quill, Moonpetal) and brewed items (Vigor Draught, Steady-Hand Tea, Moonpetal Locket); Steady-Hand Tea's `guaranteedFlee` flag makes the next flee attempt in battle always succeed.
- `battle.js` no longer hardcodes Honey Tonic — it lists every carried consumable with a `heal` value as its own menu button, and rebuilds the menu after each player turn so consumed items disappear.
- New story content: Mira teaches brewing (`mira_teaches_brewing`) after the cellar resolution, granting starter materials; a new deep-Whisperwood chapter (`deep_wood_edge` → Thornback Boar fight → Deep-Wood Stalker encounter) reachable from both the warm and cold Hollow branches.
- Added a Node.js test suite (`tests/*.test.js`, run via `npm test` / `node --test tests/*.test.js`) covering enemy scaling, equip slot stacking, brewing, save/load, dialogue-engine condition/effect logic, and story-graph integrity (every node reference resolves, every battle node has both outcomes, the full graph is reachable from `start`). Also added a manual Playwright smoke driver (`tests/smoke.playwright.mjs`, not part of the automated suite) that boots the real page and clicks through the opening slice into the new brewing UI.

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

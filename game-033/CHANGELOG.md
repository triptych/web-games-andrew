# Changelog — Hearthbound

## Phase 6 — The Long Season (2026-09-02)
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

## Phase 5 — Mobile Pass (2026-08-29)

- Narrow-viewport (`max-width: 480px`) and short-viewport (`max-height: 480px`) media queries reflow the HUD, VN stage, and battle screen instead of clipping/overlapping — the HUD wraps its action buttons onto their own row rather than squeezing, the portrait medallion and dialogue padding shrink, and battle spacing tightens so a rotated phone doesn't need to scroll.
- Every `button` now guarantees a 44×44px minimum touch target via padding (base rule, applies everywhere); range sliders get extra vertical padding so their tappable box clears the same minimum despite a visually thin track.
- Tapping a modal's dimmed backdrop closes it, extended from `settingsPanel.js` to the inventory, brewing, and stats panels too — the touch-only equivalent of Escape.
- Battle canvas switched from a fixed 640×320 pixel size to CSS scaling (`width: 100%; max-width: 640px; aspect-ratio: 640/320`), so it fits phone-width and short-landscape viewports; `battle.js`'s drawing code is untouched since it still draws in the same internal coordinate space.
- Fixed two clipping bugs surfaced by the audit: the title screen's `h1` (fixed 56px) clipped "Hearthbound" at ~390px wide; the ending screen's `h1` had the same risk. Both now use `clamp()` for fluid sizing.
- Added `viewport-fit=cover` + `env(safe-area-inset-*)` padding for notches/gesture bars, and `touch-action: manipulation` + `overscroll-behavior: none` to stop double-tap-zoom and pull-to-refresh from fighting rapid taps.
- New `tests/smoke-mobile.playwright.mjs`: drives the real page under Playwright's `devices['iPhone 13']` emulation with `.tap()`, checking for horizontal overflow, touch-target sizing, canvas scaling, and backdrop-tap-to-close.

## Phase 4 — Polish (2026-08-29)

- Five distinct endings replacing the single shared `end_preview` node, branching on how the Bramwell/Hollow choice and the deep-wood encounters played out: `ending_cold` (called the watch, Hollow's questline foreclosed), `ending_humbled_wolf` (lost the Hedge Wolf fight and called it a season), `ending_cautious` (backed away from the Deep-Wood Stalker), `ending_triumphant` (beat the Deep-Wood Stalker), `ending_bested` (lost to the Deep-Wood Stalker but made it home). New `lostToHedgeWolf` flag and a new `hollow_thanks` choice make the wolf-loss ending reachable.
- New `settings.js` (persisted separately from the save file under its own localStorage key) + `settingsPanel.js`: a HUD-accessible Settings modal with a text-speed slider (Slow/Normal/Fast/Instant) driving `vnRenderer.js`'s typewriter delay live, and a volume slider driving `sounds.js`'s new `setVolume()`/`getVolume()`.
- Accessibility pass: choice buttons auto-focus when they render, arrow keys move focus between them, Enter/Space activate the focused choice without double-firing against the global advance handler, closing any modal (inventory/brewing/stats/settings) now calls a shared `restoreStageFocus()` in `vnRenderer.js` that returns focus to the current choice button (or the dialogue textbox) instead of stranding it on a HUD button, Escape closes every modal, and a visible `:focus-visible` ring was added for keyboard users.
- Painterly CSS treatment in place of real art (no image-generation tool is available in this environment): richer multi-stop gradients for every `BACKGROUNDS` entry in `story.js`, a vignette overlay on the VN stage, and a framed/glowing medallion treatment around portraits.
- New `image_prompts/` directory: one ready-to-paste Nano Banana 2 image-generation prompt per portrait (9) and background (7), plus a README with wiring instructions, so real art can be generated and dropped in later without re-deriving context.
- Extended the Playwright smoke coverage: `tests/smoke.playwright.mjs` now also exercises the settings modal and keyboard-only choice navigation (auto-focus, arrow-key roving focus, Enter-to-activate, focus restoration after closing a modal); new `tests/smoke-ending.playwright.mjs` drives the full "called the watch" branch to its distinct ending in a real browser. Added `tests/settings.test.js` and new `Phase 4 endings` cases in `tests/story.test.js`.

## Phase 3 — RPG Depth (2026-08-29)

- Enemy scaling (`enemyScaleForLevel` / `scaledEnemy` in `config.js`) so battle stats grow with the player's level; two new enemies (Thornback Boar, Deep-Wood Stalker) in a new deep-Whisperwood story chapter.
- A second "charm" equip slot alongside the original "trinket" slot, with trade-off items (bonus in one stat, penalty in another): Thornback Bracer, Moonpetal Locket, Baker's Locket.
- A brewing mechanic (`brewing.js` + `BREW_RECIPES`): material items (River Root, Thornback Quill, Moonpetal, Dried Mintleaf) combine into brewed consumables and a craftable charm item, gated behind a `canBrew` flag Mira sets in a new dialogue scene.
- `battle.js` generalized to offer every carried healing consumable (not just Honey Tonic) as its own battle-menu action.
- New Node.js test suite under `tests/` (`npm test`) plus a manual Playwright smoke script (`tests/smoke.playwright.mjs`).

## Phase 2 — More Story (2026-08-29)

- Added `village_square` hub node plus two new NPC chapters: Bramwell the baker and Hollow the forest witch.
- Real consequence branch: choosing to send for the watch forecloses Hollow's questline.
- Hedge Wolf battle reachable only via Hollow's questline.
- Stat-point spending UI (`statsPanel.js`).

## Phase 1 — Scaffold (2026-08-28)

- Initial scaffold of a hand-built custom engine (no Kaplay/Phaser/three.js): DOM+CSS visual novel layer, `<canvas>` for the light battle layer.
- Core modules: `config.js`, `events.js` (EventBus), `state.js` (GameState singleton with save/load), `sounds.js` (Web Audio procedural SFX).
- `dialogueEngine.js` + `story.js`: data-driven branching dialogue with condition-gated choices (flags, item possession, NPC affinity) and effects (set flag, change affinity, give item, give XP, start battle).
- `vnRenderer.js`: DOM rendering of backgrounds, portraits, typewriter dialogue text, and choice buttons.
- `inventory.js`: inventory panel with equip/unequip for a single trinket slot.
- `progression.js`: level-up toast + sound feedback (XP/leveling math lives in `state.js`).
- `battle.js`: canvas-rendered light turn-based battle (Attack / Use Item / Flee) resolving in a few turns, branching the story on win/loss.
- `ui.js`: persistent HUD (level, HP bar, XP bar, bag/save/mute buttons).
- Opening story slice: shop intro → Mira's request → optional herb-garden aside (affinity-gated) → cellar → slime battle → resolution → ending screen.
- Registered in the root launcher (`js/gamedata.js`) as `game-033`.

# Changelog — Hearthbound

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

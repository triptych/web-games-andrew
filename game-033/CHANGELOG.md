# Changelog — Hearthbound

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

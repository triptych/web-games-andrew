# Game 009 — Chronicles of the Ember Crown: Changelog

## v0.3.0 — 2026-02-22

### Changed
- **Party sprite layout** — switched from single column to 2-column grid; warrior and rogue moved to front row, mage and healer to back row
- **Sprite sizing** — front row heroes rendered at h=130, back row at h=105 to convey depth; group vertically centered in the battlefield
- Per-hero height now defined per-class in `HERO_DEFS` (replacing the single `HERO_H` constant) in `battleRenderer.js`
- `BATTLE.PARTY_X/Y` in `config.js` updated to reflect 2-column positions

---

## v0.2.0 — 2026-02-22

### Added
- **Enemy sprite images** — 7 monster PNGs added to `img/` (goblin, skeleton, orc, dark elf, stone golem, dragon, lich king)
- **Enemy sprite rendering** — enemies now render as sprite images with additive blend (matching hero sprite technique); aspect ratios preserved per-enemy via `ENEMY_RATIOS` table; HP bar width tracks actual sprite width
- **Enemy type propagation** — `type` key (e.g. `'goblin'`) now stored on each enemy combatant object so the renderer can look up the correct sprite and ratio

### Changed
- Enemy combatants previously displayed as colored rectangles with a letter initial; replaced with full sprite images

---

## v0.1.0 — 2026-02-22

### Added
- **Phase 1 scaffold** — index.html, js/main.js, js/config.js, js/events.js, js/state.js, js/sounds.js, js/ui.js, game-plan.md
- **Party system** — four classes (Warrior, Mage, Healer, Rogue) with full stat definitions, level-up growth tables, and starting ability lists
- **Ability definitions** — 11 abilities across 4 classes: Attack, Power Slash, War Cry, Fireball, Blizzard, Magic Missile, Cure, Cure All, Protect, Double Strike, Steal, Smoke Screen
- **Enemy definitions** — 7 enemy types (Goblin, Skeleton, Orc, Dark Elf, Stone Golem, Dragon, Lich King) with full stat blocks, XP, and gold values; Dragon and Lich King flagged as bosses
- **Encounter list** — 12 curated battles across 5 regions (Forest Path → Old Ruins → Mountain Pass → Shadow Vale → Ancient Fortress → Dragon's Peak → Throne of Ash)
- **Economy** — shop items (Potion, Hi-Potion, Ether, Revive, Antidote) with costs; starting gold 120; XP table for 10 levels
- **State singleton** — GameState with party management, XP/level-up logic (stat growth randomised per class growth table), gold, inventory, and lives
- **EventBus** — full RPG event catalog: battleStart, battleEnd, turnStart, actionChosen, animateAction, combatantDied, levelUp, statusApplied, showMessage
- **Sound stubs** — 20+ procedural Web Audio API sounds: menu navigation, physical/magic/heal actions, enemy attacks, damage, victory fanfare, level-up, game over
- **UI scaffold** — top bar (score/gold), 4-member status panel with HP/MP bars (color-coded: green/yellow/red), status text (KO/PSN), victory/defeat overlay screens
- **Kaplay scenes** — splash (blinking prompt, any-key-to-start) and game (placeholder, ESC/R/P wired)
- **Launcher entry** — added to js/gamedata.js

### Fixed
- Status panel border entity was created with `k.opacity(0)` which hides the outline entirely; changed to opaque panel fill so `k.outline()` renders correctly

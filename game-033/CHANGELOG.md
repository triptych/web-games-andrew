# Changelog — Hearthbound

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

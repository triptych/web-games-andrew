# Coppergate Lane — Game Plan

A cozy-fantasy RPG-Maker-style adventure set in Trina's world. Vanilla
HTML/CSS/JS, no framework, no build step. Canvas 2D tile overworld + DOM
overlays for all menus and battle.

## Concept
You're the handy new arrival in Coppergate Lane. Help the townsfolk,
explore the Whistling Wilds and Gutter Gully, fight clockwork critters in
turn-based battles, and recover the Mayor's stolen Golden Gear from the
brute known as Big Bertha.

## Core loop
Explore overworld → talk to NPCs / pick up quests → wander into random
encounters → turn-based battle → earn EXP/gold/loot → spend at the shop →
grow stronger → clear the boss.

## Systems (all implemented)
- **Overworld**: tile renderer, grid movement, warps between 3 maps,
  chests, interactable objects, per-map random-encounter tables.
- **Turn-based battle**: Attack / Skill / Item / Flee. Multiple enemies,
  targeting (keyboard + click), floating damage, HP bars, AoE + heal
  skills (SP-costed), soft-fail on death (revive in town at half HP).
- **Inventory**: consumables (heal HP/SP), weapons (equip for +ATK),
  materials, key items. Use/equip from menu or in battle.
- **Shop**: buy from fixed stock, sell anything but key items at half
  price. Two-column buy/sell UI.
- **Quests**: main quest (Golden Gear) + 2 side quests (Mabel's kettle,
  Trina's scraps). Quest log, auto-complete checks, rewards.
- **NPCs**: 4 fleshed-out characters with branching dialogue that reacts
  to story flags and inventory (Trina, Mabel, Mayor Pilcrow, Bertram).
- **Leveling**: EXP → level up, scaling HP/SP/ATK/DEF.
- **Audio**: fully procedural Web Audio SFX (no asset files).

## Controls
- Arrows / WASD — move
- Enter / Space / X — interact / confirm / advance dialogue
- M — menu · I — inventory · Q — quest log
- Esc / Z — back / cancel
- In battle: ◀ ▶ choose action, Enter confirm, click enemies to target

## Story beats
1. Meet Trina → she gives the Golden Gear main quest + scraps side quest.
2. Explore Whistling Wilds (random battles, a chest).
3. Descend to Gutter Gully → find Mabel's kettle, more battles, a chest.
4. Golden Gear is held by Big Bertha's lair (locked until you've spoken
   to the Mayor about it — currently the gear drops from Bertha herself).
5. Return gear to Mayor Pilcrow → unlocks the Bertha boss fight.
6. Defeat Big Bertha → town saved.

## File overview
- `index.html` — shell + all DOM panels
- `css/style.css` — cozy copper/parchment theme
- `js/data.js` — items, enemies, abilities, quests, NPCs, shop stock (all content)
- `js/maps.js` — the 3 tile maps + placements
- `js/state.js` — GameState singleton (party, gold, inventory, quests, flags)
- `js/events.js` — EventBus pub/sub
- `js/sounds.js` — procedural Web Audio SFX
- `js/world.js` — tile renderer + overworld logic
- `js/battle.js` — turn-based combat
- `js/ui.js` — dialogue, menu, inventory, quest log, shop controllers
- `js/main.js` — mode router + game loop

## TODO / expand later
- Party members beyond the solo hero (state.hero → state.party[])
- Status effects (poison, stun) in battle
- Save/load via localStorage
- More maps, an inn to rest, day/night
- Enemy-specific AI (currently all just attack)
- Tie Bertha lair unlock to `berthaUnlocked` flag consistently (Mayor
  sets it; the gear currently comes from Bertha, so tweak sequence to taste)

## Run
Serve over http (ES modules need it), not file://:
`npx serve .`  or VS Code Live Server. Drop into web-games-andrew as
`game-010` and add a launcher entry in `js/gamedata.js`.

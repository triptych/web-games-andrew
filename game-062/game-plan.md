# Rotten to the Core

**Genre:** Action RPG / dungeon crawler (a light, silly Diablo)
**Engine:** three.js r165 (ES modules via an import map), no asset files
**Target Resolution:** any; desktop mouse + keyboard, or touch
**Status:** v1.0.1 — complete

---

## Concept

Something rotten has crawled up from under Tristrawberry. Grow a fruit hero, take a butter knife down the cellar stairs and squash your way through twelve procedurally generated levels to Durian the Diabolical, the stinkiest thing in the Great Orchard.

It's Diablo's loop (town → dungeon → loot → town) with the tone turned to silly: monsters are rotten fruit and their pests, loot is kitchenware with affixes, health is *Freshness*, mana is *Juice*, gold is *Sugar*, town portals are pies, and everything that dies bursts into juice that stays on the floor.

---

## Core Mechanics

### 1. Click to move, click to squash
Left-click the ground to walk (hold to keep walking toward the cursor), click a monster to keep attacking it until it pops, Shift+click to attack in place. WASD also walks. Right-click and 1–4 cast skills at the cursor. Monsters, townsfolk, objects and loot are picked in screen space (closest projected entity within a radius), so small targets are easy to hit.

### 2. Three classes, eighteen skills
Every skill scales from the equipped weapon's damage (as in Diablo III), times the skill's multiplier, times (1 + main stat / 100). One skill point per level, ranks up to 20, any learned skill can be bound to any of the six buttons.

| Class | Main stat | Skills |
|---|---|---|
| **Melon Knight** | Crunch | Slice, Rind Bash (stun + knockback), Big Slice (wide arc), Juice Up! (buff + heal), Pit Leap, Blender (whirlwind) |
| **Seed Ranger** | Zip | Seed Shot (pierces), Pomegranate Pop (fire AoE), Pip Spray (fan), Somersault (dodge roll), Peel Trap (slip stun), Raisin Rain |
| **Citromancer** | Zest | Zest Bolt (homing), Caramelize (fireball + burn), Brain Freeze (frost nova), Chain Lime-ning, Peel-port (teleport), Melon Meteor |

Attributes: **Crunch** (melee damage, armour), **Zip** (ranged damage, crits, dodge), **Zest** (spell damage, Juice), **Pulp** (Freshness). Five points per level.

### 3. Loot
Common, **Juicy** (magic, 1–2 affixes), **Ripe** (rare, 3–6 affixes and a random name) and **Golden** (14 uniques with fixed powers, e.g. *The Big Squeeze*, *Grandma's Rolling Pin*, *Melon Collie*, *Fresh Prince of Bel-Pear*). Nine equipment slots, a 40-slot backpack and a 60-slot stash. Bases are kitchenware in tiers (Butter Knife → Bread Knife → Santoku → Obsidian Peeler; Pot Lid → Wok → Cauldron Lid). Ripe and Golden items drop unidentified; Deckard Cane identifies them for free. Weapons and offhands are class-restricted; drops lean 65% toward your class.

### 4. Procedural levels
Three acts × four levels. One generator, three looks (`js/sim/dungeon.js`):
- **The Root Cellar** — rectangular rooms, 2-wide corridors, pillar halls.
- **The Jam Catacombs** — rounded rooms, wider halls, sticky jam pools that halve your speed.
- **The Rotten Core** — blobby caves along wandering tunnels, lakes of boiling fruit punch (impassable, but flyers cross them).

Rooms are connected by an MST plus ~25% extra loops, the entrance is the room farthest from the boss arena, stairs go in the room farthest by BFS, every floor is flood-filled and regenerated on failure, and solid objects that would seal off floor are removed. Breakables (crates, jam jars, cider barrels, exploding soda kegs), picnic-basket chests, Smoothie Shrines, monster packs (champions and named uniques with affixes), corridor stragglers, mimics and quest objects are placed per floor. Boss floors put the boss in an 18×16 arena at the far end; its stairs open when it dies.

### 5. Monsters
Fourteen types with their own brains (`js/sim/ai.js`): Moldy Grapes (zombies with arms out), Fruit Flies (swarm), Banana Peeltons (bony peels) and Peelton Pitchers (boomerang peels), Apple Worms in bowler hats (burrow and pop up), Eggplant Shamans (heal and **revive** their friends), Rotten Tomatoes (run in and burst), Sour Lemons (acid puddles), Prickly Pears (needle turrets), Coconut Crabs (armoured, charge), Jack o' Lanterns (fireballs, blink away), Chili Imps (explode on death), Durian Brutes (stink clouds, ground slams), Pie Mimics. Elite affixes: Extra Juicy, Speedy, Spicy, Frosty, Stinky, Bouncy, Thorny, Sticky. Every hit has a windup; big attacks are telegraphed as red circles on the floor.

**Bosses:** *The Juicer* ("Ahh… FRESH FRUIT!") charges and sprays juice, enrages and calls grapes at half health. *Mangophisto, Lord of Chutney* floats, lobs chutney, rains telegraphed fire and summons Chili Imps in three phases. *Durian the Diabolical* slams, sprays spikes, fills the arena with stink, and fires a huge stink nova you have to walk out of.

### 6. Town and quests
Tristrawberry has **Deckard Cane** (a candy cane; identifies items; "Stay a while and glisten!"), **Granny Smith** (heals, sells potions), **Grapeswold** (blacksmith), **Olivia** (oracle; magic goods, pies), **Kiwirt** (a kiwi on a toothpick leg; mystery-smoothie gambling), the stash, and the **Wishing Well** waypoint. Six quests: *Ahh, Fresh Fruit!*, *Granny's Lost Recipe*, *The Anvil of Furry*, *Kiwirt's Leg*, *The Chutney Lord*, *Rotten to the Core*. Beating Durian unlocks **Overripe** and then **Rotten** difficulty (+16 / +32 monster levels, better loot).

---

## Game Loop

Create a hero → town (talk, shop, quests) → cellar → explore, squash, loot, break things → Portal Pie home to sell and identify → Wishing Well back down → boss → next act → Durian → victory → next difficulty. Dying sends you to town minus 10% of carried sugar; the level you died on is rebuilt fresh.

---

## Player Controls

| Action | Mouse / keys | Touch |
|---|---|---|
| Walk | Left-click ground (hold), WASD | Stick (left) or tap the ground |
| Attack | Left-click a monster; Shift+click in place | Tap a monster; ⚔️ attacks the nearest |
| Skills | Right-click, 1–4 (at the cursor) | Round buttons (auto-aim) |
| Potions / pie | Q jam, E juice, R Portal Pie | 🍓 🍊 🥧 buttons |
| Panels | C character, I backpack, K skills, J quests, Tab map, Esc menu, Space close | 🧑‍🌾 🎒 ✨ 📜 🗺️ ☰ |
| Loot labels | Always on, or hold Alt | Always on |
| Zoom / mute | Mouse wheel / M | — |

---

## Progression / Difficulty

Monster level on Fresh is `1 + round((floor − 1) × 1.75)` (1 → 20), plus difficulty offset, +1 champions, +2 uniques and bosses. HP and damage scale by `hpScale` / `dmgScale` in `data/monsters.js`; XP to the next level is `70 × L^1.62 + 30 × L`. The bot (below) reaches level ~23–28 when it kills Durian on Fresh.

---

## Rendering

- **Fruit characters** are lathe profiles with procedural skins (dimpled citrus, seeded strawberries, striped melons, diamond pineapples, fuzzy kiwis with sheen, mouldy rotten variants), clearcoat or sheen physical materials, sphere eyes with highlights and blinking, mouths, blush, brows, twelve hats, Rayman-style floating gloves and shoes, and kitchenware weapons. Animation is procedural: squash on hit, bounce and alternating feet when walking, wind-up-and-slash swings, casting poses, spin, stun wobble, and a pop on death.
- **Levels** are one merged floor mesh with per-vertex ambient occlusion and bump-mapped procedural flagstones, instanced walls with dark tops that are cut away in the vertex shader when they stand between the camera and the hero, pillars, glossy jam, a shader for boiling fruit punch with banks, torches, glowing mushrooms, sugar crystals, cobwebs and apple cores.
- **Fog of war** is a per-tile texture eased every frame and sampled by every level material; remembered tiles fall back to a cool desaturated memory.
- **Lighting:** the hero carries a warm light, a key light with soft shadows follows the hero, and a pool of eight point lights is reassigned to the nearest torches, glows and explosion flashes.
- **Effects:** lit instanced juice droplets that bounce and leave splat decals in the monster's juice colour, additive glows, smoke puffs, slash arcs, rings and telegraphs, frost novas with ice shards, chain lightning, a watermelon meteor, raisin rain, stink clouds and ground fire.
- **Post:** bloom, a colour grade per act, vignette, a low-Freshness pulse and death desaturation. Quality tiers (pixel ratio, shadows, bloom, particle budget) start lower on touch devices and drop automatically on slow frames.
- **Town:** grass and cobbles, gabled houses with glowing windows and signs, hedges, apple trees, lamp posts, flower beds, a market stall, the well and the cellar door; houses fade when they stand in front of you.

---

## Sound Design

All Web Audio, no files (`js/audio.js`). A generative score per area: a lute waltz for town, drones and drips for the cellar, sneaky pizzicato for the jam, toms and dark pads for the core, a driving boss track and a victory fanfare. Effects for squishes, splats, swings, seeds, fire, freezes, zaps, meteors, booms, chests, crates, glass, sugar, pickups, Golden drops, gulps, level-ups, portals, roars and a sad-trombone death. Townsfolk "talk" in Animal-Crossing-style gibberish pitched per character. `../lib/page-audio.js` silences a hidden tab.

---

## Module Overview

| File | Responsibility |
|---|---|
| `js/main.js` | Boot, mode machine (title → creator → play ⇄ panels → dead → victory), fixed-step loop with hit-stop, input → world actions, events → audio/HUD, autosave, debug hooks |
| `js/config.js` | Constants, difficulties, rarities |
| `js/rng.js` | Seeded RNG and hashing |
| `js/sim/` | The pure simulation: no three.js, no DOM, no `Math.random` (checked by `dev/simtest.mjs`) |
| `js/sim/data/` | Classes and skills, monsters, item bases/affixes/uniques, acts, townsfolk, quests, text |
| `js/sim/dungeon.js`, `town.js` | Level generator; the town layout |
| `js/sim/world.js` | One floor at runtime: actors, collision, combat, objects, loot, projectiles, events |
| `js/sim/skills.js`, `ai.js` | Hero skills and ground effects; monster and boss brains |
| `js/sim/hero.js`, `items.js` | Stats, levelling, backpack; item generation, drops, shops |
| `js/sim/game.js` | Floors, transitions, portals, waypoints, quests, shops, gambling, difficulty, save data |
| `js/sim/path.js`, `fov.js`, `tiles.js` | A*, flow field, exact grid line of sight; field of view; tile codes |
| `js/sim/bot.js` | A bot that plays the real game API to the ending |
| `js/view/` | Renderer and post, level, actors and fruit kit, effects, loot, fog of war, textures |
| `js/ui/` | HUD, panels, screens, automap, tooltips |
| `js/audio.js`, `input.js`, `save.js` | Sound, input, localStorage (guarded) |

---

## Testing

- `node game-062/dev/simtest.mjs` — purity, 480 generated floors (connectivity, stairs, objects never seal floor, quest objects, monster counts), determinism, 6 000 generated items, combat and town flow, every skill of every class, and a bot that plays each class from a new hero to Durian's death.
- `node game-062/dev/browsertest.mjs` — Chromium + SwiftShader: the whole desktop flow with real mouse clicks and keys, and touch-only phones in portrait and landscape with real CDP touches and layout assertions.

---

## Changelog

### v1.0.1 (2026-10-06)
- Phones: centre panels (dialogue, menu, waypoints) no longer slide half off the screen — `.panel.center`'s centring transform outranked the phone layout's `transform: none`; in landscape they no longer poke off the top. Touch buttons hide while a panel is open. The phone browser test now asserts every panel fits on screen.

### v1.0.0 (2026-10-06)
- First release: three classes, eighteen skills, fourteen monsters plus elites and three bosses, twelve procedural levels in three acts, the town with five townsfolk and six quests, loot with Golden uniques, three difficulties, saves, touch controls, generative audio.

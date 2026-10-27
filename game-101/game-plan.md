# PixelCrypt

**Genre:** first-person dungeon crawler ("blobber") with a town, idle investments and endless procedural floors
**Engine:** three.js r165 (CDN import map), vanilla JS modules and DOM, no asset files
**Status:** v1.2.0

---

## Concept

An Etrian Odyssey / Wizardry-style party crawler drawn the way a 1987 PC would have drawn it: sixteen EGA colours, a 320×200 picture, dithered gradients instead of smooth ones. You lead up to six adventurers one square at a time through a dungeon that has no bottom. Every floor, monster, item, stranger, trap, quest and treasure is generated, and the journal keeps count of everything you meet, beat, find, buy and sell. Between expeditions you spend in a night-time town, and you can *buy a stake* in its shops, which then pay you every day (even while the tab is closed) and give you a discount.

The 3D view is real three.js (textured quads, billboards, fog, sprites), rendered to a 320×200 target and then snapped to the EGA palette with a 4×4 ordered dither in a post pass. The art is all drawn in code onto tiny canvases in palette indices (no image files).

## Core loop

Town → buy, equip, recruit, invest → the Descent (floor 1, or any floor under a guardian you have beaten) → map the floor square by square, fight, loot, gather, talk, search for secrets → stairs down (or a scroll home) → town → ...

## Mechanics

### Movement and the map
Grid movement: step forward/back, sidestep, turn 90°. Each cell has four edges: open, wall, closed door, **secret door** (a wall until found with Search), open door. The map fills as you see: a straight line of sight and any room you stand in is *seen*; the cells you walk are *visited* and drawn brighter. Searching checks the four walls and every neighbouring cell for secret doors and hidden traps (chance from the party's best finder: luck, rogues, the Keen-eyed trait).

### Floors (`js/sim/dungeon.js`)
Floor N is a pure function of `(world seed, N)`: a perfect maze (DFS), rooms carved out and doored, a few loops, stairs placed at the two ends of the longest path, secret doors that seal small pockets without ever blocking the way down (proved by BFS), then features: chests (tiers, trapped ones, mimics), hidden traps (dart, pit, alarm, teleporter, spinner, fire rune, gas), gathering points (herb, ore, bug, relic), monster dens, springs, shrines and blood altars, signs, and strangers. Size grows from 9×9 to 36×36. Ten themes (wall, floor, ceiling palettes and a musical key) change every five floors. Every fifth floor has a **guardian** standing on the stairs.

### Monsters (`js/sim/monsters.js`)
20 families (rat → pit fiend) × 17 adjective variants (Young … Primal, elemental, venomous, cursed, blessed). Level follows the floor and leans toward the party (`depth + max(−4, avg − depth) × 0.55`): over-levelling makes monsters tougher and richer, and there is no ceiling. Weaknesses and resistances across six elements; some inflict poison, sleep, stun or curse; families have special moves (drain, steal, web, howl, spores, fire bolt, wail, gaze, guard, breath, quake). Guardians are a family blown up with a name, three special moves and an enrage at 40% HP.

### The party (`js/sim/party.js`)
Up to six of six classes: Warrior, Rogue, Cleric, Mage, Ranger, Alchemist. Stats grow per level, gear adds to them, traits tweak them. 7 skills per class unlock by level (learned automatically). Front and back rows (back-row melee is weaker, bows ignore it; the front takes more hits). Poison, sleep, stun and curse. Level cap 250.

### Battle (`js/sim/battle.js`)
Etrian-style rounds: choose a command per member (Attack, Skill, Item, Defend), the whole round then resolves in speed order. Damage `A² / (A + 1.2 D)` scales without a ceiling. Fight (repeat last round), Auto (the bot's brain plays), Flee (chance from speed; never from a guardian).

### Items (`js/sim/items.js`)
Weapons (10 types), armour (19 pieces in five slots and three weights), charms (8), potions (9 effects), scrolls (8), wands (6, with charges), tomes (permanent stats), collectibles (30). Material by item level, five rarities with prefixes and suffixes, elements, on-hit poison, resistances, names for legendaries. ~5% of gear is **cursed**: stronger, with a hidden penalty, and it won't come off once worn; the church lifts curses and the penalty with them. Potions scale with item level (potency), so a "Grand Healing Potion" means something at every depth.

### The town (`js/sim/town.js`)
Eight places around a fountain: the Descent, the Guild, Item Shop, Weaponsmith, Magic Emporium, Church, Tavern, Inn. Stock is a pure function of `(seed, day, progress)` and refreshes as days pass. The inn rests (a day passes) and recruits (three candidates a day); the church revives, cures, lifts curses and blesses; the tavern sells meals (a feast gives a battle buff).

### Idle investments
Seven businesses at the Guild (tavern, item shop, smithy, magic, inn, church, guild) with levels without end. Cost `base × 1.32^level`; income per day `base × level × 1.08^(level−1) × (1 + 0.04 × deepest floor)`; discount `60% × (1 − 0.955^level)` on that business's prices (meals, items, gear, magic, rooms and recruiting, temple fees; the Guild raises sell prices and quest rewards). Income waits to be collected (capped at ten days), a day passes with rest, with exploring (280 steps) and with real time (150 s per day while open), and a closed tab earns up to 12 days when you come back.

### Quests (`js/sim/quests.js`)
Five kinds, regenerated daily at the Guild board and handed out by Guild runners in the dungeon: slay N of a family, bring N of a collectible, reach floor N, fell a guardian, recover a relic (which is placed on that floor when it is generated or revisited).

### The journal (`js/sim/journal.js`)
Counts per template (so shelves have a fixed size however deep you go): monsters seen/defeated with variants, 120 weapon and 189 armour slots, charms, potions, scrolls, wands, tomes, collectibles (found / bought / sold / used / equipped), strangers met, traps found and sprung, gathering points, plus a record of totals and best finds.

## v1.1: artifacts, achievements, the saga, more of everything

- **Unique artifacts** (`js/sim/uniques.js`): 18 hand-made epic items (Emberfang, Widowmaker, Gravesong, the Quiet Knife, Oathplate, Aegis of Dawn, the Ring of Second Chances, ...) with a name, a line of lore and an effect: lifesteal, vorpal (instant kill, never on a guardian), thorns, regen, focus (MP regen), +XP, +gold, resist-all, strikes first, and a once-a-battle revive. Their numbers scale with the item level where they drop. Each is found once per game: guardians usually carry one, deep or secret chests rarely do, and saga chapters give some. They can't be sold and have their own journal shelf.
- **Achievements** (`js/sim/achievements.js`): 52 milestones in bronze, silver and gold (depth, kills, guardians, levels, chests, secrets, curses, artifacts, businesses, passive income, quests, the bestiary, tablets, the saga), each paying gold once, with a banner, and listed with progress under Camp > Awards.
- **The Lantern saga** (`js/sim/story.js`): optional, begun at the Guild's Story tab. Nine chapters whose objectives the dungeon already contains (reach a floor, fell a guardian, read lore tablets that appear in the walls while a chapter wants them), each with a scene, gold, and sometimes an artifact. The guardians of floors 15, 30 and 45 are named (the Hollow King, the Pale Queen, the Choir Beneath). A quarter of floors hold a lore tablet even if you ignore the saga.
- **More monsters:** 14 new families (centipede, scarecrow, will-o-wisp, harpy, mummy, treant, gargoyle, minotaur, naga, vampire, hydra, elemental, lich, behemoth), 34 in all.
- **More dungeons:** six new themes (Lost Library, Sunken Temple, Clockwork Works, Bloodforge, Crystal Gardens, Void Rift) and four layouts: mazes, **caverns** (rough, open, looped), **great halls** (a few big rooms), **warrens** (no rooms, pure corridors), plus **pitch-black** floors with a short torch radius.
- **Battle rooms:** a fight fades out of the corridor into a hall built from the floor's own wall atlas (bigger, with pillars, for a guardian) and fades back to the exact square and facing. A short input shield after a fight starts or ends stops a tap meant for the corridor from landing on a menu.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Step / back | ↑ W / ↓ S | d-pad / stick | ▲ ▼ |
| Turn | ← → / A D | d-pad / stick | ↰ ↱ |
| Sidestep | Q E | | ◄ ► |
| Search / interact | Space F Enter | X | ACT |
| Map / Menu | M / I Esc | Y / Start | MAP / Menu |
| Battle | 1 Attack 2 Skill 3 Item 4 Defend | A | taps |
| Town | 1–8 open a place | | taps |

## Look and sound

- **Palette:** the 16 EGA colours only. Sprites, textures and icons are painted in palette indices; the 3D scene is rendered at 320×200 and each pixel snaps to the nearest EGA colour with a Bayer 4×4 dither (`js/view/post.js`), so torchlight falloff is a dither between greys. Windows are blue with white double borders; text is VT323 (system monospace fallback).
- **Dungeon:** chunked textured quads per 8×8 cells; ten procedural brick/floor/ceiling atlases with sconces, banners, bones, moss, cracks, doors and arches; torch-flicker fog; billboard sprites for features and strangers; the battle line-up is billboards in front of the camera.
- **Town:** a night square of eight buildings, signs, lamps, a fountain, stars, a moon and a few townsfolk; the camera turns to the selected place.
- **Sound:** all Web Audio: a look-ahead sequencer composes five tunes from seeds (town, menu, dungeon in the floor theme's key, battle, boss) and ~50 chiptune effects.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, frame loop, input routing, idle clock, save/continue, debug hooks |
| `js/sim/game.js` | `newGame`, `act(G, cmd)`, `serialize`/`deserialize` |
| `js/sim/world.js` | movement, searching, features, dialogs, floors, battle outcomes |
| `js/sim/battle.js` | the rounds, skills, enemy specials, rewards, auto commands |
| `js/sim/dungeon.js`, `monsters.js`, `items.js`, `party.js`, `quests.js`, `town.js`, `journal.js`, `camp.js`, `inv.js`, `use.js`, `names.js`, `core.js` | generation and rules (pure) |
| `js/sim/bot.js` | the auto-player (tests, balance, the UI's autoplay) |
| `js/view/stage.js`, `town3d.js`, `textures.js`, `post.js`, `sprites.js`, `pix.js`, `map.js` | three.js scenes, EGA pass, procedural art, automap |
| `js/ui/ui.js`, `screens.js`, `screens-town.js`, `dom.js` | HUD, event playback queue, battle menus, every window |
| `js/audio.js`, `input.js`, `save.js`, `rng.js`, `config.js` | sound, input queue, guarded storage, seeded RNG, constants |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, generation, the rules, determinism and save round trips, and has the bot play whole games. `browsertest.mjs` drives the real game on desktop, a touch-only phone in both orientations, with storage blocked, and with the bot at the controls.

## Balance notes

- The first bot runs hit floor 26 with zero wipes at level 42: monsters ignored the party's level and fights cost ~2% of party HP. Monster level now leans on the party (`× 0.55`), monster attack was raised, and groups grew; the bot now arrives on each floor at about 1.2–1.5× the floor number in level, fights cost the party real HP at guardians, and wipes happen.
- A bug the bot found: HP above the maximum after a gear swap or a curse lowered it. Every command now clamps vitals.
- Shop stock avoids duplicate stacks at low floors.

## Open questions / next steps

- A human pass: balance was tuned with a bot that heals perfectly, and the game has only run under SwiftShader.
- Spells and skills have effects but no per-spell animation beyond the sprite flash and screen tint.
- Rows only matter for the party; enemies have no rows.
- More strangers (a haggling blacksmith, a ghost with a bargain), more traps (an anti-magic zone), keys and locked doors.

## Changelog

### v1.2.0 (2026-10-27)
- Auto-explore: an Auto button (or X) in the dungeon opens every chest, gathers, reads tablets, takes relics, drinks springs when hurt, walks every reachable square, fights every battle with the auto-battler and heals the party below a threshold (Settings, 20-90%). It runs at the game's own pace, one step or blow at a time, waiting for each animation; any key or the Stop button takes the wheel back. It stops with a reason when the floor is done, a guardian holds the stairs, or the party is in danger with nothing left to heal with. The planner is pure (`js/sim/auto.js`) and tested.

### v1.1.0 (2026-10-27)
- Unique artifacts with effects, 52 achievements, the optional nine-chapter Lantern saga with lore tablets and named guardians, 14 new monster families, six new themes and four floor layouts with pitch-black floors, battles staged in a hall built from the floor's own walls, an input shield around fights.

### v1.0.0 (2026-10-26)
- First release: procedural endless dungeon, six classes, Etrian-style battles, procedural items with curses, journal, automap, town with eight places, idle investments, quests, strangers, EGA-quantized three.js view, chiptune music and effects, touch and gamepad support, bot and test harnesses.

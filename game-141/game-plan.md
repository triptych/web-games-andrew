# SANDSUNK — The Archaeomancer's Dig

**Genre:** Cozy dig-and-collect puzzle (Minesweeper deduction without instant death, a Motherload-style run back to camp, a museum of 3D finds)
**Engine:** three.js r165, sim/view layout. Art painted with fal, sixteen artifact models by Meshy, music, sound effects and voices by ElevenLabs. Every one has a code fallback.
**Status:** v1.0.1

---

## Concept

You are Sela Marrow, a young magical archaeologist. A colossal sandstone tower has been found in the desert, sunk so deep that only its crown shows above the dunes. With Quill (a fussy clockwork owl) you climb down floor by floor, digging the sand and rubble out of each tower floor block by block, to reveal its rooms, its treasures and its sixteen great artifacts, and at the bottom the Heart of the Spire, which the tower sank to protect.

There is no clock and no game over. Tap a block to dig. Hidden among the blocks are traps and sleeping tomb creatures; the numbers on open floor say how many lie in the eight blocks around each tile, so a careful reader can mark them first and meet them safely. A careless dig only hurts, never kills outright: the worst that happens is Quill's camel-drivers hauling you up to camp for a small fee.

Touchstones: Minesweeper (the numbers), Motherload (dig down, run out, go home, upgrade, go deeper), Curio Cove / any museum collector (the collection), the painted fantasy mobile UI the brief attached (leather panels, gold trim, glossy orange pills).

## Core loop

1. **Dig** an exposed block (one that touches open floor). Each strike costs 1 stamina; hard blocks take several.
2. **Read** the numbers and **mark** blocks you believe are dangerous; striking a marked trap disarms it (gold, XP), a marked monster is ambushed (free hit, no counter). A false alarm costs 3 stamina.
3. **Fight** whatever wakes: a monster hits back after every strike you make, anywhere, until you beat it.
4. **Solve** the floor's puzzles (rune order, sun conduit, chest locks, bronze door).
5. **Clear** every block, monster and chest: the hatch opens. Descend.
6. Run out of stamina (or faint) → **camp**: rest for free, shop with Zahra, spend skill points, claim quests, visit the museum. Climb back down; the floor is exactly as you left it.

## State, commands, events

### G (`js/sim/game.js`)
`{ v, seed, rng, mode: dig|camp|ending, n (floor), F (the floor), hp, st, lv, xp, sp, skills{}, arts{}, artOrder[], gold, gems, inv{potion,tonic,hyper,ward,blast,dowse}, keys, hyper (strikes left), ward (charges), phoenix (used this expedition), quests[], qn, stats{…}, said{}, deepest, ended, turn, events[] }`

### F (`js/sim/floor.js`)
`{ n, w, h, theme, treasure, boss, cells[], start, exit, runeN, runeNext, hidden, lens, panel, pipes[], door, cleared }`
A cell: `{ k: b|o|p (block, open, pillar), b (block type), hp, mx, c (content: {d:'trap'|'mon'} or {loot}), o (object: stairs|chest|pipe|lens|mon), m (marked), room, r (rune order), lit, seen (shown by dowsing), n (danger number), pw (powered) }`.
Everything is plain JSON; cells refer to one another by index, so a save is `JSON.stringify`.

### Commands (`act(G, cmd)`)
`dig i` · `mark i` · `rot i` · `press i k` · `use id [i]` · `descend` · `camp` · `embark` · `buy id` · `learn id` · `claim q` · `continue`.

### Events
`strike, break, shock, trap, disarm, falseAlarm, monster, ambush, mhit, mattack, mdie, hurt, warded, revive, faint, exhausted, loot, artifact, levelup, runeLit, runeReset, runeFizzle, runeSolved, rot, panelOpen, press, chestUi, chestOpen, unlock, locked, sealed, clear, descend, floor, camp, embark, buy, use, blast, dowsed, learn, claim, questReady, say, ending, deny`.

## Mechanics (each has a line in `dev/simtest.mjs`)

| Rule | Detail |
|---|---|
| Exposure | Only a block with an open orthogonal neighbour can be struck. |
| Damage | soft: pick · stone: pick + Stonecraft · obsidian/crystal: ⌊pick × (1 + lore + artifact) / 3⌋ (min 1) · ×2 Lucky Strike (12%/rank) · ×3 Hyper Gauntlet. Pick = 1 + Pickaxe Power + Desert Rose Pick + Heart. |
| Block HP | base × (1 + 0.22 × (floor − 1)): a stronger pick still has work to do deeper down. |
| Numbers | Every open tile shows the count of traps + sleeping monsters in its 8 neighbours. The first dig of a floor is always safe. |
| Marks | Marked trap → disarmed (XP 3, gold). Marked monster → wakes stunned and takes 2× pick. Unmarked monster → strikes at once. False alarm → −3 stamina. |
| Never an instant knockout | A hit taken above 25% of max HP always leaves at least 1 HP. |
| Fainting | At 0 HP: the Phoenix Feather revives once per expedition, else you are carried to camp for 15% of your gold. |
| Exhaustion | At 0 stamina you climb up to camp. Camp restores everything for free. |
| Runes | Strike in numeral order; a wrong one resets the lit ones (Glyphreading or the Lapis Scepter: it only fizzles). On treasure floors the numerals hide until you have the Glyph Tablet (floor 3). |
| Sun conduit | A pedestal, 3–7 gold channels and a sun panel. With the Sun Lens (floor 4) the pedestal shines; light flows through uncovered channels whose openings meet; reaching the panel opens it (its cache: gold and gems). Tap a channel to turn it. |
| Chest lock | 5 runes in a ring; pressing one flips it and both neighbours. Every one of the 31 unsolved states is solvable (proved in the test). |
| Bronze door | Needs a key found elsewhere on the same floor (proved reachable without passing the door). |
| Clear | No blocks, no monsters, no closed chests. Then the hatch opens. |

## Content

### Floors
Story floors 1–16 (6×6, then 7×7, 8×8, 9×9); every 4th is a treasure floor (more gold, three chests, hidden rune order, the floor's artifact in a chest). Floor 16 is the Heart Chamber with the Sphinx Warden. After the ending the Echo Deeps go on forever.

| Floors | New blocks | Puzzles |
|---|---|---|
| 1–2 | sand, packed sand | door (2) |
| 3–6 | sandstone, brick | runes (3, 6), conduit (5), door (5) |
| 7–12 | granite, obsidian | runes, conduits from 8, doors |
| 13–16 | crystal | everything |

### Monsters (art/monsters.webp)
Lapis Scarab (1), Sand Wraith (3), Mummy Jackal (5), Gilded Cobra (7), Clay Golem (9), Sphinx Moth (11), the Sphinx Warden (16). HP × (1 + 0.07n), attack + n/5.

### Artifacts (models/*.glb, art/arts.webp)
| Floor | Artifact | Kind | Effect |
|---|---|---|---|
| 1 | Wayfinder's Compass | tool | +8 max stamina |
| 2 | Winged Scarab | jewel | +15% gold |
| 3 | Glyph Tablet | relic | shows hidden rune order |
| 4 | Sun Lens | idol | powers sun pedestals |
| 5 | Desert Rose Pick | tool | +1 pick |
| 6 | Hourglass of Ages | relic | +10 max stamina |
| 7 | Cobra Bangle | jewel | monsters hit 1 less |
| 8 | Golden Mask | jewel | chests ×1.5 gold |
| 9 | Lamp of Lumen | idol | sleeping monsters show as eyes |
| 10 | Obsidian Chisel | tool | +1 Obsidian Lore |
| 11 | Star Chart Disc | relic | artifacts and chests glint |
| 12 | Phoenix Feather | relic | revive once per expedition |
| 13 | Crystal Tuning Fork | tool | +1 Crystal Song |
| 14 | Jackal Idol | idol | monsters drop ×2 gold |
| 15 | Lapis Scepter | idol | wrong runes only fizzle |
| 16 | Heart of the Spire | relic | +1 pick, +10 stamina, the ending |

### Skill tree (13 skills, 41 ranks; one point a level)
Pickaxe: Pickaxe Power 5, Lucky Strike 3 (Pick 2), Shockwave 2 (Pick 3). Body: Endurance 5, Vitality 5, Ward-weave 3 (Vitality 2), Forager 2 (Endurance 2). Stonecraft: Stonecraft 3, Obsidian Lore 3, Crystal Song 3 (both Stonecraft 1). Arcana: Dowsing 3, Prospector 3, Glyphreading 1 (Dowsing 1).

### Zahra's wares
Health Potion 35g · Stamina Tonic 25g · Hyper Gauntlet 70g (25 triple strikes) · Ward Charm 50g (3 charges) · Blast Charge 3 gems (3×3, disarms) · Dowsing Rod 2 gems (shows every danger on the floor).

### Quests
Three at a time, counted from when they are offered: blocks, stone blocks, floors, traps disarmed, monsters, chests, puzzles, and "find a tool/jewel/relic/idol" (offered only while one of that kind is still ahead). Each pays gold; every third pays a gem.

## Story
Quill speaks the tutorial as things first happen (numbers, marking, the first monster, runes, the conduit, chests, doors, levelling, quests, camp, fainting), Sela answers with a few lines, Zahra greets you at camp. Floor names give each level a place in the tower (the Antechamber Dunes, the Glyph Galleries, Queen Ishet's Treasury, the Observatory Well, the Singing Caverns…). At the bottom the Heart is found; descending from the Heart Chamber plays the ending (the tower rises out of the desert at sunrise) and opens the endless Echo Deeps.

## Controls

| Action | Mouse / keys | Touch | Pad |
|---|---|---|---|
| Dig, fight, turn a channel, open a chest | Click; or arrows + Space | Tap | d-pad + A |
| Mark | Right-click; F | Long-press, or ⚑ then tap | X |
| Items | 1–6 | Belt | — |
| Skills · Quests · Museum · Camp | K · Q · M · C | Buttons | — |
| Pause | Esc / P | ⚙ | Start |

## Look and sound
- The board is three.js: painted block tops (`art/tiles.webp`, a 4×4 fal atlas), darker sides, shadows from a warm sun, a sandstone wall round each floor. Exposed blocks catch the light; buried ones sit in shadow. Danger numbers, rune numerals, flags, warnings and lamp eyes are canvas-drawn sprites; monsters and chests are fal sprites; channels are canvas-drawn gold.
- Juice (`js/view/fx.js`, all pooled): every strike squashes and shakes its block and chips a few fragments; every break throws 12–30 tumbling, bouncing chunks in the block's colour, a dust cloud, a light flash and a camera kick scaled to the block's hardness; crystal and obsidian also sparkle. Floating damage numbers, gold that flies to the purse, a red vignette when hurt, shock rings, light beams for artifacts and the sun panel, blocks that drop into place when a floor begins, a camera dive into the hatch. Sound pitch-shifts every dig and climbs with quick combos.
- The museum (`js/view/museum.js`) is the one place with real models: each Meshy artifact turns on a marble plinth under a spotlight with an environment map, dust motes in the beam; drag to turn.
- Music: four ElevenLabs themes (dig, treasure vault, camp, ending), crossfaded; voices duck the music.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, pointer/keyboard → commands, event routing, autosave, debug hooks |
| `js/sim/game.js` | The rules: `act(G, cmd)`, serialize/deserialize (pure) |
| `js/sim/floor.js` | Seeded floor generation with its own reachability proof; the conduit's power flow (pure) |
| `js/sim/bot.js` | An auto-player that reads only what a player can see; minesweeper deduction (pure) |
| `js/sim/data/` | Blocks, monsters, artifacts, skills, items, quests, story lines |
| `js/view/view.js`, `fx.js`, `museum.js` | The board, its effects, the 3D museum |
| `js/ui.js` | HUD, screens, shop, skill tree, quests, museum, chest lock, dialogue, floaters |
| `js/audio.js`, `js/media.js`, `js/input.js`, `js/save.js` | Sound, the media list, key queue, guarded storage |

## Testing
See [dev/README.md](dev/README.md). `simtest.mjs`: purity (and that the bot never looks inside a block), ~100 rules, 1152 generated floors against their plan, determinism and a save round trip, and the bot playing the whole story on SEEDS seeds at three skill levels with per-command invariants, then four endless floors. `browsertest.mjs`: desktop with real mouse, right-click and keys; two touch-only phones with real taps and long-presses; blocked storage; the Meshy model loading; the ElevenLabs audio decoding.

## Balance notes
Tuned against the bot at skill 1 (uses every deduction), 0.5 and 0 (digs at random). 12 seeds:

| Bot | Level at the Heart | Expeditions | Faints | Damage taken | Gold left |
|---|---|---|---|---|---|
| careful (1) | ~24 | ~19 | 0 | ~60 | ~10k |
| half (0.5) | ~24 | ~19 | 0 | ~170 | ~9k |
| careless (0) | ~23 | ~24 | ~2 | ~1300 | ~5k |

- First pass had fixed block HP: pick power outran it, floors took 40–100 strikes and nobody ever ran out of stamina. Block HP now grows 22% a floor.
- Food, gold piles and chest gold were cut by about half; the careful bot still finishes rich, which leaves room for players who buy everything.
- Danger density 0.11 + 0.008n (cap 0.24): reading the numbers is the difference between ~60 and ~1300 damage over the story, and a careless player faints about twice. Bands are asserted in the simtest.

## Open questions / next steps
- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- The Echo Deeps reuse the story's ideas; they could use their own monsters and puzzles.
- No undo for a misplaced mark beyond tapping it again; maybe fine.

## Changelog

### v1.0.1 (2026-11-18)
- Readable type: the blackletter headings (Grenze Gotisch) were hard to read, especially skill names and buttons. Headings, buttons and names are now Alegreya, body text Nunito, the logo Cinzel; the smallest text is a step larger; the canvas-drawn danger numbers and rune numerals are repainted once the web fonts load.

### v1.0.0 (2026-11-18)
- First release: 16 story floors and the endless Echo Deeps; digging with marks, traps and monsters; rune, sun-conduit, chest-lock and key puzzles; 16 artifacts with 3D models in a museum; a 13-skill tree; Zahra's shop; rolling quests; camp; voiced tutorial; painted UI; desktop, touch and keyboard.

# JINGLE POP

**Genre:** Bubble shooter (match-three puzzle), Christmas story campaign plus an endless mode
**Engine:** three.js r165 (orthographic, instanced), sim/view layout, no build step
**Media:** art generated with ElevenLabs (Google Nano Banana 2.1); music, effects and voices with ElevenLabs
**Status:** v1.0.0

---

## Concept

Grimwick, a small snow goblin who loves anything shiny, blew every ornament out of Santa's workshop with his blizzard
bellows. **Juniper "Juni" Sprigg**, a junior elf, has six nights before Christmas Eve to win them back with her
candy-cane *bauble blaster*. You aim, bank shots off the walls and match three or more glass ornaments of a colour to
pop them free; anything left hanging from nothing falls too. Clear every ornament to win the level.

It riffs on the classic arcade bubble shooters (a hex grid hanging from a ceiling that creeps down), with a cosy
holiday story, a tray of up to three ornaments to swap between, grid specials and power-ups that all come from the
Christmas theme, and an endless Blizzard.

## Core loop

1. Aim (pointer, keys or stick); the guide shows the path to the first bounce.
2. Choose which tray ornament to load (later chapters), or load a power-up from the sack.
3. Shoot. The shot flies along its traced path and sticks where it touches. Three of a colour pop; whatever no longer
   hangs from the ceiling falls. Presents open, ice thaws, bells ring.
4. Every shot adds to the ceiling's pressure (a shot that pops nothing adds two). When the ❄ meter fills, the ceiling
   comes down a row. An ornament below the red line loses the level.
5. Clear every ornament (coal and bells don't count) to win; stars by shots against par.

## Mechanics

### The board
- Hex grid, `COLS = 11`: even rows hold 11 ornaments centred at `x = c + 0.5`, odd rows 10 at `x = c + 1`. One ball is
  one world unit. "Even" is relative to `G.par`, so endless mode can push a row in at the top without the rows below
  changing shape. The ceiling sits `G.ceil` rows down.
- A shot is traced the moment it is fired (`hex.traceShot`): exact ray-against-circle tests with radius `HIT_DIST =
  0.86` (a little under one ball, so shots slip through gaps a ball wide) and mirror bounces off the side walls. It
  settles in the nearest empty cell that touches a ball or the ceiling. The flight then just follows the traced path at
  `SHOT_SPEED`, so the landing is known in advance and the aim guide, the bot and the real flight always agree.
- Aim is clamped to `[AIM_MIN, π − AIM_MIN]` above horizontal.

### Matching and dropping
- A group is the connected same-colour ornaments around the landed one; prism baubles join any colour. Three or more
  pop. After any pop, everything not connected to the ceiling falls (and scores more than a pop).
- Score: 10 per pop, 20 per drop (×1 extra for every five falling together), all times the streak multiplier
  (`1 + 0.25 × streak`, up to ×3) for consecutive shots that pop something.

### Grid specials (introduced one per chapter)
| Special | Rule |
|---|---|
| Wrapped Present (ch. 1) | A pop or drop next to it opens it: a power-up unlocked by this chapter goes into the sack (full sack: +200). |
| Lump of Coal (ch. 2) | Never matches. Falls when what holds it up goes, or a blast destroys it. Doesn't count for clearing. |
| Frozen Ornament (ch. 3) | Its colour shows through the ice but it can't match until it thaws: a shot that lands against it, or a pop next to it. Blasts pop it outright. (v1.0.0 before release: thawing only by a pop left the perfect bot stuck on a last frozen ornament until the ceiling came down.) |
| Golden Bell (ch. 4) | A pop next to it rings it: it pops everything around it (coal too), chaining into other bells. |
| Prism Bauble (ch. 5) | Matches every colour; counts as an ornament to clear. |

### The tray
- Chapter 1: one ornament (with a preview of the next). Chapters 2–3: two. Chapters 4–6 and the Blizzard: three.
- Tap a tray ornament (or 1/2/3) to swap it into the launcher; tap the launcher or press ↓/S to rotate the tray.
- New ornaments are drawn uniformly from the colours still on the board; tray ornaments of a colour that has been
  cleared are recoloured.

### Power-ups (the sack holds three)
Presents and the Christmas-spirit meter (36 ornaments popped or dropped) give power-ups unlocked so far.

| Power-up | Unlocks | Kind | Effect |
|---|---|---|---|
| Pudding Bomb | ch. 1 | shot | Bursts everything within 1.75 units (two rings) of where it lands, ice and coal included. |
| Rainbow Star | ch. 1 | shot | Becomes the colour that makes the biggest group where it lands; pops with a single partner. |
| Candy Cane Striker | ch. 2 | shot | Passes through everything on its path (bouncing off walls) to the ceiling, smashing up to 9 ornaments, then shatters. |
| Gingerbread Break | ch. 2 | instant | The ceiling rises a row and the pressure resets (Blizzard: the pressure resets). |
| Hot Cocoa | ch. 3 | shot | Thaws every frozen ornament on the board and melts coal within 2.6 units. |
| Jingle Bell | ch. 4 | shot | Rings away every ornament (frozen ones too) of the colour it touches, everywhere. |
| Tinsel Garland | ch. 4 | shot | Sweeps away the row it lands in and the row above. |
| North Star | ch. 5 | instant | The full aim path and a ghost of the landing spot for the next 8 shots. |

A shot power-up loads into the launcher (replacing the colour until fired); tapping the tray puts it back in the sack.

### Pressure, losing, winning
- Levels: `dropEvery = drop + 3` from the level table. Each shot adds 1, a shot that pops nothing adds
  `PRESSURE_MISS = 2`; at `dropEvery` the ceiling comes down a row.
- Any ornament whose centre is below `DEAD_Y = 13.1` loses.
- Winning: no ornaments (normal, frozen, prism) left. The coal and bells that remain fall for points. Stars: 3 at or
  under par, 2 up to `par × 1.45`, else 1. Par is baked by `dev/balance.mjs` (the perfect bot's median × 1.35 + 2).

### The Blizzard (endless)
Starts with six random rows and a three-ornament tray. The same pressure pushes a new row in at the top (and the rows
already there keep their columns: the parity flips). The pressure needed shrinks from 9 to 4 (one less every four
rows); colours go from 4 to 5 at 1,500 points and 6 at 5,000; ice, coal, bells and prisms appear more as it goes on.
Best score saved.

## Content

### Chapters
| # | Chapter | Backdrop | Music | New special | Unlocks |
|---|---|---|---|---|---|
| 1 | Santa's Workshop | workshop at night | play1 | presents | Pudding Bomb, Rainbow Star |
| 2 | Gingerbread Lane | gingerbread village at dusk | play1 | coal (tray of 2) | Candy Cane, Gingerbread Break |
| 3 | Candy Cane Forest | candy cane forest | play1 | ice | Hot Cocoa |
| 4 | Twinkle Pond | frozen pond under the moon | play2 | golden bells (tray of 3) | Jingle Bell, Tinsel Garland |
| 5 | Reindeer Ridge | aurora over the stables | play2 | prism baubles, 6 colours | North Star |
| 6 | Grimwick's Hoard | ice palace | play2 | everything | — |

### Levels
36, listed in [js/sim/data/levels.js](js/sim/data/levels.js): each a name, a **shape** (full, tree, v, stripes, columns,
zigzag, arch, diamond, heart, wreath, star, snowman, bells), a **paint** scheme (random, clusters, rows, cols, diag,
rings, halves), rows (4 → 11), colours (3 → 6), tray slots, pressure, and special counts. `js/sim/levels.js` builds the
board from the level's own seed, so a level is the same board every time. Two rules came from the bot:
- Every shape hangs from a full two-row garland (`BAND`). Without it, shapes with a thin stalk at the top (the tree,
  the star, the wreath) were cleared in one to three shots by popping the stalk.
- No colour group bigger than six (four in the top two rows); the clusters and rows paints made 20-ball groups whose
  one pop dropped the board.
- Coal never goes in the top two rows, and never where it would leave an ornament with fewer than two neighbours that
  aren't coal: a top-right corner ornament boxed in by two lumps could never be matched, and the perfect bot lost
  Treasure Heaps to it. The simtest checks every level for it.

## Story

Juni (bubbly elf, voiced), Mrs. Holly Claus (the quest giver, voiced), Grimwick (the goblin, voiced). Mrs. Claus asks
Juni to bring the ornaments home; at the start of each chapter Grimwick taunts her (coal in the gingerbread, frozen
ornaments, he can't resist bells...) and Juni answers. By the hoard he admits the ornaments are the only sparkles he
has ever had. The ending: Juni realises he just wanted a tree of his own, Mrs. Claus says he shall have one, and the
last picture is the two of them decorating trees side by side. The Blizzard opens with Grimwick's dare. Lines are in
`STORY` in `levels.js`; each scene is played once (progress.seen).

## Controls

| Action | Keyboard | Mouse / touch | Gamepad |
|---|---|---|---|
| Aim | ← → / A D (Shift: fine) | point / hold a finger on the board | stick, d-pad |
| Shoot | Space / ↑ / W | click / lift the finger over the board (drag below the launcher to cancel) | A |
| Swap | ↓ / S rotates; 1 2 3 picks | tap a tray ornament or the launcher | X |
| Power-up | Q E R | tap the sack | Y, LB, RB |
| Pause | P / Esc | ❚❚ | Start |

## Look and sound

- An orthographic camera straight on: sim (x, y) is world (x, −y), so the UI and pointer use a plain scale and offset.
- Ornaments: one instanced sphere mesh per colour, MeshPhysical with clearcoat against a RoomEnvironment map, each with
  its own painted pattern (cranberry bands, gold dots, evergreen zigzag, frost-blue snowflakes, silver ribs, plum
  stars), so colour is never the only cue; a gold cap and loop on each. Ice is a faceted translucent shell, coal a
  rough icosahedron, presents textured boxes with a bow, bells a lathe, prisms an iridescent rainbow.
- A wooden, snow-capped beam with icicles and a string of bulbs marks the ceiling; a frosted wash covers the rows it
  has come down. Sparkles and falling snow are point sprites; dropped ornaments tumble away under gravity.
- The chapter's painted backdrop sits behind the transparent canvas (CSS). Juni stands beside the board in three
  poses (aiming, cheering, sheepish), cut out of ElevenLabs renders.
- Music: ElevenLabs title theme, two play themes, a boogie-woogie Blizzard theme, win and lose stings. 16 effects;
  25 voice lines. A Web Audio synth stands in for anything that fails to load.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, story/map/blizzard flow, voice triggers, debug hooks (`window.__jp`) |
| `js/sim/game.js` | Rules: `newGame`, `step`, landing, popping, drops, specials, power-ups, pressure, endless rows, `preview`, save |
| `js/sim/hex.js` | The grid, neighbours, snapping, the exact shot trace |
| `js/sim/levels.js` | Board generator: shapes, paints, group caps, specials, endless rows |
| `js/sim/bot.js` | Auto-player: traces ~100 aims × tray options, runs `preview` on a copy, skill dial |
| `js/sim/data/levels.js`, `par.js` | Chapters, 36 levels, power-ups, specials, story; the baked par table |
| `js/view/view.js` | three.js: board, instanced ornaments, launcher, aim guide, particles, snow, layout |
| `js/ui.js` | DOM screens, HUD, sack, tray hit targets, elf poses, callouts, story player, map |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule and special and power-up, the 36 levels
(deterministic, hanging, group caps, specials, par), determinism and mid-flight save round trips, and has the bot play
every level at three skills with asserted balance bands, plus the Blizzard. `browsertest.mjs` drives the real game on
desktop, touch-only phones in both orientations and with storage blocked.

## Balance notes

From `simtest` (5 seeds per level) and `balance.mjs`:
- The perfect bot clears every level, typically in 10–35 shots. It previews every aim exactly, so par is 1.35× its
  median plus 2; skill 0.6 averages 1–2 stars.
- Skill 0.6 clears 100% of chapters 1–2 and ~95% of chapters 5–6; skill 0.3 clears 98% early and ~88% late (the
  final level: 2 of 5).
- The Blizzard: skill 0.6 lasts about 90–330 shots, skill 1 several hundred (it is endless by design; the shrinking
  pressure and the six colours win in the end).
- Changed because of the bot: the garland band and the group caps (above); the candy cane is capped at 9 ornaments (it
  used to zig-zag through whole boards); the ceiling pressure counts every shot (a "drop after N misses" rule never
  dropped for the bot or anyone competent); L32's pressure raised by one; a shot landing against ice cracks it; the coal
  rule above.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person and SwiftShader is not a GPU. Par and the pressure numbers
  are the bot's; real players may want them looser.
- More levels and seasonal events; a daily Blizzard seed.

## Changelog

### v1.1.0 (2026-11-26)
- Added: cloud saves. **☁️ Cloud Save** on the title screen and in the menu opens the shared dialog
  ([lib/core/cloud-ui.js](../lib/core/cloud-ui.js)): sign in with an emailed link (one sign-in for every game on the
  site), save this game online and load it on another device. Everything stored under the game's save key goes up
  (settings stay on the device); loading writes it back and restarts the game. It also saves to the cloud by itself
  while signed in. See [docs/generic/cloud-saves.md](../docs/generic/cloud-saves.md).

### v1.0.0 (2026-11-22)
- First release: 36 levels in six chapters, five specials, eight power-ups, a swap tray of up to three, the endless
  Blizzard, a voiced story with three characters, ElevenLabs art, music, effects and voices, sim and browser tests.
